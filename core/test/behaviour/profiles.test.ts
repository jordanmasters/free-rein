// Out-of-the-box profiles: valid, sourced, and readable as a board.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { board } from "../../src/report/board";
import { evaluate } from "../../src/judge/evaluate";
import * as runtimes from "../../src/read/runtimes";
import { home } from "../../src/read/home";
import { load } from "../../src/read/spec";
import { REPO, copyFixture, inTemp, write } from "../helpers";

const FREE_REIN = REPO;
const SPEC = load();   // pieces.json plus runtimes/*.json
const PIECES = SPEC.slots.reduce((n: number, s: any) => n + s.items.length, 0);
const PROFILES: any[] = JSON.parse(fs.readFileSync(path.join(FREE_REIN, "model", "profiles.json"), "utf8")).profiles;
const PROJECTS = path.dirname(FREE_REIN);
// a repo with files for several runtimes: the kitchen sample, copied
const KITCHEN = copyFixture("kitchen");
// evaluate.LAYERS in Python; the TypeScript core doesn't export it
const LAYERS = ["base", "packages", "yours"];

// Profiles
test("profiles: entries are valid and sourced", async t => {
  const ids = new Set(SPEC.slots.flatMap((s: any) => s.items.map((i: any) => i.id)));
  for (const p of PROFILES) {
    await t.test(p.id, () => {
      assert.ok(["runtime", "product", "reference", "example"].includes(p.kind));
      assert.ok(p.checked_on);
      if (["runtime", "reference", "example"].includes(p.kind))
        assert.ok((p.core ?? p.id) in SPEC.cores, "a runtime profile has a runtime in pieces.json");
      const seen = new Set<string>();
      for (const e of p.ships) {
        assert.ok(ids.has(e.type));
        assert.ok(!seen.has(e.type), "one entry per type");
        seen.add(e.type);
        assert.ok([0, 1, 2, 3].includes(e.ships));
        // vendor claims cite docs; reference designs and examples are Free Rein's own, and say so
        assert.ok(e.note && (e.source.startsWith("https://") || (p.kind === "reference" && e.source === "reference")
          || (p.kind === "example" && e.source === "example")), JSON.stringify(e));
      }
    });
  }
});

test("profiles: every profile reads as a board", async t => {
  for (const p of PROFILES) {
    await t.test(p.id, () => {
      const b = board(null, { profile: p.id });
      assert.equal(b.slots.reduce((n: number, s: any) => n + s.types.length, 0), PIECES);
      assert.ok(b.name.includes(({ reference: "chatbot", example: "Example" } as any)[p.kind] ?? "out of the box"));
      for (const s of b.slots)
        for (const ty of s.types)
          assert.deepEqual(ty.inst, [], "a profile has nothing of yours");
      assert.ok(b.progression.xp >= 0);
    });
  }
});

// Runtimes
test("runtimes: each runtime reads its own files", () => {
  const r = "/repo";
  assert.ok(runtimes.visible("/repo/.claude/settings.json", r, "claude"));
  assert.ok(!runtimes.visible("/repo/.claude/settings.json", r, "codex"));
  assert.ok(runtimes.visible("/repo/.agents/skills/x/SKILL.md", r, "codex"));
  assert.ok(!runtimes.visible("/repo/.agents/skills/x/SKILL.md", r, "claude"));
  assert.ok(runtimes.visible("/repo/vault/decisions.md", r, "codex"), "shared files count everywhere");
  assert.ok(runtimes.visible("/repo/.github/copilot-instructions.md", r, "copilot"));
  assert.ok(!runtimes.visible("/repo/.github/copilot-instructions.md", r, "gemini"));
  assert.ok(runtimes.visible("/repo/anything", r, "open"), "your own loop reads what you wire");
});

test("runtimes: Cursor reads CLAUDE.md and Claude Code's skills, not its rules or settings", () => {
  const r = "/repo";
  assert.ok(runtimes.visible("/repo/CLAUDE.md", r, "cursor"));
  assert.ok(runtimes.visible("/repo/sub/CLAUDE.md", r, "cursor"));
  assert.ok(runtimes.visible(path.join(home(), ".claude", "skills", "x", "SKILL.md"), r, "cursor"));
  assert.ok(!runtimes.visible("/repo/.claude/rules/x.md", r, "cursor"));
  assert.ok(!runtimes.visible("/repo/.claude/settings.json", r, "cursor"), "its permission rules are Claude Code's alone");
});

