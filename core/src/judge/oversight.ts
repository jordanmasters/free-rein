// Trust and friction, as situations: specific things the agent does, what's at stake, what happens under
// this harness's rules, and what decides it. First written in Python (retired 2026-10-11); see
// that file for the why.; rules are matched by Free Rein and hooks read, not run: believed.
import { historyDir } from "../read/home";
import * as fs from "fs";
import { re, I, S, readText, loads, join, dirname, basename, abspath, relpath, expanduser, isfile, fnmatch, glob, globRecursive, getmtime,
  sorted, unique, round, splitWs, strip, lstrip, rstrip, slice, get, iter, items as pyItems, isDict, isStr, or, truthy } from "../py";
import { load } from "../read/spec";
import * as simulate from "./simulate";
import { checkCommands } from "../write/changes";
import { extract, connectorsSeen } from "../read/extract";
import { used, tryPlugin } from "../read/plugins";

const W: Record<string, number> = { asks: 1, checks: 2, blocks: 3 };
const VAL: Record<string, number> = { yes: 1, partial: 0.5 };
import { home as HOME } from "../read/home";
/** a draft is measured on a copy; its history is the real folder's (board data sets this) */
export const HISTORY_FOR = new Map<string, string>();
/** situations you added: [{tool, target, stakes?, what?}] */
export const EXTRA: any[] = [];
/** situations the harness's prose names (backing): measured like the rest */
export const SAID: any[] = [];

export const STAKES = [
  { id: "everyday", name: "Everyday work", about: "Easy to see and undo: editing code, running the tests, building.", high: false },
  { id: "undo", name: "Hard to undo", about: "Deleting, throwing away changes, running code from outside.", high: true },
  { id: "outward", name: "Leaves this machine", about: "Pushing, publishing, deploying: other people see it.", high: true },
  { id: "knowledge", name: "Changes what it knows", about: "Its instructions, decisions and memory: what every later session relies on.", high: true },
  { id: "safeguards", name: "Changes its own safeguards", about: "Its permissions and hooks: the rules that decide everything else.", high: true },
  { id: "secrets", name: "Touches sensitive data", about: "Keys, credentials, private files and personal information.", high: true },
  { id: "accounts", name: "Connected accounts", about: "Your own mail, calendar and documents, through connectors: reading them, and acting as you.", high: true },
];
export const HIGH = new Set(STAKES.filter(s => s.high).map(s => s.id));
const WORK: Record<string, string> = { everyday: "edit", undo: "commands", outward: "unattended", knowledge: "knowledge", safeguards: "edit", secrets: "edit", accounts: "unattended" };
export const VERDICT: Record<string, [string, string]> = {
  "everyday|ahead": ["ok", "Runs on its own"], "everyday|classifier": ["ok", "Runs on its own"],
  "everyday|asks": ["babysitting", "Babysitting: everyday work that asks you"], "everyday|held": ["blocked", "Blocked: everyday work it can't do"],
  "high|ahead": ["exposed", "Exposed: nothing stops it"], "high|classifier": ["classifier", "Claude Code decides: no rule of yours"],
  "high|asks": ["good", "Good friction: it asks you"], "high|held": ["held", "Held: something refuses it"],
  // everyday work only a hook might refuse: Free Rein reads the hook's script but doesn't run it, so it can't say
  "everyday|depends": ["depends", "Depends on a hook: it may refuse this (Free Rein reads the hook, it doesn't run it)"],
};
const JOBS = [{ id: "lets", name: "lets it act" }, { id: "refuses", name: "refuses" }, { id: "asks", name: "asks you" },
  { id: "checks", name: "checks the result" }, { id: "records", name: "keeps a record" }];
const QUICK = [
  { id: "sensitive", name: "Working with sensitive data", about: "Ask before anything hard to undo or leaving the machine; never touch secrets.",
    calls: { undo: "ask", outward: "ask", knowledge: "ask", safeguards: "ask", secrets: "never" } },
  { id: "shared", name: "Team repo, shared history", about: "Ask before pushing; never force push or throw away changes.",
    calls: { outward: "ask", "git push --force": "never", "git reset": "never", safeguards: "ask" } },
  { id: "unattended", name: "Unattended runs", about: "Nothing irreversible while you're away: refuse what's hard to undo or leaves the machine.",
    calls: { undo: "never", outward: "never", safeguards: "never", secrets: "never" } },
  { id: "solo", name: "Solo prototype", about: "Let it work; ask only before it leaves the machine or touches secrets.", calls: { outward: "ask", secrets: "ask" } },
];
const GRADES = [
  { grade: 0, name: "You watch it", means: "Something risky can go ahead with nothing of yours stopping it, so you have to watch" },
  { grade: 1, name: "Nothing slips by", means: "Nothing goes ahead unchecked: each case stops, asks you, or Claude Code's safety check decides" },
  { grade: 2, name: "Every case has a rule", means: "Your own harness decides every case, rightly for what's at stake" },
  { grade: 3, name: "Its work is checked", means: "On top of the rules, its work is checked before it counts" },
  { grade: 4, name: "On the record", means: "It leaves a record, so work done alone can be reviewed afterwards" },
  { grade: 5, name: "Trusted alone", means: "Something independent reviews it, and how well it does is measured over time" },
];
const CHECKS: Record<string, string[]> = { everyday: ["check-commands", "completion-check"], undo: ["completion-check", "check-commands"],
  outward: ["completion-check", "independent-checker"], knowledge: ["human-gate", "harness-checker"], safeguards: ["hard-gate", "harness-checker"],
  secrets: ["hard-gate", "sandbox"], accounts: ["human-gate", "hard-gate"] };
