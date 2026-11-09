// Whether what's in your home folder counts: ~/.claude (settings, skills) and the session transcripts Claude Code
// keeps there. Off (free-rein check by default, --no-home), Free Rein reads nothing from it, so its output is the same on
// every machine and carries nothing about yours.
import * as os from "os";
import { re, join, abspath, readText } from "../py";
import { repoOf } from "./git";

export const homeState = { counted: true };

/** fn, with what loads from ~/.claude counted or not */
export function withHome<T>(countHome: boolean, fn: () => T): T {
  const was = homeState.counted;
  homeState.counted = countHome;
  try { return fn(); } finally { homeState.counted = was; }
}

/** Your home folder (HOME, else the account's). */
export const home = () => process.env.HOME || os.homedir();

/** Where Claude Code keeps this folder's session transcripts, or null when the home folder doesn't count. */
export function historyDir(root: string): string | null {
  if (!homeState.counted) return null;
  return join(home(), ".claude", "projects", re("[^A-Za-z0-9]").sub(abspath(root), "-"));
}

/** Claude Code's folder for one project under ~/.claude/projects: the path with every other character made a dash. */
export const projectFolder = (p: string) => join(home(), ".claude", "projects", re("[^A-Za-z0-9]").sub(abspath(p), "-"));

/** The folders in your home that belong to this repo alone (its transcripts, its memory): this repo, just you, though
 *  they sit in the home folder. Claude Code names one after the folder a session starts in and one after the repo's top. */
export function repoHomeFolders(root: string): string[] {
  const out = [projectFolder(root)], top = repoOf(root);
  if (top && abspath(top.top) !== abspath(root)) out.push(projectFolder(top.top));
  return out;
}

/** Where Claude Code keeps this repo's auto memory (model/runtimes/claude.json, layers.loads.memory): autoMemoryDirectory
 *  when a settings file sets it (this repo just you, shared, then yours), else ~/.claude/projects/<repo>/memory, the
 *  repo found from its top so subfolders share it. Null when the home folder doesn't count. */
export function memoryDir(root: string): string | null {
  if (!homeState.counted) return null;
  for (const f of [join(root, ".claude", "settings.local.json"), join(root, ".claude", "settings.json"), join(home(), ".claude", "settings.json")]) {
    let v: any; try { v = JSON.parse(readText(f)).autoMemoryDirectory; } catch { continue; }
    if (typeof v === "string" && v) return v.startsWith("~") ? join(home(), v.slice(2)) : abspath(join(root, v));
  }
  const top = repoOf(root);
  return join(projectFolder(top ? top.top : root), "memory");
}
