// free-rein check: what in a harness needs attention, as findings with a level, a place and a fix, for a person
// (text), a script (JSON) or code scanning (SARIF 2.1.0). Built from the same reading as everything else: the
// lint over the graph, the situations under the harness's own rules, what backs the rules in its prose, and
// each skill's problems.
import * as simulate from "../judge/simulate";
import { createHash } from "crypto";
import { join, relpath, abspath, realpath, isfile } from "../py";
import { lint } from "../judge/lint";
import * as runtimes from "../read/runtimes";
import { evaluate } from "../judge/evaluate";
import { loops } from "../judge/loops";
import * as oversight from "../judge/oversight";
import * as backing from "../judge/backing";
import { harness as statementsOf } from "../read/statements";
import { readMode } from "./board";

export type Level = "error" | "warning" | "note";
export const LEVELS: Level[] = ["error", "warning", "note"];

export interface Rule { id: string; title: string; what: string; why: string; fix: string; level: Level }
export interface Place { path: string; line?: number | null; endLine?: number | null }
export interface Finding { rule: string; level: Level; message: string; subject: string; place: Place | null; fix?: string | null }
export interface Report { root: string; mode: string; findings: Finding[]; rules: Rule[]; counts: Record<Level, number> }

const LINT_LEVEL: Record<string, Level> = { serious: "error", warning: "warning", info: "note" };

/** The checks Free Rein's own reading adds to the lint's: what happens in risky situations, and what the prose promises. */
const OWN: Rule[] = [
  // how it checks: loops that stop on the agent's word, check without sending back, repeat with no cap, or
  // put a person where a command would do
  { id: "loop-self-declared", level: "warning", title: "It stops when it says it's done",
    what: "Nothing checks the work before it ends: the agent decides it's finished.",
    why: "Loop on evidence, not confidence. Saying it's done is never enough.",
    fix: "Add a completion check: a Stop hook that runs the check commands and sends failures back." },
  { id: "loop-no-send-back", level: "note", title: "It checks, but doesn't send the work back",
    what: "A check reports a problem, but nothing returns the work to be fixed.",
    why: "A check only helps the agent if its result comes back as work.",
    fix: "Make the check block, or route what it finds back as tasks." },
  { id: "loop-runaway", level: "warning", title: "Runs repeat with no cap",
    what: "Long or repeated runs have no turn, spend or time limit.",
    why: "A run that never passes never ends.",
    fix: "Add a turn or spend limit." },
  { id: "loop-over-checked", level: "note", title: "You check what a command could",
    what: "A person approves the end of a task that a check command could decide.",
    why: "Your attention is the scarcest thing in the loop: keep it for what nothing below it can judge.",
    fix: "Let a Stop hook run the check commands, and keep your approval for the rest." },
  { id: "exposed", level: "warning", title: "Something risky goes ahead with nothing stopping it",
    what: "A high-stakes action (pushing, deleting, touching secrets, changing its own safeguards or what it knows) runs without asking you, and nothing of yours refuses it.",
    why: "Usually a rule of yours allows it, or nothing covers it in a mode that doesn't ask. If the agent does it by mistake, nothing catches it.",
    fix: "Add a permission rule that asks first (or refuses), or a hook that can refuse it." },
  { id: "left-to-claude-code", level: "note", title: "Claude Code's safety check decides, not a rule of yours",
    what: "In auto mode, a high-stakes action with no rule of yours is judged by Claude Code's own classifier.",
    why: "It may well stop it, but you can't see or set its rules, so the harness doesn't say what should happen.",
    fix: "Make the call yourself: a permission rule that allows, asks or refuses." },
  { id: "unbacked-rule", level: "warning", title: "A rule in your instructions that nothing enforces",
    what: "Your instructions say never, always or ask first about an action, but no permission rule, hook or approval step makes it so.",
    why: "It holds only if the model follows the instruction every time.",
    fix: "Back it with a permission rule or a hook, or reword it as guidance." },
  { id: "rule-only-asks", level: "note", title: "A never-rule that only asks",
    what: "Your instructions say never, but what holds only asks you first.",
    why: "You could still say yes by habit.",
    fix: "Refuse it outright (a deny rule or a hook), or say \"ask first\" in the instructions." },
  { id: "asks-for-everyday-work", level: "note", title: "Everyday work that asks you every time",
    what: "Routine work (editing code, running the tests) stops to ask you.",
    why: "Approving routine actions trains you to approve without reading, including the ones that matter.",
    fix: "Allow it with a narrow permission rule." },
  { id: "blocks-everyday-work", level: "note", title: "Everyday work that's refused",
    what: "A rule refuses routine work the agent needs to do.", why: "The agent works around it, or stalls.", fix: "Remove or narrow the rule." },
  { id: "skill-issue", level: "note", title: "A skill the model may misuse",
    what: "A skill has a problem in its own text: no description, no steps, a name that doesn't match its folder, or rules that contradict.",
    why: "The model picks skills by their description and follows their steps; a vague or broken one fires wrongly or does the wrong thing.",
    fix: "Fix the skill's text as the message says." },
];

