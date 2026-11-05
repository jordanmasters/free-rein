// What an editor's customization view would list: each kind's files and entries, as the chosen runtime loads them.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { evaluate } from "../../src/judge/evaluate";
import * as fs from "fs";
import * as path from "path";
import { KINDS, pluginOf } from "../../src/judge/customizations";
import { copyFixture, inTemp, write } from "../helpers";

const KITCHEN = copyFixture("kitchen");
const labels = (root: string, runtime: string, kind: string) =>
  (evaluate(root, { runtime }).customizations.find((c: any) => c.kind === kind)?.items ?? []).map((x: any) => x.label);

test("customizations: every kind, in order, for every runtime", () => {
  for (const rt of ["claude", "cursor", "codex", "copilot", "copilot-cli"])
    assert.deepEqual(evaluate(KITCHEN, { runtime: rt }).customizations.map((c: any) => c.kind), KINDS, rt);
  assert.deepEqual(evaluate(null, { profile: "claude" }).customizations, [], "a profile has no files");
});

test("customizations: each runtime lists what it loads", () => {
  assert.ok(labels(KITCHEN, "claude", "commands").includes(".claude/commands/ship.md"));
  assert.ok(!labels(KITCHEN, "cursor", "commands").includes(".claude/commands/ship.md"));
  assert.ok(labels(KITCHEN, "copilot-cli", "commands").includes(".claude/commands/ship.md"));
  assert.ok(labels(KITCHEN, "cursor", "hooks").includes(".claude/hooks/guard.sh"), "Cursor runs Claude Code's hooks");
  assert.deepEqual(labels(KITCHEN, "copilot", "hooks"), [], "VS Code's Local agent runs them only with chat.useClaudeHooks on");
  assert.ok(labels(KITCHEN, "copilot", "agents").includes("helper"));
  assert.ok(!labels(KITCHEN, "claude", "agents").includes("helper"));
  assert.deepEqual(labels(KITCHEN, "codex", "instructions"), ["AGENTS.md"]);
  assert.ok(labels(KITCHEN, "claude", "instructions").includes("sub/CLAUDE.md"));
});

test("customizations: an item names the pieces it gives", () => {
  const md = evaluate(KITCHEN, { runtime: "claude" }).customizations.find((c: any) => c.kind === "instructions").items.find((x: any) => x.label === "CLAUDE.md");
  assert.ok(md.pieces.includes("proj-instructions"), JSON.stringify(md));
  assert.equal(md.scope, "project");
});

test("customizations: a script no settings file registers isn't a hook", () => {
  inTemp(root => {
    write(root, "CLAUDE.md", "# App\n");
    write(root, ".claude/hooks/orphan.sh", "#!/bin/sh\nexit 0\n");
    write(root, ".cursor/hooks.json", "{\"version\": 1, \"hooks\": {}}\n");
    assert.deepEqual(labels(root, "claude", "hooks"), []);
    assert.deepEqual(labels(root, "cursor", "hooks"), [".cursor/hooks.json"]);
  });
});

test("customizations: a plugin's files are the plugin's; a package linked into your folders is yours", () => {
  inTemp((root, h) => {
    write(root, "CLAUDE.md", "# App\n");
    write(h, ".claude/skills/mine/SKILL.md", "---\nname: mine\ndescription: Use when testing.\n---\n1. Test.\n");
    const c = evaluate(root, { runtime: "claude" }).customizations, of = (k: string) => c.find((x: any) => x.kind === k).items;
    assert.deepEqual(of("skills").filter((x: any) => x.label === "mine").map((x: any) => x.scope), ["user"]);
    assert.deepEqual(of("plugins"), []);
    assert.equal(pluginOf(path.join(h, ".claude/plugins/cache/market/tidy/1.0.0/skills/tidy/SKILL.md")), "tidy");
    assert.equal(pluginOf(path.join(h, ".claude/skills/mine/SKILL.md")), null);
  });
});

test("customizations: a folder it may not open is skipped, not an error", () => {
  inTemp(root => {
    write(root, "CLAUDE.md", "# App\n");
    write(root, ".claude/commands/ok.md", "Do it.\n");
    write(root, ".claude/commands/locked/x.md", "Hidden.\n");
    fs.chmodSync(path.join(root, ".claude/commands/locked"), 0o000);
    try {
      assert.ok(labels(root, "claude", "commands").includes(".claude/commands/ok.md"));
    } finally { fs.chmodSync(path.join(root, ".claude/commands/locked"), 0o755); }
  });
});

test("customizations: home skills are the user's", () => {
  inTemp((root, h) => {
    write(root, "AGENTS.md", "# App\n");
    write(h, ".copilot/skills/mine/SKILL.md", "---\nname: mine\ndescription: Use when testing.\n---\n1. Test.\n");
    const sk = evaluate(root, { runtime: "copilot-cli" }).customizations.find((c: any) => c.kind === "skills").items;
    assert.deepEqual(sk.map((x: any) => [x.label, x.scope]), [["mine", "user"]]);
  });
});
