// A minimal static check: every module actually parses and loads without a syntax error.
// Deliberately small — this is a one-person personal project, not DnDash's full static-graph
// checker (tools/check.mjs there also verifies element-id/legacy parity, which has no
// equivalent here since there's no ported legacy version of this app).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

var root = join(import.meta.dirname, "..", "src");
var files = [];

function walk(dir) {
  readdirSync(dir).forEach(function (name) {
    var full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".js")) files.push(full);
  });
}
walk(root);

var failed = 0;
for (var i = 0; i < files.length; i++) {
  try {
    await import(pathToFileURL(files[i]).href);
  } catch (err) {
    // capture-worklet.js calls registerProcessor() at module scope — only defined inside a
    // real AudioWorkletGlobalScope. app.js is the page's own entry point (nothing else ever
    // imports it, unlike every other module here), so it reaching into a live `document` at
    // top level is normal, not the module-poisons-every-importer footgun this check otherwise
    // guards against. Both are expected to throw under plain Node.
    if (files[i].endsWith("capture-worklet.js") && /AudioWorkletProcessor is not defined/.test(String(err))) continue;
    if (files[i].endsWith(join("js", "app.js")) && /document is not defined/.test(String(err))) continue;
    console.error("FAILED to load", files[i]);
    console.error(err);
    failed++;
  }
}

if (failed) {
  console.error(failed + " module(s) failed to load.");
  process.exit(1);
}
console.log("checked " + files.length + " modules — all load cleanly.");
