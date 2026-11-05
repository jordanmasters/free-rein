import { VERDICT } from "./oversight";
// Free rein: how much the agent does on its own, and whether the rules written in its instructions hold. From what
// the board already measures: the situations (each risky or everyday action, played through the permission rules and
// hooks) and the backing of each written rule (judge/backing.ts). Grouped by kind of action, so what the words say
// about an action sits beside what happens when the agent tries it.

export type RuleStatus = "enforced" | "asks-instead" | "only-asked" | "untested" | "not-action";
export type Match = "holds" | "only-asked" | "asks-instead" | "never-said" | "unguarded" | "runtime-only" | "none";
export interface Kind { id: string; name: string; high: boolean; actions: number; own: number; runtime: number; maybe: number; asks: number;
  refused: number; says: "never" | "ask first" | null; rules: number; match: Match; sits: string[] }
export interface FreeRein {
  mode: string; actions: number; own: number; runtime: number; maybe: number; asks: number; refused: number; pct: number;
  /** high-stakes actions it does on its own, with nothing to stop it */
  exposed: number;
  kinds: Kind[];
  /** the rules written in its instructions: how many something enforces, asks instead, or only asks */
  rules: { written: number; measured: number; enforced: number; asks_instead: number; only_asked: number; unmeasured: number; never_said: number;
    /** of the unmeasured: rules that name an action or a place Free Rein has no situation for yet; and rules that aren't about an action */
    untested: number; not_action: number };
  /** every written rule, with its status and, for a skill's or an agent's rule, what it applies within */
  all: { id: string; text: string; file: string; line: number; path: string | null; status: RuleStatus; within: string | null }[];
  /** the same counts in each mode Free Rein judges (Auto, Manual), so a mode picked as a what-if shows its own */
  by_mode?: Record<string, Pick<FreeRein, "mode" | "actions" | "own" | "runtime" | "maybe" | "asks" | "refused" | "pct" | "exposed" | "kinds">>;
  /** for a runtime read from its pieces, not rule by rule: the estimate is marked, and given for each kind of mode */
  estimated?: boolean; by_level?: Record<string, any>;
  /** the written rules nothing enforces, or that ask where they say never: each with where it is and what it's about */
  gaps: { id: string; text: string; file: string; line: number; path: string | null; backed: boolean | "partly"; sits: string[]; what: string }[];
}

const OWN = new Set(["ahead"]), RUNTIME = new Set(["classifier"]), MAYBE = new Set(["depends"]), ASKS = new Set(["asks"]), REFUSED = new Set(["held", "blocked"]);

/** Free rein for one harness, in the mode the board reads it in. */
export function freeRein(ov: any, mode: string, said: any | null): FreeRein | null {
  const d = ov && ov.by_mode && ov.by_mode[mode];
  if (!d) return null;
  const sits: any[] = d.situations || [];
  const count = (xs: any[], set: Set<string>) => xs.filter(s => set.has(s.outcome)).length;
  // what each written rule says about which situations, and whether it holds there (backing is measured in Auto)
  const sts: any[] = said ? said.statements.filter((s: any) => s.kind === "rule") : [];
  const bk: Record<string, any> = said ? said.backing || {} : {};
  const unsaid = new Set<string>((said ? said.unsaid || [] : []).map((u: any) => u.situation));
  const bySit: Record<string, { says: "never" | "ask first"; backed: any; rule: string }[]> = {};
  for (const st of sts) {
    const b = bk[st.id]; if (!b) continue;
    const says: "never" | "ask first" = (b.want || []).includes("asks") ? "ask first" : "never";
    for (const x of b.situations || []) (bySit[x.id] = bySit[x.id] || []).push({ says, backed: x.ok ? true : x.partly ? "partly" : false, rule: st.id });
  }
  const kinds: Kind[] = (d.stakes || []).map((k: any) => {
    const xs = sits.filter(s => s.stakes === k.id); if (!xs.length) return null;
    const words = xs.flatMap(s => bySit[s.id] || []);
    const says = words.some(w => w.says === "never") ? "never" : words.length ? "ask first" : null;
    const own = count(xs, OWN);
    // the worst of what it finds: a rule nothing enforces, then one that asks where it says never; with no words, a
    // high-stakes action nothing stops, then a guard no rule mentions, then one only the runtime's own check decides
    const match: Match = words.some(w => w.backed === false) ? "only-asked" : words.some(w => w.backed === "partly") ? "asks-instead"
      : words.length ? "holds" : k.high && own ? "unguarded" : xs.some(s => unsaid.has(s.id)) ? "never-said"
      : k.high && count(xs, RUNTIME) ? "runtime-only" : "none";
    return { id: k.id, name: k.name, high: !!k.high, actions: xs.length, own, runtime: count(xs, RUNTIME), maybe: count(xs, MAYBE), asks: count(xs, ASKS),
      refused: count(xs, REFUSED), says, rules: new Set(words.map(w => w.rule)).size, match, sits: xs.map(s => s.id) };
  }).filter(Boolean) as Kind[];
  const S = said ? said.summary : null;
  const gaps = sts.filter(st => bk[st.id] && (bk[st.id].backed === false || bk[st.id].backed === "partly")).map(st => ({
    id: st.id, text: st.text, file: st.source.file, line: st.source.line, path: st.path || null, backed: bk[st.id].backed,
    sits: (bk[st.id].situations || []).map((x: any) => x.id), what: ((bk[st.id].situations || [])[0] || {}).what || "" }));
  // every rule, with its status: measured ones by what backs them; the rest by whether they name an action or a place
  const within = (f: string) => { const s = /(?:^|\/)skills\/([^/]+)\/SKILL\.md$/.exec(f), a = /(?:^|\/)agents\/([^/]+)\.md$/.exec(f), c = /(?:^|\/)commands\/([^/]+)\.md$/.exec(f);
    return s ? `/${s[1]}` : c ? `/${c[1]}` : a ? `the ${a[1]} agent` : null; };
  const statusOf = (st: any): RuleStatus => { const b = bk[st.id]; const v = b ? b.backed : null;
    if (v === true) return "enforced"; if (v === "partly") return "asks-instead"; if (v === false) return "only-asked";
    return (st.about || []).some((x: any) => x.action || x.path || x.store || x.tool) ? "untested" : "not-action"; };
  const all = sts.map(st => ({ id: st.id, text: st.text, file: st.source.file, line: st.source.line, path: st.path || null, status: statusOf(st), within: within(st.source.file) }));
  const own = count(sits, OWN), runtime = count(sits, RUNTIME);
  return {
    mode, actions: sits.length, own, runtime, maybe: count(sits, MAYBE), asks: count(sits, ASKS), refused: count(sits, REFUSED),
    pct: sits.length ? Math.round(100 * (own + runtime) / sits.length) : 0,
    exposed: sits.filter(s => s.verdict === "exposed").length, kinds,
    rules: { written: S ? S.rules : 0, measured: S ? S.measured : 0, enforced: S ? S.backed : 0, asks_instead: S ? S.partly : 0, only_asked: S ? S.unbacked : 0,
      unmeasured: S ? S.rules - S.measured : 0, never_said: S ? S.unsaid : 0,
      untested: all.filter(r => r.status === "untested").length, not_action: all.filter(r => r.status === "not-action").length },
    gaps, all,
  };
}

