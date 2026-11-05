// Folders a repo declares as sample harnesses: someone else's harness, kept for tests, docs or demos. A repo says
// which in .free-rein.json at its root:
//
//   { "samples": ["samples/", "docs/examples/"] }
//
// When Free Rein reads the repo's own harness it leaves them out, so their instructions, skills and rules aren't
// counted as the repo's. Nothing is guessed from a folder's name: a folder is a sample only when the repo says so.
import { join, isdir, readText, loads, realpath, normpath } from "../py";

/** The real paths of the folders this repo declares as samples (none when it declares none). */
export function declaredSamples(root: string): string[] {
  let config: any;
  try { config = loads(readText(join(root, ".free-rein.json"))); } catch { return []; }
  const list = config && Array.isArray(config.samples) ? config.samples : [];
  return list.filter((p: unknown): p is string => typeof p === "string" && !!p.trim() && !p.startsWith("/") && !p.split(/[\\/]/).includes(".."))
    .map((p: string) => join(root, normpath(p)))
    .filter(isdir)
    .map(realpath);
}

/** A walk's prune: drops the folders this repo declares as samples, and keeps what keep() keeps. */
export function withoutSamples(root: string, keep: (d: string) => boolean = () => true): (dirs: string[], dp: string) => string[] {
  const samples = new Set(declaredSamples(root));
  return (dirs, dp) => dirs.filter(d => keep(d) && !(samples.size && samples.has(realpath(join(dp, d)))));
}
