import { drawWaveform } from "./waveform.js";

var ROLE_LABELS = { intro: "Intro (plays once, at the start)", loop: "Loop (repeats)", outro: "Outro (plays once, at the end)" };

function el(tag, className, text) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// `snapshot` is engine.snapshot() (plain data: id/role/muted/volume/soloed/durationSec).
// `buffersById` maps layer id -> the real AudioBuffer, needed only for the waveform — the
// snapshot itself deliberately carries no AudioContext objects.
export function renderLayerList(container, snapshot, buffersById, handlers) {
  container.innerHTML = "";
  if (snapshot.layers.length === 0) {
    container.appendChild(el("div", "empty-note", "No layers yet — record your first take above."));
    return;
  }
  snapshot.layers.forEach(function (layer) {
    var row = el("div", "layer-row" + (layer.muted ? " muted" : "") + (layer.soloed ? " soloed" : ""));

    var head = el("div", "layer-head");
    var roleSel = document.createElement("select");
    ["intro", "loop", "outro"].forEach(function (r) {
      var opt = el("option", null, ROLE_LABELS[r]);
      opt.value = r;
      if (r === layer.role) opt.selected = true;
      roleSel.appendChild(opt);
    });
    roleSel.addEventListener("change", function () { handlers.onRoleChange(layer.id, roleSel.value); });
    head.appendChild(el("span", "layer-name", "Layer " + layer.id + " · " + layer.durationSec.toFixed(1) + "s"));
    head.appendChild(roleSel);
    row.appendChild(head);

    var canvas = document.createElement("canvas");
    canvas.width = 480; canvas.height = 48; canvas.className = "waveform";
    row.appendChild(canvas);
    var buffer = buffersById[layer.id];
    requestAnimationFrame(function () { drawWaveform(canvas, buffer); });

    var controls = el("div", "layer-controls");

    var muteBtn = el("button", "chip" + (layer.muted ? " active" : ""), layer.muted ? "Muted" : "Mute");
    muteBtn.addEventListener("click", function () { handlers.onToggleMute(layer.id); });
    controls.appendChild(muteBtn);

    var soloBtn = el("button", "chip" + (layer.soloed ? " active" : ""), "Solo");
    soloBtn.addEventListener("click", function () { handlers.onToggleSolo(layer.id); });
    controls.appendChild(soloBtn);

    var volLabel = el("label", "vol-label");
    var vol = document.createElement("input");
    vol.type = "range"; vol.min = "0"; vol.max = "1"; vol.step = "0.01"; vol.value = String(layer.volume);
    vol.addEventListener("input", function () { handlers.onVolume(layer.id, parseFloat(vol.value)); });
    volLabel.appendChild(document.createTextNode("Vol"));
    volLabel.appendChild(vol);
    controls.appendChild(volLabel);

    var redoBtn = el("button", "chip", "Redo");
    redoBtn.addEventListener("click", function () { handlers.onRedo(layer.id); });
    controls.appendChild(redoBtn);

    var removeBtn = el("button", "chip danger", "Remove");
    removeBtn.addEventListener("click", function () { handlers.onRemove(layer.id); });
    controls.appendChild(removeBtn);

    row.appendChild(controls);
    container.appendChild(row);
  });
}
