// The board's data for one harness: everything the board draws, from evaluate, situations, tiers and
// what backs each rule; with a draft (packages to try, upgrades, your calls), measured on a copy of the harness
// with reality's numbers alongside. First written in Python (retired 2026-10-11).
import * as fs from "fs";
import * as os from "os";
import { spawnSync } from "child_process";
import { loadProfile } from "../judge/evaluate";
import { TEMPLATES, write as writeEdits, rulesEdit, repoModel } from "../write/changes";
import { HISTORY_FOR as EXTRACT_HISTORY_FOR } from "../read/extract";
import { modelDir, load, runtimeFiles } from "../read/spec";
import { readText, join, basename, expanduser, isfile, sorted, slice, truthy, get, withFileCache } from "../py";
import { evaluate, runtimeProfile } from "../judge/evaluate";
import * as progress from "../judge/progress";
import { editors } from "../judge/customizations";
import { coreOf, supported } from "../read/runtimes";
import { startMode, withChoice } from "../read/run-mode";
import { loops } from "../judge/loops";
import { symptoms } from "../judge/symptoms";
import { checks } from "../judge/checks";
import { freeReinAll } from "../judge/freerein";
import { readReview } from "./review";
import { step } from "./steps";
import { flows } from "../judge/flows";
import { moves } from "../judge/moves";
import { stack } from "./stack";
import * as packages from "../write/packages";
import { models } from "../read/models";
import * as oversight from "../judge/oversight";
import * as simulate from "../judge/simulate";
import * as backing from "../judge/backing";
import * as tiersMod from "../judge/tiers";
import { harness as statementsOf } from "../read/statements";
import { plugins, used, ownerOf } from "../read/plugins";
import { TEMPLATE_IDS } from "../write/changes";
import { realpath } from "../py";

const ORDER: Record<string, number> = { yes: 2, partial: 1, no: 0, unchecked: -1 };
const W: Record<string, number> = { asks: 1, checks: 2, blocks: 3 };
const VAL: Record<string, number> = { yes: 1, partial: 0.5 };
export const BUILDS: Record<string, string> = { workbench: "Workbench", companion: "Companion", service: "Service" };

function ways(): Record<string, any> {
  const p = join(modelDir(), "ways.json");
  return isfile(p) ? (JSON.parse(readText(p)).pieces || {}) : {};
}

/** Instances in the board's shape; labels only when nothing traces to a node. */
function inst(i: any) {
  if (i.found.length) return i.found.map((f: any) => ({ label: f.label, scope: f.scope, pkg: f.pkg, hold: f.hold, ctx: f.contexts, path: f.path, lines: f.lines, changed: f.changed ?? false }));
  return (i.instances || []).map((x: string) => ({ label: x, scope: null, pkg: null, ctx: ["base"] }));
}

/** A layer's pieces and totals. */
function layerSummary(a: any) {
  const items = a.slots.flatMap((s: any) => s.items);
  return { stage: Object.fromEntries(items.map((i: any) => [i.id, ORDER[i.state] ?? 0])), maturity: Object.fromEntries(items.map((i: any) => [i.id, i.maturity])),
    progression: a.progression, backed: a.trust.backed };
}

// a runtime's profile is listed only while Free Rein supports that runtime (read/runtimes.ts SUPPORTED)
function profilesJson(): any[] { return JSON.parse(readText(join(modelDir(), "profiles.json"))).profiles.filter((p: any) => p.kind !== "runtime" || supported(p.id)); }

/** Every runtime a harness can be read on. */
function bases(cores: any) {
  const run = profilesJson().filter(p => p.kind === "runtime");
  return run.map(p => ({ id: p.id, name: p.name, core: coreOf(p.id), build: p.build ?? null }));
}

