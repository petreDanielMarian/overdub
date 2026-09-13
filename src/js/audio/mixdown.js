// Renders the finished track: intro layer(s) once, the loop layers repeated `repeatCount`
// times, outro layer(s) once, with a short overall fade at each end — via OfflineAudioContext,
// so it renders as fast as possible rather than in real time. See wav-encoder.js for turning
// the result into a file.

var DEFAULT_FADE_SEC = 0.4;

function layersWithRole(layers, role) {
  return layers.filter(function (l) { return l.role === role && !l.muted; });
}

function longestDuration(layerList) {
  return layerList.reduce(function (max, l) { return Math.max(max, l.buffer.duration); }, 0);
}

// loopDurationSec: the shared loop length every "loop"-role layer was recorded at.
// repeatCount: how many times the loop section plays in the final render.
export function renderMixdown(layers, loopDurationSec, repeatCount, OfflineAudioContextCtor) {
  OfflineAudioContextCtor = OfflineAudioContextCtor || OfflineAudioContext;
  var intro = layersWithRole(layers, "intro");
  var loop = layersWithRole(layers, "loop");
  var outro = layersWithRole(layers, "outro");

  var introDuration = longestDuration(intro);
  var loopSpan = loopDurationSec * Math.max(1, repeatCount);
  var outroDuration = longestDuration(outro);
  var totalDuration = introDuration + loopSpan + outroDuration + DEFAULT_FADE_SEC;

  if (totalDuration <= 0) return Promise.resolve(null);

  var sampleRate = (loop[0] || intro[0] || outro[0]).buffer.sampleRate;
  var offlineCtx = new OfflineAudioContextCtor(2, Math.ceil(totalDuration * sampleRate), sampleRate);

  var master = offlineCtx.createGain();
  master.connect(offlineCtx.destination);
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(1, Math.min(DEFAULT_FADE_SEC, totalDuration / 4));
  var fadeStart = Math.max(0, totalDuration - DEFAULT_FADE_SEC);
  master.gain.setValueAtTime(1, fadeStart);
  master.gain.linearRampToValueAtTime(0, totalDuration);

  function schedule(layerList, startAt, loopThis, stopAt) {
    layerList.forEach(function (l) {
      var src = offlineCtx.createBufferSource();
      src.buffer = l.buffer;
      var gain = offlineCtx.createGain();
      gain.gain.value = l.volume;
      src.connect(gain);
      gain.connect(master);
      if (loopThis) {
        src.loop = true;
        src.loopStart = 0;
        src.loopEnd = loopDurationSec;
        src.start(startAt);
        src.stop(stopAt);
      } else {
        src.start(startAt);
      }
    });
  }

  schedule(intro, 0, false, null);
  schedule(loop, introDuration, true, introDuration + loopSpan);
  schedule(outro, introDuration + loopSpan, false, null);

  return offlineCtx.startRendering();
}
