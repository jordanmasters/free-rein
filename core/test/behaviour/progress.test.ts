// Tests for where pieces are, maturity, guards and progression.
// Reads the kitchen and solo samples, and any real harnesses named in FREE_REIN_TEST_HARNESSES; the rest uses small fixtures, so it runs anywhere.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { evaluate } from "../../src/judge/evaluate";
import { jsonBlock } from "../../src/read/extract";
import * as progress from "../../src/judge/progress";
import { board } from "../../src/report/board";
import { load } from "../../src/read/spec";
import { REPO, tmpdir, copyFixture, extraHarnesses } from "../helpers";

const FREE_REIN = REPO;
const PROJECTS = path.dirname(FREE_REIN);
const HARNESSES = [copyFixture("kitchen"), copyFixture("solo"), ...extraHarnesses()];
const SPEC = load();   // pieces.json plus runtimes/*.json
const PIECES = SPEC.slots.reduce((n: number, s: any) => n + s.items.length, 0);
const noHarnesses = HARNESSES.length ? false : "no harnesses next to this repo";

// JsonBlock
const TEXT = '{\n  "permissions": {\n    "allow": ["Bash(ls)"]\n  },\n  "hooks": {\n    "Stop": [\n      {"hooks": []}\n    ]\n  }\n}\n';

test("json block: block lines", () => {
  assert.deepEqual(jsonBlock(TEXT, "permissions"), [2, 4]);
  assert.deepEqual(jsonBlock(TEXT, "hooks"), [5, 9]);
  assert.deepEqual(jsonBlock(TEXT, "Stop"), [6, 8]);
});

test("json block: missing key", () => {
  assert.equal(jsonBlock(TEXT, "nope"), null);
});

test("json block: brackets inside strings", () => {
  const t = '{\n "a": {\n  "x": "}}]]"\n },\n "b": 1\n}';
  assert.deepEqual(jsonBlock(t, "a"), [2, 4]);
});

// Where
test("where: scopes", () => {
  const root = path.join(PROJECTS, "somerepo");
  assert.equal(progress.where(path.join(root, "CLAUDE.md"), root, FREE_REIN)[0], "project");
  assert.equal(progress.where(path.join(root, "CLAUDE.local.md"), root, FREE_REIN)[0], "local");
  assert.equal(progress.where(path.join(os.homedir(), ".claude", "CLAUDE.md"), root, FREE_REIN)[0], "user");
  assert.equal(progress.where("/etc/claude-code/CLAUDE.md", root, FREE_REIN)[0], "org");
  assert.deepEqual(progress.where(null, root, FREE_REIN), [null, null]);
});

test("where: Free Rein supplies its own files", () => {
  const [, pkg] = progress.where(path.join(FREE_REIN, "skills", "address-findings", "SKILL.md"), "/elsewhere", FREE_REIN);
  assert.equal(pkg, "Free Rein");
});

// Maturity
const CAP = { id: "a", kind: "capability" };
const BLOCK = { id: "b", kind: "control", strength: "blocks" };
const ASK = { id: "c", kind: "control", strength: "asks" };

test("maturity: steps", () => {
  const m = (it: any, st: string, holds = 0, gs: any[] = [], states: Record<string, string> = {}) => progress.maturity(it, st, holds, [...gs], states);
  assert.equal(m(CAP, "no"), 0);
  assert.equal(m(CAP, "unchecked"), 0);
  assert.equal(m(CAP, "partial"), 1);
  assert.equal(m(CAP, "yes"), 2);
  assert.equal(m(BLOCK, "yes"), 3, "a control that blocks is hardened");
  assert.equal(m(ASK, "yes", 1), 3, "a control with an instance that holds on its own");
  assert.equal(m(CAP, "yes", 1), 2, "holding only counts for controls");
  const g = [{ guarded: "a", by: "c" }];
  assert.equal(m(CAP, "yes", 0, g, { c: "yes" }), 3, "guarded by an equipped piece");
  assert.equal(m(CAP, "yes", 0, g, { c: "no" }), 2);
});

