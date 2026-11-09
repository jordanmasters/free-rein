// Statements: the prose of a harness as typed objects (graph-schema.md, Statements).
import { withoutSamples } from "./samples";
import { SKILL_DIRS } from "./extract";
import { createHash } from "crypto";
import { memory } from "./memory";
import {
  re, I, M, S, strip, splitlines, len, slice, count, unique, join, abspath, relpath, dirname, expanduser, isfile, walk, readText,
} from "../py";

export const ACTIONS: [string, string][] = [
  ["force-push", "\\bforce[- ]push(es|ing|ed)?\\b|\\bpush(es|ing)? --force\\b|\\brewrit(e|ing) (shared )?history\\b"],
  ["push", "\\bgit push\\b|\\bpush(es|ing|ed)?\\b(?=[^.]{0,40}\\b(remote|origin|main|master|branch|upstream|github|repo|commits?|changes)\\b)"],
  ["commit", "\\bcommit(s|ting|ted)?\\b"],
  ["delete", "\\brm -r|\\b(delet(e|es|ing|ed)|remov(e|es|ing|ed)|wip(e|es|ing))\\b(?=[^.]{0,30}\\b(files?|folders?|director(y|ies)|branch(es)?|repo|vault|notes?|data)\\b)"],
  // throwing away work, not rows or results: "discard" needs changes, edits or work nearby
  ["discard", "\\bgit reset --hard\\b|\\b(throw(s|ing)? away|discard(s|ing|ed)?)\\b(?=[^.]{0,30}\\b(changes|edits|work|uncommitted|local|commits?)\\b)"],
  ["publish", "\\b(publish(es|ing|ed)?|release(s|d)?|npm publish)\\b"],
  ["deploy", "\\bdeploy(s|ing|ed|ment)?\\b"],
  ["install", "\\binstall(s|ing|ed)?\\b"],
  ["write", "\\b(writ(e|es|ing)|edit(s|ing|ed)?|modif(y|ies|ying)|overwrit(e|es|ing))\\b|\\b(chang(e|es|ing)|updat(e|es|ing))\\b(?=[^.]{0,30}\\b(files?|vault|notes?|docs?|config|settings|\\.md)\\b)|\\b(code|files?|vault|notes?|docs?|config)\\s+(?:or\\s+\\w+\\s+)?(changes|edits|updates)\\b"],
  // a token only when it's a credential ("design tokens" and "token budgets" are not secrets)
  ["read-secrets", "\\b(secrets?|\\.env|credentials?|api keys?|private keys?)\\b|\\b(api|access|auth|bearer|oauth|refresh|session|github|npm|production|sandbox)[ -]tokens?\\b|\\b(hardcod\\w*|leak\\w*|expos\\w*|print\\w*|log|logs|logging|commit\\w*|shar\\w*|stor\\w*|put|keep) (a |the |any |your |raw |one )?(key or )?tokens?\\b|\\btokens?\\b(?=[^.]{0,50}\\b(environment|env vars?|source code|tracked files|in git|out of git)\\b)"],
  ["run", "\\b(run(s|ning)?|execut(e|es|ing))\\b"],
  ["fetch", "\\b(fetch(es|ing)?|download(s|ing)?|curl|wget)\\b"],
  ["send", "\\b(send(s|ing)?|email(s|ing)?|post(s|ing)? (a )?message)\\b"],
];
const TOOLS = "\\b(Bash|Edit|Write|MultiEdit|Read|Grep|Glob|WebFetch|WebSearch|Skill|Agent|AskUserQuestion|TodoWrite|NotebookEdit)\\b";
const PATH = "`([^`\\s]+\\.(?:md|json|ya?ml|toml|py|ts|js|sh|txt|jsonl))`|`((?:\\.?[\\w-]+/)+[\\w.*-]*)`|(?<![\\w/])((?:\\.?[\\w-]+/){1,6}[\\w*-]+\\.(?:md|json|ya?ml|toml|py|ts|js|sh|jsonl))";
const SKILL = "(?:^|[\\s(`])/([a-z][a-z0-9-]{2,})\\b";
const STORE = "\\b(the vault|the knowledge base|vault files?|curated zones?)\\b";

