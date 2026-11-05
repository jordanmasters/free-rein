// Helpers for the core's own tests (no Python): temporary folders, files written by path, a home folder of
// their own, and the repo's sample harnesses.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { modelDir } from "../src/read/spec";

/** The Free Rein repo (the one holding model/) */
export const REPO = path.dirname(modelDir());
/** The sample harnesses (samples/) */
export const FIXTURES = path.join(REPO, "samples");

// Every temporary folder a test makes is removed when its process ends.
const made: string[] = [];
process.on("exit", () => { for (const d of made) try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* left for the system */ } });
const mkTemp = (prefix: string) => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); made.push(d); return d; };

// Every test process starts with an empty home folder and no plugins, so what's in your own ~/.claude and
// ~/.free-rein/plugins never changes a result (a test that wants a home or a plugin sets its own).
process.env.HOME = mkTemp("free-rein-home-");
process.env.FREE_REIN_PLUGINS = "";

/** A fresh temporary folder (its real path: macOS's /var is a link to /private/var) */
export const tmpdir = (prefix = "free-rein-test-") => mkTemp(prefix);

/** Write a file at root/rel (folders made as needed) */
export function write(root: string, rel: string, text: string) {
  const p = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
}

/** Run fn with HOME pointing at home (Free Rein reads ~/.claude through HOME) */
export function withHome<T>(home: string, fn: () => T): T {
  const saved = process.env.HOME;
  process.env.HOME = home;
  try { return fn(); } finally { process.env.HOME = saved; }
}

/** A temporary harness folder and an empty home folder, removed afterwards: fn(root, home) */
export function inTemp<T>(fn: (root: string, home: string) => T): T {
  const root = tmpdir(), home = tmpdir("free-rein-home-");
  try { return withHome(home, () => fn(root, home)); }
  finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
}

/** A copy of a fixture (solo, kitchen) in a temporary folder */
export function copyFixture(name: string): string {
  const dst = path.join(tmpdir(), name);
  fs.cpSync(path.join(FIXTURES, name), dst, { recursive: true });
  return dst;
}

/** Real harnesses to read as well as the samples: FREE_REIN_TEST_HARNESSES, folders separated by ":" */
export const extraHarnesses = (): string[] => (process.env.FREE_REIN_TEST_HARNESSES || "").split(":").filter(p => p && fs.existsSync(p) && fs.statSync(p).isDirectory());
