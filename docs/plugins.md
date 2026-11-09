# Plugins: teaching Free Rein a framework

Free Rein reads what a runtime gives a harness (Claude Code's CLAUDE.md files,
skills, settings, hooks, agents, MCP servers) without help. Many harnesses add a
**framework** on top: a set of modes, protocols, its own tools and hooks, a
knowledge base, review gates. A framework ships a **Free Rein plugin** so Free Rein reads
its parts as natively as Claude Code's own: on the board in the framework's own
colour, in the checks, in the situations, and as a package you can try in a
draft and install.

A plugin is one JavaScript file (CommonJS, no dependencies needed). The sample
in `samples/plugins/tidy.js` uses every point below; Free Rein's tests
read it.

## Installing a plugin

Free Rein loads every `*.js` file (or folder with an `index.js`) in
`~/.free-rein/plugins/`. A framework's own install script can link its plugin there:

```bash
mkdir -p ~/.free-rein/plugins && ln -sf "$PWD/free-rein-plugin.js" ~/.free-rein/plugins/<framework>.js
```

`FREE_REIN_PLUGINS` (paths separated by `:`, each a plugin file, a plugin folder
with an `index.js`, or a folder of plugins) replaces that folder; set to an
empty value, no plugins load. A plugin that fails to load, or whose step throws
while Free Rein reads, is left out and doesn't stop Free Rein: the command line says
which and why (`free-rein: plugin problem: …` on stderr).

## A plugin is code you choose to run

A plugin is ordinary JavaScript. Free Rein runs it with your permissions, in the
command line and in the VS Code extension, each time it reads a harness, so it
can do whatever a program you start can do. Treat installing one like running
the framework's own installer: only from a framework you trust, and look at what
it links into `~/.free-rein/plugins/` first.

What Free Rein does on its side:

- It loads plugins only from your own setup (`~/.free-rein/plugins/` or
  `FREE_REIN_PLUGINS`), never from the harness it reads. Opening a folder never
  runs a plugin that folder contains.
- A plugin's installer (`installInto`) runs on a temporary copy of the harness
  when Free Rein tries the package in a draft. It changes your harness only when
  you apply the draft, and in VS Code only in a folder you trust.
- `free-rein check` says on stderr which plugins loaded
  (`free-rein: plugins loaded: …`), and which failed and why.

## The smallest plugin

```js
// ~/.free-rein/plugins/notes.js: a framework that keeps its notes in notes/ and a config in .notes.json
const fs = require("fs"), path = require("path");
module.exports = {
  id: "notes", name: "Notes", colour: "#7FB3D5", icon: "NotebookPen",
  detect: root => fs.existsSync(path.join(root, ".notes.json")),
  afterSignals(ctx) {
    // a node with provenance: findings about it are shown at its file
    ctx.g.node("config", "notes.json", { provenance: { path: path.join(ctx.root, ".notes.json") } });
  },
  lint(g, root, kit) {
    return fs.existsSync(path.join(root, "notes")) ? []
      : [kit.finding("notes-missing", "warning", "config:notes.json", "the config names notes/, which isn't there",
          { title: "Make the notes folder", what: "Its config points at a folder that doesn't exist.", why: "Nothing it writes can land.", fix: "Create notes/ or fix .notes.json." })];
  },
};
```

Run `free-rein lint .` in a harness with a `.notes.json` and no `notes/`: the
finding is there, and `free-rein check .` shows it at `.notes.json`.

## What a plugin says

```js
module.exports = {
  id: "tidy",                 // how Free Rein refers to it (as a package, a layer, a supplier)
  name: "Tidy",               // how people see it
  colour: "#7FB3D5",          // what it supplies is marked in this colour on the board
  icon: "Sparkles",           // its layer's icon (a Lucide icon name)
  detect: root => ...,        // does this harness use it? Only then are its parts read
  ownRepo: root => ...,       // is this the framework's own repo? (its files count as the framework's)
  // ...then any of the points below
};
```

