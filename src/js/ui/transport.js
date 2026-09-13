function el(tag, className, text) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// Renders the top control bar from the engine's snapshot. `handlers` is:
// { onBeginFirst, onBeginManual(role), onStop, onArmLoop }
export function renderTransport(container, snapshot, handlers) {
  container.innerHTML = "";

  if (!snapshot.hasLoop) {
    if (snapshot.recordingManual) {
      container.appendChild(el("div", "status recording", "Recording your first layer — this take sets the loop length."));
      var stop = el("button", "primary danger", "Stop");
      stop.addEventListener("click", handlers.onStop);
      container.appendChild(stop);
    } else {
      container.appendChild(el("div", "status", "No loop yet — record something to start."));
      var begin = el("button", "primary", "Record First Layer");
      begin.addEventListener("click", handlers.onBeginFirst);
      container.appendChild(begin);
    }
    return;
  }

  container.appendChild(el("div", "status", "Loop: " + snapshot.loopDurationSec.toFixed(2) + "s"));

  if (snapshot.recordingManual) {
    container.appendChild(el("div", "status recording", "Recording (" + snapshot.recordingManual + ") — free length."));
    var stopManual = el("button", "primary danger", "Stop");
    stopManual.addEventListener("click", handlers.onStop);
    container.appendChild(stopManual);
    return;
  }

  if (snapshot.armed) {
    container.appendChild(el("div", "status recording", "Get ready — recording joins on the next pass…"));
    return;
  }

  var roleSel = document.createElement("select");
  [["loop", "Loop layer"], ["intro", "Intro (once, at the start)"], ["outro", "Outro (once, at the end)"]].forEach(function (pair) {
    var opt = el("option", null, pair[1]);
    opt.value = pair[0];
    roleSel.appendChild(opt);
  });
  container.appendChild(roleSel);

  var recordBtn = el("button", "primary", "Record New Layer");
  recordBtn.addEventListener("click", function () {
    if (roleSel.value === "loop") handlers.onArmLoop();
    else handlers.onBeginManual(roleSel.value);
  });
  container.appendChild(recordBtn);
}
