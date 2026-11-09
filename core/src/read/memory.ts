// Memory: the notes an agent keeps for itself (model/runtimes/<id>.json, layers.loads.memory). Claude Code's auto memory
// is a folder per repo in your home, an index (MEMORY.md) whose start loads in every session, and topic notes it reads
// on demand, each with a type in its frontmatter (user, feedback, project, reference). Your agent writes them, not you,
// so they change without an edit of yours. Read only when the home folder counts; what's in them is yours alone, and
// stays on this machine (the harness document and check carry counts, never their text).
import * as fs from "fs";
import { re, M, S, join, isdir, isfile, listdir, sorted, readText, strip, splitlines, expanduser } from "../py";
import { home, homeState, memoryDir } from "./home";
import { load } from "./spec";

export interface Note {
  /** the note's file */
  path: string;
  /** its file name */
  file: string;
  /** the index, which loads at the start; the rest are read on demand */
  index: boolean;
  name: string;
  description: string;
  /** user, feedback, project or reference (Claude Code's kinds), or null */
  type: string | null;
  /** when it last changed: its frontmatter's date, else the file's (YYYY-MM-DD) */
  modified: string | null;
  /** files and folders it names, as written */
  names: string[];
  /** other notes it links to ([[name]]) */
  links: string[];
  lines: number;
  bytes: number;
  /** of the index, how many lines load at the start (all of them when it's within the limits) */
  start_lines?: number;
}

export interface Memory {
  runtime: string;
  /** where the notes are */
  dir: string;
  /** on by default in this runtime (it may be switched off in settings) */
  on: boolean;
  /** false when the runtime says not to edit them by hand */
  by_hand: boolean;
  /** of the index, what loads at the start */
  start_lines: number | null;
  start_kb: number | null;
  notes: Note[];
}

const FRONT = re("\\A---\\s*\\n(.*?)\\n---\\s*\\n", S);
const field = (fm: string, k: string) => { const m = re(`^\\s*${k}:\\s*(.+)$`, M).search(fm); return m ? strip(strip(m.group(1)!), "\"'") : ""; };
const PATHISH = re("`([^`\\s]+/[^`\\s]*|[^`\\s]+\\.(?:md|json|ya?ml|toml|py|ts|js|mjs|sh|txt|jsonl))`|\\]\\(([^)\\s]+\\.md)\\)");
const LINK = re("\\[\\[([^\\]|#]+)(?:[|#][^\\]]*)?\\]\\]");

/** The memory record of a runtime, or null when it keeps none Free Rein can read. */
export function record(runtime: string): any | null {
  try { return ((((load().cores || {})[runtime] || {}).layers || {}).loads || {}).memory || null; } catch { return null; }
}

/** One note, read. */
export function note(path: string, index = false, startLines: number | null = null, startKb: number | null = null): Note {
  const text = readText(path, "replace"), file = path.split("/").pop()!;
  const fm = FRONT.match(text), front = fm ? fm.group(1)! : "", body = fm ? text.slice(fm.end) : text;
  let modified = field(front, "modified").slice(0, 10) || null;
  if (!modified) try { modified = fs.statSync(path).mtime.toISOString().slice(0, 10); } catch { modified = null; }
  const names: string[] = [];
  for (const m of PATHISH.finditer(body)) { const p = m.group(1) || m.group(2); if (p && !/^https?:/.test(p) && !names.includes(p)) names.push(p); }
  const links = [...new Set(LINK.findall(body).map((x: any) => strip(Array.isArray(x) ? x[0] : x)))] as string[];
  const lines = splitlines(text).length, bytes = Buffer.byteLength(text, "utf8");
  const n: Note = { path, file, index, name: field(front, "name") || file.replace(/\.md$/, ""), description: field(front, "description"),
    type: field(front, "type") || null, modified, names, links, lines, bytes };
  if (index) {
    // the first start_lines lines or start_kb KB, whichever comes first
    let keep = startLines ?? lines;
    if (startKb != null) { let b = 0, i = 0; for (const l of splitlines(text)) { b += Buffer.byteLength(l, "utf8") + 1; if (b > startKb * 1024) break; i++; } keep = Math.min(keep, i); }
    n.start_lines = Math.min(keep, lines);
  }
  return n;
}

/** This repo's memory in a runtime: the folder, what its record says, every note. Null when the home folder doesn't
 *  count, the runtime keeps none Free Rein can read, or there's no folder yet. */
export function memory(root: string, runtime = "claude"): Memory | null {
  if (!homeState.counted) return null;
  const rec = record(runtime);
  if (!rec || rec.status === "none" || !rec.dir) return null;
  const dir = runtime === "claude" ? memoryDir(root) : rec.dir.startsWith("~") ? join(home(), rec.dir.slice(2)) : expanduser(rec.dir);
  if (!dir || !isdir(dir)) return null;
  const notes: Note[] = [];
  for (const f of sorted(listdir(dir))) {
    const p = join(dir, f);
    if (!f.endsWith(".md") || !isfile(p)) continue;
    notes.push(note(p, !!rec.index && f === rec.index, rec.start_lines ?? null, rec.start_kb ?? null));
  }
  // the index first, then the notes by name
  notes.sort((a, b) => Number(b.index) - Number(a.index));
  return { runtime, dir, on: rec.on !== false, by_hand: rec.by_hand !== false, start_lines: rec.start_lines ?? null, start_kb: rec.start_kb ?? null, notes };
}
