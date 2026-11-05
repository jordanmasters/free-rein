// Free Rein's model, loaded: pieces.json (sections, pieces, combos, tiers, progression,
// trust) plus one file per runtime in runtimes/. Returns the in-memory shape the
// rest of Free Rein reads.
//
// A runtime answer on disk is a record {how, status, source}, status one of
// confirmed | believed | none. In memory it is [how, status, source] with
// status true | false | null.
import * as fs from "fs";
import * as path from "path";

export type Status = "confirmed" | "believed" | "none";
export type Answer = [string | null, boolean | null, string | null];
export type Spec = Record<string, any>;

const STATUS_IN: Record<Status, boolean | null> = { confirmed: true, believed: false, none: null };

let MODEL: string | null = null;
/** Where the data is, when the code runs away from it (the extension's copy of the core reads the Free Rein repo's data). */
export function setModelDir(dir: string | null) { MODEL = dir; }

/** The folder holding pieces.json: as set, else FREE_REIN_MODEL, else model in the repo this package sits in. */
export function modelDir(): string {
  if (MODEL) return MODEL;
  if (process.env.FREE_REIN_MODEL) return process.env.FREE_REIN_MODEL;
  for (let d = __dirname; ; d = path.dirname(d)) {
    const cand = path.join(d, "model");
    if (fs.existsSync(path.join(cand, "pieces.json"))) return cand;
    if (path.dirname(d) === d) throw new Error("can't find model/pieces.json; set FREE_REIN_MODEL");
  }
}

/** The Free Rein repo (the folder holding model/), or the extension's media folder when it runs on its own copy. */
export const repoDir = () => path.dirname(modelDir());

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

/** {runtime id: its file's content}, in pieces.json's runtime order. */
export function runtimeFiles(dir = modelDir()): Record<string, any> {
  const out: Record<string, any> = {};
  for (const rid of readJson(path.join(dir, "pieces.json")).runtimes) out[rid] = readJson(path.join(dir, "runtimes", rid + ".json"));
  return out;
}

const cache = new Map<string, string>();

/** The model as Free Rein reads it: each runtime's metadata and sources under cores, each piece's answers under its cores. */
export function load(dir = modelDir(), fresh = false): Spec {
  if (!fresh && cache.has(dir)) return JSON.parse(cache.get(dir)!);
  const spec = readJson(path.join(dir, "pieces.json"));
  const rts = runtimeFiles(dir);
  const cores: Record<string, any> = {};
  for (const [rid, rt] of Object.entries(rts)) {
    const meta: Record<string, any> = {};
    for (const [k, v] of Object.entries(rt)) if (!["schema", "id", "sources", "answers"].includes(k)) meta[k] = v;
    const srcs: Record<string, any> = {};
    for (const [key, s] of Object.entries<any>(rt.sources || {})) {
      const src: Record<string, any> = {};
      for (const [k, v] of Object.entries(s)) if (k !== "checked") src[k] = v;
      const note = (s.checked || {}).note;
      if (note !== undefined && note !== null) src.checked = note;
      srcs[key] = src;
    }
    if (Object.keys(srcs).length || "sources" in rt) meta.sources = srcs;
    cores[rid] = meta;
  }
  spec.cores = cores;
  delete spec.runtimes;
  for (const sl of spec.slots) for (const it of sl.items) {
    const ans: Record<string, Answer> = {};
    for (const [rid, rt] of Object.entries(rts)) {
      const a = (rt.answers || {})[it.id];
      if (a !== undefined && a !== null) ans[rid] = [a.how ?? null, STATUS_IN[a.status as Status], a.source ?? null];
    }
    it.cores = ans;
  }
  cache.set(dir, JSON.stringify(spec));
  return spec;
}

/** Every confirmed or believed claim that names no source (runtimes with no sources of their own are exempt). */
export function unsourced(dir = modelDir()): [string, string, string | null, Status][] {
  const out: [string, string, string | null, Status][] = [];
  for (const [rid, rt] of Object.entries(runtimeFiles(dir))) {
    if (!rt.sources || !Object.keys(rt.sources).length) continue;
    for (const [pid, a] of Object.entries<any>(rt.answers || {}))
      if (a.status !== "none" && !a.source) out.push([rid, pid, a.how ?? null, a.status]);
  }
  return out;
}
