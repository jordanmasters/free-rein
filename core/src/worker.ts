// The core's work, in a worker thread: the editor sends {call, args, model} (or {root, opts} for a reading)
// and gets {ok: the result} or {error}, without blocking while Free Rein reads, plans or writes.
import { parentPort, workerData } from "worker_threads";
import { setModelDir } from "./read/spec";
import { reading } from "./report/board";
import { plan, upgrades } from "./write/changes";
import { edits, create, installPackage } from "./write/drafts";
import { simulate } from "./judge/simulate";
import { onStep } from "./report/steps";

const CALLS: Record<string, (...a: any[]) => any> = {
  reading: (root, opts) => reading(root, opts || {}),
  plan, upgrades, edits, create, installPackage,
  simulate: (root, steps, runtime, runHooks) => simulate(root, steps, runtime ?? "claude", !!runHooks),
};

try {
  setModelDir(workerData.model);
  // what the scan is doing, as it does it, for the editor to show
  onStep(s => parentPort!.postMessage({ step: s }));
  const call = workerData.call ?? "reading";
  const args = workerData.call ? workerData.args : [workerData.root, workerData.opts];
  if (!(call in CALLS)) throw new Error(`no such call: ${call}`);
  parentPort!.postMessage({ ok: CALLS[call](...args) });
} catch (e: any) {
  // a file system error's message leaves out the path it failed on (opendir's does): put it back
  const where = e && e.path && !String(e.message).includes(e.path) ? ` '${e.path}'` : "";
  const text = String((e && e.stack) || e);
  parentPort!.postMessage({ error: where ? text.replace(/\n|$/, where + "$&") : text });
}
