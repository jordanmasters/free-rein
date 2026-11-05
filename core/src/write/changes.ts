// What upgrading one piece would change, and the change itself: a template's exact file edits (Claude Code
// layout), or a request you hand the agent; and the effect, measured on a copy of the harness.
// First written in Python (retired 2026-10-11); the edits it writes are byte for byte what Python wrote. Hook behaviour
// the templates rely on is Claude Code's hooks contract (code.claude.com/docs/en/hooks, checked 2026-10-03).
import * as fs from "fs";
import * as os from "os";
import { re, M, S, loads, loadsKeep, dumps, join, basename, dirname, isDict, get, or, pyIn, rstrip, strip, abspath } from "../py";
import { discoverVaults } from "../read/extract";
import { evaluate } from "../judge/evaluate";
import { load } from "../read/spec";
import { coreOf } from "../read/runtimes";

export const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "venv", "__pycache__", "out", "target", ".turbo", ".cache"]);
// files that hold secrets, left out of every copy (a template such as .env.example is kept: it holds no values)
const SECRET = re("(\\.env(\\.(?!example$|sample$|template$).+)?|.+\\.(pem|key|p12|pfx)|id_(rsa|dsa|ecdsa|ed25519)|\\.netrc|\\.npmrc|\\.pypirc)");

/** open(path).read(), strict: null when it can't be opened; raises on bytes that aren't UTF-8, as Python does */
export function read(path: string): string | null {
  let buf: Buffer;
  try { buf = fs.readFileSync(path); } catch { return null; }
  const t = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
  return t.replace(/\r\n?/g, "\n");
}

export interface Edit { path: string; rel: string; before: string | null; after: string; kind: string; note: string; mode: number | null }

export function edit(root: string, rel: string, after: string, note: string, mode: number | null = null): Edit {
  const path = join(root, rel), before = read(path);
  return { path, rel, before, after, kind: before === null ? "create" : "replace", note, mode };
}

/** .claude/settings.json with change(settings) applied; null when the file isn't valid JSON. */
function settingsWith(root: string, change: (s: any) => void): [string, string] | null {
  const rel = join(".claude", "settings.json");
  const text = read(join(root, rel));
  let s: any;
  try { s = text && strip(text) ? loadsKeep(text) : {}; } catch { return null; }
  if (!isDict(s)) throw new TypeError("'list' object has no attribute 'setdefault'");
  change(s);
  return [rel, dumps(s, 2) + "\n"];
}

const setdefault = (o: any, k: string, d: any) => { if (!isDict(o)) throw new TypeError("no setdefault"); if (!(k in o)) o[k] = d; return o[k]; };

function addHook(s: any, event: string, matcher: string | null, command: string) {
  const entries = setdefault(setdefault(s, "hooks", {}), event, []);
  if (entries.some((e: any) => (get(e, "hooks", []) as any[]).some((h: any) => get(h, "command") === command))) return;
  let entry: any = { hooks: [{ type: "command", command }] };
  if (matcher !== null) entry = { matcher, ...entry };
  entries.push(entry);
}

/** CLAUDE.md with a section added, unless it already has that heading. */
function withSection(root: string, heading: string, body: string): [string, string] | null {
  const rel = "CLAUDE.md";
  const text = read(join(root, rel));
  if (text && ("\n" + text).includes(`\n${heading}\n`)) return null;
  const base = text ? rstrip(text) + "\n\n" : "# CLAUDE.md\n\n";
  return [rel, base + `${heading}\n\n${strip(body)}\n`];
}

/** The check commands this repo already names (package.json or Makefile). */
export function checkCommands(root: string): string[] {
  const cmds: string[] = [];
  let v: any;
  try { v = loads(read(join(root, "package.json")) || "{}"); } catch { v = undefined; }
  if (v !== undefined) {
    const scripts = or(get(v, "scripts"), {});
    for (const k of ["lint", "typecheck", "test", "check"]) if (pyIn(k, scripts)) cmds.push(k !== "test" ? `npm run ${k}` : "npm test");
  }
  const mk = read(join(root, "Makefile")) || "";
  for (const k of ["lint", "test", "check"]) if (("\n" + mk).includes(`\n${k}:`)) cmds.push(`make ${k}`);
  return cmds;
}

const HOOK = (f: string) => `"$CLAUDE_PROJECT_DIR/.claude/hooks/${f}"`;

