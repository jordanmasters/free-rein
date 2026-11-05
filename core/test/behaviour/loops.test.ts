// How it checks: each loop's verdict from the pieces as they stand, and what's wrong with each.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { loops } from "../../src/judge/loops";

// pieces by id: on (with a file of its own, or only the runtime's), or off
const mine = (path = "x") => ({ state: "yes", found: [{ path, lines: [1] }], instances: [path] });
const builtIn = () => ({ state: "partial", found: [], instances: [] });
const v = (items: Record<string, any>, id: string) => loops(items).loops.find(l => l.id === id)!.verdict;

test("a done check that blocks earns its stop; with nothing, the agent decides", () => {
  assert.equal(v({ "completion-check": mine(".claude/hooks/done.sh"), "check-commands": mine() }, "task"), "earned");
  assert.equal(v({}, "task"), "self-declared");
  assert.equal(v({ criteria: mine() }, "task"), "self-declared");
});

test("a reviewer that only reports checks but doesn't send back; a person where a command would do is over-checked", () => {
  assert.equal(v({ "independent-checker": mine() }, "task"), "no-send-back");
  assert.equal(v({ "human-gate": mine(), "check-commands": mine() }, "task"), "over-checked");
});

test("long runs with no limit are runaway; the runtime merely able to loop isn't", () => {
  assert.equal(v({ "autonomous-runs": mine() }, "run"), "runaway");
  assert.equal(v({ "autonomous-runs": mine(), "spend-limits": mine(), "completion-check": mine() }, "run"), "earned");
  assert.equal(v({ "autonomous-runs": builtIn() }, "run"), "none");
});

test("each finding names its fix and the piece that makes it, at the loop's place", () => {
  const f = loops({ criteria: mine("vault/criteria.md") }).findings[0];
  assert.deepEqual([f.verdict, f.upgrade, f.draft, f.place && f.place.path], ["self-declared", "completion-check", true, "vault/criteria.md"]);
});

test("each place a per-task loop runs is an instance: an approval covers its step, a step that writes with none decides for itself", () => {
  const step = (id: string, gate: string | null, writes: string[]) => ({ id, name: id, gate, writes, place: null });
  const flow = { steps: [step("draft", "you approve", ["vault"]), step("park", null, ["tasks.md"]), step("ask", null, [])], handoffs: [] };
  const task = loops({ "human-gate": mine() }, flow).loops.find(l => l.id === "task")!;
  assert.deepEqual(task.instances.map(i => [i.id, i.check && i.check.who, i.verdict, i.steps]),
    [["approve", "person", "earned", ["draft"]], ["self", null, "self-declared", ["park"]], ["reads", null, "none", ["ask"]]]);
  assert.equal(task.verdict, "self-declared");
  assert.equal(loops({}, { steps: [flow.steps[0], flow.steps[2]], handoffs: [] }).loops.find(l => l.id === "task")!.verdict, "earned", "every writer waits for you");
  // a done check covers every task, so no step decides for itself
  const cc = loops({ "completion-check": mine(".claude/hooks/done.sh") }, flow).loops.find(l => l.id === "task")!;
  assert.deepEqual(cc.instances.map(i => [i.id, i.all]), [["done:done.sh", true], ["approve", false]]);
});

test("every harness has the agent loop at action scope; a step that sends work back makes a loop across two steps", () => {
  const act = loops({}).loops.find(l => l.id === "edit")!;
  assert.deepEqual([act.scope, act.present, act.instances[0].id, act.instances[0].runtime, act.verdict], ["action", true, "agent", true, "self-declared"]);
  assert.equal(loops({ "auto-fix": mine(".claude/settings.json") }).loops.find(l => l.id === "edit")!.verdict, "earned");
  const step = (id: string) => ({ id, name: id, gate: null, writes: [], place: null });
  const task = loops({}, { steps: [step("build"), step("review")], handoffs: [{ from: "review", to: "build", back: true, text: "If it fails, send it back" }] }).loops.find(l => l.id === "task")!;
  const across = task.instances.find(i => i.pair)!;
  assert.deepEqual([across.scope, across.pair, across.check!.who, across.verdict], ["step", ["build", "review"], "model", "earned"]);
});
