// Trust and friction as situations: what the agent does, what's at stake, what happens, and what decides it.
import { describe, test, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as board from "../../src/report/board";
import * as drafts from "../../src/write/drafts";
import { evaluate } from "../../src/judge/evaluate";
import * as oversight from "../../src/judge/oversight";
import * as simulate from "../../src/judge/simulate";
import { tmpdir } from "../helpers";

const sit = (o: any, what: string) => o.situations.find((s: any) => s.what === what);

// (stakes, outcome) -> verdict, from the module's own table
const VERDICT: Record<string, string> = Object.fromEntries(Object.entries(oversight.VERDICT).map(([k, v]) => [k, v[0]]));

const measure = (root: string, mode = "auto") => {
  const a = evaluate(root, { count_home: false, runtime: "claude" });
  return oversight.measure(root, a, "claude", mode);
};

describe("Situations", () => {
  let tmp: string, plain: string, gated: string, savedHome: string | undefined;
  before(() => {
    tmp = tmpdir("free-rein-test-ov-");
    plain = path.join(tmp, "plain");
    gated = path.join(tmp, "gated");
    // no real history in the test folders, and none from this machine's home
    savedHome = process.env.HOME;
    process.env.HOME = tmp;
    drafts.create(plain, ["proj-instructions"]);
    drafts.create(gated, ["hard-gate", "completion-check", "permissions", "proj-instructions"]);
  });
  after(() => {
    process.env.HOME = savedHome;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test("the verdict follows from stakes and what happens", () => {
    const o = measure(plain);
    assert.equal(sit(o, "Edit a source file").verdict, "ok");
    assert.equal(sit(o, "Force push: rewrite shared history").verdict, "classifier");
    assert.equal(sit(o, "Read secrets").verdict, "exposed", "Read runs without asking");
    for (const s of o.situations)
      assert.equal(s.verdict, VERDICT[`${oversight.HIGH.has(s.stakes) ? "high" : "everyday"}|${s.outcome}`]);
  });

  test("manual mode babysits everyday work and suggests allowing it", () => {
    const o = measure(plain, "manual");
    const e = sit(o, "Edit a source file");
    assert.equal(e.verdict, "babysitting");
    assert.equal(e.fix.how, "allow");
    assert.equal(sit(o, "Push").verdict, "good", "high stakes that ask you is good friction");
  });

  test("what decides it is a piece with a file", () => {
    const o = measure(gated);
    const env = sit(o, "Edit secrets");
    assert.equal(env.verdict, "held");
    assert.ok(env.by.map((b: any) => b.piece).includes("hard-gate"));
    const push = o.situations.find((s: any) => s.key === "git push");
    assert.ok(push.sources.includes("checklist"), "the rule and the checklist's push are one situation");
    assert.equal(push.outcome, "asks");
    const b = push.by.find((b: any) => b.piece === "permissions");
    assert.ok(b.path.endsWith("settings.json") && b.line);
    assert.ok(o.pieces.permissions.decides.map((d: any) => d.id).includes(push.id));
  });

  test("the harness rules are situations", () => {
    const o = measure(gated);
    assert.ok(o.situations.some((s: any) => s.sources.includes("rule")));
  });

  test("a hook with no way to refuse doesn't count", () => {
    const d = fs.mkdtempSync(path.join(tmp, "hook-"));
    const p = path.join(d, "log.sh");
    fs.writeFileSync(p, "#!/bin/bash\necho logged >> /tmp/x\nexit 0\n");
    assert.equal(oversight.canRefuse(p, d), false);
    fs.writeFileSync(p, "#!/bin/bash\n[ -f x ] && exit 2\nexit 0\n");
    assert.equal(oversight.canRefuse(`"${p}"`, d), true);
  });

  test("history is counted from transcripts", () => {
    const d = oversight.historyDir(plain)!;
    fs.mkdirSync(d, { recursive: true });
    const rows = [{ message: { content: [{ type: "tool_use", name: "Bash", input: { command: "cd x && npm test && git push --force" } }] } },
      { message: { content: [{ type: "tool_use", name: "Bash", input: { command: "python3 - <<'EOF'\nimport os\nEOF" } }] } },
      { message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: path.join(plain, ".env") } }] } }];
    fs.writeFileSync(path.join(d, "s1.jsonl"), rows.map(r => JSON.stringify(r)).join("\n"));
    oversight.resetCaches();
    try {
      const o = measure(plain);
      assert.equal(o.history!.actions, 4);
      assert.equal(sit(o, "Force push: rewrite shared history").count, 1);
      assert.equal(sit(o, "Edit secrets").count, 1);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
      oversight.resetCaches();
    }
  });

  test("done is its own section", () => {
    assert.ok(!measure(plain).situations.some((s: any) => s.what.startsWith("Say")));
    assert.ok(measure(gated).done.stops);
  });

  test("the board carries it and a draft moves it", () => {
    const b = board.board(plain, { ups: ["hard-gate"] });
    assert.deepEqual(b.oversight.modes.map((m: any) => m.id), ["auto", "manual"]);
    const env = sit(b.oversight.by_mode.auto, "Edit secrets");
    assert.equal(b.draft.reality.ov.auto[env.id], "classifier");
    assert.equal(env.verdict, "held");
  });

  test("your call is a narrow rule", () => {
    const o = measure(plain);
    assert.equal(sit(o, "Throw away uncommitted changes").calls.ask.rule, "Bash(git reset --hard:*)", "not every git reset");
    assert.equal(sit(o, "Force push: rewrite shared history").calls.never.rule, "Bash(git push --force:*)", "not every push");
    assert.equal(sit(o, "Edit secrets").call, "let");
  });

  test("a call in the draft is measured and written", () => {
    const rules = [{ kind: "ask", rule: "Bash(git reset --hard:*)" }, { kind: "deny", rule: "Edit(.env)" }];
    const b = board.board(plain, { rules });
    const o = b.oversight.by_mode.auto;
    assert.equal(sit(o, "Throw away uncommitted changes").verdict, "good");
    assert.equal(sit(o, "Edit secrets").verdict, "held");
    assert.equal(sit(o, "Run the tests").verdict, "ok", "everyday work isn't caught by it");
    assert.deepEqual(b.draft.rules, rules);
    const e = drafts.edits(plain, [], rules);
    assert.deepEqual(e.edits.map((x: any) => x.rel), [".claude/settings.json"]);
    const afterJson = JSON.parse(e.edits[0].after);
    assert.ok(afterJson.permissions.ask.includes("Bash(git reset --hard:*)"));
    assert.ok(afterJson.permissions.deny.includes("Edit(.env)"));
  });

  test("the reins count what goes without you", () => {
    const o = measure(plain);
    for (const w of o.reins) {
      const xs = o.situations.filter((s: any) => s.stakes === w.id);
      assert.equal(w.alone, xs.filter((s: any) => ["ahead", "classifier"].includes(s.outcome)).length);
    }
  });

  test("situations covered earn xp", () => {
    const o = measure(plain);
    const b = board.board(plain, { rules: [{ kind: "ask", rule: "Bash(git reset --hard:*)" }] });
    const afterXp = b.oversight.by_mode.auto.xp;
    assert.equal(o.xp, o.situations.filter((s: any) => s.accounted).reduce((n: number, s: any) => n + (oversight.HIGH.has(s.stakes) ? 15 : 5), 0));
    assert.equal(afterXp - b.draft.reality.sxp.auto, 15, "one high-stakes situation now covered");
  });

  test("a profile is read from its pieces", () => {
    const o = board.board(null, { profile: "claude" }).oversight;
    assert.deepEqual(o.modes, []);
    assert.equal(o.by_mode.auto.measured, "pieces");
  });
});

