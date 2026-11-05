// Which files each runtime reads (from each runtime's own docs; sources in model/runtimes/<id>.json).
// First written in Python (retired 2026-10-11).
import { abspath, relpath, join, dirname, exists, fnmatch, sorted } from "../py";

import { home as HOME } from "./home";

/** patterns: relative to the repo, or ~/ for your home folder; "*" crosses folders; "?" at the end: conditional */
export const READS: Record<string, string[]> = {
  // a top-level skills/ is a plugin's: Claude Code loads it once the plugin is installed, not in the repo itself
  claude: ["CLAUDE.md", "*/CLAUDE.md", "CLAUDE.local.md", ".claude/*", "~/.claude/*", ".mcp.json", "hooks/*", "AGENTS.md?"],
  codex: ["AGENTS.md", "*/AGENTS.md", "~/.codex/*", ".codex/*", ".agents/*", "~/.agents/*"],
  cursor: [".cursor/*", "~/.cursor/*", "AGENTS.md", "*/AGENTS.md", ".agents/*", ".claude/skills/*", ".claude/agents/*", ".codex/skills/*", ".codex/agents/*",
    "CLAUDE.md", "*/CLAUDE.md", "~/.claude/CLAUDE.md", "~/.claude/skills/*", "~/.codex/skills/*", "~/.agents/skills/*"],
  gemini: ["GEMINI.md", "*/GEMINI.md", ".gemini/*", "~/.gemini/*"],
  opencode: ["AGENTS.md", "*/AGENTS.md", "~/.config/opencode/*", ".opencode/*", "opencode.json", ".claude/skills/*", ".agents/*", "CLAUDE.md?", "~/.claude/CLAUDE.md?"],
  copilot: [".github/copilot-instructions.md", ".github/instructions/*", ".github/skills/*", ".github/agents/*", ".github/hooks/*", ".claude/skills/*",
    ".claude/agents/*", ".claude/rules/*", ".agents/*", "AGENTS.md", "*/AGENTS.md", ".vscode/mcp.json", ".mcp.json", "~/.copilot/*", "~/.claude/skills/*", "~/.agents/*",
    "CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md", "~/.claude/CLAUDE.md", ".github/prompts/*"],
  "copilot-cloud": [".github/copilot-instructions.md", ".github/instructions/*", ".github/skills/*", ".github/agents/*", ".github/hooks/*",
    ".github/workflows/copilot-setup-steps.yml", "AGENTS.md", "*/AGENTS.md", "CLAUDE.md", "*/CLAUDE.md", "GEMINI.md", "*/GEMINI.md"],
  "copilot-cli": [".github/copilot-instructions.md", ".github/instructions/*", ".github/skills/*", ".github/agents/*", ".github/hooks/*", ".github/copilot/*",
    ".github/mcp.json", ".mcp.json", "AGENTS.md", "CLAUDE.md", "GEMINI.md", ".claude/rules/*", ".claude/skills/*", ".claude/commands/*", ".claude/agents/*",
    ".agents/*", "~/.copilot/*", "~/.agents/skills/*"],
};
/** Claude Code hook events another runtime runs, and from which of Claude Code's settings files; it ignores the rest of them.
 *  UserPromptSubmit runs in Cursor and Copilot CLI too, but there it can't add context. */
export const CLAUDE_HOOKS: Record<string, { events: string[]; from: string[] }> = {
  cursor: { events: ["PreToolUse", "PostToolUse", "Stop", "SubagentStop", "SessionStart", "SessionEnd", "PreCompact"],
    from: [".claude/settings.json", ".claude/settings.local.json", "~/.claude/settings.json"] },
  "copilot-cli": { events: ["PreToolUse", "PostToolUse", "Stop", "SubagentStop", "SessionStart", "SessionEnd", "PreCompact"],
    from: [".claude/settings.json", ".claude/settings.local.json"] },
};
/** The skill folders in your home folder each runtime loads, relative to home (the repo's are read for every runtime). */
export const HOME_SKILLS: Record<string, string[]> = {
  claude: [".claude/skills"],
  cursor: [".cursor/skills", ".agents/skills", ".claude/skills", ".codex/skills"],
  "copilot-cli": [".copilot/skills", ".agents/skills"],
};
/** What a runtime that loads CLAUDE.md still doesn't do with it: Cursor reads an @path as a pointer, never inlining it,
 *  VS Code's agent references files by Markdown links, and nothing says any of them follows "Compact instructions". */
export const IGNORES_IN_CLAUDE_MD: Record<string, string[]> = {
  cursor: ["sig:folder-instructions:imports", "sig:compaction:claude-md"],
  copilot: ["sig:folder-instructions:imports", "sig:compaction:claude-md"],
  "copilot-cli": ["sig:compaction:claude-md"],
  omp: ["sig:compaction:claude-md"],
  pi: ["sig:folder-instructions:imports", "sig:compaction:claude-md"],
};
const CORE: Record<string, string> = { "copilot-cloud": "copilot", "copilot-cli": "copilot" };
export const coreOf = (runtime: string) => CORE[runtime] ?? runtime;

/** The runtimes Free Rein supports: offered in the runtime picker and the CLI, documented, tested and kept up to date.
 *  The other records stay in model/runtimes/ (and the core can still read with them), unoffered, until one is added here. */
export const SUPPORTED = ["claude", "codex", "cursor", "copilot", "gemini", "opencode"];
export const supported = (runtime: string) => SUPPORTED.includes(runtime);
// a plugin's own folder (skills/) is known too: no runtime loads it from the repo, only once the plugin is installed
const SPECIFIC = sorted(new Set([...Object.values(READS).flat().map(p => p.replace(/\?+$/, "")), "AGENTS.md", "AGENT.md", "GEMINI.md", "skills/*"]));

function key(path: string, root: string | null): string | null {
  const real = abspath(path), r = root ? abspath(root) : null, home = HOME();
  if (r && (real === r || real.startsWith(r + "/"))) return relpath(real, r);
  if (real.startsWith(home + "/")) return "~/" + relpath(real, home);
  return null;
}
const match = (k: string, p: string) => fnmatch(k, p) || (p.endsWith("/*") && k === p.slice(0, -2));

/** Does this runtime run a hook for this event registered in this Claude Code settings file? */
export function runsClaudeHook(runtime: string, settings: string | null | undefined, event: string, root: string | null): boolean {
  const rule = CLAUDE_HOOKS[runtime], k = settings ? key(settings, root) : null;
  return !!rule && k !== null && rule.from.includes(k) && rule.events.includes(event);
}

/** Does this runtime load this file? Missing paths and shared files: yes. */
export function visible(path: string | null | undefined, root: string | null, runtime: string): boolean {
  if (!runtime || runtime === "open" || !(runtime in READS) || !path) return true;
  const k = key(path, root);
  if (k === null || !SPECIFIC.some(p => match(k, p))) return true;
  const home = HOME();
  for (let p of READS[runtime]) {
    const cond = p.endsWith("?");
    p = p.replace(/\?+$/, "");
    if (!match(k, p)) continue;
    if (!cond) return true;
    const base = dirname(!k.startsWith("~/") ? join(root || home, k.replace("~/", "")) : join(home, k.slice(2)));
    if (runtime === "claude") return !exists(join(base, "CLAUDE.md"));
    if (runtime === "opencode") return !exists(join(!k.startsWith("~/") ? base : join(home, ".config", "opencode"), "AGENTS.md"));
  }
  return false;
}
