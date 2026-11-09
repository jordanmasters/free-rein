// Context: everything the agent reads (instructions, skills, its own notes), when each enters its context, where each
// applies, who wrote it, and what it says, sentence by sentence (read/statements.ts). The board's Context view draws it.
// When each loads comes from the runtime's record (model/runtimes/<id>.json, layers.loads): a runtime without one says
// so. Sizes are estimates: characters / 4, the usual rough measure of tokens.
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { where } from "../judge/progress";
import { repoDir } from "../read/spec";
import { tracked, ignored } from "../read/git";
import { memory } from "../read/memory";
import { re, S, M } from "../py";

export type Moment = "start" | "folder" | "use" | "demand" | "hook";
export interface WordsFile {
  /** the file, as a person reads it: relative to the harness, or from ~ */
  file: string;
  path: string;
  /** org, local (this repo, just you), project (this repo, shared), user (you, every repo) */
  layer: string;
  who: "you" | "package" | "agent";
  pkg: string | null;
  /** the piece it gives (pieces.json) */
  piece: string | null;
  /** when it enters the context; a skill is split into its description (start) and body (use) */
  parts: { when: Moment; tokens: number; lines: number }[];
  /** sentences by kind, and its rules by what backs them */
  kinds: Record<string, number>;
  rules: { enforced: number; asks: number; only_said: number; unmeasured: number };
  /** each sentence: line, kind, strength, whether a rule is enforced, its text (cut short) */
  sentences: { id: string; line: number; kind: string; agent?: { kind: string; strength: string | null }; strength?: string | null; backed?: boolean | "partly" | null; text: string; from?: string }[];
  /** a memory note: its type, date and what's off with it */
  note?: { type: string | null; modified: string | null; index: boolean; findings: string[] };
}
export interface Words {
  runtime: string;
  /** false when the runtime's record doesn't say when each kind loads: the moments are then Claude Code's, marked */
  recorded: boolean;
  files: WordsFile[];
  /** injected context: hooks that add text as a session runs; what they add can't be read without running them */
  hooks: { label: string; path: string | null; layer: string }[];
  totals: { files: number; start_tokens: number; tokens: number; sentences: number; unclassified: number; rules: number; enforced: number;
    asks: number; only_said: number; agent_notes: number; agent_rules: number;
    /** of the unclassified sentences, how many your agent's reading placed, and how many of those are rules */
    agent_placed?: number; agent_found_rules?: number };
}

const tokens = (s: string) => Math.ceil(s.length / 4);
const FRONT = re("\\A---\\s*\\n(.*?)\\n---\\s*\\n", S);
const OLD_DAYS = 60;

function read(p: string): string { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }

/** When a file's text loads, from its piece and place (Claude Code's model, layers.loads in its record). */
function partsOf(abs: string, piece: string | null, text: string, note: any): WordsFile["parts"] {
  const lines = text.split("\n").length, all = tokens(text);
  if (note) {
    if (!note.index) return [{ when: "demand", tokens: all, lines }];
    // the index: its first lines load at the start, the rest never does
    const keep = text.split("\n").slice(0, note.start_lines ?? lines).join("\n");
    return [{ when: "start", tokens: tokens(keep), lines: note.start_lines ?? lines }];
  }
  const fm = FRONT.match(text), front = fm ? fm.group(1)! : "";
  if (/SKILL\.md$/.test(abs)) {
    const desc = (re("^description:\\s*(.+)$", M).search(front)?.group(1) || "") + " " + (re("^when_to_use:\\s*(.+)$", M).search(front)?.group(1) || "");
    const body = fm ? text.slice(fm.end) : text;
    const bodyPart = { when: "use" as Moment, tokens: tokens(body), lines: body.split("\n").length };
    // with disable-model-invocation, no description is in context: it loads only when you use it
    if (/^disable-model-invocation:\s*true/m.test(front)) return [bodyPart];
    return [{ when: "start", tokens: tokens(desc.trim().slice(0, 1536)), lines: 1 }, bodyPart];
  }
  if (piece === "folder-instructions") {
    // a rules file without paths loads at the start; one with paths, and a subfolder's CLAUDE.md, once it works there
    const atStart = /\/\.claude\/rules\//.test(abs) && !/^paths:/m.test(front);
    return [{ when: atStart ? "start" : "folder", tokens: all, lines }];
  }
  if (piece === "proj-instructions" || piece === "personal-instructions") return [{ when: "start", tokens: all, lines }];
  // the rest (a protocol a skill reads, a command, an agent's prompt) loads when something uses it
  return [{ when: piece === "contracts" ? "demand" : "use", tokens: all, lines }];
}

