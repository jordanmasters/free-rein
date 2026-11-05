// free-rein check: findings with a level, a place and a fix; fails at the level asked; SARIF code scanning can read.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "path";
import { spawnSync } from "child_process";
import { check, fails, sarif, text } from "../../src/report/check";
import { inTemp, write, copyFixture, withHome, tmpdir, FIXTURES, REPO } from "../helpers";

const CLI = path.join(REPO, "core", "out", "src", "cli.js");

test("a high-stakes action your own rule lets through is exposed, at that rule", () => inTemp(root => {
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(git push:*)"] } }, null, 2));
  const r = check(root, { count_home: false });
  const f = r.findings.find(x => x.rule === "exposed" && /Push/.test(x.message));
  assert.ok(f, r.findings.map(x => x.rule + " " + x.message).join("\n"));
  assert.equal(f!.level, "warning");
  assert.deepEqual([f!.place?.path, f!.place?.line], [".claude/settings.json", 4]);
}));

test("a rule in the prose that nothing enforces is flagged where it's written, and a deny rule clears it", () => inTemp(root => {
  write(root, "CLAUDE.md", "# Rules\n\n- Never force push to main.\n");
  const before = check(root, { count_home: false }).findings.filter(x => x.rule === "unbacked-rule");
  assert.equal(before.length, 1);
  assert.deepEqual([before[0].place?.path, before[0].place?.line], ["CLAUDE.md", 3]);
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { deny: ["Bash(git push --force:*)"] } }));
  assert.equal(check(root, { count_home: false }).findings.filter(x => x.rule === "unbacked-rule").length, 0);
}));

test("fails at the level asked: error by default, never with none", () => inTemp(root => {
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(git push:*)"] } }));
  const r = check(root, { count_home: false });
  assert.equal(r.counts.error, 0);
  assert.ok(r.counts.warning > 0);
  assert.equal(fails(r, "error"), false);
  assert.equal(fails(r, "warning"), true);
  assert.equal(fails(r, "note"), true);
  assert.equal(fails(r, "none"), false);
  assert.match(text(r), /warnings?, \d+ notes \(read in (auto|manual) mode\)\n$/);
}));

test("SARIF: rules and results that agree, levels code scanning knows, and only paths inside the harness", () => {
  const root = copyFixture("kitchen"), home = tmpdir("free-rein-home-");
  withHome(home, () => {
    const s = sarif(check(root), "9.9.9");
    assert.equal(s.version, "2.1.0");
    const run = s.runs[0], rules = run.tool.driver.rules;
    assert.equal(run.tool.driver.name, "Free Rein");
    assert.equal(new Set(rules.map((x: any) => x.id)).size, rules.length, "each rule once");
    assert.ok(run.results.length > 0);
    for (const r of run.results) {
      assert.equal(rules[r.ruleIndex].id, r.ruleId);
      assert.ok(["error", "warning", "note"].includes(r.level));
      assert.ok(r.message.text.length > 0);
      assert.ok(r.locations?.length, `${r.ruleId} has a place: ${r.message.text}`);
      const loc = r.locations[0].physicalLocation;
      assert.ok(!loc.artifactLocation.uri.startsWith("/") && !loc.artifactLocation.uri.startsWith("~"), loc.artifactLocation.uri);
      if (loc.region) assert.ok(loc.region.startLine >= 1 && (loc.region.endLine ?? loc.region.startLine) >= loc.region.startLine);
      assert.match(r.partialFingerprints.freeReinFinding, /^[0-9a-f]{32}$/);
    }
    assert.ok(!JSON.stringify(s).includes(root) && !JSON.stringify(s).includes(home), "nothing about this machine");
  });
});

test("the command line: exit 1 when a finding is at --fail-on, 0 when not, 2 for a mistake; SARIF to a file", () => inTemp((root, home) => {
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(git push:*)"] } }));
  const run = (...a: string[]) => spawnSync(process.execPath, [CLI, "check", root, ...a], { encoding: "utf8", env: { ...process.env, HOME: home } });
  assert.equal(run().status, 0);
  assert.equal(run("--fail-on", "warning").status, 1);
  assert.equal(run("--format", "xml").status, 2);
  const out = path.join(root, "free-rein.sarif");
  const r = run("--format", "sarif", "--output", out);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /warning/);
  assert.equal(JSON.parse(require("fs").readFileSync(out, "utf8")).version, "2.1.0");
}));

export { FIXTURES };

