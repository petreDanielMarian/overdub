// Per-layer state and the mute/solo/volume gain math — kept separate from engine.js's
// capture/scheduling so the two concerns (recording sync vs. mixing) don't tangle. A layer's
// gainNode is created once, in engine.js, when its recording completes; everything here just
// decides what value that gainNode should hold.

// role: "intro" | "loop" | "outro" — "loop" is the default (the ordinary looping layers);
// intro/outro layers are excluded from the live composition loop entirely (they're one-shots
// by definition) and only get scheduled during finalize()'s export render.
export function createLayer(id, buffer, sourceNode, gainNode, role) {
  return {
    id: id,
    buffer: buffer,
    sourceNode: sourceNode,
    gainNode: gainNode,
    role: role || "loop",
    muted: false,
    volume: 1,
  };
}

// The gain a layer should actually play at right now, given its own mute/volume and whether
// any layer in the set is currently soloed.
export function effectiveGain(layer, soloedId) {
  if (layer.muted) return 0;
  if (soloedId != null && soloedId !== layer.id) return 0;
  return layer.volume;
}

// Re-applies effectiveGain() to every layer's real GainNode — call this after any mute/solo/
// volume change, or after a layer is added/removed/redone.
export function applyGains(layers, soloedId) {
  layers.forEach(function (layer) {
    layer.gainNode.gain.value = effectiveGain(layer, soloedId);
  });
}