const STRENGTH: [string, string][] = [
  ["must-not", "\\b(never|don'?t|do not|must not|mustn'?t|cannot|can'?t|not allowed|forbidden|no (one|agent|skill) (may|should|can))\\b"],
  ["should-not", "\\b(should ?n['o]t|avoid|prefer not)\\b"],
  ["must", "\\b(always|must|required|exclusively|every time|without exception)\\b|\\bonly (via|through|after|with|by|use|ever|once)\\b|\\bnothing but\\b"],
  ["should", "\\b(should|prefer|recommended|ideally)\\b"],
  ["may", "\\b(may|can|allowed to|is fine to|feel free)\\b"],
];
const TRIGGER = re("\\b(use (this )?(when|to|for|whenever)|triggers? (on|when)|when the user|invoke (it )?when|run (this )?when|applies (when|to))\\b", I);
const CLAIM = re("\\b(is|are) (enforced|gated|blocked|guaranteed|checked|validated|protected)\\b|\\b(goes|go|routes?|flows?) through\\b|\\bis the only (way|path|place)\\b|\\b(all|every) [\\w ]{1,30} (go|goes|are|is) (through|gated|checked|reviewed)\\b|\\bhooks? (block|enforce|refuse|prevent)s?\\b", I);
const DEFINITION = re("^\\s*(?:[-*]\\s*)?\\*\\*([^*]{2,40})\\*\\*\\s*(?:[—:–-]|means|is)\\s+(?!through\\b)\\w|^\\s*(?:[-*]\\s*)?`([^`]{2,30})`\\s*[—:–]\\s+\\w|^\\s*([A-Z][\\w -]{1,30}) (means|is defined as) ", M);
export const STEP = re("^\\s*(?:\\d+[.)]|step \\d+\\b|\\*\\*step \\d+)", I);
const IMPERATIVE = re("^\\s*(?:[-*]\\s+)?(?:\\*\\*)?(read|run|show|write|ask|load|check|create|add|update|commit|open|list|draft|propose|wait|confirm|emit|record|find|look|search|fetch|move|delete|copy|call|use|keep|put|start|stop|set|tell|report|summari[sz]e|compare|walk|surface|offer|present|parse|scan|build|generate|apply|test|describe|name|link|mark|route|log|save|pick|choose|skip|ignore)\\b", I);
const POINTER_ONLY = re("^\\s*(?:[-*]\\s*)?(see|read|refer to|details in|more in|follow)\\b|^\\s*@[\\w./~-]+\\s*$|^\\s*(?:[-*]\\s*)?\\[[^\\]]+\\]\\([^)]+\\)\\s*$", I);
// a fact: how the project is or works, said as description. A label and its value ("Targets: core, vscode"), a sentence
// led by a name in code ("`npm test` runs the tests"), or one whose verb describes ("X is …", "it holds …"). Only what
// the kinds above leave: a fact is never a rule
const FACT = re("^\\s*(?:[-*]\\s*)?(?:\\*\\*[^*]{1,40}\\*\\*|`[^`]{1,60}`|[A-Z][\\w ()/-]{0,30}):\\s+\\S|^\\s*(?:[-*]\\s*)?`[^`]+`\\s+\\w|^\\s*(?:[-*]\\s*)?this (file|repo|repository|project|folder|package)\\b|\\b(is|are|was|were|has|have|holds|keeps|uses|contains|runs|reads|writes|resolves|lives|sits|provides|supports|maps|returns|loads|starts|stores|builds|calls|judges|computes|tracks|requires|defines)\\b", I);
const CODE = re("`[^`]*`");
const HEADING = re("^#{1,6}\\s");

/** What a sentence concerns: actions, tools, paths, skills. */
export function about(t: string): Record<string, string>[] {
  const acts: string[] = [];
  for (const [name, rx] of ACTIONS) if (re(rx, I).search(t) && !(name === "push" && acts.includes("force-push"))) acts.push(name);
  const paths = re(PATH).findall(t).map((m: string[]) => m.find(g => g)!);
  return [...acts.map(a => ({ action: a })), ...unique(re(TOOLS).findall(t) as string[]).map(x => ({ tool: x })),
    ...unique(paths).map(p => ({ path: p })), ...unique(re(SKILL).findall(t) as string[]).map(s => ({ skill: s })),
    ...(re(STORE, I).search(t) ? [{ store: "knowledge-base" }] : [])];
}

/** The words a rule was recognised by: its strength (never, always…) and each action it names, as they appear. */
export function matched(text: string): string[] {
  const t = CODE.sub(text, " "), w: string[] = [];
  for (const [, rx] of STRENGTH) { const m = re(rx, I).search(t); if (m) { w.push(m.group(0)!); break; } }
  for (const [name, rx] of ACTIONS) { const m = re(rx, I).search(text); if (m && !(name === "push" && w.some(x => /force|rewrit/i.test(x)))) w.push(m.group(0)!); }
  return unique(w.map(x => strip(x)).filter(Boolean));
}

