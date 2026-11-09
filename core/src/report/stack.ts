// The stack: the levels a runtime reads a harness at, in its own words (model/runtimes/<id>.json, "layers"), with what
// this harness has at each. A level is a scope: where a part applies and, for settings, which value wins. Where a part
// came from (a package, or you) is a second question, shown inside each level. The runtime's built-ins are the bottom
// level; the session and the folders are named, with what can't be read from files said plainly.
import * as os from "os";
import * as path from "path";
import { tracked, ignored } from "../read/git";

type Claim = { how: string; status: string; source?: string };
export interface Level {
  id: "org" | "local" | "project" | "user" | "builtin"; name: string; files: string[]; found: string[]; pieces: string[];
  count: number; from: { name: string; n: number }[]; readable: boolean; sets: string[];
  /** each piece this level gives, with the files that give it */
  gives: { piece: string; files: string[] }[];
  /** models named in this level's files (a model for one job, not the main one), with what for */
  models: { name: string; for: string }[];
  /** this repo's files at this level that aren't committed yet: in the repo for everyone, but a teammate doesn't have
   *  them until they're committed */
  uncommitted: string[];
}
export interface Stack {
  runtime: string; levels: Level[]; unused: { id: string; name: string }[];
  folders: Claim | null; session: Claim | null; combine: Record<string, Claim>;
  /** levels: where its parts sit, the one with most first (where it's shown) */
  packages: { name: string; n: number; levels: string[]; pieces: string[] }[];
}

// a runtime with no "layers" yet: the levels every runtime we know has, in plain words
const GENERIC = [{ id: "org", name: "Your organization", files: [] }, { id: "local", name: "This repo, just you", files: [] },
  { id: "project", name: "This repo, shared", files: [] }, { id: "user", name: "You, every repo", files: [] }];
const SCOPE: Record<string, Level["id"]> = { org: "org", managed: "org", local: "local", project: "project", user: "user" };

