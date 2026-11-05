// Every template, applied to a copy of a harness, really puts its piece in place.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { isDeepStrictEqual } from "util";
import { plan, TEMPLATES, copyHarness } from "../../src/write/changes";
import { REPO, tmpdir, write, copyFixture, extraHarnesses } from "../helpers";

const PROJECTS = path.dirname(REPO);
// the kitchen and solo samples, and any real harnesses in FREE_REIN_TEST_HARNESSES
const HARNESSES = [copyFixture("kitchen"), copyFixture("solo"), ...extraHarnesses()];

function check(root: string) {
  for (const pid of Object.keys(TEMPLATES)) {
    const p = plan(root, pid);
    if (!p.template) continue;
    const at = `${path.basename(root)} ${pid}`;
    assert.ok(p.verified, `${at}: ${pid} isn't read as in place after its template`);
    assert.ok(p.effect.piece.to >= Math.max(2, p.effect.piece.from), at);
    for (const e of p.edits) {
      assert.ok(e.rel && !path.isAbsolute(e.rel), at);
      assert.notEqual(e.before, e.after, `${at}: ${e.rel} doesn't change`);
      if (e.rel.endsWith(".json")) JSON.parse(e.after);
    }
    assert.ok(p.request.includes(p.name), at);
  }
}

test("templates: empty folder", () => {
  const d = tmpdir();
  try { check(d); } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("templates: real harnesses", { skip: HARNESSES.length ? false : "no harnesses next to this repo" }, () => {
  for (const root of HARNESSES) check(root);
});

test("templates: planning leaves the harness alone", () => {
  const d = tmpdir();
  try {
    write(d, "CLAUDE.md", "# rules\n");
    for (const pid of Object.keys(TEMPLATES)) plan(d, pid);
    assert.deepEqual(fs.readdirSync(d).sort(), ["CLAUDE.md"]);
    assert.equal(fs.readFileSync(path.join(d, "CLAUDE.md"), "utf8"), "# rules\n");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("templates: settings merge keeps what is there", () => {
  const d = tmpdir();
  try {
    const mine = { model: "x", permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }] } };
    write(d, ".claude/settings.json", JSON.stringify(mine));
    for (const pid of ["hard-gate", "completion-check", "permissions"]) {
      const after = JSON.parse(plan(d, pid).edits.find((e: any) => e.rel.endsWith("settings.json"))!.after);
      assert.equal(after.model, "x");
      assert.ok(after.permissions.allow.includes("Bash(ls)"));
      assert.ok(after.hooks.Stop[0].hooks.some((h: any) => isDeepStrictEqual(h, { type: "command", command: "echo hi" })));
    }
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("templates: broken settings falls back to the agent", () => {
  const d = tmpdir();
  try {
    write(d, ".claude/settings.json", "{ not json");
    const p = plan(d, "hard-gate");
    assert.equal(p.template, false);
    assert.ok(p.request.includes("Blocking hooks"));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("a copy of the harness leaves secrets out, but keeps their templates", () => {
  const root = tmpdir();
  for (const f of [".env", ".env.local", "deploy/server.pem", "id_ed25519", ".npmrc", ".env.example", ".env.sample", "CLAUDE.md"]) write(root, f, "x");
  const [tmp, copy] = copyHarness(root);
  try {
    for (const f of [".env", ".env.local", "deploy/server.pem", "id_ed25519", ".npmrc"]) assert.ok(!fs.existsSync(path.join(copy, f)), `${f} was copied`);
    for (const f of [".env.example", ".env.sample", "CLAUDE.md"]) assert.ok(fs.existsSync(path.join(copy, f)), `${f} was left out`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
