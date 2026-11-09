// Plugins: frameworks and toolkits that sit on top of a runtime (a set of modes, a vault, review gates) and
// that Free Rein should read as natively as Claude Code's own parts. A plugin is a JavaScript module that tells
// Free Rein how to find its parts, what to check, which of its rules ask you first, and how to install it; Free Rein
// calls it at fixed points while it reads a harness. None ship with Free Rein: each framework ships its own.
//
// Where Free Rein finds them: the files or folders named in FREE_REIN_PLUGINS (separated by ":"; set but empty means
// none), else every *.js file, or folder with an index.js, in ~/.free-rein/plugins/.
import * as fs from "fs";
import * as path from "path";
import { home } from "./home";
import type { Graph } from "./extract";
import type { Finding, Severity } from "../judge/lint";

/** What Free Rein hands a plugin while it reads a harness: the graph so far, and helpers that read files and text
 * exactly as the rest of Free Rein does (see kit). */
export interface ReadContext {
  g: Graph;
  root: string;
  /** ~/.claude */
  home: string;
  /** the harness's skills, by name */
  skills: string[];
  /** a file's text, or "" */
  read(p: string): string;
  /** add a script a hook runs as an executor (and as a gate when it can refuse), as Free Rein does for any hook */
  hookNode(p: string, event: string): void;
  kit: Kit;
}

/** Free Rein's own helpers, so a plugin reads text the way Free Rein does (Python-compatible regular expressions and
 * text handling: see py.ts). */
export interface Kit {
  re: typeof import("../py").re;
  flags: typeof import("../py").flags;
  py: typeof import("../py");
  firstParagraph(text: string): string;
  pyDocstring(text: string): string;
  lineCount(text: string): number;
  checkpointRules(text: string, rel: string): any[];
  statementInventory(body: string, skills: Iterable<string>): any;
  normPath(p: string): string;
  isSubstratePath(p: string): boolean;
  isAuthoritative(p: string): boolean;
  /** a lint finding in Free Rein's shape (class, severity, subject, detail); own gives a class of the plugin's own its words */
  finding(cls: string, severity: Severity, subject: string, detail: string, own?: { title: string; what: string; why: string; fix: string }): Finding;
}

export interface Package {
  name: string;
  /** what it is, in a sentence */
  about: string;
  /** what it brings: "skills", "modes", "a vault", "review gates", … */
  parts: string[];
  /** how a person installs it, in words */
  install: string;
  runs_on: string[];
  /** where the plugin's own repo is on this machine, or null when it isn't here */
  locate(): string | null;
  /** install it into a folder the way its installer does, with its defaults */
  installInto?(dst: string, repo: string): void;
  /** did its installer set this folder up? (default: detect) */
  installed?(root: string): boolean;
}

export interface Plugin {
  id: string;
  name: string;
  /** how the board shows what it supplies: a CSS colour, and an icon name from Lucide */
  colour?: string;
  icon?: string;
  /** does this harness use it? Its parts are read only then. */
  detect(root: string): boolean;
  /** is this harness the plugin's own repo? (its project files then count as the plugin's) */
  ownRepo?(root: string): boolean;

  // reading: called in order while Free Rein reads a harness, only when detect(root) holds
  /** after the skills are read: the plugin's own documents (protocols, specs) */
  afterSkills?(ctx: ReadContext): void;
  /** for each skill: edges from its text to the plugin's tools (src is the skill's node id) */
  skillEdges?(ctx: ReadContext, src: string, body: string): void;
  /** before the settings are read: the plugin's own hook scripts (use ctx.hookNode) */
  ownHooks?(ctx: ReadContext): void;
  /** a hook command that runs one of the plugin's own scripts: the executor's id, or null */
  ownHookFor?(ctx: ReadContext, command: string): string | null;
  /** after the settings-shaped signals: the plugin's own config, specs, and what its tools write */
  afterSignals?(ctx: ReadContext): void;
  /** the contexts (modes, presets) each node is live in; called after everything else */
  contexts?(ctx: ReadContext): void;
  /** the knowledge bases it configures: [folder, how Free Rein knows] (read for every harness) */
  vaults?(root: string, read: (p: string) => string): [string, string][];
  /** the files and folders in this harness that are its own, wherever its config puts them: its config, the vaults it
   *  configures, what its tools write as they run. Repo-relative, forward slashes; a folder covers what's in it. Free Rein
   *  credits what's there to the plugin (only when detect(root) holds) */
  owns?(root: string, read: (p: string) => string): string[];

