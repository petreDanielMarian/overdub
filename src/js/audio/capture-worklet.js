// Runs on the audio-rendering thread once registered via
// audioContext.audioWorklet.addModule(...). Posts every render quantum's mono mixdown back to
// the main thread, where engine.js appends it to one continuously-growing buffer for the whole
// session — the mic is never stopped/restarted between layers (see loop-timing.js's header
// comment for why that matters).
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    var input = inputs[0];
    if (input && input.length && input[0].length) {
      var channelCount = input.length;
      var frameCount = input[0].length;
      var mono = new Float32Array(frameCount);
      for (var ch = 0; ch < channelCount; ch++) {
        var data = input[ch];
        for (var i = 0; i < frameCount; i++) mono[i] += data[i] / channelCount;
      }
      this.port.postMessage(mono, [mono.buffer]);
    }
    return true; // keep this processor alive for the whole session, not just one recording
  }
}

registerProcessor("capture-processor", CaptureProcessor);
