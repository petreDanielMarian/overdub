// A plain PCM16 WAV writer — no external encoding library, no licensing question. Takes
// anything shaped like a Web Audio AudioBuffer ({sampleRate, numberOfChannels, length,
// getChannelData(ch)}) so it works against a real AudioBuffer in the browser and against a
// plain fake object in a Node unit test, with no AudioContext involved either way.

function clampToInt16(sample) {
  var s = Math.max(-1, Math.min(1, sample));
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
}

function writeString(view, offset, str) {
  for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

// Returns a plain ArrayBuffer — the pure, testable half. encodeWavPCM16Blob below wraps it
// for the browser.
export function encodeWavPCM16ToArrayBuffer(audioBufferLike) {
  var numChannels = audioBufferLike.numberOfChannels;
  var sampleRate = audioBufferLike.sampleRate;
  var numFrames = audioBufferLike.length;
  var bytesPerSample = 2;
  var blockAlign = numChannels * bytesPerSample;
  var dataSize = numFrames * blockAlign;
  var buffer = new ArrayBuffer(44 + dataSize);
  var view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt subchunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // subchunk1 size (PCM)
  view.setUint16(20, 1, true); // audio format: 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample

  // data subchunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  var channelData = [];
  for (var c = 0; c < numChannels; c++) channelData.push(audioBufferLike.getChannelData(c));

  var offset = 44;
  for (var i = 0; i < numFrames; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      view.setInt16(offset, clampToInt16(channelData[ch][i]), true);
      offset += 2;
    }
  }

  return buffer;
}

export function encodeWavPCM16Blob(audioBuffer) {
  return new Blob([encodeWavPCM16ToArrayBuffer(audioBuffer)], { type: "audio/wav" });
}
