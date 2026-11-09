// The harness document: the facts about one harness in the stable format other tools
// build on (model/schema/harness.schema.json, "free-rein.harness/1"), made from Free Rein's
// reading of it (the board data). No scores: see score.ts.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Spec } from "../read/spec";

export const SCHEMA = "free-rein.harness/1";
export const VERSION = "0.2.0";

/** Python's truthiness, so ported conditions read the same: null, 0, "", [] and {} are false. */
const truthy = (x: any) => !!x && !(Array.isArray(x) && !x.length) && !(typeof x === "object" && !Array.isArray(x) && !Object.keys(x).length);
const get = (o: any, k: string, d: any = null) => (o && k in o ? o[k] : d);

/** A path with links resolved, as far as it exists (like Python's os.path.realpath). */
function realpath(p: string): string {
  const abs = path.resolve(p);
  try { return fs.realpathSync.native(abs); } catch { /* resolve the part that exists */ }
  const parent = path.dirname(abs);
  return parent === abs ? abs : path.join(realpath(parent), path.basename(abs));
}

/** A path as a reader of the document should see it: relative to the harness, ~ for the home folder. */
export function where(p: string | null | undefined, root?: string | null): string | null {
  if (!p) return null;
  const ap = realpath(p);
  if (root) {
    const r = realpath(root);
    if (ap === r) return ".";
    if (ap.startsWith(r + path.sep)) return path.relative(r, ap);
  }
  const home = realpath(os.homedir());
  if (ap.startsWith(home + path.sep)) return "~/" + path.relative(home, ap);
  return path.basename(ap);
}

/** Which layer an instance comes from: the project, your home folder, a package, or the runtime. */
function layer(inst: any): string {
  if (truthy(inst.pkg)) return "package:" + inst.pkg;
  const m: Record<string, string> = { project: "project", user: "home", org: "home", local: "project" };
  const sc = get(inst, "scope");
  return sc in m ? m[sc] : (truthy(sc) ? sc : "project");
}

/** The mode a harness is read in by default: the one its settings set, else auto (as the board reads it). */
export function readMode(ov: any): string {
  const m = get(get(ov || {}, "set_mode") || {}, "mode");
  return m !== null && m in (get(ov || {}, "by_mode") || {}) ? m : "auto";
}

/** The harness document for one harness, from Free Rein's reading of it (board data). spec: spec.load(). */
export function document(h: any, spec: Spec, root?: string | null, mode?: string | null, countsHome?: boolean | null): any {
  const comboIds: Record<string, string> = Object.fromEntries(spec.combos.map((c: any) => [c.name, c.id]));
  const rt = get(h, "runtime") || {};
  const rid = get(rt, "core") || get(rt, "id");
  const core = get(get(spec, "cores") || {}, rid) || {};
  const pieces: any[] = [];
  for (const sl of h.slots) for (const t of sl.types) {
    const insts = [];
    for (const i of [...(get(t, "inst") || []), ...(get(t, "extra") || [])]) {
      const rec: any = { path: where(get(i, "path"), root), layer: layer(i) };
      if (truthy(get(i, "lines"))) rec.lines = i.lines;
      if (i.hold === "holds" || i.hold === "asks") rec.enforced = i.hold === "holds";
      insts.push(rec);
    }
    const p: any = { id: t.id, section: sl.id, kind: get(t, "kind") === "control" ? "safeguard" : "ability",
      state: get(t, "state"), maturity: Math.max(0, get(t, "maturity") || 0), instances: insts };
    if (truthy(get(t, "supplied"))) p.supplied_by = t.supplied;
    if (truthy(get(t, "runtime_items"))) p.runtime_items = t.runtime_items;
    if (truthy(get(t, "tier"))) p.tier = { reached: get(t.tier, "reached", 0), of: get(t.tier, "of", 0) };
    const prof = truthy(get(t, "profile")) ? get(t.profile || {}, "summary") : null;
    if (truthy(prof) && truthy(get(prof, "n"))) p.items_complete = { ok: prof.ok, of: prof.n };
    pieces.push(p);
  }
  const said = get(h, "said") || {};
  // your agent's notes (memory) are yours alone: the document, which is meant to be shared, counts them, never quotes them
  const all = get(said, "statements") || [], mine = all.filter((s: any) => get(s, "who") === "agent");
  const statements = all.filter((s: any) => get(s, "who") !== "agent").map((s: any) => ({
    id: s.id, kind: s.kind, text: s.text, path: get(get(s, "source") || {}, "file"), line: get(get(s, "source") || {}, "line"),
    ...(truthy(get(s, "strength")) ? { strength: s.strength } : {}), ...(truthy(get(s, "piece")) ? { piece: s.piece } : {}) }));
  const m = mode || readMode(get(h, "oversight"));
  const ov = get(get(get(h, "oversight") || {}, "by_mode") || {}, m) || {};
  const situations = (get(ov, "situations") || []).map((s: any) => ({
    id: s.id, stakes: s.stakes, tool: get(s, "tool"), target: get(s, "target"), verdict: s.verdict, accounted: truthy(get(s, "accounted")),
    decided_by: (get(s, "by") || []).filter((b: any) => truthy(get(b, "piece"))).map((b: any) => b.piece) }));
  // active, locked (an achievement missing a piece), dormant, or cleared (a weak spot whose fix is in place)
  const combos = (get(h, "sets") || []).map((c: any) => ({ id: get(comboIds, c.name, c.name), kind: c.kind, status: c.status, pieces: get(c, "ids") || [] }));
  const doc: any = {
    schema: SCHEMA, free_rein: VERSION, read_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    target: { name: get(h, "name"), kind: truthy(get(h, "profile")) ? "profile" : "folder" },
    runtime: { id: rid, name: get(core, "name") || get(rt, "name"), ...(truthy(get(core, "version_checked")) ? { version_checked: core.version_checked } : {}) },
    mode: m,
    ...(countsHome !== null && countsHome !== undefined ? { counts_home: countsHome } : {}),
    pieces, statements, situations, combos,
  };
  if (mine.length) doc.memory = { statements: mine.length, rules: mine.filter((s: any) => s.kind === "rule").length };
  if (truthy(get(h, "build"))) doc.runtime.build = get(h.build, "id");
  return doc;
}
