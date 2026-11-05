// How each item of a collection (skills) is hardened: not a level, a profile of ways (checked, limited,
// on request, guarded, tested, watched). First written in Python (retired 2026-10-11).
import { withoutSamples } from "../read/samples";
import { re, I, S, M, flags, readText, loads, join, dirname, basename, isdir, isabs, listdir, sorted, walk, relpath, abspath, expanduser,
  splitWs, strip, slice, len, escape, get, iter, items as pyItems, isDict, isList, or, unique } from "../py";
import { lint } from "./lint";
import { Graph } from "../read/extract";
import { classify, about } from "../read/statements";

export const WAYS = [
  { id: "checked", name: "Checked", about: "A check that runs validates its shape and what it references." },
  { id: "limited", name: "Limited", about: "Tools it doesn't need are taken away while it runs (disallowed-tools)." },
  { id: "on-request", name: "Only on request", about: "Only you start it, by name, so it can't fire by mistake." },
  { id: "guarded", name: "Guarded", about: "What it writes goes through your approval or a gate first." },
  { id: "tested", name: "Tested", about: "An eval or test checks that it does its job." },
  { id: "watched", name: "Watched", about: "Its use is recorded, so a dead or misfiring skill shows up." },
];
const SHELL = re("```(?:bash|sh|zsh|shell)\\b|\\bBash\\(|`(?:git|npm|pnpm|python3?|node|bash|sh|curl|rm|make|uv)\\s[^`]*`");
const CHECK = re("(SKILL\\.md|skills/).{0,120}(lint|check|validat|doctor)|(lint|check|validat|doctor).{0,120}(SKILL\\.md|skills/)|address-findings|free-rein (?:check|lint)", flags(I, S));
const ISSUES = new Set(["dangling-reference", "vocabulary-mismatch", "spec-drift", "claimed-actual-mismatch"]);

function _read(p: string): string {
  try { return readText(p, "ignore", 300_000); } catch { return ""; }
}

const FM = re("\\A---\\s*\\n(.*?)\\n---", S);
function fm(text: string): Record<string, string> {
  const m = FM.match(text);
  const out: Record<string, string> = {};
  for (const line of m ? splitlinesOf(m.group(1)!) : []) {
    const i = line.indexOf(":");
    const k = i < 0 ? line : line.slice(0, i), v = i < 0 ? "" : line.slice(i + 1);
    if (strip(v)) out[strip(k)] = strip(strip(v), "\"'");
  }
  return out;
}
import { splitlines as splitlinesOf } from "../py";

const NOT_JSON = Symbol("not json");
const jsonOr = (t: string) => { try { return loads(t); } catch { return NOT_JSON; } };
/** str() of a settings value */
const pystr = (x: any): string => x === true ? "True" : x === false ? "False" : x === null || x === undefined ? "None" : String(x);

function settings(root: string, home: string): any[] {
  const out: any[] = [];
  for (const p of [join(home, "settings.json"), join(root, ".claude", "settings.json"), join(root, ".claude", "settings.local.json")]) {
    const v = jsonOr(_read(p) || "{}");
    if (v !== NOT_JSON) out.push(isDict(v) ? v : {});
  }
  return out;
}

/** The ways that hold for every skill at once: a check that runs over skills, and a hook that records their use. */
export function harnessWays(root: string, home: string) {
  const checked: string[] = [], watched: string[] = [];
  for (const st of settings(root, home)) {
    for (const [event, entries] of pyItems(or(get(st, "hooks"), {}))) {
      for (const e of isList(entries) ? entries : []) {
        for (const h of isDict(e) ? iter(or(get(e, "hooks"), [])) : []) {
          const cmd = pystr(get(h, "command", ""));
          const words = splitWs(cmd);
          const sp = words.length ? expanduser(words[words.length - 1].split("$CLAUDE_PROJECT_DIR").join(root).split("${CLAUDE_PROJECT_DIR}").join(root)) : "";
          const script = sp ? _read(isabs(sp) ? sp : join(root, sp)) : "";
          if (CHECK.search(cmd + "\n" + script)) checked.push(`the ${event} hook (${words.length ? basename(words[words.length - 1]) : cmd})`);
          if (re("\\bSkill\\b").search(pystr(get(e, "matcher", ""))) && re("emit|events\\.jsonl|log").search(script)) watched.push(`the ${event} hook logs each skill it starts`);
        }
      }
    }
  }
  const wf = join(root, ".github", "workflows");
  for (const f of isdir(wf) ? sorted(listdir(wf)) : []) if (CHECK.search(_read(join(wf, f)))) checked.push(`the CI workflow ${f}`);
  const pkg = jsonOr(_read(join(root, "package.json")) || "{}");
  const scripts = pkg === NOT_JSON ? {} : or(get(pkg, "scripts"), {});
  for (const [k, v] of pyItems(scripts)) if (CHECK.search(pystr(v)) && re("skill", I).search(pystr(v))) checked.push(`the ${k} script`);
  return { checked, watched };
}

