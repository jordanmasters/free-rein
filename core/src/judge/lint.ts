// Free Rein's lint: checks over an extracted harness graph, written as findings a person can act on.
import * as fs from "fs";
import { re, M, join, exists, split, len, sorted, unique, repr, decode, once } from "../py";
import { extract, Graph, KIT } from "../read/extract";
import { used, tryPlugin } from "../read/plugins";


const ORPHAN_TYPES = new Set(["contract", "substrate"]);

export const CLASSES: Record<string, { title: string; what: string; why: string; fix: string }> = {
  "naked-write": { title: "Put a check in front of these writes",
    what: "Some files the rest of the work relies on can be changed without anything reviewing the change first.",
    why: "If a mistake lands in one of these files, it gets treated as fact from then on — and nothing would have caught it.",
    fix: "What would change: these writes get routed through an approval step. Or, if the file doesn't really need protecting, it gets marked that way so this stops flagging." },
  "dangling-reference": { title: "Fix a broken link",
    what: "Something points at a file, skill, or setting that isn't there anymore — usually because it was renamed or moved.",
    why: "It will fail quietly at exactly the moment it's needed.",
    fix: "What would change: the reference gets pointed at the new name, or removed if the thing is truly gone." },
  "orphan": { title: "Tidy up something nothing uses", what: "This exists, but nothing refers to it.",
    why: "Usually it's leftover from an old idea. Occasionally it's something real that never got hooked up.",
    fix: "What would change: it gets connected to whatever should use it, or deleted." },
  "claimed-actual-mismatch": { title: "Make the docs match what's really there",
    what: "Your docs say something is enforced automatically, but in practice it only works if the model follows the instructions.",
    why: "This is the sneakiest kind of gap — you think you're protected and you aren't.",
    fix: "What would change: either add the automatic check, or reword the docs to describe what's actually there. Both fix it." },
  "vocabulary-mismatch": { title: "Merge two names for the same file",
    what: "Two parts of the harness refer to what is almost certainly one file, spelled two different ways.",
    why: "Some writes go to one, some to the other — so neither copy has the full picture.",
    fix: "What would change: one name is picked and every reference is updated to use it." },
  "emitted-unread": { title: "Use this data, or stop collecting it", what: "Something records events that nothing ever reads.",
    why: "Either a dashboard or report was meant to read it and doesn't exist yet, or it's wasted effort.",
    fix: "What would change: something starts reading it, or the recording stops." },
  "spec-drift": { title: "Bring the plan and the build back in line",
    what: "There's a written plan for how something should work, and the actual build doesn't match it — or the build exists with no plan at all.",
    why: "Whichever one you read, you'd be reading something that isn't quite true.",
    fix: "What would change: the plan gets updated to describe reality, or the build gets changed to match the plan." },
  "over-verified": { title: "Save your attention on this check", what: "You're personally approving something a simple automatic check could handle.",
    why: "Your attention is the scarcest thing in the harness. Spend it on routine checks and you'll start rubber-stamping the ones that matter.",
    fix: "What would change: this check moves to something automatic, and your approval is saved for real judgment calls." },
  "uncertifiable-path": { title: "Good to know: this part is a black box",
    what: "Some of what happens here runs inside the AI runtime itself, which can't be inspected.",
    why: "Not a problem to fix — just a limit worth knowing about.", fix: "Nothing to change. If this path matters, check what goes in and what comes out." },
  "unsatisfied-requirement": { title: "Add what this part needs to work", what: "A part of your harness depends on something your setup doesn't have.",
    why: "It will look installed but quietly do nothing.",
    fix: "What would change: the missing piece gets added, or this part gets swapped for one that doesn't need it." },
  "reply-looks-required": { title: "Make clear which words count as a yes",
    what: "A checkpoint gives example words for approving, and the agent can end up repeating them as if they were required.",
    why: "People start wondering whether their approval counts, and phrase their answers to fit a rule they can't see.",
    fix: "What would change: the checkpoint says any clear yes counts, or it asks with buttons so there is nothing to phrase." },
  "strictness-overclaimed": { title: "This rule sounds stricter than it is",
    what: "A checkpoint calls itself non-negotiable, or always or never, but only the model's own instructions enforce it.",
    why: "It reads like a lock. If the model skips it, nothing stops the action.",
    fix: "What would change: a hook enforces it, or the wording says it's an instruction the agent follows." },
};

export type Severity = "serious" | "warning" | "info";
export interface Finding { class: string; severity: Severity | string; subject: string; title: string; what: string; why: string; remedy: string; detail: string }

/** A finding; meta gives a plugin's own class its words (title, what, why, fix) */
export function finding(cls: string, severity: string, subject: string, detail: string, own?: { title: string; what: string; why: string; fix: string }): Finding {
  const meta = own ?? CLASSES[cls];
  return { class: cls, severity, subject, title: meta?.title ?? cls, what: meta?.what ?? "", why: meta?.why ?? "", remedy: meta?.fix ?? "", detail };
}

/** The graph and its findings; within one reading (py.withFileCache) worked out once per folder. Nothing that
 * reads them changes them. */
export function lint(root: string): [Graph, Finding[]] {
  return once("lint\0" + root, () => lintOf(root));
}

