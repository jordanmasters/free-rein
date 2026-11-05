// An upgrade's plan from Free Rein's core (core/src/write/changes.ts), and how to say what it does. No VS Code here.
import { callCore } from "./read";

export interface Edit { path: string; rel: string; before: string | null; after: string; kind: "create" | "replace"; note: string; mode: number | null }
export interface Effect {
  piece: { from: number; to: number }; xp: number;
  level: { from: number; to: number }; rank: { from: string | null; to: string | null };
  earned: string[]; lost: string[]; cleared: string[]; opened: string[];
  trust: Record<string, { from: number; to: number }>; backed: { from: number; to: number };
  others: Record<string, { from: number; to: number }>;
}
export interface Plan { piece: string; name: string; maturity: number; template: boolean; edits: Edit[]; request: string; effect: Effect | null; verified: boolean }
export interface Upgrade { piece: string; name: string; maturity: number; upgrade_xp: number; template: boolean }

const LEVELS = ["Empty", "Started", "Equipped", "Hardened"];

export const getPlan = (freeReinDir: string | null, root: string, piece: string) => callCore<Plan>(freeReinDir, "plan", [root, piece]);
export const listUpgrades = (freeReinDir: string | null, root: string) => callCore<Upgrade[]>(freeReinDir, "upgrades", [root]);

// one line per thing that changes, most rewarding first; side effects said plainly
export function effectLines(p: Plan, names: Record<string, string> = {}): string[] {
  const e = p.effect;
  if (!e) return [];
  const out = [`${p.name}: level ${e.piece.from} → ${e.piece.to} (${LEVELS[e.piece.from]} → ${LEVELS[e.piece.to]})`];
  out.push(`${e.xp >= 0 ? "+" : ""}${e.xp} XP${e.level.to !== e.level.from ? `, level ${e.level.from} → ${e.level.to}` : ""}`);
  if (e.rank.to !== e.rank.from) out.push(`Rank ${e.rank.from ?? "unranked"} → ${e.rank.to ?? "unranked"}`);
  for (const x of e.earned) out.push(`Earns ${x}`);
  for (const x of e.cleared) out.push(`Clears the weak spot ${x}`);
  for (const [k, v] of Object.entries(e.trust)) out.push(`${k}: trust backed ${v.from}% → ${v.to}%`);
  for (const [k, v] of Object.entries(e.others)) out.push(`Also: ${names[k] ?? k} level ${v.from} → ${v.to}`);
  for (const x of e.opened) out.push(`⚠ Opens the weak spot ${x}`);
  for (const x of e.lost) out.push(`⚠ Loses ${x}`);
  return out;
}

export function editLines(p: Plan): string[] {
  return p.edits.map(e => `${e.kind === "create" ? "New" : "Changes"} ${e.rel}: ${e.note}`);
}