/** For the sidebar: statements (residual counted, not sent), each rule's backing, and enforcement nothing explains. */
function saidBlock(sts: any[], bk: any[], sits: any[], root: string) {
  const keep = sts.filter(x => x.kind !== "residual");
  const resid: Record<string, number> = {};
  for (const x of sts) if (x.kind === "residual") { const k = x.piece || "other"; resid[k] = (resid[k] ?? 0) + 1; }
  const saidSits = new Set(bk.flatMap(b => b.situations.map((r: any) => r.id)));
  const unsaid: any[] = [], seen = new Set<string>();
  for (const s of sits) {
    if (saidSits.has(s.id) || !["held", "asks"].includes(s.outcome)) continue;
    for (const b of s.by || []) {
      if (["permissions", "hard-gate"].includes(b.piece) && ["refuses", "asks"].includes(b.job)) {
        const k = b.rule || b.path || b.what;
        if (seen.has(k)) continue;
        seen.add(k);
        unsaid.push({ situation: s.id, what: s.what, outcome: s.outcome, piece: b.piece, rule: b.rule ?? null, how: b.what, path: b.path ?? null, line: b.line ?? null });
      }
    }
  }
  const full = (f: string) => f.startsWith("~/") ? expanduser(f) : join(root, f);
  return {
    statements: keep.map(x => { const { believed, read_by, ...rest } = x; return { ...rest, text: slice(x.text, 0, 240), path: full(x.source.file) }; }),
    residual: resid, backing: Object.fromEntries(bk.map(b => [b.statement, { backed: b.backed, why: b.why, situations: b.situations, want: b.want }])), unsaid,
    summary: { rules: keep.filter(x => x.kind === "rule").length, measured: bk.filter(b => b.backed !== null).length, backed: bk.filter(b => b.backed === true).length,
      partly: bk.filter(b => b.backed === "partly").length, unbacked: bk.filter(b => b.backed === false).length, unsaid: unsaid.length },
  };
}

/** What tiers change in XP: a piece with tiers earns by tier reached, in place of its steps. */
// Each piece's ladder: only the steps that are real for it, in order, at most Equipped, Tuned, Enforced (Proven waits
// for usage data). A piece with tiers climbs them; one another piece can guard is Equipped, then Enforced once its
// guard is in place; the rest are there or not. Equipped means something is there.
const STEPS = ["Equipped", "Tuned", "Enforced"];
export function ladder(t: any, tiers: any[], guards: any[]): { steps: string[]; reached: number } {
  const there = t.state === "yes" || t.state === "partial";
  if (tiers.length) {
    const steps = tiers.map((x: any) => x.name).filter((n: string) => STEPS.includes(n));
    return { steps, reached: Math.max(t.tier ? Math.min(t.tier.reached, steps.length) : 0, there ? 1 : 0) };
  }
  const g = guards.find((x: any) => x.guarded === t.id);
  if (g) return { steps: ["Equipped", "Enforced"], reached: !there ? 0 : g.active ? 2 : 1 };
  return { steps: ["Equipped"], reached: there ? 1 : 0 };
}

export function tierXp(a: any, tier: Record<string, any>): number {
  const p = load().progression;
  const tx = p.tier_xp ?? 85, px: number[] = p.piece_xp;
  return a.slots.flatMap((s: any) => s.items).filter((i: any) => i.id in tier && (i.state === "yes" || i.state === "partial"))
    .reduce((acc: number, i: any) => acc + progress.xpRound(tx * tier[i.id].reached / tier[i.id].of) - px[i.maturity] - (i.gap_xp ?? 0), 0);
}

/** A layer's situations, per permission mode, without what doesn't change by layer. */
function compactSituations(ov: any) {
  const same = new Set(["stakes", "jobs", "grades", "quick", "situations"]);
  return Object.fromEntries(Object.entries(ov.by_mode).map(([m, r]: [string, any]) => [m, {
    ...Object.fromEntries(Object.entries(r).filter(([k]) => !same.has(k))),
    by: Object.fromEntries(r.situations.map((x: any) => [x.id, Object.fromEntries(["outcome", "verdict", "says", "accounted", "by", "fix", "call", "fixed"].map(k => [k, x[k] ?? null]))])),
  }]));
}

/** What the board needs about plugins: every one on this machine with how it looks (its colour and icon mark
 * what it supplies), which this harness uses, and which plugin's own repo it is (its files then count as the
 * plugin's). */