// --- templates: Claude Code layout ---

function tHardGate(root: string): Edit[] | null {
  const prot = [".env", ".env.*", "*.pem", "*.key", "secrets/*"];
  const vaults = discoverVaults(root).map(([vp]) => vp.replace(/\/+$/, "") + "/*");
  const script = `#!/usr/bin/env bash
# Blocking hook (PreToolUse on Edit/Write): refuses edits to protected files.
# Added by Free Rein. Exit 2 blocks the edit and tells the agent why.
# Protected paths, one glob per line: .claude/hooks/protected-paths.txt
# To change a protected file on purpose, edit it yourself, or remove its line.
input=$(cat)
# the edit's path, read with node or python3; if neither can read it, the edit is refused (never let through unread)
field() {
  if command -v node >/dev/null 2>&1; then
    node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s);console.log((d.tool_input||{}).file_path||"")})'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")'
  else return 1; fi
}
path=$(printf '%s' "$input" | field) || { echo "Blocked by .claude/hooks/protect-files.sh: couldn't read which file this edit is for (it needs node or python3)." >&2; exit 2; }
[ -z "$path" ] && exit 0
rel="\${path#"$CLAUDE_PROJECT_DIR"/}"
list="$CLAUDE_PROJECT_DIR/.claude/hooks/protected-paths.txt"
[ -f "$list" ] || exit 0
while IFS= read -r glob; do
  case "$glob" in ''|'#'*) continue ;; esac
  case "$rel" in $glob)
    echo "Blocked by .claude/hooks/protect-files.sh: $rel is protected ($glob). Ask the person to change it, or to remove the rule." >&2
    exit 2 ;;
  esac
done < "$list"
exit 0
`;
  const globs = "# Files the agent may not edit on its own (Free Rein's blocking hook).\n" + [...prot, ...vaults].join("\n") + "\n";
  const st = settingsWith(root, s => addHook(s, "PreToolUse", "Edit|Write|MultiEdit", HOOK("protect-files.sh")));
  if (!st) return null;
  return [edit(root, ".claude/hooks/protect-files.sh", script, "a hook that refuses edits to protected files", 0o755),
    edit(root, ".claude/hooks/protected-paths.txt", globs, "which files it protects; edit freely"),
    edit(root, st[0], st[1], "registers the hook before every edit")];
}

function tCompletionCheck(root: string): Edit[] | null {
  const cmds = checkCommands(root);
  const run = cmds.map(c => `out=$(${c} 2>&1) || { echo "Not done yet: \\\`${c}\\\` fails:" >&2; echo "$out" | tail -40 >&2; exit 2; }`).join("\n")
    || '# No check commands found. Add yours here, for example:\n# out=$(npm test 2>&1) || { echo "$out" | tail -40 >&2; exit 2; }';
  const script = `#!/usr/bin/env bash
# Completion check (Stop hook): when the agent says it's done, run the checks.
# Added by Free Rein. Exit 2 sends it back to work with the failures.
input=$(cat)
# already continuing because of this hook: don't loop
printf '%s' "$input" | grep -q '"stop_hook_active": *true' && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
${run}
exit 0
`;
  const st = settingsWith(root, s => addHook(s, "Stop", null, HOOK("check-on-stop.sh")));
  if (!st) return null;
  const note = cmds.length ? `runs ${cmds.join(", ")} when the agent stops` : "runs your checks when the agent stops (add them: none found)";
  return [edit(root, ".claude/hooks/check-on-stop.sh", script, note, 0o755), edit(root, st[0], st[1], "registers it on Stop")];
}

function tPermissions(root: string): Edit[] | null {
  const allow = checkCommands(root).map(c => `Bash(${c})`);
  const st = settingsWith(root, s => {
    const p = setdefault(s, "permissions", {});
    for (const [k, rules] of [["allow", allow], ["ask", ["Bash(git push:*)", "Bash(rm -rf:*)"]], ["deny", ["Read(./.env)", "Read(./.env.*)"]]] as [string, string[]][]) {
      const have = setdefault(p, k, []);
      have.push(...rules.filter(r => !have.includes(r)));
      if (!have.length) delete p[k];
    }
  });
  return st ? [edit(root, st[0], st[1], "allow the checks, ask before pushing or deleting, never read .env")] : null;
}

