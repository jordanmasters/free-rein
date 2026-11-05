// The models a harness uses: which, for what, where each runs, and what it can take in.
import { withoutSamples } from "./samples";
import { modelDir } from "./spec";
import {
  re, M, S, readText, loads, isDict, isList, isStr, get, iter, truthy, or, join, expanduser, isdir,
  listdir, walk, sorted, strip, slice, unique, splitlines,
} from "../py";

export const INPUTS = ["text", "image", "audio", "video"];
export const FILES = ["pdf"];
export const OUTPUTS = ["text", "image", "audio", "video", "decisions", "vectors"];
const KIND_OUT = new Set(["decisions", "vectors"]);
export const MODEL_DOC = "https://code.claude.com/docs/en/model-config";
const MODEL_ENV: [string, string][] = [
  ["ANTHROPIC_MODEL", "the main model"], ["ANTHROPIC_DEFAULT_MODEL", "the main model new sessions start on"],
  ["ANTHROPIC_DEFAULT_FABLE_MODEL", "what fable means here"], ["ANTHROPIC_DEFAULT_OPUS_MODEL", "what opus means here"],
  ["ANTHROPIC_DEFAULT_SONNET_MODEL", "what sonnet means here"], ["ANTHROPIC_DEFAULT_HAIKU_MODEL", "what haiku means here, and background jobs"],
  ["CLAUDE_CODE_SUBAGENT_MODEL", "every subagent without its own"], ["ANTHROPIC_CUSTOM_MODEL_OPTION", "one you can switch to"]];
const ALIASES: [string, string | null][] = [["default", "Claude Code's default"], ["opus", null], ["sonnet", null], ["haiku", null], ["fable", null],
  ["opusplan", "Opus while it plans, Sonnet while it works"]];
const DEFAULT_MAIN: [string, string] = ["opus", "the main model: Claude Code's default, Opus 5.5 on most accounts (none is set here)"];
const OLLAMA_RE = re("\\bollama\\s+(?:run|pull|create)\\s+([\\w.:/-]+)");
const USE_RE = re(`\\bmodel(?:_name|Id|_id)?["']?\\s*[:=]\\s*["']([\\w.:/@-]+)["']`);
const EMBED = re("^(text-embedding-3-(small|large)|voyage-[\\w.-]+|nomic-embed-text[\\w:.-]*|mxbai-embed-large[\\w:.-]*)$");
const DECISION = re("^(jev-latest|jev-\\d[\\w.-]*|typesafe/jev|gpt-6-luna|laya[\\w:.-]*)$");
const DEPS: Record<string, string> = { "requirements.txt": "^typesafe-sdk\\b", "pyproject.toml": "typesafe-sdk", "package.json": '"typesafe[\\w-]*"\\s*:' };
const SCAN = re("\\.(py|ts|js|mjs|sh|toml|ya?ml|json)$");
const SKIP = new Set(["node_modules", ".git", "dist", "build", "vendor", ".next", "out", "tests", "test", "__tests__"])   // test code names models it doesn't use; sample harnesses: .free-rein.json;
const TESTFILE = re("(test_.*|.*[._-](test|spec)\\.\\w+)$");

function _read(p: string): string {
  try { return readText(p, "ignore", 400_000); } catch { return ""; }
}
function _json(p: string): Record<string, any> {
  try {
    const v = loads(_read(p) || "{}");
    return isDict(v) ? v : {};
  } catch { return {}; }
}

export function table(): any[] {
  return get(_json(join(modelDir(), "models.json")), "models", []);
}

/** The table's entry for a model name or alias, or null. */
export function identify(name: any, models?: any[]): any {
  const nm = or(name, "");
  if (!isStr(nm)) throw new TypeError("'" + typeof nm + "' object has no attribute 'lower'");
  const n = strip(nm.toLowerCase());
  for (const m of models ?? table())
    for (const pat of get(m, "match", []))
      if ((pat.startsWith("^") && re(pat).search(n)) || (!pat.startsWith("^") && n.includes(pat))) return m;
  return null;
}

const FM = re("\\A---\\s*\\n(.*?)\\n---", S);
function _frontmatter(text: string): Record<string, string> {
  const m = FM.match(text);
  const out: Record<string, string> = {};
  for (const line of m ? splitlines(m.group(1)!) : []) {
    const i = line.indexOf(":");
    const k = i < 0 ? line : line.slice(0, i), v = i < 0 ? "" : line.slice(i + 1);
    if (v) out[strip(k)] = strip(strip(v), "\"'");
  }
  return out;
}