const RECORDS = ["event-log", "receipts"], REVIEW = ["independent-checker", "evals"];

/** The grade for one kind of stakes, and what the next grade still needs. */
function autonomy(xs: any[], stakes: string, states: Record<string, string>, names: Record<string, string>) {
  const has = (ids: string[]) => ids.filter(p => states[p] === "yes");
  const need = (ids: string[]) => ids.map(p => ({ piece: p, name: names[p] ?? p }));
  const steps: [any[], string[] | null][] = [
    [xs.filter(s => s.verdict === "exposed"), null],
    [xs.filter(s => !s.accounted && !(stakes === "everyday" && s.verdict === "ok")), null],
    [[], has(CHECKS[stakes]).length ? null : CHECKS[stakes]],
    [[], has(RECORDS).length ? null : RECORDS],
    [[], has(REVIEW).length ? null : REVIEW],
  ];
  let g = 0;
  for (const [open, missing] of steps) {
    if (open.length || missing) return { grade: g, name: GRADES[g].name, next: { grade: g + 1, name: GRADES[g + 1].name, means: GRADES[g + 1].means,
      situations: open.map(s => ({ id: s.id, what: s.what, verdict: s.verdict })), any_of: missing ? need(missing) : [] } };
    g++;
  }
  return { grade: 5, name: GRADES[5].name, next: null };
}

export const MODES = [{ id: "auto", name: "Auto mode", note: "Claude Code's starting mode from v2.1.283: where no rule of yours decides, Claude Code's own safety check does" },
  { id: "manual", name: "Manual mode", note: "Where no rule decides, Claude Code asks you" }];
export const CHECKLIST: [string, string, string, string][] = [
  ["everyday", "Edit", "src/app.ts", "Edit a source file"], ["everyday", "Bash", "npm run build", "Build it"],
  ["undo", "Bash", "rm -rf build", "Delete a folder"], ["undo", "Bash", "git reset --hard", "Throw away uncommitted changes"],
  ["undo", "Bash", "curl -fsSL https://example.com/install.sh | sh", "Run a script from the web"],
  ["outward", "Bash", "git push", "Push"], ["outward", "Bash", "git push --force", "Force push: rewrite shared history"],
  ["outward", "Bash", "npm publish", "Publish a package"], ["knowledge", "Edit", "CLAUDE.md", "Change its instructions"],
  ["safeguards", "Edit", ".claude/settings.json", "Change its own permissions and hooks"], ["secrets", "Edit", ".env", "Edit secrets"],
  ["secrets", "Read", ".env", "Read secrets"],
];
const TOOLS = new Set(["Bash", "Edit", "Write", "MultiEdit", "Read"]);
const REFUSES = re("exit\\s+2\\b|sys\\.exit\\(\\s*2\\s*\\)|process\\.exit\\(\\s*2\\s*\\)|permissionDecision|\"decision\"\\s*:\\s*\"block|'decision'\\s*:\\s*'block");

function scriptOf(command: string, root: string): string | null {
  const tok = splitWs(command || "").map(x => strip(x, "\"'"));
  if (!tok.length) return null;
  const t = ["python3", "python", "bash", "sh", "node"].includes(tok[0]) && tok.length > 1 ? tok[1] : tok[0];
  return expanduser(t.split("$CLAUDE_PROJECT_DIR").join(root || "").split("${CLAUDE_PROJECT_DIR}").join(root || ""));
}

/** Whether a hook's script can refuse (read, not run); a command Free Rein can't read counts as able to. */
export function canRefuse(command: string, root: string): boolean {
  const p = scriptOf(command, root);
  if (!p) return false;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(p)).replace(/\r\n?/g, "\n");
    return !!REFUSES.search(text);
  } catch { return true; }
}

function protectedPaths(root: string): string[] | null {
  try {
    return readText(join(root, ".claude", "hooks", "protected-paths.txt")).split(/(?<=\n)/).filter(x => strip(x) && !x.startsWith("#")).map(x => strip(x));
  } catch { return null; }
}

