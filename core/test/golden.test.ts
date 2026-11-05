// The core's own regression tests, with no Python: every stage's output on the solo and kitchen samples (the
// kitchen with its own home folder and session history) and on the example profiles, compared with outputs
// saved in test/golden/. Paths are written relative (<root>, <home>, <repo>), so they hold on any machine.
// After a deliberate change, look at the diff and refresh: FREE_REIN_GOLDEN=1 npm test
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { extract } from "../src/read/extract";
import { harness as statements } from "../src/read/statements";
import { models } from "../src/read/models";
import { lint } from "../src/judge/lint";
import { evaluate } from "../src/judge/evaluate";
import { board, profiles } from "../src/report/board";
import { document } from "../src/report/harness";
import { score } from "../src/report/score";
import { load } from "../src/read/spec";
import { plan, upgrades, TEMPLATES } from "../src/write/changes";
import { edits, create } from "../src/write/drafts";
import { simulate } from "../src/judge/simulate";
import { check, sarif, text } from "../src/report/check";
import { tmpdir, withHome, FIXTURES, REPO } from "./helpers";

const GOLDEN = path.join(REPO, "core", "test", "golden");
process.env.FREE_REIN_PLUGINS = "";       // no plugins from this machine: the catalog is Free Rein's own skills only

/** a path as the golden file keeps it: the sample's folder, its home and the repo by name */
function relative(x: any, swaps: [string, string][]): any {
  if (typeof x === "string") { for (const [a, b] of swaps) x = x.split(a).join(b); return x; }
  if (Array.isArray(x)) return x.map(v => relative(v, swaps));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [relative(k, swaps), relative(v, swaps)]));
  return x;
}
const mangle = (p: string) => p.replace(/[^A-Za-z0-9]/g, "-");

function golden(name: string, value: any) {
  const file = path.join(GOLDEN, name + ".json");
  const got = JSON.parse(JSON.stringify(value));
  if (process.env.FREE_REIN_GOLDEN || !fs.existsSync(file)) {
    fs.mkdirSync(GOLDEN, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(got, null, 1) + "\n");
  }
  assert.deepEqual(got, JSON.parse(fs.readFileSync(file, "utf8")), `${name} changed; if on purpose, refresh with FREE_REIN_GOLDEN=1`);
}