function pluginFields(root: string | null) {
  return {
    plugins: Object.fromEntries(plugins().map(p => [p.id, { name: p.name, colour: p.colour ?? null, icon: p.icon ?? null }])),
    uses: root ? used(root).map(p => p.id) : [],
    own_package: root ? ownerOf(root)?.id ?? null : null,
  };
}

/** The mode a harness is read in by default: the one its settings set, else auto. */
export function readMode(ov: any): string {
  const m = ((ov || {}).set_mode || {}).mode;
  return m && m in ((ov || {}).by_mode || {}) ? m : "auto";
}

/** The level counts the situations covered too. */
function withSituations(pg: any, sxp: number) {
  const spec = load();
  const total = pg.xp + sxp;
  const [level, start, nxt] = progress.levelOfSpec(spec, total);
  return { ...pg, situation_xp: sxp, xp_total: total, level, level_start: start, next_level_at: nxt, level_curve: spec.progression.level_curve, max_level: spec.progression.max_level ?? 50 };
}

const tierShort = (tier: Record<string, any>) => Object.fromEntries(Object.entries(tier).map(([k, v]) => [k, { reached: v.reached, of: v.of, name: v.name ?? null }]));

/** One layer, measured as if the harness were only that. */
function measureLayer(root: string, al: any, layer: string, runtime: string, sts: any[], stores: string[], rules: boolean) {
  simulate.state.LAYER = layer;
  let ov: any, tier: Record<string, any> = {};
  try {
    ov = oversight.both(root, al, runtime);
    if (rules) {
      const sits = ov.by_mode.auto.situations;
      tier = tiersMod.evaluate(load(), al, root, sits, backing.back(sts, sits, stores), oversight.HISTORY_FOR.get(root));
    }
  } finally { simulate.state.LAYER = "yours"; }
  const pg = { ...al.progression };
  pg.xp += tierXp(al, tier);
  return { ...layerSummary(al), progression: withSituations(pg, ov.by_mode[readMode(ov)].xp ?? 0), tiers: tierShort(tier), situations: compactSituations(ov) };
}

export interface BoardOpts { count_home?: boolean; profile?: string | null; runtime?: string; build?: string | null; base?: boolean; sits?: any[];
  add?: string[]; ups?: string[]; rules?: any[];
  /** Modes you've told Free Rein, by runtime and control ({cursor: {"run mode": "auto-review"}}), for settings no file shows */
  run_choice?: Record<string, Record<string, string>> }

/** The board's data for one harness (or a profile); with a draft (add, ups, rules), measured on a copy. */
export function board(root: string | null, opts: BoardOpts = {}): any {
  oversight.resetCaches();
  oversight.EXTRA.splice(0, oversight.EXTRA.length, ...(opts.sits || []).filter(x => x && typeof x === "object" && !Array.isArray(x)));
  try {
    const b = simulate.withHome(opts.count_home ?? false, () => withFileCache(() => withDraft(root, opts.count_home ?? false, opts.profile ?? null,
      opts.runtime ?? "claude", opts.build ?? null, opts.add || [], opts.ups || [], opts.base ?? true, opts.rules || [])));
    if (b && b.run_mode && opts.run_choice) b.run_mode = withChoice(b.run_mode, opts.run_choice[coreOf((b.runtime || {}).id || "")]);
    return b;
  } finally { oversight.EXTRA.length = 0; }
}

/** Every path in the output under a, moved to b. */
function swap(x: any, a: string, b: string): any {
  if (typeof x === "string") return x === a || x.startsWith(a + "/") ? b + x.slice(a.length) : x;
  if (Array.isArray(x)) return x.map(v => swap(v, a, b));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, swap(v, a, b)]));
  return x;
}

/** Paths in a trial copy, back to where they really are: a package's own file, or yours. */
function back(x: any, dst: string, root: string): any {
  if (Array.isArray(x)) return x.map(v => back(v, dst, root));
  if (x && typeof x === "object") {
    if (typeof x.path === "string" && x.path.startsWith(dst + "/")) {
      const real = realpath(x.path);
      x = { ...x, path: !real.startsWith(realpath(dst) + "/") ? real : progress.TAGS.has(x.path) ? null : root + x.path.slice(dst.length) };
    }
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, back(v, dst, root)]));
  }
  return x;
}