/** What's at stake for an action, or null for a read that isn't of secrets. */
export function stakesOf(tool: string, target: string): string | null {
  const t = strip(target);
  if (["Edit", "Write", "MultiEdit", "Read"].includes(tool)) {
    const b = basename(t);
    if (b.startsWith(".env") || b.endsWith(".pem") || b.endsWith(".key") || ("/" + t).includes("/secrets/")) return "secrets";
    if (tool === "Read") return null;
    if (t.startsWith(".claude/settings") || t.startsWith(".claude/hooks/")) return "safeguards";
    if (b === "CLAUDE.md" || b === "AGENTS.md" || ["vault/", "canon/", ".claude/memory", "memory/", ".claude/skills/", ".claude/agents/", ".claude/commands/"].some(p => t.startsWith(p)) || t.includes("/decisions"))
      return "knowledge";
    return "everyday";
  }
  if (re("\\bgit push\\b.*(--force|\\s-f\\b)").search(t) || re("\\brm\\s+-[a-z]*r").search(t) || re("\\bgit (reset --hard|clean -[a-z]*f|checkout -- |branch -D)").search(t)
    || re("\\b(curl|wget)\\b.*\\|\\s*(sh|bash)\\b").search(t) || re("\\bdrop (table|database)\\b", I).search(t))
    return re("\\bgit push\\b").search(t) ? "outward" : "undo";
  if (re("\\bgit push\\b|\\bnpm publish\\b|\\bgh (pr (create|merge)|release)\\b|\\bvercel\\b.*--prod|\\bdeploy\\b|\\bcurl\\b.*-X\\s*(POST|PUT|DELETE)").search(t)) return "outward";
  if (re("\\.env\\b").search(t) && re("\\b(cat|less|head|tail|cp|grep)\\b").search(t)) return "secrets";
  return "everyday";
}

const SG = new Map<string, [string, string | null, string, string][]>();
/** [skill, its file, the file it writes, an example path] for each skill that asks you before it writes. */
export function skillGates(root: string | null) {
  const real = abspath(root || "");
  if (SG.has(real)) return SG.get(real)!;
  const out: [string, string | null, string, string][] = [];
  let g: any;
  try { g = extract(real).toJson(); } catch { g = { nodes: [], edges: [] }; }
  const paths = new Map(g.nodes.map((n: any) => [n.id, (n.provenance || {}).path ?? null]));
  for (const e of g.edges) {
    if (e.type === "writes" && e.source.startsWith("gate:approval:") && e.target.startsWith("substrate:")) {
      const t = e.target.slice("substrate:".length);
      let ex = t.split("YYYY-MM-DD").join("2026-10-08").split("*").join("note");
      ex = ex.endsWith("/") ? ex + "note.md" : ex;
      out.push([e.source.slice("gate:approval:".length), (paths.get(e.source) as string) ?? null, t, ex]);
    }
  }
  SG.set(real, out);
  return out;
}

const CONNECTOR_ACTS: Record<string, [string, string][]> = {
  Gmail: [["read", "Read your inbox"], ["send", "Send an email as you"]], Outlook: [["read", "Read your inbox"], ["send", "Send an email as you"]],
  "Google Calendar": [["read", "Read your calendar"], ["invite", "Accept or send a meeting invite"]],
  "Google Drive": [["read", "Open a shared document"], ["delete", "Delete a file in your drive"]],
  Slack: [["read", "Read your messages"], ["send", "Post a message as you"]], "Claude Docs": [["read", "Read your documents"], ["edit", "Change a document as you"]],
};

const pystr = (x: any): string => x === true ? "True" : x === false ? "False" : x === null || x === undefined ? "None" : String(x);
const byMtimeDesc = (files: string[]) => sorted(files, f => getmtime(f), true);

/** The claude.ai connectors connected in this folder's recent sessions, and whether settings turn each off. */
export function connectors(root: string | null): [string, boolean][] {
  if (simulate.settings(root || "").some(([, st]) => truthy(get(st, "disableClaudeAiConnectors")))) return [];
  const d = historyDir(abspath(HISTORY_FOR.get(root as string) ?? root ?? ""));
  const texts: string[] = [];
  if (d) for (const f of byMtimeDesc(glob(join(d, "*.jsonl"))).slice(0, 20)) { try { texts.push(readText(f, "ignore", 4_000_000)); } catch { /* skipped */ } }
  const denied = new Set(simulate.settings(root || "").flatMap(([, st]) => iter(or(get(st, "deniedMcpServers"), [])).map(x => pystr(x).toLowerCase())));
  return sorted(Object.entries(connectorsSeen(texts))).filter(([, v]) => v === "connected").map(([c]) => [c, denied.has(`claude.ai ${c}`.toLowerCase())]);
}

export { historyDir };

const HEREDOC = re("<<-?\\s*(['\"]?)(\\w+)\\1[^\\n]*\\n.*?\\n\\s*\\2\\b", S);
/** A shell command split into the commands it runs (heredocs dropped; split on && || ; and newlines outside quotes). */
export function segments(cmdIn: string): string[] {
  const cmd = HEREDOC.sub(cmdIn, m => m.group(0)!.split("\n")[0]);
  const parts: string[] = [];
  let cur = "", q: string | null = null, i = 0;
  while (i < cmd.length) {
    const ch = cmd[i];
    if (q) {
      cur += ch;
      if (ch === q) q = null;
      else if (ch === "\\" && q === '"' && i + 1 < cmd.length) { cur += cmd[i + 1]; i++; }
    } else if (ch === "'" || ch === '"') { q = ch; cur += ch; }
    else if (ch === ";" || ch === "\n" || cmd.slice(i, i + 2) === "&&" || cmd.slice(i, i + 2) === "||") {
      parts.push(cur); cur = "";
      i += ch === ";" || ch === "\n" ? 1 : 2;
      continue;
    } else cur += ch;
    i++;
  }
  parts.push(cur);
  const out: string[] = [];
  for (let seg of parts) {
    seg = strip(seg);
    if (!seg || seg.startsWith("cd ") || seg.startsWith("#") || seg.startsWith("export ") || seg === "cd" || re("^[A-Za-z_][A-Za-z0-9_]*=").match(seg)
      || ["then", "fi", "do", "done", "else", "for", "while", "if", "{", "}", "(", ")", "echo", "sleep", "true", "wait"].includes(splitWs(seg)[0])) continue;
    out.push(seg);
  }
  return out;
}

