// Reading a harness, and everything else Free Rein works out (plans, drafts, a dry run): Free Rein's core
// (TypeScript, built into media/core) in a worker thread, so VS Code never waits on it.
// Free Rein's data (the pieces, the runtimes, the profiles) comes from the Free Rein repo when one is found (so a change
// there shows at once), else from the copy built into the extension (media/model).
// No VS Code here, so it can be tested on its own.
import * as path from "path";
import { Worker } from "worker_threads";

const MEDIA = path.join(__dirname, "..", "media");
const CORE = path.join(MEDIA, "core");
/** Where the data is: the repo's model, or the extension's own copy */
export const modelOf = (freeReinDir: string | null) => freeReinDir ? path.join(freeReinDir, "model") : path.join(MEDIA, "model");
const core = (freeReinDir: string | null) => { const c = require(path.join(CORE, "index.js")); c.setModelDir(modelOf(freeReinDir)); return c; };

export interface Reading {
  checked: string;
  harnesses: Array<{ name: string; [k: string]: unknown }>;
}
export interface ProfileInfo { id: string; name: string; kind: "runtime" | "product" | "reference" | "example"; build: string; checked_on: string; about?: string }

/** One call into the core, off the main thread (core/src/worker.ts): its result, or the error. */
/** A step of a scan as the core reports it (core/src/report/steps.ts). */
export interface ScanStep { id: string; label: string; detail?: string }
/** Stopping the scans running now: each one ends with a CANCELLED error, and nothing it would have returned is used. */
export const CANCELLED = "Free Rein: the scan was cancelled";
const running = new Set<() => void>();
export function cancelReadings(): number { const n = running.size; for (const stop of [...running]) stop(); return n; }

export function callCore<T>(freeReinDir: string | null, call: string, args: unknown[], timeout = 180_000, onStep?: (s: ScanStep) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(CORE, "worker.js"), { workerData: { call, args, model: modelOf(freeReinDir) } });
    const timer = setTimeout(() => { w.terminate(); reject(new Error("Free Rein took too long")); }, timeout);
    // a scan can be cancelled while it runs
    const stop = () => { clearTimeout(timer); running.delete(stop); w.terminate(); reject(new Error(CANCELLED)); };
    if (call === "reading") running.add(stop);
    w.on("message", (m: any) => {
      // a step of the work, while it runs; then the result
      if (m && m.step) { if (onStep) try { onStep(m.step); } catch { /* the watcher's problem */ } return; }
      clearTimeout(timer); running.delete(stop); w.terminate();
      if (m.error) { const err = new Error(m.error.split("\n")[0]); err.stack = m.error; return reject(err); }
      resolve(m.ok);
    });
    w.once("error", e => { clearTimeout(timer); running.delete(stop); reject(e); });
  });
}

async function reading(freeReinDir: string | null, root: string | null, opts: object, onStep?: (s: ScanStep) => void): Promise<Reading> {
  const r = await callCore<Reading>(freeReinDir, "reading", [root, opts], 120_000, onStep);
  if (!r?.harnesses?.length) throw new Error("Free Rein found no harness here");
  return r;
}

/** A folder, read as the board shows it. A draft (add: packages to try, ups: upgrades, rules: your calls) is
 * measured on a copy; nothing in the folder changes. */
export const readHarness = (root: string, freeReinDir: string | null, countHome = false, runtime = "claude", build = "", add: string[] = [], ups: string[] = [],
  noBase = false, sits: object[] = [], rules: object[] = [], runChoice: Record<string, Record<string, string>> = {}, onStep?: (s: ScanStep) => void): Promise<Reading> =>
  reading(freeReinDir, root, { count_home: countHome, runtime, build: build || null, base: !noBase, sits, add, ups, rules, run_choice: runChoice }, onStep);

/** What a runtime or product gives you out of the box (profiles.json); with a draft on a runtime's profile, a
 * new harness on that runtime. */
export const readProfile = (id: string, freeReinDir: string | null, add: string[] = [], ups: string[] = [], countHome = false, onStep?: (s: ScanStep) => void): Promise<Reading> =>
  reading(freeReinDir, null, { profile: id, count_home: countHome, add, ups }, onStep);

/** The core, loaded here (not in a worker) for quick, file-only calls: the agent review's brief and sensitive files. */
export const coreHere = (freeReinDir: string | null) => core(freeReinDir);

export const listProfiles = async (freeReinDir: string | null): Promise<ProfileInfo[]> => core(freeReinDir).profiles();

/** Folders next to base that an agent would load (CLAUDE.md, AGENTS.md, .claude/). */
export const discoverNear = async (base: string, freeReinDir: string | null): Promise<{ name: string; path: string; uses: string[] }[]> => core(freeReinDir).discover(base);
