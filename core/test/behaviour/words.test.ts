// Words: everything the agent reads, when each loads (the runtime's record), where it applies, who wrote it, and what it
// says sentence by sentence, with each rule's backing.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "path";
import { board } from "../../src/report/board";
import { inTemp, write, FIXTURES } from "../helpers";

const at = (w: any, file: RegExp) => w.files.find((f: any) => file.test(f.file));

test("the kitchen: instructions at the start, a subfolder's when work reaches it, a skill's description at the start and its body on use", () => {
  const w = board(path.join(FIXTURES, "kitchen")).words;
  assert.ok(w && w.recorded, "Claude Code's record says when each loads");
  assert.deepEqual(at(w, /^CLAUDE\.md$/).parts.map((p: any) => p.when), ["start"]);
  assert.deepEqual(at(w, /^sub\/CLAUDE\.md$/).parts.map((p: any) => p.when), ["folder"]);
  const sk = w.files.find((f: any) => /SKILL\.md$/.test(f.file));
  assert.deepEqual(sk.parts.map((p: any) => p.when), ["start", "use"]);
  assert.ok(sk.parts[0].tokens < sk.parts[1].tokens, "the description is the small part");
  assert.ok(w.files.every((f: any) => f.who === "you" && ["project", "local"].includes(f.layer)), "with no home folder, only the repo's own");
  assert.equal(at(w, /^CLAUDE\.local\.md$/).layer, "local");
  const T = w.totals;
  assert.equal(T.sentences, w.files.reduce((n: number, f: any) => n + f.sentences.length, 0));
  assert.ok(T.start_tokens > 0 && T.start_tokens < T.tokens);
  assert.equal(T.rules, w.files.reduce((n: number, f: any) => n + (f.kinds.rule || 0), 0));
});

test("your agent's notes: the index at the start, the rest on demand, a note naming a file that's gone", () => inTemp((root, home) => {
  write(root, "CLAUDE.md", "# Repo\n\nNever push to main.\n");
  write(root, "src/app.ts", "export {};\n");
  const dir = path.join(home, ".claude", "projects", root.replace(/[^A-Za-z0-9]/g, "-"), "memory");
  write(dir, "MEMORY.md", "- [Build](build.md) — how the build works\n");
  write(dir, "build.md", "---\nname: build\ndescription: how the build works\nmetadata:\n  type: project\n---\n\nThe entry point is `src/main.ts`.\n");
  const w = board(root, { count_home: true }).words;
  const idx = at(w, /MEMORY\.md$/), note = at(w, /build\.md$/);
  assert.ok(idx.who === "agent" && idx.layer === "local" && idx.parts[0].when === "start");
  assert.equal(note.parts[0].when, "demand");
  assert.deepEqual(note.note.findings, ["names src/main.ts, which isn't in this repo now"]);
  assert.equal(w.totals.agent_notes, 2);
}));