const SUB = new Set(["git", "npm", "pnpm", "yarn", "npx", "gh", "docker", "make", "cargo", "go", "pip", "python3", "node"]);

/** Actions that count as one situation: a command by its program (and subcommand), an edit by its folder. */
export function keyOf(tool: string, target: string): string | null {
  if (tool === "Bash") {
    const w = splitWs(target);
    if (!w.length) return null;
    w[0] = strip(lstrip(w[0], "("), "\"'");
    if (!w[0] || w[0] === "\\") return null;
    const script = w.length > 1 && ["python3", "python", "node", "bash", "sh"].includes(w[0]) && !!re("\\.(py|js|mjs|sh)$").search(w[1]);
    const sub = script ? "" : w.length > 1 && SUB.has(w[0]) && !["/", "~", "$"].some(p => w[1].startsWith(p)) && w[1].length < 24 ? w[1] : "";
    const flags = w.includes("--force") || (w[0] === "git" && w[1] === "push" && w.includes("-f")) ? " --force" : "";
    return slice(strip(`${w[0]} ${sub}`) + (script ? " a script" : "") + flags, 0, 60);
  }
  if (stakesOf(tool, target) !== "everyday") return target;
  const d = dirname(target);
  return d ? d + "/" : target;
}

const HIST = new Map<string, any>();
export function history(root: string, limit = 40) {
  const real = abspath(HISTORY_FOR.get(root) ?? root);
  if (!HIST.has(real)) HIST.set(real, readHistory(real, limit));
  return HIST.get(real);
}

/** What the agent did in the last sessions here: each action's tool and target, relative to the folder. */
function readHistory(real: string, limit: number) {
  const d = historyDir(real);
  if (!d) return { sessions: 0, actions: [] as [string, string][] };
  const files = byMtimeDesc(glob(join(d, "*.jsonl"))).slice(0, limit);
  const subs = files.flatMap(x => globRecursive(join(d, basename(x).slice(0, -6)), "*.jsonl"));
  const acts: [string, string][] = [];
  for (const f of [...files, ...subs]) {
    let text: string;
    try { text = readText(f, "ignore"); } catch { continue; }
    for (const line of text.split(/(?<=\n)/)) {
      if (!line.includes('"tool_use"')) continue;
      let m: any;
      try { m = loads(line); } catch { continue; }
      for (const b of iter(or(get(or(get(m, "message"), {}), "content"), []))) {
        if (!isDict(b) || get(b, "type") !== "tool_use" || !TOOLS.has(get(b, "name"))) continue;
        const i = or(get(b, "input"), {});
        const tool = ["Write", "MultiEdit"].includes(b.name) ? "Edit" : b.name;
        if (tool === "Bash") acts.push(...segments(pystr(or(get(i, "command"), ""))).map(seg => ["Bash", seg] as [string, string]));
        else {
          const p = pystr(or(get(i, "file_path"), ""));
          if (p.startsWith(real + "/")) acts.push([tool, relpath(p, real)]);
        }
      }
    }
  }
  return { sessions: files.length, actions: acts };
}

function lineEq(path: string, needle: string): number | null {
  try {
    const lines = readText(path).split(/(?<=\n)/);
    const i = lines.findIndex(l => strip(l) === needle);
    return i < 0 ? null : i + 1;
  } catch { return null; }
}

