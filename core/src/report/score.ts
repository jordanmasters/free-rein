// The reference scorer: Free Rein's published rules (pieces.json progression) applied to
// a harness document (free-rein.harness/1), so any viewer gets the numbers Free Rein's own
// board shows. First written in Python (retired 2026-10-11).
//
// - A piece with tiers that's in the harness earns tier_xp in all, split evenly
//   across its tiers (by tiers reached).
// - Any other piece earns piece_xp for its level (cumulative: started, equipped,
//   hardened), plus up to gap_xp more for a collection: a share for each complete
//   item, up to gap_items of them (so adding an item never lowers XP).
// - Each achievement earned adds achievement_xp; each weak spot cleared, cleared_xp.
// - Each situation the harness covers adds situation_xp (high stakes count more).
// - Level n starts at level_curve * n^2 XP, rounded up, to max_level.
//
// No imports: this file is also built into the board (vscode/media/board.js, as FreeReinCore)
// and the extension (media/core.js), so the board never keeps its own copy of the rules.

export const HIGH = new Set(["undo", "outward", "knowledge", "safeguards", "secrets", "accounts"]);

/** Halves round up (42.5 is 43), as on the board. */
export const xpRound = (x: number) => Math.floor(x + 0.5);

/** Where level n starts: level_curve * n^2 XP, rounded up. */
export const levelStart = (n: number, curve: number) => Math.ceil(curve * n * n);

/** [level, where it starts, where the next starts (null at the top)] for an XP total. */
export function levelOf(xp: number, curve: number, top: number): [number, number, number | null] {
  const at = (n: number) => levelStart(n, curve);
  let level = Math.min(top, Math.trunc((xp / curve) ** 0.5));
  while (level < top && at(level + 1) <= xp) level++;
  while (level && at(level) > xp) level--;
  return [level, at(level), level < top ? at(level + 1) : null];
}

export interface Score {
  xp: number; level: number; level_start: number; next_level_at: number | null;
  parts: { pieces: number; combos: number; situations: number };
}

/** The numbers for a harness document. rules: the model (spec.load()), or its progression alone. */
export function score(doc: any, rules: Record<string, any>): Score {
  const p = rules.progression ?? rules;
  const px: number[] = p.piece_xp, tx: number = p.tier_xp ?? 85, gx: number = p.gap_xp ?? 0, gn: number = p.gap_items ?? 5;
  let pieces = 0;
  for (const pc of doc.pieces) {
    const tier = pc.tier;
    if (tier && tier.of && (pc.state === "yes" || pc.state === "partial")) {
      pieces += xpRound(tx * tier.reached / tier.of);
    } else {
      pieces += px[pc.maturity];
      const ic = pc.items_complete;
      if (ic && ic.of) pieces += xpRound(gx * Math.min(ic.ok, gn) / gn);
    }
  }
  let combos = 0;
  for (const c of doc.combos) {
    if (c.kind === "synergy" && c.status === "active") combos += p.achievement_xp;
    if (c.kind === "curse" && c.status === "cleared") combos += p.cleared_xp;
  }
  const sx = p.situation_xp || {};
  let sits = 0;
  for (const s of doc.situations) if (s.accounted) sits += sx[HIGH.has(s.stakes) ? "high" : "everyday"] ?? 0;
  const xp = pieces + combos + sits;
  const [level, start, nxt] = levelOf(xp, p.level_curve, p.max_level ?? 50);
  return { xp, level, level_start: start, next_level_at: nxt, parts: { pieces, combos, situations: sits } };
}
