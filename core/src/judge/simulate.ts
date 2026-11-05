// A dry run: a task's steps played through a harness, and what Claude Code's rules and hooks would do at each;
// plus the readers situations use (settings, permission rules, hooks, review gates).
// First written in Python (retired 2026-10-11); rules are matched by Free Rein, not by Claude Code (believed).
import { homeState, withHome } from "../read/home";
import { spawnSync } from "child_process";
import * as fs from "fs";
import { re, readText, loads, join, basename, realpath, expanduser, isfile, fnmatch, slice, strip, get, iter, items as pyItems, isStr, or, truthy, dumpsStr } from "../py";
import * as progress from "./progress";
import { repoDir } from "../read/spec";
import { dirname } from "../py";
import { evaluate } from "./evaluate";
import { copyHarness } from "../write/changes";
import { used, tryPlugin } from "../read/plugins";

import { home as HOME } from "../read/home";
const FREE_REIN = repoDir;

export const KINDS: Record<string, { tool: string | null; work: string; label: string }> = {
  edit: { tool: "Edit", work: "edit", label: "Edit" }, command: { tool: "Bash", work: "commands", label: "Run" },
  knowledge: { tool: "Edit", work: "knowledge", label: "Change what it knows:" }, done: { tool: null, work: "done", label: "Say it's done" },
  push: { tool: "Bash", work: "unattended", label: "Push" },
};

/** json.load(open(path)), or null when it can't be read */
export function load(path: string): any {
  try {
    const t = readText(path, "replace");
    if (t.includes("�") && !fs.readFileSync(path).includes(Buffer.from("�"))) return null;
    return loads(t);
  } catch { return null; }
}

/** Which layers the readers see (the board's data sets it per layer). Whether your home folder counts at all is
 * home.ts's (off: nothing from it is read, as with --no-home). */
export const state = { LAYER: "yours" };
const SEES: Record<string, Set<string>> = { base: new Set(), packages: new Set(["pkg"]), project: new Set(["pkg", "project"]),
  home: new Set(["pkg", "home"]), yours: new Set(["pkg", "project", "home"]) };
export const sees = (owner: string) => (owner !== "home" || homeState.counted) && (SEES[state.LAYER] ?? SEES.yours).has(owner);
export { withHome };

export const scopeOf = (path: string | null) => path && realpath(path).startsWith(realpath(join(HOME(), ".claude")) + "/") ? "home" : "project";

export function ownerOf(path: string | null, root: string | null): string {
  if (path && root) { const [, pkg] = progress.where(path, root, FREE_REIN()); if (pkg) return "pkg"; }
  return scopeOf(path);
}

function hookScript(command: string, root: string): string | null {
  for (const tok of re("\\s+").split(command || "")) {
    let t = strip(tok, "'\"").split("${CLAUDE_PROJECT_DIR}").join(root || "").split("$CLAUDE_PROJECT_DIR").join(root || "");
    t = expanduser(t);
    if (t.includes("/") && isfile(t)) return t;
  }
  return null;
}

/** Every Claude Code settings file, whatever layer is being measured: [path, parsed]. */
export function allSettings(root: string): [string, any][] {
  const out: [string, any][] = [];
  for (const p of [join(root, ".claude", "settings.local.json"), join(root, ".claude", "settings.json"), join(HOME(), ".claude", "settings.json")]) {
    const s = load(p);
    if (s !== null) out.push([p, s]);
  }
  return out;
}
/** The settings files that apply in the layers being measured, most local first. */
export const settings = (root: string) => allSettings(root).filter(([p]) => sees(scopeOf(p)));

/** The first line (1-based) that contains needle */
export function lineOf(path: string, needle: string): number | null {
  let t: string;
  try { t = readText(path, "replace"); } catch { return null; }
  const lines = t.split("\n");
  for (let i = 0; i < lines.length; i++) if ((lines[i] + (i < lines.length - 1 ? "\n" : "")).includes(needle)) return i + 1;
  return null;
}

const glob_ = (name: string, pat: string) => { try { return fnmatch(name, pat); } catch { return name === pat; } };

