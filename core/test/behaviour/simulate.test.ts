// The dry run: steps played through a harness, rules read, hooks optionally run on a copy.
import { describe, test, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as drafts from "../../src/write/drafts";
import { simulate } from "../../src/judge/simulate";
import { tmpdir } from "../helpers";

const STEPS = [{ kind: "edit", target: "src/app.ts" }, { kind: "edit", target: ".env" },
  { kind: "command", target: "npm test" }, { kind: "done" }];

describe("DryRun", () => {
  let tmp: string, root: string;
  before(() => {
    tmp = tmpdir("free-rein-test-sim-");
    root = path.join(tmp, "h");
    drafts.create(root, ["hard-gate", "completion-check", "proj-instructions"]);
  });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("reading the rules runs nothing", () => {
    const r = simulate(root, STEPS);
    const env = r.steps[1];
    assert.notEqual(env.outcome, "blocked", "without running hooks, Free Rein doesn't claim the hook refuses");
    assert.ok(env.why.some((w: any) => w.what.includes("could refuse it")));
    assert.equal(r.steps[3].outcome, "checked", "a completion check is in place");
  });

  test("running hooks observes the block", () => {
    const beforeFiles = fs.readdirSync(root).sort();
    const r = simulate(root, STEPS, "claude", true);
    const env = r.steps[1], app = r.steps[0];
    assert.equal(env.outcome, "blocked");
    assert.ok(env.why.some((w: any) => w.observed && (w.says ?? "").includes(".env is protected")));
    assert.notEqual(app.outcome, "blocked");
    assert.deepEqual(fs.readdirSync(root).sort(), beforeFiles, "hooks ran on a copy");
  });

  test("a deny rule blocks", () => {
    const p = path.join(root, ".claude", "settings.json");
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    (s.permissions ??= {}).deny = ["Bash(rm -rf:*)"];
    fs.writeFileSync(p, JSON.stringify(s));
    const r = simulate(root, [{ kind: "command", target: "rm -rf build" }, { kind: "command", target: "npm test" }]);
    assert.equal(r.steps[0].outcome, "blocked");
    assert.notEqual(r.steps[1].outcome, "blocked");
  });
});