/** What happens to one action under this harness's rules, and the rules and hooks that decide it. */
export function decide(root: string, tool: string, target: string, mode: string, gateHits: any): [string, any[]] {
  const by: any[] = [];
  let out: string | null = null;
  if (tool === "Connector") {
    const name = target.split(":")[0];
    if (gateHits === "denied") return ["held", [{ piece: "permissions", job: "refuses", what: `Your settings turn the ${name} connector off (deniedMcpServers)`, source: "https://code.claude.com/docs/en/mcp" }]];
    if (mode === "manual") return ["asks", [{ piece: null, job: "asks", what: "No rule of yours covers it, so Claude Code's Manual mode asks you", source: "https://code.claude.com/docs/en/permission-modes" }]];
    return ["classifier", [{ piece: null, job: "lets", what: "No rule of yours covers it, so in auto mode Claude Code's own safety check decides", source: "https://code.claude.com/docs/en/permission-modes" }]];
  }
  const ct = ["Edit", "Write", "MultiEdit"].includes(tool) ? "Edit" : tool;
  for (const h of ct !== "Read" ? simulate.hooks(root, "PreToolUse", ct) : []) {
    if (!canRefuse(h.command, root)) continue;
    const prot = h.command.includes("protect-files") ? protectedPaths(root) : null;
    if (prot !== null) {
      const g = prot.find(x => fnmatch(target, x) || fnmatch(basename(target), x));
      if (g) {
        out = "held";
        const pp = join(root, ".claude", "hooks", "protected-paths.txt");
        by.push({ piece: "hard-gate", job: "refuses", what: `A blocking hook refuses it: ${g} is protected`, path: pp, line: lineEq(pp, g) });
      }
      continue;
    }
    out = "held";
    by.push({ piece: "hard-gate", job: "refuses", what: "A hook runs first, and its script can refuse (read, not run)", path: h.path, line: h.line, believed: true });
  }
  const p = simulate.permission(root, ct, target);
  if (p && p.kind === "deny") { out = "held"; by.push({ piece: "permissions", job: "refuses", what: `A permission rule refuses it: ${p.rule}`, path: p.path, line: p.line, rule: p.rule }); }
  else if (p && p.kind === "ask" && out !== "held") { out = "asks"; by.push({ piece: "permissions", job: "asks", what: `A permission rule asks you first: ${p.rule}`, path: p.path, line: p.line, rule: p.rule }); }
  else if (p && out !== "held") by.push({ piece: "permissions", job: "lets", what: `A permission rule allows it: ${p.rule}`, path: p.path, line: p.line, rule: p.rule });
  for (const g of gateHits) {
    if (out !== "held") out = "asks";
    by.push({ piece: "human-gate", job: "asks", what: g.believed ? g.label : `A review gate asks you first: ${g.label}`, path: g.path, line: (g.lines && g.lines.length ? g.lines : [null])[0],
      ...(g.believed ? { believed: true } : {}) });
  }
  if (out === null) {
    if (p) out = "ahead";
    else if (ct === "Read") { out = "ahead"; by.push({ piece: null, job: "lets", what: "No rule covers it, and Claude Code reads files without asking", source: "https://code.claude.com/docs/en/permissions" }); }
    else if (mode === "manual") { out = "asks"; by.push({ piece: null, job: "asks", what: "No rule covers it, so Claude Code's Manual mode asks you", source: "https://code.claude.com/docs/en/permission-modes" }); }
    else { out = "classifier"; by.push({ piece: null, job: "lets", what: "No rule of yours covers it, so in auto mode Claude Code's own safety check decides (a model judges each action; you don't see or set its rules)", source: "https://code.claude.com/docs/en/permission-modes" }); }
  }
  return [out, by];
}

/** A permission rule (Claude Code syntax) that settles one action. */
export function ruleFor(tool: string, target: string, how: string, stakes: string | null = null): string | null {
  if (["Edit", "Write", "MultiEdit", "Read"].includes(tool)) {
    const t = tool === "Read" ? "Read" : "Edit";
    const d = dirname(target);
    return how === "allow" && d && !d.startsWith(".") ? `${t}(${d}/**)` : `${t}(${target})`;
  }
  const w = splitWs(target);
  if (!w.length) return null;
  const force = w[0] === "git" && w[1] === "push" && (w.includes("--force") || w.includes("-f"));
  if (stakes && stakes !== "everyday") {
    for (let n = 1; n <= w.length; n++) {
      const head = w.slice(0, n).join(" ");
      if (stakesOf("Bash", head) === stakes && keyOf("Bash", head) === keyOf("Bash", target) && !re("[|;&<>]").search(head)) return `Bash(${head}:*)`;
    }
    if (force) return "Bash(git push --force:*)";
    return `Bash(${target})`;
  }
  if (force) return "Bash(git push --force:*)";
  const head = ["git", "npm", "pnpm", "yarn", "gh"].includes(w[0]) || (w.length > 1 && w[1].startsWith("-")) ? w.slice(0, 2).join(" ") : w[0];
  return `Bash(${head}:*)`;
}

/** For each piece not in place: how much more each kind of work would be backed with it, and overall. */
export function gains(spec: any, states: Record<string, string>) {
  const items: Record<string, any> = Object.fromEntries(spec.slots.flatMap((s: any) => s.items).map((it: any) => [it.id, it]));
  const cats = spec.trust.categories;
  const per = new Map<string, Record<string, number>>();
  for (const c of cats) {
    const cap = c.evidence.filter((p: string) => p in items).reduce((a: number, p: string) => a + (W[items[p].strength] ?? 1), 0);
    for (const p of c.evidence) {
      if (!(p in items) || states[p] === "yes") continue;
      const w = W[items[p].strength] ?? 1;
      if (!per.has(p)) per.set(p, {});
      per.get(p)![c.id] = cap ? round(100 * w * (1 - (VAL[states[p]] ?? 0)) / cap) : 0;
    }
  }
  return Object.fromEntries([...per.entries()].map(([p, g]) => [p, { by: g, overall: round(Object.values(g).reduce((a, b) => a + b, 0) / cats.length) }]));
}

const STAKE_IDS = new Set(STAKES.map(s => s.id));

