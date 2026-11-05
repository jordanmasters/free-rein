// How fresh the board is: the files a reading came from, which changed since, and what's watched.
// Run: npm test (from vscode/)
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readHarness } from "../read";
import { filesRead, changedSince, watchList, outside, logScan, Scan } from "../fresh";

const repo = path.resolve(__dirname, "..", "..", "..");
// as the other tests: an empty home folder, so nothing of yours is read
process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), "free-rein-home-"));

async function main() {
  // a copy of kitchen, so a file can be touched (the samples are kept byte for byte)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "free-rein-fresh-"));
  try {
    fs.cpSync(path.join(repo, "samples", "kitchen"), root, { recursive: true });
    const r = await readHarness(root, repo);
    const files = filesRead(r, root);
    assert.ok(files.length >= 10, `the files the reading came from (${files.length})`);
    assert.ok(files.some(f => f.endsWith(path.join(".claude", "settings.json"))) && files.some(f => f.endsWith("SKILL.md")), "settings and skills among them");
    assert.ok(files.every(f => f.startsWith(root + path.sep) || f.startsWith(fs.realpathSync(root) + path.sep)), "only the harness's own (its home folder is empty here), no draft copies");
    const at = new Date(Date.now() + 1000).toISOString();
    assert.deepStrictEqual(changedSince(files, at), [], "nothing changed since the reading");
    const f = files.find(x => x.endsWith("SKILL.md"))!, later = new Date(Date.now() + 5000);
    fs.utimesSync(f, later, later);
    assert.deepStrictEqual(changedSince(files, at), [f], "a file edited since: the board reads again");
    // watched: what every supported runtime loads, commits; a hook's script elsewhere on its own
    const w = watchList(root, false).map(x => x.glob).join(" ");
    assert.match(w, /AGENTS\.md/); assert.match(w, /\.codex/); assert.match(w, /\.git\/\{HEAD/);
    assert.ok(!watchList(root, false).some(x => x.base !== root), "the home folder only when it counts");
    assert.strictEqual(outside(path.join(root, ".claude", "settings.json"), root, false), false, "covered by the folder's patterns");
    assert.strictEqual(outside(path.join(root, "scripts", "done.sh"), root, false), true, "a script elsewhere is watched on its own");
    // the list of scans: every scan kept, with what started it, the oldest dropped past the cap
    const sc = (n: number): Scan => ({ at: `2026-11-04T10:0${n}:00Z`, kind: "rules", why: n ? "A file changed" : "You opened the folder", changed: n ? ["CLAUDE.md"] : [], ms: 300, files: 40, xp: 500 + n, level: 10, equipped: 20, backed: 60, exposed: 1 });
    let log: Scan[] = []; for (let n = 0; n < 5; n++) log = logScan(log, sc(n), 3);
    assert.deepStrictEqual(log.map(x => x.xp), [502, 503, 504], "the latest scans, oldest dropped");
    console.log(`ok  fresh: ${files.length} files read from kitchen; a change since is noticed; watched per runtime; every scan logged with its cause`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exit(1); });
