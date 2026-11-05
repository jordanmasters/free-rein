# AGENTS.md

Free Rein reads an AI agent's harness (instructions, skills, tools, agents,
guardrails, memory, environment) and shows what it has, what it lacks, how the
pieces affect each other, and how much it is trusted to do on its own.
Tagline: *Look before you let go.*

## Layout

- `core/`: Free Rein itself, in TypeScript, in four steps (`core/src/README.md`
  maps every file): `src/read/` reads a harness into a graph, `src/judge/`
  evaluates its pieces, situations and lint, `src/report/` builds the board's
  data, the harness document and `free-rein check`, `src/write/` makes upgrades and
  drafts. `free-rein` is its command line (`out/src/cli.js`); `core/README.md` lists
  the commands. `src/py.ts` keeps the behaviour of the Python version Free Rein was
  first written in (Unicode regexes, rounding, `json.dumps`' form): keep using it.
- `model/`: Free Rein's model in words and as data. `graph-schema.md` (start here),
  `pieces.json` (pieces, sections, combos, tiers, progression, trust),
  `runtimes/<id>.json` (how each runtime does each piece, every answer a
  `{how, status, source}` record), `profiles.json`, `models.json`, `ways.json`,
  `editors.json` (Cursor's and VS Code's customization views, mapped);
  JSON Schemas in `schema/`; the parts catalog in `parts/`. Never edit
  `model/parts/CATALOG.md` by hand: `node model/parts/render.mjs` renders it.
- `samples/`: sample harnesses (kitchen has one of everything; solo is small)
  that the tests, the docs and the preview read. `.free-rein.json` declares them, so
  Free Rein's check of its own repo leaves them out.
- `vscode/`: the VS Code extension. The board's source is `vscode/board/`;
  `scripts/build-board.mjs` builds `media/` (not in git) and bundles the core
  and the data, so the installed extension needs nothing else.
- `docs/plugins.md`: how a framework teaches Free Rein its parts (a plugin).
- `skills/`: skills `install.sh` links into `~/.claude/skills`.
- `examples/`: a browser preview of the board (`preview.mjs`).
- `docs/glossary.md`: the words Free Rein uses (piece, situation, level, verdicts).

## Commands

Node 22 or later (`.nvmrc`); macOS and Linux.

- `npm run setup`: install both packages (`npm ci` in `core/` and `vscode/`)
  and turn on the git hooks.
- `npm test`: the core's behaviour tests and saved outputs, then the
  extension's tests. `npm run e2e` runs the extension in a real editor.
- `npm run package`: build the extension's `.vsix` (in `vscode/`).
- `npm run golden`: refresh the saved outputs (`core/test/golden/`) after a
  deliberate change. Review the diff before keeping it: only what you meant to
  change should move.
- `node core/out/src/cli.js check <folder>`: Free Rein's check of a harness.
- Git hooks (`.githooks/`, on after `npm run setup`): before a commit, no
  secrets, home-folder paths, huge files or hand-edited `CATALOG.md`; the
  commit message's form; before a push, the tests. Don't skip them with
  `--no-verify` unless the person asks.

## How to work here

- Logic belongs in `core/`; the board, the extension and the CLI display what
  the core returns.
- Test against more than one harness: the kitchen and solo samples, a plain
  Claude Code repo, and one with a framework on top (`FREE_REIN_TEST_HARNESSES`
  names extra folders for the tests, separated by `:`).
- Tests never depend on the machine: each test process starts with an empty
  home folder and no plugins (`core/test/helpers.ts`). A test that needs a home
  or a plugin sets its own.
- The sample harnesses in `samples/` are kept byte for byte (some
  use CRLF on purpose; `.gitattributes`). Don't reformat them.
- Every runtime answer is `{how, status, source}`: confirmed, believed or none.
  Never add a claim without a source, and record the version it was checked
  against. Claude Code is closed source: describe its behaviour, never assert
  its internals.
- Don't copy text or code from outside projects. Build from our own model and
  from primary sources (vendor docs); credit influences in docs.
- Plain language in the UI. Explain before abbreviating; no jargon a harness
  user wouldn't use.
- Security: reading a harness only reads files. Anything that writes to it or
  runs its code (hooks, installers) must stay behind the user's action and,
  in the extension, workspace trust. Nothing leaves the machine.

## Commits

Format `action(target): message`. Actions: `feat` `fix` `refactor` `docs`
`chore`. Targets: `core` `vscode` `data` `infra`.
