// Each skill is hardened its own way: what it needs follows what it does; gaps are what it needs and lacks.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import { skills } from "../../src/judge/hardening";
import { tmpdir, write } from "../helpers";

function runOn(files: Record<string, string>, settings?: any): Record<string, any> {
  const root = tmpdir(), home = tmpdir("free-rein-home-");
  try {
    for (const [rel, text] of Object.entries(files)) write(root, rel, text);
    if (settings) write(root, ".claude/settings.json", JSON.stringify(settings));
    return Object.fromEntries(skills(root, home).items.map((i: any) => [i.name, i]));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("a named-only lookup needs nothing", () => {
  const it = runOn({ ".claude/skills/lookup/SKILL.md": "---\nname: lookup\ndescription: Look up a term in the glossary and say what it means\ndisable-model-invocation: true\n---\nRead glossary.md.\n" }).lookup;
  assert.deepEqual(it.gaps, []);
  assert.ok("on-request" in it.has);
});

test("running commands needs limits", () => {
  const it = runOn({ ".claude/skills/ship/SKILL.md": "---\nname: ship\ndescription: Build and publish the package to the registry\n---\nRun `npm publish` when the build passes.\n" }).ship;
  assert.ok(it.need.includes("limited"));
  assert.ok(it.gaps.includes("limited"));
});

test("disallowed-tools limits and allowed-tools does not", () => {
  const lim = runOn({ ".claude/skills/ship/SKILL.md": "---\nname: ship\ndescription: Build and publish the package to the registry\ndisallowed-tools: WebFetch\n---\nRun `npm publish`.\n" }).ship;
  assert.ok("limited" in lim.has);
  const grant = runOn({ ".claude/skills/ship/SKILL.md": "---\nname: ship\ndescription: Build and publish the package to the registry\nallowed-tools: Bash(npm publish:*)\n---\nRun `npm publish`.\n" }).ship;
  assert.ok(!("limited" in grant.has));
  assert.ok("grants" in grant.does);
});

test("a short description is an issue", () => {
  const it = runOn({ ".claude/skills/x/SKILL.md": "---\nname: x\ndescription: does x\n---\nDo x.\n" }).x;
  assert.ok(it.issues.some((i: string) => i.includes("short description")));
});

test("a hook that checks skills covers them all", () => {
  const out = runOn({ ".claude/skills/a/SKILL.md": "---\nname: a\ndescription: Summarise the open tasks for the week ahead\n---\nRead tasks.\n",
    "scripts/check-skills.sh": "#!/bin/sh\nnpx free-rein check .\n" },
  { hooks: { Stop: [{ hooks: [{ type: "command", command: "scripts/check-skills.sh" }] }] } });
  assert.ok("checked" in out.a.has);
});
