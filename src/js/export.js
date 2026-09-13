function el(tag, className, text) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// Renders the Finalize panel: how many times the loop repeats, then a button that renders the
// mixdown (engine.finalize) and hands the WAV bytes to Electron's save dialog. DnDash picks it
// up afterward via its own "Import Audio File…" button — see docs/dndashboard-plan.md's
// Overdub round entry for why this is a plain file handoff rather than direct IPC between the
// two apps.
export function renderExportPanel(container, engine, statusEl) {
  container.innerHTML = "";
  container.appendChild(el("div", "section-title", "Finalize"));

  var repeatLabel = el("label", "repeat-label");
  repeatLabel.appendChild(document.createTextNode("Loop repeats "));
  var repeatInput = document.createElement("input");
  repeatInput.type = "number"; repeatInput.min = "1"; repeatInput.value = "4"; repeatInput.className = "repeat-input";
  repeatLabel.appendChild(repeatInput);
  repeatLabel.appendChild(document.createTextNode(" times"));
  container.appendChild(repeatLabel);

  var finalizeBtn = el("button", "primary", "Export Track…");
  finalizeBtn.addEventListener("click", function () {
    var snapshot = engine.snapshot();
    if (!snapshot.hasLoop) { statusEl.textContent = "Record at least one loop layer first."; return; }
    finalizeBtn.disabled = true;
    statusEl.textContent = "Rendering…";
    var repeatCount = Math.max(1, parseInt(repeatInput.value, 10) || 1);
    engine.finalize(repeatCount).then(function (arrayBuffer) {
      finalizeBtn.disabled = false;
      if (!arrayBuffer) { statusEl.textContent = "Nothing to export yet."; return; }
      var bytes = new Uint8Array(arrayBuffer);
      if (!window.overdubDesktop) {
        // Running in a plain browser tab (no Electron) — offer a normal download link instead.
        var blob = new Blob([bytes], { type: "audio/wav" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "overdub-track.wav";
        a.click();
        URL.revokeObjectURL(url);
        statusEl.textContent = "Downloaded overdub-track.wav.";
        return;
      }
      window.overdubDesktop.saveWav(bytes, "overdub-track.wav").then(function (result) {
        statusEl.textContent = result.saved ? "Saved to " + result.path + ". Import it into DnDash's Music Library." : "Export cancelled.";
      });
    }).catch(function (err) {
      finalizeBtn.disabled = false;
      statusEl.textContent = "Export failed: " + (err && err.message ? err.message : err);
    });
  });
  container.appendChild(finalizeBtn);
}
