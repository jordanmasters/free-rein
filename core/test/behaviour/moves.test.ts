// Moves: every problem the board finds becomes one move, merged when they fix the same thing, best first.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { moves } from "../../src/judge/moves";

const types = { "completion-check": { name: "Completion check", gap_xp: 35, change: { files: ["a", "b"] } }, "human-gate": { name: "Human approvals", gap_xp: 50 } };
const ov = (sits: any[]) => ({ set_mode: { mode: "auto" }, by_mode: { auto: { stakes: [{ id: "undo", name: "Hard to undo", high: true }, { id: "everyday", name: "Everyday", high: false }], situations: sits } } });
const sit = (id: string, stakes: string, outcome: string) => ({ id, stakes, outcome, what: id, key: id, fix: { rule: `Bash(${id})`, how: "ask", piece: "hard-gate" } });

test("a risky situation becomes a quick move; the same fix from a loop and a flow merges into one", () => {
  const m = moves({
    oversight: ov([sit("rm", "undo", "ahead"), sit("reset", "undo", "classifier"), sit("ls", "everyday", "ahead")]), said: null,
    loops: { findings: [{ title: "park writes on its own say-so", upgrade: "human-gate", draft: false, place: null }] },
    flows: { findings: [{ title: "park writes with no gate", step: "unit:park", place: null }] }, next: { "completion-check": ["backs Decide it's done"] },
  }, types, new Set(["completion-check"]));
  assert.deepEqual(m.map(x => [x.title, x.sources.join("+"), x.effort]), [
    ["Ask first: hard to undo", "situations", "quick"],
    ["Make park wait for you", "loops+flows", "larger"],
    ["Add a done check", "pieces", "quick"],
  ]);
  assert.equal(m[0].fix.rules.length, 2, "both risky actions in one move; the everyday one isn't a move");
  assert.equal(m[1].xp, 50);
});
