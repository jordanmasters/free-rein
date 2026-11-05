// Evaluate Free Rein's model against a harness: which pieces are equipped, which combos are active, the
// headline stats and the places it writes. First written in Python (retired 2026-10-11).
import { modelDir, repoDir, load } from "../read/spec";
import { re, I, readText, loads, join, dirname, relpath, realpath, expanduser, glob, sorted, unique, round, get, iter, items as pyItems, isDict, or, truthy } from "../py";
import { lint, Finding } from "./lint";
import { discoverVaults } from "../read/extract";
import * as progress from "./progress";
import * as runtimes from "../read/runtimes";
import * as packages from "../write/packages";
import * as hardening from "./hardening";
import { customizations } from "./customizations";

const FREE_REIN = repoDir;

function dotted(obj: any, path: string): any {
  for (const key of path.split(".")) {
    if (!isDict(obj)) return null;
    obj = get(obj, key);
  }
  return obj;
}

/** Python ==, for the JSON values a detect rule compares */
const pyEq = (a: any, b: any): boolean => JSON.stringify(a) === JSON.stringify(b) || (a === null && b === undefined) || (a === undefined && b === null);

function matchNodes(nodes: any[], where: Record<string, any>): any[] {
  return nodes.filter(n => {
    for (const [k, v] of Object.entries(where)) {
      let ok: boolean;
      if (k === "_label_re") ok = !!re(v, I).search(n.label ?? "");
      else if (k === "_any_re") ok = !!re(v, I).search((n.label ?? "") + " " + (n.summary || ""));
      else if (k === "_label_suffix") ok = (n.label ?? "").endsWith(v);
      else ok = pyEq(dotted(n, k), v);
      if (!ok) return false;
    }
    return true;
  });
}
const matchEdges = (edges: any[], where: Record<string, any>) => edges.filter(e => Object.entries(where).every(([k, v]) => pyEq(e[k] ?? null, v)));

function computeStats(nodes: any[], edges: any[]) {
  const guarded = edges.filter(e => truthy(e.verifier));
  const infra = guarded.filter(e => e.locus === "infrastructure").length;
  const human = guarded.filter(e => e.verifier === "human").length;
  const auth = new Set(nodes.filter(n => truthy(n.authoritative)).map(n => n.id));
  const writes = edges.filter(e => e.type === "writes" && auth.has(e.target));
  const gated = writes.filter(e => e.source.startsWith("gate:")).length;
  const weight = nodes.filter(n => n.type === "surface" || n.type === "contract").reduce((a, n) => a + (n.weight || 0), 0);
  return {
    weight, friction: human,
    coverage: writes.length ? round(100 * gated / writes.length) : 100,
    enforcement: guarded.length ? round(100 * infra / guarded.length) : 0,
    trusted_writes: writes.length, guarded: guarded.length, guarded_hold: infra,
    guarded_ask: guarded.filter(e => e.locus === "model").length, ungated_writes: writes.length - gated,
  } as Record<string, number>;
}

/** The places the harness writes or keeps state, trusted (the record of truth) and the rest. */
function places(root: string, nodes: any[], edges: any[]) {
  const bases = [root, ...discoverVaults(root).map(([vp]) => join(root, vp))];
  const names = new Map(nodes.map(n => [n.id, n.label ?? n.id]));
  let out: any[] = [];
  for (const n of nodes) {
    if (n.type !== "substrate") continue;
    const p = (n.label ?? "").replace(/\/+$/, "") || n.id;
    const exists = bases.some(b => glob(join(b, p.split("YYYY-MM-DD").join("*"))).length > 0);
    const writes = edges.filter(e => e.type === "writes" && e.target === n.id);
    out.push({ id: n.id, path: n.label ?? n.id, trusted: truthy(n.authoritative), exists, writes: writes.length,
      checked: writes.filter(e => e.source.startsWith("gate:")).length,
      unchecked_by: sorted(unique(writes.filter(e => !e.source.startsWith("gate:")).map(e => names.get(e.source) ?? e.source))) });
  }
  out = sorted(out, x => [!x.trusted, -(x.writes - x.checked), x.path]);
  const group = (xs: any[]) => {
    const w = xs.reduce((a, x) => a + x.writes, 0), c = xs.reduce((a, x) => a + x.checked, 0);
    return { places: xs.length, on_disk: xs.filter(x => x.exists).length, writes: w, checked: c, coverage: w ? round(100 * c / w) : null };
  };
  const trusted = out.filter(x => x.trusted), other = out.filter(x => !x.trusted);
  return { list: out, trusted: group(trusted), other: group(other), trusted_share: out.length ? round(100 * trusted.length / out.length) : null,
    trusted_by: "guessed from folder names" };
}

