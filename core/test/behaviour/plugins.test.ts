// Plugins: a framework on top of a runtime (Tidy, the sample plugin in samples/plugins) is read,
// checked, gated, shown and installed as natively as Free Rein's own parts; only for harnesses that use it; and a
// harness reads as plain without it.
import { test, before } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { plugins, used } from "../../src/read/plugins";
import { extract, discoverVaults } from "../../src/read/extract";
import { lint } from "../../src/judge/lint";
import { evaluate } from "../../src/judge/evaluate";
import * as oversight from "../../src/judge/oversight";
import { board } from "../../src/report/board";
import { catalog } from "../../src/write/packages";
import { discover } from "../../src/read/discover";
import { tmpdir, write, FIXTURES } from "../helpers";

const TIDY = path.join(FIXTURES, "plugins", "tidy.js");
const BROKEN = (() => { const d = tmpdir("free-rein-broken-plugin-"); return write(d, "broken.js", "throw new Error('broken on purpose')"); })();

/** a harness that uses Tidy: two rituals (one a skill reads), a hook of its own, a notes folder with a gate */
function tidyHarness() {
  const root = tmpdir("free-rein-tidy-");
  write(root, ".claude/tidy.json", JSON.stringify({ notes: "notes" }, null, 2) + "\n");
  write(root, "rituals/standup.md", "# Standup\n\nWhat was done, what's next.\n");
  write(root, "rituals/retro.md", "# Retro\n\nWhat went well.\n");
  write(root, ".claude/skills/daily/SKILL.md", "---\nname: daily\ndescription: Use when the day starts, to run the standup ritual.\n---\n1. Follow rituals/standup.md.\n");
  write(root, "tidy/hooks/sweep.sh", "#!/bin/bash\n# Sweeps notes; refuses edits outside them.\nexit 2\n");
  write(root, ".claude/settings.json", JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "bash tidy/hooks/sweep.sh" }] }] } }, null, 2));
  for (const n of ["a", "b", "c"]) write(root, `notes/${n}.md`, `# ${n}\n`);
  return root;
}

before(() => { process.env.FREE_REIN_PLUGINS = [TIDY, BROKEN].join(":"); });

test("plugins load from FREE_REIN_PLUGINS; a broken one is left out and doesn't stop anything", () => {
  assert.deepEqual(plugins().map(p => p.id), ["tidy"]);
  const root = tidyHarness();
  assert.deepEqual(used(root).map(p => p.id), ["tidy"]);
  assert.deepEqual(used(tmpdir()).map(p => p.id), [], "a harness that doesn't use it");
});

test("reading: its parts join the graph at their places, with its own contexts", () => {
  const root = tidyHarness();
  const g = extract(root);
  assert.deepEqual(g.adapters, ["claude-code", "tidy"]);
  assert.ok(g.nodes.has("contract:standup") && g.nodes.has("contract:retro"), "its rituals");
  assert.ok(g.edges.some(e => e.type === "reads" && e.source === "unit:daily" && e.target === "contract:standup"), "a skill reading a ritual");
  assert.ok(g.nodes.has("executor:tidy/hooks/sweep.sh") && g.nodes.has("gate:tidy/hooks/sweep.sh"), "its own hook, a gate because it can refuse");
  assert.ok(g.edges.some(e => e.type === "binds" && e.target === "executor:tidy/hooks/sweep.sh" && e.event === "PreToolUse"), "bound where settings run it");
  assert.ok(g.nodes.has("config:tidy.json"));
  assert.deepEqual(g.nodes.get("contract:standup").contexts, ["base", "tidy"]);
  assert.deepEqual(discoverVaults(root), [["notes", "configured in .claude/tidy.json"]]);
});

test("checking: its lint findings, in its own words", () => {
  const f = lint(tidyHarness())[1].filter(x => x.class === "tidy-unread-ritual");
  assert.deepEqual(f.map(x => x.subject), ["contract:retro"]);
  assert.equal(f[0].title, "A ritual nothing uses");
});

test("situations: its review gate asks before a write to the notes", () => {
  const root = tidyHarness();
  const m = oversight.measure(root, evaluate(root), "claude", "auto");
  const s = m.situations.find((x: any) => x.target === "notes/log.md");
  assert.ok(s, "its rules make a situation");
  assert.equal(s.outcome, "asks");
  assert.ok(s.by.some((b: any) => b.piece === "human-gate" && /Tidy asks before notes/.test(b.what)));
});

test("the board: it uses Tidy, shown in Tidy's colour and icon; the plugin's own repo counts as Tidy's", () => {
  const b = board(tidyHarness());
  assert.deepEqual(b.uses, ["tidy"]);
  assert.deepEqual(b.plugins.tidy, { name: "Tidy", colour: "#7FB3D5", icon: "Sparkles" });
  assert.equal(b.own_package, null);
  assert.equal(board(path.join(FIXTURES, "plugins", "tidy-repo")).own_package, "tidy");
  assert.ok(catalog().some(p => p.id === "tidy" && p.kind === "framework" && p.install === "Run tidy-init in the repo"), "a package you can add");
});

test("discovering harnesses says which frameworks each uses", () => {
  const base = tmpdir("free-rein-near-");
  fs.cpSync(tidyHarness(), path.join(base, "with-tidy"), { recursive: true });
  write(base, "plain/CLAUDE.md", "# Plain\n");
  assert.deepEqual(discover(base).map(h => [h.name, h.uses]), [["plain", []], ["with-tidy", ["Tidy"]]]);
});

test("without the plugin, the same harness reads as plain", () => {
  const root = tidyHarness();
  process.env.FREE_REIN_PLUGINS = "";
  try {
    const g = extract(root);
    assert.deepEqual(g.adapters, ["claude-code"]);
    assert.ok(!g.nodes.has("contract:standup") && !g.nodes.has("config:tidy.json"));
    assert.deepEqual(board(root).uses, []);
  } finally { process.env.FREE_REIN_PLUGINS = [TIDY, BROKEN].join(":"); }
});

test("what a plugin says is its own is credited to it, wherever its config puts it", () => {
  const root = tidyHarness();
  fs.writeFileSync(path.join(root, ".claude", "tidy.json"), JSON.stringify({ notes: "journal" }, null, 2) + "\n");
  for (const n of ["a", "b", "c"]) write(root, `journal/${n}.md`, `# ${n}\n`);
  const S = board(root).stack, p = S.levels.find((l: any) => l.id === "project");
  const kb = p.gives.find((g: any) => g.piece === "knowledge-base");
  assert.ok(kb && kb.files.includes("journal"), "its notes folder, at the path its config names");
  assert.ok(p.from.some((f: any) => f.name === "tidy"), "credited to Tidy, not to you");
  assert.ok(S.packages.some((x: any) => x.name === "tidy" && x.pieces.includes("knowledge-base")));
});