const fingerprint = (...parts: string[]) => createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 32);

/** Everything in a harness that needs attention. count_home (off by default, so a check reads the same on every machine):
 * what loads from ~/.claude counts too, as on the board. */
export function check(rootIn: string, opts: { count_home?: boolean; runtime?: string } = {}): Report {
  return simulate.withHome(opts.count_home ?? false, () => checkIn(rootIn, opts));
}

function checkIn(rootIn: string, opts: { count_home?: boolean; runtime?: string }): Report {
  const root = abspath(rootIn), runtime = opts.runtime ?? "claude";
  const rel = (p: string | null | undefined): string | null => {
    if (!p) return null;
    const r = realpath(p), rr = realpath(root);
    return r === rr ? "." : r.startsWith(rr + "/") ? relpath(r, rr) : null;
  };
  const place = (p: string | null | undefined, line?: number | null, endLine?: number | null): Place | null => {
    const r = rel(p);
    return r ? { path: r, line: line ?? null, endLine: endLine ?? line ?? null } : null;
  };
  const findings: Finding[] = [];
  const rules = new Map<string, Rule>();
  // a finding in a file this runtime never loads (another runtime's folder, a plugin's own skills/) isn't about this harness for it
  const loads = (at: Place | null | undefined) => !at || at.path === "." || runtimes.visible(join(root, at.path), root, runtime);
  const add = (rule: Rule, f: Omit<Finding, "rule" | "level">) => { if (!loads(f.place)) return; rules.set(rule.id, rule); findings.push({ rule: rule.id, level: rule.level, ...f }); };

  // the lint over the graph: each finding at the file of what it's about
  const [g, lf] = lint(root);
  // where a node is: its own file, else the file of the first thing that points at it (a store a skill writes,
  // a missing target)
  const nodePlace = (id: string, seen = new Set<string>()): Place | null => {
    const n = g.nodes.get(id); const pv = (n && n.provenance) || {};
    const own = place(pv.path, (pv.lines || [])[0], (pv.lines || [])[1]);
    if (own || seen.has(id)) return own;
    seen.add(id);
    for (const e of g.edges) if (e.target === id) { const p = nodePlace(e.source, seen); if (p) return p; }
    return null;
  };
  /** the place a lint finding is about, from its subject */
  const lintPlace = (f: any): Place | null => {
    const s: string = f.subject;
    if (s.includes(" -> ")) return nodePlace(s.split(" -> ")[0]);
    if (/^[^:\s]+:\d+$/.test(s)) return place(join(root, s.split(":")[0]), Number(s.split(":")[1]));
    if (g.nodes.has(s)) return nodePlace(s);
    if (f.class === "vocabulary-mismatch") return nodePlace("substrate:" + s.split(" vs ")[0]);
    if (f.class === "emitted-unread") { const e = g.edges.find(x => x.type === "emits" && x.event === s); return e ? nodePlace(e.source) : null; }
    if (f.class === "spec-drift") return s.startsWith("patterns/") ? nodePlace("surface:pattern:" + s.slice(9).replace(/\.ya?ml$/, "")) : nodePlace("unit:" + s);
    return null;
  };
  for (const f of lf) {
    const level = LINT_LEVEL[f.severity] ?? "note";
    const id = f.class;
    const rule: Rule = { id, level, title: f.title, what: f.what, why: f.why, fix: f.remedy };
    const at = lintPlace(f);
    if (!loads(at)) continue;
    // one class can be serious in one place and informational in another (naked-write): keep the level per finding
    rules.set(id, rules.get(id) ?? rule);
    findings.push({ rule: id, level, message: `${f.title}: ${f.detail}`, subject: f.subject, place: at });
  }

  // situations, in the mode the harness is read in, with the prose's rules named as situations (as the board does)
  const a = evaluate(root, { count_home: opts.count_home ?? false, runtime });
  // how it checks: each loop that doesn't earn its stop, at its place
  { const RULE: Record<string, string> = { "self-declared": "loop-self-declared", "no-send-back": "loop-no-send-back", runaway: "loop-runaway", "over-checked": "loop-over-checked" };
    for (const lf of loops(Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i]))).findings) {
      const rule = OWN.find(r => r.id === RULE[lf.verdict]); if (!rule) continue;
      add(rule, { message: `${lf.title}: ${lf.detail}`, subject: lf.loop, place: lf.place ? place(lf.place.path, lf.place.line) : null, fix: lf.fix });
    } }
  let sts: any[] = [], stores: string[] = [];
  // your agent's notes (memory) are left out: check's output is shared, and what's in them stays on this machine
  try { sts = statementsOf(root, undefined, opts.count_home ? undefined : false).filter((s: any) => s.who !== "agent"); stores = backing.vaultDirs(root); } catch { sts = []; }
  oversight.resetCaches();
  oversight.SAID.splice(0, oversight.SAID.length, ...backing.saidSituations(sts, stores));
  let ov: any;
  try { ov = oversight.both(root, a, runtime); } finally { oversight.SAID.length = 0; }
  const mode = readMode(ov);
  const sits: any[] = ov.by_mode[mode].situations;
  const R = Object.fromEntries(OWN.map(r => [r.id, r]));
  const settings = join(root, ".claude", "settings.json");
  for (const s of sits) {
    const by = (s.by || []).find((b: any) => b.path && rel(b.path));
    const where = by ? place(by.path, by.line) : isfile(settings) ? place(settings, 1) : null;
    const fix = s.fix ? [s.fix.rule ? `${s.fix.how === "allow" ? "allow" : s.fix.how === "deny" ? "refuse" : s.fix.how === "remove" ? "remove" : "ask first"}: ${s.fix.rule}` : null,
      s.fix.piece_name ? `or add ${s.fix.piece_name}` : null].filter(Boolean).join(" ") || null : null;
    const rule = s.verdict === "exposed" ? R.exposed : s.verdict === "classifier" ? R["left-to-claude-code"]
      : s.verdict === "babysitting" ? R["asks-for-everyday-work"] : s.verdict === "blocked" ? R["blocks-everyday-work"] : null;
    if (!rule) continue;
    add(rule, { message: `${s.what}: ${s.says}${fix ? ` (${fix})` : ""}`, subject: s.id, place: where, fix });
  }

  // the prose's rules, and what backs them
  for (const b of backing.back(sts, ov.by_mode.auto.situations, stores)) {
    const rule = b.backed === false ? R["unbacked-rule"] : b.backed === "partly" ? R["rule-only-asks"] : null;
    if (!rule) continue;
    add(rule, { message: `"${b.text}": ${b.why}`, subject: b.statement, place: place(join(root, b.source.file), b.source.line) });
  }

  // each skill's problems in its own text
  const skills = a.slots.flatMap((s: any) => s.items).find((i: any) => i.id === "skills");
  for (const it of (skills && skills.profile && skills.profile.items) || [])
    for (const issue of it.issues) add(R["skill-issue"], { message: `/${it.name}: ${issue}`, subject: `skill:${it.name}`, place: place(it.path, 1) });

  // a finding about the harness as a whole (no rule of yours covers it, say) is shown at its main file, so code
  // scanning can place it: its settings, else its instructions
  const main = [join(root, ".claude", "settings.json"), join(root, "CLAUDE.md"), join(root, "AGENTS.md"), join(root, ".github", "copilot-instructions.md"),
    join(root, "GEMINI.md")].find(isfile);
  if (main) for (const f of findings) if (!f.place) f.place = place(main, 1);
  const order = (l: Level) => LEVELS.indexOf(l);
  findings.sort((x, y) => order(x.level) - order(y.level) || (x.rule < y.rule ? -1 : x.rule > y.rule ? 1 : 0));
  const counts = { error: 0, warning: 0, note: 0 } as Record<Level, number>;
  for (const f of findings) counts[f.level]++;
  return { root, mode, findings, rules: [...rules.values()].sort((x, y) => (x.id < y.id ? -1 : 1)), counts };
}

