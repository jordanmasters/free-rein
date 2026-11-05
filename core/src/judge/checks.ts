// How Free Rein knows: every check it makes, in plain words, with how it knows (read from a file's structure, matched
// by a pattern in prose, or recorded from a runtime's docs) and what it found in this harness. No model is involved:
// each finding comes from one of these.
import * as os from "os";
import * as path from "path";
import { ACTIONS } from "../read/statements";
import { CLASSES } from "./lint";

export type Kind = "read" | "matched" | "recorded";
export interface Hit { file: string; path: string | null; line: number | null; text?: string; matched?: string[]; note?: string }
export interface Check { id: string; name: string; looks: string; hits: number; where: Hit[]; verdict?: string; open?: string }
export interface Group { id: string; name: string; kind: Kind; about: string; items: Check[] }

// what each action's pattern looks for, in words (read/statements.ts ACTIONS has the patterns)
const LOOKS: Record<string, string> = {
  "force-push": "force push, push --force, rewrite history",
  push: "git push, or push near remote, origin, main, a branch or commits",
  commit: "commit",
  delete: "rm -r, or delete, remove or wipe near files, folders, branches or data",
  discard: "git reset --hard, or throw away or discard near changes or work",
  publish: "publish, release, npm publish",
  deploy: "deploy",
  install: "install",
  write: "write, edit, modify or overwrite, or change or update near files, notes, docs or config",
  "read-secrets": "secrets, .env, credentials, API keys, private keys, access tokens",
  run: "run, execute",
  fetch: "fetch, download, curl, wget",
  send: "send, email, post a message",
};
const CAP = 8;

/** Every check, grouped by how it knows, with what each found here. */
export function checks(o: { root: string | null; types: any[]; statements: any[]; situations: any[]; lint: Record<string, number>;
  loops: any; flows: any; record: any; rtName: string }): Group[] {
  const home = os.homedir(), root = o.root ? path.resolve(o.root) : null;
  const show = (p: string | null | undefined) => {
    if (!p) return "";
    const a = path.resolve(p);
    if (root && a.startsWith(root + path.sep)) return path.relative(root, a);
    return a.startsWith(home + path.sep) ? "~/" + path.relative(home, a) : a;
  };
  const groups: Group[] = [];

  // pieces: each has a rule for what counts as having it (model/pieces.json "detect"), over the parts read from files
  groups.push({ id: "pieces", name: "Pieces it recognises", kind: "read",
    about: "Each piece has a rule for what counts as having it: a kind of file, a setting, a hook. It reads the files' structure, not their wording.",
    items: o.types.map(t => ({ id: t.id, name: t.name, looks: t.example || t.what || "", hits: (t.inst || []).length, open: t.id,
      where: (t.inst || []).slice(0, CAP).map((x: any) => ({ file: show(x.path), path: x.path || null, line: (x.lines || [])[0] ?? null })) })) });

  // situations: risky actions played through the permission rules and the hooks that would catch them
  if (o.situations.length) groups.push({ id: "situations", name: "Risky actions it plays out", kind: "read",
    about: "Each action goes through your permission rules, in the order the runtime applies them, and the hooks that would catch it. Hooks are read, not run: what their script decides is believed, not known.",
    items: o.situations.map(s => ({ id: s.id, name: s.what, looks: `${s.tool} ${s.target}`.trim(), hits: (s.by || []).length, verdict: s.verdict, open: `sit:${s.id}`,
      where: (s.by || []).slice(0, CAP).map((b: any) => ({ file: show(b.path), path: b.path || null, line: b.line ?? null, note: `${b.what}${b.believed ? " (believed)" : ""}` })) })) });

  // rules in prose: a strength word and an action, by pattern; the words matched are kept on each rule
  const rules = o.statements.filter(s => s.kind === "rule");
  if (o.statements.length) groups.push({ id: "prose", name: "Rules in your instructions", kind: "matched",
    about: "Each sentence is matched against word patterns: how strong it is (never, always, should) and what it's about (push, delete…). A rule said in other words is missed, and a pattern can match a sentence that isn't a rule.",
    items: ACTIONS.map(([id]) => { const hit = rules.filter(s => (s.about || []).some((a: any) => a.action === id));
      return { id, name: id.replace(/-/g, " "), looks: LOOKS[id] || id, hits: hit.length,
        where: hit.slice(0, CAP).map(s => ({ file: s.source.file, path: s.path || null, line: s.source.line, text: s.text, matched: s.matched || [] })) }; }) });

  // across files: lint (judge/lint.ts), over the graph read from the files
  groups.push({ id: "lint", name: "Checks across files", kind: "read",
    about: "Checks over how the files point at each other: a path or skill that doesn't exist, writes nothing reviews, two names for one file.",
    items: Object.entries(CLASSES).map(([id, c]) => ({ id, name: c.title, looks: c.what, hits: o.lint[id] || 0, where: [] })) });

  // loops and flows: the stations each loop has, and how steps hand off (judge/loops.ts, judge/flows.ts)
  const lf = [...((o.loops || {}).findings || []).map((f: any) => ({ ...f, from: "loops" })), ...((o.flows || {}).findings || []).map((f: any) => ({ ...f, from: "flows" }))];
  if (o.loops || o.flows) groups.push({ id: "loops", name: "Loops and flows", kind: "read",
    about: "Built from the parts above: what starts each loop, what judges it, what comes back, what stops it; and the sentences that hand work from one step to the next.",
    items: lf.map((f: any, i: number) => ({ id: `${f.from}:${f.verdict || f.kind || i}`, name: f.title, looks: f.detail || "", hits: 1,
      where: f.place && f.place.path ? [{ file: show(f.place.path), path: f.place.path, line: f.place.line ?? null }] : [] })) });

  // the runtime: what it does, from its record, each claim with a source, a date and a status
  if (o.record) {
    const n: Record<string, number> = {};
    const walk = (v: any) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") { if (typeof v.status === "string" && ["confirmed", "believed", "none"].includes(v.status)) n[v.status] = (n[v.status] || 0) + 1; Object.values(v).forEach(walk); } };
    walk(o.record);
    const tot = Object.values(n).reduce((a, b) => a + b, 0);
    groups.push({ id: "runtime", name: `What ${o.rtName} does`, kind: "recorded",
      about: `From Free Rein's record of ${o.rtName} (model/runtimes): each claim has a source, the date it was checked and a status. Confirmed means its docs or code say so; believed means behaviour observed or implied.`,
      items: [{ id: "record", name: `${o.rtName}'s record`, looks: Object.entries(n).map(([k, v]) => `${v} ${k}`).join(", "), hits: tot, where: [] }] });
  }
  return groups;
}