function detect(item: any, nodes: any[], edges: any[], findings: Finding[]): [string, string, string[], number, any[]] {
  for (const rule of item.detect || []) {
    let hits: any[] = [], n: number, insts: string[];
    if ("nodes" in rule) { hits = matchNodes(nodes, rule.nodes); n = hits.length; insts = sorted(unique(hits.map(h => h.label ?? h.id))); }
    else if ("edges" in rule) { n = matchEdges(edges, rule.edges).length; insts = []; }
    else if (truthy(rule.findings)) { n = findings.length; insts = sorted(unique(findings.map(f => f.class))); }
    else continue;
    if (n) {
      let badge: string = (rule.badge ?? "").split("{n}").join(String(n)).split("{findings}").join(String(findings.length));
      if (badge.includes("{files}") && "nodes" in rule) badge = badge.split("{files}").join(String(hits.reduce((a, h) => a + (h.files || 0), 0)));
      return [rule.state, badge, insts, n, hits];
    }
  }
  return [item.default ?? "no", "", [], 0, []];
}

const SHIPS: Record<number, string> = { 0: "no", 1: "partial", 2: "yes", 3: "yes" };

function profiles(): any[] { return JSON.parse(readText(join(modelDir(), "profiles.json"))).profiles; }

export function loadProfile(pid: string): any {
  const p = profiles().find(x => x.id === pid);
  if (!p) throw new Error(`no profile '${pid}'`);
  return p;
}
export function runtimeProfile(runtime: string): any {
  try { return profiles().find(p => p.kind === "runtime" && p.id === runtime) ?? null; } catch { return null; }
}

export interface EvalOpts { count_home?: boolean; profile?: string | null; runtime?: string; layer?: string; base?: boolean }