function tests(root: string): [string, string][] {
  const texts: [string, string][] = [];
  for (const [dp, , fs] of walk(root, withoutSamples(root, d => !["node_modules", ".git", "dist", "build"].includes(d)))) {
    const rel = relpath(dp, root);
    if (re("(^|/)(evals?|tests?|__tests__)(/|$)").search(rel) || fs.some(f => re("eval", I).search(f))) {
      for (const f of fs)
        if (re("\\.(json|ya?ml|py|ts|js|md|jsonl)$").search(f) && (re("(^|/)(evals?|tests?)").search(rel) || f.toLowerCase().includes("eval")))
          texts.push([join(dp, f), _read(join(dp, f))]);
    }
  }
  return texts;
}

const STOP = new Set("a an the to of and or for in on with when use this it its is are be by as from that your you user users asks ask any into at".split(" "));
const words = (t: string) => new Set((re("[a-z][a-z-]{2,}").findall(t.toLowerCase()) as string[]).filter(w => !STOP.has(w)));
const QUOTES = re("[\"“]([^\"”]{8,60})[\"”]");

/** Across skills: overlapping descriptions; inside one skill: rules that say both always and never about one action. */
function cross(items: any[]) {
  items.forEach((a, k) => {
    const wa = words(a.desc), qa = new Set(QUOTES.findall(a.desc) as string[]);
    for (const b of items.slice(k + 1)) {
      const wb = words(b.desc);
      if (!wa.size || !wb.size) continue;
      const inter = [...wa].filter(w => wb.has(w)).length, union = new Set([...wa, ...wb]).size;
      const qb = new Set(QUOTES.findall(b.desc) as string[]);
      if (inter / union >= 0.5 || [...qa].some(q => qb.has(q))) {
        a.issues.push(`its description overlaps /${b.name}'s, so the model may pick the wrong one`);
        b.issues.push(`its description overlaps /${a.name}'s, so the model may pick the wrong one`);
      }
    }
  });
  for (const i of items) {
    const sts = re("(?<=[.!?])\\s+|\\n").split(i.body).map(line => [...classify(line), line] as [string, string | null, string]).filter(x => x[0] === "rule");
    const byAct = new Map<string, Set<string>>();
    for (const [, strength, line] of sts)
      for (const act of about(line).filter(a => "action" in a).map(a => a.action)) {
        if (!byAct.has(act)) byAct.set(act, new Set());
        byAct.get(act)!.add(strength === "must-not" || strength === "should-not" ? "never" : "always");
      }
    const clash = [...byAct.entries()].filter(([a, v]) => v.size === 2 && v.has("never") && v.has("always") && a !== "write" && a !== "run").map(([a]) => a);
    if (clash.length) i.issues.push("its own rules say both always and never about " + clash.join(", "));
  }
}

