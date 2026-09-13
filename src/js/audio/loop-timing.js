// The scheduling math behind the looper — kept as plain functions over numbers (no
// AudioContext) specifically so it's unit-testable without a browser. See engine.js for how
// these get used against a real AudioContext.currentTime / mic buffer.
//
// The core idea: once layer 1's recording defines a loop origin and duration, every future
// loop boundary is loopOrigin + k*loopDuration for some integer k — arithmetic against
// AudioContext.currentTime, never a re-armed setTimeout/MediaRecorder restart (both of which
// carry several-ms jitter that accumulates into audible drift over many passes).

// The smallest loop boundary at or after (currentTime + lookaheadSec). lookaheadSec gives the
// UI time to show a "get ready" cue before a newly-armed recording actually starts capturing.
export function computeNextBoundary(currentTime, loopOrigin, loopDuration, lookaheadSec) {
  lookaheadSec = lookaheadSec || 0;
  var target = currentTime + lookaheadSec;
  if (!loopDuration || loopDuration <= 0) return target;
  // The `- 1e-9` nudge keeps a target that lands exactly on a boundary resolving to that same
  // boundary (inclusive) rather than jumping a whole extra loop forward on floating-point noise.
  var k = Math.ceil((target - loopOrigin) / loopDuration - 1e-9);
  return loopOrigin + k * loopDuration;
}

export function samplesForDuration(durationSec, sampleRate) {
  return Math.max(0, Math.round(durationSec * sampleRate));
}

export function sampleIndexAt(timeSec, sampleRate) {
  return Math.max(0, Math.round(timeSec * sampleRate));
}

// How many whole loop passes have elapsed at `currentTime` since `loopOrigin` — used to know
// which pass a layer armed "now" will actually start recording on.
export function loopPassIndex(currentTime, loopOrigin, loopDuration) {
  if (!loopDuration || loopDuration <= 0) return 0;
  return Math.floor((currentTime - loopOrigin) / loopDuration);
}
