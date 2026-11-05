// The agent review: a deeper read of a harness by the user's own agent, for what Free Rein's rules can't check (a rule
// said in other words, files that contradict each other, what a hook's script decides, vague skills, instructions out
// of date with the code, what a skill relies on and never says). Free Rein runs no model and sends nothing: it writes
// the brief, the user's agent does the reading and writes .free-rein/review.json, and Free Rein reads that file back,
// keeping only findings whose quote is really at the line they cite, and never one that quotes a sensitive file.
// Sensitive files are named, never opened: the brief tells the agent they exist, and that it mustn't read them.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { tracked } from "../read/git";

export const REVIEW_DIR = ".free-rein", REVIEW_FILE = "review.json", BRIEF_FILE = "review-brief.md";
export const KINDS = ["paraphrased-rule", "contradiction", "hook-behaviour", "vague-skill", "stale-instruction", "unstated-dependency", "other"] as const;
export interface Quote { file: string; line: number; quote: string; path?: string }
export interface ReviewFinding extends Quote { kind: string; title: string; detail: string; severity: "high" | "medium" | "low"; fix: string; also: Quote[];
  /** where the quote really is, when the agent cited a nearby line */
  found_line: number }
export interface Review { at: string; agent: string; model: string; findings: ReviewFinding[]; dropped: { title: string; reason: string }[];
  /** files the review cited that changed since it was written */
  changed_since: string[] }

// names that hold secrets: checked for, never read
const SENSITIVE = /^\.env(\..+)?$|\.(pem|key|p12|pfx|keystore|jks)$|^id_(rsa|ed25519|ecdsa|dsa)$|^credentials(\.json)?$|^secrets?\.(json|ya?ml|toml)$|^\.npmrc$|^\.netrc$|^\.pypirc$|service-account.*\.json$/i;
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "vendor", ".venv", "venv", "__pycache__", ".cache"]);
/** The sensitive files in a folder, by name (four levels down, the usual build folders skipped): whether git tracks each. */
export function sensitiveFiles(root: string): { file: string; tracked: boolean }[] {
  const out: { file: string; tracked: boolean }[] = [], git = tracked(root);
  const walk = (dir: string, depth: number) => {
    if (depth > 4 || out.length > 60) return;
    let es: fs.Dirent[]; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), depth + 1); continue; }
      if (SENSITIVE.test(e.name) && !/\.example$|\.sample$|\.template$/i.test(e.name)) {
        const rel = path.relative(root, path.join(dir, e.name)).split(path.sep).join("/");
        out.push({ file: rel, tracked: !!git && git.has(rel) });
      }
    }
  };
  walk(path.resolve(root), 0);
  return out;
}
const isSensitive = (f: string) => SENSITIVE.test(path.basename(f));

/** The brief the agent works from: what Free Rein's rules found, what they couldn't check, the files to read, the
 * sensitive files it mustn't open, and the exact shape of the file to write. b is the board's data for the folder. */
