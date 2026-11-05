// Moves: everything worth doing next, in one list. Each problem the board finds, wherever it's found (a risky situation
// nothing stops, rules your files say that nothing enforces, a loop that stops on the agent's word, a step that writes
// with no gate, a piece the harness would gain most from), becomes one move: what to do, why in a line, what it earns,
// how much work it is, and the fix Free Rein can draft. Moves that fix the same thing are merged.
type Place = { path: string; line: number | null };
export type Effort = "quick" | "medium" | "larger";
export type Source = "situations" | "rules" | "loops" | "flows" | "pieces";
export interface Move {
  id: string; title: string; why: string; view: "has" | "checks" | "flows"; sources: Source[];
  xp: number | null; effort: Effort; protects: number; place: Place | null;
  fix: { piece: string | null; rules: { rule: string; how: string; sit: string }[]; draft: boolean };
}

const VERB: Record<string, string> = {
  "completion-check": "Add a done check", "spend-limits": "Cap long runs", evals: "Add evals", feedback: "Turn what's measured into work",
  "independent-checker": "Add a model judge", "hard-gate": "Block what must never happen", "human-gate": "Ask before it writes",
  sandbox: "Run it in a sandbox", permissions: "Write permission rules",
};
const RANK: Record<Source, number> = { situations: 4, rules: 3, flows: 2, loops: 2, pieces: 1 };

/** The moves, best first: what they protect, then the least work, then XP. `types` are the board's pieces by id,
 *  `drafted` the pieces Free Rein can write itself. */
export function moves(b: { oversight: any; said: any; loops: any; flows: any; next: Record<string, string[]> }, types: Record<string, any>, drafted: Set<string>): Move[] {
  const out = new Map<string, Move>();
  const xpOf = (piece: string | null) => { const t = piece && types[piece]; return t ? (t.gap_xp || t.upgrade_xp || null) : null; };
  const effortOf = (piece: string | null, rules: number): Effort => rules && !piece ? "quick"
    : piece && drafted.has(piece) ? ((((types[piece] || {}).change || {}).files || []).length > 2 ? "medium" : "quick") : "larger";
  const add = (key: string, m: Omit<Move, "id" | "xp" | "effort"> & { xp?: number | null }) => {
    const had = out.get(key);
    if (had) { for (const s of m.sources) if (!had.sources.includes(s)) had.sources.push(s); had.protects += m.protects;
      had.fix.rules.push(...m.fix.rules.filter(r => !had.fix.rules.some(x => x.rule === r.rule))); return had; }
    const mv: Move = { id: key, ...m, xp: m.xp ?? xpOf(m.fix.piece), effort: effortOf(m.fix.piece, m.fix.rules.length) };
    out.set(key, mv); return mv;
  };

  // risky situations: high stakes, and nothing of yours stops them (or only the runtime's own check does)
  const ov = b.oversight || {}, mode = (ov.by_mode || {})[(ov.set_mode || {}).mode || "auto"] || (ov.by_mode || {}).auto;
  const stakes = Object.fromEntries(((mode && mode.stakes) || []).map((k: any) => [k.id, k]));
  const sits = ((mode && mode.situations) || []) as any[], byId = Object.fromEntries(sits.map(s => [s.id, s]));
  const risky = sits.filter(s => (stakes[s.stakes] || {}).high && (s.outcome === "ahead" || s.outcome === "classifier") && s.fix && s.fix.rule);
  const sitKey = (s: any) => `sit:${s.stakes}:${s.fix.how}`;
  for (const s of risky) {
    const k = stakes[s.stakes] || { name: s.stakes }, never = s.fix.how === "deny" || s.fix.how === "never";
    add(sitKey(s), { title: `${never ? "Never" : "Ask first"}: ${String(k.name).toLowerCase()}`, view: "has", sources: ["situations"], protects: 1, place: null,
      why: s.outcome === "classifier" ? "Risky actions go ahead with only the runtime's own check deciding" : "Risky actions go ahead with nothing stopping them",
      fix: { piece: null, rules: [{ rule: s.fix.rule, how: s.fix.how, sit: s.id }], draft: true } });
  }
  // rules your files say that nothing enforces, grouped with the situation they're about
  const backing = ((b.said || {}).backing || {}) as Record<string, any>, unbacked: Record<string, number> = {};
  for (const v of Object.values(backing)) if (v && v.backed === false) for (const x of (v.situations || []).slice(0, 1)) unbacked[x.id] = (unbacked[x.id] || 0) + 1;
  for (const [sid, n] of Object.entries(unbacked)) {
    const s = byId[sid]; if (!s) continue;
    const key = s.fix && s.fix.rule && risky.includes(s) ? sitKey(s) : `said:${s.key || sid}`;
    // with no rule to write for it, a hook that refuses it is the fix (one Free Rein can draft)
    const rule = s.fix && s.fix.rule ? [{ rule: s.fix.rule, how: s.fix.how, sit: s.id }] : [];
    const mv = add(key, { title: `Guard: ${String(s.what).replace(/^./, c => c.toLowerCase())}`, view: "has", sources: ["rules"], protects: 1, place: null,
      why: `${n} of your rules say so; nothing makes it happen`, fix: { piece: rule.length ? null : (s.fix && s.fix.piece) || "hard-gate", rules: rule, draft: true } });
    if (mv.sources.includes("situations") && !/rules say/.test(mv.why)) mv.why += ` · ${n} of your rules say so too`;
  }
  // loops that stop on the agent's word, check without sending back, or never end
  const VIEWS = { checks: "checks", flows: "flows" } as const;
  for (const f of ((b.loops || {}).findings || []) as any[]) {
    const steps = /^(.+?) writes? on/.exec(f.title), key = steps ? `steps:${steps[1]}` : `loop:${f.upgrade || f.title}`;
    add(key, { title: steps ? `Make ${steps[1]} wait for you` : VERB[f.upgrade] || f.fix, why: f.title, view: VIEWS.checks, sources: ["loops"], protects: 0,
      place: f.place || null, fix: { piece: f.upgrade || null, rules: [], draft: !!f.draft } });
  }
  // steps that write with no gate
  for (const f of ((b.flows || {}).findings || []) as any[]) {
    const name = String(f.step || "").replace(/^unit:|^executor:agent:/, "");
    add(`steps:${name}`, { title: `Make ${name} wait for you`, why: f.title, view: VIEWS.flows, sources: ["flows"], protects: 0, place: f.place || null,
      fix: { piece: "human-gate", rules: [], draft: false } });
  }
  // the pieces the harness would gain most from, unless a move above already adds them
  for (const [piece, why] of Object.entries(b.next || {})) {
    const had = [...out.values()].find(m => m.fix.piece === piece);
    if (had) { if (!had.sources.includes("pieces")) had.sources.push("pieces"); continue; }
    const t = types[piece]; if (!t) continue;
    add(`piece:${piece}`, { title: VERB[piece] || `Add ${t.name}`, why: String(why[0] || t.what).replace(/^./, c => c.toUpperCase()), view: "has", sources: ["pieces"], protects: 0,
      place: null, fix: { piece, rules: [], draft: drafted.has(piece) } });
  }
  const score = (m: Move) => Math.max(...m.sources.map(s => RANK[s])) * 10 + Math.min(m.protects, 9);
  const eff = { quick: 0, medium: 1, larger: 2 };
  return [...out.values()].sort((a, b) => score(b) - score(a) || eff[a.effort] - eff[b.effort] || (b.xp || 0) - (a.xp || 0) || a.id.localeCompare(b.id));
}
