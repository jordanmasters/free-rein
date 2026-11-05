// Trying a package: installed on a copy, read again, the real folder untouched.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { board } from "../../src/report/board";
import { catalog, installedBy } from "../../src/write/packages";
import { create } from "../../src/write/drafts";
import { tmpdir, write, FIXTURES } from "../helpers";

// a framework with a Free Rein plugin: Tidy, the sample plugin (samples/plugins/tidy.js)
process.env.FREE_REIN_PLUGINS = path.join(FIXTURES, "plugins", "tidy.js");
const CAT: Record<string, any> = Object.fromEntries(catalog().map(p => [p.id, p]));

function plain() {
  const d = tmpdir("free-rein-test-plain-");
  write(d, "CLAUDE.md", "# Plain\n\nA small app. Run tests with npm test.\n");
  const r = spawnSync("git", ["init", "-q", d]);
  assert.equal(r.status, 0);
  return d;
}

const theirs = (b: any, pkg: string | null) =>
  b.slots.flatMap((s: any) => s.types.flatMap((t: any) => t.inst)).filter((x: any) => (x.pkg ?? null) === pkg);

test("trying: a framework (through its plugin) on a plain repo", () => {
  const d = plain();
  const before = fs.readdirSync(d).sort();
  const a = board(d), b = board(d, { add: ["tidy"] });
  assert.deepEqual(fs.readdirSync(d).sort(), before, "nothing in the real folder changes");
  assert.deepEqual(b.tried, ["tidy"]);
  assert.deepEqual(b.uses, ["tidy"], "the draft's harness uses it");
  assert.ok(b.progression.xp > a.progression.xp, `${a.progression.xp} -> ${b.progression.xp}`);
  assert.ok(theirs(b, "tidy").length, "what its installer wrote counts as its own");
  assert.deepEqual(theirs(b, "tidy").filter((x: any) => x.path && x.path.includes("free-rein-plan-")), [], "no paths into the copy");
});

test("trying: a plugin loads only in claude code", { skip: "hookify" in CAT ? false : "the hookify plugin isn't on this machine" }, () => {
  const d = plain();
  const b = board(d, { add: ["hookify"] });
  const own = theirs(b, "hookify");
  assert.ok(own.length && own.every((x: any) => x.path === null || x.path.startsWith(CAT.hookify.path)),
    "a plugin's pieces open the plugin's own files");
  assert.deepEqual(theirs(b, null).filter((x: any) => x.label === "permissions:project-settings"), [], "your settings.json stays yours");
  const c0 = board(d, { runtime: "codex" }), c1 = board(d, { runtime: "codex", add: ["hookify"] });
  assert.equal(c0.progression.xp, c1.progression.xp, "Codex doesn't load Claude Code plugins");
});

test("installed by: what a framework's installer put here is the framework's", () => {
  const d = path.join(tmpdir("free-rein-test-inst-"), "h");
  create(d, [], ["tidy"]);
  fs.appendFileSync(path.join(d, "notes", "README.md"), "\nMy own line.\n");
  fs.writeFileSync(path.join(d, "NOTES.md"), "mine\n");
  const got = installedBy(d);
  assert.deepEqual(got[".claude/tidy.json"], { pkg: "tidy", changed: false }, "untouched: Tidy's");
  assert.ok(got["notes/README.md"].changed, "edited since: Tidy's, changed by you");
  assert.ok(got["notes"].changed);
  assert.ok(!("NOTES.md" in got), "a file no package put here is yours");
  assert.deepEqual(installedBy(CAT.tidy.path), {}, "the framework's own repo is the framework itself, not a package in it");
});
