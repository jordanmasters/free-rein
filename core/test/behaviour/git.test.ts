// Which files git tracks, read from .git/index without running git: committed is shared, the rest is only yours.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { tracked } from "../../src/read/git";

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
