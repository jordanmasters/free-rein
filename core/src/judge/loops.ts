// How it checks: the loops in a harness, at four speeds. Each is the same cycle: try, check, send back or stop,
// with a cap. Read from the pieces as they stand (the completion check, check commands, checkers, criteria, long runs,
// limits, evals, feedback, auto-fix), so it needs nothing new from the reader. The rule it applies: loop on evidence,
// not confidence; the agent saying it's done is never enough.

// who judges: a shape check, a command, a model acting as judge, a person, or the environment (what the tools return)
export type Who = "shape" | "command" | "model" | "person" | "agent" | "environment";
/** What a loop wraps, each inside the next: one action, one step, a whole route, the harness over time. */
export type Scope = "action" | "step" | "route" | "harness";
export type Verdict = "earned" | "self-declared" | "no-send-back" | "runaway" | "over-checked" | "none";
export interface Place { path: string; line: number | null }
export type Check = { who: Who; blocks: boolean; what: string };
/** One place the loop really runs: each station filled by something in the harness, and the steps it covers
 *  ("all" when it covers every task, like a done check on stopping). */
export interface Instance {
  id: string; name: string; check: Check | null; sends_back: string | null; stop: "evidence" | "approval" | "say-so" | "with the edit" | null;
  cap: string | null; verdict: Verdict; steps: string[]; all: boolean; reads_only: boolean; place: Place | null;
  /** what it wraps; a loop across steps (a step that sends work back to an earlier one) names the two in pair */
  scope: Scope; pair: [string, string] | null; runtime: boolean;
  /** what starts it: each tool call, the agent stopping, a CI run, running the evals */
  trigger: string;
}
export interface Loop {
  id: string; speed: "edit" | "task" | "run" | "time"; scope: Scope; name: string; present: boolean;
  check: Check | null; sends_back: string | null; stop: Instance["stop"];
  cap: string | null; verdict: Verdict; pieces: string[]; from: string[]; place: Place | null; says: string; instances: Instance[];
}
/** The steps of How work flows that a per-task loop can cover (judge/flows.ts). */
export interface FlowSteps { steps: { id: string; name: string; gate: string | null; writes: string[]; place: Place | null }[]; handoffs: { from: string; to: string; back?: boolean; text?: string; place?: Place | null }[] }
export interface LoopFinding { loop: string; verdict: Verdict; title: string; detail: string; fix: string; upgrade: string | null; draft: boolean; place: Place | null }

export const VERDICTS: Record<Verdict, string> = {
  earned: "Earned stop", "self-declared": "Self-declared", "no-send-back": "Checks, doesn't send back", runaway: "Runaway",
  "over-checked": "Over-checked", none: "No loop",
};

const on = (i: any) => !!i && (i.state === "yes" || i.state === "partial");
const where = (i: any): Place | null => {
  const f = ((i && i.found) || []).find((x: any) => x.path);
  return f ? { path: f.path, line: (f.lines && f.lines[0]) ?? null } : null;
};
const at = (f: any): Place | null => f && f.path ? { path: f.path, line: (f.lines && f.lines[0]) ?? null } : null;
// a place's name: the agent or file it is; a signal found in a file goes by the file
const nm = (f: any) => { const l = String(f.label || f.node || ""); return ((/^sig:/.test(l) || !l) && f.path ? String(f.path) : l.replace(/^(agent|approval):/, "")).split("/").pop() || ""; };

