// Which files git tracks in a repo, read from git's own index (.git/index) so reading a harness still only reads files:
// no git command runs. Shared with your team means committed; a file in the repo that git doesn't track (ignored, or not
// committed yet) is only yours. Index versions 2 and 3 are read; version 4 (path compression) and anything unreadable
// give null, and every file in the repo then counts as shared, as before.
import * as fs from "fs";
import * as path from "path";

/** The repo-relative paths git tracks (forward slashes), or null when there's no index Free Rein can read. */
export function tracked(root: string): Set<string> | null {
  let dir = path.resolve(root), gitDir: string | null = null;
  for (let i = 0; i < 40; i++) {
    const g = path.join(dir, ".git");
    try {
      const st = fs.statSync(g);
      if (st.isDirectory()) gitDir = g;
      else { const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(g, "utf8")); if (m) gitDir = path.resolve(dir, m[1].trim()); }
    } catch { /* not here */ }
    if (gitDir) break;
    const up = path.dirname(dir); if (up === dir) return null; dir = up;
  }
  if (!gitDir) return null;
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