function lintOf(root: string): [Graph, Finding[]] {
  const g = extract(root);
  const findings: Finding[] = [];
  const outEdges = new Map<string, any[]>();
  for (const e of g.edges) { if (!outEdges.has(e.source)) outEdges.set(e.source, []); outEdges.get(e.source)!.push(e); }

  // dangling-reference
  for (const n of g.nodes.values()) {
    if (n.missing) {
      const refs = g.edges.filter(e => e.target === n.id).map(e => e.source);
      findings.push(finding("dangling-reference", "serious", n.id, `referenced by ${sorted(unique(refs)).join(", ")} but does not exist`));
    }
  }
  // orphan: a document or store nothing reads (a dead template, an unread doc). Skills, agents, tools and instruction
  // files are loaded by the runtime or started by name, not referenced, so they're never orphans.
  for (const n of g.nodes.values()) if (n.orphan && !n.discovered && ORPHAN_TYPES.has(n.type)) findings.push(finding("orphan", "info", n.id, "nothing references this node"));

  // naked-write (path-aware)
  const gatedTargets = new Map<string, Set<string>>(), unitGate = new Map<string, string>();
  for (const e of g.edges) {
    if (e.source.startsWith("gate:") && e.type === "writes") { if (!gatedTargets.has(e.source)) gatedTargets.set(e.source, new Set()); gatedTargets.get(e.source)!.add(e.target); }
    if (e.type === "writes" && e.target.startsWith("gate:approval:")) unitGate.set(e.source, e.target);
  }
  const reachableGates = (src: string, depth = 3) => {
    const seen = new Set([src]), gates = new Set<string>();
    let frontier = [src];
    for (let d = 0; d < depth; d++) {
      const nxt: string[] = [];
      for (const s of frontier) for (const e of outEdges.get(s) || []) {
        if (e.type !== "invokes" || seen.has(e.target)) continue;
        seen.add(e.target);
        nxt.push(e.target);
        if (unitGate.has(e.target)) gates.add(unitGate.get(e.target)!);
      }
      frontier = nxt;
    }
    return gates;
  };
  const after = (s: string) => s.slice(s.indexOf(":") + 1).replace(/\/+$/, "");
  const covers = (gateTgt: string, sub: string) => { const a = after(gateTgt), b = after(sub); return a === b || a.startsWith(b + "/") || b.startsWith(a + "/"); };
  for (const e of g.edges) {
    if (e.type !== "writes" || e.source.startsWith("gate:") || e.target.startsWith("gate:")) continue;
    if (!(g.nodes.get(e.target) || {}).authoritative) continue;
    const covering = [...reachableGates(e.source)].filter(gid => [...(gatedTargets.get(gid) || [])].some(t => covers(t, e.target)));
    if (covering.length) findings.push(finding("naked-write", "info", `${e.source} -> ${e.target}`,
      `direct ungated write, but a gated path exists via ${sorted(covering).join(", ")} — verify which path is real`));
    else findings.push(finding("naked-write", "serious", `${e.source} -> ${e.target}`, "write to an authoritative substrate with no gate on any path"));
  }

  // vocabulary-mismatch: same folder, one name a suffix of the other
  const subs = [...g.nodes.values()].filter(n => n.type === "substrate").map(n => n.label as string);
  subs.forEach((a, i) => {
    for (const b of subs.slice(i + 1)) {
      const [da, fa] = split(a), [db, fb] = split(b);
      if (da !== db || fa === fb || Math.min(len(fa), len(fb)) < 6) continue;
      if (fa.endsWith(fb) || fb.endsWith(fa)) findings.push(finding("vocabulary-mismatch", "warning", `${a} vs ${b}`,
        "two substrates in the same directory with near-identical names — likely the same thing spelled two ways"));
    }
  });

  // a plugin's own checks (a framework's events nothing reads, its modes without a spec, …)
  for (const p of used(root)) findings.push(...tryPlugin(p, "lint", () => p.lint?.(g, root, KIT) ?? [], []));

  // unsatisfied-requirement
  const capabilities = new Set<string>();
  if (g.edges.some(e => e.type === "binds")) capabilities.add("hook-runtime");
  for (const n of g.nodes.values()) for (const req of n.requires || [])
    if (!capabilities.has(req) && !g.nodes.has(req)) findings.push(finding("unsatisfied-requirement", "serious", n.id,
      `declares requires=${repr(req)}, which is not present in the graph — this node cannot function here and is not a valid swap target`));

  // uncertifiable-path
  const opaque = new Set([...g.nodes.values()].filter(n => n.type === "black-box").map(n => n.id));
  if (opaque.size) {
    const reached = new Set(g.edges.filter(e => opaque.has(e.source)).map(e => e.target));
    for (const e of g.edges) if (e.type === "writes" && reached.has(e.source)) findings.push(finding("uncertifiable-path", "warning",
      `${e.source} -> ${e.target}`, "effect path passes through a black box — it can be bounded but never certified"));
  }

  for (const p of used(root)) findings.push(...tryPlugin(p, "lintCatalog", () => p.lintCatalog?.(root, KIT) ?? [], []));

  // checkpoint contracts
  const enforced = [...g.nodes.values()].some(n => n.type === "gate" && (n.imparts || {}).locus === "infrastructure" && n.guards_writes);
  for (const n of g.nodes.values()) for (const r of n.checkpoint_rules || []) {
    const where = `${r.path}:${r.line}`;
    if (r.phrase_mode === "example") findings.push(finding("reply-looks-required", "warning", where,
      `example replies ${r.phrases.map(repr).join(", ")} — nothing says other wording works`));
    if (r.claims_strict && !enforced) findings.push(finding("strictness-overclaimed", "warning", where, "claims to be strict, enforced only by instruction"));
  }

  return [g, findings];
}