/** Claude Code's rule syntax as Free Rein reads it: Tool, or Tool(specifier); Bash(prefix:*) and path globs. */
export function ruleMatches(rule: string, tool: string, target: string): boolean {
  const m = re("^\\s*([A-Za-z_]+)(?:\\((.*)\\))?\\s*$").match(rule);
  if (!m) return false;
  const rt = m.group(1)!, spec = m.group(2);
  const E = new Set(["Edit", "Write", "MultiEdit"]);
  const tools = ["Edit", "Write", "MultiEdit"].includes(tool) ? E : new Set([tool]);
  if (!tools.has(rt)) return false;
  if (spec === null || spec === "" || spec === "*") return true;
  if (tool === "Bash") return spec.endsWith(":*") ? target.startsWith(spec.slice(0, -2)) : glob_(target, spec);
  const t = target.startsWith("./") ? target.slice(2) : target;
  const sp = (spec.startsWith("./") ? spec.slice(2) : spec).split("**").join("*");
  return glob_(t, sp) || glob_(basename(t), sp);
}

/** The permission rule that decides, if any: deny, then ask, then allow. */
export function permission(root: string, tool: string, target: string): any {
  const found: any[] = [];
  for (const [path, s] of settings(root)) {
    const perm = or(get(s, "permissions"), {});
    for (const kind of ["deny", "ask", "allow"])
      for (const rule of iter(or(get(perm, kind), [])))
        if (isStr(rule) && ruleMatches(rule, tool, target)) found.push({ kind, rule, path, line: lineOf(path, dumpsStr(rule)) });
  }
  for (const kind of ["deny", "ask", "allow"]) { const hit = found.find(f => f.kind === kind); if (hit) return hit; }
  return null;
}

/** Command hooks registered for an event (and, for tool events, whose matcher fits the tool). */
export function hooks(root: string, event: string, tool: string | null = null): any[] {
  const out: any[] = [];
  for (const [path, s] of allSettings(root)) {
    for (const entry of iter(or(get(or(get(s, "hooks"), {}), event), []))) {
      const matcher = or(get(entry, "matcher"), "");
      if (tool && truthy(matcher) && !re(matcher).fullmatch(tool) &&
        !matcher.split("|").some((part: string) => (tool === "Edit" ? ["Edit", "Write", "MultiEdit"] : [tool]).some(t => re(part).fullmatch(t)))) continue;
      for (const h of iter(or(get(entry, "hooks"), []))) {
        if (get(h, "type", "command") === "command" && truthy(get(h, "command")) && !out.some(x => x.command === h.command)) {
          const sc = hookScript(h.command, root);
          if (sees(sc ? ownerOf(sc, root) : scopeOf(path))) out.push({ command: h.command, path, line: lineOf(path, slice(h.command, 0, 40)) });
        }
      }
    }
  }
  return out;
}

/** Run one hook on the copy, the way Claude Code passes it input; what it does is observed. */
export function runHook(h: any, copy: string, payload: any) {
  const cmd = h.command.split("$CLAUDE_PROJECT_DIR").join(copy).split("${CLAUDE_PROJECT_DIR}").join(copy);
  const r = spawnSync(cmd, { shell: true, cwd: copy, env: { ...process.env, CLAUDE_PROJECT_DIR: copy }, input: JSON.stringify(payload), timeout: 20_000, encoding: "utf8" });
  if (r.error && (r.error as any).code === "ETIMEDOUT") return { code: null, says: "didn't finish within 20 seconds" };
  return { code: r.status, says: slice(strip(r.stderr || r.stdout || ""), 0, 400) };
}

/** The review gates that ask you before a write to this path: each plugin's (a framework's gates), in the layers
 * being measured. */
export function gates(root: string, target: string): any[] {
  const out: any[] = [];
  for (const p of used(root)) {
    let gs: any[] = [];
    gs = tryPlugin(p, "gates", () => p.gates?.(root, target) ?? [], []);
    out.push(...gs.filter(x => sees(ownerOf(x.path, root))));
  }
  return out;
}

