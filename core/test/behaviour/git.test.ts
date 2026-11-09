// Which files git tracks, read from .git/index without running git: committed is shared, the rest is only yours.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { tracked, ignored } from "../../src/read/git";

test("the index lists what's committed or staged, not ignored or new files; a harness below the repo's top sees its own paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "git-"));
  const w = (f: string, t = "x") => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); };
  w("CLAUDE.md"); w(".claude/settings.json", "{}"); w(".claude/settings.local.json", "{}"); w("sub/AGENTS.md"); w(".gitignore", ".claude/settings.local.json\n");
  spawnSync("git", ["init", "-q", root]); spawnSync("git", ["-C", root, "add", "CLAUDE.md", ".claude/settings.json", "sub/AGENTS.md", ".gitignore"]);
  w("new-skill.md");
  assert.deepEqual([...tracked(root)!].sort(), [".claude/settings.json", ".gitignore", "CLAUDE.md", "sub/AGENTS.md"]);
  assert.deepEqual([...tracked(path.join(root, "sub"))!], ["AGENTS.md"]);
  assert.equal(tracked(fs.mkdtempSync(path.join(os.tmpdir(), "nogit-"))), null, "no repo: nothing to tell");
});

test("what git ignores, read from the ignore files, agrees with git itself", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gitignore-"));
  const w = (f: string, t = "x") => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); };
  w(".gitignore", "# a comment\nnode_modules/\n*.log\n!keep.log\n/top-only.md\ndocs/**/draft.md\nbuild\n.claude/state/\n");
  w("app/.gitignore", "secret.txt\n");
  spawnSync("git", ["init", "-q", root]);
  w(".git/info/exclude", "scratch/\n");
  const paths = ["node_modules/x/index.js", "a.log", "keep.log", "sub/b.log", "top-only.md", "sub/top-only.md", "docs/draft.md", "docs/a/b/draft.md",
    "build/out.js", "src/build", ".claude/state/mode.json", ".claude/settings.json", "app/secret.txt", "secret.txt", "scratch/n.md", "CLAUDE.md", "docs/notes.md"];
  for (const p of paths) w(p);
  const ign = ignored(root)!;
  for (const p of paths) {
    const git = spawnSync("git", ["-C", root, "check-ignore", "-q", p]).status === 0;
    assert.equal(ign(p), git, `${p}: git says ${git ? "ignored" : "not ignored"}`);
  }
  assert.equal(ignored(fs.mkdtempSync(path.join(os.tmpdir(), "nogit-"))), null, "no repo: nothing to tell");
});