/** {ways, harness, items, summary}: each skill of the repo with what it needs, has, its gaps and issues. */
export function skills(rootIn: string, home?: string | null, g?: Graph | any, findings?: any[]): any {
  home = home || expanduser("~/.claude");
  const root = abspath(rootIn);
  if (!g) [g, findings] = lint(root);
  const gj = g instanceof Graph ? g.toJson() : g;
  const nodes = new Map<string, any>(gj.nodes.map((n: any) => [n.id, n]));
  const edges: any[] = gj.edges;
  const hw = harnessWays(root, home);
  const tsts = tests(root);
  const items: any[] = [];
  for (const [nid, n] of sorted([...nodes.entries()])) {
    if (n.type !== "unit" || n.missing) continue;
    const name: string = n.label, path: string = (n.provenance || {}).path || "";
    const text = _read(path), f = fm(_read(path));
    const out = edges.filter(e => e.source === nid);
    const writes = out.filter(e => e.type === "writes").map(e => e.target as string);
    const gated = writes.filter(t => t.startsWith("gate:"));
    const naked = (findings || []).filter(x => x.class === "naked-write" && pystr(x.subject).startsWith(nid + " ->"));
    const runs = out.some(e => e.type === "invokes" && e.target.startsWith("executor:")) || !!SHELL.search(text);
    const callers = sorted(unique(edges.filter(e => e.type === "invokes" && e.target === nid && e.source.startsWith("unit:")).map(e => e.source.slice(e.source.indexOf(":") + 1))));
    const onRequest = pystr(f["disable-model-invocation"] ?? "").toLowerCase() === "true";
    const does: any = { writes: !!writes.length, runs, model_starts: !onRequest, relied_on: callers.length >= 3 || name.endsWith("-mode") };
    const need = [...(does.writes ? ["guarded"] : []), ...(does.runs ? ["limited"] : []), ...(does.model_starts ? ["checked"] : [])];
    const has: Record<string, string> = {};
    if (hw.checked.length) has.checked = hw.checked[0];
    if (f["disallowed-tools"]) has.limited = `disallowed-tools: ${slice(f["disallowed-tools"], 0, 60)}`;
    if (f["allowed-tools"]) does.grants = slice(f["allowed-tools"], 0, 80);
    if (onRequest) {
      has["on-request"] = "disable-model-invocation: true";
      if (!("checked" in has)) has.checked = "only you start it, so it can't be picked by mistake";
    }
    if (gated.length && !naked.length) has.guarded = "writes through " + sorted(unique(gated.map(t => t.split(":").pop()!))).join(", ") + " (it asks you first)";
    const hitRe = re(`(?<![\\w-])${escape(name)}(?![\\w-])`);
    const hit = tsts.find(([, t]) => hitRe.search(t));
    if (hit) has.tested = relpath(hit[0], root);
    if (hw.watched.length) has.watched = hw.watched[0];
    const issues: string[] = [];
    const desc = f.description ?? "";
    const body = re("\\A---\\s*\\n.*?\\n---\\s*\\n", S).sub(text, "");
    if (!desc) issues.push("no description, so the model can't tell when to use it");
    else if (len(desc) < 40) issues.push("a very short description, so the model may pick it wrongly");
    else if (!re("\\b(use|run|invoke|call)\\b(\\s+\\w+){0,3}\\s+(when|whenever|to|for|at|before|after|if|during|once|periodically|on)\\b|\\bwhen (the user|you|asked)\\b|\\btriggers?\\b", I).search(desc))
      issues.push("its description says what it is but not when to use it");
    const folder = basename(dirname(path));
    if (f.name && f.name !== folder) issues.push(`its name (${f.name}) doesn't match its folder (${folder})`);
    if (!re("^\\s*(\\d+[.)]\\s|#{1,4}\\s|\\*\\*step)", flags(M, I)).search(body)) issues.push("no procedure: no steps or sections saying what it does, in order");
    for (const x of findings || []) if (ISSUES.has(x.class) && pystr(x.subject).includes(nid)) issues.push(slice(`${x.title}: ${x.detail}`, 0, 160));
    let nakedTo: string[] = [];
    if (naked.length) {
      delete has.guarded;
      if (!need.includes("guarded")) need.push("guarded");
      nakedTo = naked.map(x => pystr(x.subject).split(" -> ").pop()!.split("substrate:").join(""));
    }
    items.push({ name, path, does, need, has, writes_around: nakedTo, desc, body, gaps: need.filter(w => !(w in has)), issues, callers });
  }
  cross(items);
  for (const i of items) delete i.body;
  const ok = items.filter(i => !i.gaps.length && !i.issues.length);
  const gapCounts = Object.fromEntries(WAYS.map(w => [w.id, items.filter(i => i.gaps.includes(w.id)).length]));
  return { ways: WAYS, harness: hw, items, summary: { n: items.length, ok: ok.length,
    gaps: Object.fromEntries(Object.entries(gapCounts).filter(([, v]) => v)), issues: items.filter(i => i.issues.length).length } };
}
