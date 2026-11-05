# Developing the Free Rein extension

The extension's own README (`README.md`) is what the Marketplace shows; this is
for working on it. `CONTRIBUTING.md` at the top of the repo has the rest.

## Run it

Needs Node 22 or later. Nothing else: the extension carries Free Rein's core and data.

```sh
npm run setup                 # from the top of the repo: installs core/ and vscode/
npm run compile --prefix vscode
```

Then open the `vscode/` folder in VS Code and press F5. A second VS Code
window opens with the extension loaded; open any repo in it and run
**Free Rein: Open your harness**.

To install it in your everyday VS Code (or Cursor) without publishing:

```sh
npm run package                     # makes free-rein-<version>.vsix
code --install-extension free-rein-<version>.vsix
```


## Developing it (no reinstalling)

Open `vscode/` in VS Code or Cursor and press **F5**. Pick a launch:

- **Free Rein on a scratch copy (safe to change)**: a fresh copy of the kitchen
  sample (`samples/kitchen`) at `/tmp/free-rein-scratch/kitchen`, made each launch and committed to git, so you
  can apply upgrades freely and see exactly what changed (`git diff`).
- **Free Rein on this repo**: this repo (careful with Apply).

While it runs, a watch task recompiles the extension and rebuilds the board,
the core and the data on every save (`vscode/board/`, `core/src/`, `model/`). In the development window:

- the **board** and the **sidebar** refresh by themselves;
- anything else (commands, markers, trees): press **⌘R** to reload the window.

Core changes (`core/src/`) apply once the watch task has rebuilt: click ↻ in the sidebar.

## How it fits together

- `src/extension.ts`: commands, the harness picker, status bar, file watcher, opening files.
- `src/sidebar.ts`: the Harness view (summary and trust check), in VS Code's theme colours.
- `src/tree.ts`: the Pieces view.
- `src/state.ts`: recent harnesses, trust answers per harness, the trust comparison.
- `src/upgrade.ts`, `src/plan.ts`: upgrades (plan, side-by-side changes, apply, undo, the request for the agent); the plans come from Free Rein's core (`core/src/write/changes.ts`).
- `src/trace.ts`, `src/trace-index.ts`: markers, gutter dots and hovers in files, and the weak spots & achievements view.
- `src/read.ts`: runs Free Rein's core (`media/core/`) in a worker thread: reading, plans, drafts, the dry run.
- `src/page.ts`: the webview page, with a strict content security policy.
- `media/board.*`, `media/core/`, `media/model/`: the board (from `board/`), Free Rein's core (from `core/`) and
  its data (from `model/`), built by `scripts/build-board.mjs` (run by `npm run compile`). Don't edit
  these; edit their sources.
- `media/lucide.min.js`: Lucide icons (ISC licence), bundled because the
  webview can't load scripts from a CDN.

Everything comes from Free Rein's core, so the extension and the command line (`free-rein`, in `core/`) report the
same thing. With a Free Rein repo nearby (`freeRein.path`, or the repo it runs from while you work on it) it reads
that repo's data, so a change there shows at once; otherwise its own copy.

`npm test` reads the kitchen and solo samples (and any real harnesses named in
`FREE_REIN_TEST_HARNESSES`, separated by `:`), an empty folder, and checks the webview page.

`npm run e2e` runs the extension inside a real editor on a scratch copy of
the solo sample (a clean, temporary profile): it activates, marks `CLAUDE.md`,
applies Blocking hooks for real, checks the hook refuses `.env`, and undoes it. Point it at an installed editor with `FREE_REIN_EDITOR`:

```sh
FREE_REIN_EDITOR="/Applications/Cursor.app/Contents/MacOS/Cursor" npm run e2e
```

After installing a new `.vsix` into a running editor, reload the window:
VS Code and Cursor don't fully pick up an updated extension until then.
