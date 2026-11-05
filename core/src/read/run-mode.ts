// Which mode a harness starts in, for any runtime: the places its runtime record lists (run_modes.set_by), most
// specific first; the first that's set wins, per control (a runtime can have two: Cursor's chat mode and run mode).
// Only reads files.
import { readText, join, expanduser, isfile, relpath } from "../py";

const LEVELS = ["read-only", "allowed-only", "asks", "edits", "checker", "all"];

function text(p: string): string { try { return isfile(p) ? readText(p, "ignore", 2_000_000) : ""; } catch { return ""; } }

// JSON as settings files write it: comments and trailing commas allowed
function looseJson(t: string): any {
  try { return JSON.parse(t.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, s) => s ?? "").replace(/,(\s*[}\]])/g, "$1")); } catch { return null; }
}
const unquote = (v: string) => v.replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");

function tomlValue(t: string, key: string): string | null {
  const i = key.lastIndexOf("."), table = i < 0 ? "" : key.slice(0, i), k = i < 0 ? key : key.slice(i + 1);
  let cur = "";
  for (const line of t.split(/\r?\n/)) {
    const h = /^\s*\[([^\]]+)\]/.exec(line);
    if (h) { cur = h[1].trim(); continue; }
    const m = new RegExp(`^\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(.+)$`).exec(line);
    if (m && cur === table) return unquote(m[1]);
  }
  return null;
}

function yamlValue(t: string, key: string): string | null {
  const want = key.split("."), stack: [number, string][] = [];
  for (const line of t.split(/\r?\n/)) {
    const m = /^(\s*)([\w.-]+):\s*(.*)$/.exec(line);
    if (!m || /^\s*#/.test(line)) continue;
    const ind = m[1].length;
    while (stack.length && stack[stack.length - 1][0] >= ind) stack.pop();
    stack.push([ind, m[2]]);
    if (stack.length === want.length && stack.every(([, k], j) => k === want[j]) && m[3].trim()) return unquote(m[3]);
  }
  return null;
}

/** The value a settings file gives one key, as text, or null. */
export function settingIn(path: string, format: string | undefined, key: string): string | null {
  const t = text(path); if (!t) return null;
  if (format === "toml") return tomlValue(t, key);
  if (format === "yaml") return yamlValue(t, key);
  const j = looseJson(t); if (!j || typeof j !== "object") return null;
  const v = format === "json-flat" ? j[key] : key.split(".").reduce((o: any, k) => (o && typeof o === "object" ? o[k] : undefined), j);
  return v === undefined || v === null || typeof v === "object" ? null : String(v);
}

/** The mode a harness starts in: one pick per control, each from the first place that sets it or the runtime's default,
 *  and the level they come to (read-only wins; a mode that follows takes the other control's level). */
export function startMode(root: string | null, rm: any): any {
  if (!rm || !(rm.modes || []).length) return null;
  const byId = new Map<string, any>(rm.modes.map((m: any) => [m.id, m]));
  const picks = new Map<string, any>();
  for (const s of root ? rm.set_by || [] : []) {
    const path = s.file.startsWith("~/") ? expanduser(s.file) : join(root!, s.file);
    const v = settingIn(path, s.format, s.key);
    if (v === null || (s.ignore || []).includes(v)) continue;
    const m = byId.get((s.values || {})[v] ?? v);
    if (!m || picks.has(m.picker ?? "")) continue;
    picks.set(m.picker ?? "", { ...m, set: true, from: s.file.startsWith("~/") ? s.file : relpath(path, root!), key: s.key, value: v });
  }
  for (const id of [].concat(rm.default)) {
    const m = byId.get(id);
    if (m && !picks.has(m.picker ?? "")) picks.set(m.picker ?? "", { ...m, set: false });
  }
  const list = [...picks.values()];
  return { modes: rm.modes, picks: list, level: levelOf(list), default_note: rm.default_note ?? null, status: rm.status, source: rm.source ?? null };
}

// read-only wins; a mode that follows takes the other control's level
function levelOf(picks: any[]): string | null {
  const fixed = picks.filter(p => p.level !== "follows");
  return fixed.some(p => p.level === "read-only") ? "read-only" : (fixed.sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level))[0] || {}).level ?? null;
}

/** The start mode with the choices you've told Free Rein ({control: mode id}): for a setting the runtime keeps where no
 *  file shows it, such as Cursor's run mode in the editor. Your choice wins over the files. */
export function withChoice(R: any, choice: Record<string, string> | undefined): any {
  if (!R || !choice) return R;
  const picks = R.picks.map((p: any) => {
    const id = choice[p.picker ?? ""], m = id && R.modes.find((x: any) => x.id === id && (x.picker ?? "") === (p.picker ?? ""));
    return m ? { ...m, set: true, from: "your Free Rein setting" } : p;
  });
  return { ...R, picks, level: levelOf(picks) };
}
