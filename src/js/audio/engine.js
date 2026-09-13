// The looper engine — owns the AudioContext, the continuous mic capture, and the loop-boundary
// scheduling described in loop-timing.js. Everything DOM/AudioContext-dependent lives here;
// the pure math is in loop-timing.js, per-layer gain bookkeeping is in layers.js, and the
// export render is in mixdown.js + wav-encoder.js.
//
// Two recording flows, because "loop"-role layers and "intro"/"outro"-role layers need
// different things:
//   - A "loop" layer must phase-lock with the ones already playing, so it's always quantized
//     to the existing boundary grid (armLoopOverdub) — including the very first layer, which
//     instead *establishes* that grid (beginFirstRecording/endFirstRecording).
//   - An "intro"/"outro" layer is a one-shot that only plays once, at export time (see
//     mixdown.js) — it never joins the live loop, so it has no boundary to wait for and no
//     fixed length to match. It's a plain manual start/stop (beginManualRecording/
//     endManualRecording), free-length, same whether it's a first take or a redo.
import { computeNextBoundary } from "./loop-timing.js";
import { createLayer, applyGains } from "./layers.js";
import { renderMixdown } from "./mixdown.js";
import { encodeWavPCM16ToArrayBuffer } from "./wav-encoder.js";

var LOOKAHEAD_SEC = 0.08; // time the UI gets to show a "get ready" cue before a boundary

