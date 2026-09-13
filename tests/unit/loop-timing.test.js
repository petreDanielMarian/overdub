import test from "node:test";
import assert from "node:assert/strict";
import { computeNextBoundary, samplesForDuration, sampleIndexAt, loopPassIndex } from "../../src/js/audio/loop-timing.js";

test("computeNextBoundary finds the next boundary after the target time", () => {
  // loopOrigin=0, loopDuration=2s → boundaries at 0, 2, 4, 6...
  assert.equal(computeNextBoundary(2.5, 0, 2, 0), 4);
  assert.equal(computeNextBoundary(0.1, 0, 2, 0), 2);
});

test("computeNextBoundary includes a target that lands exactly on a boundary", () => {
  assert.equal(computeNextBoundary(4, 0, 2, 0), 4);
  assert.equal(computeNextBoundary(6, 1, 5, 0), 6);
});

test("computeNextBoundary applies the lookahead before searching for a boundary", () => {
  // Same grid as above, but a 0.6s lookahead pushes the target to 3.1, so the next boundary is 4.
  assert.equal(computeNextBoundary(2.5, 0, 2, 0.6), 4);
  // A lookahead that reaches exactly a boundary resolves to that boundary, not the one after.
  assert.equal(computeNextBoundary(1.9, 0, 2, 0.1), 2);
});

test("computeNextBoundary respects a non-zero loop origin", () => {
  // Boundaries at 1.5, 3.5, 5.5... for origin=1.5, duration=2.
  assert.equal(computeNextBoundary(2, 1.5, 2, 0), 3.5);
  assert.equal(computeNextBoundary(1.5, 1.5, 2, 0), 1.5);
});

test("computeNextBoundary falls back to target time when there's no loop yet", () => {
  assert.equal(computeNextBoundary(5, 0, 0, 0.2), 5.2);
  assert.equal(computeNextBoundary(5, 0, null, 0), 5);
});

test("samplesForDuration rounds to the nearest sample, never negative", () => {
  assert.equal(samplesForDuration(1, 44100), 44100);
  assert.equal(samplesForDuration(0.5, 48000), 24000);
  assert.equal(samplesForDuration(-1, 44100), 0);
});

test("sampleIndexAt mirrors samplesForDuration's rounding and floor-at-zero", () => {
  assert.equal(sampleIndexAt(2, 44100), 88200);
  assert.equal(sampleIndexAt(-0.5, 44100), 0);
});

test("loopPassIndex counts whole passes since the loop origin", () => {
  assert.equal(loopPassIndex(0, 0, 2), 0);
  assert.equal(loopPassIndex(1.9, 0, 2), 0);
  assert.equal(loopPassIndex(2, 0, 2), 1);
  assert.equal(loopPassIndex(5, 1, 2), 2);
});

test("loopPassIndex is 0 when there's no loop yet", () => {
  assert.equal(loopPassIndex(10, 0, 0), 0);
});
