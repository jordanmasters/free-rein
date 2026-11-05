# Free Rein

**See how much free rein your agent has.**

*Your rules say one thing. What does your agent actually do?*

Your `CLAUDE.md` says "never push to main". Does anything stop the agent if it
tries? An AI coding agent is only as good as its **harness**: the instructions,
skills, tools, hooks, permission rules, sandboxes and memory around it. Free Rein
reads a harness and shows what it has, what it lacks, how the pieces affect each
other, and how far the agent can be trusted to act on its own.

![The Harness view of the kitchen sample: 62 kinds of piece around the agent](vscode/images/board.png)

What it answers:

- **One harness, across runtimes.** Claude Code, Codex, Cursor, GitHub Copilot,
  Gemini CLI and OpenCode, read with one model. More to come.
- **Written versus enforced.** Which rules in your instructions are actually
  backed by a hook, a permission rule or a sandbox, and which only ask.
- **How far it can act alone.** What happens in each risky situation, and what
  decides it.

Free Rein reads files on your machine. It uses no AI model and sends nothing
anywhere. The one exception is a preview you have to turn on and start
yourself: the agent review, which hands the harness to your own agent (see
NOTICE.md).

![The Free rein view: one square per action, by what happens when the agent tries it](vscode/images/free-rein.png)

## What's in it

- **The model** (`model/graph-schema.md`, `model/pieces.json`): 62 kinds of
  pieces in 10 sections, how they guard each other, and the levels a piece goes
  through.
- **The runtime data** (`model/runtimes/<id>.json`): how each runtime does
  each piece, every claim with a source and the date and version it was checked.
- **The harness document** (`model/schema/harness.schema.json`): the facts about
  one harness, in a stable format other tools can build on.
- **The core** (`core/`, TypeScript): reads a harness into a graph, lints it,
  evaluates its pieces, plays out its situations (trust and friction), builds the
  board's data, and writes upgrades and drafts. `free-rein` is its command line.
- **The board** (`vscode/`): a VS Code extension that draws a harness as a ring of
  pieces around the agent it wraps.

## Try it

- **In VS Code or Cursor:** install **Free Rein** from the Marketplace or Open
  VSX (`free-rein.free-rein`), open a repo, and run **Free Rein: Open your
  harness**. See `vscode/README.md`.
- **On the command line** (Node 22 or later, macOS or Linux):

  ```bash
  npx free-rein check .        # what needs attention, with where and how to fix it
  npx free-rein upgrades .     # what it could add, and how
  npx free-rein read .         # the harness document, as JSON
  ```

  `free-rein check` also runs in CI and writes SARIF for GitHub code scanning:
  see `core/README.md`.

From a clone:

```bash
npm run setup && npm run build --prefix core
node core/out/src/cli.js check samples/solo     # or your own repo
node examples/preview.mjs samples/solo          # the board in your browser
npm test
```

New words (harness, piece, situation, level): see `docs/glossary.md`. Working
on Free Rein: `CONTRIBUTING.md` and `AGENTS.md`.

## Status

**A preview.** Free Rein works, and it changes often: the board, the command
line and the harness document (`free-rein.harness/1`) may all change before
1.0. Its claims about each runtime are dated and sourced, and runtimes change
too; `model/runtimes/<id>.json` says when each was last checked.

**Maintained by one person, in spare time.** Issues are read, usually within a
week or two; a fix may take longer. Reports of a harness Free Rein reads
wrongly, or of a runtime claim that's out of date, are the most useful; see
CONTRIBUTING.md.

## Licence

[MIT](LICENSE), for the code and the model data. The name, the logo and
the icon aren't covered by it: forks are welcome under another name and icon
(see [TRADEMARKS.md](TRADEMARKS.md)).

Free Rein is independent of the runtimes it reads; see NOTICE.md.
