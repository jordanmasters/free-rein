// Each piece added in the second version of the model (added: "model-v2") is found in a harness that has it, and not in one that doesn't.
// Uses a small fixture repo and an empty home, so it runs anywhere.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { extract, connectorsSeen } from "../../src/read/extract";
import { load } from "../../src/read/spec";
import { tmpdir, write, withHome } from "../helpers";

const SPEC = load();   // pieces.json plus runtimes/*.json
const NEW: string[] = SPEC.slots.flatMap((s: any) => s.items.filter((i: any) => i.added === "model-v2").map((i: any) => i.id));
// managed policy lives in a system folder, outside any fixture
const NOT_IN_FIXTURE = new Set(["managed-policy"]);

function kinds(root: string, home: string): Set<string> {
  const g = withHome(home, () => extract(root).toJson());
  return new Set(g.nodes.map((n: any) => String(n.kind ?? "")).filter((k: string) => k.startsWith("sig-")).map((k: string) => k.slice(4)));
}

const historyDir = (home: string, root: string) => path.join(home, ".claude", "projects", path.resolve(root).replace(/[^A-Za-z0-9]/g, "-"));

function fullFixture(root: string, home: string) {
  const settings = {
    permissions: { defaultMode: "plan", deny: ["Read(./.env)", "WebFetch"], allow: ["WebFetch(domain:github.com)"] },
    attribution: { commit: "Co-Authored-By: Claude" },
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "echo hi" }] }],
      PreCompact: [{ hooks: [{ type: "command", command: "echo keep" }] }],
      Notification: [{ hooks: [{ type: "command", command: "say waiting" }] }],
      Stop: [{ hooks: [{ type: "command", command: "git stash create" }] }],
      PostToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: "npx prettier --write ." }] }],
    },
    outputStyle: "Explanatory",
    enabledPlugins: { "typescript-lsp@claude-plugins-official": true, "team@ours": true },
    availableModels: ["sonnet", "opus"],
    env: { CLAUDE_CODE_ENABLE_TELEMETRY: "1" },
    statusLine: { type: "command", command: "show-cost.sh" },
  };
  write(root, ".claude/settings.json", JSON.stringify(settings));
  write(root, ".claude/settings.local.json", "{}");
  write(root, ".claude/commands/release.md", "Release it.\n");
  write(root, ".claude/skills/commit/SKILL.md", "---\nname: commit\n---\nCommit with the convention.\n");
  write(root, ".claude/skills/code-review/SKILL.md", "---\nname: code-review\n---\nReview the diff; report findings with a verdict.\n");
  write(root, ".claude/skills/accept/SKILL.md", "---\nname: accept\n---\nAsk the owner to sign off on the result.\n");
  write(root, ".claude/agents/searcher.md", "---\nname: searcher\nmodel: haiku\nmaxTurns: 10\n---\nSearch.\n");
  write(root, ".claude/rules/web.md", "Use the design tokens.\n");
  write(root, ".claude/output-styles/teach.md", "---\nname: teach\n---\n");
  write(root, "CLAUDE.md", "# Project\n\n- `docs/model.md` — start here.\n\n# Compact instructions\nKeep the decisions.\n");
  write(root, "docs/model.md", "The model.\n");
  write(root, "ARCHITECTURE.md", "The map.\n");
  write(root, "TODO.md", "- one\n");
  write(root, "ontology.md", "Kinds and relations.\n");
  write(root, "playwright.config.ts", "export default {}\n");
  write(root, "requirements.txt", "typesafe-sdk==0.4\n");
  write(root, ".env.example", "KEY=\n");
  write(root, ".mcp.json", JSON.stringify({ mcpServers: { playwright: {}, gmail: {}, linear: {}, memory: {} } }));
  write(root, ".github/workflows/claude.yml", "jobs:\n  r:\n    steps:\n      - uses: anthropics/claude-code-action@v1\n        with:\n          claude_args: --max-turns 5\n");
  write(root, ".claude-plugin/plugin.json", "{}");
  write(historyDir(home, root), "s1.jsonl", '{"note":"claude.ai Gmail needs authorization"}\n');
}

/** A temporary root and home, removed afterwards */
function inDirs<T>(fn: (root: string, home: string) => T): T {
  const root = tmpdir(), home = tmpdir("free-rein-home-");
  try { return fn(root, home); }
  finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
}

// NewPieces
test("new pieces: each new piece has a detector and an answer per core", () => {
  const items: Record<string, any> = Object.fromEntries(SPEC.slots.flatMap((s: any) => s.items.map((i: any) => [i.id, i])));
  assert.equal(NEW.length, 26);
  for (const pid of NEW) {
    const it = items[pid];
    assert.equal(it.detect[0].nodes.kind, `sig-${pid}`);
    for (const [core, ans] of Object.entries<any>(it.cores)) {
      const [, status, src] = ans;
      assert.ok([true, false, null].includes(status), `${pid} ${core}`);
      if (status !== null && core !== "open")
        assert.ok(src in SPEC.cores[core].sources, `${pid} ${core} ${src}`);
    }
  }
});

test("new pieces: found where present", () => {
  inDirs((root, home) => {
    fullFixture(root, home);
    const found = kinds(root, home);
    const missing = NEW.filter(p => !found.has(p) && !NOT_IN_FIXTURE.has(p));
    assert.deepEqual(missing, []);
    assert.ok(found.has("folder-instructions"));
  });
});

test("new pieces: absent from an empty repo", () => {
  inDirs((root, home) => {
    write(root, "README.md", "hello\n");
    const found = kinds(root, home);
    found.delete("managed-policy");
    assert.deepEqual([...found], []);
  });
});

test("new pieces: connectors off hides connected accounts", () => {
  inDirs((root, home) => {
    write(root, ".claude/settings.json", JSON.stringify({ disableClaudeAiConnectors: true }));
    write(historyDir(home, root), "s1.jsonl", '{"note":"claude.ai Gmail"}\n');
    assert.ok(!kinds(root, home).has("connected-accounts"));
  });
});

// Connectors
test("connectors: signed in only when its tools appear", () => {
  const t = ('The following MCP servers require authentication before their tools can be used:\\nclaude.ai Gmail\\nclaude.ai Google Drive\\n'
    + ' ... "name":"mcp__claude_ai_Claude_Docs__read" ...');
  assert.deepEqual(connectorsSeen([t]), { "Gmail": "not signed in", "Google Drive": "not signed in", "Claude Docs": "connected" });
});
