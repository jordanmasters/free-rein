// Statements, by pattern: each sentence of a harness's prose becomes a typed object.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as st from "../../src/read/statements";
import { tmpdir } from "../helpers";

const k = (text: string) => st.classify(text);

function inDir<T>(fn: (root: string) => T): T {
  const root = tmpdir();
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

// Classify
test("classify: rules and their strength", () => {
  assert.deepEqual(k("Never write to the vault before passing through Reviewing."), ["rule", "must-not"]);
  assert.deepEqual(k("- Don't copy text or code from outside projects."), ["rule", "must-not"]);
  assert.deepEqual(k("Every write-gated flow must have at least one checkpoint."), ["rule", "must"]);
  assert.deepEqual(k("You should avoid editing generated files."), ["rule", "should-not"]);
});

test("classify: only as a description is not a rule", () => {
  assert.notEqual(k("A framework adapter that runs only when the target is a framework repo.")[0], "rule");
  assert.equal(k("Write to the vault only through /update-vault.")[0], "rule");
});

test("classify: triggers, claims, pointers, directions", () => {
  assert.equal(k("Use when the user asks to add a task.")[0], "trigger");
  assert.equal(k("All vault writes go through the review gate.")[0], "claim");
  assert.equal(k("See vault/glossary.md for the terms.")[0], "pointer");
  assert.equal(k("1. Show the diff to the user.")[0], "direction");
});

test("classify: what a statement is about", () => {
  const ab = st.about("Never force push to main, and don't delete `vault/decisions.md`.");
  const acts = ab.filter(a => "action" in a).map(a => a.action);
  assert.ok(acts.includes("force-push"));
  assert.ok(!acts.includes("push"));
  assert.ok(acts.includes("delete"));
  assert.ok(ab.some(a => JSON.stringify(a) === JSON.stringify({ path: "vault/decisions.md" })));
});

test("classify: tokens are secrets and discarding is losing work only in context", () => {
  const acts = (t: string) => st.about(t).filter(a => "action" in a).map(a => a.action);
  // from a real harness, where these read as secrets and as throwing away changes
  assert.ok(!acts("All token values come from `motionTokens`. Hardcoded durations are forbidden.").includes("read-secrets"));
  assert.ok(!acts("Do not use deep OFFSET pagination; it makes the server scan and discard rows.").includes("discard"));
  for (const t of ["Never hardcode tokens.", "Don't commit your GitHub token.", "Never put a key or token in arguments, tracked files or logs.",
    "Copy the token — store it in your environment, never in source code."]) assert.ok(acts(t).includes("read-secrets"), t);
  for (const t of ["Do not count the same tokens twice.", "Always hash passwords with BCrypt."]) assert.ok(!acts(t).includes("read-secrets"), t);
  for (const t of ["Never discard uncommitted changes.", "Don't run git reset --hard.", "Never throw away local edits."]) assert.ok(acts(t).includes("discard"), t);
});

// Read
test("read: wrapped lines are one sentence and code is skipped", () => {
  const text = "---\nname: ship\ndescription: Use when the user asks to publish the package\n---\n\n- Never publish without\n  running the tests first.\n\n```bash\nnpm publish  # never\n```\n";
  const sts = inDir(root => {
    const p = path.join(root, ".claude", "skills", "ship", "SKILL.md");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
    return st.harness(root);
  });
  const kinds = sts.map(s => JSON.stringify([s.kind, s.text]));
  assert.ok(kinds.includes(JSON.stringify(["trigger", "Use when the user asks to publish the package"])));
  const rules = sts.filter(s => s.kind === "rule");
  assert.equal(rules.length, 1);
  assert.equal(rules[0].text, "- Never publish without running the tests first.");
  assert.equal(rules[0].scope, "unit");
  assert.ok(sts.every(s => !s.text.includes("npm publish  # never")));
});

test("read: every statement keeps its source", () => {
  const s = inDir(root => {
    fs.writeFileSync(path.join(root, "CLAUDE.md"), "# Rules\n\nAlways run the tests.\n");
    return st.harness(root)[0];
  });
  assert.deepEqual(s.source, { file: "CLAUDE.md", line: 3, node: "CLAUDE.md" });
  assert.equal(s.scope, "harness");
  assert.equal(s.read_by, "pattern");
});

test("read: a skill's prose counts only where a runtime loads skills", () => {
  const files = inDir(root => {
    const rule = "---\nname: x\ndescription: x\n---\nNever push to main.\n";
    for (const d of [".claude/skills/a", "skills/b", "docs/ja-JP/skills/c", "pi/core/skills/d"]) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
      fs.writeFileSync(path.join(root, d, "SKILL.md"), rule);
    }
    return [...new Set(st.harness(root).map((x: any) => x.source.file))].sort();
  });
  assert.deepEqual(files, [".claude/skills/a/SKILL.md", "skills/b/SKILL.md"]);
});
