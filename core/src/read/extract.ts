// Free Rein's extractor, Claude Code adapter: reads a harness into a graph (model/graph-schema.md).
// Python's behavior (Unicode regular expressions, text-mode reads, os.path, dict access that raises
// on the wrong type) comes from ../py, so this reads line for line like the reference.
import { withoutSamples } from "./samples";
import {
  re, I, M, S, flags, Re, Match, strip, lstrip, rstrip, splitlines, splitWs, slice, count, unique, sorted, truthy, or, isDict, isList,
  isStr, get, iter, items, pylen, loads, readText, join, basename, relpath, abspath, realpath, expanduser, isabs, isdir, isfile,
  exists, listdir, walk, getmtime,
} from "../py";
import { models as readModels, INPUTS, OUTPUTS } from "./models";
import * as pyAll from "../py";
import { plugins, used, tryPlugin, Kit, ReadContext } from "./plugins";
import { memory } from "./memory";
import { historyDir } from "./home";

// --- detection patterns ---

const FRONTMATTER_RE = re("\\A---\\s*\\n(.*?)\\n---\\s*\\n", S);
const SKILL_MENTION_RE = re("(?:^|[\\s(`])/([a-z][a-z0-9-]{2,})\\b");
const BACKTICK_NAME_RE = re("`([a-z][a-z0-9-]{2,})`");
const PATH_RE = re("[\\w<>*.-]+(?:/[\\w<>\\[\\]*.-]+)+/?|\\b[\\w-]+\\.(?:md|json|jsonl|yaml|yml|html)\\b");
const LIB_CALL_RE = re("(?:~/\\.claude/[\\w-]+/)?lib/([\\w-]+)\\.py");
const EMIT_RE = re("emit\\.py\\s+([\\w-]+)");
const APPROVAL_RE = re(
  "await[^.\\n]{0,50}(?:approval|confirmation|go-ahead)" +
  "|explicit(?:ly)?\\s+(?:approv|confirm)" +
  "|show[^.\\n]{0,40}for review" +
  "|(?:on|after|until)\\s+(?:the\\s+)?(?:user\\s+)?approv" +
  "|\\bask(?:s|ing)?\\b[^.\\n]{0,30}\\b(?:approv|confirm)" +
  "|(?:get|require|requires|need|needs)\\s+(?:the\\s+)?user'?s?\\s+(?:approval|confirmation)" +
  "|wait[^.\\n]{0,40}confirmation" +
  "|Proceed\\?", I);
const READONLY_RE = re("read-?only|never writes|does not write|nothing is written|without anything changing|no writes", I);
const WRITE_HINT_RE = re("\\b(?:write|writes|written|append|appends|append-only|log|logs|create|creates|scaffold|scaffolds|update|updates|edit|edits|mark|save)\\b", I);
const EXIT_BLOCK_RE = re("\\bexit\\s+[1-9]\\b");

const AUTHORITATIVE_HINTS = ["vault/", "tracking/", "theses/", "decisions/", "research/", "snapshots/", "watchlist/",
  "postmortems/", "values-goals/", "frameworks/", "principles/", "macro-notes/"];
/** Folders of sample harnesses kept for tests and demos: someone else's harness, not this one's instructions. */
/** The folders a runtime loads skills from (each skill: <folder>/<name>/SKILL.md) */
export const SKILL_DIRS = [".claude/skills", "skills", ".agents/skills", ".github/skills", ".cursor/skills", ".gemini/skills", ".opencode/skills",
  ".grok/skills", ".codex/skills"];
const SKIP_PATH_TOKENS = ["http", "node_modules", "package.json", "README", "SKILL.md", "PROTOCOL.md", "CLAUDE.md", "settings.json", "emit.py"];

// --- graph model ---

const AXES_APPROVAL = { verifier: "human", binding: "blocking", locus: "model" };
const AXES_HOOK = { verifier: "deterministic", binding: "blocking", locus: "infrastructure" };

type Attrs = Record<string, any>;

export class Graph {
  nodes = new Map<string, any>();
  edges: any[] = [];
  private seen = new Set<string>();
  adapters = ["claude-code"];
  constructor(public root: string) {}

  node(type: string, name: string, attrs: Attrs = {}): string {
    const nid = `${type}:${name}`;
    const n = this.nodes.get(nid);
    if (n) { for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n[k] = v; }
    else {
      const fresh: Attrs = { id: nid, type, label: name };
      for (const [k, v] of Object.entries(attrs)) fresh[k] = v === undefined ? null : v;
      this.nodes.set(nid, fresh);
    }
    return nid;
  }

  edge(type: string, source: string, target: string, attrs: Attrs = {}) {
    const key = JSON.stringify([type, source, target]);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.edges.push({ type, source, target, ...attrs });
  }

  /** Mark dangling edge targets and orphan nodes. */
  finalize() {
    for (const e of this.edges) for (const end of ["source", "target"]) {
      if (!this.nodes.has(e[end])) {
        const i = e[end].indexOf(":");
        this.nodes.set(e[end], { id: e[end], type: i < 0 ? e[end] : e[end].slice(0, i), label: i < 0 ? "" : e[end].slice(i + 1), missing: true });
      }
    }
    const linked = new Set<string>([...this.edges.map(e => e.source), ...this.edges.map(e => e.target)]);
    for (const [nid, n] of this.nodes) if (!linked.has(nid)) n.orphan = true;
  }

  toJson() {
    return {
      meta: { adapter: "claude-code", adapters: this.adapters, root: this.root, schema: "0.1" },
      nodes: sorted([...this.nodes.values()], n => n.id),
      edges: this.edges,
    };
  }
}

// --- helpers ---

export function read(path: string): string {
  try { return readText(path, "replace"); } catch { return ""; }
}
export const lineCount = (text: string) => (text ? count(text, "\n") + 1 : 0);
const ws = re("\\s+");
const squash = (s: string) => ws.sub(s, " ");

export function frontmatter(text: string): Record<string, string> {
  const m = FRONTMATTER_RE.match(text);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of splitlines(m.group(1)!)) {
    if (line.includes(":") && !(line.startsWith(" ") || line.startsWith("\t") || line.startsWith("-"))) {
      const i = line.indexOf(":");
      fm[strip(line.slice(0, i))] = strip(line.slice(i + 1));
    }
  }
  return fm;
}

const GOAL_RE = re("^Goal:\\s*(.+)$", M);
const STEP_RE = re("^\\s*(?:\\d+[a-z]?\\.\\s+\\*\\*(.+?)\\*\\*|\\*\\*Step \\d+[^*—]*—\\s*(.+?)\\.?\\*\\*)", M);
const DONTS_RE = re("^## Don'ts\\s*\\n(.*?)(?:\\n## |\\Z)", flags(S, M));

/** First prose paragraph: what a document says it is. */
export function firstParagraph(text: string): string {
  const body = FRONTMATTER_RE.sub(text, "");
  for (const block of body.split("\n\n")) {
    const s = strip(block);
    if (s && !["#", "---", "```", "|", "<", "-", ">"].some(p => s.startsWith(p))) return slice(squash(s), 0, 280);
  }
  return "";
}

/** Leading comment block of a shell script: its self-description. */
export function shHeader(text: string): string {
  const lines: string[] = [];
  for (const ln of splitlines(text)) {
    if (ln.startsWith("#!")) continue;
    if (ln.startsWith("#")) lines.push(strip(lstrip(ln, "# ")));
    else if (lines.length || strip(ln)) break;
  }
  return slice(lines.filter(l => l).join(" "), 0, 280);
}

const DOCSTRING = re(`\\s*(?:"""|''')(.*?)(?:"""|''')`, S);
export function pyDocstring(text: string): string {
  const m = DOCSTRING.match(text);
  return m ? slice(strip(squash(m.group(1)!)), 0, 280) : "";
}

