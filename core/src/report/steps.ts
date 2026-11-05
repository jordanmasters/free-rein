// What a scan is doing, step by step, for whoever is watching (the extension, through the worker). Each step names
// what Free Rein is reading or working out, in plain words, and what it found once it has. Nothing here changes a result.
export interface Step { id: string; label: string; detail?: string }
let sink: ((s: Step) => void) | null = null;
/** Where steps go: the worker sends them to the editor; elsewhere they go nowhere. */
export function onStep(f: ((s: Step) => void) | null) { sink = f; }
export function step(id: string, label: string, detail?: string) { if (sink) try { sink({ id, label, ...(detail ? { detail } : {}) }); } catch { /* a watcher's problem isn't the scan's */ } }
/** The steps of a scan of your files, in order, so a watcher can say how far along it is. */
export const STEPS = ["files", "layers", "prose", "situations", "backing", "loops", "score", "checks"];
