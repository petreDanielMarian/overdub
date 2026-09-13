// A plain peak-drawing waveform, Canvas 2D — matches DnDash's own preference for hand-written
// canvas over a charting library for something this simple.
export function drawWaveform(canvas, audioBuffer, color) {
  var ctx2d = canvas.getContext("2d");
  var w = canvas.width, h = canvas.height;
  ctx2d.clearRect(0, 0, w, h);
  if (!audioBuffer) return;
  var data = audioBuffer.getChannelData(0);
  var step = Math.max(1, Math.floor(data.length / w));
  var mid = h / 2;
  ctx2d.strokeStyle = color || "#7fb3d9";
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  for (var x = 0; x < w; x++) {
    var start = x * step;
    var min = 1, max = -1;
    for (var i = 0; i < step && start + i < data.length; i++) {
      var v = data[start + i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx2d.moveTo(x, mid + min * mid);
    ctx2d.lineTo(x, mid + max * mid);
  }
  ctx2d.stroke();
}