test("runtimes: Copilot reads the root CLAUDE.md files, but not subfolders' or Claude Code's hooks", () => {
  const r = "/repo";
  for (const p of ["/repo/CLAUDE.md", "/repo/.claude/CLAUDE.md", "/repo/CLAUDE.local.md", path.join(home(), ".claude", "CLAUDE.md")])
    assert.ok(runtimes.visible(p, r, "copilot"), p);
  assert.ok(!runtimes.visible("/repo/sub/CLAUDE.md", r, "copilot"));
  assert.ok(!runtimes.visible("/repo/.claude/settings.json", r, "copilot"), "VS Code runs them only when chat.useClaudeHooks is on");
  assert.equal(runtimes.CLAUDE_HOOKS.copilot, undefined);
});

test("runtimes: Cursor runs the hooks Claude Code's settings register", () => {
  const state = (rt: string, id: string) => evaluate(KITCHEN, { runtime: rt }).slots.flatMap((s: any) => s.items).find((i: any) => i.id === id).state;
  for (const id of ["completion-check", "hard-gate"]) assert.equal(state("cursor", id), state("claude", id), id);
  assert.equal(state("codex", "completion-check"), "no", "a runtime that ignores Claude Code's settings runs none of its hooks");
});

test("runtimes: Cursor counts what it does with Claude Code's files, not what only Claude Code does", () => {
  const item = (rt: string, id: string) => evaluate(KITCHEN, { runtime: rt }).slots.flatMap((s: any) => s.items).find((i: any) => i.id === id);
  assert.deepEqual(item("cursor", "live-injection").instances, ["sig:session-start:project"], "a SessionStart hook, not CLAUDE.md's compact instructions");
  assert.ok(item("claude", "folder-instructions").instances.includes("sig:folder-instructions:imports"));
  assert.ok(!item("cursor", "folder-instructions").instances.includes("sig:folder-instructions:imports"), "an @path in CLAUDE.md is only a pointer to Cursor");
  assert.ok(!item("cursor", "notifications").instances.includes("sig:notifications:project"), "Cursor doesn't run Notification hooks");
});

test("runtimes: Cursor loads skills from every home skill folder it knows", () => {
  inTemp((root, h) => {
    write(root, "CLAUDE.md", "# App\n");
    for (const dir of [".cursor", ".agents", ".claude", ".codex"])
      write(h, `${dir}/skills/from${dir.slice(1)}/SKILL.md`, `---\nname: from${dir.slice(1)}\ndescription: Use when testing.\n---\n1. Test.\n`);
    const skills = (rt: string) => (evaluate(root, { runtime: rt }).home.skills ?? []).map((x: any) => x.label).sort();
    assert.deepEqual(skills("cursor"), ["fromagents", "fromclaude", "fromcodex", "fromcursor"]);
    assert.deepEqual(skills("claude"), ["fromclaude"]);
  });
});

test("runtimes: Copilot CLI reads its own folders and Claude Code's, but not VS Code's", () => {
  const r = "/repo";
  for (const p of ["/repo/CLAUDE.md", "/repo/GEMINI.md", "/repo/.claude/rules/x.md", "/repo/.claude/commands/x.md", "/repo/.github/mcp.json",
    "/repo/.github/copilot/settings.json", path.join(home(), ".copilot", "skills", "x", "SKILL.md")])
    assert.ok(runtimes.visible(p, r, "copilot-cli"), p);
  for (const p of ["/repo/.vscode/mcp.json", "/repo/CLAUDE.local.md", "/repo/sub/CLAUDE.md", path.join(home(), ".claude", "skills", "x", "SKILL.md")])
    assert.ok(!runtimes.visible(p, r, "copilot-cli"), p);
  assert.equal(runtimes.coreOf("copilot-cli"), "copilot");
});

