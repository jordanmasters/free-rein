// Packages you could add to a harness (frameworks that have a Free Rein plugin, Free Rein's own skills, Claude Code plugins
// on this machine), and
// which files in a folder a package's installer put there; and trying a package in a copy of the harness.
import * as fs from "fs";
import * as os from "os";
import { repoDir } from "../read/spec";
import { plugins } from "../read/plugins";
import { join, dirname, basename, isdir, isfile, islink, realpath, relpath, glob, sorted, walk, readText, get, or } from "../py";

const FREE_REIN = repoDir;
import { home as HOME } from "../read/home";
const markets = () => join(HOME(), ".claude", "plugins", "marketplaces");
/** folders a copy of the harness leaves out (as a copy of the harness skips) */
import { SKIP } from "./changes";
export { SKIP };
function pluginAbout(market: string): Record<string, string> {
  try {
    const v = JSON.parse(readText(join(market, ".claude-plugin", "marketplace.json")));
    return Object.fromEntries((get(v, "plugins", []) as any[]).map(p => [p.name, get(p, "description", "")]));
  } catch { return {}; }
}

function pluginParts(path: string): string[] {
  const parts: string[] = [];
  if (glob(join(path, "skills", "*", "SKILL.md")).length) parts.push("skills");
  if (glob(join(path, "agents", "*.md")).length) parts.push("agents");
  if (glob(join(path, "commands", "*.md")).length) parts.push("commands");
  if (isfile(join(path, "hooks", "hooks.json"))) parts.push("hooks");
  if (isfile(join(path, ".mcp.json"))) parts.push("MCP servers");
  return parts;
}

/** Every package Free Rein can try on this machine. */
export function catalog(): any[] {
  const out: any[] = [];
  // frameworks whose Free Rein plugin says where they are on this machine
  for (const p of plugins()) {
    if (!p.package) continue;
    let where: string | null = null;
    try { where = p.package.locate(); } catch { where = null; }
    if (where) out.push({ id: p.id, name: p.package.name, kind: "framework", path: where, about: p.package.about, parts: p.package.parts,
      install: p.package.install, runs_on: p.package.runs_on });
  }
  if (isdir(join(FREE_REIN(), "skills"))) out.push({ id: "Free Rein", name: "Free Rein", kind: "skills", path: join(FREE_REIN(), "skills"),
    about: "Free Rein's own skills, such as /address-findings.", parts: ["skills"], install: "Run install.sh in the Free Rein repo", runs_on: ["claude"] });
  for (const market of sorted(glob(join(markets(), "*")))) {
    const about = pluginAbout(market);
    for (const path of sorted([...glob(join(market, "plugins", "*")), ...glob(join(market, "external_plugins", "*"))])) {
      const name = basename(path);
      const parts = pluginParts(path);
      if (!isdir(path) || !parts.length || name === "example-plugin") continue;
      out.push({ id: name, name, kind: "plugin", path, market: basename(market), about: about[name] ?? "", parts,
        install: `/plugin install ${name}@${basename(market)}`, runs_on: ["claude"] });
    }
  }
  return out;
}

/** A framework's own installer, with its defaults, into a folder (its Free Rein plugin says how). */
export function installFramework(p: any, dst: string) {
  const plugin = plugins().find(x => x.id === p.id);
  plugin?.package?.installInto?.(dst, p.path);
}

/** {relative path: modified time} for a folder's files, linked folders counted as one entry. */
export function files(root: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [d, dirs, names] of walk(root, ds => ds.filter(x => !SKIP.has(x)))) {
    for (const n of names) {
      const p = join(d, n);
      try { out.set(relpath(p, root), Number(fs.lstatSync(p, { bigint: true }).mtimeNs)); } catch { /* gone */ }
    }
    for (const x of dirs) { const p = join(d, x); if (islink(p)) out.set(relpath(p, root), 0); }
  }
  return out;
}