/** str(x) for the values a settings file can hold */
const pystr = (x: any): string => x === true ? "True" : x === false ? "False" : x === null || x === undefined ? "None" : String(x);

type Hit = [any, string, string];

/** Every place the harness names a model: (name, used for, file). */
export function found(root: string, home?: string | null): [Hit[], [string, string] | null] {
  home = home || expanduser("~/.claude");
  const out: Hit[] = [];
  let localBase: [string, string] | null = null;
  for (const [scope, p] of [["user", join(home, "settings.json")], ["project", join(root, ".claude", "settings.json")],
    ["local", join(root, ".claude", "settings.local.json")]]) {
    const st = _json(p);
    if (get(st, "model") === "opusplan") {
      out.push(["opus", `the main model while it plans (${scope} settings)`, p]);
      out.push(["sonnet", `the main model while it works (${scope} settings)`, p]);
    } else if (truthy(get(st, "model"))) out.push([st.model, `the main model (${scope} settings)`, p]);
    for (const m of iter(or(get(st, "availableModels"), []))) out.push([m, "one you can switch to", p]);
    for (const m of isList(get(st, "fallbackModel")) ? iter(or(st.fallbackModel, [])) : []) out.push([m, "a fallback when the main one is busy", p]);
    if (truthy(get(st, "advisorModel"))) out.push([st.advisorModel, "the advisor", p]);
    const env = isDict(get(st, "env")) ? st.env : {};
    for (const [k, why] of MODEL_ENV) if (truthy(get(env, k))) out.push([env[k], why, p]);
    const base = pystr(or(get(env, "ANTHROPIC_BASE_URL"), ""));
    if (re("//(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0)\\b").search(base)) localBase = [base, p];
  }
  const adir = join(root, ".claude", "agents");
  for (const f of isdir(adir) ? sorted(listdir(adir)) : []) {
    if (f.endsWith(".md")) {
      const fm = _frontmatter(_read(join(adir, f)));
      if (truthy(fm.model) && fm.model !== "inherit") out.push([fm.model, `the ${f.slice(0, -3)} subagent`, join(adir, f)]);
    }
  }
  let n = 0;
  for (const [dp, , fs] of walk(root, withoutSamples(root, d => !SKIP.has(d) && !d.startsWith(".")))) {
    for (const f of fs) {
      if (!SCAN.search(f) || n > 1500 || TESTFILE.match(f)) continue;
      n++;
      const p = join(dp, f);
      const text = _read(p);
      for (const m of OLLAMA_RE.findall(text)) out.push([m, "a local model it runs", p]);
      for (const m of USE_RE.findall(text)) {
        if (EMBED.match(m)) out.push([m, "turning text into vectors for search", p]);
        else if (DECISION.match(m)) out.push([m, "the which-one and yes-or-no calls", p]);
      }
      if (f in DEPS && re(DEPS[f], M).search(text)) out.push(["jev-latest", "the which-one and yes-or-no calls (the TypeSafe SDK is a dependency)", p]);
    }
  }
  return [out, localBase];
}