/** The Words block: every file of prose the board read, with its sentences and their backing. */
export function words(o: { root: string; runtime: string; rtRecord: any; sts: any[]; backing: any[]; hooks: any[] }): Words {
  const root = path.resolve(o.root), home = os.homedir();
  const bk = new Map(o.backing.map((b: any) => [b.statement, b]));
  const git = tracked(root), ign = git ? ignored(root) : null;
  const mem = memory(root, o.runtime === "codex" ? "codex" : "claude");
  const notes = new Map((mem ? mem.notes : []).map(n => [path.resolve(n.path), n]));
  const abs = (f: string) => f.startsWith("~/") ? path.join(home, f.slice(2)) : path.resolve(root, f);
  const byFile = new Map<string, any[]>();
  for (const s of o.sts) { const f = s.source.file; (byFile.get(f) || byFile.set(f, []).get(f)!).push(s); }
  const files: WordsFile[] = [];
  for (const [f, sts] of byFile) {
    const p = abs(f), note = notes.get(p), text = read(p);
    let [scope, pkg] = where(p, root, repoDir());
    // a file in the repo that git ignores is only yours, as in the layers (report/stack.ts)
    if (scope === "project" && ign && p.startsWith(root + path.sep)) { const r = path.relative(root, p).split(path.sep).join("/"); if (!git!.has(r) && ign(r)) scope = "local"; }
    const kinds: Record<string, number> = {}, rules = { enforced: 0, asks: 0, only_said: 0, unmeasured: 0 };
    const sentences: WordsFile["sentences"] = [];
    for (const s of sts) {
      kinds[s.kind] = (kinds[s.kind] || 0) + 1;
      const b: any = s.kind === "rule" ? bk.get(s.id) : null, backed = b ? b.backed : null;
      if (s.kind === "rule") { if (backed === true) rules.enforced++; else if (backed === "partly") rules.asks++; else if (backed === false) rules.only_said++; else rules.unmeasured++; }
      sentences.push({ id: s.id, line: s.source.line, kind: s.kind, ...(s.strength ? { strength: s.strength } : {}), ...(s.kind === "rule" ? { backed } : {}),
        text: s.text.slice(0, 200), ...(s.from ? { from: s.from } : {}) });
    }
    const piece = note ? "saved-facts" : sts[0].piece ?? null;
    const w: WordsFile = { file: f, path: p, layer: note ? "local" : (scope === "org" ? "org" : scope || "project"), who: note ? "agent" : pkg ? "package" : "you", pkg: note ? null : pkg,
      piece, parts: partsOf(p, piece, text, note), kinds, rules, sentences };
    if (note) {
      const fs_: string[] = [];
      // a file it names that's gone: only where its folder is still in the repo (a note also names files elsewhere, and
      // the notes beside it)
      const gone = note.names.filter(n => !/^~|^\/|^\.\.?\//.test(n) && !/[*<{]/.test(n) && n.includes("/") && fs.existsSync(path.resolve(root, n.split("/")[0]))
        && !fs.existsSync(path.resolve(root, n)) && !fs.existsSync(path.resolve(path.dirname(p), n)));
      if (gone.length) fs_.push(`names ${gone.slice(0, 3).join(", ")}, which ${gone.length === 1 ? "isn't" : "aren't"} in this repo now`);
      if (note.modified) { const days = Math.floor((Date.now() - Date.parse(note.modified)) / 86400000); if (days > OLD_DAYS) fs_.push(`last changed ${days} days ago`); }
      w.note = { type: note.type, modified: note.modified, index: note.index, findings: fs_ };
    }
    files.push(w);
  }
  const order: Record<string, number> = { org: 0, user: 1, project: 2, local: 3 };
  files.sort((a, b) => (order[a.layer] ?? 9) - (order[b.layer] ?? 9) || a.file.localeCompare(b.file));
  const hooks = (o.hooks || []).map((h: any) => ({ label: h.label, path: h.path ?? null, layer: h.scope === "user" ? "user" : h.scope === "local" ? "local" : "project" }));
  const sum = (f: (x: WordsFile) => number) => files.reduce((n, x) => n + f(x), 0);
  const nSent = sum(x => x.sentences.length), agent = files.filter(x => x.who === "agent");
  return {
    runtime: o.runtime, recorded: !!(o.rtRecord && o.rtRecord.layers && o.rtRecord.layers.loads && o.rtRecord.layers.loads.instructions),
    files, hooks,
    totals: { files: files.length, start_tokens: sum(x => x.parts.filter(p => p.when === "start").reduce((n, p) => n + p.tokens, 0)), tokens: sum(x => x.parts.reduce((n, p) => n + p.tokens, 0)),
      sentences: nSent, unclassified: sum(x => x.kinds.residual || 0), rules: sum(x => x.kinds.rule || 0), enforced: sum(x => x.rules.enforced), asks: sum(x => x.rules.asks),
      only_said: sum(x => x.rules.only_said), agent_notes: agent.length, agent_rules: agent.reduce((n, x) => n + (x.kinds.rule || 0), 0) },
  };
}

/** Your agent's reading (the review's sentences) laid over the patterns': each sentence it placed gets its kind, kept
 *  apart (agent), so the board shows it as your agent's and it never counts toward verdicts. */
export function withReading(w: Words | null, read: { id: string; kind: string; strength: string | null }[] | null | undefined): Words | null {
  if (!w || !read || !read.length) return w;
  const by = new Map(read.map(r => [r.id, r]));
  let placed = 0, rules = 0;
  for (const f of w.files) for (const s of f.sentences) { const r = by.get(s.id); if (r && s.kind === "residual") { s.agent = { kind: r.kind, strength: r.strength }; placed++; if (r.kind === "rule") rules++; } }
  w.totals.agent_placed = placed; w.totals.agent_found_rules = rules;
  return w;
}
