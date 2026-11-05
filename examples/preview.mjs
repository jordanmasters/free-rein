// The board in a browser, for any harness: writes examples/preview/<name>.html and opens it.
//   node examples/preview.mjs samples/solo
//   node examples/preview.mjs /path/to/repo [--no-open]
// Builds the core and the board first (vscode/scripts/build-board.mjs), so it works from a fresh clone.
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { build } from "../vscode/scripts/build-board.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.dirname(HERE), MEDIA = path.join(ROOT, "vscode", "media");
build();
const { reading } = createRequire(import.meta.url)(path.join(ROOT, "core", "out", "src", "index.js"));
const target = path.resolve(process.argv.slice(2).find(a => !a.startsWith("--")) || path.join(ROOT, "samples", "solo"));
const data = JSON.stringify(reading(target, { count_home: true })).replace(/</g, "\\u003c");
const rel = f => path.relative(path.join(HERE, "preview"), path.join(MEDIA, f));
const page = `<!doctype html><html><head><meta charset="utf-8"><title>Free Rein: ${path.basename(target)}</title>
<link rel="stylesheet" href="${rel("board.css")}"></head><body>
${fs.readFileSync(path.join(MEDIA, "board.html"), "utf8")}
<script>window.FREE_REIN_DATA=${data};window.FREE_REIN_PREFS={};</script>
<script src="${rel("lucide.min.js")}"></script><script src="${rel("board.js")}"></script></body></html>`;
fs.mkdirSync(path.join(HERE, "preview"), { recursive: true });
const out = path.join(HERE, "preview", path.basename(target) + ".html");
fs.writeFileSync(out, page);
console.log(out);
if (!process.argv.includes("--no-open")) execFileSync(process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open", [out]);
