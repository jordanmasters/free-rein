// How work flows: the route work takes across steps and agents, and who decides each next step: code or
// the model. Read from the graph the reader already builds: instructions that route to skills, skills that hand off
// to other skills or agents (with the sentence that says when), approval steps on a step, a done check that can send
// work back, and what each step writes. From those it finds the main routes, drawn like lines on a transit map, and
// sets aside the side trips (captures used from anywhere) and the steps that only get you around (modes, routers).
import { extract } from "../read/extract";
import { readText } from "../py";

type Place = { path: string; line: number | null };
export type Role = "work" | "side" | "around" | "alone";
export interface Step { id: string; name: string; kind: "skill" | "agent"; gate: string | null; writes: string[]; place: Place | null; role: Role; route: string | null; fans_out: boolean }
/** A handoff: back when its sentence sends work back to an earlier step on a failure (a loop across steps); gate when the
 *  step it hands to waits for an approval (a gate on the handoff). */
export interface Handoff { from: string; to: string; by: "code" | "model"; when: string; text: string; place: Place | null; back: boolean; gate: string | null }
export interface Route { id: string; name: string; stops: { step: string; when: string }[]; joins: { at: string; from: string[] }[]; also: string[] }
export interface StopCheck { name: string; what: string; place: Place | null }
export interface FlowFinding { kind: "ungated-write" | "unreached"; title: string; detail: string; fix: string; step: string; place: Place | null }
export interface Flows { steps: Step[]; handoffs: Handoff[]; routes: Route[]; stop_checks: StopCheck[]; picked: string[]; designed: boolean; findings: FlowFinding[]; says: string }

const short = (id: string) => id.replace(/^unit:|^executor:agent:|^executor:|^gate:/, "").replace(/@.*$/, "");
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// a line that names another step without handing off to it: "use /add-task instead", "that's for /draft-thesis"
const NOT_HANDOFF = /\b(instead|that'?s for|is for|belongs? (in|to)|don'?t use|not for|called from)\b/i;
const OFFERS = /offer|suggest|→|->|hands? off|then run|run \//i;
// a line that sends the work back when something fails: "if the review fails, back to /build"
const BACK = /\b(fails?|failed|doesn'?t pass|isn'?t (right|done|good enough)|rejects?|rejected)\b[^.]*\b(back|again|return)\b|\b(send (it |the work )?back|go back to|back to \/)/i;