/** Every situation to read: yours, the prose's, the harness's own rules, the checklist, connectors, and history. */
export function situations(root: string, hist: any): any[] {
  const seen = new Map<string, any>(), out: any[] = [];
  const add = (stakes: string | null, toolIn: string, target: string, what: string, source: string, count = 0, examples: string[] = []) => {
    if (stakes === null || stakes === undefined) return;
    const tool = ["Write", "MultiEdit"].includes(toolIn) ? "Edit" : toolIn;
    const k1 = keyOf(tool, target) || target;
    const k = JSON.stringify([tool, k1, stakes]);
    if (seen.has(k)) {
      const s = seen.get(k);
      s.count += count;
      s.examples = unique([...s.examples, ...examples]).slice(0, 4);
      if (!s.sources.includes(source)) s.sources.push(source);
      if (source === "checklist" && !s.sources.includes("yours")) { s.what = what; s.target = target; }
      return;
    }
    const s = { id: strip(re("[^a-z0-9]+").sub(`${tool}-${k1}-${stakes}`.toLowerCase(), "-"), "-"), stakes, tool, target, key: k1,
      what, sources: [source], count, examples: examples.slice(0, 4) };
    seen.set(k, s);
    out.push(s);
  };
  for (const x of EXTRA) {
    const tool = ["Bash", "Edit", "Read"].includes(get(x, "tool")) ? x.tool : "Bash";
    const t = strip(pystr(or(get(x, "target"), "")));
    if (!t) continue;
    const st = STAKE_IDS.has(get(x, "stakes")) ? x.stakes : stakesOf(tool, t) || "everyday";
    add(st, tool, t, or(get(x, "what"), `${tool === "Bash" ? "Run" : tool} ${t}`), "yours");
  }
  for (const x of SAID) add(or(get(x, "stakes"), null) || stakesOf(x.tool, x.target), x.tool, x.target, x.what, "said");
  for (const [, st] of simulate.settings(root)) {
    for (const kind of ["deny", "ask", "allow"]) {
      for (const rule of iter(or(get(or(get(st, "permissions"), {}), kind), []))) {
        const m = isStr(rule) ? re("^\\s*(Bash|Edit|Write|MultiEdit|Read)\\((.+)\\)\\s*$").match(rule) : null;
        if (!m) continue;
        const tool = m.group(1)!, spec = m.group(2)!;
        if (!spec.includes("*") && Array.from(spec).length > 40) continue;
        if (spec.startsWith("~") || spec.startsWith("//") || (spec.startsWith("/") && tool !== "Bash") || re("\\s(~|/Users/|/home/)").search(spec)) continue;
        let target = spec.endsWith(":*") ? spec.slice(0, -2) : re(" \\*$").sub(spec, spec.startsWith("git ") ? " origin" : " .");
        if (tool !== "Bash") target = target.split("**").join("x").split("*").join("x");
        target = target.startsWith("./") ? target.slice(2) : target;
        const shown = re("(:\\*| \\*)$").sub(spec, " …");
        add(stakesOf(tool, target), tool, target, `${tool === "Bash" ? "Run" : tool} ${shown}`, "rule");
      }
    }
  }
  // the situations a plugin's rules make (a framework's review gates guard writes to what it knows)
  for (const p of used(root)) for (const x of tryPlugin(p, "situations", () => p.situations?.(root) ?? [], [])) add(x.stakes, x.tool, x.target, x.what, "rule");
  for (const [skill, , t, ex] of skillGates(root)) add("knowledge", "Edit", ex, `Write ${t} with /${skill}`, "rule");
  const tests = checkCommands(root).filter(c => c.includes("test")).slice(0, 1);
  for (const [st, tool, target, what] of [["everyday", "Bash", tests.length ? tests[0] : "npm test", "Run the tests"], ...CHECKLIST] as [string, string, string, string][])
    add(st, tool, target, what, "checklist");
  for (const [name, denied] of connectors(root)) {
    for (const [act, what] of CONNECTOR_ACTS[name] ?? [["read", `Read what's in ${name}`], ["act", `Act in ${name} as you`]]) {
      add("accounts", "Connector", `${name}: ${act}`, `${what} (${name})`, "connector");
      if (denied) out[out.length - 1].denied = true;
    }
  }
  const groups = new Map<string, { tool: string; k: string; st: string | null; ts: string[] }>();
  for (const [tool, target] of hist.actions) {
    const k = keyOf(tool, target);
    if (!k) continue;
    const st = stakesOf(tool, target);
    const gk = JSON.stringify([tool, k, st]);
    if (!groups.has(gk)) groups.set(gk, { tool, k, st, ts: [] });
    groups.get(gk)!.ts.push(target);
  }
  for (const { tool, k, st, ts } of sorted([...groups.values()], x => -x.ts.length)) {
    const counts = new Map<string, number>();
    for (const t of ts) counts.set(t, (counts.get(t) ?? 0) + 1);
    const common = sorted([...counts.entries()], e => -e[1]).slice(0, 3).map(e => e[0]);
    const label = ({ Bash: "Run", Edit: "Edit", Read: "Read" } as any)[tool] + " " + (tool === "Bash" ? k : rstrip(k, "/") + (k.endsWith("/") ? "/…" : ""));
    add(st, tool, common[0], label, "history", ts.length, common);
  }
  return out;
}
const valuesOf = (d: any) => { if (!isDict(d)) throw new TypeError("'list' object has no attribute 'values'"); return Object.values(d); };

