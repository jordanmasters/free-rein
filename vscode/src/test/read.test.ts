// Reads more than one harness the way the extension does, and checks the page it builds.
// Run: npm test (from vscode/)
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readHarness } from "../read";
import { page } from "../page";
import * as st from "../state";
import { sidebarHtml } from "../sidebar";
import * as tr from "../trace-index";
import * as pl from "../plan";

const repo = path.resolve(__dirname, "..", "..", "..");
const media = path.resolve(__dirname, "..", "..", "media");
// an empty home folder, so what's in your own ~/.claude (skills, plugins, sessions) never changes the results
const made: string[] = [];
process.on("exit", () => { for (const d of made) try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* left for the system */ } });
const mkTemp = (prefix: string) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); made.push(d); return d; };
process.env.HOME = mkTemp("free-rein-home-");

async function main() {
  // the kitchen and solo samples, and any real harnesses named in FREE_REIN_TEST_HARNESSES (separated by ":")
  const roots = [path.join(repo, "samples", "kitchen"), path.join(repo, "samples", "solo"),
    ...(process.env.FREE_REIN_TEST_HARNESSES || "").split(":").filter(p => p && fs.existsSync(p))];
  for (const root of roots) {
    const d = await readHarness(root, repo);
    const h = d.harnesses[0] as any;
    assert.strictEqual(h.name, path.basename(root));
    assert.strictEqual(h.slots.length, 10, "ten sections");
    const types = h.slots.flatMap((s: any) => s.types);
    assert.ok(types.length >= 36, `at least 36 types, got ${types.length}`);
    const withPath = types.flatMap((t: any) => [...t.inst, ...(t.extra ?? [])]).filter((i: any) => i.path).length;
    console.log(`ok  ${h.name}: ${types.length} types, backed ${h.backed}%, ${withPath} pieces with a file`);
  }
  // a folder with no harness files still reads, as an empty harness
  const empty = mkTemp("free-rein-empty-");
  const e = await readHarness(empty, repo);
  console.log(`ok  empty folder: backed ${(e.harnesses[0] as any).backed}%`);
  // the data built into the extension (media/model) reads exactly as the repo's: an installed extension needs nothing else
  for (const root of roots) {
    // (except what you could add: without a Free Rein repo next to it, there are no Free Rein skills to offer)
    const a = await readHarness(root, repo, true), b = await readHarness(root, null, true);
    const noAvail = (r: any) => JSON.parse(JSON.stringify(r, (k, v) => k === "available" ? undefined : v));
    assert.deepStrictEqual(noAvail(b), noAvail(a), `${path.basename(root)}: built-in data and the repo's agree`);
  }
  console.log(`ok  the built-in data reads like the repo's on ${roots.length} harnesses`);
  // the page: strict CSP, nonce on every script, data can't close its script tag
  const html = page(media, { css: "c.css", lucide: "l.js", board: "b.js", cspSource: "vscode-resource:" }, { harnesses: [{ name: "</script><b>x" }] });
  assert.ok(/default-src 'none'/.test(html));
  const scripts = html.match(/<script[^>]*>/g) || [];
  assert.ok(scripts.length === 3 && scripts.every(s => /nonce="/.test(s)), "every script has the nonce");
  assert.ok(!html.includes("</script><b>x"), "data is escaped");
  console.log("ok  page: CSP, nonces, escaped data");

  // remembered state: recent harnesses, trust answers per harness
  const mem = new Map<string, unknown>();
  const store: st.Store = { get: <T>(k: string) => mem.get(k) as T | undefined, update: async (k, v) => { v === undefined ? mem.delete(k) : mem.set(k, v); } };
  for (const p of ["/a", "/b", "/a", "/c"]) await st.addRecent(store, p);
  assert.deepStrictEqual(st.recent(store), ["/c", "/a", "/b"], "most recent first, no repeats");
  assert.strictEqual(st.trustState(store, "/a"), undefined);
  await st.skipTrust(store, "/a"); assert.deepStrictEqual(st.trustState(store, "/a"), { skipped: true });
  await st.saveAnswers(store, "/b", { edit: 4 }); assert.strictEqual(st.trustState(store, "/a")!.hasOwnProperty("answers"), false, "answers don't carry across harnesses");
  await st.clearTrust(store, "/a"); assert.strictEqual(st.trustState(store, "/a"), undefined);
  console.log("ok  state: recent harnesses, trust per harness");

  // the trust comparison matches the web app's rule
  const g = (await readHarness(roots[0] ?? empty, repo)).harnesses[0] as any;
  const all = Object.fromEntries(g.trust.categories.map((c: any) => [c.id, 4]));
  const k = st.compare(g.trust, all);
  assert.strictEqual(k.felt, 100);
  assert.strictEqual(k.gap, 100 - g.trust.backed);
  for (const r of k.rows) assert.strictEqual(r.gap, 100 - r.evidence);
  assert.ok(k.rows.filter(r => r.gap > 0).every(r => r.close.length <= 2));
  console.log(`ok  trust compare: felt ${k.felt}%, backed ${g.trust.backed}%, ahead on ${k.ahead}`);

  // the sidebar asks first and shows no numbers until you answer or skip
  const pg = g.progression;
  const sum = { name: g.name, root: "/x", uses: (g.uses || []) as string[], level: pg.level, xp: pg.xp, levelStart: pg.level_start, nextAt: pg.next_level_at,
    rank: pg.rank?.name ?? null, rankTier: pg.rank?.tier ?? null, next: null, backed: g.backed, equipped: 1, total: g.slots.reduce((n: number, x: any) => n + x.types.length, 0), weak: 1, earned: 1, achievements: 11, trust: g.trust,
    sections: g.slots.map((x: any) => ({ id: x.id, name: x.name, types: x.types.map((t: any) => ({ name: t.name, maturity: t.maturity })) })) };
  const ask = sidebarHtml("vscode-resource:", sum, undefined);
  assert.ok(ask.includes("how much do you trust it") && !ask.includes(`${g.backed}%`) && !ask.includes(">LEVEL<"), "no numbers before the trust check");
  const shown = sidebarHtml("vscode-resource:", sum, { answers: all });
  assert.ok(shown.includes(`${g.backed}%`) && shown.includes("Next rank"), "after the check, the status card shows where it stands");
  const pieces = g.slots.reduce((n: number, x: any) => n + x.types.length, 0);
  assert.strictEqual((shown.match(/class="seg"/g) || []).length, pieces, "a ring segment per piece, as on the board");
  assert.ok(/default-src 'none'/.test(shown) && !/https?:/.test(shown.replace(/http-equiv/g, "")), "no network in the sidebar");
  assert.ok(sidebarHtml("x", null, undefined, "boom <b>").includes("boom &lt;b>"), "errors are escaped");
  console.log("ok  sidebar: asks first, then summary and comparison");

  // tracing: every piece with a file is indexed by file, at its lines
  for (const root of roots) {
    const h = (await readHarness(root, repo)).harnesses[0] as any;
    const count = (p: string) => { try { return fs.readFileSync(p, "utf8").split("\n").length; } catch { return null; } };
    const idx = tr.buildIndex(h, count);
    const withFile = h.slots.flatMap((s: any) => s.types).flatMap((t: any) => [...t.inst, ...(t.extra ?? [])]).filter((i: any) => i.path).length;
    const indexed = [...idx.values()].reduce((a, l) => a + l.length, 0);
    assert.ok(indexed > 0 && indexed <= withFile, `${h.name}: ${indexed} indexed of ${withFile}`);
    for (const [file, list] of idx) for (const e of list) {
      if (e.lines) assert.ok(e.lines[0] >= 1 && e.lines[0] <= e.lines[1], `${file} ${e.lines}`);
      // a whole-file piece is explained on line 1 only; a block, anywhere inside it
      if (e.whole) assert.ok(tr.at(list, 1).includes(e) && !tr.at(list, 2).includes(e) || (e.lines && e.lines[1] === 1));
      else if (e.lines) assert.ok(tr.at(list, e.lines[1]).includes(e) && !tr.at(list, e.lines[1] + 1).includes(e));
    }
    const md = tr.hoverMarkdown([...idx.values()][0]);
    assert.ok(md.includes("level") && !/undefined|NaN/.test(md), md);
    const rows = tr.combos(h);
    assert.ok(rows.every(r => r.pieces.length && r.pieces.every(p => p.name && p.role)), "every combo lists its pieces");
    assert.ok(rows.filter(r => r.kind === "curse").every(r => r.status !== "dormant"), "only open or cleared weak spots");
    console.log(`ok  trace ${h.name}: ${idx.size} files, ${indexed} pieces in them, ${rows.length} combos`);
  }

  // upgrades: the plan for a template piece, in plain words, with side effects said
  {
    const solo = path.join(repo, "samples", "solo");
    const p = await pl.getPlan(repo, solo, "hard-gate");
    const lines = pl.effectLines(p);
    assert.ok(p.template && p.verified, "Blocking hooks has a template that verifies on the solo sample");
    assert.match(lines[0], /^Blocking hooks: level \d → 3 /, lines.join(" | "));
    assert.ok(pl.editLines(p).length && pl.editLines(p).every(l => /^(New|Changes) /.test(l)));
    const q = await pl.getPlan(repo, solo, "evals");
    assert.ok(!q.template && q.request.includes("Evals") && q.request.includes("wait for my yes"), "no template: a request for the agent");
    console.log(`ok  upgrade plan: ${lines.slice(0, 3).join(" · ")}`);
    // the write side through the worker, as the editor runs it: the upgrade list, and a board measured with a draft
    // (Free Rein's skills tried in a copy, two upgrades, a call on a situation) that carries reality to compare
    const ups = await pl.listUpgrades(repo, solo);
    assert.ok(ups.some(u => u.piece === "hard-gate" && u.template), "Blocking hooks can be added from a template");
    const draft = (await readHarness(solo, repo, true, "claude", "", ["Free Rein"], ["permissions", "receipts"], false, [], [{ kind: "ask", rule: "Bash(git push:*)" }])).harnesses[0] as any;
    assert.deepStrictEqual(draft.draft.measured, ["permissions", "receipts"]);
    assert.ok(draft.draft.reality && draft.progression.xp_total > draft.draft.reality.xp, "the draft adds XP over reality");
    console.log(`ok  through the worker: ${ups.length} upgrades, a draft from ${draft.draft.reality.xp} to ${draft.progression.xp} XP`);
  }
}

main().catch(e => { console.error("FAIL", e); process.exit(1); });
