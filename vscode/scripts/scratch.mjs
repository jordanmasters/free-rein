// A throwaway copy of a harness to try upgrades on, at /tmp/free-rein-scratch/NAME: fresh each time the "scratch"
// launch runs, so applying changes never touches the real repo. A git repo, so you can see exactly what an
// upgrade changed (git diff) and undo it (git checkout .).
// Usage: node scripts/scratch.mjs [HARNESS]   (default: the kitchen sample, samples/kitchen)
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(path.dirname(HERE));
const src = path.resolve(process.argv[2] || path.join(REPO, "samples", "kitchen"));
const dst = path.join("/tmp", "free-rein-scratch", path.basename(src));
const skip = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "venv", "__pycache__"]);
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true, verbatimSymlinks: true, filter: p => p === src || !skip.has(path.basename(p)) });
execFileSync("git", ["init", "-q"], { cwd: dst });
execFileSync("git", ["add", "-A"], { cwd: dst });
execFileSync("git", ["-c", "user.name=free-rein", "-c", "user.email=free-rein@localhost", "commit", "-qm", "scratch copy"], { cwd: dst });
console.log(`scratch copy of ${path.basename(src)} at ${dst}`);