function gone(x: any, root: string): any {
  if (Array.isArray(x)) return x.map(v => gone(v, root));
  if (x && typeof x === "object") {
    if (typeof x.path === "string" && x.path.startsWith(root)) x = { ...x, path: null };
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, gone(v, root)]));
  }
  return x;
}

/** A new, empty project folder: where a new harness starts from a runtime's out-of-the-box setup. */
function empty(): [string, string] {
  const tmp = fs.mkdtempSync(join(os.tmpdir(), "free-rein-new-"));
  const d = join(tmp, "new-harness");
  fs.mkdirSync(d);
  spawnSync("git", ["init", "-q", d]);
  return [tmp, d];
}

/** The numbers a board shows, in the shape the board compares (reality vs a draft). */
function snapshot(b: any) {
  const pg = b.progression || {};
  const modes = Object.entries(((b.oversight || {}).by_mode) || {}) as [string, any][];
  return { key: b.key, xp: pg.xp ?? null, backed: b.backed, rank: (pg.rank || {}).name || "Unranked",
    cats: b.trust.categories.map((c: any) => [c.name, c.evidence_score]),
    m: Object.fromEntries(b.slots.flatMap((s: any) => s.types.map((t: any) => [t.id, [t.name, t.maturity, s.id]]))),
    ach: b.sets.filter((x: any) => x.kind === "synergy" && x.status === "active").map((x: any) => x.name),
    weak: b.sets.filter((x: any) => x.kind === "curse" && x.status === "active").map((x: any) => x.name),
    ov: Object.fromEntries(modes.map(([m, o]) => [m, Object.fromEntries(o.situations.map((x: any) => [x.id, x.verdict]))])),
    sxp: Object.fromEntries(modes.map(([m, o]) => [m, o.xp ?? 0])) };
}

/** A draft: packages to try and pieces to upgrade, measured together on one copy; nothing real changes. */
function withDraft(rootIn: string | null, countHome: boolean, profile: string | null, runtimeIn: string, build: string | null,
  add: string[], ups: string[], base: boolean, rules: any[]): any {
  if (!(add.length || ups.length || rules.length)) return boardOf(rootIn, countHome, profile, runtimeIn, build, base);
  let root = rootIn, runtime = runtimeIn, newRt: string | null = null, etmp: string | null = null, reality: any;
  if (profile && !root) {
    const prof = loadProfile(profile);
    if (prof.kind !== "runtime") return boardOf(root, countHome, profile, runtime, build, base);
    newRt = profile;
    [etmp, root] = empty();
    runtime = profile;
  }
  reality = boardOf(root, countHome, null, runtime, build, base);
  const [tmp, dst, tags, tried] = packages.trial(root!, add);
  const measured: string[] = [], requested: string[] = [];
  for (const u of ups) {
    const fn = TEMPLATES[u];
    const es = fn ? fn(dst) : null;
    if (es && es.length) { writeEdits(es, dst); measured.push(u); } else requested.push(u);
  }
  const es = rulesEdit(dst, rules);
  if (es) writeEdits(es, dst);
  progress.TAGS.clear();
  for (const [k, v] of tags) progress.TAGS.set(k, v);
  oversight.HISTORY_FOR.set(dst, root!);
  EXTRACT_HISTORY_FOR.set(dst, root!);
  let out: any;
  try { out = swap(back(boardOf(dst, countHome, null, runtime, build, base), dst, root!), dst, root!); }
  finally { progress.TAGS.clear(); oversight.HISTORY_FOR.delete(dst); EXTRACT_HISTORY_FOR.delete(dst); }
  packages.cleanup(tmp);
  // which frameworks it uses: the draft's (it may add one), as read on the copy
  if (out.models) {
    const lm = models(root!);
    out.models.live = { current: lm.current, agents: Object.fromEntries(lm.agents.map((x: any) => [x.name, x.model])) };
  }
  out.tried = tried;
  out.draft = { add: tried, ups, rules, measured, requested, reality: snapshot(reality) };
  if (newRt) {
    out = gone(out, root!);
    fs.rmSync(etmp!, { recursive: true, force: true });
    out.new = { runtime: newRt, name: reality.runtime.name };
    out.key = "new:" + newRt;
    out.name = `New harness on ${reality.runtime.name}`;
    out.draft.reality.key = out.key;
    out.profile = null;
    out.build = { ...out.build, id: reality.build.id, name: reality.build.name };
  }
  return out;
}

