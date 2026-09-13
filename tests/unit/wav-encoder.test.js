import test from "node:test";
import assert from "node:assert/strict";
import { encodeWavPCM16ToArrayBuffer } from "../../src/js/audio/wav-encoder.js";

// A fake shaped like a Web Audio AudioBuffer — no AudioContext needed to exercise the encoder.
function fakeAudioBuffer(channels, sampleRate) {
  return {
    numberOfChannels: channels.length,
    sampleRate: sampleRate,
    length: channels[0].length,
    getChannelData: function (ch) { return channels[ch]; },
  };
}

function readString(view, offset, len) {
  var s = "";
  for (var i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

test("the header names every chunk correctly", () => {
  var buf = encodeWavPCM16ToArrayBuffer(fakeAudioBuffer([new Float32Array([0, 0.5, -0.5])], 44100));
  var view = new DataView(buf);
  assert.equal(readString(view, 0, 4), "RIFF");
  assert.equal(readString(view, 8, 4), "WAVE");
  assert.equal(readString(view, 12, 4), "fmt ");
  assert.equal(readString(view, 36, 4), "data");
});

test("fmt chunk reports PCM, channel count, sample rate and 16-bit depth", () => {
  var buf = encodeWavPCM16ToArrayBuffer(fakeAudioBuffer([new Float32Array([0]), new Float32Array([0])], 48000));
  var view = new DataView(buf);
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(22, true), 2); // stereo
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(34, true), 16); // bits per sample
  assert.equal(view.getUint16(32, true), 4); // block align = channels(2) * bytesPerSample(2)
  assert.equal(view.getUint32(28, true), 48000 * 4); // byte rate
});

test("chunk sizes match the actual payload for a mono buffer", () => {
  var samples = new Float32Array([0, 0.25, -0.25, 1, -1]);
  var buf = encodeWavPCM16ToArrayBuffer(fakeAudioBuffer([samples], 44100));
  var view = new DataView(buf);
  var dataSize = samples.length * 2; // mono, 16-bit
  assert.equal(view.getUint32(40, true), dataSize);
  assert.equal(view.getUint32(4, true), 36 + dataSize);
  assert.equal(buf.byteLength, 44 + dataSize);
});

test("samples round-trip through the Int16 conversion, interleaved correctly", () => {
  var left = new Float32Array([1, -1, 0, 0.5]);
  var right = new Float32Array([-1, 1, 0.5, -0.5]);
  var buf = encodeWavPCM16ToArrayBuffer(fakeAudioBuffer([left, right], 44100));
  var view = new DataView(buf);
  // Interleaved L,R,L,R... starting right after the 44-byte header.
  assert.equal(view.getInt16(44, true), 0x7fff); // left[0] = 1.0 → max positive
  assert.equal(view.getInt16(46, true), -0x8000); // right[0] = -1.0 → max negative
  assert.equal(view.getInt16(48, true), -0x8000); // left[1] = -1.0
  assert.equal(view.getInt16(50, true), 0x7fff); // right[1] = 1.0
  assert.equal(view.getInt16(52, true), 0); // left[2] = 0
});

test("out-of-range samples clamp instead of wrapping", () => {
  var buf = encodeWavPCM16ToArrayBuffer(fakeAudioBuffer([new Float32Array([2, -2])], 44100));
  var view = new DataView(buf);
  assert.equal(view.getInt16(44, true), 0x7fff);
  assert.equal(view.getInt16(46, true), -0x8000);
});