// a runtime Free Rein doesn't play rule by rule (anything but Claude Code, for now) is estimated from its pieces; each
// kind of mode it offers then moves that estimate: what a hook or a sandbox refuses stays refused; read-only refuses
// the rest; asks-first asks; edits-on-its-own lets edits through and asks for the rest; a checker decides the
// high-stakes ones; runs-everything lets everything through
function relevel(s: any, level: string): string {
  if (s.outcome === "held" || s.outcome === "blocked") return s.outcome;
  const hi = s.stakes !== "everyday";
  switch (level) {
    case "read-only": return "held";
    case "asks": case "allowed-only": return "asks";
    case "edits": return s.tool === "Edit" ? "ahead" : "asks";
    case "checker": return hi ? (s.outcome === "asks" ? "asks" : "classifier") : "ahead";
    case "all": return "ahead";
    default: return s.outcome;
  }
}
/** The estimate in each kind of mode a runtime offers (its run modes' levels), for a runtime read from its pieces. */
export function freeReinLevels(ov: any, said: any | null, levels: string[]): Record<string, any> {
  const base = ov && ov.by_mode && ov.by_mode.auto; if (!base) return {};
  const out: Record<string, any> = {};
  for (const lv of [...new Set(levels.filter(l => l && l !== "follows"))]) {
    const sits = (base.situations || []).map((s: any) => { const o = relevel(s, lv), hi = s.stakes !== "everyday";
      return { ...s, outcome: o, verdict: (VERDICT[`${hi ? "high" : "everyday"}|${o}`] || [s.verdict])[0] }; });
    const x = freeRein({ by_mode: { [lv]: { stakes: base.stakes, situations: sits } } }, lv, said); if (!x) continue;
    out[lv] = { mode: lv, actions: x.actions, own: x.own, runtime: x.runtime, maybe: x.maybe, asks: x.asks, refused: x.refused, pct: x.pct, exposed: x.exposed, kinds: x.kinds,
      sits: sits.map((s: any) => ({ id: s.id, stakes: s.stakes, outcome: s.outcome, verdict: s.verdict })) };
  }
  return out;
}

/** Free rein in the mode the board reads, with the mode-dependent counts for every mode Free Rein judges. The written
 * rules don't change with the mode (their backing is measured in Auto), so they're given once. */
export function freeReinAll(ov: any, mode: string, said: any | null, levels: string[] = []): FreeRein | null {
  const f = freeRein(ov, mode, said); if (!f) return null;
  const by: NonNullable<FreeRein["by_mode"]> = {};
  for (const m of Object.keys((ov && ov.by_mode) || {})) {
    const x = freeRein(ov, m, said); if (!x) continue;
    by[m] = { mode: x.mode, actions: x.actions, own: x.own, runtime: x.runtime, maybe: x.maybe, asks: x.asks, refused: x.refused, pct: x.pct, exposed: x.exposed, kinds: x.kinds };
  }
  // estimated from the pieces (no rules read): an estimate per kind of mode the runtime offers
  const estimated = !((ov && ov.modes) || []).length;
  return { ...f, by_mode: by, ...(estimated && levels.length ? { estimated: true, by_level: freeReinLevels(ov, said, levels) } : estimated ? { estimated: true } : {}) };
}
