// Build the board and the core for the extension (run by `npm run compile`):
// - board/js/*.js, in name order, into media/board.js (one script: the files share one scope)
// - board/css/board.css and board/board.html into media/
// - Free Rein's scorer (core/src/report/score.ts, compiled) into media/core.js for the extension, and at the head of
//   media/board.js as FreeReinCore, so the board scores with the core's own code
// - the whole compiled core into media/core/, which the extension runs in a worker thread
// - Free Rein's data (model: the pieces, the runtimes, the profiles, the models table) into media/model/,
//   so the installed extension needs nothing else
// media/ is build output (not in git, apart from the icon and lucide.min.js): npm run compile and npm run package make it.
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.dirname(HERE), SRC = path.join(EXT, "board"), MEDIA = path.join(EXT, "media");
const REPO = path.dirname(EXT), CORE = path.join(REPO, "core"), MODEL = path.join(REPO, "model");
const noMaps = text => text.split("\n").filter(l => !l.startsWith("//# sourceMappingURL")).join("\n");

function core() {
  const tsc = path.join(CORE, "node_modules", ".bin", "tsc");
  if (!fs.existsSync(tsc)) execFileSync("npm", ["ci", "--silent"], { cwd: CORE, stdio: "inherit" });
  execFileSync(tsc, ["-p", "."], { cwd: CORE, stdio: "inherit" });
  const out = path.join(CORE, "out", "src"), dst = path.join(MEDIA, "core");
  fs.rmSync(dst, { recursive: true, force: true });
  for (const f of fs.readdirSync(out, { recursive: true })) {
    if (!f.endsWith(".js")) continue;
    fs.mkdirSync(path.dirname(path.join(dst, f)), { recursive: true });
    fs.writeFileSync(path.join(dst, f), noMaps(fs.readFileSync(path.join(out, f), "utf8")));
  }
  return "// Free Rein's reference scorer, built from core/src/report/score.ts by scripts/build-board.mjs. Don't edit here.\n" +
    "(function(root,make){var m=make();if(typeof module==='object'&&module.exports)module.exports=m;else root.FreeReinCore=m})" +
    "(typeof self!=='undefined'?self:this,function(){var exports={};\n" + noMaps(fs.readFileSync(path.join(out, "report", "score.js"), "utf8")) + "\nreturn exports});\n";
}

function data() {
  const dst = path.join(MEDIA, "model");
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.join(dst, "runtimes"), { recursive: true });
  for (const f of fs.readdirSync(MODEL)) if (f.endsWith(".json")) fs.copyFileSync(path.join(MODEL, f), path.join(dst, f));
  for (const f of fs.readdirSync(path.join(MODEL, "runtimes"))) if (f.endsWith(".json")) fs.copyFileSync(path.join(MODEL, "runtimes", f), path.join(dst, "runtimes", f));
}

export function build() {
  const parts = fs.readdirSync(path.join(SRC, "js")).filter(f => f.endsWith(".js")).sort();
  const lib = core();
  fs.writeFileSync(path.join(MEDIA, "core.js"), lib);
  const js = lib + parts.map(f => fs.readFileSync(path.join(SRC, "js", f), "utf8")).join("");
  // the joined script must parse: a syntax error would leave the board blank, and nothing else would say so
  try { new Function(js); } catch (e) { throw new Error(`the board's script doesn't parse (vscode/board/js/): ${e.message}`); }
  fs.writeFileSync(path.join(MEDIA, "board.js"), js);
  fs.copyFileSync(path.join(SRC, "css", "board.css"), path.join(MEDIA, "board.css"));
  fs.copyFileSync(path.join(SRC, "board.html"), path.join(MEDIA, "board.html"));
  fs.cpSync(path.join(SRC, "fonts"), path.join(MEDIA, "fonts"), { recursive: true });
  data();
  console.log(`board: ${parts.length} script files, ${js.length} js, ${fs.statSync(path.join(MEDIA, "board.css")).size} css; core and data bundled`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