test("maturity: guards only from pairs with a firmer side", () => {
  for (const g of progress.guards(SPEC, {})) {
    const items: Record<string, any> = Object.fromEntries(SPEC.slots.flatMap((s: any) => s.items.map((i: any) => [i.id, i])));
    assert.ok(progress.firmness(items[g.by]) > progress.firmness(items[g.guarded]));
  }
});

// Progression
test("progression: level curve", () => {
  const p = SPEC.progression;
  // one hardened piece and one achievement: 85 + 50 = 135 XP -> level 7 (117..153)
  const slots = [{ items: [{ id: "x", maturity: 3, state: "yes" }] }];
  const combos = [{ id: "c", kind: "synergy", status: "active" }];
  const tiers = [{ id: "dotfile", name: "Dotfile", rank: "Apprentice", needs: ["x"], reached: true }];
  const out = progress.progression(SPEC, slots, combos, tiers);
  assert.equal(out.xp, p.piece_xp[3] + p.achievement_xp);
  assert.equal(out.level, 7);
  assert.ok(out.level_start <= out.xp);
  assert.ok(out.xp < out.next_level_at);
  assert.equal(out.rank.name, "Apprentice");
  assert.equal(out.next_rank, null);
});

test("progression: level tops out at 50", () => {
  assert.equal(progress.levelOfSpec(SPEC, 10 ** 6)[0], 50);
  assert.equal(progress.levelOfSpec(SPEC, 10 ** 6)[2], null);
  assert.equal(progress.levelOfSpec(SPEC, 0)[0], 0);
});

test("progression: weak spots block the next rank", () => {
  const slots = [{ items: [{ id: "x", maturity: 0, state: "no" }] }];
  const combos = [{ id: "w", kind: "curse", status: "active" }];
  const tiers = [{ id: "dotfile", name: "Dotfile", rank: "Apprentice", needs: ["x"], reached: false }];
  const out = progress.progression(SPEC, slots, combos, tiers);
  assert.equal(out.rank, null);
  assert.deepEqual(out.next_rank.needs, ["x"]);
  assert.deepEqual(out.next_rank.weak_spots, ["w"]);
});

// RealHarnesses
test("real harnesses: every harness", { skip: noHarnesses }, async t => {
  for (const root of HARNESSES) {
    await t.test(path.basename(root), () => {
      const out = evaluate(root);
      const items = out.slots.flatMap((s: any) => s.items);
      assert.equal(items.length, PIECES);
      for (const i of items) {
        assert.ok([0, 1, 2, 3].includes(i.maturity));
        assert.equal(i.maturity > 0, ["yes", "partial"].includes(i.state));
        for (const f of i.found) {
          if (f.path && fs.existsSync(f.path) && fs.statSync(f.path).isFile()) {
            assert.ok(f.lines && f.lines.length, `${i.id}: ${f.path} has no lines`);
            const [a, b] = f.lines;
            assert.ok(1 <= a && a <= b, JSON.stringify(f.lines));
          }
        }
      }
      const pg = out.progression;
      assert.ok(pg.xp >= pg.level_start);
      assert.ok(pg.xp < pg.next_level_at);
    });
  }
});

test("real harnesses: empty folder", () => {
  const d = tmpdir();
  try {
    const out = evaluate(d);
    assert.equal(out.progression.rank, null);
    assert.ok(out.slots.every((s: any) => s.items.every((i: any) => !i.found.length || i.found.every((f: any) => f.scope !== "project"))));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// Board
test("board: board shape", { skip: noHarnesses }, async t => {
  for (const root of HARNESSES) {
    await t.test(path.basename(root), () => {
      const b = board(root);
      const ids: string[] = b.slots.flatMap((s: any) => s.types.map((t: any) => t.id));
      assert.equal(ids.length, PIECES);
      const known = new Set(ids);
      for (const st of b.sets)
        assert.ok(st.ids.every((x: string) => known.has(x)) && st.lifts.every((x: string) => known.has(x)), st.name);
      for (const c of b.trustx)
        assert.ok(c.pieces.every((p: any) => known.has(p.id)), c.name);
      assert.ok(Object.keys(b.next).every(x => known.has(x)));  // next is keyed by piece id (Python: set(b["next"]))
      assert.equal(b.progression.level, progress.levelOfSpec(SPEC, b.progression.xp_total)[0]);
    });
  }
});