/** Files in this folder that a package's installer puts there, and whether you've changed them since. */
export function installedBy(rootIn: string): Record<string, { pkg: string; changed: boolean }> {
  const root = realpath(rootIn);
  const out: Record<string, { pkg: string; changed: boolean }> = {};
  for (const p of catalog()) {
    const plugin = plugins().find(x => x.id === p.id);
    if (p.kind !== "framework" || !plugin?.package?.installInto) continue;
    const here = (() => { try { return plugin.package!.installed ? plugin.package!.installed(root) : plugin.detect(root); } catch { return false; } })();
    if (!here) continue;
    if (realpath(p.path) === root) continue;
    const tmp = fs.mkdtempSync(join(os.tmpdir(), "free-rein-installed-"));
    try {
      installFramework(p, tmp);
      const made = files(tmp);
      for (const rel of made.keys()) {
        const src = join(tmp, rel), mine = join(root, rel);
        if (isfile(src) && isfile(mine)) out[rel] = { pkg: p.id, changed: !fs.readFileSync(src).equals(fs.readFileSync(mine)) };
      }
      const dirs = new Set([...made.keys()].map(r => dirname(r)).filter(Boolean));
      const all = new Set([...dirs, ...[...dirs].map(r => r.split("/")[0])]);
      for (const d of sorted(all)) {
        const mine = join(root, d);
        if (isdir(mine) && d !== ".claude") {
          const theirs = new Set([...made.keys()].filter(r => r.startsWith(d + "/")));
          const have = new Set<string>();
          for (const [dp, , fs_] of walk(mine)) for (const f of fs_) have.add(relpath(join(dp, f), root));
          out[d] = { pkg: p.id, changed: [...have].some(h => !theirs.has(h)) || [...theirs].some(r => !!out[r]?.changed) };
        }
      }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  return out;
}

export { or };

// --- trying a package in a copy of the harness  ---

import { copyHarness } from "./changes";
import { loadsKeep, dumps, lexistsOf, items as pyItems } from "../py";

function link(src: string, dst: string) {
  fs.mkdirSync(dirname(dst), { recursive: true });
  if (!lexistsOf(dst)) fs.symlinkSync(src, dst);
}

/** json.load(open(p)) for a file a package or the copy holds; raises like Python on bad text */
const loadFile = (p: string) => loadsKeep(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(p)).replace(/\r\n?/g, "\n"));

/** Link a plugin's parts into the copy, the way Claude Code loads an enabled plugin. */
function installPlugin(p: any, dst: string) {
  const src = p.path;
  for (const sk of glob(join(src, "skills", "*", "SKILL.md"))) { const d = dirname(sk); link(d, join(dst, ".claude", "skills", basename(d))); }
  for (const kind of ["agents", "commands"]) for (const f of glob(join(src, kind, "*.md"))) link(f, join(dst, ".claude", kind, basename(f)));
  const hj = join(src, "hooks", "hooks.json");
  if (isfile(hj)) {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(hj)).replace(/\r\n?/g, "\n");
    const hooks = get(loadsKeep(text.split("${CLAUDE_PLUGIN_ROOT}").join(src)), "hooks", {});
    const sp = join(dst, ".claude", "settings.json");
    let st: any;
    try { st = loadFile(sp); } catch { st = {}; }
    for (const [ev, entries] of pyItems(hooks)) {
      if (!("hooks" in st)) st.hooks = {};
      if (!(ev in st.hooks)) st.hooks[ev] = [];
      st.hooks[ev].push(...entries);
    }
    fs.mkdirSync(dirname(sp), { recursive: true });
    fs.writeFileSync(sp, dumps(st, 2));
  }
  const mj = join(src, ".mcp.json");
  if (isfile(mj)) {
    let add = loadFile(mj);
    add = get(add, "mcpServers", add);
    const mp = join(dst, ".mcp.json");
    let cur: any;
    try { cur = loadFile(mp); } catch { cur = {}; }
    if (!("mcpServers" in cur)) cur.mcpServers = {};
    Object.assign(cur.mcpServers, add);
    fs.writeFileSync(mp, dumps(cur, 2));
  }
}

function installSkills(p: any, dst: string) {
  for (const sk of glob(join(p.path, "*", "SKILL.md"))) { const d = dirname(sk); link(d, join(dst, ".claude", "skills", basename(d))); }
}

/** A copy of the harness with these packages installed, and which files each one added: [tmp, copy, tags, tried]. */
export function trial(root: string, ids: string[]): [string, string, Map<string, string>, string[]] {
  const cat = new Map(catalog().map(p => [p.id, p]));
  const [tmp, dst] = copyHarness(root);
  const tags = new Map<string, string>(), tried: string[] = [];
  for (const i of ids) {
    const p = cat.get(i);
    if (!p) continue;
    const before = files(dst);
    ({ framework: installFramework, skills: installSkills, plugin: installPlugin } as any)[p.kind](p, dst);
    for (const rel of files(dst).keys()) {
      if (!before.has(rel)) { const full = join(dst, rel); tags.set(realpath(full), p.id); tags.set(full, p.id); }
    }
    tried.push(i);
  }
  return [tmp, dst, tags, tried];
}

export const cleanup = (tmp: string) => fs.rmSync(tmp, { recursive: true, force: true });