export function reviewBrief(root: string, b: any): string {
  const F = b.free_rein || null, R = F ? F.rules : null, sens = sensitiveFiles(root);
  const rel = (p: string) => { const a = path.resolve(p), r = path.resolve(root); return a.startsWith(r + path.sep) ? path.relative(r, a) : a.startsWith(os.homedir() + path.sep) ? "~/" + path.relative(os.homedir(), a) : a; };
  const prose = new Set<string>(), hooks = new Set<string>();
  for (const s of b.slots || []) for (const t of s.types || []) for (const x of [...(t.inst || []), ...(t.extra || [])]) {
    if (!x || typeof x.path !== "string") continue;
    if (/\.md$/i.test(x.path) && ["proj-instructions", "personal-instructions", "folder-instructions", "skills", "subagents", "commands", "contracts", "modes"].includes(t.id)) prose.add(rel(x.path));
    if (["hard-gate", "completion-check", "live-injection", "auto-fix"].includes(t.id) && !/\.json$/i.test(x.path)) hooks.add(rel(x.path));
  }
  const untested = F ? F.all.filter((r: any) => r.status === "untested").slice(0, 40) : [];
  const L: string[] = [];
  L.push(`# Free Rein agent review: ${b.name}`, "",
    "You are reviewing this repo's agent harness (the instructions, skills, agents, commands and hooks an AI coding agent loads) for what rule-based checks miss. Free Rein has already read it with its own checks; you are the second look. Read, don't change anything: the only file you write is the review.", "",
    "## Never read these files", "",
    sens.length ? "These hold secrets. Don't open, print, grep or summarise them. You may say that they exist and whether git tracks them (given here):\n\n" + sens.map(s => `- \`${s.file}\`${s.tracked ? " (tracked by git)" : " (not tracked by git)"}`).join("\n")
      : "Free Rein found no files that look like secrets. If you meet one (.env, a key, credentials), don't open it.", "",
    "## What Free Rein's own checks found", "",
    F ? `- It does ${F.pct}% of the ${F.actions} actions Free Rein tests on its own; ${F.exposed} high-stakes actions have nothing in the way.\n- ${R.written} written rules: ${R.measured} about an action Free Rein tests (${R.enforced} enforced, ${R.only_asked} only asked), ${R.untested} that name an action it can't test yet, ${R.not_action} that aren't about an action.`
      : "- (no free-rein summary for this harness)", "",
    "## What to look for", "",
    "1. **paraphrased-rule**: a rule about a risky action said in words a pattern would miss (\"don't ship straight to the trunk\"). Say which action, and whether anything in the settings or hooks enforces it.",
    "2. **contradiction**: two files that tell the agent different things (CLAUDE.md against a skill, two skills against each other). Cite both.",
    "3. **hook-behaviour**: what a hook's script actually decides: what it refuses, what it lets through, how it can be bypassed. Read the script.",
    "4. **vague-skill**: a skill whose instructions an agent couldn't follow the same way twice (no clear trigger, no clear end, steps that depend on unstated judgment).",
    "5. **stale-instruction**: instructions that no longer match the code (a command, path or script that isn't there, a convention the code doesn't follow).",
    "6. **unstated-dependency**: something a skill or agent relies on and never says (a tool, an environment variable, a folder, another skill).",
    "", "Report only what you can quote. Prefer a few solid findings over many weak ones; ten is plenty.", "",
    "## Files to read", "", ...[...prose].sort().slice(0, 120).map(f => `- \`${f}\``), ...(hooks.size ? ["", "Hook scripts:", "", ...[...hooks].sort().map(f => `- \`${f}\``)] : []),
    ...(untested.length ? ["", "## Rules Free Rein couldn't test", "", "These name an action but Free Rein has no situation for them. Say, where you can, whether anything enforces them:", "",
      ...untested.map((r: any) => `- \`${r.file}:${r.line}\`: ${String(r.text).replace(/\s+/g, " ").slice(0, 160)}`)] : []),
    "", "## Write your review", "",
    `Write one file, \`${REVIEW_DIR}/${REVIEW_FILE}\`, in this repo, and nothing else. Its shape:`, "",
    "```json", JSON.stringify({ version: 1, at: "<now, ISO 8601>", agent: "<your product, e.g. Claude Code>", model: "<the model you are>",
      findings: [{ kind: KINDS.join("|"), title: "<one line>", detail: "<two or three sentences: what, and why it matters>", severity: "high|medium|low",
        file: "<path as given above>", line: 12, quote: "<the exact text on that line, copied, at least 12 characters>",
        also: [{ file: "<for a contradiction: the other file>", line: 30, quote: "<exact text>" }], fix: "<one sentence: what would settle it>" }] }, null, 2), "```", "",
    "Free Rein checks every quote against the file and line you cite and drops any that isn't there, and any that quotes a sensitive file. Copy quotes exactly.",
    "When you've written the file, say so in one line. Free Rein's board picks it up by itself.");
  return L.join("\n");
}