### Reading

Called in this order while Free Rein reads a harness that uses the plugin. Each gets
a context, `ctx`:

| Property | What it is |
|---|---|
| `ctx.g` | the graph so far: `node(type, name, attrs)` adds a node with id `type:name`; `edge(type, source, target, attrs)`; `nodes` (a Map by id) and `edges` |
| `ctx.root` | the harness folder |
| `ctx.home` | `~/.claude` |
| `ctx.skills` | the harness's skill names |
| `ctx.read(path)` | a file's text, or `""` |
| `ctx.hookNode(path, event)` | adds a script a hook runs, as Free Rein does for any hook |
| `ctx.kit` | Free Rein's own helpers, so text is read exactly as the rest of Free Rein reads it |

| Point | When | What it adds |
|---|---|---|
| `afterSkills(ctx)` | after the skills | its documents: protocols, specs (as `contract` nodes, say) |
| `skillEdges(ctx, src, body)` | for each skill | edges from a skill's text to its tools |
| `ownHooks(ctx)` | before settings | its own hook scripts (`ctx.hookNode(path, event)`; a script that can refuse becomes a gate) |
| `ownHookFor(ctx, command)` | each settings hook | the executor a command runs, when it's one of its own scripts |
| `afterSignals(ctx)` | near the end | its config, specs, and what its tools write |
| `contexts(ctx)` | last | which of its modes each node is live in (`node.contexts`) |
| `vaults(root, read)` | any harness | knowledge-base folders its config names: `[[folder, "configured in …"]]` |
| `owns(root, read)` | a harness that uses it | the files and folders that are its own, wherever its config puts them (its config, its vaults, what its tools write as they run): `[".claude/tidy.json", "notes"]`. Free Rein credits what's there to the plugin |

### Checking

| Point | What it returns |
|---|---|
| `lint(g, root, kit)` | findings: `kit.finding(class, "serious" \| "warning" \| "info", subject, detail, {title, what, why, fix})` |
| `lintCatalog(root, kit)` | findings about a catalog the framework keeps |

`free-rein check` reports them with everything else, at the file of what they're
about: give the finding's subject as a node id (`config:notes.json`), and that
node a `provenance: {path, lines}`; or as `path:line`, relative to the harness.
A finding with neither is shown at the harness's main file.

### Situations

| Point | What it returns |
|---|---|
| `situations(root)` | situations its rules make: `[{stakes, tool, target, what}]` (writes to its knowledge base, say) |
| `gates(root, target)` | its review gates that ask you before a write to `target`: `[{label, path, lines}]` |

A gate makes a write *ask you first*, decided by `human-gate`; the situation's
verdict, the trust it backs and the level follow from that, as for any rule.

### Installing

```js
package: {
  name, about, parts: ["skills", "modes", "a vault"], install: "Run /init in the repo", runs_on: ["claude"],
  locate: () => "/where/the/framework/repo/is" /* or null when it isn't on this machine */,
  installInto(dst, repo) { /* what its installer does, with its defaults */ },
  installed: root => ... /* did its installer set this folder up? (default: detect) */,
}
```

With a package, the framework appears among what you can add. A draft tries it
on a copy of the harness, and what its installer wrote counts as the
framework's, on the board and in the levels. In a harness its installer set up,
Free Rein compares each file with what the installer writes, so files you've
changed since show as the framework's, changed by you.

## Keeping it native

- Use `ctx.kit.re` for regular expressions and `ctx.kit.py` for text and paths:
  Free Rein reads the way Python 3 does (Unicode-aware `\w` and `\b`, universal
  newlines), and a plugin that does the same reads the same text the same way.
- Add to the graph with Free Rein's node types (`contract`, `executor`, `config`,
  `substrate`, `gate`, `sink`; see `model/graph-schema.md`), so Free Rein's pieces,
  checks and situations understand them without knowing the framework.
- Only add what's in the harness: a plugin describes, it doesn't guess.