/** What a skill declares about itself: goal, procedure steps, constraints. */
function skillSubstance(text: string) {
  const goal = GOAL_RE.search(text);
  const steps: string[] = [];
  for (const m of STEP_RE.finditer(text)) {
    const title = rstrip(strip(m.group(1) || m.group(2) || ""), ".");
    if (title) steps.push(slice(squash(title), 0, 90));
  }
  const dm = DONTS_RE.search(text);
  let constraints: string[] = [];
  if (dm) constraints = splitlines(dm.group(1)!).filter(l => strip(l).startsWith("- "))
    .map(l => slice(squash(strip(slice(strip(l), 2))), 0, 160)).slice(0, 8);
  return {
    goal: goal ? slice(strip(goal.group(1)!), 0, 220) : null,
    steps: steps.length ? steps.slice(0, 10) : null,
    constraints: constraints.length ? constraints : null,
  };
}

const COND_RE = re("^\\s*[-*]?\\s*(?:\\d+[a-z]?\\.\\s+)?\\**(If|When|Unless|Only if|Otherwise|Else if)\\b.{4,}", M);
const ASK_RE = re("^.*\\bask:?\\s*[\"“].+", flags(M, I));
const NEG_RE = re("^\\s*[-*]\\s+(?:\\*\\*)?(?:Never|Don'?t|Do not|Always)\\b.+", flags(M, I));
const FENCE_RE = re("^[ \\t]*```(\\w*)[ \\t]*\\n(.*?)^[ \\t]*```", flags(S, M));

const clean = (s: string, cap = 150) => slice(strip(squash(strip(strip(s), "*_ "))), 0, cap);

/** L0 statements: a unit body as typed statements (pointers, invocations, conditions, constraints, asks, emissions, examples). */
export function statementInventory(body: string, skillNames: Iterable<string>): Attrs | null {
  const names = new Set(skillNames);
  const inv: Attrs = {};
  const put = (kind: string, xs: string[], cap = 20) => {
    const u = unique(xs).filter(x => x);
    if (u.length) inv[kind] = u.slice(0, cap);
  };
  const pointers: string[] = [];
  for (const m of PATH_RE.finditer(body)) {
    const p = normPath(m.group(0)!);
    if (!p.includes("/") || ["http", "node_modules"].some(t => p.includes(t))) continue;
    if (re("\\.\\w{1,5}$").search(p) || p.endsWith("/") || count(p, "/") >= 2) pointers.push(p);
  }
  put("pointers", pointers);
  put("invocations", [...SKILL_MENTION_RE.finditer(body).filter(m => names.has(m.group(1)!)).map(m => `/${m.group(1)}`),
    ...LIB_CALL_RE.finditer(body).map(m => `lib/${m.group(1)}.py`)]);
  put("conditions", COND_RE.finditer(body).map(m => clean(m.group(0)!)));
  put("constraints", NEG_RE.finditer(body).map(m => clean(m.group(0)!)));
  put("asks", ASK_RE.finditer(body).map(m => clean(m.group(0)!)));
  put("emissions", EMIT_RE.finditer(body).map(m => m.group(1)!));
  put("examples", FENCE_RE.finditer(body).map(m => `\`\`\`${m.group(1) || "text"} · ${count(m.group(2)!, "\n") + 1} lines`));
  return Object.keys(inv).length ? inv : null;
}

/** The sentence that makes this a gate, quoted; searches the body only. */
export function approvalEvidence(text: string): string | null {
  const body = FRONTMATTER_RE.sub(text, "");
  const m = APPROVAL_RE.search(body);
  if (!m) return null;
  const start = (m.start > 0 ? body.lastIndexOf("\n", m.start - 1) : -1) + 1;
  const end = body.indexOf("\n", m.end);
  const line = strip(lstrip(strip(body.slice(start, end !== -1 ? end : body.length)), "-#*0123456789. "));
  return slice(rstrip(squash(line), "*: "), 0, 220);
}

/** A path literal normalized: placeholders to *, markdown and punctuation stripped. */
export function normPath(p: string): string {
  p = re("<[^>]+>").sub(p, "*").split("[").join("*").split("]").join("");
  p = strip(p, ".,;:`'\"*");
  return lstrip(p, "/");
}

export function isSubstratePath(p: string): boolean {
  if (SKIP_PATH_TOKENS.some(t => p.includes(t)) || p.includes("**")) return false;
  if ([".claude/", "~/.claude", "claude/", "skills/", "hooks/", "lib/", "engines/", "patterns/", "config/", "ui/", "guides/", "templates/"]
    .some(x => p.startsWith(x))) return false;
  if (re("\\.(?:py|sh|ts|tsx|js|css)\\b").search(p)) return false;
  if (p.endsWith("/")) return true;
  return !!re("\\.(?:md|json|jsonl|yaml|yml|html)$").search(p);
}
export const isAuthoritative = (p: string) => AUTHORITATIVE_HINTS.some(h => p.includes(h));

const needStr = (x: any): string => { if (!isStr(x)) throw new TypeError("expected str"); return x; };
/** dict.values(), raising when it isn't a dict */
const values = (d: any): any[] => { if (!isDict(d)) throw new TypeError("'list' object has no attribute 'values'"); return Object.values(d); };
const NOT_JSON = Symbol("not json");
/** json.loads, or NOT_JSON where Python would raise ValueError (the only error the reference catches) */
function jsonOr(text: string): any {
  try { return loads(text); } catch { return NOT_JSON; }
}

// --- adapter ---

export function discoverVaults(root: string): [string, string][] {
  const found = new Map<string, string>();
  // the vaults a plugin's config names, first
  for (const p of plugins()) {
    let vs: [string, string][] = [];
    vs = tryPlugin(p, "vaults", () => p.vaults?.(root, read) ?? [], []);
    for (const [vp, how] of vs) if (vp && isdir(join(root, vp)) && !found.has(vp)) found.set(vp, how);
  }
  for (const name of ["vault", "knowledge", "notes", "wiki"])
    if (isdir(join(root, name)) && !found.has(name)) found.set(name, "conventional name");
  for (const name of sorted(listdir(root)))
    if (!name.startsWith(".") && isdir(join(root, name, ".obsidian")) && !found.has(name)) found.set(name, "has an .obsidian folder");
  return sorted([...found.entries()]);
}

// --- checkpoint contracts ---

const CONFIRM_LINE_RE = re("confirm|approv|go-ahead|sign-off", I);
const SAY_RE = re("must say|should say|say something like|types?\\b|reply with|respond with|explicit", I);
const EXAMPLE_RE = re("something like|such as|e\\.g\\.|for example|\\blike\\b", I);
const STRICT_RE = re("non-negotiable|never|always|must not|under no circumstances", I);
const EXTRA_RE = re("\\b(extra|second|additional|another|one more)\\b", I);
const QUOTED_RE = re("[\"“]([^\"”]{2,40})[\"”]");
const ASKS_RE = re("\\b(ask|asks|await|wait for|stop and|require|requires|before the actual)\\b", I);

export function checkpointRules(text: string, path: string): Attrs[] {
  const rules: Attrs[] = [];
  splitlines(text).forEach((line, idx) => {
    const i = idx + 1, s = strip(line);
    if (!(CONFIRM_LINE_RE.search(line) && SAY_RE.search(line))) return;
    if (re("^(description|goal)\\s*:", I).match(s) || re("don'?t ask", I).search(s)) return;
    const phrases: string[] = QUOTED_RE.findall(line);
    const extra = !!EXTRA_RE.search(line);
    if (!(phrases.length || extra || ASKS_RE.search(line))) return;
    const questions = phrases.filter(x => rstrip(x).endsWith("?"));
    const replies = phrases.filter(x => !questions.includes(x));
    rules.push({
      line: i, path, text: slice(s, 0, 400), phrases: replies, question: questions.length ? questions[0] : null,
      phrase_mode: replies.length && EXAMPLE_RE.search(line) ? "example" : replies.length ? "exact" : "any",
      confirmations: EXTRA_RE.search(line) ? 2 : 1,
      claims_strict: !!STRICT_RE.search(line),
      applies_to: re("`([^`]+\\.(?:md|json|ya?ml))`").findall(line),
    });
  });
  return rules;
}