/** The loops in a harness, from its pieces by id (evaluate's items), and what's wrong with each. */
export function loops(items: Record<string, any>, flow?: FlowSteps | null): { loops: Loop[]; findings: LoopFinding[] } {
  const I = (id: string) => items[id], has = (id: string) => on(I(id));
  // set up in the harness's own files, not only something the runtime can do (Claude Code's /loop, its permission prompts)
  const mine = (id: string) => has(id) && (((I(id).found || []).length > 0) || ((I(id).instances || []).length > 0));
  const capOf = () => has("spend-limits") ? "a turn or spend limit" : null;
  const found = (id: string): any[] => has(id) ? (I(id).found || []).filter((f: any) => f.path || f.label) : [];
  const inst = (id: string, name: string, check: Check | null, sends_back: string | null, stop: Instance["stop"], cap: string | null, verdict: Verdict, f: any,
    o: Partial<Instance> = {}): Instance => ({ id, name, check, sends_back, stop, cap, verdict, steps: [], all: false, reads_only: false, place: at(f), scope: "step", pair: null, runtime: false, trigger: "when the step ends", ...o });
  const out: Loop[] = [];

  // each action: the agent loop every runtime runs (act, see what the tools return, act again), on every harness; a
  // formatter or a shape check after each write makes it judge each change, not only report it
  const edit = has("auto-fix") || has("schema");
  const agentLoop = inst("agent", "The agent loop", { who: "environment", blocks: false, what: "what its tools return: output and errors" }, "tool results", "say-so", null,
    edit ? "earned" : "self-declared", null, { all: true, scope: "action", runtime: true, trigger: "each tool call" });
  out.push({ id: "edit", speed: "edit", scope: "action", name: "Each action", present: true,
    check: edit ? { who: has("auto-fix") ? "command" : "shape", blocks: false, what: has("auto-fix") ? "a formatter or linter after each write" : "a shape check" } : agentLoop.check,
    sends_back: edit ? "its output" : "tool results", stop: edit ? "with the edit" : "say-so", cap: null, verdict: edit ? "earned" : "self-declared",
    pieces: ["auto-fix", "schema"].filter(has), from: [], place: where(I("auto-fix")) || where(I("schema")),
    says: edit ? "Tool results come back after each action, and each write is checked as it's made." : "Tool results come back after each action, but nothing checks a change is right: the agent decides.",
    instances: [agentLoop, ...found("auto-fix").map(f => inst(`auto-fix:${nm(f)}`, nm(f) || "a formatter", { who: "command", blocks: false, what: "runs after each write" }, "its output", "with the edit", null, "earned", f, { scope: "action", trigger: "each write" })),
      ...found("schema").map(f => inst(`schema:${nm(f)}`, nm(f) || "a shape check", { who: "shape", blocks: false, what: "checks the shape of what's written" }, "what doesn't fit", "with the edit", null, "earned", f, { scope: "action", trigger: "each write" }))] });

  // per task: how it knows a task is done. Each place it's decided is an instance: a done check on stopping covers every
  // task; a reviewer agent covers the steps that hand to it; an approval covers its step; a step that writes with none
  // of these decides for itself; a step that only reads has nothing to get wrong on disk
  const cc = has("completion-check");
  const model = mine("independent-checker") || mine("review-workflow"), person = mine("human-gate"), cmds = has("check-commands");
  const ti: Instance[] = [];
  for (const f of found("completion-check")) ti.push(inst(`done:${nm(f)}`, nm(f), { who: "command", blocks: true, what: cmds ? "runs the check commands when the agent stops" : "has to pass when the agent stops" },
    "the check's output", "evidence", capOf(), "earned", f, { all: true, trigger: "when the agent stops" }));
  const fsteps = (flow && flow.steps) || [], hand = (flow && flow.handoffs) || [];
  for (const f of found("independent-checker")) {
    const id = String(f.node || ""), by = hand.filter(h => h.to === id).map(h => h.from);
    ti.push(inst(`judge:${nm(f)}`, nm(f), { who: "model", blocks: false, what: "a separate agent reads the result" }, null, "say-so", capOf(), "no-send-back", f, { steps: by, trigger: by.length ? "when a step hands to it" : "when the model calls it" }));
  }
  // a loop across steps: a step whose text sends the work back to an earlier one when it fails (judge, then back)
  for (const h of hand.filter(h => h.back)) {
    const a = fsteps.find(s => s.id === h.from), b = fsteps.find(s => s.id === h.to); if (!a || !b) continue;
    const who: Who = a.gate === "you approve" ? "person" : /review|check|verif|judge|critic|audit|test/i.test(a.name) ? "model" : "model";
    ti.push(inst(`across:${a.name}>${b.name}`, `${a.name} sends back to ${b.name}`, { who, blocks: true, what: `${a.name} judges the work` }, h.text || "what it found", "evidence", capOf(),
      "earned", h.place || a.place, { steps: [b.id, a.id], pair: [b.id, a.id], trigger: `when ${a.name} finishes` }));
  }
  const gated = fsteps.filter(s => s.gate === "you approve"), guarded = fsteps.filter(s => s.gate && s.gate !== "you approve");
  if (gated.length) ti.push(inst("approve", "Drafts, you review, then it writes", { who: "person", blocks: true, what: "you read the draft before it's written" },
    "your changes", "approval", null, "earned", gated.length === 1 ? gated[0].place : null, { steps: gated.map(s => s.id), trigger: "before it writes" }));
  if (guarded.length) ti.push(inst("guard", "A hook guards its writes", { who: "command", blocks: true, what: guarded[0].gate! }, "the refusal", "evidence", null, "earned", guarded[0].place, { steps: guarded.map(s => s.id), trigger: "each write" }));
  const judged = new Set(ti.flatMap(i => i.steps));
  const loose = fsteps.filter(s => !s.gate && !judged.has(s.id));
  if (!cc) {
    const w = loose.filter(s => s.writes.length), r = loose.filter(s => !s.writes.length);
    if (w.length) ti.push(inst("self", "Writes on its own say-so", null, null, "say-so", capOf(), "self-declared", w[0].place, { steps: w.map(s => s.id) }));
    if (r.length) ti.push(inst("reads", "Reads or answers, writes nothing", null, null, "say-so", capOf(), "none", null, { steps: r.map(s => s.id), reads_only: true }));
  }
  const n = (k: string) => (ti.find(i => i.id === k) || { steps: [] }).steps.length;
  const tally = [gated.length && `${gated.length} stop on your approval`, n("self") && `${n("self")} write${n("self") > 1 ? "" : "s"} on ${n("self") > 1 ? "their" : "its"} own say-so`,
    n("reads") && `${n("reads")} only read`].filter(Boolean).join("; ");
  let task: Loop;
  if (cc) task = { id: "task", speed: "task", scope: "step", name: "Each step", present: true,
    check: { who: "command", blocks: true, what: cmds ? "a Stop hook that runs the check commands" : "a Stop hook that has to pass" },
    sends_back: "the check's output", stop: "evidence", cap: capOf(), verdict: "earned", pieces: ["completion-check", "check-commands", "criteria"].filter(has), from: [],
    place: where(I("completion-check")), says: "A check decides it's done, and a failure sends it back.", instances: ti };
  else if (person && cmds && !gated.length) task = { id: "task", speed: "task", scope: "step", name: "Each step", present: true,
    check: { who: "person", blocks: true, what: "you approve, though a check command could decide" }, sends_back: "your notes", stop: "approval", cap: capOf(),
    verdict: "over-checked", pieces: ["human-gate", "check-commands"], from: [], place: where(I("human-gate")), says: "A person checks what a command could.", instances: ti };
  else if (n("self")) task = { id: "task", speed: "task", scope: "step", name: "Each step", present: true, check: gated.length ? { who: "person", blocks: true, what: "you review some steps' drafts" } : null,
    sends_back: gated.length ? "your changes" : null, stop: "say-so", cap: capOf(), verdict: "self-declared", pieces: ["human-gate", "criteria"].filter(has), from: [],
    place: (ti.find(i => i.id === "self") || {}).place || where(I("criteria")), says: `Steps that write decide for themselves when they're done. ${tally}.`, instances: ti };
  else if (gated.length) task = { id: "task", speed: "task", scope: "step", name: "Each step", present: true, check: { who: "person", blocks: true, what: "you read each draft before it's written" },
    sends_back: "your changes", stop: "approval", cap: capOf(), verdict: "earned", pieces: ["human-gate"].filter(has), from: [], place: gated[0].place,
    says: `Every step that writes waits for your approval. ${tally}.`, instances: ti };
  else if (model) task = { id: "task", speed: "task", scope: "step", name: "Each step", present: true,
    check: { who: "model", blocks: false, what: has("independent-checker") ? "a reviewer agent" : "a review step" }, sends_back: null, stop: "say-so", cap: capOf(),
    verdict: "no-send-back", pieces: ["independent-checker", "review-workflow"].filter(has), from: [], place: where(I("independent-checker")) || where(I("review-workflow")),
    says: "A reviewer reports problems, but nothing sends the work back.", instances: ti };
  else task = { id: "task", speed: "task", scope: "step", name: "Each step", present: true, check: null, sends_back: null, stop: "say-so", cap: capOf(),
    verdict: "self-declared", pieces: ["criteria"].filter(has), from: [], place: where(I("criteria")),
    says: has("criteria") ? "Success is written down, but the agent decides when it's met." : "The agent decides when it's done.", instances: ti };
  out.push(task);

  // per run: long or repeated runs, and what ends one that never passes
  const run = mine("autonomous-runs"), cap = capOf();
  out.push({ id: "run", speed: "run", scope: "route", name: "Each route", present: run,
    check: run && cc ? { who: "command", blocks: true, what: "the done check, each time" } : null, sends_back: run && cc ? "the check's output" : null,
    stop: run ? (cc ? "evidence" : "say-so") : null, cap: run ? cap : null,
    verdict: !run ? "none" : !cap ? "runaway" : cc ? "earned" : "self-declared", pieces: ["autonomous-runs", "spend-limits"].filter(has), from: [],
    place: where(I("autonomous-runs")),
    instances: run ? (I("autonomous-runs").found || []).filter((f: any) => f.path).map((f: any) => inst(`run:${nm(f)}`, nm(f), cc ? { who: "command", blocks: true, what: "the done check, each time" } : null,
      cc ? "the check's output" : null, cc ? "evidence" : "say-so", cap, !cap ? "runaway" : cc ? "earned" : "self-declared", f, { scope: "route", trigger: /\.github\/workflows|ci/i.test(String(f.path)) ? "a CI run" : "when a long run starts" })) : [],
    says: !run ? "No long or repeated runs." : !cap ? "Runs repeat with nothing to end one that never passes." : cc ? "Each run ends on evidence or at its limit." : "Runs end at their limit or when the agent says so." });

  // over time: evals and feedback, and whether what they find comes back as work
  const ev = mine("evals"), fb = mine("feedback"), time = ev || fb;
  out.push({ id: "time", speed: "time", scope: "harness", name: "Over time", present: time,
    check: ev ? { who: "command", blocks: false, what: "an eval suite" } : fb ? { who: "person", blocks: false, what: "feedback you give" } : null,
    sends_back: ev && fb ? "what the evals and feedback find" : null, stop: null, cap: null,
    verdict: !time ? "none" : ev && fb ? "earned" : "no-send-back", pieces: ["evals", "feedback"].filter(has), from: [], place: where(I("evals")) || where(I("feedback")),
    instances: [...(ev ? found("evals") : []).map(f => inst(`evals:${nm(f)}`, nm(f) || "evals", { who: "command", blocks: false, what: "an eval suite" }, fb ? "what they find" : null, null, null, fb ? "earned" : "no-send-back", f, { scope: "harness", trigger: "when you run the evals" })),
      ...(fb ? found("feedback") : []).map(f => inst(`feedback:${nm(f)}`, nm(f) || "feedback", /telemetry|events|log/.test(nm(f)) ? { who: "command", blocks: false, what: "records what happened" } : { who: "person", blocks: false, what: "feedback you give" }, ev ? "what you report" : null, null, null, ev ? "earned" : "no-send-back", f, { scope: "harness", trigger: "as you use it" }))],
    says: !time ? "Nothing measures it over time." : ev && fb ? "What the evals find comes back as work." : "It's measured, but nothing turns what's found into work." });

  // the pieces that make each loop, for a lane that has none yet
  const FROM: Record<string, string[]> = { edit: ["auto-fix", "schema"], task: ["completion-check", "check-commands", "independent-checker", "criteria"],
    run: ["autonomous-runs", "spend-limits"], time: ["evals", "feedback"] };
  for (const l of out) { l.from = FROM[l.id]; l.instances = l.instances.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i); }
  const findings: LoopFinding[] = [];
  const f = (l: Loop, title: string, fix: string, upgrade: string | null, draft: boolean) =>
    findings.push({ loop: l.id, verdict: l.verdict, title, detail: l.says, fix, upgrade, draft, place: l.place });
  const selfw = ti.find(i => i.id === "self");
  if (task.verdict === "self-declared" && selfw) { const names = selfw.steps.map(id => (fsteps.find(s => s.id === id) || { name: id }).name);
    findings.push({ loop: "task", verdict: "self-declared", title: `${names.length > 2 ? `${names.length} steps write` : `${names.join(" and ")} write${names.length > 1 ? "" : "s"}`} on ${names.length > 1 ? "their" : "its"} own say-so`,
      detail: `Nothing checks ${names.length > 1 ? "them" : "it"} before ${names.length > 1 ? "they're" : "it's"} done${gated.length ? `, though ${gated.length} other steps wait for your approval` : ""}.`,
      fix: gated.length ? "Give it an approval step like the others, or add a done check every task passes" : "Add a completion check: a Stop hook that runs the check commands and sends failures back",
      upgrade: gated.length ? "human-gate" : "completion-check", draft: !gated.length, place: selfw.place }); }
  else if (task.verdict === "self-declared") f(task, "Stops when it says it's done", "Add a completion check: a Stop hook that runs the check commands and sends failures back", "completion-check", true);
  if (task.verdict === "no-send-back") f(task, "Checks, but doesn't send back", "Make the check block: a Stop hook that runs it and returns what it finds", "completion-check", true);
  if (task.verdict === "over-checked") f(task, "You check what a command could", "Let a Stop hook run the check commands, and keep your approval for what a command can't judge", "completion-check", true);
  const r = out.find(l => l.id === "run")!;
  if (r.verdict === "runaway") f(r, "Runs with no cap", "Add a turn or spend limit, so a run that never passes ends", "spend-limits", false);
  if (r.verdict === "self-declared") f(r, "Long runs end on the agent's word", "Give long runs the done check, so each ends on evidence", "completion-check", true);
  const t = out.find(l => l.id === "time")!;
  if (t.verdict === "no-send-back") f(t, "Measured, but nothing comes back", ev ? "Route what the evals find back as tasks" : "Add evals, so feedback is measured the same way each time", ev ? "feedback" : "evals", false);
  return { loops: out, findings };
}
