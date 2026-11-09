// The stack: the levels each runtime reads a harness at, in its own words, with what this harness has at each.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "path";
import { board } from "../../src/report/board";
import { spawnSync } from "child_process";
import { FIXTURES, tmpdir, write } from "../helpers";

const kitchen = path.join(FIXTURES, "kitchen");
const ids = (b: any) => b.stack.levels.map((l: any) => l.id);

test("Claude Code reads the kitchen at this repo (just you, then shared) and its built-ins; the session is named", () => {
  const S = board(kitchen).stack;
  assert.deepEqual(ids({ stack: S }), ["local", "project", "builtin"]);
  assert.ok(S.levels.find((l: any) => l.id === "project").sets.some((x: string) => /mode it starts in \(Plan\)/.test(x)), "the repo's settings set the mode");
  assert.deepEqual(S.unused.map((u: any) => u.id), ["org", "user"], "nothing from an organization, and the tests' home folder is empty");
  assert.ok(S.session && S.combine.settings && S.combine.instructions, "the session, and how the levels combine, with sources in the record");
});

test("each runtime's own levels: Codex has no level just for you; Cursor keeps your rules where Free Rein can't read them", () => {
  assert.ok(!ids(board(kitchen, { runtime: "codex" })).includes("local"));
  const cur = board(kitchen, { runtime: "cursor" }).stack.levels.find((l: any) => l.id === "user");
  assert.equal(cur && cur.readable, false, "shown, and marked unreadable, even with nothing found");
});

test("only yours means kept out of git on purpose; a file not committed yet stays shared, marked", () => {
  const root = tmpdir("free-rein-uncommitted-");
  write(root, "CLAUDE.md", "# Repo\n\nNever push to main.\n");
  write(root, ".gitignore", "notes/\n");
  for (const n of ["a", "b", "c"]) write(root, `notes/${n}.md`, `# ${n}\n`);
  spawnSync("git", ["init", "-q", root]); spawnSync("git", ["-C", root, "add", "CLAUDE.md", ".gitignore"]);
  for (const n of ["a", "b", "c"]) write(root, `vault/${n}.md`, `# ${n}\n`);
  const S = board(root).stack, lv = (id: string) => S.levels.find((l: any) => l.id === id);
  const kb = (l: any) => (l && l.gives.find((g: any) => g.piece === "knowledge-base") || { files: [] }).files;
  assert.deepEqual(kb(lv("project")), ["vault"], "the vault isn't committed yet, and isn't ignored: the repo's");
  assert.deepEqual(lv("project").uncommitted, ["vault"]);
  assert.deepEqual(kb(lv("local")), ["notes"], "git ignores notes/: only yours");
  assert.deepEqual(lv("local").uncommitted, []);
});