/** Free Rein's helpers, for plugins: they read text exactly as the rest of Free Rein does */
export const KIT: Kit = {
  re, flags, py: pyAll, firstParagraph, pyDocstring, lineCount, checkpointRules, statementInventory, normPath, isSubstratePath, isAuthoritative,
  finding: (cls: string, severity: string, subject: string, detail: string, meta?: any) => require("../judge/lint").finding(cls, severity, subject, detail, meta),
};

/** a draft's copy -> the folder it was copied from, so its history is the real one */
export const HISTORY_FOR = new Map<string, string>();

export function extract(root: string): Graph {
  const g = new Graph(root);
  const home = expanduser("~/.claude");
  // plugins the harness uses (a framework on top of the runtime): their parts are read at fixed points below
  const active = used(root);
  g.adapters = ["claude-code", ...active.map(p => p.id)];
  const ctx: ReadContext = { g, root, home, skills: [], read, hookNode: (p, e) => hookNode(p, e), kit: KIT };
  // each plugin's step; one that fails is left out (and recorded), and the read goes on
  const each = (fn: (p: any) => void, step = "read") => { for (const p of active) tryPlugin(p, step, () => fn(p), undefined); };

  // 1. Injection surfaces: the CLAUDE.md chain, and other runtimes' instruction files
  const surfaceTexts = new Map<string, string>();
  for (const [label, path] of [
    ["project-claude-md", join(root, "CLAUDE.md")], ["global-claude-md", join(home, "CLAUDE.md")],
    ["project-agents-md", join(root, "AGENTS.md")], ["project-dotclaude-claude-md", join(root, ".claude", "CLAUDE.md")],
    ["local-claude-md", join(root, "CLAUDE.local.md")], ["project-gemini-md", join(root, "GEMINI.md")],
    ["project-copilot-md", join(root, ".github", "copilot-instructions.md")], ["global-codex-agents-md", expanduser("~/.codex/AGENTS.md")],
    ["global-gemini-md", expanduser("~/.gemini/GEMINI.md")], ["global-copilot-md", expanduser("~/.copilot/copilot-instructions.md")],
    ["global-opencode-agents-md", expanduser("~/.config/opencode/AGENTS.md")]]) {
    const text = read(path);
    if (text) {
      g.node("surface", label, { injection: "session-start", weight: lineCount(text), summary: firstParagraph(text), provenance: { path } });
      surfaceTexts.set(label, text);
    }
  }

  // 1b. Folder-level CLAUDE.md files load on trigger
  const NOT_SOURCE = new Set(["node_modules", "dist", "build", "vendor"]);
  for (const [dp, , fs] of walk(root, withoutSamples(root, x => !x.startsWith(".") && !NOT_SOURCE.has(x)))) {
    if (dp !== root && fs.includes("CLAUDE.md")) {
      const rel = relpath(dp, root);
      const text = read(join(dp, "CLAUDE.md"));
      g.node("surface", `nested-claude-md:${rel}`, { injection: "on-trigger", weight: lineCount(text), summary: firstParagraph(text),
        provenance: { path: join(dp, "CLAUDE.md") } });
    }
  }

  // 2. Skills -> unit nodes
  const skillPaths = new Map<string, string>();
  for (const rel of SKILL_DIRS) {
    const base = join(root, ...rel.split("/"));
    for (const d of isdir(base) ? sorted(listdir(base)) : []) {
      const sp = join(base, d, "SKILL.md");
      if (!isfile(sp)) continue;
      if (!skillPaths.has(d)) skillPaths.set(d, sp);
      else if (realpath(skillPaths.get(d)!) !== realpath(sp)) skillPaths.set(`${d}@${rel.split("/")[0]}`, sp);
    }
  }
  const skillNames = sorted([...skillPaths.keys()]);
  ctx.skills = skillNames;
  const skillSet = new Set(skillNames);
  const skillBodies = new Map<string, [string, string]>();
  for (const name of skillNames) {
    const path = skillPaths.get(name)!;
    const text = read(path);
    skillBodies.set(name, [path, text]);
    const fm = frontmatter(text);
    const sub = skillSubstance(text);
    const bodyOnly = FRONTMATTER_RE.sub(text, "");
    g.node("unit", name, { activation: "semantic", weight: lineCount(text), checkpoint_rules: checkpointRules(text, relpath(path, root)),
      readonly: !!READONLY_RE.search(text), routing_signal: slice(fm.description ?? "", 0, 200),
      goal: sub.goal, steps: sub.steps, constraints: sub.constraints, statements: statementInventory(bodyOnly, skillNames), provenance: { path } });
  }

  // 3. A plugin's own documents (a framework's protocols or specs)
  each(p => p.afterSkills?.(ctx), "afterSkills");

  // 3b. Surface references: CLAUDE.md pointing at skills
  for (const [label, text] of surfaceTexts)
    for (const m of SKILL_MENTION_RE.finditer(text)) if (skillSet.has(m.group(1)!)) g.edge("routes-to", `surface:${label}`, `unit:${m.group(1)}`);

  // 4. Per-skill edges
  for (const [name, [, text]] of skillBodies) {
    const src = `unit:${name}`;
    const body = FRONTMATTER_RE.sub(text, "");
    for (const m of SKILL_MENTION_RE.finditer(body)) if (skillSet.has(m.group(1)!) && m.group(1) !== name) g.edge("invokes", src, `unit:${m.group(1)}`);
    for (const m of BACKTICK_NAME_RE.finditer(body)) if (skillSet.has(m.group(1)!) && m.group(1) !== name) g.edge("invokes", src, `unit:${m.group(1)}`);
    // what a plugin's tools a skill uses (a framework's engines, scripts, events)
    each(p => p.skillEdges?.(ctx, src, body), "skillEdges");
    // path literals -> reads/writes (a write verb on the same line decides)
    for (const line of splitlines(body)) {
      for (const m of PATH_RE.finditer(line)) {
        const p = normPath(m.group(0)!);
        if (!isSubstratePath(p)) continue;
        const sid = g.node("substrate", p, { authoritative: isAuthoritative(p) });
        g.edge(WRITE_HINT_RE.search(line) ? "writes" : "reads", src, sid, { provenance: { heuristic: true } });
      }
    }
    if (body.includes("templates/")) {
      g.node("substrate", "templates/", { authoritative: false });
      g.edge("scaffolds-from", src, "substrate:templates/");
    }
  }

  // 5. Soft gates: approval language interposes a gate; writes are rewired through it
  for (const [name, [path, text]] of skillBodies) {
    const src = `unit:${name}`;
    if (!APPROVAL_RE.search(text) || READONLY_RE.search(text)) continue;
    const writes = g.edges.filter(e => e.source === src && e.type === "writes");
    if (!writes.length && WRITE_HINT_RE.search(text)) {
      for (const e of g.edges) {
        if (e.source === src && e.type === "reads" && truthy((g.nodes.get(e.target) || {}).authoritative)) {
          e.type = "writes";
          (e.provenance ??= {}).promoted_from_read = true;
          writes.push(e);
        }
      }
    }
    if (!writes.length && !WRITE_HINT_RE.search(text)) continue;
    const gid = g.node("gate", `approval:${name}`, { imparts: AXES_APPROVAL, requires: [], evidence: approvalEvidence(text), provenance: { path } });
    for (const e of writes) { e.source = gid; Object.assign(e, AXES_APPROVAL); }
    g.edge("writes", src, gid);
  }

  // 6. Hooks: executors; blocking-capable ones are gates
  const hookNode = (path: string, event: string) => {
    const text = read(path);
    const hname = relpath(path, root);
    g.node("executor", hname, { activation: "event", runtime: "inline", event, weight: lineCount(text), summary: shHeader(text), provenance: { path } });
    if (EXIT_BLOCK_RE.search(text)) {
      const gid = g.node("gate", hname, { imparts: AXES_HOOK, requires: ["hook-runtime"],
        evidence: "script exits non-zero — deterministically blocks the action", summary: shHeader(text), provenance: { path } });
      g.edge("invokes", `executor:${hname}`, gid);
    }
    if (text.includes("emit") || text.includes("events.jsonl")) {
      g.node("sink", "telemetry-events");
      g.edge("emits", `executor:${hname}`, "sink:telemetry-events");
    }
  };
  // a plugin's own hook scripts
  each(p => p.ownHooks?.(ctx), "ownHooks");

  // 7. Hook registration from settings.json -> binds edges
  for (const [label, spath] of [["global-settings", join(home, "settings.json")], ["project-settings", join(root, ".claude", "settings.json")]]) {
    const text = read(spath);
    if (!text) continue;
    g.node("config", label, { provenance: { path: spath } });
    const settings = jsonOr(text);
    if (settings === NOT_JSON) continue;
    const perms = or(get(settings, "permissions"), {});
    const rules = ["allow", "deny", "ask"].reduce((a, k) => a + pylen(or(get(perms, k), [])), 0);
    if (rules) {
      const pid = g.node("gate", `permissions:${label}`, { kind: "permission-policy",
        imparts: { verifier: "structural", binding: "blocking", locus: "infrastructure" }, requires: [], rules,
        evidence: `${rules} allow / deny / ask rules, decided before the model acts`, provenance: { path: spath } });
      g.edge("binds", `config:${label}`, pid);
    }
    for (const [event, entries] of items(or(get(settings, "hooks"), {}))) {
      for (const entry of isList(entries) ? entries : []) {
        for (const h of iter(get(entry, "hooks", []))) {
          const cmd = get(h, "command", "");
          // a hook that runs one of a plugin's own scripts, read above
          const own = active.map(p => tryPlugin(p, "ownHookFor", () => p.ownHookFor?.(ctx, needStr(cmd)) ?? null, null)).find(x => x);
          if (own) {
            g.edge("binds", `config:${label}`, own, { event, matcher: get(entry, "matcher", "") });
            continue;
          }
          for (let tok of re("[\\w$./{}~-]+\\.(?:sh|py|js|ts|mjs)").findall(cmd) as string[]) {
            tok = tok.split("$CLAUDE_PROJECT_DIR").join(root).split("${CLAUDE_PROJECT_DIR}").join(root);
            const sp = isabs(tok) ? tok : join(root, tok);
            if (isfile(sp) && abspath(sp).startsWith(abspath(root))) {
              const rel = relpath(sp, root);
              if (!g.nodes.has(`executor:${rel}`)) hookNode(sp, event);
              g.edge("binds", `config:${label}`, `executor:${rel}`, { event, matcher: get(entry, "matcher", "") });
            }
          }
        }
      }
    }
  }

  // 7a0. A blocking hook on Stop is a completion check
  for (const e of g.edges) {
    if (e.type === "binds" && (e.event === "Stop" || e.event === "SubagentStop")) {
      const gid = "gate:" + e.target.slice(e.target.indexOf(":") + 1);
      if (g.nodes.has(gid)) g.nodes.get(gid).on_completion = true;
    }
  }

  // 7a. A blocking hook before Edit/Write sits in front of every file edit
  const WRITE_TOOLS = re("(^|\\|)\\s*(Edit|Write|MultiEdit|NotebookEdit|\\*)\\s*(\\||$)|^$");
  for (const e of g.edges) {
    if (e.type !== "binds" || e.event !== "PreToolUse") continue;
    const gid = "gate:" + e.target.slice(e.target.indexOf(":") + 1);
    if (g.nodes.has(gid) && WRITE_TOOLS.search(or(e.matcher ?? null, ""))) {
      g.nodes.get(gid).guards_writes = true;
      g.nodes.get(gid).matcher = or(e.matcher ?? null, "*");
    }
  }

  // 7b. Subagents and MCP servers
  for (const rel of [".claude/agents", ".github/agents", ".cursor/agents", ".gemini/agents", ".opencode/agents", ".grok/agents"]) {
    const agentsDir = join(root, ...rel.split("/"));
    for (const f of isdir(agentsDir) ? sorted(listdir(agentsDir)) : []) {
      if (!f.endsWith(".md")) continue;
      const ap = join(agentsDir, f);
      const text = read(ap);
      const fm = frontmatter(text);
      const name = f.endsWith(".agent.md") ? f.slice(0, -".agent.md".length) : f.slice(0, -3);
      const nid = !g.nodes.has(`executor:agent:${name}`) ? `agent:${name}` : `agent:${name}@${rel.split("/")[0]}`;
      g.node("executor", nid, { activation: "cascade", runtime: "background", kind: "subagent", weight: lineCount(text),
        summary: slice(fm.description || "", 0, 200), provenance: { path: ap } });
    }
  }
  const codexAgents = join(root, ".codex", "agents");
  for (const f of isdir(codexAgents) ? sorted(listdir(codexAgents)) : [])
    if (f.endsWith(".toml")) g.node("executor", `agent:${f.slice(0, -5)}`, { activation: "cascade", runtime: "background", kind: "subagent",
      runtime_core: "codex", provenance: { path: join(codexAgents, f) } });

  // 7d. Working state kept on disk
  const STATE_FILES: Record<string, string> = { "progress.md": "progress", "claude-progress.md": "progress", "feature_list.json": "feature-list",
    "features.json": "feature-list", "session-handoff.md": "handoff", "handoff.md": "handoff" };
  for (const f of sorted(listdir(root))) {
    const kind = STATE_FILES[f.toLowerCase()];
    if (kind && isfile(join(root, f))) g.node("substrate", f, { kind, discovered: true, authoritative: false, provenance: { path: join(root, f) } });
  }
  // 7d2. Session state in .claude/state/
  const sdir = join(root, ".claude", "state");
  for (const f of isdir(sdir) ? sorted(listdir(sdir)) : [])
    if (isfile(join(sdir, f)) && !f.startsWith(".")) g.node("substrate", `.claude/state/${f}`, { kind: "session-state", discovered: true,
      authoritative: false, provenance: { path: join(sdir, f) } });

  // 7e. Environment: root and one level down
  const LOCKS = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "uv.lock", "poetry.lock", "Pipfile.lock", "Cargo.lock", "go.sum", "Gemfile.lock"];
  const PINS = [".nvmrc", ".node-version", ".python-version", ".tool-versions", "rust-toolchain.toml", "rust-toolchain", "mise.toml", ".mise.toml"];
  const SETUP = ["init.sh", "setup.sh", "bootstrap.sh", "install.sh", "Dockerfile", "flake.nix", "devbox.json"];
  const places = [root, ...sorted(listdir(root)).filter(x => isdir(join(root, x)) && !x.startsWith(".") && !NOT_SOURCE.has(x)).map(x => join(root, x))];
  for (const base of places) {
    const rel = relpath(base, root);
    for (const f of listdir(base)) {
      const fp = join(base, f);
      const kind = LOCKS.includes(f) ? "env-lock" : PINS.includes(f) ? "env-pin" : SETUP.includes(f) ? "env-setup" : null;
      if (kind) g.node("config", rel === "." ? f : `${rel}/${f}`, { kind, discovered: true, provenance: { path: fp } });
    }
    if (isdir(join(base, ".devcontainer"))) g.node("config", rel === "." ? ".devcontainer" : `${rel}/.devcontainer`,
      { kind: "env-setup", discovered: true, provenance: { path: join(base, ".devcontainer") } });
    const checks: string[] = [];
    const mk = read(join(base, "Makefile")) + read(join(base, "justfile"));
    checks.push(...["test", "check", "lint", "typecheck"].filter(m => re(`^${m}\\s*:`, M).search(mk)));
    const pkg = jsonOr(read(join(base, "package.json")) || "{}");
    if (pkg !== NOT_JSON) checks.push(...iter(or(get(pkg, "scripts"), {})).filter(s => ["test", "check", "lint", "typecheck"].includes(s)));
    if (checks.length) g.node("config", rel === "." ? "check-commands" : `${rel}/check-commands`, { kind: "env-check", discovered: true,
      commands: sorted(unique(checks)), provenance: { path: base } });
  }

  // other runtimes' MCP configs
  for (const [rel, key] of [[".vscode/mcp.json", "servers"], [".cursor/mcp.json", "mcpServers"], [".gemini/settings.json", "mcpServers"], ["opencode.json", "mcp"]]) {
    const mp = join(root, ...rel.split("/"));
    const v = jsonOr(read(mp) || "{}");
    const found = v === NOT_JSON ? {} : or(get(v, key), {});
    for (const sname of sorted(isDict(found) ? Object.keys(found) : [])) {
      const nid = !g.nodes.has(`executor:mcp:${sname}`) ? `mcp:${sname}` : `mcp:${sname}@${rel.split("/")[0]}`;
      g.node("executor", nid, { activation: "cascade", runtime: "inline", kind: "mcp", provenance: { path: mp } });
    }
  }
  const ctoml = join(root, ".codex", "config.toml");
  for (const sname of re("^\\[mcp_servers\\.([\\w-]+)\\]", M).findall(read(ctoml)) as string[])
    g.node("executor", `mcp:${sname}@codex`, { activation: "cascade", runtime: "inline", kind: "mcp", provenance: { path: ctoml } });
  const mcpPath = join(root, ".mcp.json");
  const mv = jsonOr(read(mcpPath) || "{}");
  const servers = mv === NOT_JSON ? {} : or(get(mv, "mcpServers"), {});
  for (const sname of sorted(iter(servers)))
    g.node("executor", `mcp:${sname}`, { activation: "cascade", runtime: "inline", kind: "mcp", provenance: { path: mcpPath } });
  if (truthy(servers)) g.node("config", "mcp-json", { provenance: { path: mcpPath } });

  // 7c. Knowledge bases, found directly
  for (const [vdir, how] of discoverVaults(root)) {
    const full = join(root, vdir);
    const notes: string[] = [];
    for (const [dp, , fs] of walk(full)) if (!dp.includes(".obsidian")) for (const f of fs) if (f.endsWith(".md")) notes.push(join(dp, f));
    if (notes.length < 3) continue;
    g.node("substrate", rstrip(vdir, "/") + "/", { authoritative: true, discovered: true, kind: "vault", files: notes.length, found_by: how,
      obsidian: isdir(join(full, ".obsidian")), provenance: { path: full } });
    const gated = notes.filter(n => re("^##\\s*Exit gate|^done_when:|^verify:", M).search(read(n)));
    if (gated.length) g.node("substrate", rstrip(vdir, "/") + "/#success-criteria", { kind: "success-criteria", discovered: true,
      authoritative: true, files: gated.length, provenance: { path: full } });
    for (const n of notes) {
      const base = basename(n).toLowerCase();
      if (base.startsWith("decisions") && base.endsWith(".md")) g.node("substrate", relpath(n, root), { authoritative: true, discovered: true,
        kind: "decision-log", provenance: { path: n } });
    }
  }

  // 7f. Signals for settings-shaped pieces
  harnessSignals(g, root, home);

  // 8. A plugin's own config, specs, and what its tools write
  each(p => p.afterSignals?.(ctx), "afterSignals");

  // 11. The runtime floor: recorded, not omitted
  const bb = g.node("black-box", "claude-code-runtime", { opacity: "proprietary",
    evidence: "system prompt, context management, and built-in tool behavior are not inspectable from the repo", requires: [] });
  for (const n of [...g.nodes.values()])
    if (n.type === "surface" && (n.id.includes("claude-md") || n.id.includes("agents-md"))) g.edge("reads", bb, n.id);

  stampParts(g);
  // which contexts (modes, presets) each node is live in, when a plugin has them
  each(p => p.contexts?.(ctx), "contexts");
  locate(g);
  g.finalize();
  return g;
}

