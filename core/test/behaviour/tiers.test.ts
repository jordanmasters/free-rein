// Tiers and what backs a rule: Equipped → Tuned → Enforced → Proven, and prose rules matched to what holds.
import { describe, test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as backing from "../../src/judge/backing";
import * as tiers from "../../src/judge/tiers";
import { load } from "../../src/read/spec";
import { tmpdir, write } from "../helpers";

const rule = (text: string, actions: string[], strength = "must-not") => ({ id: "x", kind: "rule", text, strength,
  source: { file: "CLAUDE.md", line: 1 }, about: actions.map(a => ({ action: a })) });

const sit = (target: string, outcome: string, piece: string | null = null) => ({ id: target, tool: "Bash", target, what: target,
  stakes: "outward", outcome, by: [{ piece, what: "" }] });

describe("Backing", () => {
  test("never force push backed by a deny rule", () => {
    const b = backing.back([rule("Never force push.", ["force-push"])], [sit("git push --force", "held", "permissions")])[0];
    assert.equal(b.backed, true);
  });

  test("left to Claude Code is not backed", () => {
    const b = backing.back([rule("Never force push.", ["force-push"])], [sit("git push --force", "classifier")])[0];
    assert.equal(b.backed, false);
  });

  test("never met by an ask is partly backed", () => {
    const b = backing.back([rule("Never force push.", ["force-push"])], [sit("git push --force", "asks", "permissions")])[0];
    assert.equal(b.backed, "partly");
  });

  test("ask before pushing is backed by an ask", () => {
    const b = backing.back([rule("Ask before pushing to main.", ["push"], "must")], [sit("git push", "asks", "permissions")])[0];
    assert.equal(b.backed, true);
  });

  test("an action nothing measures is unmeasured, not unbacked", () => {
    const b = backing.back([rule("Never amend a commit.", ["commit"])], [sit("git push", "held", "permissions")])[0];
    assert.equal(b.backed, null);
  });
});

// Python calls tiers.proj_instructions({}, {root, backing: []}) directly; the TypeScript core keeps it private,
// so it runs through tiers.evaluate on the proj-instructions piece alone, whose tiers carry each check's result.
describe("ProjectInstructions", () => {
  function check(text: string, imports: Record<string, string> = {}): any[] {
    const root = tmpdir();
    try {
      write(root, "CLAUDE.md", text);
      for (const [rel, t] of Object.entries(imports)) write(root, rel, t);
      const piece = load().slots.flatMap((s: any) => s.items).find((i: any) => i.id === "proj-instructions");
      const spec = { slots: [{ items: [piece] }] };
      const a = { slots: [{ items: [{ id: "proj-instructions", state: "yes" }] }] };
      return tiers.evaluate(spec, a, root, [], [])["proj-instructions"].tiers;
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }

  test("tuned under 200 lines with imports that resolve", () => {
    assert.ok(check("# Rules\n@docs/a.md\n", { "docs/a.md": "ok\n" })[1].ok);
  });

  test("a broken import is not tuned", () => {
    const c = check("# Rules\n@docs/missing.md\n")[1];
    assert.ok(!c.ok);
    assert.ok(c.missing[0].why.includes("doesn't exist"));
  });

  test("too long is not tuned", () => {
    assert.ok(!check("line\n".repeat(250))[1].ok);
  });

  test("no rules about actions says so", () => {
    assert.ok("note" in check("# About\nThis repo is a library.\n")[2]);
  });
});

// Python calls tiers._result(T, checks) directly; the TypeScript core keeps result() private, so it runs through
// tiers.evaluate on a skills piece whose checks come out as [ok, {ok: false, progress: [3, 5]}, ok].
describe("Result", () => {
  test("reaches the highest tier with every lower one held", () => {
    const root = tmpdir();
    try {
      const T = ["Equipped", "Tuned", "Enforced"].map(n => ({ name: n }));
      const its = ["a", "b", "c", "d", "e"].map((name, i) => ({ name, issues: i < 2 ? ["an issue"] : [], gaps: [], has: [] }));
      const spec = { slots: [{ items: [{ id: "skills", tiers: T }] }] };
      const a = { slots: [{ items: [{ id: "skills", state: "yes", profile: { items: its } }] }] };
      const r = tiers.evaluate(spec, a, root, [], [])["skills"];
      assert.deepEqual(r.tiers.map((t: any) => t.ok), [true, false, true], "the checks are the Python test's");
      assert.deepEqual([r.reached, r.name], [1, "Equipped"]);
      assert.deepEqual(r.next.progress, [3, 5]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