function tEventLog(root: string): Edit[] | null {
  const script = `#!/usr/bin/env bash
# Event log (PostToolUse hook): one line per tool call, appended to
# .claude/telemetry/events.jsonl. Added by Free Rein.
input=$(cat)
dir="$CLAUDE_PROJECT_DIR/.claude/telemetry"
mkdir -p "$dir"
# one JSON line, written with node or python3 (whichever is installed)
if command -v node >/dev/null 2>&1; then
  printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s);console.log(JSON.stringify({ts:Date.now()/1000,session:d.session_id??null,tool:d.tool_name??null,event:d.hook_event_name??null}))})' >> "$dir/events.jsonl"
elif command -v python3 >/dev/null 2>&1; then
  printf '%s' "$input" | python3 -c 'import json,sys,time; d=json.load(sys.stdin); print(json.dumps({"ts": time.time(), "session": d.get("session_id"), "tool": d.get("tool_name"), "event": d.get("hook_event_name")}))' >> "$dir/events.jsonl"
fi
exit 0
`;
  const st = settingsWith(root, s => addHook(s, "PostToolUse", "*", HOOK("log-event.sh")));
  if (!st) return null;
  return [edit(root, ".claude/hooks/log-event.sh", script, "appends each tool call to .claude/telemetry/events.jsonl", 0o755),
    edit(root, st[0], st[1], "registers it after every tool call")];
}

function tIndependentChecker(root: string): Edit[] {
  const body = `---
name: reviewer
description: Reviews finished work in a fresh context against its success criteria, and reports what's missing. Use before calling work done.
tools: Read, Grep, Glob, Bash
---

You review work you didn't do. You start fresh: read the request, the
success criteria (if there are any), and the changes, then check them.

1. Restate what was asked, and what "done" means for it.
2. Run the project's check commands, if it has any.
3. Read the changed files. Look for what was asked but not done, what was
   done but not asked, and anything that breaks the project's rules in
   CLAUDE.md.
4. Report: done or not done, and a short list of what's missing, with the
   file and line for each. Don't fix anything yourself.
`;
  return [edit(root, ".claude/agents/reviewer.md", body, "a reviewer agent that checks finished work in a fresh context")];
}

// a file the harness may already keep under another case (progress.md for PROGRESS.md): its real name, or null.
// On a Mac the two names are one file, so writing the template there would replace what the agent has written
function existing(root: string, rel: string): string | null {
  let names: string[] = [];
  try { names = fs.readdirSync(root); } catch { return null; }
  return names.find(n => n.toLowerCase() === rel.toLowerCase() && fs.statSync(join(root, n)).isFile()) ?? null;
}

function tProgressLog(root: string): Edit[] {
  const log = "# Progress\n\nWhat's done, what's in progress, and what's next. Read this at the start of a session; update it at the end.\n\n## Done\n\n## In progress\n\n## Next\n";
  // a progress file it already keeps is kept as it is: only the instruction to use it is added
  const have = existing(root, "PROGRESS.md"), name = have ?? "PROGRESS.md";
  const out = have ? [] : [edit(root, name, log, "a progress file the agent reads first and updates last")];
  const sec = withSection(root, "## Progress", `Read \`${name}\` at the start of every session. Before you finish, update it: what you did, what's in progress, and what's next.`);
  if (sec) out.push(edit(root, sec[0], sec[1], "tells the agent to use it"));
  return out;
}

function tReceipts(root: string): Edit[] {
  const receipt = "# Handoff\n\nThe last session's receipt. Replace it at the end of each session.\n\n- **Asked:** \n- **Done:** \n- **Changed:** \n- **Left open:** \n";
  const have = existing(root, "handoff.md"), name = have ?? "handoff.md";
  const out = have ? [] : [edit(root, name, receipt, "a receipt the agent writes at the end of each session")];
  const sec = withSection(root, "## Ending a session", `Before you finish, rewrite \`${name}\`: what was asked, what you did, which files changed, and what's left open.`);
  if (sec) out.push(edit(root, sec[0], sec[1], "tells the agent to write it"));
  return out;
}