// Each layer is measured as if the harness were only that layer: its own situations, tiers and level.
describe("Layers", () => {
  let tmp: string, gated: string, b: any, savedHome: string | undefined;
  before(() => {
    tmp = tmpdir("free-rein-test-layers-");
    gated = path.join(tmp, "gated");
    savedHome = process.env.HOME;
    process.env.HOME = tmp;
    drafts.create(gated, ["hard-gate", "completion-check", "permissions", "proj-instructions"]);
    b = board.board(gated);
  });
  after(() => {
    process.env.HOME = savedHome;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test("every layer has its own situations", () => {
    const L = b.layers;
    for (const k of ["base", "packages", "project", "home", "yours"]) {
      assert.ok("situations" in L[k], k);
      assert.ok("auto" in L[k].situations, k);
    }
  });

  test("the runtime alone decides nothing of yours", () => {
    const base = b.layers.base.situations.auto;
    assert.equal(base.xp, 0);
    assert.equal(base.summary.accounted, 0);
    assert.ok(!Object.values(base.by).some((s: any) => s.by.some((x: any) => x.piece)), "no rule or hook of yours decides anything");
  });

  test("your files are what account for situations", () => {
    const L = b.layers;
    assert.ok(L.project.situations.auto.xp > 0);
    assert.equal(L.yours.situations.auto.xp, b.oversight.by_mode.auto.xp);
    assert.equal(L.yours.progression.xp_total, b.progression.xp_total);
  });

  test("a layer without a piece earns no tier for it, the layer's level", () => {
    assert.ok(b.layers.base.progression.xp_total < b.progression.xp_total);
  });

  test("a layer without a piece earns no tier for it, tier xp", () => {
    const a = evaluate(gated, { runtime: "claude", layer: "base" });
    const items = a.slots.flatMap((s: any) => s.items);
    const absent = items.find((i: any) => i.state === "no");
    const present = items.find((i: any) => i.state === "yes");
    const full = { reached: 3, of: 3 };
    const tierXp = board.tierXp;
    assert.equal(tierXp(a, { [absent.id]: full }), 0);
    assert.ok(tierXp(a, { [present.id]: full }) > 0);
  });

  test("measuring a layer leaves the readers seeing everything", () => {
    assert.equal(simulate.state.LAYER, "yours");
  });
});

test("a decision log is high stakes wherever it sits: decisions/ at the top, or under a folder", () => {
  for (const t of ["decisions/note.md", "docs/decisions/0001.md", "vault/tracking/decisions.md"]) assert.equal(oversight.stakesOf("Edit", t), "knowledge", t);
  assert.equal(oversight.stakesOf("Edit", "src/indecisions.ts"), "everyday");
});
