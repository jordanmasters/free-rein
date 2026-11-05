// How work flows: routes from the handoffs a harness's skills write, with the sentence that says when.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { flows } from "../../src/judge/flows";
import { FIXTURES } from "../helpers";

const harness = (skills: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "flows-"));
  for (const [name, body] of Object.entries(skills)) {
    fs.mkdirSync(path.join(root, ".claude", "skills", name), { recursive: true });
    fs.writeFileSync(path.join(root, ".claude", "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name}\n---\n\n${body}\n`);
  }
  return root;
};

test("a handoff keeps its condition; a line that only names a step isn't one", () => {
  const root = harness({
    research: "Do the research.\n\n- Note is mature → offer /thesis\n- Don't track tasks here, use /todo instead.",
    thesis: "Write the thesis.\n\nIf the decision is made, offer /decide.",
    decide: "Log the decision.", todo: "A task.",
  });
  const f = flows(root), h = (a: string, b: string) => f.handoffs.find(x => x.from === `unit:${a}` && x.to === `unit:${b}`);
  assert.equal(h("research", "thesis")!.when, "Note is mature");
  assert.equal(h("thesis", "decide")!.when, "If the decision is made");
  assert.equal(h("research", "todo"), undefined, "a mention is not a handoff");
  assert.deepEqual(f.routes.map(r => r.stops.map(s => s.step.replace("unit:", ""))), [["research", "thesis", "decide"]]);
});

test("the kitchen's done check is a check every task passes; a Stop hook that only logs isn't", () => {
  const f = flows(path.join(FIXTURES, "kitchen"));
  assert.deepEqual(f.stop_checks.map(c => c.name), ["done.sh"]);
});

test("a step that sends the work back on a failure is a loop across steps; an offer isn't", () => {
  const root = harness({
    build: "Build it, then offer /review.",
    review: "Review the change.\n\nIf the review fails, send it back to /build with the notes.\n\nRevise or re-rate as needed, then offer /ship.",
    ship: "Ship it.",
  });
  const f = flows(root), back = f.handoffs.filter(h => h.back).map(h => [h.from, h.to]);
  assert.deepEqual(back, [["unit:review", "unit:build"]]);
});