/** Every situation measured under the harness's rules in one mode: outcome, verdict, what decides it, a fix. */
export function measure(root: string | null, a: any, runtime = "claude", mode = "auto") {
  const spec = load();
  const states: Record<string, string> = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i.state]));
  const names: Record<string, string> = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i.name]));
  const rulesRead = !!root && runtime === "claude" && !truthy(a.profile);
  const hist = rulesRead ? history(root!) : { sessions: 0, actions: [] };
  const sits: any[] = rulesRead ? situations(root!, hist) : CHECKLIST.map(([s, t, x, w]) => ({
    id: strip(re("[^a-z0-9]+").sub(`${t}-${x}`.toLowerCase(), "-"), "-"), stakes: s, tool: t, target: x, what: w, sources: ["checklist"], count: 0, examples: [] }));
  for (const s of sits) {
    const hi = HIGH.has(s.stakes);
    if (rulesRead) {
      const gate = s.tool === "Edit"
        ? [...simulate.gates(root!, s.target), ...skillGates(root).filter(([, sp, , ex]) => ex === s.target && simulate.sees(simulate.ownerOf(sp, root)))
          .map(([sk, sp]) => ({ label: `/${sk} asks you first: its instructions say to wait for your yes`, path: sp, lines: [null], believed: true }))]
        : s.denied ? "denied" : [];
      [s.outcome, s.by] = decide(root!, s.tool, s.target, mode, gate);
    } else {
      const inp = (p: string) => states[p] === "yes";
      s.outcome = hi && (inp("hard-gate") || inp("sandbox")) ? "held" : hi && inp("human-gate") ? "asks" : "ahead";
      s.by = [{ piece: null, job: "lets", what: "Read from the pieces in place, not rule by rule" }];
    }
    // everyday work refused only by a hook read, not run: not "blocked", since the hook may well let it through
    const refusals = s.by.filter((b: any) => b.job === "refuses");
    if (!hi && s.outcome === "held" && refusals.length && refusals.every((b: any) => b.believed && b.piece === "hard-gate")) s.outcome = "depends";
    [s.verdict, s.says] = VERDICT[`${hi ? "high" : "everyday"}|${s.outcome}`];
    s.work = WORK[s.stakes];
    s.accounted = s.by.some((b: any) => truthy(b.piece)) && ["ok", "good", "held"].includes(s.verdict);
    let fix: any = null;
    if (s.verdict === "babysitting")
      fix = { rule: s.tool === "Bash" && s.key ? `Bash(${s.key.split(" a script").join("")}:*)` : ruleFor(s.tool, s.target, "allow"), how: "allow", why: "let a rule decide it, so it stops asking you" };
    else if ((s.verdict === "exposed" || s.verdict === "classifier") && s.tool === "Connector") fix = null;
    else if (s.verdict === "exposed" || s.verdict === "classifier") {
      const how = s.stakes === "secrets" ? "deny" : "ask";
      const piece = s.stakes === "knowledge" && states["human-gate"] !== "yes" ? "human-gate"
        : s.tool === "Edit" && ["secrets", "safeguards", "knowledge"].includes(s.stakes) ? "hard-gate"
        : s.tool === "Bash" && s.stakes === "secrets" ? "sandbox" : null;
      fix = { rule: !(s.stakes === "secrets" && s.tool === "Bash") ? ruleFor(s.tool, s.target, how, s.stakes) : null, how,
        why: how === "deny" ? "refuse it outright" : "ask you before it happens" };
      if (piece && states[piece] !== "yes") Object.assign(fix, { piece, piece_name: names[piece] ?? piece });
    } else if (s.verdict === "blocked") {
      const r = s.by.find((b: any) => b.job === "refuses" && truthy(b.rule))?.rule ?? null;
      fix = r ? { rule: r, how: "remove", why: "everyday work shouldn't be refused" } : null;
    }
    s.fix = fix && (truthy(fix.rule) || truthy(fix.piece)) ? fix : null;
    s.call = ({ ahead: "let", classifier: "let", asks: "ask", held: "never" } as any)[s.outcome];
    s.calls = Object.fromEntries([["let", "allow"], ["ask", "ask"], ["never", "deny"]].map(([c, k]) =>
      [c, rulesRead && s.tool !== "Connector" ? { kind: k, rule: ruleFor(s.tool, s.target, k, s.stakes) } : null]));
    s.fixed = s.outcome === "held" && s.by.some((b: any) => b.job === "refuses" && (b.piece === "hard-gate" || !pystr(or(b.path ?? null, "")).startsWith(abspath(root || "") + "/")));
  }
  const grid: any = {};
  for (const s of sits) {
    const row = HIGH.has(s.stakes) ? "high" : "everyday";
    grid[row] ??= {};
    const cell = (grid[row][s.outcome] ??= { situations: 0, actions: 0, verdict: s.verdict });
    cell.situations += 1; cell.actions += s.count;
  }
  const pieces: Record<string, any> = {};
  for (const s of sits) for (const b of s.by) {
    if (!truthy(b.piece)) continue;
    const p = (pieces[b.piece] ??= { jobs: [], decides: [] });
    if (!p.jobs.includes(b.job)) p.jobs.push(b.job);
    if (!p.decides.some((d: any) => d.id === s.id)) p.decides.push({ id: s.id, verdict: s.verdict, job: b.job });
  }
  const stageJob: Record<string, string> = { before: "refuses", you: "asks", after: "checks", record: "records" };
  for (const st of spec.trust.stages ?? []) for (const pid of st.pieces) if (states[pid] === "yes") {
    const p = (pieces[pid] ??= { jobs: [], decides: [] });
    if (!p.jobs.length) p.jobs.push(stageJob[st.id]);
  }
  const cc = root ? checkCommands(root) : [];
  const checks = ([["completion-check", "every task, when it stops: runs " + (cc.length ? cc.join(", ") : "your checks")],
    ["check-commands", "code: " + (cc.length ? cc.join(", ") : "no test or lint command found")], ["criteria", "the task you describe: what done means, written down"],
    ["independent-checker", "any task: a second agent reads the result"], ["evals", "the harness itself, over time"]] as [string, string][])
    .map(([p, cov]) => ({ id: p, name: names[p] ?? p, state: states[p] ?? "no", covers: cov }));
  const inp = checks.filter(c => c.state === "yes");
  const stops = states["completion-check"] === "yes";
  const done = { checks, stops,
    says: stops ? "It's checked when it stops" : !inp.length ? "Nothing checks the work when it stops: it decides by itself that it's done" : "Something can check the work, but nothing makes it pass before it stops",
    verdict: stops ? "held" : !inp.length ? "exposed" : "classifier", fix: stops ? null : { piece: "completion-check", piece_name: names["completion-check"] ?? null } };
  const hs = sits.filter(s => s.count);
  const sx = (spec.progression || {}).situation_xp || {};
  const xp = sits.filter(s => s.accounted).reduce((a, s) => a + (sx[HIGH.has(s.stakes) ? "high" : "everyday"] ?? 0), 0);
  const reins = STAKES.map(st => {
    const xs = sits.filter(s => s.stakes === st.id);
    const alone = xs.filter(s => s.outcome === "ahead" || s.outcome === "classifier");
    return { id: st.id, name: st.name, about: st.about, high: st.high, situations: xs.length, alone: alone.length,
      autonomy: xs.length ? autonomy(xs, st.id, states, names) : null, accounted: xs.filter(s => s.accounted).length,
      defaults: xs.filter(s => !s.by.some((b: any) => truthy(b.piece))).length, exposed: alone.filter(s => s.verdict === "exposed").length,
      classifier: alone.filter(s => s.verdict === "classifier").length, asks: xs.filter(s => s.outcome === "asks").length, held: xs.filter(s => s.outcome === "held").length };
  });
  const sum = (xs: any[]) => xs.reduce((a, s) => a + s.count, 0);
  return { mode, measured: rulesRead ? "rules" : "pieces", note: rulesRead ? "Rules read from the settings files; hooks read, not run" : "Read from the pieces in place",
    stakes: STAKES, jobs: JOBS, situations: sits, reins, grades: GRADES, quick: QUICK, xp, grid, pieces, done, gains: gains(spec, states),
    history: rulesRead ? { sessions: hist.sessions, actions: hist.actions.length, asks: sum(hs.filter(s => s.outcome === "asks")),
      babysitting: sum(hs.filter(s => s.verdict === "babysitting")), exposed: sum(hs.filter(s => s.verdict === "exposed" || s.verdict === "classifier")),
      high: sum(hs.filter(s => HIGH.has(s.stakes))) } : null,
    summary: { situations: sits.length, accounted: sits.filter(s => s.accounted).length, defaults: sits.filter(s => !s.by.some((b: any) => truthy(b.piece))).length,
      ...Object.fromEntries(["ok", "babysitting", "blocked", "depends", "exposed", "classifier", "good", "held"].map(v => [v, sits.filter(s => s.verdict === v).length])) } };
}

