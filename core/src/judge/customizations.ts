// What an editor's customization view would list for a harness, read the way the chosen runtime loads it:
// Free Rein's kinds of customization, each file or entry in them, where it comes from and the pieces it gives.
// The editors' own names for these kinds, and for the scopes, are data (model/editors.json).
import { join, expanduser, isdir, isfile, listdir, realpath, sorted, readText } from "../py";
import { modelDir } from "../read/spec";
import * as runtimes from "../read/runtimes";
import * as progress from "./progress";

export const KINDS = ["instructions", "skills", "commands", "agents", "hooks", "mcp", "plugins"];

/** Files no node stands for, one item each: a folder (in the repo, or ~/ for home) and the names in it that count. */
const FILES: Record<string, [string, RegExp][]> = {
  instructions: [[".claude/rules", /\.md$/], [".cursor/rules", /\.mdc?$/], [".github/instructions", /\.instructions\.md$/]],
  commands: [[".claude/commands", /\.md$/], [".cursor/commands", /\.md$/], [".github/prompts", /\.prompt\.md$/],
    ["~/.claude/commands", /\.md$/], ["~/.cursor/commands", /\.md$/]],
  hooks: [[".cursor", /^hooks\.json$/], ["~/.cursor", /^hooks\.json$/], [".github/hooks", /\.json$/], ["~/.copilot/hooks", /\.json$/]],
};

/** The plugin a file was installed with: the folder under an editor's plugin cache, else null (a package Free Rein
 *  knows, such as one linked into ~/.claude/skills, shows where its files are: the editors list those as yours). */
export function pluginOf(path: string): string | null {
  const m = /\/\.(?:claude|cursor|copilot)\/plugins\/(.+)$/.exec(realpath(path));
  if (!m) return null;
  const segs = m[1].split("/");
  return (["cache", "marketplaces"].includes(segs[0]) ? segs[2] ?? segs[1] : segs[0]) || null;
}

function files(dir: string, rx: RegExp, deep: boolean): string[] {
  if (!isdir(dir)) return [];
  let names: string[];
  try { names = listdir(dir); } catch { return []; }   // a folder it may not open (EPERM, EACCES) has nothing to list
  const out: string[] = [];
  for (const n of names) {
    const p = join(dir, n);
    if (isdir(p)) { if (deep && !n.startsWith(".")) out.push(...files(p, rx, deep)); }
    else if (rx.test(n)) out.push(p);
  }
  return sorted(out);
}

export function editors(): any {
  return JSON.parse(readText(join(modelDir(), "editors.json")));
}

/** Each kind's items: the nodes this runtime keeps, the files above it loads, and home skills it loads.
 *  bound: the hook nodes a settings file this runtime runs registers (a script alone isn't a hook). */
export function customizations(root: string, runtime: string, nodes: any[], bound: Set<string>, homeSkills: any[], slots: any[],
  freeReinDir: string): any[] {
  const rroot = realpath(root), home = expanduser("~");
  const name = (p: string) => { const r = realpath(p); return r.startsWith(rroot + "/") ? r.slice(rroot.length + 1) : p.startsWith(home + "/") ? "~/" + p.slice(home.length + 1) : p; };
  const byPath = new Map<string, Set<string>>();
  for (const s of slots) for (const it of s.items) for (const f of it.found || [])
    if (f.path) { const k = realpath(f.path); if (!byPath.has(k)) byPath.set(k, new Set()); byPath.get(k)!.add(it.id); }
  const out: Record<string, any[]> = Object.fromEntries(KINDS.map(k => [k, []]));
  const seen = new Set<string>();
  const add = (kind: string, label: string, path: string | null, detail: string | null = null) => {
    const key = `${kind}|${label}|${path ? realpath(path) : ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const [scope, pkg] = kind === "plugins" ? ["plugin", label] : progress.where(path, root, freeReinDir);
    const plugin = kind === "plugins" ? label : path ? pluginOf(path) : null;
    if (pkg && kind !== "plugins") detail = [detail, `from ${pkg}`].filter(Boolean).join(" · ");
    out[kind].push({ label, path, detail, scope: plugin ? "plugin" : scope ?? "project", pkg, plugin,
      pieces: path ? sorted([...(byPath.get(realpath(path)) ?? [])]) : [] });
  };
  const pathOf = (n: any) => (n.provenance || {}).path ?? null;
  for (const n of nodes) {
    const p = pathOf(n);
    if (n.type === "surface") add("instructions", p ? name(p) : n.label ?? n.id, p, n.injection === "on-trigger" ? "loads in its folder" : null);
    else if (n.type === "unit" && n.activation === "semantic") add("skills", n.label ?? n.id, p);
    else if (n.type === "executor" && n.kind === "subagent") add("agents", (n.label ?? n.id).replace(/^agent:/, ""), p);
    else if (n.type === "executor" && n.kind === "mcp") add("mcp", (n.label ?? n.id).replace(/^mcp:/, "").replace(/@\w+$/, ""), p);
    else if (n.type === "executor" && n.activation === "event" && bound.has(n.id)) add("hooks", p ? name(p) : n.label ?? n.id, p, n.event ?? null);
  }
  for (const s of homeSkills) add("skills", s.label, s.path ?? null);
  for (const [kind, specs] of Object.entries(FILES))
    for (const [dir, rx] of specs) {
      const base = dir.startsWith("~/") ? expanduser(dir) : join(root, dir);
      for (const p of files(base, rx, dir.endsWith("rules") || dir.endsWith("instructions")))
        if (runtimes.visible(p, root, runtime)) add(kind, name(p), p);
    }
  for (const kind of KINDS) for (const x of out[kind]) if (x.plugin && kind !== "plugins") add("plugins", x.plugin, null);
  return KINDS.map(kind => ({ kind, items: sorted(out[kind], x => [x.scope, x.label]) }));
}