/** Whether a report fails at this level: any finding at it or more serious. "none" never fails. */
export const fails = (r: Report, failOn: Level | "none") => failOn !== "none" && r.findings.some(f => LEVELS.indexOf(f.level) <= LEVELS.indexOf(failOn));

/** The report for a person: most serious first, each with where it is and what to do. */
export function text(r: Report): string {
  const out: string[] = [];
  const name = (l: Level) => ({ error: "Errors", warning: "Warnings", note: "Notes" })[l];
  for (const l of LEVELS) {
    const fs_ = r.findings.filter(f => f.level === l);
    if (!fs_.length) continue;
    out.push(`${name(l)} (${fs_.length})`);
    for (const f of fs_) out.push(`  ${f.place ? `${f.place.path}${f.place.line ? `:${f.place.line}` : ""}  ` : ""}${f.message}`);
    out.push("");
  }
  out.push(r.findings.length ? `${r.counts.error} errors, ${r.counts.warning} warnings, ${r.counts.note} notes (read in ${r.mode} mode)` : "Nothing to report.");
  return out.join("\n") + "\n";
}

/** The report as SARIF 2.1.0, the format code scanning reads (GitHub's among others). Paths are relative to the
 * harness, so no file outside it, and nothing about this machine, is sent. */
export function sarif(r: Report, version: string): any {
  const index = new Map(r.rules.map((x, i) => [x.id, i]));
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "Free Rein", version, semanticVersion: version,
        rules: r.rules.map(x => ({ id: x.id, name: x.id.replace(/(^|-)(\w)/g, (_m, _d, c) => c.toUpperCase()), shortDescription: { text: x.title },
          fullDescription: { text: x.what }, help: { text: `${x.why} ${x.fix}`.trim(), markdown: `${x.what}\n\n**Why it matters:** ${x.why}\n\n**What to do:** ${x.fix}` },
          defaultConfiguration: { level: x.level } })) } },
      originalUriBaseIds: { SRCROOT: { description: { text: "The harness that was checked" } } },
      results: r.findings.map(f => ({
        ruleId: f.rule, ruleIndex: index.get(f.rule), level: f.level, message: { text: f.message },
        ...(f.place ? { locations: [{ physicalLocation: { artifactLocation: { uri: f.place.path, uriBaseId: "SRCROOT" },
          ...(f.place.line ? { region: { startLine: f.place.line, ...(f.place.endLine && f.place.endLine >= f.place.line ? { endLine: f.place.endLine } : {}) } } : {}) } }] } : {}),
        partialFingerprints: { freeReinFinding: fingerprint(f.rule, f.subject, f.message) },
      })),
      properties: { mode: r.mode },
    }],
  };
}