  // checking
  /** lint findings, after the core's vocabulary check */
  lint?(g: Graph, root: string, kit: Kit): Finding[];
  /** checks over a catalog the plugin keeps, after the core's other checks */
  lintCatalog?(root: string, kit: Kit): Finding[];

  // situations
  /** situations its rules make: [{stakes, tool, target, what}] */
  situations?(root: string): { stakes: string; tool: string; target: string; what: string }[];
  /** its review gates that ask you before a write to this path: [{label, path, lines}] */
  gates?(root: string, target: string): { label: string; path: string; lines: (number | null)[] }[];

  /** what you could add: the plugin as a package, with its installer */
  package?: Package;
}

let cache: { key: string; list: Plugin[]; errors: string[] } | null = null;

/** Where plugins load from: FREE_REIN_PLUGINS (files or folders of plugins, separated by ":"; empty: none), else
 * ~/.free-rein/plugins. Each is a .js file, or a folder with an index.js. */
export function pluginFiles(): string[] {
  const env = process.env.FREE_REIN_PLUGINS;
  const list = (dir: string) => { try { return fs.readdirSync(dir).sort().map(f => path.join(dir, f)); } catch { return []; } };
  if (env === undefined) return list(path.join(home(), ".free-rein", "plugins"));
  // a folder that isn't a plugin itself (no index.js) is a folder of plugins
  return env.split(":").filter(Boolean).flatMap(e => isDir(e) && !fs.existsSync(path.join(e, "index.js")) ? list(e) : [e]);
}

const isDir = (p: string) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function loadAll() {
  const files = pluginFiles();
  const key = files.join("\0");
  if (cache && cache.key === key) return cache;
  const list: Plugin[] = [], errors: string[] = [];
  for (const f of files) {
    const p = isDir(f) ? path.join(f, "index.js") : f;
    if (!p.endsWith(".js") && !p.endsWith(".cjs")) continue;
    try {
      const mod = require(p);
      const plugin: Plugin = mod.default ?? mod;
      if (!plugin || typeof plugin.id !== "string" || typeof plugin.detect !== "function") errors.push(`${f}: not a plugin (it needs an id and a detect function)`);
      else if (list.some(x => x.id === plugin.id)) errors.push(`${f}: a plugin with the id "${plugin.id}" is already loaded`);
      else list.push(plugin);
    } catch (e: any) { errors.push(`${f}: ${String(e?.message ?? e).split("\n")[0]}`); }
  }
  return (cache = { key, list, errors });
}

/** The plugins on this machine. A plugin that fails to load is left out (and doesn't stop the read); pluginErrors()
 * says why. */
export const plugins = (): Plugin[] => loadAll().list;

/** Why each plugin that didn't load didn't, and each plugin step that failed while reading. */
export const pluginErrors = (): string[] => loadAll().errors;

/** A plugin's step failed: it's left out, and recorded for pluginErrors() (once per plugin and step). */
export function pluginFailed(p: Plugin, step: string, e: any): void {
  const msg = `${p.id} (${step}): ${String(e?.message ?? e).split("\n")[0]}`;
  const errs = loadAll().errors;
  if (!errs.includes(msg)) errs.push(msg);
}

/** fn(p), or fallback when the plugin's step fails (recorded) */
export function tryPlugin<T>(p: Plugin, step: string, fn: () => T, fallback: T): T {
  try { return fn(); } catch (e) { pluginFailed(p, step, e); return fallback; }
}

/** The plugins this harness uses. */
export const used = (root: string): Plugin[] => plugins().filter(p => { try { return p.detect(root); } catch { return false; } });

/** The plugin whose own repo this is, if any. */
export const ownerOf = (root: string): Plugin | null => plugins().find(p => { try { return !!p.ownRepo?.(root); } catch { return false; } }) ?? null;
