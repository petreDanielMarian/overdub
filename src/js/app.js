import { createLooperEngine } from "./audio/engine.js";
import { renderTransport } from "./ui/transport.js";
import { renderLayerList } from "./ui/layer-list.js";
import { renderExportPanel } from "./export.js";

var engine = createLooperEngine();
var transportEl = document.getElementById("transport");
var layersEl = document.getElementById("layers");
var exportEl = document.getElementById("export-panel");
var exportStatusEl = document.getElementById("export-status");
var micStatusEl = document.getElementById("mic-status");
var micBtn = document.getElementById("mic-btn");

function buffersById(snapshot) {
  var map = {};
  snapshot.layers.forEach(function (l) { map[l.id] = engine.getBuffer(l.id); });
  return map;
}

function render() {
  var snapshot = engine.snapshot();
  renderTransport(transportEl, snapshot, {
    onBeginFirst: function () { engine.beginFirstRecording(); },
    onBeginManual: function (role) { engine.beginManualRecording(role); },
    onStop: function () { engine.endManualRecording(); },
    onArmLoop: function () { engine.armLoopOverdub(); },
  });
  renderLayerList(layersEl, snapshot, buffersById(snapshot), {
    onToggleMute: function (id) { engine.setMuted(id, !snapshot.layers.filter(function (l) { return l.id === id; })[0].muted); },
    onToggleSolo: function (id) { engine.toggleSolo(id); },
    onVolume: function (id, v) { engine.setVolume(id, v); },
    onRedo: function (id) { engine.redoLayer(id); },
    onRemove: function (id) { engine.removeLayer(id); },
    onRoleChange: function (id, role) { engine.setRole(id, role); },
  });
  renderExportPanel(exportEl, engine, exportStatusEl);
}

engine.onChange(render);
render();

micBtn.addEventListener("click", function () {
  micBtn.disabled = true;
  micStatusEl.textContent = "Requesting microphone…";
  engine.startMic().then(function () {
    micStatusEl.textContent = "Microphone ready.";
    document.getElementById("recorder").hidden = false;
  }).catch(function (err) {
    micBtn.disabled = false;
    micStatusEl.textContent = "Couldn't access the microphone: " + (err && err.message ? err.message : err);
  });
});
