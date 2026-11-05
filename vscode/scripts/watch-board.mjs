// Rebuild media/ whenever the board's source (vscode/board/), the core (core/src/) or Free Rein's data changes.
// Used by the "watch" task, so the board in the development window stays current.
// Usage: node scripts/watch-board.mjs
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { build } from "./build-board.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.dirname(HERE), REPO = path.dirname(EXT);
const DIRS = [path.join(EXT, "board"), path.join(REPO, "core", "src"), path.join(REPO, "model")];

function stamp() {
  const out = [];
  for (const d of DIRS) for (const f of fs.readdirSync(d, { recursive: true })) {
    const p = path.join(d, f);
    if (/\.(js|ts|css|html|json)$/.test(f)) try { out.push(p + ":" + fs.statSync(p).mtimeMs); } catch { /* gone */ }
  }
  return out.sort().join("\n");
}

let last = null;
console.log("watching vscode/board/, core/src/ and model/ for changes");
setInterval(() => {
  const now = stamp();
  if (now === last) return;
  last = now;
  try { build(); } catch (e) { console.log(String(e.message || e)); }
}, 700);