function strength(text: string): string | null {
  const t = CODE.sub(text, " ");
  for (const [name, rx] of STRENGTH) if (re(rx, I).search(t)) return name;
  return null;
}

/** [kind, strength] for one line of prose, by pattern. */
export function classify(line: string, inSteps = false): [string, string | null] {
  const raw = strip(line);
  const t = CODE.sub(raw, "X");
  if (POINTER_ONLY.search(raw) && len(t) < 120) return ["pointer", null];
  if (TRIGGER.search(t)) return ["trigger", null];
  if (CLAIM.search(t)) return ["claim", null];
  const st = strength(raw);
  if (st === "must-not" || st === "should-not" || st === "must" || (st === "should" && re("\\b(before|after|first|without)\\b", I).search(t)))
    return ["rule", st];
  if (STEP.search(raw) || (inSteps && IMPERATIVE.search(raw)) || IMPERATIVE.search(raw)) return ["direction", null];
  if (DEFINITION.search(raw)) return ["definition", null];
  if (re(PATH).search(raw) || re(SKILL).search(raw)) return ["pointer", null];
  if (FACT.search(raw) && !re("\\?\\s*$").search(raw)) return ["fact", null];
  return ["residual", null];
}

const SPLIT = re("(?<!e\\.g)(?<!i\\.e)(?<![A-Z])(?<=[.!?])\\s+(?=[A-Z`*(\\[])");

/** [line number, text] for each sentence of prose; wrapped lines joined, code blocks and tables skipped. */
function sentences(body: string): [number, string][] {
  const blocks: [number, string][] = [];
  let cur: [number, string] | null = null, fence = false;
  const flush = () => { if (cur && strip(cur[1])) blocks.push([cur[0], strip(cur[1])]); };
  splitlines(body).forEach((line, idx) => {
    const i = idx + 1, st = strip(line);
    if (st.startsWith("```")) { fence = !fence; flush(); cur = null; return; }
    if (fence || st.startsWith("|") || st.startsWith("<!--") || re("^-{3,}$").match(st)) { flush(); cur = null; return; }
    if (!st || HEADING.match(st)) {
      flush(); cur = null;
      if (st) blocks.push([i, st]);
      return;
    }
    if (re("^([-*+]|\\d+[.)])\\s").match(st) || cur === null) { flush(); cur = [i, st]; }
    else cur[1] += " " + st;
  });
  flush();
  const out: [number, string][] = [];
  for (const [ln, b] of blocks) {
    if (HEADING.match(b)) { out.push([ln, b]); continue; }
    for (const part of SPLIT.split(b)) if (len(re("[\\W_]").sub(part, "")) >= 4) out.push([ln, strip(part)]);
  }
  return out;
}

function st(rel: string, line: number, text: string, kind: string, strength: string | null, node: string, scope: string, how = "pattern") {
  const h = createHash("sha1").update(text, "utf8").digest("hex").slice(0, 8);
  return { id: `${rel}:${line}:${h}`, kind, text: slice(text, 0, 400), source: { file: rel, line, node } as any,
    about: about(text), strength, ...(kind === "rule" ? { matched: matched(text) } : {}), scope, read_by: "pattern", believed: false, ...(how !== "pattern" ? { from: how } : {}) } as any;
}

const FRONT = re("\\A---\\s*\\n(.*?)\\n---\\s*\\n", S);

/** Every statement in one file. */
export function read(path: string, text: string, node: string, scope: string, root: string | null): any[] {
  const rel = root ? relpath(path, root) : path;
  let body = text, offset = 0;
  const out: any[] = [];
  const fm = FRONT.match(text);
  if (fm) {
    offset = count(fm.group(0)!, "\n");
    body = text.slice(fm.end);
    const m = re("^description:\\s*(.+)$", M).search(fm.group(1)!);
    if (m) {
      const d = strip(strip(m.group(1)!), "\"'");
      const line = count(text.slice(0, fm.startOf(1) + m.start), "\n") + 1;
      out.push(st(rel, line, d, "trigger", null, node, scope, "frontmatter description"));
    }
  }
  let inSteps = false;
  for (const [ln, s] of sentences(body)) {
    if (HEADING.match(s)) { inSteps = !!re("^#{1,6}\\s*(procedure|steps|how|workflow)", I).match(s); continue; }
    const [kind, strg] = classify(s, inSteps);
    out.push(st(rel, ln + offset, s, kind, strg, node, scope === "unit" && STEP.search(s) ? "step" : scope));
  }
  return out;
}

