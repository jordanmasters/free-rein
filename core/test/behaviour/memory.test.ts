// Memory: the notes your agent keeps for itself. Read from your home (only when it counts), in this repo's layer just
// for you, split into statements like the rest, a feedback note's first sentence a rule; never quoted in what's shared.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "path";
import { memory } from "../../src/read/memory";
import { withHome as countingHome } from "../../src/read/home";
import { harness as statementsOf } from "../../src/read/statements";
import { board } from "../../src/report/board";
import { document } from "../../src/report/harness";
import { check } from "../../src/report/check";
import { load } from "../../src/read/spec";
import { inTemp, write } from "../helpers";

const SECRET = "Deploys go out on Tuesday afternoons";

/** a harness, and in the home folder its memory: the index, a feedback note, a project note */
function seed(root: string, home: string) {
  write(root, "CLAUDE.md", "# Repo\n\nNever push to main.\n");
  const dir = path.join(home, ".claude", "projects", root.replace(/[^A-Za-z0-9]/g, "-"), "memory");
  write(dir, "MEMORY.md", "- [Keep the build](keep-build.md) — don't delete dist after packaging\n- [Deploys](deploys.md) — when deploys go out\n");
  write(dir, "keep-build.md", "---\nname: keep-build\ndescription: leave dist in place\nmetadata:\n  type: feedback\n  modified: 2026-09-01T10:00:00Z\n---\n\nLeave `dist/` in place after packaging; the next install reads it.\n\n**Why:** reinstalls need it.\n");
  write(dir, "deploys.md", `---\nname: deploys\ndescription: when deploys go out\nmetadata:\n  type: project\n---\n\n${SECRET}. See [[keep-build]].\n`);
  return dir;
}

test("the notes are read from this repo's folder in your home: the index first, with what of it loads at the start", () => inTemp((root, home) => {
  const dir = seed(root, home);
  const m = countingHome(true, () => memory(root))!;
  assert.equal(m.dir, dir);
  assert.equal(m.on, true, "Claude Code's auto memory is on by default (its record)");
  assert.deepEqual(m.notes.map(n => n.file), ["MEMORY.md", "deploys.md", "keep-build.md"]);
  assert.equal(m.notes[0].index, true);
  assert.equal(m.notes[0].start_lines, 2, "within 200 lines and 25 KB, all of it");
  const kb = m.notes.find(n => n.file === "keep-build.md")!;
  assert.equal(kb.type, "feedback");
  assert.equal(kb.modified, "2026-09-01");
  assert.deepEqual(kb.names, ["dist/"]);
  assert.deepEqual(m.notes.find(n => n.file === "deploys.md")!.links, ["keep-build"]);
  assert.equal(countingHome(false, () => memory(root)), null, "the home folder doesn't count: nothing is read");
}));

test("its statements are your agent's: a feedback note's first sentence is a rule, the index only points", () => inTemp((root, home) => {
  seed(root, home);
  const sts = countingHome(true, () => statementsOf(root)).filter((s: any) => s.who === "agent");
  const rule = sts.find((s: any) => s.from === "memory feedback");
  assert.ok(rule && rule.kind === "rule" && /Leave `dist\/` in place/.test(rule.text), "the rule, though it says neither never nor always");
  assert.ok(sts.filter((s: any) => /MEMORY\.md$/.test(s.source.file)).every((s: any) => s.kind === "pointer"), "the index repeats the notes");
  assert.ok(sts.every((s: any) => s.piece === "saved-facts"));
  assert.equal(sts.filter((s: any) => /Why/.test(s.text) && s.kind === "rule").length, 0, "its why isn't a second rule");
}));

test("on the board: its own notes, in this repo just for you, though they sit in your home", () => inTemp((root, home) => {
  const dir = seed(root, home);
  const b = board(root, { count_home: true });
  const local = b.stack.levels.find((l: any) => l.id === "local");
  assert.ok(local && local.gives.some((g: any) => g.piece === "saved-facts" && g.files.some((f: string) => dir.endsWith(f.replace(/^~/, "")))));
  assert.ok(!b.stack.levels.some((l: any) => l.id === "user" && l.pieces.includes("saved-facts")), "not you in every repo");
}));

test("what's shared never quotes it: the harness document counts it, check leaves it out", () => inTemp((root, home) => {
  seed(root, home);
  const doc = document(board(root, { count_home: true }), load(), root, null, true);
  assert.ok(!JSON.stringify(doc.statements).includes(SECRET) && !JSON.stringify(doc.statements).includes("dist/"));
  assert.ok(doc.memory && doc.memory.statements > 0 && doc.memory.rules === 1);
  assert.ok(!JSON.stringify(check(root, { count_home: true })).includes("dist/` in place"));
}));