/** The permission mode this harness starts in, from permissions.defaultMode, most local file first. */
export function setMode(root: string) {
  for (const [path, s] of simulate.settings(root)) {
    const v = get(or(get(s, "permissions"), {}), "defaultMode");
    if (!isStr(v)) continue;
    const project = !path.startsWith(join(HOME(), ".claude"));
    if (project && (v === "auto" || v === "bypassPermissions")) continue;
    const mode = ({ default: "manual", manual: "manual", auto: "auto" } as any)[v] ?? null;
    return { value: v, mode: mode || "manual", path, line: simulate.lineOf(path, '"defaultMode"'), modelled: !!mode, set: true };
  }
  return { value: null, mode: "auto", path: null, set: false, note: "Nothing sets it, so Claude Code starts in auto mode (from v2.1.283)" };
}

/** Measured in each permission mode (Claude Code on a folder); otherwise once, from the pieces. */
export function both(root: string | null, a: any, runtime = "claude") {
  if (!(root && runtime === "claude" && !truthy(a.profile))) return { modes: [], by_mode: { auto: measure(root, a, runtime) } };
  return { modes: MODES, set_mode: setMode(root), by_mode: Object.fromEntries(MODES.map(m => [m.id, measure(root, a, runtime, m.id)])) };
}

/** Forget what was read before (session history, skill gates): Python reads once per process, the extension
 * keeps the core loaded, so each new reading starts fresh. */
export function resetCaches() { SG.clear(); HIST.clear(); }