export function createLooperEngine() {
  var ctx = null;
  var micStream = null;
  var micSource = null;
  var captureNode = null;
  var micStartTime = null; // ctx.currentTime when continuous capture began
  var chunks = []; // Float32Array pieces, in arrival order — the whole session's raw capture
  var recordedSampleCount = 0;

  var loopOrigin = null; // ctx.currentTime the first "loop" layer's playback started at
  var loopDurationSec = null;

  var manual = null; // { role, startSample, replaceLayerId } while a free-length take is running
  var pendingLoop = null; // { startSample, replaceLayerId, boundaryTime } while a loop overdub is armed/capturing

  var layers = [];
  var soloedId = null;
  var nextLayerId = 1;
  var listeners = [];

  function emit() { listeners.forEach(function (fn) { fn(snapshot()); }); }

  function snapshot() {
    return {
      hasLoop: loopOrigin != null,
      loopDurationSec: loopDurationSec,
      recordingManual: manual ? manual.role : null,
      armed: !!pendingLoop,
      layers: layers.map(function (l) {
        return { id: l.id, role: l.role, muted: l.muted, volume: l.volume, soloed: l.id === soloedId, durationSec: l.buffer.duration };
      }),
    };
  }

  function ensureContext() {
    if (ctx) return Promise.resolve();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.audioWorklet.addModule(new URL("./capture-worklet.js", import.meta.url));
  }

  // One mic stream for the whole session — never stopped/restarted between layers, which is
  // what removes per-layer start latency from the timing picture entirely (see loop-timing.js).
  function startMic() {
    return ensureContext().then(function () {
      if (micStream) return;
      return navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        .then(function (stream) {
          micStream = stream;
          micSource = ctx.createMediaStreamSource(stream);
          captureNode = new AudioWorkletNode(ctx, "capture-processor");
          micStartTime = ctx.currentTime;
          captureNode.port.onmessage = onCaptureChunk;
          micSource.connect(captureNode);
          // captureNode has nothing downstream — it's a tap for recording, not a playback path,
          // so it's never connected to ctx.destination (that would monitor the raw mic live).
        });
    });
  }

  function onCaptureChunk(e) {
    var chunk = e.data;
    chunks.push(chunk);
    recordedSampleCount += chunk.length;
    if (pendingLoop) {
      var endSample = pendingLoop.startSample + Math.round(loopDurationSec * ctx.sampleRate);
      if (recordedSampleCount >= endSample) completeLoopOverdub(endSample);
    }
  }

  // Reads [startSample, endSample) out of the continuous capture without ever materializing
  // more than the requested range.
  function readRange(startSample, endSample) {
    var out = new Float32Array(Math.max(0, endSample - startSample));
    var cursor = 0;
    var writeAt = 0;
    for (var i = 0; i < chunks.length && cursor < endSample; i++) {
      var chunk = chunks[i];
      var chunkStart = cursor;
      var chunkEnd = cursor + chunk.length;
      var from = Math.max(startSample, chunkStart);
      var to = Math.min(endSample, chunkEnd);
      if (to > from) {
        out.set(chunk.subarray(from - chunkStart, to - chunkStart), writeAt);
        writeAt += to - from;
      }
      cursor = chunkEnd;
    }
    return out;
  }

  function makeBuffer(samples) {
    var buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    return buffer;
  }

  function playLoopLayer(layer, startAt) {
    var src = ctx.createBufferSource();
    src.buffer = layer.buffer;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = loopDurationSec;
    src.connect(layer.gainNode);
    layer.gainNode.connect(ctx.destination);
    src.start(startAt);
    layer.sourceNode = src;
  }

  // --- Layer 1: defines the loop length AND establishes the boundary grid every later "loop"
  // layer quantizes to. Manual start/stop, same shape as an intro/outro take. ---
  function beginFirstRecording() {
    manual = { role: "loop", startSample: recordedSampleCount, replaceLayerId: null, isFirst: true };
    emit();
  }

  // --- Intro/outro: free-length, manual start/stop, never scheduled into the live loop. ---
  function beginManualRecording(role, replaceLayerId) {
    if (manual || pendingLoop) return;
    manual = { role: role, startSample: recordedSampleCount, replaceLayerId: replaceLayerId || null, isFirst: false };
    emit();
  }

  function endManualRecording() {
    if (!manual) return;
    var info = manual;
    manual = null;
    var samples = readRange(info.startSample, recordedSampleCount);
    var buffer = makeBuffer(samples);

    if (info.isFirst) {
      loopDurationSec = samples.length / ctx.sampleRate;
      var gainNode = ctx.createGain();
      var layer = createLayer(nextLayerId++, buffer, null, gainNode, "loop");
      layers.push(layer);
      loopOrigin = ctx.currentTime + 0.05; // small headroom so start() never lands in the past
      playLoopLayer(layer, loopOrigin);
    } else if (info.replaceLayerId != null) {
      var existing = layers.filter(function (l) { return l.id === info.replaceLayerId; })[0];
      if (existing) existing.buffer = buffer;
    } else {
      var newLayer = createLayer(nextLayerId++, buffer, null, ctx.createGain(), info.role);
      layers.push(newLayer);
    }
    applyGains(layers, soloedId);
    emit();
  }

  // --- "loop"-role overdubs: quantized to the boundary grid so they land phase-locked. ---
  function armLoopOverdub(replaceLayerId) {
    if (loopOrigin == null || pendingLoop || manual) return;
    var boundaryTime = computeNextBoundary(ctx.currentTime, loopOrigin, loopDurationSec, LOOKAHEAD_SEC);
    var startSample = Math.round((boundaryTime - micStartTime) * ctx.sampleRate);
    pendingLoop = { startSample: startSample, replaceLayerId: replaceLayerId || null, boundaryTime: boundaryTime };
    emit();
  }

  function completeLoopOverdub(endSample) {
    var info = pendingLoop;
    pendingLoop = null;
    var samples = readRange(info.startSample, endSample);
    var buffer = makeBuffer(samples);

    if (info.replaceLayerId != null) {
      var existing = layers.filter(function (l) { return l.id === info.replaceLayerId; })[0];
      if (existing) {
        if (existing.sourceNode) try { existing.sourceNode.stop(); } catch (e) {}
        existing.buffer = buffer;
        var restartAt = computeNextBoundary(ctx.currentTime, loopOrigin, loopDurationSec, LOOKAHEAD_SEC);
        playLoopLayer(existing, restartAt);
      }
    } else {
      var layer = createLayer(nextLayerId++, buffer, null, ctx.createGain(), "loop");
      layers.push(layer);
      var startAt = computeNextBoundary(ctx.currentTime, loopOrigin, loopDurationSec, LOOKAHEAD_SEC);
      playLoopLayer(layer, startAt);
    }
    applyGains(layers, soloedId);
    emit();
  }

  // Redo dispatches to whichever flow matches the layer's current role.
  function redoLayer(id) {
    var layer = layers.filter(function (l) { return l.id === id; })[0];
    if (!layer) return;
    if (layer.role === "loop") armLoopOverdub(id);
    else beginManualRecording(layer.role, id);
  }

  function setRole(id, role) {
    var layer = layers.filter(function (l) { return l.id === id; })[0];
    if (!layer || layer.role === role) return;
    var wasLoop = layer.role === "loop";
    var willLoop = role === "loop";
    layer.role = role;
    if (wasLoop && !willLoop && layer.sourceNode) {
      try { layer.sourceNode.stop(); } catch (e) {}
      layer.sourceNode = null;
    } else if (!wasLoop && willLoop) {
      var startAt = computeNextBoundary(ctx.currentTime, loopOrigin, loopDurationSec, LOOKAHEAD_SEC);
      playLoopLayer(layer, startAt);
    }
    emit();
  }

  function removeLayer(id) {
    var layer = layers.filter(function (l) { return l.id === id; })[0];
    if (!layer) return;
    if (layer.sourceNode) try { layer.sourceNode.stop(); } catch (e) {}
    layers = layers.filter(function (l) { return l.id !== id; });
    if (soloedId === id) soloedId = null;
    applyGains(layers, soloedId);
    emit();
  }

  function setMuted(id, muted) {
    var layer = layers.filter(function (l) { return l.id === id; })[0];
    if (!layer) return;
    layer.muted = muted;
    applyGains(layers, soloedId);
    emit();
  }

  function setVolume(id, volume) {
    var layer = layers.filter(function (l) { return l.id === id; })[0];
    if (!layer) return;
    layer.volume = Math.max(0, Math.min(1, volume));
    applyGains(layers, soloedId);
    emit();
  }

  function toggleSolo(id) {
    soloedId = soloedId === id ? null : id;
    applyGains(layers, soloedId);
    emit();
  }

  function finalize(repeatCount) {
    return renderMixdown(layers, loopDurationSec, repeatCount || 1).then(function (rendered) {
      if (!rendered) return null;
      return encodeWavPCM16ToArrayBuffer(rendered);
    });
  }

  function getBuffer(id) {
    var layer = layers.filter(function (l) { return l.id === id; })[0];
    return layer ? layer.buffer : null;
  }

  return {
    startMic: startMic,
    beginFirstRecording: beginFirstRecording,
    beginManualRecording: beginManualRecording,
    endManualRecording: endManualRecording,
    armLoopOverdub: armLoopOverdub,
    redoLayer: redoLayer,
    removeLayer: removeLayer,
    setMuted: setMuted,
    setVolume: setVolume,
    setRole: setRole,
    toggleSolo: toggleSolo,
    finalize: finalize,
    onChange: function (fn) { listeners.push(fn); },
    snapshot: snapshot,
    getBuffer: getBuffer,
  };
}