function tProjInstructions(root: string): Edit[] | null {
  if (read(join(root, "CLAUDE.md"))) return null;
  const cmds = checkCommands(root);
  const body = "# CLAUDE.md\n\nStanding rules for working in this repo.\n\n## How to work here\n\n- Read the code you're changing before you change it.\n" +
    (cmds.length ? `- Before you call anything done, run: ${cmds.map(c => `\`${c}\``).join(", ")}.\n` : "- Before you call anything done, run the project's checks.\n") +
    "\n## Commits\n\n- Small commits with a message that says why.\n";
  return [edit(root, "CLAUDE.md", body, "project instructions the agent reads at the start of every session")];
}

// main=<model> (Claude Code's settings), main@<runtime>=<model> (that runtime's own setting in the repo), agent:<name>=<model>
const MODEL_RE = re("^(main(?:@[\\w-]+)?|agent:[\\w.-]+)=([\\w.:/@\\[\\]-]+)$");

/** Where a runtime sets the model in the repo (its record's models.repo), for its own variant if it has one. */
export function repoModelSetting(runtime: string): { file: string; format: string; key: string; note?: string } | null {
  const m = ((load().cores as any)[coreOf(runtime)] || {}).models;
  return m ? ((m.variants || {})[runtime] || {}).repo || m.repo || null : null;
}

/** The model a runtime's repo file sets, or null. */
export function repoModel(root: string, runtime: string): string | null {
  const r = repoModelSetting(runtime); if (!r) return null;
  const text = read(join(root, r.file)); if (!text) return null;
  if (r.format === "toml") { const m = re("^\\s*" + r.key + "\\s*=\\s*[\"']([^\"']+)[\"']", M).search(text.split(/^\s*\[/m)[0]); return m ? m.group(1) : null; }
  try { let o: any = loads(text); for (const k of r.key.split(".")) o = isDict(o) ? o[k] : undefined; return typeof o === "string" ? o : null; } catch { return null; }
}

/** The runtime's repo file with its model set (or removed, for its default). */
function repoModelEdit(root: string, runtime: string, model: string): Edit | null {
  const r = repoModelSetting(runtime); if (!r) return null;
  const text = read(join(root, r.file)) || "";
  let after: string;
  if (r.format === "toml") {
    // a top-level key goes before the first [table]; the default removes the line
    const cut = text.search(/^\s*\[/m), head = cut < 0 ? text : text.slice(0, cut), rest = cut < 0 ? "" : text.slice(cut);
    const line = new RegExp(`^\\s*${r.key}\\s*=.*\\n?`, "m");
    const h = head.replace(line, "");
    after = (model === "default" ? h : `${r.key} = "${model}"\n` + h) + rest;
  } else {
    let o: any; try { o = text.trim() ? loadsKeep(text) : {}; } catch { return null; }
    if (!isDict(o)) return null;
    const ks = r.key.split("."); let cur = o;
    for (const k of ks.slice(0, -1)) cur = isDict(cur[k]) ? cur[k] : (cur[k] = {});
    if (model === "default") delete cur[ks[ks.length - 1]]; else cur[ks[ks.length - 1]] = model;
    after = dumps(o, 2) + "\n";
  }
  return after === text ? null : edit(root, r.file, after, `the model: ${model}`);
}

/** Your calls on situations as permission rules, and your model choices, written into the harness. */
export function rulesEdit(root: string, rulesIn: any): Edit[] | null {
  const rules = (Array.isArray(rulesIn) ? rulesIn : []).filter(r => isDict(r) && typeof r.rule === "string" && strip(r.rule));
  const perm = rules.filter(r => ["allow", "ask", "deny"].includes(r.kind));
  const picks = rules.filter(r => r.kind === "model").map(r => MODEL_RE.match(strip(r.rule))).filter(m => m) as any[];
  const main = [...picks].reverse().find(m => m.group(1) === "main")?.group(2) ?? null;
  // another runtime's model, in that runtime's own file in the repo
  const mainFor = new Map<string, string>();
  for (const m of picks) if (m.group(1).startsWith("main@")) mainFor.set(m.group(1).slice(5), m.group(2));
  const agents = new Map<string, string>();
  for (const m of picks) if (m.group(1).startsWith("agent:")) agents.set(m.group(1).slice(6), m.group(2));
  const out: Edit[] = [];
  if (perm.length || main) {
    const st = settingsWith(root, s => {
      if (perm.length) {
        const p = setdefault(s, "permissions", {});
        for (const r of perm) { const have = setdefault(p, r.kind, []); if (!have.includes(r.rule)) have.push(r.rule); }
      }
      if (main === "default") delete s.model;
      else if (main) s.model = main;
    });
    if (st) {
      const n: Record<string, number> = Object.fromEntries(["allow", "ask", "deny"].map(k => [k, perm.filter(r => r.kind === k).length]));
      const bits = [...(perm.length ? [Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ") + " rule" + (perm.length > 1 ? "s" : "")] : []),
        ...(main ? [`the main model: ${main}`] : [])];
      out.push(edit(root, st[0], st[1], "your calls: " + bits.join("; ")));
    }
  }
  for (const [rt, model] of mainFor) { const e = repoModelEdit(root, rt, model); if (e) out.push(e); }
  for (const [name, model] of agents) {
    const rel = join(".claude", "agents", `${name}.md`);
    const text = read(join(root, rel));
    if (text === null) continue;
    const m = re("\\A---\\s*\\n(.*?)\\n---", S).match(text);
    if (!m) continue;
    const fm = m.group(1)!, line = `model: ${model}`;
    const fm2 = re("^model:", M).search(fm) ? re("^model:.*$", M).sub(fm, () => line) : fm + "\n" + line;
    const at = text.indexOf(fm);
    out.push(edit(root, rel, text.slice(0, at) + fm2 + text.slice(at + fm.length), `the ${name} subagent's model: ${model}`));
  }
  return out.length ? out : null;
}

