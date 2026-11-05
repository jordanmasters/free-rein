// Find harnesses: folders under a directory that an agent would load (CLAUDE.md, CLAUDE.local.md,
// AGENTS.md or a .claude/ folder). First written in Python (retired 2026-10-11).
import { join, listdir, isdir, exists, sorted } from "../py";
import { used } from "./plugins";

const MARKERS = ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", ".claude"];

export const markers = (path: string) => MARKERS.filter(m => exists(join(path, m)));

/** uses: the frameworks (with a Free Rein plugin) each one runs */
export function discover(base: string): { name: string; path: string; markers: string[]; uses: string[] }[] {
  const found = [];
  let names: string[];
  try { names = sorted(listdir(base), n => n.toLowerCase()); } catch { return []; }
  for (const name of names) {
    const path = join(base, name);
    if (name.startsWith(".") || !isdir(path)) continue;
    const m = markers(path);
    if (m.length) found.push({ name, path, markers: m, uses: used(path).map(p => p.name) });
  }
  return found;
}
