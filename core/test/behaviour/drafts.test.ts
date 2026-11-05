// Drafts: changes measured together on a copy, reality alongside; a new harness predicts the folder it creates.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { board } from "../../src/report/board";
import { edits, create } from "../../src/write/drafts";
import { evaluate } from "../../src/judge/evaluate";
import { REPO, tmpdir, write, copyFixture } from "../helpers";

// a harness with files on every layer: the kitchen sample, copied
const KITCHEN = copyFixture("kitchen");

function plain() {
  const d = tmpdir("free-rein-test-draft-");
  write(d, "CLAUDE.md", "# Plain\n\nA small app. Run tests with npm test.\n");
  const r = spawnSync("git", ["init", "-q", d]);
  assert.equal(r.status, 0);
  return d;
}

test("drafts: a draft carries reality", () => {
  const d = plain();
  const real = board(d);
  const b = board(d, { ups: ["hard-gate", "evals"] });
  assert.equal(b.draft.reality.xp, real.progression.xp);
  assert.deepEqual(b.draft.measured, ["hard-gate"]);
  assert.deepEqual(b.draft.requested, ["evals"], "no template: listed, not measured");
  assert.ok(b.progression.xp > real.progression.xp);
  assert.deepEqual(fs.readdirSync(d).sort(), [".git", "CLAUDE.md"], "nothing real changes");
});

test("drafts: edits combine on one file", () => {
  const d = plain();
  const e = edits(d, ["hard-gate", "completion-check"]);
  const st = e.edits.filter((x: any) => x.rel === ".claude/settings.json");
  assert.equal(st.length, 1);
  const hooks = JSON.parse(st[0].after).hooks;
  assert.ok("PreToolUse" in hooks);
  assert.ok("Stop" in hooks, "both templates' hooks end up in the one settings.json");
});

test("drafts: a new harness predicts its folder", () => {
  const b = board(null, { count_home: true, profile: "claude", ups: ["hard-gate", "proj-instructions"] });
  assert.equal(b.new.runtime, "claude");
  assert.deepEqual(b.slots.flatMap((s: any) => s.types.flatMap((t: any) => t.inst)).filter((x: any) => x.path && x.path.includes("free-rein-new-")), [],
    "no paths into a temp folder");
  const dest = path.join(tmpdir("free-rein-test-create-"), "made");
  create(dest, ["hard-gate", "proj-instructions"]);
  const made = board(dest, { count_home: true });
  assert.equal(made.progression.xp, b.progression.xp, "the draft's numbers are what the folder reads");
  fs.rmSync(path.dirname(dest), { recursive: true, force: true });
});

// Adding a layer never lowers XP: a weak skill it brings earns nothing, but takes nothing away either.
test("drafts: yours splits into project and home, and each layer only adds", () => {
  const xp: Record<string, number> = Object.fromEntries(["packages", "project", "home", "yours"].map(l => [l, evaluate(KITCHEN, { count_home: true, layer: l }).progression.xp]));
  assert.ok(xp.packages <= xp.project);
  assert.ok(xp.packages <= xp.home);
  assert.ok(xp.project <= xp.yours);
  assert.ok(xp.home <= xp.yours);
});