export const TEMPLATES: Record<string, (root: string) => Edit[] | null> = {
  "hard-gate": tHardGate, "completion-check": tCompletionCheck, permissions: tPermissions, "event-log": tEventLog,
  "independent-checker": tIndependentChecker, "progress-log": tProgressLog, receipts: tReceipts, "proj-instructions": tProjInstructions,
};
export const TEMPLATE_IDS = Object.keys(TEMPLATES).sort();

export const MATURITY_NAMES = ["empty", "started", "equipped", "hardened"];

/** A precise request you can hand to the agent, for any piece, from where it stands now. */
export function request(item: any, aIn: any): string {
  const ch = item.change || {};
  const how = ((item.cores || {}).claude || [""])[0];
  const name = item.name, m = item.maturity ?? 0;
  const a = aIn || {};
  const names: Record<string, string> = Object.fromEntries((a.slots || []).flatMap((s: any) => s.items).map((i: any) => [i.id, i.name]));
  const spots = (a.combos || []).filter((c: any) => c.kind === "curse" && c.status === "active" && [...(c.all || []), ...(c.none || [])].includes(item.id));
  const lines: string[] = [];
  if (m === 0) {
    lines.push(`Add **${name}** to this repo's agent harness.`, "", `What it is: ${item.what}`);
    if (ch.does) lines.push(`What to do: ${ch.does}`);
    if (ch.files && ch.files.length) lines.push(`Likely files: ${ch.files.join(", ")}.`);
    if (how) lines.push(`How Claude Code does it: ${how}.`);
  } else {
    lines.push(`Strengthen **${name}** in this repo's agent harness: it's in place already (${MATURITY_NAMES[m]}).`, "", `What it is: ${item.what}`);
    if (item.count) lines.push(`What's there now: ${item.count} found` + ((item.by_layer || {}).runtime ? `, ${item.by_layer.runtime} of them built into the runtime` : "") + ".");
    const guards = (a.guards || []).filter((g: any) => g.guarded === item.id);
    if (m === 1) lines.push("What the next level needs: make it complete, so Free Rein reads it as fully in place.");
    else if (m === 2 && guards.length) lines.push("What the next level needs: a safeguard that backs it up: " + guards.map((g: any) => names[g.by] ?? g.by).join(" or ") + ".");
    for (const c of spots) {
      const fix = typeof c.lifts === "string" ? c.lifts : "";
      lines.push(strip(`A weak spot to fix: ${c.name}. ${c.effect ?? ""} ${fix}`));
    }
    if (m === 2 && !guards.length && !spots.length) lines.push("Free Rein doesn't define a next level for this piece yet, so there's no specific change to ask for.");
  }
  lines.push("", "Before writing anything, show me the plan and the diff, and wait for my yes.", `Afterwards Free Rein will read the harness again and check the change to ${name}.`);
  return lines.join("\n");
}