/** The models list, what each takes in, and what the harness as a whole can take in. */
export function models(root: string, home?: string | null): any {
  const t = table();
  const [hits, localBase] = found(root, home);
  if (!hits.some(([, why]) => why.startsWith("the main model"))) hits.unshift([DEFAULT_MAIN[0], DEFAULT_MAIN[1], MODEL_DOC]);
  const by = new Map<string, any>();
  for (const [name, why, p] of hits) {
    let m = identify(name, t);
    const tag = name.includes(":") ? name.slice(name.indexOf(":") + 1).toLowerCase() : null;
    if (m && tag && tag in (or(get(m, "per_tag"), {}))) {
      const pt = m.per_tag[tag];
      const pick = (keys: string[]) => Object.fromEntries(Object.entries(pt).filter(([k]) => keys.includes(k)));
      m = { ...m, id: `${m.id}:${tag}`, name: `${m.name} ${tag}`, inputs: { ...get(m, "inputs", {}), ...pick(INPUTS) }, files: { ...get(m, "files", {}), ...pick(FILES) } };
    }
    const key = m ? m.id : name.toLowerCase();
    const mm = m || {};
    if (!by.has(key)) by.set(key, {
      id: key, name: m ? m.name : name, known: !!m, as: [], used_for: [], found_in: [],
      kind: get(mm, "kind"), runs: get(mm, "runs"),
      inputs: Object.fromEntries(INPUTS.map(k => [k, get(get(mm, "inputs", {}), k)])),
      files: Object.fromEntries(FILES.map(k => [k, get(get(mm, "files", {}), k)])),
      outputs: Object.fromEntries(OUTPUTS.map(k => [k, KIND_OUT.has(k)
        ? (m ? get(mm, "kind") === ({ decisions: "decision", vectors: "embedding" } as any)[k] : null)
        : get(get(mm, "outputs", {}), k)])),
      source: get(mm, "source"), checked: get(mm, "checked"),
    });
    const e = by.get(key);
    if (!e.as.includes(name)) e.as.push(name);
    if (!e.used_for.includes(why)) e.used_for.push(why);
    if (!e.found_in.includes(p)) e.found_in.push(p);
  }
  if (localBase) {
    for (const e of by.values()) {
      if ((e.kind === null || e.kind === "llm") && e.used_for.some((u: string) => u.includes("main") || u.includes("means here"))) {
        e.runs = "local";
        e.note = `Claude Code is pointed at a model server on this machine (${localBase[0]})`;
      }
    }
  }
  const ms = sorted([...by.values()], e => [!e.used_for.some((u: string) => u.includes("main")), e.name]);
  const mainSet = ms.some(e => e.used_for.some((u: string) => u.startsWith("the main model") && !u.includes("none is set")));
  const sum = (side: string, keys: string[]) => {
    const out: Record<string, any> = {};
    for (const k of keys) {
      const yes = ms.filter(e => get(e[side], k) === true).map(e => e.name);
      if (side === "outputs" && KIND_OUT.has(k)) { out[k] = { state: yes.length ? "yes" : "no", by: yes }; continue; }
      out[k] = { state: yes.length ? "yes" : ms.some(e => get(e[side], k) === null) ? "unknown" : "no", by: yes };
    }
    return out;
  };
  const core = ms.find(e => e.used_for.some((u: string) => u.startsWith("the main model"))) ?? null;
  const agents: any[] = [];
  const adir = join(root, ".claude", "agents");
  for (const f of isdir(adir) ? sorted(listdir(adir)) : []) {
    if (f.endsWith(".md")) {
      const fm = _frontmatter(_read(join(adir, f)));
      const mv = fm.model || "inherit";
      const m = mv === "inherit" ? null : identify(mv, t);
      agents.push({ name: f.slice(0, -3), model: mv, model_id: or(get(m || {}, "id"), mv === "inherit" ? null : mv.toLowerCase()),
        path: join(adir, f), about: slice(fm.description || "", 0, 140) });
    }
  }
  const cores = ms.filter(e => e.used_for.some((u: string) => u.startsWith("the main model"))).map(e => e.id);
  const others = ms.filter(e => !cores.includes(e.id) && !e.used_for.every((u: string) => u.endsWith("subagent") || u === "every subagent without its own"));
  const allowed: string[] = [];
  const homeDir = home || expanduser("~/.claude");
  for (const p of [join(homeDir, "settings.json"), join(root, ".claude", "settings.json")])
    allowed.push(...iter(or(get(_json(p), "availableModels"), [])).filter(isStr));
  const opts: [string, string | null][] = !allowed.length ? ALIASES.map(a => [...a] as [string, string | null])
    : [["default", "Claude Code's default"], ...unique(allowed).map(x => [x, null] as [string, null])];
  const choices = opts.map(([v, n]) => {
    const m = identify(v, t) || {};
    return { value: v, name: n || get(m, "name") || v, model_id: get(m, "id"), inputs: get(m, "inputs"), outputs: get(m, "outputs") };
  });
  let current: any = null;
  for (const p of [join(root, ".claude", "settings.local.json"), join(root, ".claude", "settings.json"), join(homeDir, "settings.json")]) {
    if (truthy(get(_json(p), "model"))) { current = _json(p).model; break; }
  }
  return {
    models: ms, main_set: mainSet, core: core ? core.id : null, cores, agents, others: others.map(e => e.id), choices,
    current: or(current, "default"), choices_from: MODEL_DOC,
    inputs: sum("inputs", INPUTS), files: sum("files", FILES), outputs: sum("outputs", OUTPUTS),
    note: mainSet ? null : "No main model is set here, so Claude Code's default runs it, and that default can change with your account or a new release",
  };
}