// --- signals for settings-shaped pieces ---

function _json(path: string): Attrs {
  const v = jsonOr(read(path) || "{}");
  return v !== NOT_JSON && isDict(v) ? v : {};
}

function _files(base: string, pattern: string, deep = false): string[] {
  if (!isdir(base)) return [];
  const rx = re(pattern);
  if (deep) {
    const out: string[] = [];
    for (const [dp, , fs] of walk(base)) for (const f of fs) if (rx.search(f)) out.push(join(dp, f));
    return sorted(out);
  }
  return sorted(listdir(base).filter(f => rx.search(f)).map(f => join(base, f)));
}

// a connector you haven't signed in to still offers its sign-in tools (authenticate, complete_authentication):
// those don't make it connected, only its other tools do
const CONNECTED_RE = re("mcp__claude_ai_([A-Za-z0-9]+(?:_[A-Za-z0-9]+)*?)__(\\w+)");
const SIGN_IN_TOOL = re("^(complete_)?authenticat");
const UNAUTH_RE = re("require authentication[^\\n\\\\]*((?:\\\\n|\\n)(?:claude\\.ai [^\\n\\\\]+(?:\\\\n|\\n)?)+)");

/** {name: "connected" | "not signed in"} from session transcripts. */
export function connectorsSeen(texts: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of texts) {
    for (const m of UNAUTH_RE.finditer(t))
      for (const name of re("claude\\.ai ([^\\n\\\\]+)").findall(m.group(1)!) as string[]) { const k = strip(name); if (!(k in out)) out[k] = "not signed in"; }
    for (const m of CONNECTED_RE.finditer(t)) {
      const k = m.group(1)!.split("_").join(" ");
      if (SIGN_IN_TOOL.search(m.group(2)!)) { if (!(k in out)) out[k] = "not signed in"; }
      else out[k] = "connected";
    }
  }
  return out;
}

