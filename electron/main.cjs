// Overdub's desktop shell — one window, no server, no session state. Plain CommonJS, no build
// step, matching DnDash's own electron/main.cjs (docs/dndashboard-plan.md Section 3: the main
// process stays plain Node on purpose).
"use strict";

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const INDEX_HTML = path.join(__dirname, "..", "src", "index.html");
const PRELOAD = path.join(__dirname, "preload.cjs");
const INK = "#15110c"; // matches DnDash's own --ink token, so launching one from the other doesn't jar

var mainWindow = null;

function createMainWindow() {
  var win = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 620,
    minHeight: 480,
    backgroundColor: INK,
    show: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", function () { win.show(); });
  win.loadFile(INDEX_HTML);
  win.on("closed", function () { if (win === mainWindow) mainWindow = null; });
  return win;
}

// Saves a finished export to disk via a normal save dialog — the one piece of filesystem
// access this app needs. `bytes` arrives as a plain array of byte values (structured-clone
// safe over IPC); an ArrayBuffer/Uint8Array itself also clones fine but a plain array is the
// most defensive choice against any future Electron IPC serialization change.
function wireIpc() {
  ipcMain.handle("overdub:save-wav", async function (_event, bytes, suggestedName) {
    var result = await dialog.showSaveDialog(mainWindow, {
      title: "Export track",
      defaultPath: suggestedName || "overdub-track.wav",
      filters: [{ name: "WAV audio", extensions: ["wav"] }],
    });
    if (result.canceled || !result.filePath) return { saved: false };
    fs.writeFileSync(result.filePath, Buffer.from(bytes));
    return { saved: true, path: result.filePath };
  });
}

app.whenReady().then(function () {
  wireIpc();
  mainWindow = createMainWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
