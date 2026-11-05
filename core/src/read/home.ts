// Whether what's in your home folder counts: ~/.claude (settings, skills) and the session transcripts Claude Code
// keeps there. Off (free-rein check by default, --no-home), Free Rein reads nothing from it, so its output is the same on
// every machine and carries nothing about yours.
import * as os from "os";
import { re, join, abspath } from "../py";

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
