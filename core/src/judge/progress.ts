// What the board shows beyond equipped or not: where each piece is, how far it has matured, which
// pieces guard which, and the level, XP and rank they add up to. First written in Python (retired 2026-10-11).
import { readText, join, dirname, basename, isdir, isfile, exists, realpath, relpath, listdir, sorted, splitWs, expanduser, get, iter, or, isDict } from "../py";
import { levelStart } from "../report/score";

/** The home folder, read when used (Python reads it once at import; tests that move HOME set it before) */
import { home as HOME } from "../read/home";
const MANAGED = ["/Library/Application Support/ClaudeCode", "/etc/claude-code"];
const W: Record<string, number> = { asks: 1, checks: 2, blocks: 3 };

function repoOf(path: string): string | null {
  let d = isdir(path) ? path : dirname(path);
  while (d && d !== dirname(d)) {
    if (exists(join(d, ".git"))) return d;
    d = dirname(d);
  }
  return null;
}

/** files a package being tried put into a copy of the harness: path -> package */
export const TAGS = new Map<string, string>();
/** skills that check the harness itself */
export const CHECKERS = new Set(["address-findings"]);
/** files a package's installer put into this folder: rel path -> {pkg, changed} */
export const INSTALLED = new Map<string, { pkg: string; changed: boolean }>();

/** [scope, package] for one file: who it applies to, and who supplied it. */
export function where(path: string | null | undefined, root: string, freeReinDir: string): [string | null, string | null] {
  if (!path) return [null, null];
  const real = realpath(path), rroot = realpath(root), home = HOME();
  const inside = real === rroot || path === root || real.startsWith(rroot + "/") || path.startsWith(root + "/");   // the folder itself counts as inside
  let scope: string;
  if (MANAGED.some(m => path.startsWith(m))) scope = "org";
  else if (["CLAUDE.local.md", "settings.local.json"].includes(basename(path))) scope = "local";
  else if (inside) scope = "project";
  else if (path.startsWith(home)) scope = "user";
  else scope = "project";
  let pkg: string | null = null;
  for (const [k, v] of TAGS)
    if (path === k || real === k || path.startsWith(k + "/") || real.startsWith(k + "/")) return [scope, v];
  if (INSTALLED.size && real.startsWith(rroot + "/")) {
    const hit = INSTALLED.get(relpath(real, rroot));
    if (hit) return [scope, hit.pkg];
  }
  if (!inside) {
    if (real.includes("/.claude/plugins/")) {
      const seg = real.split("/.claude/plugins/")[1].split("/");
      pkg = seg[0] === "marketplaces" && seg.length > 3 ? seg[3] : seg[0] === "cache" && seg.length > 2 ? seg[2] : seg[0];
    } else if (real.startsWith(realpath(freeReinDir) + "/") || real.startsWith(realpath(join(HOME(), ".claude", "free-rein")) + "/")) pkg = "Free Rein";   // Free Rein's own repo, or the copy install.sh links
    else {
      const repo = repoOf(real);
      if (repo && realpath(repo) !== rroot) pkg = basename(repo);
    }
  }
  return [scope, pkg];
}

/** Each node behind a piece, with the file and lines to open and how it holds. */
export function instances(hits: any[], root: string | null, freeReinDir: string): any[] {
  return hits.map(n => {
    const prov = n.provenance || {};
    const path = prov.path ?? null;
    const [scope, pkg] = where(path, root as string, freeReinDir);
    const locus = (n.imparts || {}).locus;
    const rel = path && root ? relpath(realpath(path), realpath(root)) : null;
    return {
      changed: !!(pkg && rel && (INSTALLED.get(rel) || ({} as any)).changed),
      label: n.label ?? n.id, node: n.id, path, lines: prov.lines ?? null, scope, pkg,
      hold: locus === "infrastructure" ? "holds" : locus === "model" ? "asks" : null,
      contexts: n.contexts && n.contexts.length ? n.contexts : ["base"],
    };
  });
}

/** What loads in every session from your home folder that the extractor doesn't read: user skills and prompt hooks.
 *  skillDirs: the home skill folders the runtime loads, relative to home. */
export function homeExtras(freeReinDir: string, { skillDirs = [".claude/skills"], promptHooks = true } = {}): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  const add = (k: string, v: any) => (out[k] ??= []).push(v);
  const seen = new Set<string>();
  for (const dir of skillDirs) {
    const sk = join(HOME(), ...dir.split("/"));
    for (const name of isdir(sk) ? sorted(listdir(sk)) : []) {
      const p = join(sk, name);
      if (!isfile(join(p, "SKILL.md")) || seen.has(name) || seen.has(realpath(p))) continue;
      seen.add(name).add(realpath(p));
      const [, pkg] = where(p, "/nonexistent", freeReinDir);
      add("skills", { label: name, path: join(p, "SKILL.md"), lines: null, scope: "user", pkg, hold: null, contexts: ["base"] });
      if (CHECKERS.has(name)) add("harness-checker", { label: name, path: join(p, "SKILL.md"), lines: null, scope: "user", pkg, hold: null, contexts: ["base"] });
    }
  }
  if (!promptHooks) return out;
  let st: any;
  try {
    const t = readText(join(HOME(), ".claude", "settings.json"), "replace");
    if (t.includes("�")) throw new Error("UnicodeDecodeError");
    st = JSON.parse(t);
  } catch { st = {}; }
  for (const e of iter(get(or(get(st, "hooks"), {}), "UserPromptSubmit", []))) {
    for (const x of iter(get(e, "hooks", []))) {
      const cmd = splitWs(or(get(x, "command"), ""));
      const exe = cmd.length ? expanduser(cmd[0]) : "";
      const [, pkg] = where(exe, "/nonexistent", freeReinDir);
      add("live-injection", { label: basename(exe) || "hook", path: exe || null, lines: null, scope: "user", pkg, hold: null, contexts: ["base"] });
    }
  }
  return out;
}