test("nothing from your home folder reaches the check unless asked (--home): it reads the same on every machine", () => inTemp((root, home) => {
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { deny: ["Bash"] } }, null, 2));
  write(home, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(my-secret-tool --sync:*)"] } }, null, 2));
  // and a session Claude Code kept for this folder, in which the agent ran another command of yours
  const hist = path.join(home, ".claude", "projects", root.replace(/[^A-Za-z0-9]/g, "-"));
  write(hist, "s1.jsonl", JSON.stringify({ message: { content: [{ type: "tool_use", name: "Bash", input: { command: "my-private-script --all" } }] } }) + "\n");
  const run = (...args: string[]) => spawnSync(process.execPath, [CLI, "check", root, "--format", "sarif", ...args], { encoding: "utf8", env: { ...process.env, HOME: home, FREE_REIN_PLUGINS: "" } }).stdout;
  assert.ok(!run().includes("my-secret-tool") && !run().includes("my-private-script"), "left out by default: settings and sessions");
  assert.ok(!run("--no-home").includes("my-secret-tool"));
  assert.ok(run("--home").includes("my-secret-tool"), "counted with --home");
  assert.ok(run("--home").includes("my-private-script"), "sessions too, with --home");
  assert.ok(!check(root).findings.some(f => f.message.includes("my-secret-tool")), "and through the core");
}));

test("the command line refuses what it can't read: an unsupported runtime, a missing folder (exit 2, with a reason)", () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  const a = run("check", path.join(FIXTURES, "solo"), "--runtime", "nope");
  assert.equal(a.status, 2); assert.match(a.stderr, /unsupported runtime: nope \(one of: claude, codex, cursor, copilot, gemini, opencode\)/);
  const b = run("check", path.join(FIXTURES, "no-such-folder"));
  assert.equal(b.status, 2); assert.match(b.stderr, /no such folder/);
  // the supported runtimes are read; a recorded one that isn't supported yet is refused, like an unknown one
  assert.equal(run("check", path.join(FIXTURES, "solo"), "--runtime", "copilot", "--fail-on", "none").status, 0);
  assert.equal(run("check", path.join(FIXTURES, "solo"), "--runtime", "opencode", "--fail-on", "none").status, 0);
  assert.equal(run("check", path.join(FIXTURES, "solo"), "--runtime", "copilot-cloud").status, 2);
});

test("the command line refuses an option it doesn't take (a typo in CI must not pass), and says why a plugin didn't load", () => {
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  const a = run(["check", path.join(FIXTURES, "solo"), "--formt", "json"]);
  assert.equal(a.status, 2); assert.match(a.stderr, /doesn't take --formt/);
  const broken = write(tmpdir("free-rein-broken-"), "broken.js", "throw new Error('broken on purpose')");
  const b = run(["lint", path.join(FIXTURES, "solo")], { FREE_REIN_PLUGINS: broken });
  assert.equal(b.status, 0); assert.match(b.stderr, /plugin problem: .*broken on purpose/);
});

test("--no-home: nothing from your home folder, whatever command", () => {
  const home = tmpdir("free-rein-home-full-");
  write(home, ".claude/skills/mine/SKILL.md", "---\nname: mine\ndescription: Use when you want mine.\n---\n1. Mine.\n");
  const run = (h: string, cmd: string) => spawnSync(process.execPath, [CLI, cmd, path.join(FIXTURES, "solo"), "--no-home"], { encoding: "utf8", env: { ...process.env, HOME: h, FREE_REIN_PLUGINS: "" } }).stdout
    .replace(/"read_at": "[^"]*"/, "");   // when it was read is the one thing that may differ
  for (const cmd of ["read", "upgrades", "extract", "lint"]) assert.equal(run(home, cmd), run(tmpdir("free-rein-home-empty-"), cmd), cmd);
});

test("a skill in another runtime's folder is checked only for that runtime", () => inTemp(root => {
  write(root, ".claude/skills/mine/SKILL.md", "---\nname: mine\ndescription: x\n---\nx\n");
  write(root, ".cursor/skills/theirs/SKILL.md", "---\nname: theirs\ndescription: x\n---\nx\n");
  write(root, "skills/plugin/SKILL.md", "---\nname: plugin\ndescription: x\n---\nx\n");
  const about = (runtime: string) => [...new Set(check(root, { count_home: false, runtime }).findings
    .filter(x => x.rule === "skill-issue").map(x => x.place?.path))].sort();
  assert.deepEqual(about("claude"), [".claude/skills/mine/SKILL.md"]);
  assert.deepEqual(about("cursor"), [".claude/skills/mine/SKILL.md", ".cursor/skills/theirs/SKILL.md"]);
}));