const ACCOUNT_SERVER_RE = re("gmail|google[-_ ]?(calendar|drive|workspace)|outlook|office365|calendar|gdrive|drive|slack|notion|mail", I);
const BROWSER_SERVER_RE = re("playwright|puppeteer|browser|chrome|selenium", I);
const ISSUES_SERVER_RE = re("linear|jira|github|gitlab|asana|atlassian|issues", I);
const FIXER_RE = re("\\b(prettier|black|ruff|eslint[^\\n]*--fix|biome|gofmt|goimports|rustfmt|cargo fmt|swiftformat|clang-format|autopep8|isort|stylua|shfmt|dprint)\\b");
const DECISION_RE = re("typesafe[-_]sdk|TypeSafeClient|TYPESAFE_API_KEY|api\\.typesafe\\.ai|\\bjev-(latest|\\d)|typesafe/jev|/v1/decisions\\b|decisions\\.create\\(|gpt-6-luna|\\blaya\\b");
const RECALL_SERVER_RE = re("memory|recall|history|transcript|episodic", I);

/** str() of a settings value, for evidence text */
const pystr = (x: any): string => x === true ? "True" : x === false ? "False" : x === null || x === undefined ? "None" : String(x);
/** the last word of a command, expanded: the script it runs */
const lastWord = (c: string) => { const w = splitWs(c); return w.length ? read(expanduser(w[w.length - 1])) : ""; };

