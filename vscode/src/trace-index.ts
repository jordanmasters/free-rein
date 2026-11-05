// Which pieces each file holds, and where: the index behind the markers,
// hovers and the Combos view. No VS Code here, so it tests on its own.

export interface Entry {
  piece: string; name: string; what: string;
  section: string; sectionName: string;
  maturity: number; kind: string; firm: string; hold: string | null;
  label: string; path: string;
  // 1-based, inclusive; whole: the piece is the whole file
  lines: [number, number] | null; whole: boolean;
  combos: { name: string; kind: string; status: string; role: "part" | "cause" | "fix" }[];
  upgradeXp: number;
}

export const LEVELS = ["Empty", "Started", "Equipped", "Hardened"];

export function kindWord(e: Pick<Entry, "kind" | "firm">) {
  return e.kind !== "control" ? "an ability"
    : e.firm === "blocks" ? "a safeguard that stops it" : e.firm === "checks" ? "a safeguard that checks" : "a safeguard that asks you";
}

// every instance with a file, grouped by file; a file's line count says whether a range is the whole file
export function buildIndex(h: any, lineCount: (path: string) => number | null): Map<string, Entry[]> {
  const out = new Map<string, Entry[]>();
  const sets: any[] = h.sets ?? [];
  for (const s of h.slots ?? []) {
    for (const t of s.types ?? []) {
      const combos = sets.flatMap(c => {
        const role: Entry["combos"][number]["role"] | null = (c.ids ?? []).includes(t.id) ? (c.kind === "curse" ? "cause" : "part") : (c.lifts ?? []).includes(t.id) ? "fix" : null;
        return role ? [{ name: String(c.name), kind: String(c.kind), status: String(c.status), role }] : [];
      });
      for (const i of [...(t.inst ?? []), ...(t.extra ?? [])]) {
        if (!i.path) continue;
        const n = lineCount(i.path);
        const lines: [number, number] | null = i.lines ?? null;
        const e: Entry = {
          piece: t.id, name: t.name, what: t.what, section: s.id, sectionName: s.name,
          maturity: t.maturity ?? 0, kind: t.kind, firm: t.firm, hold: i.hold ?? null,
          label: i.label, path: i.path, lines, whole: !lines || (lines[0] <= 1 && n !== null && lines[1] >= n),
          combos, upgradeXp: t.upgrade_xp ?? 0,
        };
        const list = out.get(i.path) ?? [];
        // one entry per piece and range in a file
        if (!list.some(x => x.piece === e.piece && JSON.stringify(x.lines) === JSON.stringify(e.lines))) list.push(e);
        out.set(i.path, list);
      }
    }
  }
  for (const list of out.values()) list.sort((a, b) => (a.lines?.[0] ?? 1) - (b.lines?.[0] ?? 1) || a.name.localeCompare(b.name));
  return out;
}

// the entries a hover at this line (1-based) should explain: blocks the line is in,
// and whole-file pieces only on the first line, so they don't follow you through the file
export function at(list: Entry[] | undefined, line: number): Entry[] {
  return (list ?? []).filter(e => e.whole ? line === 1 : e.lines ? line >= e.lines[0] && line <= e.lines[1] : false);
}

export function hoverMarkdown(es: Entry[]): string {
  return es.map(e => {
    const parts = e.combos.filter(c => c.role === "part"), causes = e.combos.filter(c => c.role === "cause"), fixes = e.combos.filter(c => c.role === "fix");
    const lines = [
      `**${e.name}** · ${e.sectionName} · level ${e.maturity} of 3, ${LEVELS[e.maturity].toLowerCase()}`,
      `${e.what}`,
      `It's ${kindWord(e)}${e.hold === "holds" ? ", and this one holds on its own" : e.hold === "asks" ? ", and this one relies on the model asking" : ""}.`,
    ];
    if (parts.length) lines.push(`Part of ${parts.map(c => `${c.status === "active" ? "✓ " : ""}*${c.name}*`).join(", ")}.`);
    if (causes.some(c => c.status === "active")) lines.push(`⚠ Causes the weak spot ${causes.filter(c => c.status === "active").map(c => `*${c.name}*`).join(", ")}.`);
    if (fixes.length) lines.push(`Fixes ${fixes.map(c => `*${c.name}*`).join(", ")}.`);
    if (e.upgradeXp) lines.push(`Next step: +${e.upgradeXp} XP.`);
    return lines.join("\n\n");
  }).join("\n\n---\n\n");
}

// achievements and weak spots, each with the pieces behind it and where they are
export interface ComboRow {
  name: string; kind: string; status: string; effect: string;
  pieces: { id: string; name: string; role: "part" | "cause" | "fix"; have: boolean; started: boolean; found: { label: string; path?: string; lines?: [number, number] | null }[];
            change?: { files: string[]; does: string } | null }[];
}

export function combos(h: any): ComboRow[] {
  const types = new Map<string, any>((h.slots ?? []).flatMap((s: any) => s.types).map((t: any) => [t.id, t]));
  const piece = (id: string, role: "part" | "cause" | "fix") => {
    const t = types.get(id);
    return { id, name: t?.name ?? id, role, have: t?.stage === 2, started: t?.stage === 1, change: t?.change ?? null,
             found: [...(t?.inst ?? []), ...(t?.extra ?? [])].map((i: any) => ({ label: i.label, path: i.path, lines: i.lines })) };
  };
  const order = (c: any) => c.kind === "synergy" ? ({ active: 0, locked: 2 } as any)[c.status] ?? 1 : ({ active: 0, cleared: 1 } as any)[c.status] ?? 2;
  return (h.sets ?? []).filter((c: any) => c.kind === "synergy" || c.status !== "dormant")
    .sort((a: any, b: any) => order(a) - order(b))
    .map((c: any) => ({
      name: c.name, kind: c.kind, status: c.status, effect: c.effect,
      pieces: c.kind === "synergy" ? (c.ids ?? []).map((id: string) => piece(id, "part"))
        : [...(c.ids ?? []).map((id: string) => piece(id, "cause")), ...(c.lifts ?? []).map((id: string) => piece(id, "fix"))],
    }));
}
