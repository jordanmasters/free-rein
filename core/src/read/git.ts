// Which files git tracks in a repo, read from git's own index (.git/index) so reading a harness still only reads files:
// no git command runs. Shared with your team means committed; a file in the repo that git doesn't track (ignored, or not
// committed yet) is only yours. Index versions 2 and 3 are read; version 4 (path compression) and anything unreadable
// give null, and every file in the repo then counts as shared, as before.
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/** The repo's top folder and its git folder, or null when the folder isn't in a git repo. */
export function repoOf(root: string): { top: string; gitDir: string } | null {
  let dir = path.resolve(root);
  for (let i = 0; i < 40; i++) {
    const g = path.join(dir, ".git");
    try {
      const st = fs.statSync(g);
      if (st.isDirectory()) return { top: dir, gitDir: g };
      const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(g, "utf8")); if (m) return { top: dir, gitDir: path.resolve(dir, m[1].trim()) };
    } catch { /* not here */ }
    const up = path.dirname(dir); if (up === dir) return null; dir = up;
  }
  return null;
}

/** The repo-relative paths git tracks (forward slashes), or null when there's no index Free Rein can read. */
export function tracked(root: string): Set<string> | null {
  const repo = repoOf(root);
  if (!repo) return null;
  const { top: dir, gitDir } = repo;
  let buf: Buffer;
  try { buf = fs.readFileSync(path.join(gitDir, "index")); } catch { return null; }
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "DIRC") return null;
  const version = buf.readUInt32BE(4), count = buf.readUInt32BE(8);
  if (version !== 2 && version !== 3) return null;
  // the paths are relative to the repo's top folder; the harness may sit below it
  const prefix = path.relative(dir, path.resolve(root)).split(path.sep).join("/");
  const out = new Set<string>();
  let off = 12;
  for (let i = 0; i < count; i++) {
    if (off + 62 > buf.length) return null;
    const flags = buf.readUInt16BE(off + 60), extended = version === 3 && (flags & 0x4000) !== 0;
    const start = off + 62 + (extended ? 2 : 0);
    const end = buf.indexOf(0, start); if (end < 0) return null;
    const p = buf.toString("utf8", start, end);
    if (!prefix) out.add(p); else if (p.startsWith(prefix + "/")) out.add(p.slice(prefix.length + 1));
    // each entry is padded with NULs to a multiple of 8 bytes
    const len = end - off + 1; off += Math.ceil(len / 8) * 8;
  }
  return out;
}

// --- ignored: what git leaves out on purpose, read from the ignore files (no git command runs) ---

/** One ignore pattern as git reads it: negated (!), only for folders (a trailing /), and anchored to its file's folder
 *  when it has a / anywhere but the end. */
type Rule = { rx: RegExp; neg: boolean; dirOnly: boolean };

function rules(text: string): Rule[] {
  const out: Rule[] = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/(?<!\\)\s+$/, "");
    if (!line || line.startsWith("#")) continue;
    let neg = false;
    if (line.startsWith("!")) { neg = true; line = line.slice(1); } else if (line.startsWith("\\!") || line.startsWith("\\#")) line = line.slice(1);
    const dirOnly = line.endsWith("/"); if (dirOnly) line = line.replace(/\/+$/, "");
    if (!line) continue;
    const anchored = line.includes("/"); line = line.replace(/^\//, "");
    let rx = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "*" && line[i + 1] === "*") {
        const before = i === 0 || line[i - 1] === "/", after = i + 2 === line.length || line[i + 2] === "/";
        if (before && after) { if (i + 2 === line.length) rx += ".*"; else { rx += "(?:.*/)?"; i++; } i++; continue; }
        rx += "[^/]*"; i++; continue;
      }
      if (c === "*") rx += "[^/]*";
      else if (c === "?") rx += "[^/]";
      else if (c === "[") { const j = line.indexOf("]", i + 1); if (j > i) { rx += "[" + line.slice(i + 1, j).replace(/^!/, "^").replace(/\\/g, "\\\\") + "]"; i = j; } else rx += "\\[" }
      else if (c === "\\" && i + 1 < line.length) { rx += line[++i].replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"); }
      else rx += c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    }
    out.push({ rx: new RegExp(anchored ? `^${rx}$` : `^(?:.*/)?${rx}$`), neg, dirOnly });
  }
  return out;
}

/** A test for whether git ignores a path under the harness (relative to it, forward slashes): the repo's .gitignore
 *  files from its top down, .git/info/exclude and your own (~/.config/git/ignore). A path inside an ignored folder is
 *  ignored. Null when the folder isn't in a git repo. Read from the files, so a setting that moves your own ignore file
 *  (core.excludesFile) isn't seen. */
export function ignored(root: string): ((rel: string) => boolean) | null {
  const repo = repoOf(root);
  if (!repo) return null;
  const top = repo.top, read = (f: string) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const base: [string, Rule[]][] = [["", rules(read(path.join(xdg, "git", "ignore")))], ["", rules(read(path.join(repo.gitDir, "info", "exclude")))]];
  const perDir = new Map<string, Rule[]>();
  const of = (d: string) => { let r = perDir.get(d); if (!r) { r = rules(read(path.join(top, d, ".gitignore"))); perDir.set(d, r); } return r; };
  const prefix = path.relative(top, path.resolve(root)).split(path.sep).join("/");
  const one = (p: string, isDir: boolean): boolean => {
    let hit = false;
    const parts = p.split("/"), sets: [string, Rule[]][] = [...base];
    for (let i = 0; i < parts.length; i++) { const d = parts.slice(0, i).join("/"); sets.push([d, of(d)]); }
    for (const [d, rs] of sets) {
      const rel = d ? p.slice(d.length + 1) : p;
      for (const r of rs) if ((!r.dirOnly || isDir) && r.rx.test(rel)) hit = !r.neg;
    }
    return hit;
  };
  return (rel: string) => {
    const p = (prefix ? prefix + "/" : "") + rel.split(path.sep).join("/").replace(/\/+$/, "");
    const parts = p.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const sub = parts.slice(0, i).join("/"), last = i === parts.length;
      let isDir = !last; if (last) { try { isDir = fs.statSync(path.join(top, sub)).isDirectory(); } catch { /* gone */ } }
      if (one(sub, isDir)) return true;
    }
    return false;
  };
}