function harnessSignals(g: Graph, root: string, home: string) {
  const sig = (piece: string, label: string, path: string, attrs: Attrs = {}) =>
    g.node("config", `sig:${piece}:${label}`, { kind: `sig-${piece}`, discovered: true, provenance: { path }, ...attrs });

  const S_: [string, string, Attrs][] = ([["user", join(home, "settings.json")], ["project", join(root, ".claude", "settings.json")],
    ["local", join(root, ".claude", "settings.local.json")]] as [string, string][]).filter(([, p]) => read(p)).map(([s, p]) => [s, p, _json(p)]);
  const claudeMd = read(join(root, "CLAUDE.md")) + read(join(root, ".claude", "CLAUDE.md"));
  const servers = sorted(unique([...iter(or(get(_json(join(root, ".mcp.json")), "mcpServers"), {})),
    ...iter(or(get(_json(expanduser("~/.claude.json")), "mcpServers"), {}))]));
  const workflows = _files(join(root, ".github", "workflows"), "\\.ya?ml$").map(f => [f, read(f)] as [string, string]);
  const agents = _files(join(root, ".claude", "agents"), "\\.md$").map(f => [f, frontmatter(read(f))] as [string, Record<string, string>]);

  for (const [scope, path, st] of S_) {
    const perms = or(get(st, "permissions"), {});
    const hooks = or(get(st, "hooks"), {});
    if (get(perms, "defaultMode") === "plan") sig("plan-first", scope, path, { evidence: "starts in plan mode" });
    if ("attribution" in st || "includeCoAuthoredBy" in st) sig("git-workflow", `attribution@${scope}`, path, { evidence: "commit and PR attribution set" });
    if (truthy(get(hooks, "SessionStart"))) sig("session-start", scope, path, { evidence: "SessionStart hook", hook_events: ["SessionStart"] });
    const compact = ["PreCompact", "PostCompact"].filter(e => truthy(get(hooks, e)));
    if (compact.length) sig("compaction", scope, path, { evidence: "PreCompact or PostCompact hook", hook_events: compact });
    if (truthy(get(st, "outputStyle"))) sig("output-style", scope, path, { evidence: `outputStyle: ${pystr(st.outputStyle)}` });
    const plugins = isDict(get(st, "enabledPlugins")) ? Object.entries(st.enabledPlugins).filter(([, v]) => truthy(v)).map(([k]) => k) : [];
    if (plugins.length) {
      sig("plugins", scope, path, { evidence: `${plugins.length} plugin(s) enabled`, n: plugins.length });
      const lsp = plugins.filter(x => x.includes("-lsp@") || x.endsWith("-lsp"));
      if (lsp.length) sig("code-intel", scope, path, { evidence: lsp.join(", ") });
    }
    const env_ = isDict(get(st, "env")) ? st.env : {};
    if (get(st, "model") === "opusplan") sig("model-routing", `opusplan@${scope}`, path, { evidence: "Opus while it plans, Sonnet while it works" });
    if (truthy(get(env_, "CLAUDE_CODE_SUBAGENT_MODEL"))) sig("model-routing", `subagents@${scope}`, path, { evidence: `subagents run on ${pystr(env_.CLAUDE_CODE_SUBAGENT_MODEL)}` });
    const deny = iter(or(get(perms, "deny"), [])).filter(isStr);
    const sb = or(get(st, "sandbox"), {});
    if (deny.some(r => re("(Read|Edit|Write)\\(.*(\\.env|secret|\\.pem|\\.key|credential|\\.ssh|id_rsa|id_ed25519|private|personal|\\.aws|\\.netrc|keychain)", I).match(r))
      || truthy(get(or(get(sb, "filesystem"), {}), "denyRead"))) sig("secrets-out", scope, path, { evidence: "secret files denied" });
    const net = or(get(sb, "network"), {});
    const guarded = [...deny, ...iter(or(get(perms, "ask"), [])).filter(isStr)].some(r => r === "WebFetch" || r === "WebFetch(*)");
    if ((truthy(get(sb, "enabled")) && (truthy(get(net, "allowedDomains")) || truthy(get(net, "deniedDomains"))))
      || deny.some(r => re("WebFetch\\(domain:").match(r))
      || (guarded && iter(or(get(perms, "allow"), [])).some(r => re("WebFetch\\(domain:").match(r))))
      sig("network-limits", scope, path, { evidence: "network limited to named domains" });
    if (truthy(get(hooks, "Notification")) || truthy(get(st, "preferredNotifChannel"))) sig("notifications", scope, path, { evidence: "Notification hook or notification channel",
      ...(truthy(get(st, "preferredNotifChannel")) ? {} : { hook_events: ["Notification"] }) });
    if (truthy(get(st, "env")) || truthy(get(st, "apiKeyHelper"))) sig("env-keys", scope, path, { evidence: "env or apiKeyHelper in settings" });
    for (const entry of iter(or(get(hooks, "PostToolUse"), []))) {
      if (!isDict(entry) || !re("Edit|Write|\\*|^$").search(or(get(entry, "matcher"), ""))) continue;
      const cmds = iter(or(get(entry, "hooks"), [])).filter(isDict).map(h => needStr(get(h, "command", ""))).join(" ");
      const script = lastWord(cmds);
      if (FIXER_RE.search(cmds) || FIXER_RE.search(script)) {
        sig("auto-fix", scope, path, { evidence: `formats or fixes after ${pystr(or(get(entry, "matcher"), "every tool"))}`, hook_events: ["PostToolUse"] });
        break;
      }
    }
    const snaps: [string, any][] = [];
    for (const [ev, es] of items(hooks)) if (isList(es)) for (const e of es) if (isDict(e))
      for (const h of iter(or(get(e, "hooks"), []))) if (isDict(h)) snaps.push([ev, get(h, "command", "")]);
    const snapEvents = unique(snaps.filter(([, c]) => re("\\bgit (stash|commit|worktree add)\\b|\\bgit-checkpoint\\b|\\bsnapshot\\.(sh|py)\\b").search(needStr(c) + " " + lastWord(c))).map(([ev]) => ev));
    if (snapEvents.length) sig("rewind", `hook@${scope}`, path, { evidence: "a hook that snapshots the work", hook_events: snapEvents });
    if (truthy(get(st, "statusLine"))) {
      sig("status-line", scope, path, { evidence: "statusLine set" });
      if (JSON.stringify(st.statusLine).toLowerCase().includes("cost")) sig("cost-tracking", `statusline@${scope}`, path, { evidence: "status line shows cost" });
    }
    const env = or(get(st, "env"), {});
    if (isDict(env) && (truthy(get(env, "CLAUDE_CODE_ENABLE_TELEMETRY")) || truthy(get(env, "OTEL_METRICS_EXPORTER"))))
      sig("cost-tracking", `otel@${scope}`, path, { evidence: "usage metrics exported" });
    if (truthy(get(st, "autoMode"))) sig("decision-model", `automode@${scope}`, path, { evidence: "auto mode's safety check tuned (autoMode)" });
    if (truthy(get(st, "disableClaudeAiConnectors"))) g.node("config", "connectors-off", { kind: "connectors-off", provenance: { path } });
  }

  // workflows: procedures you start by name, conventions, review
  const cmds = _files(join(root, ".claude", "commands"), "\\.md$", true);
  if (cmds.length) sig("commands", "commands", join(root, ".claude", "commands"), { evidence: `${cmds.length} command(s)`, n: cmds.length });
  const provPath = (n: any) => ((n.provenance || {}).path ?? "");
  for (const n of [...g.nodes.values()])
    if (n.type === "unit" && re("disable-model-invocation:\\s*true", I).search(read(provPath(n))))
      sig("commands", n.label, n.provenance.path, { evidence: "a skill you start by name" });
  for (const f of ["commitlint.config.js", "commitlint.config.cjs", ".commitlintrc", ".commitlintrc.json", ".czrc"])
    if (isfile(join(root, f))) sig("git-workflow", f, join(root, f), { evidence: "commit messages checked" });
  for (const hp of [".husky/commit-msg", ".githooks/commit-msg", "hooks/git/commit-msg", ".git/hooks/commit-msg"])
    if (isfile(join(root, hp))) sig("git-workflow", hp, join(root, hp), { evidence: "commit-msg hook" });
  for (const n of [...g.nodes.values()]) {
    if (n.type === "unit" && re("^commit\\b|^git-").match(n.label)) sig("git-workflow", n.label, provPath(n), { evidence: "a commit skill" });
    if ((n.type === "unit" || n.kind === "subagent") && re("review", I).search(n.label)
      && re("verdict|findings|approve|pass(es)?\\b|fail", I).search(read(provPath(n))))
      sig("review-workflow", n.label, provPath(n), { evidence: "a review skill or agent" });
  }
  if (isfile(join(root, "REVIEW.md"))) sig("review-workflow", "REVIEW.md", join(root, "REVIEW.md"), { evidence: "REVIEW.md" });

  // context
  const rules = _files(join(root, ".claude", "rules"), "\\.md$", true);
  if (rules.length) sig("folder-instructions", "rules", join(root, ".claude", "rules"), { evidence: `${rules.length} rule file(s)` });
  if ([...g.nodes.values()].some(n => n.id.startsWith("surface:nested-claude-md:"))) sig("folder-instructions", "nested", root, { evidence: "CLAUDE.md in subfolders" });
  if (re("^@[\\w./~-]+", M).search(claudeMd)) sig("folder-instructions", "imports", join(root, "CLAUDE.md"), { evidence: "@ imports" });
  if (re("^#+\\s*Compact instructions", flags(M, I)).search(claudeMd)) sig("compaction", "claude-md", join(root, "CLAUDE.md"), { evidence: "compact instructions in CLAUDE.md" });
  if (_files(join(root, ".claude", "output-styles"), "\\.md$").length) sig("output-style", "files", join(root, ".claude", "output-styles"), { evidence: "output style files" });

  // tools
  if (isfile(join(root, ".claude-plugin", "plugin.json")) || isfile(join(root, ".claude-plugin", "marketplace.json")))
    sig("plugins", "packaged", join(root, ".claude-plugin"), { evidence: "packaged as a plugin" });
  for (const sname of servers) {
    if (BROWSER_SERVER_RE.search(sname)) sig("sees-app", sname, join(root, ".mcp.json"), { evidence: `${sname} server` });
    if (ACCOUNT_SERVER_RE.search(sname)) sig("connected-accounts", sname, join(root, ".mcp.json"), { evidence: `${sname} server` });
    if (ISSUES_SERVER_RE.search(sname)) sig("task-list", sname, join(root, ".mcp.json"), { evidence: `${sname} server` });
    if (RECALL_SERVER_RE.search(sname)) sig("session-recall", sname, join(root, ".mcp.json"), { evidence: `${sname} server` });
  }
  if (_files(root, "^\\.lsp\\.json$").length) sig("code-intel", "lsp-json", join(root, ".lsp.json"), { evidence: ".lsp.json" });
  // connectors on your claude.ai account, named in the sessions Claude Code keeps for this folder
  const hist = historyDir(HISTORY_FOR.get(root) ?? root);   // null when the home folder doesn't count
  if (![...g.nodes.values()].some(n => truthy(n.kind) && n.kind === "connectors-off")) {
    const texts: string[] = [];
    for (const f of hist ? sorted(_files(hist, "\\.jsonl$"), x => -getmtime(x)).slice(0, 20) : []) {
      try { texts.push(readText(f, "ignore", 4_000_000)); } catch { /* unreadable: skipped */ }
    }
    const seen = connectorsSeen(texts);
    const on = sorted(Object.keys(seen).filter(k => seen[k] === "connected"));
    const off = sorted(Object.keys(seen).filter(k => seen[k] !== "connected"));
    if (on.length) sig("connected-accounts", "claude-ai", hist!, { evidence: "claude.ai connectors: " + on.join(", "), connectors: on, n: on.length });
    else if (off.length) g.node("config", "sig:connected-accounts-offered:claude-ai", { kind: "sig-connected-accounts-offered", discovered: true,
      provenance: { path: hist }, evidence: "offered, not signed in: " + off.join(", "), connectors: off, n: off.length });
  }

  // agents
  const routed = agents.filter(([, fm]) => truthy(fm.model) && fm.model !== "inherit");
  if (routed.length) sig("model-routing", "agents", join(root, ".claude", "agents"), { evidence: `${routed.length} agent(s) with their own model`, n: routed.length });
  for (const [f, text] of workflows) {
    if (re("anthropics/claude-code-action|\\bclaude\\s+-p\\b|\\bclaude\\s+--print\\b").search(text)) sig("ci-agent", basename(f), f, { evidence: "Claude Code runs in GitHub Actions" });
    if (re("--max-turns|--max-budget-usd|max_turns").search(text)) sig("spend-limits", basename(f), f, { evidence: "turn or budget limit on runs" });
  }
  if (agents.some(([f]) => re("^\\s*maxTurns\\s*:", M).search(read(f)))) sig("spend-limits", "agents", join(root, ".claude", "agents"), { evidence: "maxTurns on agents" });
  for (const f of [..._files(root, "\\.(sh|mjs|js|py)$"), ..._files(join(root, "scripts"), "\\.(sh|mjs|js|py)$")])
    if (re("\\bclaude\\b[^\\n]*(--max-turns|--max-budget-usd)").search(read(f))) sig("spend-limits", relpath(f, root), f, { evidence: "turn or budget limit on runs" });

  // modalities: what its models can take in and do (models.ts and its sourced table)
  try {
    const mo = readModels(root, home);
    const coreIds = truthy(mo.cores) ? mo.cores : [mo.core];
    const own = mo.models.filter((m: any) => !coreIds.includes(m.id) && m.found_in.some((f: any) => !pystr(f).startsWith("http")));
    for (const [side, keys] of [["inputs", INPUTS], ["outputs", OUTPUTS]] as [string, string[]][]) {
      for (const k of keys) {
        const by = own.filter((m: any) => get(m[side], k) === true);
        if (by.length) sig("modalities", `${side}:${k}`, by[0].found_in[0],
          { evidence: `${side === "inputs" ? side.slice(0, -1) : "gives"} ${k}: ${by.map((m: any) => needStr(m.name)).join(", ")}` });
      }
    }
  } catch { /* a broken table must not stop the read */ }

  // a decision model
  const deps = ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "package.json", ".env.example", ".env.sample", "Modelfile", "wrangler.toml"].map(f => join(root, f));
  for (const f of [...deps, ..._files(root, "\\.(py|ts|js|mjs)$"), ..._files(join(root, "src"), "\\.(py|ts|js|mjs)$", true).slice(0, 300)]) {
    const m = DECISION_RE.search(read(f));
    if (m) sig("decision-model", relpath(f, root), f, { evidence: m.group(0) });
  }
  for (const sname of servers) if (re("typesafe|jev", I).search(sname)) sig("decision-model", sname, join(root, ".mcp.json"), { evidence: `${sname} server` });

  // configuration
  const shared = join(root, ".claude", "settings.json"), local = join(root, ".claude", "settings.local.json");
  if (read(shared) && (read(local) || read(join(root, ".gitignore")).includes(".claude/settings.local.json")))
    sig("settings-split", "settings", shared, { evidence: "shared settings, personal ones kept local" });
  if (isfile(join(root, ".env.example")) || isfile(join(root, ".env.sample"))) sig("env-keys", "env-example", join(root, ".env.example"), { evidence: "env template checked in" });
  for (const mp of ["/Library/Application Support/ClaudeCode/managed-settings.json", "/etc/claude-code/managed-settings.json"])
    if (isfile(mp) || isdir(mp.split(".json").join(".d"))) sig("managed-policy", "managed", mp, { evidence: "managed settings on this machine" });

  // verification and validation
  if (_files(root, "^playwright\\.config\\.(ts|js|mjs)$").length || _files(root, "^backstop\\.json$").length)
    sig("visual-check", "browser-tests", root, { evidence: "browser or screenshot tests" });
  const vault = join(root, "vault");
  if (_files(vault, "\\.md$", true).slice(0, 400).some(f => re("^verifier:\\s*human", M).search(read(f))))
    sig("sign-off", "vault", vault, { evidence: "work whose gate a person decides" });
  for (const n of [...g.nodes.values()])
    if (n.type === "unit" && re("\\bsign[- ]off\\b|\\baccept(ance)?\\b.*\\b(result|work)\\b", I).search(read(provPath(n))))
      sig("sign-off", n.label, n.provenance.path, { evidence: "a sign-off step" });

  // the notes your agent keeps for itself (memory.ts): this repo, just you, though they sit in your home
  const mem = memory(HISTORY_FOR.get(root) ?? root);
  if (mem && mem.notes.length)
    g.node("surface", "memory", { kind: "persistent-memory", discovered: true, provenance: { path: mem.dir }, n: mem.notes.length,
      summary: `${mem.notes.length} note${mem.notes.length === 1 ? "" : "s"} your agent keeps for itself` });

  // observability
  if (hist && _files(hist, "\\.jsonl$").length)
    sig("transcripts", "history", hist, { evidence: `${_files(hist, ".jsonl$").length} sessions kept`, n: _files(hist, "\\.jsonl$").length });
  if (re("ccusage").search(read(join(root, "package.json")))) sig("cost-tracking", "ccusage", join(root, "package.json"), { evidence: "ccusage" });

  // memory
  for (const f of ["ARCHITECTURE.md", "docs/architecture.md", "docs/ARCHITECTURE.md", "CODEMAP.md", "docs/overview.md"])
    if (isfile(join(root, f))) sig("codebase-map", f, join(root, f), { evidence: f });
  for (const line of splitlines(claudeMd)) {
    if (!re("\\bstart here\\b", I).search(line)) continue;
    for (const f of re("[\\w./-]+\\.md").findall(line) as string[]) {
      if (!isfile(join(root, f)) || f === "CLAUDE.md" || f === "README.md") continue;
      sig("codebase-map", f, join(root, f), { evidence: `${f}, named in CLAUDE.md as the place to start` });
    }
  }
  for (const f of ["TODO.md", "tasks.md", "TASKS.md", "BACKLOG.md"])
    if (isfile(join(root, f))) sig("task-list", f, join(root, f), { evidence: f });
  const onto = _files(root, "\\.(owl|ttl|jsonld|rdf)$|^(ontology|taxonomy|graph-schema|schema)\\.md$|-schema\\.md$");
  for (const base of ["model", "docs", "vault", "schema", "ontology"])
    onto.push(..._files(join(root, base), "\\.(owl|ttl|jsonld)$|^(ontology|taxonomy|graph-schema|types)\\.md$|-schema\\.md$"));
  for (const f of sorted(unique(onto))) sig("ontology", relpath(f, root), f, { evidence: relpath(f, root) });
}

