// The mode a harness starts in, for any runtime: read from the places its runtime record lists, in JSON (with
// comments), VS Code's flat keys, TOML and YAML; the runtime's default when nothing sets it; one pick per control.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { settingIn, startMode, withChoice } from "../../src/read/run-mode";
import { runtimeFiles } from "../../src/read/spec";
import { inTemp, write } from "../helpers";
import { join } from "path";

const rm = (id: string) => runtimeFiles()[id].run_modes;

test("each file format gives the value of its key", () => inTemp(root => {
  write(root, "a.json", '{\n  // a comment\n  "permissions": { "defaultMode": "plan", },\n}\n');
  write(root, "b.json", '{ "chat.permissions.default": "autopilot" }');
  write(root, "c.toml", 'model = "x"\nsandbox_mode = "read-only" # comment\n[ui]\npermission_mode = "auto"\n');
  write(root, "d.yml", "tools:\n  approval:\n    bash: prompt\n  approvalMode: write\n");
  assert.equal(settingIn(join(root, "a.json"), "json", "permissions.defaultMode"), "plan");
  assert.equal(settingIn(join(root, "b.json"), "json-flat", "chat.permissions.default"), "autopilot");
  assert.equal(settingIn(join(root, "c.toml"), "toml", "sandbox_mode"), "read-only");
  assert.equal(settingIn(join(root, "c.toml"), "toml", "ui.permission_mode"), "auto");
  assert.equal(settingIn(join(root, "d.yml"), "yaml", "tools.approvalMode"), "write");
  assert.equal(settingIn(join(root, "missing.json"), "json", "x"), null);
}));

test("nothing set: the runtime's default; set in the harness: that mode, and where it came from", () => inTemp(root => {
  assert.equal(startMode(root, rm("claude")).picks[0].name, "Auto");
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }));
  const s = startMode(root, rm("claude"));
  assert.deepEqual([s.picks[0].name, s.picks[0].from, s.level], ["Edit automatically", ".claude/settings.json", "edits"]);
}));

test("a value the runtime ignores in a file doesn't count there (a project can't start Claude Code in Auto)", () => inTemp(root => {
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { defaultMode: "bypassPermissions" } }));
  assert.equal(startMode(root, rm("claude")).picks[0].set, false);
}));

test("two controls: Cursor's chat mode follows its run mode; Plan or Ask is read-only whatever the run mode", () => inTemp(root => {
  const s = startMode(root, rm("cursor"));
  assert.deepEqual([s.picks.map((p: any) => p.name), s.level], [["Agent", "Auto-Review (with Sandbox)"], "checker"]);
  write(root, ".cursor/cli.json", JSON.stringify({ approvalMode: "unrestricted" }));
  assert.equal(startMode(root, rm("cursor")).level, "all");
}));

test("other runtimes read their own files: Codex's TOML", () => inTemp(root => {
  write(root, ".codex/config.toml", 'approvals_reviewer = "auto_review"\n');
  assert.equal(startMode(root, rm("codex")).picks[0].name, "Approve for me");
}));

test("a run mode you tell Free Rein (Cursor keeps it in the app) wins over the default and the files", () => inTemp(root => {
  const s = withChoice(startMode(root, rm("cursor")), { "run mode": "allowlist-sandbox" });
  const p = s.picks.find((x: any) => x.picker === "run mode");
  assert.deepEqual([p.name, p.from, s.level], ["Allowlist (with Sandbox)", "your Free Rein setting", "asks"]);
  assert.equal(withChoice(startMode(root, rm("cursor")), { "run mode": "no-such-mode" }).picks[1].name, "Auto-Review (with Sandbox)");
}));