test("runtimes: Copilot CLI runs the repo's Claude Code hooks, not your home folder's", () => {
  const r = "/repo", user = path.join(home(), ".claude", "settings.json");
  assert.ok(runtimes.runsClaudeHook("copilot-cli", "/repo/.claude/settings.json", "PreToolUse", r));
  assert.ok(runtimes.runsClaudeHook("copilot-cli", "/repo/.claude/settings.local.json", "Stop", r));
  assert.ok(!runtimes.runsClaudeHook("copilot-cli", user, "PreToolUse", r));
  assert.ok(runtimes.runsClaudeHook("cursor", user, "PreToolUse", r));
  assert.ok(!runtimes.runsClaudeHook("copilot-cli", "/repo/.claude/settings.json", "Notification", r));
  assert.ok(!runtimes.runsClaudeHook("copilot", "/repo/.claude/settings.json", "PreToolUse", r));
  const item = (rt: string, id: string) => evaluate(KITCHEN, { runtime: rt }).slots.flatMap((s: any) => s.items).find((i: any) => i.id === id);
  for (const id of ["completion-check", "hard-gate"]) assert.equal(item("copilot-cli", id).state, item("claude", id).state, id);
  assert.ok(item("copilot-cli", "folder-instructions").instances.includes("sig:folder-instructions:imports"), "the CLI inlines @path imports");
});

test("runtimes: Copilot CLI loads skills from ~/.copilot and ~/.agents, not ~/.claude", () => {
  inTemp((root, h) => {
    write(root, "AGENTS.md", "# App\n");
    for (const dir of [".copilot", ".agents", ".claude"])
      write(h, `${dir}/skills/from${dir.slice(1)}/SKILL.md`, `---\nname: from${dir.slice(1)}\ndescription: Use when testing.\n---\n1. Test.\n`);
    assert.deepEqual((evaluate(root, { runtime: "copilot-cli" }).home.skills ?? []).map((x: any) => x.label).sort(), ["fromagents", "fromcopilot"]);
  });
});

test("runtimes: the same repo differs by runtime", () => {
  const xp: Record<string, number> = Object.fromEntries(["claude", "codex", "copilot"].map(rt => [rt, evaluate(KITCHEN, { runtime: rt }).progression.xp]));
  assert.equal(new Set(Object.values(xp)).size, 3, JSON.stringify(xp));
});

test("runtimes: layers stack", async t => {
  for (const rt of ["claude", "codex"]) {
    await t.test(rt, () => {
      const xs: number[] = LAYERS.map(l => evaluate(KITCHEN, { runtime: rt, layer: l }).progression.xp);
      assert.deepEqual(xs, [...xs].sort((a, b) => a - b), `base ≤ packages ≤ yours: ${JSON.stringify(xs)}`);
      const base = evaluate(KITCHEN, { runtime: rt, layer: "base" });
      const prof = evaluate(null, { profile: rt });
      assert.equal(base.progression.xp, prof.progression.xp, "the base layer is the runtime's profile");
    });
  }
});

test("runtimes: the six supported are offered as the base; the others stay in model/runtimes/, unoffered", () => {
  const b = board(KITCHEN, { runtime: "copilot" });
  assert.deepEqual(b.bases.map((x: any) => x.id).sort(), ["claude", "codex", "copilot", "cursor", "gemini", "opencode"]);
  assert.equal(b.runtime.core, "copilot", "Copilot in VS Code uses Copilot's per-piece answers");
  assert.ok(!b.bases.some((x: any) => ["copilot-cloud", "grok", "pi", "omp", "open"].includes(x.id)), "not offered");
  assert.deepEqual(Object.keys(b.cores).sort(), ["claude", "codex", "copilot", "cursor", "gemini", "opencode"], "each piece's answers, for the six");
});

test("a lock shows who holds a piece, and how firmly", () => {
  const types = (prof: string) => board(null, { profile: prof }).slots.flatMap((s: any) => s.types);
  const held = (prof: string) => Object.fromEntries(types(prof).filter((t: any) => t.held)
    .map((t: any) => [t.id, t.held.map((h: any) => h.by + (h.soft ? " soft" : "")).join(",")]));
  assert.deepEqual(held("example-team"), { "managed-policy": "org" }, "the company's managed settings: held by your organization");
  const rt = Object.values(held("claude"));
  assert.ok(rt.length > 0 && rt.every(h => h === "vendor soft"), "what a runtime ships: built in, so you can switch it off (soft)");
});