/** solo and kitchen copied to a temp folder, the kitchen's home with session history; fn(roots, swaps) */
function samples<T>(fn: (r: { solo: string; kitchen: string; empty: string }, swaps: [string, string][]) => T): T {
  const tmp = tmpdir("free-rein-golden-");
  const r = { solo: path.join(tmp, "solo"), kitchen: path.join(tmp, "kitchen"), empty: path.join(tmp, "empty") };
  fs.cpSync(path.join(FIXTURES, "solo"), r.solo, { recursive: true });
  fs.cpSync(path.join(FIXTURES, "kitchen"), r.kitchen, { recursive: true });
  fs.mkdirSync(r.empty);
  const home = path.join(tmp, "home");
  fs.cpSync(path.join(FIXTURES, "kitchen-home"), home, { recursive: true });
  const hist = path.join(home, ".claude", "projects", mangle(r.kitchen));
  fs.mkdirSync(path.join(hist, "s1", "subagents"), { recursive: true });
  const use = (n: string, input: any) => JSON.stringify({ message: { content: [{ type: "tool_use", name: n, input }] } });
  fs.writeFileSync(path.join(hist, "s1.jsonl"), [use("Bash", { command: "npm test && git push --force origin main" }), use("Bash", { command: "npm test" }),
    use("Edit", { file_path: path.join(r.kitchen, "vault", "decisions.md") }), use("Edit", { file_path: path.join(r.kitchen, "src", "util.ts") }),
    '"name":"Skill","input":{"skill":"review-work"}', "<command-name>/commit-it</command-name>",
    '{"subtype":"stop_hook_summary","hookCount":1,"hookInfos":[{"command":"bash .claude/hooks/done.sh"}],"hookErrors":[]}'].join("\n") + "\n");
  fs.writeFileSync(path.join(hist, "s1", "subagents", "a.jsonl"), use("Edit", { file_path: path.join(r.kitchen, ".claude", "settings.json") }) + "\n");
  fs.writeFileSync(path.join(hist, "c.jsonl"), '{"x":"mcp__claude_ai_Google_Drive__search"}\n{"t":"require authentication\\nclaude.ai Gmail\\n"}\n');
  fs.utimesSync(path.join(hist, "c.jsonl"), new Date(2026, 0, 1), new Date(2026, 0, 1));
  const swaps: [string, string][] = [[mangle(r.kitchen), "<kitchen-history>"], [r.kitchen, "<kitchen>"], [r.solo, "<solo>"], [r.empty, "<empty>"],
    [home, "<home>"], [REPO, "<repo>"], [tmp, "<tmp>"]];
  try { return withHome(home, () => fn(r, swaps)); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

test("golden: reading files (graph, statements, models, lint findings)", () => samples((r, sw) => {
  for (const [n, root] of Object.entries(r)) {
    const g = extract(root).toJson();
    golden(`extract-${n}`, relative(g, sw));
    golden(`statements-${n}`, relative(statements(root, g), sw));
    golden(`models-${n}`, relative(models(root), sw));
    golden(`lint-${n}`, relative(lint(root)[1], sw));
  }
}));

test("golden: pieces (evaluate), read several ways", () => samples((r, sw) => {
  golden("evaluate-kitchen", relative([evaluate(r.kitchen, { count_home: true }), evaluate(r.kitchen, { count_home: true, layer: "project" }),
    evaluate(r.kitchen, { runtime: "codex" }), evaluate(r.kitchen, { runtime: "cursor", base: false })], sw));
  golden("evaluate-solo", relative(evaluate(r.solo, { count_home: true }), sw));
}));

test("golden: the board, the harness document and its score", () => samples((r, sw) => {
  for (const [n, root] of Object.entries(r)) {
    const h = board(root, { count_home: true, sits: [{ tool: "Bash", target: "terraform apply", stakes: "outward" }] });
    golden(`board-${n}`, relative(h, sw));
    const { read_at, ...doc } = document(h, load(), root, null, true);
    golden(`document-${n}`, relative({ doc, score: score(doc, load()) }, sw));
  }
}));

test("golden: every example profile, and the list of profiles", () => samples((_r, sw) => {
  golden("profiles", relative(profiles(), sw));
  // the whole board for one of each kind (a runtime, a product, a reference design, an example); for every
  // profile, its harness document and score: the facts and the numbers, without the board's repeated text
  const full = ["claude", "chatbot-rag", "example-maxed"];
  golden("boards-profiles", relative(Object.fromEntries(full.map(id => [id, board(null, { profile: id })])), sw));
  golden("documents-profiles", relative(Object.fromEntries(profiles().map((p: any) => {
    const { read_at, ...doc } = document(board(null, { profile: p.id }), load(), null);
    return [p.id, { doc, score: score(doc, load()) }];
  })), sw));
}));

test("golden: drafts, plans and a dry run", () => samples((r, sw) => {
  const rules = [{ kind: "ask", rule: "Bash(git push:*)" }, { kind: "model", rule: "main=haiku" }, { kind: "model", rule: "agent:reviewer=opus" }];
  golden("board-draft-kitchen", relative(board(r.kitchen, { count_home: true, add: ["Free Rein"], ups: ["hard-gate", "receipts"], rules }), sw));
  golden("board-draft-new", relative(board(null, { profile: "claude", count_home: true, ups: ["proj-instructions", "permissions"] }), sw));
  for (const [n, root] of Object.entries(r)) {
    golden(`plans-${n}`, relative(Object.fromEntries([...Object.keys(TEMPLATES), "skills"].map(p => [p, plan(root, p)])), sw));
    golden(`upgrades-${n}`, relative(upgrades(root), sw));
    golden(`edits-${n}`, relative(edits(root, Object.keys(TEMPLATES), rules), sw));
  }
  const steps = [{ kind: "edit", target: ".env" }, { kind: "command", target: "git push --force" }, { kind: "knowledge", target: "vault/decisions.md" }, { kind: "done" }];
  golden("simulate-kitchen", relative([simulate(r.kitchen, steps), simulate(r.kitchen, steps, "claude", false, undefined, "manual"), simulate(r.kitchen, steps, "cursor")], sw));
}));

test("golden: a new harness, created", () => samples((r, sw) => {
  const dest = path.join(path.dirname(r.empty), "made");
  const out = create(dest, Object.keys(TEMPLATES));
  const tree: Record<string, string> = {};
  const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    if (e.name === ".git") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else tree[path.relative(dest, p)] = fs.readFileSync(p, "utf8") + ((fs.statSync(p).mode & 0o111) ? " [x]" : "");
  } };
  walk(dest);
  golden("create", relative({ out, tree }, [[dest, "<made>"], ...sw]));
}));

test("golden: free-rein check, as text and SARIF", () => samples((r, sw) => {
  for (const [n, root] of Object.entries(r)) {
    const rep = check(root);
    golden(`check-${n}`, relative({ text: text(rep), sarif: sarif(rep, "0.0.0") }, sw));
  }
}));