/** 0 for a capability; 1 asks, 2 checks, 3 blocks for a control. */
export const firmness = (item: any) => item.kind !== "control" ? 0 : W[item.strength] ?? 1;

/** In a two-piece synergy, the weaker piece is guarded by the firmer one. */
export function guards(spec: any, states: Record<string, string>): any[] {
  const items: Record<string, any> = Object.fromEntries(spec.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i]));
  const out: any[] = [];
  for (const c of spec.combos || []) {
    const ids: string[] = c.all || [];
    if (c.kind !== "synergy" || ids.length !== 2 || ids[0] === ids[1]) continue;
    const [lo, hi] = sorted(ids, x => firmness(items[x] || {}));
    if (firmness(items[hi] || {}) > firmness(items[lo] || {}) && firmness(items[hi] || {}) >= 1)
      out.push({ guarded: lo, by: hi, combo: c.id, active: states[lo] === "yes" && states[hi] === "yes" });
  }
  return out;
}

export { xpRound } from "../report/score";

/** 0 empty, 1 started, 2 equipped, 3 hardened. */
export function maturity(item: any, state: string, holds: number, gs: any[], states: Record<string, string>): number {
  if (state === "no" || state === "unchecked") return 0;
  if (state === "partial") return 1;
  if (item.kind === "control" && (item.strength === "blocks" || holds > 0)) return 3;
  if (gs.some(g => g.guarded === item.id && states[g.by] === "yes")) return 3;
  return 2;
}

export function levelOfSpec(spec: any, xp: number): [number, number, number | null] {
  const p = spec.progression;
  const k = p.level_curve, top = p.max_level ?? 50;
  const at = (n: number) => levelStart(n, k);
  let level = Math.min(top, Math.trunc((xp / k) ** 0.5));
  while (level < top && at(level + 1) <= xp) level++;
  while (level && at(level) > xp) level--;
  return [level, at(level), level < top ? at(level + 1) : null];
}

/** XP from every piece's maturity, achievements and cleared weak spots; level; rank and what the next needs. */
export function progression(spec: any, slots: any[], combos: any[], tiers: any[]): any {
  const p = spec.progression;
  if (!p || !Object.keys(p).length) return null;
  const px: number[] = p.piece_xp;
  let xp = slots.flatMap(s => s.items).reduce((a, i) => a + px[i.maturity] + (i.gap_xp ?? 0), 0);
  const earned = combos.filter(c => c.kind === "synergy" && c.status === "active");
  const cleared = combos.filter(c => c.kind === "curse" && c.status === "dormant" && c.none && c.none.length && (c.counter || []).some((x: any) => x.state === "yes"));
  xp += p.achievement_xp * earned.length + p.cleared_xp * cleared.length;
  const [level, start, nxtAt] = levelOfSpec(spec, xp);
  const openSpots = combos.filter(c => c.kind === "curse" && c.status === "active").map(c => c.id);
  const reached = tiers.filter(t => t.reached);
  const nxt = tiers.find(t => !t.reached) ?? null;
  const rank = reached.length ? reached[reached.length - 1] : null;
  const yes = new Set(slots.flatMap(s => s.items).filter((i: any) => i.state === "yes").map((i: any) => i.id));
  return {
    xp, level, level_start: start, next_level_at: nxtAt,
    rank: rank ? { id: rank.id, name: get(rank, "rank", rank.name), tier: rank.name, icon: get(rank, "rank_icon") } : null,
    next_rank: nxt ? { id: nxt.id, name: get(nxt, "rank", nxt.name), tier: nxt.name, icon: get(nxt, "rank_icon"),
      needs: nxt.needs.filter((x: string) => !yes.has(x)), weak_spots: openSpots } : null,
    earned: earned.map(c => c.id), cleared: cleared.map(c => c.id),
  };
}

/** XP for taking this piece one step further. */
export function upgradeXp(spec: any, item: any): number {
  const p = spec.progression;
  if (!p || !Object.keys(p).length || item.maturity >= 3) return 0;
  const px: number[] = p.piece_xp;
  const nxt = item.maturity < 2 ? 2 : 3;
  return px[nxt] - px[item.maturity];
}

export { isDict };
