// Before `npm pack` or `npm publish`: copy Free Rein's model (the JSON data in ../model) into this package, so the
// command line installed from npm finds it next to itself. The copy isn't in git (core/.gitignore).
import fs from "fs";
import path from "path";
const here = path.dirname(new URL(import.meta.url).pathname), from = path.join(here, "..", "..", "model"), to = path.join(here, "..", "model");
fs.rmSync(to, { recursive: true, force: true });
// after packing, remove the copy: in the repo the model is ../model, and a copy here would be found first
if (process.argv.includes("--remove")) process.exit(0);
let n = 0;
for (const f of fs.readdirSync(from, { recursive: true })) {
  if (!String(f).endsWith(".json")) continue;
  fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
  fs.copyFileSync(path.join(from, f), path.join(to, f)); n++;
}
console.log(`model: ${n} files copied into the package`);
