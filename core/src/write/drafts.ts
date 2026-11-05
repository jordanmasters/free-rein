// Applying a draft: the combined file changes for its upgrades and your calls, creating a new harness, and
// putting files back. First written in Python (retired 2026-10-11).
import * as fs from "fs";
import { spawnSync } from "child_process";
import { join, abspath, isfile, exists, listdir, dirname, sorted } from "../py";
import { load } from "../read/spec";
import { copyHarness, TEMPLATES, write, rulesEdit, request, Edit } from "./changes";
import { catalog, files, installFramework } from "./packages";


function text(p: string): string | null {
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(p)).replace(/\r\n?/g, "\n"); }
  catch { return null; }
}

/** Every file the draft's upgrades (and your calls, as permission rules) would write, with its text before and after. */
export function edits(rootIn: string, ups: string[], rules: any[] = []) {
  const root = abspath(rootIn);
  const [tmp, dst] = copyHarness(root);
  const notes = new Map<string, string>(), modes = new Map<string, number>(), done: string[] = [], skipped: string[] = [];
  const out: any[] = [];
  try {
    for (const u of ups) {
      const fn = TEMPLATES[u];
      const es = fn ? fn(dst) : null;
      if (!es || !es.length) { skipped.push(u); continue; }
      write(es, dst);
      done.push(u);
      for (const e of es) { notes.set(e.rel, e.note); if (e.mode) modes.set(e.rel, e.mode); }
    }
    const es = rulesEdit(dst, rules);
    if (es) {
      write(es, dst);
      for (const e of es) notes.set(e.rel, (notes.has(e.rel) ? notes.get(e.rel) + "; " : "") + e.note);
    }
    for (const rel of sorted([...notes.keys()])) {
      const before = text(join(root, rel)), after = text(join(dst, rel));
      if (after === null || before === after) continue;
      out.push({ path: join(root, rel), rel, before, after, kind: before === null ? "create" : "replace", note: notes.get(rel), mode: modes.get(rel) ?? null });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const items: Record<string, any> = Object.fromEntries(load().slots.flatMap((sl: any) => sl.items).map((i: any) => [i.id, i]));
  return { edits: out, applied: done, requested: skipped, requests: Object.fromEntries(skipped.filter(u => u in items).map(u => [u, request(items[u], null)])) };
}

/** Run a framework's own installer (from its Free Rein plugin) with its defaults; what it wrote, relative to root. */
export function installPackage(root: string, id: string): string[] {
  const p = catalog().find(x => x.id === id && x.kind === "framework");
  if (!p) throw new Error(`${id} isn't on this machine, or has no installer Free Rein can run`);
  const before = new Set(files(root).keys());
  installFramework(p, root);
  const written = sorted([...files(root).keys()].filter(f => !before.has(f)));
  if (!written.length) throw new Error(`${p.name}'s installer wrote nothing`);
  return written;
}

/** A new harness: an empty folder (a git repo), the frameworks chosen (their installers), then the upgrades written in. */
export function create(destIn: string, ups: string[], frameworks: string[] | boolean = []) {
  const dest = abspath(destIn);
  if (exists(dest) && listdir(dest).length) throw new Error(`${dest} isn't empty; choose a new folder`);
  fs.mkdirSync(dest, { recursive: true });
  spawnSync("git", ["init", "-q", dest]);
  // (true: the first framework there is, as the editor asked before frameworks were plugins)
  const ids = frameworks === true ? catalog().filter(p => p.kind === "framework").slice(0, 1).map(p => p.id) : frameworks === false ? [] : frameworks;
  const written = ids.flatMap(id => installPackage(dest, id));
  const e = edits(dest, ups);
  write(e.edits.map((x: Edit) => ({ ...x })), dest);
  return { path: dest, written: [...written, ...e.edits.map((x: Edit) => x.rel)], applied: e.applied, requested: e.requested };
}

/** [{rel, before}]: put each file back as it was (before null: it was new, so it goes). Only inside root. */
export function restore(rootIn: string, filesIn: any): string[] {
  const root = abspath(rootIn), done: string[] = [];
  for (const f of Array.isArray(filesIn) ? filesIn : []) {
    const rel = String((f || {}).rel || "");
    const p = abspath(join(root, rel));
    if (!rel || !p.startsWith(root + "/")) continue;
    if (f.before === null || f.before === undefined) { if (isfile(p)) fs.rmSync(p); }
    else { fs.mkdirSync(dirname(p), { recursive: true }); fs.writeFileSync(p, f.before); }
    done.push(rel);
  }
  return done;
}
