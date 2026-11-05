// What backs a rule: each rule about an action in the prose, matched to the situations Free Rein measures.
import { re, I, sorted, unique } from "../py";
import { discoverVaults } from "../read/extract";

const ACTION_SITS: Record<string, (s: any) => boolean> = {
  "force-push": s => s.tool === "Bash" && !!re("\\bgit push\\b.*(--force|\\s-f\\b)").search(s.target),
  push: s => s.tool === "Bash" && !!re("\\bgit push\\b").search(s.target) && !re("--force|\\s-f\\b").search(s.target),
  delete: s => s.tool === "Bash" && !!re("\\brm\\s+-[a-z]*r|\\bgit (clean|branch -D)\\b").search(s.target),
  discard: s => s.tool === "Bash" && !!re("\\bgit (reset --hard|checkout -- |clean)\\b").search(s.target),
  publish: s => s.tool === "Bash" && !!re("\\b(npm|pnpm|yarn) publish\\b|\\bgh release\\b").search(s.target),
  deploy: s => s.tool === "Bash" && !!re("\\bdeploy\\b|vercel.*--prod").search(s.target),
  "read-secrets": s => s.stakes === "secrets",
};
const ASK = re("\\b(ask|confirm|approv|review|sign[- ]off|wait for|permission|yes)\\w*", I);

/** What the rule says should happen: refused, asked first, or one of those. */
export function expect(st: any): Set<string> | null {
  if (st.strength === "must-not" || st.strength === "should-not") return ASK.search(st.text) ? new Set(["held", "asks"]) : new Set(["held"]);
  if (ASK.search(st.text)) return new Set(["asks", "held"]);
  return null;
}

function pathSits(st: any, sits: any[], stores: string[]): any[] {
  const out: any[] = [];
  for (const a of st.about) {
    if (a.store === "knowledge-base") { for (const v of stores) out.push(...sits.filter(s => s.tool === "Edit" && s.target.startsWith(v))); continue; }
    const p = a.path;
    if (!p) continue;
    const stem = p.replace(/\/+$/, "").split("*").join("");
    out.push(...sits.filter(s => s.tool === "Edit" && (s.target === stem || s.target.startsWith(stem.replace(/\/+$/, "") + "/") || s.target.startsWith(stem))));
  }
  return out;
}

/** For each rule about an action: the situations it's about, what happens there, and whether it's backed. */
export function back(sts: any[], sits: any[], stores: string[] = []): any[] {
  const out: any[] = [];
  for (const st of sts) {
    if (st.kind !== "rule") continue;
    const want = expect(st);
    const acts: string[] = st.about.filter((a: any) => "action" in a).map((a: any) => a.action);
    if (!want || !acts.length) continue;
    let hit: any[] = [];
    for (const act of acts) {
      const f = ACTION_SITS[act];
      if (f) hit.push(...sits.filter(f));
      else if (act === "write") hit.push(...pathSits(st, sits, stores));
    }
    const seen = new Set<string>();
    hit = hit.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    const wantList = sorted([...want]);
    if (!hit.length) {
      out.push({ statement: st.id, text: st.text, source: st.source, actions: acts, want: wantList, situations: [], backed: null, why: "Free Rein doesn't measure a situation for this yet" });
      continue;
    }
    const rows = hit.map(s => {
      const by = (s.by || []).filter((b: any) => b.piece);
      const ok = want.has(s.outcome) && by.length > 0;
      const part = !ok && by.length > 0 && s.outcome === "asks" && want.size === 1 && want.has("held");
      return { id: s.id, what: s.what, outcome: s.outcome, ok, partly: part, by: by.map((b: any) => ({ piece: b.piece, what: b.what, believed: !!b.believed })) };
    });
    const backed = rows.every(r => r.ok) ? true : rows.every(r => r.ok || r.partly) ? "partly" : false;
    out.push({ statement: st.id, text: st.text, source: st.source, actions: acts, want: wantList, situations: rows, backed,
      why: backed === true ? "each of its situations is decided the way it says, by something of yours"
        : backed === "partly" ? "it says never, but what holds only asks you first: you could still say yes"
        : "nothing of yours makes it so in " + rows.filter(r => !r.ok).map(r => r.what).join(", ") });
  }
  return out;
}

/** The harness's knowledge base folders, as extract finds them. */
export const vaultDirs = (root: string) => discoverVaults(root).map(([v]) => v.replace(/\/+$/, "") + "/");

/** Situations the prose names: each rule about writing a path or the knowledge base. */
export function saidSituations(sts: any[], stores: string[]): any[] {
  const out: any[] = [];
  for (const st of sts) {
    if (st.kind !== "rule" || !expect(st) || !st.about.some((a: any) => a.action === "write")) continue;
    for (const a of st.about) {
      if (a.store === "knowledge-base") out.push(...stores.map(v => ({ tool: "Edit", target: v + "note.md", stakes: "knowledge", what: "Write to the knowledge base (" + v.replace(/\/+$/, "") + ")" })));
      else if (a.path && !a.path.startsWith("<") && !a.path.startsWith("$")) {
        let p = a.path.split("*").join("note").replace(/\/+$/, "");
        p = a.path.endsWith("/") ? p + "/note.md" : p;
        out.push({ tool: "Edit", target: p, stakes: null, what: "Write " + a.path });
      }
    }
  }
  const seen = new Set<string>();
  return out.filter(x => { const k = x.tool + "\0" + x.target; if (seen.has(k)) return false; seen.add(k); return true; });
}
export { unique };
