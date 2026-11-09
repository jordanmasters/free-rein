// How fresh the board is: which files a reading came from, which of them changed since, and what to watch so it reads
// again when they change. Free Rein reads files on this machine; this only looks at their names and modified times.
// No VS Code here, so it can be tested on its own.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/** Every file a reading names that exists on disk: the harness's own, your home folder's, a hook's script elsewhere.
 * A draft's copy (in the temp folder) isn't yours, so it's left out, unless the harness itself is there. */
export function filesRead(data: unknown, root: string, cap = 400): string[] {
  const out = new Set<string>(), tmps = [os.tmpdir(), fs.realpathSync(os.tmpdir())], r = path.resolve(root);
  const walk = (v: unknown, depth: number) => {
    if (out.size >= cap || depth > 40) return;
    if (typeof v === "string") {
      if (v.length < 2 || v.length > 1024 || !path.isAbsolute(v)) return;
      if (!v.startsWith(r + path.sep) && tmps.some(t => v.startsWith(t + path.sep))) return;
      try { if (fs.statSync(v).isFile()) out.add(v); } catch { /* not a file */ }
      return;
    }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    if (v && typeof v === "object") for (const x of Object.values(v)) walk(x, depth + 1);
  };
  walk(data, 0);
  return [...out];
}

/** The files modified after a reading (an ISO time), newest first; a file that's gone counts as changed. */
export function changedSince(files: string[], at: string): string[] {
  const t = Date.parse(at); if (!t) return [];
  const out: [string, number][] = [];
  for (const f of files) {
    try { const m = fs.statSync(f).mtimeMs; if (m > t) out.push([f, m]); } catch { out.push([f, Infinity]); }
  }
  return out.sort((a, b) => b[1] - a[1]).map(x => x[0]);
}

/** What to watch, as folder and glob pairs: the files every supported runtime loads in the folder, its commits (a
 * commit moves a file from just you to shared), and, when your home folder counts, what each runtime loads from it.
 * Not whole home folders: Claude Code writes its transcripts under ~/.claude every second of a session. */
export function watchList(root: string, home: boolean): { base: string; glob: string }[] {
  const w = [
    { base: root, glob: "**/{CLAUDE.md,CLAUDE.local.md,AGENTS.md,AGENTS.override.md,GEMINI.md,opencode.json,opencode.jsonc,.mcp.json,.cursorrules}" },
    { base: root, glob: "{.claude,.codex,.cursor,.gemini,.opencode,.agents,.github,.vscode}/**" },
    { base: root, glob: "skills/**" },
    { base: root, glob: ".git/{HEAD,refs/heads/**}" },
    // the agent review, when the user's agent writes it
    { base: root, glob: ".free-rein/review.json" },
  ];
  if (home) {
    const h = os.homedir();
    w.push(
      { base: path.join(h, ".claude"), glob: "{CLAUDE.md,settings.json,skills/**,agents/**,commands/**,plugins/installed_plugins.json}" },
      { base: path.join(h, ".codex"), glob: "{AGENTS.md,AGENTS.override.md,config.toml,prompts/**,skills/**}" },
      { base: path.join(h, ".gemini"), glob: "{GEMINI.md,settings.json,commands/**}" },
      { base: path.join(h, ".config", "opencode"), glob: "**" },
      { base: path.join(h, ".cursor"), glob: "{rules/**,mcp.json}" },
      { base: path.join(h, ".agents"), glob: "skills/**" },
      // the notes your agent keeps for this repo (Claude Code's auto memory)
      { base: path.join(h, ".claude", "projects", path.resolve(root).replace(/[^A-Za-z0-9]/g, "-"), "memory"), glob: "*.md" },
    );
  }
  return w;
}

/** A file the patterns above don't already cover: watched on its own (a hook's script outside the harness folders). */
export function outside(f: string, root: string, home: boolean): boolean {
  const r = path.relative(root, f);
  if (!r.startsWith("..") && !path.isAbsolute(r)) {
    const top = r.split(path.sep)[0];
    if ([".claude", ".codex", ".cursor", ".gemini", ".opencode", ".agents", ".github", ".vscode", "skills"].includes(top)) return false;
    if (/^(CLAUDE|CLAUDE\.local|AGENTS|AGENTS\.override|GEMINI)\.md$|^opencode\.jsonc?$|^\.mcp\.json$|^\.cursorrules$/.test(path.basename(f))) return false;
    return true;
  }
  if (home) { const h = path.relative(os.homedir(), f); if (!h.startsWith("..") && /^\.(claude|codex|gemini|cursor|agents)\b|^\.config[\\/]opencode\b/.test(h)) return false; }
  return true;
}

/** A change that isn't to the harness: a tool's own bookkeeping, rewritten as it works (Claude Code's sync of your
 * claude.ai skills touches a manifest every few minutes), a log, or a hidden file other than the two the runtimes
 * read. Such a change doesn't start a scan; a real edit next to it (a skill's SKILL.md) still does. */
export function noise(f: string): boolean {
  const b = path.basename(f), parts = f.split(/[\\/]/);
  if (b.startsWith(".") && b !== ".mcp.json" && b !== ".cursorrules") return true;
  if (/\.(jsonl|log)$/i.test(b)) return true;
  if (parts.some(p => p === "telemetry" || p === "logs")) return true;
  const i = parts.lastIndexOf("synced");
  return i > 0 && parts[i - 1] === "skills" && b === "manifest.json";
}

/** One scan of your files: when, what started it, how long it took, and what it found. Kept per folder, newest last,
 * for the board's list of scans and for readings over time. Only your files as they are: a draft or a what-if is
 * measured on a copy and isn't a scan. */
export interface Scan { at: string; kind: "rules" | "review"; why: string; changed: string[]; ms: number; files: number;
  xp: number; level: number; equipped: number; backed: number; exposed: number;
  /** free rein: the share of actions it does on its own; and the written rules, how many measured, how many enforced */
  free?: number; rules?: number; measured?: number; enforced?: number;
  /** an agent review: who, its findings that held up, the ones dropped, the sentences it placed and the rules among them */
  agent?: string; findings?: number; dropped?: number; placed?: number; agent_rules?: number }
export function logScan(log: Scan[], s: Scan, cap = 100): Scan[] { return [...log, s].slice(-cap); }