function boardOf(root: string | null, countHome: boolean, profile: string | null, runtime: string, build: string | null, base: boolean): any {
  const rtLabel = ((load().cores[coreOf(runtime)] || {}).name) || runtime;
  step("files", profile ? `Reading the record of ${rtLabel}` : `Finding the files ${rtLabel} reads, and reading them`);
  const a = evaluate(root, { count_home: countHome, profile, runtime, base });
  const nParts = a.slots.reduce((n: number, s: any) => n + s.items.reduce((m: number, i: any) => m + (i.instances || []).length, 0), 0);
  step("files", profile ? `Reading the record of ${rtLabel}` : `Finding the files ${rtLabel} reads, and reading them`, `${nParts} part${nParts === 1 ? "" : "s"} found, ${a.slots.reduce((n: number, s: any) => n + s.items.filter((i: any) => i.state === "yes").length, 0)} of 62 pieces in place`);
  let layers: any = null;
  const evals: Record<string, any> = {};
  if (!profile) {
    step("layers", "Measuring each layer on its own", `${rtLabel} built in (1 of 4)`);
    evals.base = evaluate(root, { runtime, base, layer: "base" });
    step("layers", "Measuring each layer on its own", "packages (2 of 4)");
    evals.packages = evaluate(root, { count_home: countHome, runtime, base, layer: "packages" });
    step("layers", "Measuring each layer on its own", "this repo (3 of 4)");
    evals.project = evaluate(root, { count_home: countHome, runtime, base, layer: "project" });
    step("layers", "Measuring each layer on its own", "your home folder (4 of 4)");
    evals.home = evaluate(root, { count_home: countHome, runtime, base, layer: "home" });
  }
  const home = a.home, WAYS = ways();
  const slots = a.slots.map((s: any) => ({
    id: s.id, name: s.name, job: s.job ?? "", about: s.about ?? "",
    types: s.items.map((i: any) => ({
      id: i.id, name: i.name, what: i.what, example: i.example ?? "", kind: i.kind ?? "capability", firm: i.kind === "control" ? (i.strength ?? "") : "",
      state: i.state, stage: ORDER[i.state] ?? 0, badge: i.badge ?? "", count: i.count ?? 0, inst: inst(i), fromHome: i.from_home ?? false,
      profile: i.profile ?? null, gap_xp: i.gap_xp ?? 0, by_layer: i.by_layer ?? null, runtime_items: i.runtime_items || [], runtime_when: i.runtime_when || {}, ...(i.elsewhere ? { elsewhere: i.elsewhere } : {}), ...(i.held ? { held: i.held } : {}), ...(i.not_offered ? { not_offered: true } : {}),
      supplied: i.supplied ?? null, control: i.control ?? null, holds: i.holds, asks: i.asks, maturity: i.maturity, upgrade_xp: i.upgrade_xp,
      how: Object.fromEntries(Object.entries(i.cores || {}).map(([k, v]: [string, any]) => [k, v[0]])),
      rt: Object.fromEntries(Object.entries(i.cores || {}).map(([k, v]: [string, any]) => [k, [v[0], v.length > 1 ? v[1] : null]])),
      change: i.change ?? null, preview: i.preview ?? null,
      ...(truthy(i.row) ? { row: i.row } : {}), ...(truthy(i.workflow) ? { workflow: i.workflow } : {}), ...(i.id in WAYS ? { ways: WAYS[i.id] } : {}),
      audit: truthy(i.merged_from) ? "merged" : truthy(i.weak) ? "weak" : "pass", was: truthy(i.merged_from) ? i.merged_from.join(" + ") : null,
      extra: (home[i.id] || []).map((x: any) => ({ label: x.label, scope: x.scope, pkg: x.pkg, ctx: x.contexts, path: x.path })),
    })),
    ...(truthy(s.rows) ? { rows: s.rows } : {}),
  }));

  const nxt = a.tiers.find((t: any) => !t.reached) ?? null;
  const states: Record<string, string> = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i.state]));
  const nexts: Record<string, string[]> = {};
  const note = (id: string, why: string) => (nexts[id] ??= []).push(why);
  if (nxt) for (const x of nxt.needs) if (states[x] !== "yes") note(x, "a key piece for what most harnesses add next");
  const cats = a.trust.categories;
  if (cats.length) {
    const weakest = cats.reduce((m: any, c: any) => (c.evidence_score < m.evidence_score ? c : m), cats[0]);
    const gaps = sorted(weakest.pieces.filter((p: any) => p.state !== "yes"), (p: any) => -(W[p.strength] ?? 1));
    for (const p of gaps.slice(0, 2)) note(p.id, `backs “${weakest.name}”, the kind of work with the least evidence (${weakest.evidence_score}%)`);
  }

  let sts: any[] = [], stores: string[] = [];
  const readsRules = !!root && runtime === "claude" && !a.profile;
  if (readsRules) {
    step("prose", "Reading your instructions, sentence by sentence");
    try {
      // the prose the runtime loads: the repo's, and (when your home folder counts) your own and your packages' skills,
      // agents and commands, from the parts the board found
      const PROSE = new Set(["proj-instructions", "personal-instructions", "folder-instructions", "skills", "subagents", "commands", "contracts", "modes",
        "plan-first", "review-workflow", "git-workflow", "harness-checker", "independent-checker"]);
      const more = slots.flatMap((sl: any) => sl.types.filter((t: any) => PROSE.has(t.id)).flatMap((t: any) => [...(t.inst || []), ...(countHome ? t.extra || [] : [])]))
        .map((x: any) => x.path).filter((p: any) => typeof p === "string" && p && (/\.md$/i.test(p) || !/\.[a-z0-9]+$/i.test(p)));
      sts = statementsOf(root!, undefined, undefined, [...new Set<string>(more)]);
      step("prose", "Reading your instructions, sentence by sentence", ((n, r) => `${n} sentence${n === 1 ? "" : "s"}, ${r} rule${r === 1 ? "" : "s"}`)(sts.filter(x => x.kind !== "residual").length, sts.filter(x => x.kind === "rule").length));
      stores = backing.vaultDirs(root!);
      oversight.SAID.splice(0, oversight.SAID.length, ...backing.saidSituations(sts, stores));
    } catch { sts = []; }
  }
  let ov: any;
  step("situations", "Playing out risky actions through your permission rules and hooks");
  try { ov = oversight.both(root, a, runtime); } finally { oversight.SAID.length = 0; }
  let tier: Record<string, any> = {}, said: any = null;
  step("situations", "Playing out risky actions through your permission rules and hooks", ((ss: any[]) => `${ss.length} actions, ${ss.filter((x: any) => x.verdict === "exposed").length} exposed`)(ov.by_mode[readMode(ov)].situations || []));
  if (sts.length || readsRules) {
    step("backing", "Matching each rule to what enforces it");
    const sits = ov.by_mode.auto.situations;
    const bk = backing.back(sts, sits, stores);
    said = saidBlock(sts, bk, sits, root!);
    step("backing", "Matching each rule to what enforces it", (said.summary.rules ? `${said.summary.backed} of ${said.summary.rules} rule${said.summary.rules === 1 ? "" : "s"} enforced, ${said.summary.unbacked} only asked` : "no rules to match"));
    tier = tiersMod.evaluate(load(), a, root!, sits, bk, oversight.HISTORY_FOR.get(root!));
    a.progression.xp += tierXp(a, tier);
    for (const sl of slots) for (const t of sl.types) if (t.id in tier) t.tier = tier[t.id];
  }
  const tiersOf: Record<string, any[]> = Object.fromEntries(load().slots.flatMap((s: any) => s.items).map((it: any) => [it.id, it.tiers || []]));
  for (const sl of slots) for (const t of sl.types) t.ladder = ladder(t, tiersOf[t.id] || [], a.guards);
  // how it checks: the loops at four speeds, each with its verdict, and what's wrong
  const byId = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i]));
  step("loops", "Finding loops and how work flows between steps");
  const prof0 = a.profile, howItFlows = prof0 || !root ? null : flows(root);
  const howItChecks = loops(byId, howItFlows);
  if (Object.keys(evals).length) {
    step("score", "Scoring each layer's pieces, rules and situations");
    if (readsRules) oversight.SAID.splice(0, oversight.SAID.length, ...(sts.length ? backing.saidSituations(sts, stores) : []));
    try { layers = Object.fromEntries(Object.entries(evals).map(([k, al]) => [k, measureLayer(root!, al, k, runtime, sts, stores, readsRules)])); }
    finally { oversight.SAID.length = 0; }
    layers.yours = { ...layerSummary(a), progression: withSituations(a.progression, ov.by_mode[readMode(ov)].xp ?? 0), tiers: tierShort(tier), situations: compactSituations(ov) };
  }
  step("checks", "Listing every check and what it found");
  const st = a.stats;
  const under = !a.profile ? runtimeProfile(runtime) : null;
  const underBuild = (under || {}).build !== "workbench" ? (under || {}).build ?? null : null;
  const bid = (a.profile || {}).build || build || underBuild || "workbench";
  const rtName = (under || {}).name || ((a.cores[runtime] || {}).name ?? runtime);
  const prof = a.profile;
  // a runtime profile, or a hosted product, reads as itself; other profiles under the runtime chosen
  const rtId = prof && (prof.kind === "runtime" || prof.kind === "product") ? prof.id : runtime;
  return {
    key: prof ? prof.id : basename(root!),
    name: prof ? (["reference", "example"].includes(prof.kind) ? prof.name : `${prof.name}, out of the box`) : basename(root!),
    ...(prof ? pluginFields(null) : pluginFields(root!)), profile: prof,
    runtime: { id: rtId, name: prof ? prof.name : rtName, core: coreOf(rtId) },
    // the mode it starts in (read from the harness's files, or the runtime's default) and its sandbox, from the runtime record
    loops: howItChecks, symptoms: symptoms(byId), flows: howItFlows,
    // free rein: how much it does on its own, and whether the rules written in its instructions hold, by kind of action
    free_rein: freeReinAll(ov, readMode(ov), readsRules ? said : null,
      ((((load().cores[coreOf(rtId)] || {}).run_modes || {}).modes || []) as any[]).map((m: any) => m.level)),
    // the agent review, when the user's own agent has written one: findings whose quotes check out (report/review.ts)
    review: prof ? null : readReview(root),
    // how it knows: every check it makes, by how it knows (read, matched, recorded), with what each found here
    checks: prof ? null : checks({ root, types: slots.flatMap((x: any) => x.types), statements: said ? said.statements : [], situations: ov.by_mode[readMode(ov)].situations || [],
      lint: a.lint || {}, loops: howItChecks, flows: howItFlows, record: runtimeFiles()[coreOf(rtId)] || null, rtName }),
    // everything worth doing next, in one list (situations, rules, loops, flows, pieces), merged and ranked
    moves: prof ? [] : moves({ oversight: ov, said: readsRules ? said : null, loops: howItChecks, flows: howItFlows, next: nexts },
      Object.fromEntries(slots.flatMap((s: any) => s.types).map((t: any) => [t.id, t])), new Set(TEMPLATE_IDS)),
    // the levels it reads this harness at, most specific first, with what's at each (model/runtimes/<id>.json "layers")
    stack: prof && prof.kind !== "runtime" ? null : stack({ root: prof ? null : root, rt: load().cores[coreOf(rtId)], rtName: prof ? prof.name : rtName, slots,
      baseShips: Object.fromEntries(((runtimeProfile(prof ? rtId : runtime) || {}).ships || []).filter((e: any) => truthy(e.ships)).map((e: any) => [e.type, { ships: e.ships }])), baseOn: base !== false, runMode: startMode(prof ? null : root, (load().cores[coreOf(rtId)] || {}).run_modes), models: readsRules ? models(root!) : null }),
    // the models the runtime it's read on can run, as its docs say (a variant, such as Copilot's CLI, answers for itself)
    // and the model its own file in this repo sets, when it keeps one there (a draft can try another)
    runtime_models: (m => !m ? null : (({ variants, ...rest }: any) => ({ ...((variants || {})[rtId] ? { ...rest, ...variants[rtId] } : rest),
      current: root && !prof ? repoModel(root, rtId) : null }))(m))((load().cores[coreOf(rtId)] || {}).models),
    run_mode: startMode(prof ? null : root, (load().cores[coreOf(rtId)] || {}).run_modes), sandbox: (load().cores[coreOf(rtId)] || {}).sandbox ?? null,
    bases: bases(a.cores), templates: [...TEMPLATE_IDS].sort(),
    // each editor's customization window, and the pieces it edits directly (its sections say which)
    editors: editors().editors.map((e: any) => ({ ...e, edits: [...new Set(e.sections.flatMap((s: any) => s.pieces || []))] })), customizations: a.customizations,
    base_ships: !prof ? Object.fromEntries(((runtimeProfile(runtime) || {}).ships || []).filter((e: any) => truthy(e.ships))
      .map((e: any) => [e.type, { ships: e.ships, note: e.note ?? "", source: e.source ?? null }])) : {},
    base_on: base,
    available: prof && prof.kind !== "runtime" ? [] : packages.catalog().map(p => Object.fromEntries(["id", "name", "kind", "about", "parts", "install", "market", "runs_on"].map(k => [k, p[k] ?? null]))),
    tried: [],
    build: { id: bid, name: BUILDS[bid] ?? null, set: prof ? "profile" : build ? "you" : underBuild ? "runtime" : "default" },
    layers,
    paths: { total: st.guarded, holds: st.guarded_hold, asks: st.guarded_ask },
    oversight: ov,
    said: readsRules ? said : null,
    models: readsRules ? models(root!) : null,
    trustx: cats.map((c: any) => ({ name: c.name, pieces: c.pieces.map((p: any) => ({ id: p.id, w: W[p.strength] ?? 1, val: VAL[p.state] ?? 0 })) })),
    tiersx: a.tiers.map((t: any) => ({ name: t.name, blurb: t.blurb ?? "", reached: t.reached, needs: sorted(t.needs) })),
    sets: a.combos.map((c: any) => ({ name: c.name, kind: c.kind, effect: c.effect,
      status: c.kind === "curse" && c.status === "dormant" && (c.counter || []).some((x: any) => x.state === "yes") ? "cleared" : c.status,
      ids: sorted(c.all || []), lifts: sorted(c.none || []), lifts_text: typeof c.lifts === "string" ? c.lifts : "" })),
    guards: a.guards.map((g: any) => ({ cap: g.guarded, ctl: g.by, name: (a.combos.find((c: any) => c.id === g.combo) || {}).name ?? "", active: g.active })),
    slots, next: prof ? {} : nexts,
    tier: a.tier >= 0 ? a.tiers[a.tier].name : null,
    tiers: a.tiers.map((t: any) => ({ name: t.name, reached: t.reached, missing: t.missing })),
    backed: a.trust.backed,
    rules: Object.fromEntries(Object.entries(load().progression).filter(([k]) => k !== "note")),
    progression: truthy(a.progression) ? withSituations(a.progression, ov.by_mode[readMode(ov)].xp ?? 0) : null,
    cores: Object.fromEntries(Object.entries(a.cores).filter(([k]) => supported(k)).map(([k, v]: [string, any]) => [k, v.name ?? k])),
    trust: { scale: a.trust.scale, backed: a.trust.backed, categories: cats.map((c: any) => ({ id: c.id, name: c.name, question: c.question,
      evidence_score: c.evidence_score, missing: c.missing, pieces: c.pieces.map((p: any) => ({ id: p.id, name: p.name, state: p.state })) })) },
  };
}

/** A reading as the extension takes it: {checked, harnesses: [the board]}. */
export function reading(root: string | null, opts: BoardOpts = {}) {
  return { checked: opts.profile && !root ? "profile" : "live", harnesses: [board(root, opts)] };
}

/** The example profiles there are. */
export const profiles = () => profilesJson().map(p => Object.fromEntries(["id", "name", "kind", "build", "checked_on", "about"].map(k => [k, p[k] ?? null])));
export { get };