/** A copy of the harness in a temporary folder, without dependencies, build output or secrets: [tmp, copy]. */
export function copyHarness(root: string): [string, string] {
  const tmp = fs.mkdtempSync(join(os.tmpdir(), "free-rein-plan-"));
  const dst = join(tmp, basename(root.replace(/\/+$/, "")) || "harness");
  fs.cpSync(root, dst, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true, filter: src => src === root || !(SKIP.has(basename(src)) || SECRET.fullmatch(basename(src))) });
  return [tmp, dst];
}

/** Write edits (into root, or each at its own path); a script is made executable. */
export function write(edits: Edit[], root: string | null = null) {
  for (const e of edits) {
    const path = root ? join(root, e.rel) : e.path;
    fs.mkdirSync(dirname(path), { recursive: true });
    fs.writeFileSync(path, e.after);
    if (e.mode) fs.chmodSync(path, fs.statSync(path).mode | 0o111);
  }
}

function summary(a: any) {
  const items: Record<string, any> = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i]));
  const pg = a.progression || {};
  return { items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { state: v.state, maturity: v.maturity }])),
    xp: pg.xp ?? null, level: pg.level ?? null, rank: (pg.rank || {}).name ?? null,
    earned: a.combos.filter((c: any) => c.kind === "synergy" && c.status === "active").map((c: any) => c.id).sort(),
    open: a.combos.filter((c: any) => c.kind === "curse" && c.status === "active").map((c: any) => c.id).sort(),
    trust: Object.fromEntries(a.trust.categories.map((c: any) => [c.name, c.evidence_score])), backed: a.trust.backed };
}

function effect(b: any, a: any, names: Record<string, string>, piece: string) {
  return {
    piece: { from: b.items[piece].maturity, to: a.items[piece].maturity }, xp: a.xp - b.xp, level: { from: b.level, to: a.level }, rank: { from: b.rank, to: a.rank },
    earned: a.earned.filter((x: string) => !b.earned.includes(x)).map((x: string) => names[x] ?? x),
    lost: b.earned.filter((x: string) => !a.earned.includes(x)).map((x: string) => names[x] ?? x),
    cleared: b.open.filter((x: string) => !a.open.includes(x)).map((x: string) => names[x] ?? x),
    opened: a.open.filter((x: string) => !b.open.includes(x)).map((x: string) => names[x] ?? x),
    trust: Object.fromEntries(Object.keys(b.trust).filter(k => a.trust[k] !== b.trust[k]).map(k => [k, { from: b.trust[k], to: a.trust[k] }])),
    backed: { from: b.backed, to: a.backed },
    others: Object.fromEntries(Object.entries(a.items).filter(([k, v]: [string, any]) => k !== piece && v.maturity !== b.items[k].maturity)
      .map(([k, v]: [string, any]) => [k, { from: b.items[k].maturity, to: v.maturity }])),
  };
}

/** The plan for one piece: its edits (a template) or a request, and the effect measured on a copy. */
export function plan(rootIn: string, piece: string) {
  const root = abspath(rootIn);
  const a = evaluate(root, { count_home: true });
  const items: Record<string, any> = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i]));
  if (!(piece in items)) throw new Error(`no piece '${piece}' (free-rein upgrades lists them)`);
  const item = items[piece];
  const fn = TEMPLATES[piece];
  const edits = fn ? fn(root) : null;
  const out: any = { piece, name: item.name, maturity: item.maturity, template: !!(edits && edits.length), edits: edits || [], request: request(item, a), effect: null, verified: false };
  if (edits && edits.length) {
    const names = Object.fromEntries(a.combos.map((c: any) => [c.id, c.name]));
    const [tmp, copy] = copyHarness(root);
    let after: any;
    try { write(edits, copy); after = evaluate(copy); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    out.effect = effect(summary(a), summary(after), names, piece);
    out.verified = out.effect.piece.to >= 2;
  }
  return out;
}

/** What can be upgraded, and whether Free Rein has a template for it. */
export function upgrades(rootIn: string) {
  const root = abspath(rootIn);
  const a = evaluate(root);
  return a.slots.flatMap((s: any) => s.items).filter((i: any) => i.maturity < 2).map((i: any) => ({
    piece: i.id, name: i.name, maturity: i.maturity, upgrade_xp: i.upgrade_xp, template: i.id in TEMPLATES && !!(TEMPLATES[i.id](root) || []).length }));
}