/** The levels in use, most specific first, then the built-ins; the known levels with nothing in them; packages. */
export function stack(o: { root: string | null; rt: any; rtName: string; slots: any[]; baseShips: Record<string, any>; baseOn: boolean;
  runMode: any; models: any }): Stack {
  const L = (o.rt && o.rt.layers) || {}, known: any[] = (L.scopes && L.scopes.length ? L.scopes : GENERIC).slice();
  // every repo has files git doesn't track, whether or not the runtime names a level for them: they're only yours
  if (!known.some(k => k.id === "local")) { const i = known.findIndex(k => k.id === "project"); known.splice(i < 0 ? known.length : i, 0, { id: "local", name: "This repo, just you", files: [] }); }
  // a path as a person reads it: inside the harness relative to it, in the home folder from ~; a relative path is the harness's
  // (parts carry paths as read, from where Free Rein runs; settings name files from the harness's root)
  const home = os.homedir(), root = o.root ? path.resolve(o.root) : null, rel = (p: string, fromRoot = false) => {
    if (!p) return "";
    if (p.startsWith("~/")) return p;
    const a = fromRoot && root && !path.isAbsolute(p) ? path.resolve(root, p) : path.resolve(p);
    if (root && a === root) return "";
    if (root && a.startsWith(root + path.sep)) return path.relative(root, a);
    return a.startsWith(home + path.sep) ? "~/" + path.relative(home, a) : a;
  };
  const types = o.slots.flatMap((s: any) => s.types || []);
  const parts = types.flatMap((t: any) => (t.inst || []).map((x: any) => ({ ...x, piece: t.id })));
  // only yours, in this repo, means kept out of git on purpose: a file git ignores (or a .local one, by its name). A file
  // in the repo that git doesn't track and doesn't ignore isn't committed yet: it's the repo's, shared once it's
  // committed, so it stays shared and is marked. Read from git's index and ignore files; with no index, every file in
  // the repo counts as shared, as before
  const git = root ? tracked(root) : null, ign = root && git ? ignored(root) : null;
  const notTracked = (r: string) => !!git && !git.has(r) && ![...git].some(t => t.startsWith(r + "/"));
  const pending = new Set<any>();
  if (git) for (const x of parts) if (x.scope === "project" && x.path) {
    const a = path.resolve(x.path); if (!a.startsWith(root! + path.sep)) continue;
    const r = path.relative(root!, a).split(path.sep).join("/");
    if (notTracked(r)) { if (ign && ign(r)) x.scope = "local"; else pending.add(x); }
  }
  // which level a file sets the mode or the model from
  const levelOfFile = (f: string): Level["id"] | null => /settings\.local\.json$|CLAUDE\.local\.md$/.test(f) ? "local"
    : /^~\//.test(f) ? "user" : f && !path.isAbsolute(f) ? "project" : null;
  const sets: Record<string, string[]> = {};
  // what a file sets is credited to its level; a default (nothing sets it) to the runtime's built-ins
  const credit = (l: string | null, what: string) => { if (l && !(sets[l] || []).includes(what)) (sets[l] = sets[l] || []).push(what); };
  // a runtime with two mode controls (a chat mode and a run mode) names each by its control
  for (const p of ((o.runMode || {}).picks || [])) credit(p.set && p.from ? levelOfFile(rel(p.from, true)) : "builtin", `${p.picker ? `the ${p.picker}` : "the mode it starts in"} (${p.name}${p.set ? "" : ", its default"})`);
  // the model: the main one, the first the harness names
  const main = (((o.models || {}).models) || []).find((m: any) => (m.found_in || []).length);
  if (main) { const url = /^https?:/.test(main.found_in[0]); credit(url ? "builtin" : levelOfFile(rel(main.found_in[0])), `the model (${main.name}${url ? ", its default" : ""})`); }
  // the other models the harness names, each credited to the level of the file that names it (a committed file is
  // shared, one git doesn't track is only yours)
  const levelOfAbs = (f: string): Level["id"] | null => {
    if (!f || /^https?:/.test(f)) return null;
    const a = path.resolve(f), r = root && a.startsWith(root + path.sep) ? path.relative(root, a).split(path.sep).join("/") : null;
    if (r != null) return git && !git.has(r) && ign && ign(r) ? "local" : /settings\.local\.json$|CLAUDE\.local\.md$/.test(r) ? "local" : "project";
    return a.startsWith(home + path.sep) ? "user" : null;
  };
  const named: Record<string, { name: string; for: string }[]> = {};
  for (const m of (((o.models || {}).models) || []).filter((m: any) => m !== main && (m.found_in || []).length)) {
    const l = levelOfAbs(m.found_in[0]); if (l) (named[l] = named[l] || []).push({ name: m.name, for: (m.used_for || [])[0] || "" });
  }
  const levels: Level[] = [], unused: Stack["unused"] = [];
  for (const k of known) {
    const mine = parts.filter((x: any) => SCOPE[x.scope] === k.id), byPkg: Record<string, number> = {};
    for (const x of mine) byPkg[x.pkg || "yours"] = (byPkg[x.pkg || "yours"] || 0) + 1;
    if (!mine.length && !sets[k.id] && !named[k.id]) { unused.push({ id: k.id, name: k.name }); continue; }
    const gives: Record<string, Set<string>> = {};
    for (const x of mine) { const g = gives[x.piece] = gives[x.piece] || new Set(); const f = rel(x.path); if (f) g.add(f); }
    levels.push({ id: k.id, name: k.name, files: k.files || [], readable: k.readable !== false, sets: sets[k.id] || [],
      found: [...new Set(mine.map((x: any) => rel(x.path)).filter(Boolean))].slice(0, 40) as string[], count: mine.length,
      pieces: [...new Set(mine.map((x: any) => x.piece))] as string[],
      gives: Object.entries(gives).map(([piece, f]) => ({ piece, files: [...f].slice(0, 6) })), models: named[k.id] || [],
      uncommitted: [...new Set(mine.filter((x: any) => pending.has(x)).map((x: any) => rel(x.path)).filter(Boolean))].slice(0, 40) as string[],
      from: Object.entries(byPkg).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n) });
  }
  // the runtime's own: what it ships, whether or not the harness adds anything
  const ships = Object.entries(o.baseShips || {}).filter(([, v]) => v && v.ships);
  if (ships.length) {
    const names = ships.map(([id]) => (types.find((t: any) => t.id === id) || { name: id }).name);
    levels.push({ id: "builtin", name: `${o.rtName}, built in`, files: names.slice(0, 4).concat(names.length > 4 ? [`and ${names.length - 4} more`] : []),
      found: [], pieces: ships.map(([id]) => id), count: ships.length, from: [{ name: o.rtName, n: ships.length }], readable: true, sets: sets.builtin || [],
      gives: ships.map(([id]) => ({ piece: id, files: [] })), models: [], uncommitted: [] });
  }
  // a known level a runtime keeps where Free Rein can't read it says so, even when nothing was found
  for (const k of known.filter((k: any) => k.readable === false)) {
    const u = unused.findIndex(x => x.id === k.id);
    if (u >= 0) { unused.splice(u, 1); levels.splice(levels.findIndex(l => l.id === "builtin") >= 0 ? levels.length - 1 : levels.length, 0,
      { id: k.id, name: k.name, files: k.files || [], found: [], pieces: [], count: 0, from: [], readable: false, sets: [], gives: [], models: [], uncommitted: [] }); }
  }
  const pk: Record<string, { n: number; levels: Set<string>; pieces: Set<string> }> = {};
  const brought = types.flatMap((t: any) => [...(t.inst || []), ...(t.extra || [])].map((x: any) => ({ ...x, piece: t.id })));
  const per: Record<string, Record<string, number>> = {};
  for (const x of brought.filter((x: any) => x.pkg)) { const p = pk[x.pkg] = pk[x.pkg] || { n: 0, levels: new Set(), pieces: new Set() }; p.n++; p.pieces.add(x.piece);
    const lv = SCOPE[x.scope]; if (lv) { p.levels.add(lv); const c = per[x.pkg] = per[x.pkg] || {}; c[lv] = (c[lv] || 0) + 1; } }
  return { runtime: o.rtName, levels, unused, folders: L.folders || null, session: L.session || null, combine: L.combine || {},
    packages: Object.entries(pk).map(([name, v]) => ({ name, n: v.n, levels: [...v.levels].sort((a, b) => ((per[name] || {})[b] || 0) - ((per[name] || {})[a] || 0)), pieces: [...v.pieces] })).sort((a, b) => b.n - a.n) };
}