/** Play steps through a harness. mode: Claude Code's permission mode where no rule decides. */
export function simulate(rootIn: string, steps: any[], runtime = "claude", runHooks = false, a?: any, mode = "auto") {
  const root = realpathSafe(rootIn);
  a = a || evaluate(root, { count_home: true, runtime });
  const items: Record<string, any> = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i]));
  const cats: Record<string, any> = Object.fromEntries(a.trust.categories.map((c: any) => [c.id, c]));
  let tmp: string | null = null, copy: string | null = null;
  if (runHooks) [tmp, copy] = copyHarness(root);
  const out: any[] = [];
  try {
    for (const st of steps) {
      const k = KINDS[get(st, "kind") as string];
      if (!k) continue;
      const target = strip(or(get(st, "target"), ""));
      const why: any[] = [];
      let outcome = "alone";
      const claude = runtime === "claude";
      if (claude && k.tool) {
        const payload = { hook_event_name: "PreToolUse", tool_name: k.tool, tool_input: k.tool === "Bash" ? { command: target } : { file_path: join(copy || root, target) } };
        for (const h of hooks(root, "PreToolUse", k.tool)) {
          if (runHooks) {
            const r = runHook(h, copy!, payload);
            if (r.code === 2) { outcome = "blocked"; why.push({ what: "A hook refused it", says: r.says, path: h.path, line: h.line, observed: true }); }
            else why.push({ what: "A hook ran and let it through", says: r.says, path: h.path, line: h.line, observed: true });
          } else why.push({ what: "A hook runs first and could refuse it (not run: turn on running hooks to see)", path: h.path, line: h.line, observed: false, hook: true });
        }
        if (outcome !== "blocked") {
          const p = permission(root, k.tool, target);
          if (p && p.kind === "deny") { outcome = "blocked"; why.push({ what: `A permission rule denies it: ${p.rule}`, path: p.path, line: p.line, observed: false }); }
          else if (p && p.kind === "ask") { outcome = "asks"; why.push({ what: `A permission rule asks you first: ${p.rule}`, path: p.path, line: p.line, observed: false }); }
          else if (p) why.push({ what: `A permission rule allows it: ${p.rule}`, path: p.path, line: p.line, observed: false });
          else if (mode === "manual") { outcome = "asks"; why.push({ what: "No rule of yours covers it, and in Manual mode Claude Code asks you first", source: "https://code.claude.com/docs/en/permission-modes", observed: false }); }
          else { outcome = "decides"; why.push({ what: "No rule of yours covers it, so Claude Code's default applies: from v2.1.283 it starts in auto mode, where a classifier decides (Manual mode would ask you)", source: "https://code.claude.com/docs/en/permission-modes", observed: false }); }
        }
        if (outcome !== "blocked" && st.kind === "knowledge")
          for (const g of gates(root, target)) { outcome = "asks"; why.push({ what: `A review gate asks you first: ${g.label}`, path: g.path, line: (g.lines || [null])[0], observed: false }); }
      } else if (claude && st.kind === "done") {
        const checks = (items["completion-check"] || {}).state === "yes";
        outcome = checks ? "checked" : "alone";
        for (const h of hooks(root, "Stop")) {
          if (runHooks) {
            const r = runHook(h, copy!, { hook_event_name: "Stop", stop_hook_active: false });
            if (r.code === 2) { outcome = "checked"; why.push({ what: "A hook kept it working: it isn't done yet", says: r.says, path: h.path, line: h.line, observed: true }); }
            else why.push({ what: "A hook ran when it stopped and let it finish", says: r.says, path: h.path, line: h.line, observed: true });
          } else why.push({ what: "A hook runs when it stops (not run: turn on running hooks to see what it does)", path: h.path, line: h.line, observed: false });
        }
        if (!checks) why.push({ what: "No completion check reads the work before it stops: it decides by itself that it's done", observed: false });
      } else {
        const c = cats[k.work] || {};
        const firm = (c.pieces || []).filter((p: any) => p.state === "yes");
        outcome = firm.length ? "asks" : "alone";
        why.push({ what: `Free Rein reads ${runtime}'s rules only as pieces, not one by one: ` + (firm.length ? `in place for this kind of work: ${firm.map((p: any) => p.name).join(", ")}` : "nothing in place for this kind of work"), observed: false });
      }
      const c = cats[k.work] || {};
      const missing = (c.pieces || []).filter((p: any) => p.state !== "yes").map((p: any) => ({ id: p.id, name: p.name }));
      const log = (items["event-log"] || {}).state === "yes";
      out.push({ kind: st.kind, label: k.label, target, work: c.name ?? null, outcome, why, missing: missing.slice(0, 4), recorded: log, backed: c.evidence_score ?? null });
    }
  } finally { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); }
  const stops = out.filter(s => s.outcome === "blocked" || s.outcome === "asks");
  return { runtime, ran_hooks: runHooks, steps: out, summary: { alone: out.filter(s => ["alone", "decides", "checked"].includes(s.outcome)).length,
    stops: stops.length, blocked: out.filter(s => s.outcome === "blocked").length } };
}

import { abspath } from "../py";
const realpathSafe = (p: string) => abspath(p);