const norm = (s: string) => s.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
/** The agent's review, if there is one: findings whose quotes check out, the rest dropped with a reason. */
export function readReview(root: string | null): Review | null {
  if (!root) return null;
  const p = path.join(root, REVIEW_DIR, REVIEW_FILE);
  let raw: any;
  try { raw = JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fs.existsSync(p) ? { at: "", agent: "", model: "", findings: [], dropped: [{ title: "review.json", reason: "it isn't valid JSON" }], changed_since: [] } : null; }
  if (!raw || typeof raw !== "object") return null;
  const resolve = (f: string) => !f ? null : f.startsWith("~/") ? path.join(os.homedir(), f.slice(2)) : path.isAbsolute(f) ? f : path.join(root, f);
  const lines = new Map<string, string[] | null>();
  const load = (f: string) => { if (!lines.has(f)) { try { lines.set(f, fs.readFileSync(f, "utf8").split(/\r?\n/)); } catch { lines.set(f, null); } } return lines.get(f)!; };
  // the line a quote is really on: the cited one, a near one, or anywhere in the file; 0 when it isn't there
  const locate = (q: Quote): number => {
    const f = resolve(q.file); if (!f) return 0; const ls = load(f); if (!ls) return 0;
    const want = norm(String(q.quote || "")); if (want.length < 12) return 0;
    const at = (i: number) => i >= 0 && i < ls.length && norm(ls.slice(i, i + 3).join(" ")).includes(want);
    const l = Math.max(1, Number(q.line) || 1) - 1;
    for (const d of [0, -1, 1, -2, 2, -3, 3]) if (at(l + d)) return l + d + 1;
    for (let i = 0; i < ls.length; i++) if (at(i)) return i + 1;
    return 0;
  };
  const findings: ReviewFinding[] = [], dropped: Review["dropped"] = [], cited = new Set<string>();
  for (const x of Array.isArray(raw.findings) ? raw.findings.slice(0, 50) : []) {
    const title = String((x && x.title) || "untitled").slice(0, 200);
    if (!x || typeof x.file !== "string" || typeof x.quote !== "string") { dropped.push({ title, reason: "no file or quote" }); continue; }
    const qs: Quote[] = [{ file: x.file, line: x.line, quote: x.quote }, ...(Array.isArray(x.also) ? x.also.filter((a: any) => a && typeof a.file === "string" && typeof a.quote === "string") : [])];
    if (qs.some(q => isSensitive(q.file))) { dropped.push({ title, reason: "it quotes a sensitive file" }); continue; }
    const found = qs.map(locate);
    if (found.some(n => !n)) { dropped.push({ title, reason: "a quote isn't in the file it cites" }); continue; }
    qs.forEach(q => cited.add(resolve(q.file)!));
    findings.push({ path: resolve(x.file)!, kind: KINDS.includes(x.kind) ? x.kind : "other", title, detail: String(x.detail || "").slice(0, 800), severity: ["high", "medium", "low"].includes(x.severity) ? x.severity : "medium",
      file: x.file, line: Number(x.line) || found[0], quote: String(x.quote).slice(0, 400), found_line: found[0], fix: String(x.fix || "").slice(0, 400),
      also: qs.slice(1).map((q, i) => ({ file: q.file, path: resolve(q.file)!, line: found[i + 1], quote: String(q.quote).slice(0, 400) })) });
  }
  const at = typeof raw.at === "string" && Date.parse(raw.at) ? raw.at : (() => { try { return fs.statSync(p).mtime.toISOString(); } catch { return ""; } })();
  const t = Date.parse(at) || 0;
  const changed = [...cited].filter(f => { try { return fs.statSync(f).mtimeMs > t + 1000; } catch { return true; } })
    .map(f => f.startsWith(path.resolve(root) + path.sep) ? path.relative(root, f) : f.replace(os.homedir(), "~"));
  return { at, agent: String(raw.agent || "your agent").slice(0, 60), model: String(raw.model || "").slice(0, 80), findings, dropped, changed_since: changed };
}