/** The sentence in a step's own file that names the next step: its text, its condition, and its line. */
function sentence(file: string | null, target: string): { text: string; when: string; line: number | null; mention: boolean } {
  const none = { text: "", when: "", line: null, mention: false };
  const src = file ? readText(file) : null; if (!src) return none;
  const lines = src.split(/\r?\n/), slash = new RegExp(`/${escRe(target)}(?![\\w-])`), bare = new RegExp(`(^|[^\\w/-])${escRe(target)}(?![\\w-])`);
  const hits = lines.map((l, i) => ({ l, i })).filter(({ l }) => !/^\s*#/.test(l) && !/^\s*(name|description):/.test(l));
  const pick = hits.find(({ l }) => slash.test(l) && OFFERS.test(l)) || hits.find(({ l }) => slash.test(l)) || hits.find(({ l }) => bare.test(l));
  if (!pick) return none;
  const text = pick.l.replace(/[*`]/g, "").replace(/^[\s>|-]*(\d+\.\s*)?/, "").replace(/\s*\|\s*$/, "").trim();
  // the condition: what comes before the arrow or dash ("Note is mature → offer /draft-thesis"), or an if- or
  // when-clause; a plain "then /next" has none
  const cut = text.match(/^(.*?)\s*(→|->| — | – )/), ifc = text.match(/\b((?:if|when|once) [^,.;→]+)/i);
  let when = cut && cut[1].length > 2 && !slash.test(cut[1]) ? cut[1] : ifc ? ifc[1] : "";
  when = when.replace(/\/[\w-]+/g, "").replace(/<([^>]*)>/g, "$1").replace(/[[\]]/g, "").replace(/^\s*(\d+\.|[-|:])\s*/, "").replace(/^N\s+/, "")
    .replace(/\s{2,}/g, " ").replace(/[:;,\s]+$/, "").trim();
  // a mention, not a handoff: the words right around the name say so ("called from /commit", "use /add-task instead")
  const at = text.search(slash) >= 0 ? text.search(slash) : text.search(bare), near = text.slice(Math.max(0, at - 40), at + target.length + 30);
  return { text: text.slice(0, 200), when: when.length > 80 ? when.slice(0, 79) + "…" : when, line: pick.i + 1, mention: NOT_HANDOFF.test(near) && !/offer|suggest/i.test(near) };
}

const EMPTY: Flows = { steps: [], handoffs: [], routes: [], stop_checks: [], picked: [], designed: false, findings: [], says: "No designed route: the model decides each step." };

/** The designed routes in a harness, or none: steps and their roles, handoffs with their conditions, the main routes,
 *  the done checks every task passes, and what's wrong. */
export function flows(root: string): Flows {
  let g: any; try { g = extract(root); } catch { return EMPTY; }
  const nodes: any[] = g.nodes instanceof Map ? [...g.nodes.values()] : Object.values(g.nodes || {});
  const edges: any[] = Array.isArray(g.edges) ? g.edges : Object.values(g.edges || {});
  const N = new Map(nodes.map((n: any) => [n.id, n]));
  const isStep = (id: string) => /^unit:|^executor:agent:/.test(id) && N.has(id) && !id.includes("@");
  const place = (n: any): Place | null => { const p = n && (n.provenance || {}); return p && p.path ? { path: p.path, line: (p.lines && p.lines[0]) ?? null } : null; };
  const steps = new Map<string, Step>(), handoffs: Handoff[] = [];
  const step = (id: string): Step => {
    if (!steps.has(id)) steps.set(id, { id, name: short(id), kind: id.startsWith("executor:agent:") ? "agent" : "skill", gate: null, writes: [], place: place(N.get(id)), role: "work", route: null, fans_out: false });
    return steps.get(id)!;
  };
  for (const n of nodes) if (isStep(n.id)) step(n.id);
  for (const e of edges) {
    // a step hands off to another: written in its text, carried out by the model, unless the line only names it
    if (e.type === "invokes" && isStep(e.source) && isStep(e.target) && e.source !== e.target && !handoffs.some(h => h.from === e.source && h.to === e.target)) {
      const pl = place(N.get(e.source)), s = sentence(pl && pl.path, short(e.target));
      if (!s.mention) handoffs.push({ from: e.source, to: e.target, by: "model", when: s.when, text: s.text, place: pl ? { path: pl.path, line: s.line } : null, back: BACK.test(s.text), gate: null });
    }
    // what a step writes, unless it says it only reads (a file its text names for another step to write)
    if (e.type === "writes" && isStep(e.source) && !(N.get(e.source) || {}).readonly && !/^gate:/.test(e.target)) step(e.source).writes.push(short(e.target));
  }
  // an approval step on a step is its gate
  for (const n of nodes) if (/^gate:approval:/.test(n.id)) { const s = "unit:" + n.id.replace(/^gate:approval:/, ""); if (steps.has(s)) steps.get(s)!.gate = "you approve"; }
  // a hook that guards every write (enforced by the runtime, not asked of the model) gates them all
  const writesGuarded = nodes.some((n: any) => n.type === "gate" && (n.imparts || {}).locus === "infrastructure" && !!n.guards_writes);
  if (writesGuarded) for (const s of steps.values()) if (!s.gate && s.writes.length) s.gate = "a hook guards writes";
  // a gate on a handoff: the step it hands to waits for an approval; a fan-out: a step that hands to several agents
  for (const h of handoffs) h.gate = (steps.get(h.to) || { gate: null }).gate;
  for (const s of steps.values()) s.fans_out = handoffs.filter(h => h.from === s.id && steps.get(h.to)!.kind === "agent").length >= 2;
  // a done check every task passes: a hook on stopping that can send the work back (one that only logs isn't)
  const stop_checks: StopCheck[] = nodes.filter((n: any) => n.type === "gate" && n.on_completion).map((n: any) => ({ name: short(n.id).split("/").pop()!, what: n.summary || "a check when the agent stops", place: place(n) }));

  // roles. Getting around: modes, and steps that mostly open modes or offer many steps while nothing leads to them
  const outs = (id: string) => handoffs.filter(h => h.from === id), ins = (id: string) => handoffs.filter(h => h.to === id);
  const isMode = (id: string) => /-mode$/.test(short(id));
  for (const s of steps.values()) {
    const o = outs(s.id);
    if (isMode(s.id) || (o.length && o.filter(h => isMode(h.to)).length * 2 >= o.length) || (o.length >= 6 && ins(s.id).length <= 1)) s.role = "around";
  }
  // side trips: captures offered from several steps that offer at most one step back, and only each other (or
  // nothing), plus steps that only offer them. Found as the largest such set
  const work = () => [...steps.values()].filter(s => s.role === "work");
  const from = (id: string) => new Set(ins(id).filter(h => steps.get(h.from)!.role !== "around").map(h => h.from)).size;
  let side = new Set(work().filter(s => from(s.id) >= 3 && outs(s.id).length <= 1).map(s => s.id));
  for (let changed = true; changed;) { changed = false; for (const id of [...side]) if (outs(id).some(h => !side.has(h.to) && steps.get(h.to)!.role !== "around")) { side.delete(id); changed = true; } }
  for (const s of work()) if (!side.has(s.id) && outs(s.id).length && outs(s.id).every(h => side.has(h.to)) && from(s.id) <= 1) side.add(s.id);
  for (const id of side) steps.get(id)!.role = "side";
  for (const s of work()) if (!outs(s.id).length && !ins(s.id).length) s.role = "alone";

  // routes: from each step nothing leads to, follow the handoffs to the furthest step; a path that meets an earlier
  // line joins it from the side, else it starts a line of its own. Working steps on no line go with the line they
  // trade most handoffs with
  const W = new Set(work().map(s => s.id)), E = handoffs.filter(h => W.has(h.from) && W.has(h.to));
  const furthest = (s: string) => {
    const prev: Record<string, string | null> = { [s]: null }, dist: Record<string, number> = { [s]: 0 }, q = [s];
    while (q.length) { const u = q.shift()!; for (const h of E) if (h.from === u && !(h.to in prev)) { prev[h.to] = u; dist[h.to] = dist[u] + 1; q.push(h.to); } }
    const end = Object.keys(dist).sort((a, b) => dist[b] - dist[a] || a.localeCompare(b))[0], p: string[] = [];
    for (let x: string | null = end; x != null; x = prev[x]) p.unshift(x);
    return p;
  };
  const ws = [...W].sort(), starts = ws.filter(id => E.some(h => h.from === id) && !E.some(h => h.to === id));
  const paths = starts.map(furthest).filter(p => p.length > 1).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  const lines: { trunk: string[]; joins: Route["joins"]; on: Set<string> }[] = [];
  for (const p of paths) {
    const host = lines.find(l => p.slice(1).some(x => l.trunk.includes(x)));
    if (!host) { lines.push({ trunk: p, joins: [], on: new Set(p) }); continue; }
    const j = p.findIndex(x => host.trunk.includes(x)), at = p[j], jn = host.joins.find(x => x.at === at), via = p.slice(0, j);
    if (via.some(x => lines.some(l => l.on.has(x)))) continue;
    jn ? jn.from.push(via.map(short).join(" → ")) : host.joins.push({ at, from: [via.map(short).join(" → ")] });
    via.forEach(x => host.on.add(x));
  }
  const also: string[][] = lines.map(() => []);
  for (const id of ws) if (!lines.some(l => l.on.has(id))) {
    const ties = lines.map(l => E.filter(h => (h.from === id && l.on.has(h.to)) || (h.to === id && l.on.has(h.from))).length), best = ties.indexOf(Math.max(...ties));
    if (best >= 0 && ties[best] > 0) also[best].push(id);
  }
  const routes: Route[] = lines.map((l, i) => {
    const t = l.trunk, id = `route:${short(t[0])}`;
    for (const m of [...l.on, ...also[i]]) steps.get(m)!.route = id;
    return { id, name: `${short(t[0])} → ${short(t[t.length - 1])}`, stops: t.map((s, k) => ({ step: s, when: k ? (E.find(h => h.from === t[k - 1] && h.to === s) || { when: "" }).when : "" })), joins: l.joins, also: also[i] };
  });
  routes.sort((a, b) => b.stops.length + b.joins.length - a.stops.length - a.joins.length);

  // the steps the model picks by description alone: nothing hands off to them
  const picked = [...steps.keys()].filter(id => !ins(id).length);
  const designed = handoffs.length > 0;
  const findings: FlowFinding[] = [];
  for (const s of steps.values()) if (s.writes.length && !s.gate && !stop_checks.length)
    findings.push({ kind: "ungated-write", step: s.id, place: s.place, title: `${s.name} writes with no gate`,
      detail: `It writes ${s.writes.slice(0, 3).join(", ")} and nothing approves it first.`, fix: "Add an approval step before it writes, or a rule that asks first." });
  const nr = routes.length;
  return { steps: [...steps.values()], handoffs, routes, stop_checks, picked, designed, findings,
    says: !steps.size ? "No steps to route between: the agent does the work itself."
      : !designed ? "No designed route: the model picks each step by its description, in the order it judges."
      : `${nr ? `${nr} main route${nr > 1 ? "s" : ""}. ` : ""}Each step offers the next when its condition holds; the model and you decide${handoffs.some(h => h.by === "code") ? ", except where code fixes the route" : ""}.` };
}