/** The piece a file's statements belong to (pieces.json ids). */
export function pieceOf(rel: string): string | null {
  const r = rel;
  if (r.startsWith("~/") || r.startsWith("../")) return "personal-instructions";
  if (["CLAUDE.md", "AGENTS.md", "CLAUDE.local.md", ".claude/CLAUDE.md"].includes(r)) return "proj-instructions";
  if (r.endsWith("/CLAUDE.md") || r.startsWith(".claude/rules/")) return "folder-instructions";
  if (r.endsWith("PROTOCOL.md")) return "contracts";
  if (r.endsWith("SKILL.md")) { const parts = r.split("/"); return parts[parts.length - 2]?.endsWith("-mode") ? "modes" : "skills"; }
  return null;
}

/** Statements across the harness's prose. g: an extracted graph, to name each statement's node. home: false to leave it out. */
/** Every statement in a harness's prose. more: other files the runtime loads (skills, agents and commands in your home
 * folder or from packages), read as units, so a rule in a skill you installed counts like one in the repo. */
export function harness(rootIn: string, g?: any, home?: string | false | null, more: string[] = []): any[] {
  const root = abspath(rootIn);
  const out: any[] = [], seen = new Set<string>();
  const nodes = new Map<string, any>();
  if (g) for (const n of g.nodes || []) {
    const p = (n.provenance || {}).path;
    if (p && ["surface", "unit", "contract"].includes(n.type)) nodes.set(abspath(p), n);
  }
  const files: [string, string][] = [];
  for (const name of ["CLAUDE.md", "AGENTS.md", "CLAUDE.local.md", join(".claude", "CLAUDE.md")]) files.push([join(root, name), "harness"]);
  if (home !== false) files.push([expanduser(join(home || "~/.claude", "CLAUDE.md")), "harness"]);
  // sample harnesses the repo declares (.free-rein.json) are someone else's prose, as in extract
  const SKIPD = new Set(["node_modules", ".git", "dist", "build", "vendor", ".next"]);
  for (const [dp, , fs] of walk(root, withoutSamples(root, d => !SKIPD.has(d) && !(d.startsWith(".") && d !== ".claude")))) {
    const rel = relpath(dp, root);
    for (const f of fs) {
      const p = join(dp, f);
      if (f === "CLAUDE.md" && rel !== ".") files.push([p, "folder"]);
      else if (f.endsWith(".md") && (rel.startsWith(join(".claude", "rules")) || rel === join(".claude", "rules"))) files.push([p, "folder"]);
      // a skill only where a runtime loads it: a SKILL.md elsewhere (translated docs, a copy in a sub-package) is never read
      else if (f === "SKILL.md" && SKILL_DIRS.includes(relpath(dirname(dp), root))) files.push([p, "unit"]);
      else if (f === "PROTOCOL.md") files.push([p, "unit"]);
    }
  }
  for (const m of more) files.push([isfile(m) ? m : join(m, "SKILL.md"), "unit"]);
  // the notes your agent keeps for itself, when the home folder counts (memory.ts)
  const notes = new Map<string, any>();
  const ruled = new Set<string>();
  if (home !== false) for (const n of (memory(root) || { notes: [] }).notes) { files.push([n.path, "memory"]); notes.set(abspath(n.path), n); }
  for (let [p, scope] of files) {
    p = abspath(p);
    if (seen.has(p) || !isfile(p)) continue;
    seen.add(p);
    let text: string;
    try { text = readText(p, "ignore", 400_000); } catch { continue; }
    const n = nodes.get(p);
    let rel = relpath(p, root);
    if (!abspath(p).startsWith(root + "/")) rel = "~/" + relpath(p, expanduser("~"));
    const note = notes.get(p);
    for (const x of read(p, text, n ? n.id : rel, scope, root)) {
      x.source.file = rel;
      x.id = rel + x.id.slice(x.id.indexOf(":"));
      x.piece = note ? "saved-facts" : pieceOf(rel);
      if (note) {
        x.who = "agent";
        // a note's description says what's in it: not a trigger, as a skill's is
        if (x.from === "frontmatter description") x.kind = "fact";
        // the index's lines point at the notes and repeat them: pointers, so nothing counts twice
        else if (note.index) { x.kind = "pointer"; x.strength = null; delete x.matched; }
        // a feedback note is a rule your agent gave itself: its first sentence is the rule, however it's worded
        else if (note.type === "feedback" && !ruled.has(rel) && x.kind !== "trigger" && !/^\*\*(why|how to apply)/i.test(x.text)) {
          ruled.add(rel);
          if (x.kind !== "rule") { x.kind = "rule"; x.strength = x.strength || "should"; x.matched = matched(x.text); }
          x.from = "memory feedback";
        }
      }
      out.push(x);
    }
  }
  return out;
}

