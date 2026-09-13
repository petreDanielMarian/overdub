// The one bridge between the renderer (contextIsolation, no Node integration) and the main
// process — same discipline as DnDash's own preload.cjs: expose exactly these functions,
// never raw ipcRenderer.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overdubDesktop", {
  // bytes: a Uint8Array (or plain array) of the encoded WAV file. Resolves
  // { saved: true, path } or { saved: false } if the DM cancelled the dialog.
  saveWav: function (bytes, suggestedName) {
    return ipcRenderer.invoke("overdub:save-wav", Array.from(bytes), suggestedName);
  },
});