/** The model applied to one harness (or a profile): every piece's state, combos, tiers, maturity, XP, trust. */
export function evaluate(root: string | null, opts: EvalOpts = {}): any {
  let countHome = opts.count_home ?? false;
  const runtime = opts.runtime ?? "claude", layer = opts.layer ?? "yours", base = opts.base ?? true;
  const prof = opts.profile ? loadProfile(opts.profile) : null;
  progress.INSTALLED.clear();
  if (root && !prof) for (const [k, v] of Object.entries(packages.installedBy(root))) progress.INSTALLED.set(k, v);
  let nodes: any[], edges: any[], findings: Finding[], home: Record<string, any[]>, g: any = null, bound = new Set<string>();
  // skills in this repo this runtime doesn't load (another runtime's folder, a plugin's own skills/)
  let unloaded: any[] = [];
  if (prof) { nodes = []; edges = []; findings = []; home = {}; }
  else {
    [g, findings] = lint(root!);
    home = runtime in runtimes.HOME_SKILLS ? progress.homeExtras(FREE_REIN(), { skillDirs: runtimes.HOME_SKILLS[runtime], promptHooks: runtime === "claude" }) : {};
    const rr = realpath(root!) + "/";
    home = Object.fromEntries(Object.entries(home).map(([k, v]) => [k, v.filter(x => !(x.path && realpath(x.path).startsWith(rr)))]));
    const allnodes = [...g.nodes.values()];
    const plugin = (p: any) => !!p && realpath(p).includes("/.claude/plugins/");
    const pathOf = (n: any) => (n.provenance || {}).path ?? null;
    const runs = (settings: string | null, event: string) => runtimes.runsClaudeHook(runtime, settings, event, root);
    const hooked = new Set(g.edges.filter((e: any) => e.type === "binds" && runs(pathOf(g.nodes.get(e.source) ?? {}), e.event))
      .flatMap((e: any) => [e.target, "gate:" + e.target.slice(e.target.indexOf(":") + 1)]));
    const ignored = new Set((runtimes.IGNORES_IN_CLAUDE_MD[runtime] ?? []).map(s => "config:" + s));
    let keep = (n: any): boolean => !ignored.has(n.id) && (hooked.has(n.id) || (n.hook_events ?? []).some((e: string) => runs(pathOf(n), e))
      || runtimes.visible(pathOf(n), root, runtime) && !(runtime !== "claude" && runtime !== "open" && plugin(pathOf(n))));
    if (layer === "base") keep = () => false;
    else if (["packages", "project", "home"].includes(layer)) {
      const keepRt = keep;
      keep = (n: any) => {
        if (!keepRt(n)) return false;
        const [sc, pkg] = progress.where(pathOf(n), root!, FREE_REIN());
        if (pkg) return true;
        const mineHome = sc === "user" || sc === "org";
        return ({ packages: false, project: !mineHome, home: mineHome } as any)[layer];
      };
    }
    nodes = allnodes.filter(n => keep(n));
    const kept = new Set(nodes.map(n => n.id));
    if (layer === "yours") unloaded = allnodes.filter((x: any) => x.type === "unit" && !x.missing && !kept.has(x.id) && pathOf(x)
      && realpath(pathOf(x)).startsWith(realpath(root!) + "/"));
    const pathless = new Set(allnodes.filter(n => !pathOf(n)).map(n => n.id));
    const nbrs = new Map<string, Set<string>>();
    const link = (a: string, b: string) => { if (!nbrs.has(a)) nbrs.set(a, new Set()); nbrs.get(a)!.add(b); };
    for (const e of g.edges) { link(e.source, e.target); link(e.target, e.source); }
    const orphan = (i: string) => pathless.has(i) && !!nbrs.get(i)?.size && [...nbrs.get(i)!].every(o => !kept.has(o) && !pathless.has(o));
    nodes = nodes.filter(n => !orphan(n.id));
    const ids = new Set(nodes.map(n => n.id));
    edges = g.edges.filter((e: any) => ids.has(e.source) && ids.has(e.target));
    bound = new Set([...hooked, ...edges.filter((e: any) => e.type === "binds").map((e: any) => e.target)]);
    if (layer === "base") { findings = []; countHome = false; }
    else if (layer === "packages" || layer === "project") {
      home = Object.fromEntries(Object.entries(home).map(([k, v]) => [k, v.filter(x => x.pkg)]));
      if (layer === "packages") findings = [];
    } else if (layer === "home") findings = [];
  }
  const under = base && !prof ? runtimeProfile(runtime) : null;
  const ships: Record<string, any> = Object.fromEntries(((prof || {}).ships || []).map((e: any) => [e.type, e]));
  const baseShips: Record<string, any> = Object.fromEntries(((under || {}).ships || []).map((e: any) => [e.type, e]));
  const RANK: Record<string, number> = { unchecked: -1, no: 0, partial: 1, yes: 2 };
  const spec = load();
  const st = (p: string) => {
    try {
      const t = readText(p, "replace");
      if (t.includes("�")) return {};
      const v = loads(t);
      return isDict(v) ? v : {};
    } catch { return {}; }
  };
  const sets = [...["settings.json", "settings.local.json"].map(f => st(join(root || "", ".claude", f))), ...(countHome ? [st(expanduser("~/.claude/settings.json"))] : [])];
  const bundledOff = sets.some(x => truthy(get(x, "disableBundledSkills")));
  const offSkills = !prof ? new Set(sets.flatMap(x => pyItems(or(get(x, "skillOverrides"), {})).filter(([, v]) => v === "off").map(([k]) => k))) : new Set<string>();
  const stats = computeStats(nodes, edges);

  const states: Record<string, string> = {}, counts: Record<string, number> = {}, kinds: Record<string, string> = {};
  const slots: any[] = [];
  for (const s of spec.slots) {
    const items: any[] = [];
    for (const it of s.items) {
      let state: string, badge: string, insts: string[], n: number, hits: any[];
      if (prof) {
        const e = ships[it.id];
        // a hosted product shows only some of what it has: a piece it doesn't show you is one you can't see from outside
        const hidden = !e && prof.kind === "product";
        state = e ? SHIPS[e.ships] : hidden || it.default === "unchecked" ? "unchecked" : "no";
        badge = hidden ? `${prof.name} doesn't show whether it has this` : (e || {}).note ?? ""; insts = []; n = e && e.ships ? 1 : 0; hits = [];
      } else [state, badge, insts, n, hits] = detect(it, nodes, edges, findings);
      const foundPre = !prof ? progress.instances(hits, root, FREE_REIN()) : [];
      let supplied: string | null = foundPre.length && (state === "yes" || state === "partial") ? (foundPre.every(f => f.pkg) ? "package" : "you") : null;
      const b = baseShips[it.id];
      if (b && RANK[SHIPS[b.ships]] > (RANK[state] ?? 0)) {
        state = SHIPS[b.ships]; n = Math.max(n, 1); supplied = "runtime"; badge = badge || b.note;
      }
      let control: string | null = null;
      if (prof) {
        const e = ships[it.id];
        control = e && e.ships ? ((e || {}).control || ({ product: "vendor", reference: "you", example: "you" } as any)[prof.kind] || "default") : null;
        supplied = e && e.ships ? "runtime" : null;
      } else if (supplied === "runtime") control = b.control || "default";
      else if (supplied) control = supplied;
      const fromHome = countHome && (state === "no" || state === "partial") && !!(home[it.id] && home[it.id].length) && supplied !== "runtime";
      if (fromHome) {
        state = "yes"; n = home[it.id].length;
        supplied = home[it.id].every(x => x.pkg) ? "package" : "you";
        control = supplied;
      } else if (countHome && state === "yes" && home[it.id] && home[it.id].length && supplied !== "runtime") n += home[it.id].length;
      const byLayer = { yours: supplied !== "runtime" ? n : 0, runtime: 0 };
      const rtItems: string[] = b && !bundledOff ? (b.items || []).filter((x: string) => !offSkills.has(x)) : [];
      const rtWhen = b && !bundledOff ? Object.fromEntries(Object.entries(b.items_when || {}).filter(([k]) => !offSkills.has(k))) : {};
      if (rtItems.length && supplied !== "runtime") { n += rtItems.length; byLayer.runtime = rtItems.length; }
      else if (rtItems.length) { n = rtItems.length; byLayer.runtime = rtItems.length; }
      states[it.id] = state; counts[it.id] = n; kinds[it.id] = it.kind ?? "capability";
      const found = progress.instances(hits, root, FREE_REIN());
      let profItems: any = null;
      if (it.id === "skills" && root && !prof && (state === "yes" || state === "partial")) {
        // the skills of the layer being measured, as this runtime loads them: the runtime alone has none of yours, a
        // package layer only its own, and a skill in another runtime's folder isn't one of them
        try { profItems = hardening.skills(root, null, { nodes, edges }, findings); } catch { profItems = null; }
      }
      // a share of gap_xp for each item with no gaps, up to gap_items: adding a weak item never lowers XP
      const gx = (spec.progression || {}).gap_xp ?? 0, gn = (spec.progression || {}).gap_items ?? 5;
      const gapXp = profItems && profItems.summary.n ? progress.xpRound(gx * Math.min(profItems.summary.ok, gn) / gn) : 0;
      // skills in this repo this runtime doesn't load, and who does: other runtimes, or a plugin once it's installed
      const elsewhere = it.id === "skills" && root ? unloaded.map((x: any) => {
        const path = x.provenance.path;
        const fr = unique(Object.keys(runtimes.READS).filter(r => runtimes.coreOf(r) !== runtimes.coreOf(runtime) && runtimes.visible(path, root, r)).map(runtimes.coreOf));
        return { name: x.label, path: relpath(realpath(path), realpath(root)), for: fr.length ? fr : ["plugin"] };
      }) : [];
      // who else holds it, and how firmly. Hard: you can't change it (a vendor fixes it, or your organization's managed
      // policy holds it). Soft: built in, so you can switch it off or replace it but not rewrite it. A package is yours.
      const byOrg = control === "org" ? n : found.filter((x: any) => x.scope === "org").length;
      const soft = rtItems.length ? rtItems.length : supplied === "runtime" && control !== "vendor" && control !== "org" && control !== "you" ? n : 0;
      const held = [...(control === "vendor" ? [{ by: "vendor", n }] : []), ...(byOrg ? [{ by: "org", n: byOrg }] : []),
        ...(soft && control !== "vendor" ? [{ by: "vendor", n: soft, soft: true }] : [])];
      const { detect: _d, ...rest } = it;
      items.push({ ...rest, state, badge, instances: insts, count: n, by_layer: byLayer, profile: profItems, gap_xp: gapXp, ...(elsewhere.length ? { elsewhere } : {}), ...(held.length ? { held } : {}),
        ...(prof && prof.kind === "product" && ships[it.id] && !ships[it.id].ships ? { not_offered: true } : {}),
        runtime_items: rtItems, runtime_when: rtWhen, from_home: fromHome, supplied, control, found,
        holds: found.filter(x => x.hold === "holds").length, asks: found.filter(x => x.hold === "asks").length });
    }
    const equipped = items.filter(i => i.state === "yes").length;
    const W: Record<string, number> = { asks: 1, checks: 2, blocks: 3 };
    const ctrls = items.filter(i => i.kind === "control");
    const got = ctrls.reduce((a, i) => a + (W[i.strength] ?? 1) * (i.state === "yes" ? 1 : i.state === "partial" ? 0.5 : 0), 0);
    const cap = ctrls.reduce((a, i) => a + (W[i.strength] ?? 1), 0);
    const { items: _i, ...srest } = s;
    slots.push({ ...srest, items, equipped, total: items.length, depth: items.reduce((a, i) => a + i.count, 0),
      hardening: { score: cap ? round(got / cap, 2) : null, controls: ctrls.length, controls_on: ctrls.filter(i => i.state === "yes").length } });
  }

  const names: Record<string, string> = Object.fromEntries(spec.slots.flatMap((s: any) => s.items).map((it: any) => [it.id, it.name]));
  const statOf = (k: string) => { if (!(k in stats)) throw new Error(`KeyError: '${k}'`); return stats[k]; };
  const combos = spec.combos.map((c: any) => {
    const all: string[] = c.all || [], none: string[] = c.none || [];
    const missing = all.filter(i => states[i] !== "yes");
    const blockers = none.filter(i => states[i] === "yes");
    const statOk = Object.entries(c.stat || {}).every(([k, cond]: [string, any]) =>
      (cond.gt === undefined || cond.gt === null || statOf(k) > cond.gt) && (cond.lt === undefined || cond.lt === null || statOf(k) < cond.lt))
      && Object.entries(c.count || {}).every(([k, cond]: [string, any]) =>
      (cond.gt === undefined || cond.gt === null || (counts[k] ?? 0) > cond.gt) && (cond.lt === undefined || cond.lt === null || (counts[k] ?? 0) < cond.lt));
    const status = c.kind === "synergy" ? (!missing.length ? "active" : "locked") : (!missing.length && !blockers.length && statOk ? "active" : "dormant");
    return { ...c, effect: c.effect.split("{weight}").join(String(stats.weight)).split("{skills}").join(String(counts.skills ?? 0)), status,
      pieces: all.map(i => ({ id: i, name: names[i] ?? i, state: states[i] ?? "no" })),
      counter: none.map(i => ({ id: i, name: names[i] ?? i, state: states[i] ?? "no" })),
      missing: missing.map(i => names[i] ?? i) };
  });

  // Tiers climb in order: a tier counts only if every tier below it does
  const tiers: any[] = [];
  let reached = -1;
  (spec.tiers || []).forEach((tier: any, i: number) => {
    const met = tier.needs.filter((x: string) => states[x] === "yes");
    const ok = met.length === tier.needs.length && reached === i - 1;
    if (ok) reached = i;
    tiers.push({ ...tier, met: met.length, reached: ok, missing: tier.needs.filter((x: string) => states[x] !== "yes").map((x: string) => names[x] ?? x) });
  });

  const gs = progress.guards(spec, states);
  for (const s of slots) for (const i of s.items) {
    i.maturity = progress.maturity(i, i.state, i.holds, gs, states);
    if (prof && prof.kind === "example" && i.state === "yes" && (ships[i.id] || {}).ships === 3) i.maturity = 3;
    i.upgrade_xp = progress.upgradeXp(spec, i);
  }

  const itemsById: Record<string, any> = Object.fromEntries(spec.slots.flatMap((s: any) => s.items).map((it: any) => [it.id, it]));
  const W: Record<string, number> = { asks: 1, checks: 2, blocks: 3 };
  const trust = ((spec.trust || {}).categories || []).map((cat: any) => {
    const pieces: any[] = [];
    let got = 0, cap = 0;
    for (const pid of cat.evidence) {
      const it = itemsById[pid];
      if (!it) continue;
      const w = W[it.strength] ?? 1, s = states[pid] ?? "no";
      got += w * (s === "yes" ? 1 : s === "partial" ? 0.5 : 0);
      cap += w;
      pieces.push({ id: pid, name: it.name, state: s, strength: it.strength ?? null });
    }
    return { ...cat, evidence_score: cap ? round(100 * got / cap) : 0, pieces, missing: pieces.filter(x => x.state !== "yes").map(x => x.name) };
  });

  const enforced = nodes.some(n => n.type === "gate" && (n.imparts || {}).locus === "infrastructure" && truthy(n.guards_writes));
  let checkpoints: any[] = [];
  for (const n of nodes) for (const r of n.checkpoint_rules || [])
    checkpoints.push({ ...r, owner: n.id, owner_label: n.label ?? n.id, locus: enforced ? "infrastructure" : "model",
      flags: ([["reply-looks-required", r.phrase_mode === "example"], ["strictness-overclaimed", r.claims_strict && !enforced]] as [string, boolean][]).filter(([, on]) => on).map(([f]) => f) });
  checkpoints = sorted(checkpoints, c => [-c.flags.length, -c.confirmations, c.path, c.line]);

  const totals: Record<string, number> = Object.fromEntries(["yes", "partial", "no", "unchecked"].map(k => [k, Object.values(states).filter(v => v === k).length]));
  const nStates = Object.keys(states).length;
  return {
    cores: spec.cores, columns: spec.columns, stats,
    places: !prof ? places(root!, nodes, edges) : { list: [], trusted: {}, other: {} },
    slots, combos,
    profile: prof ? Object.fromEntries(["id", "name", "kind", "build", "checked_on", "version", "about"].filter(k => k in prof).map(k => [k, prof[k]])) : null,
    runtime, layer, base_profile: under ? under.id : null,
    totals: { ...totals, all: nStates },
    scores: Object.fromEntries(["capability", "control"].map(kind => [kind, {
      yes: Object.entries(states).filter(([i, s]) => kinds[i] === kind && s === "yes").length,
      partial: Object.entries(states).filter(([i, s]) => kinds[i] === kind && s === "partial").length,
      all: Object.keys(states).filter(i => kinds[i] === kind).length }])),
    rating: round(100 * (totals.yes + 0.5 * totals.partial) / Math.max(1, nStates)),
    tiers, tier: reached, checkpoints, guards: gs,
    progression: progress.progression(spec, slots, combos, tiers),
    customizations: !prof ? customizations(root!, runtime, nodes, bound, home.skills ?? [], slots, FREE_REIN()) : [],
    home, count_home: countHome,
    // the cross-file checks that fired, by kind (judge/lint.ts), for the board's list of checks
    lint: Object.fromEntries(sorted(unique(findings.map(f => f.class))).map(c => [c, findings.filter(f => f.class === c).length])),
    trust: { scale: (spec.trust || {}).scale || [], categories: trust,
      backed: trust.length ? round(trust.reduce((a: number, c: any) => a + c.evidence_score, 0) / trust.length) : 0 },
  };
}

export { iter };