// --- where each piece is ---

/** Lines (1-based, inclusive) of the value under "key" in a JSON file, by counting brackets. null when absent. */
export function jsonBlock(text: string, key: string, start = 0): [number, number] | null {
  const i = text.indexOf(`"${key}"`, start);
  if (i < 0) return null;
  let j = i + key.length + 2;
  while (j < text.length && " \t\n\r:".includes(text[j])) j++;
  const first = count(text, "\n", 0, i) + 1;
  if (j >= text.length || !"[{".includes(text[j])) return [first, first];
  let depth = 0, k = j, quoted = false;
  while (k < text.length) {
    const c = text[k];
    if (quoted) { if (c === "\\") k++; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { depth--; if (depth === 0) return [first, count(text, "\n", 0, k) + 1]; }
    k++;
  }
  return [first, first];
}

/** provenance.lines for every node that points at a file: the whole file, or the exact block in a shared one. */
function locate(g: Graph) {
  const texts = new Map<string, string | null>();
  const textOf = (path: string) => {
    if (!texts.has(path)) texts.set(path, isfile(path) ? read(path) : null);
    return texts.get(path)!;
  };
  for (const n of g.nodes.values()) {
    const prov = n.provenance || {};
    const path = prov.path;
    if (!truthy(path) || truthy(prov.lines)) continue;
    const text = textOf(path);
    if (text === null) continue;
    const whole: [number, number] = [1, Math.max(1, lineCount(text))];
    let lines: [number, number] = whole;
    const label: string = n.label ?? "";
    if (n.kind === "permission-policy") lines = jsonBlock(text, "permissions") || whole;
    else if (n.kind === "mcp" && label.startsWith("mcp:")) lines = jsonBlock(text, label.slice(4).split("@")[0], Math.max(0, text.indexOf('"mcpServers"'))) || whole;
    else if (n.type === "config" && path.endsWith(".json") && (n.kind === undefined || n.kind === null) && label.endsWith("settings")) lines = jsonBlock(text, "hooks") || whole;
    else if (n.type === "gate" && label.startsWith("approval:")) {
      const owner = g.nodes.get(`unit:${label.slice("approval:".length)}`) || {};
      const at = sorted((owner.checkpoint_rules || []).filter((r: any) => truthy(r.line)).map((r: any) => r.line)) as number[];
      if (at.length) lines = [at[0], at[at.length - 1]];
      else {
        const fm = FRONTMATTER_RE.match(text);
        const m = APPROVAL_RE.search(text, fm ? fm.end : 0);
        if (m) { const ln = count(text, "\n", 0, m.start) + 1; lines = [ln, ln]; }
      }
    }
    prov.lines = lines;
    n.provenance = prov;
  }
  for (const e of g.edges) {
    const src = g.nodes.get(e.source) || {};
    const spath = (src.provenance || {}).path;
    if (e.type === "binds" && truthy(e.event) && truthy(spath) && truthy(textOf(spath))) {
      const hooksAt = textOf(spath)!.indexOf('"hooks"');
      (e.provenance ??= {}).path = spath;
      e.provenance.lines = jsonBlock(textOf(spath)!, e.event, Math.max(0, hooksAt));
    }
  }
}

// --- conformance ---

/** Tag each node with the catalog part it conforms to. */
function stampParts(g: Graph) {
  for (const n of g.nodes.values()) {
    const t = n.type, nid: string = n.id;
    let part: string | null = null;
    if (t === "surface") {
      if (n.kind === "persistent-memory") part = "persistent-memory";
      else if (nid.startsWith("surface:global-")) part = "user-constitution";
      else if (nid.startsWith("surface:project-") || nid.includes("claude-md") || nid.includes("agents-md")) part = "project-constitution";
    } else if (t === "unit") part = "skill";
    else if (t === "contract") part = "engine-protocol";
    else if (t === "gate" && n.kind === "permission-policy") part = "permission-policy";
    else if (t === "gate") part = (n.imparts || {}).locus === "infrastructure" ? "event-hook-gate" : "human-checkpoint";
    else if (t === "substrate") part = truthy(n.authoritative) ? "authoritative-store" : n.kind === "session-state" ? "session-state" : null;
    else if (t === "executor" && n.kind === "subagent") part = "subagent";
    else if (t === "executor" && n.kind === "mcp") part = "tool-extension";
    else if (t === "sink") part = "telemetry-sink";
    else if (t === "config") part = "runtime-binding";
    else if (t === "black-box") part = "proprietary-runtime";
    if (part) n.part = part;
  }
}



