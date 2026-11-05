# Free Rein core

Free Rein itself, in TypeScript: it reads an AI agent's harness (instructions,
skills, hooks, permission rules, settings, memory) into a graph, lints it,
evaluates its pieces, plays out risky situations under the harness's own
rules, and builds what the board shows. `free-rein` is its command line.


New words (piece, situation, level, the verdicts): see `../docs/glossary.md`.

## Build

Needs Node 22 or later.

```bash
cd core
npm ci && npm run build
npm link            # optional: puts `free-rein` on your PATH
```

Without `npm link`, run it as `node core/out/src/cli.js`.

## Commands

Every command reads the harness at `ROOT` (default: the current folder) and
prints JSON, except `check`, which prints text unless asked otherwise.

| Command | What it gives you |
|---|---|
| `free-rein check [ROOT]` | What needs attention, most serious first. See below. |
| `free-rein read [ROOT]` | The harness document (`free-rein.harness/1`): pieces, statements, situations, combos. No scores. |
| `free-rein score DOC.json` | The reference scorer's XP and level for a harness document. |
| `free-rein lint [ROOT]` | The graph's lint findings only. |
| `free-rein upgrades [ROOT]` | What can be upgraded, and whether Free Rein has a template for it. |
| `free-rein plan ROOT PIECE` | One upgrade: its file changes (or a request for the agent) and their measured effect. |
| `free-rein board [ROOT]` | Everything the board draws. |
| `free-rein extract`, `statements`, `models`, `discover` | The graph, the prose as typed statements, the models in use, the harnesses in a folder. |
| `free-rein profiles`, `free-rein spec` | The example profiles; Free Rein's data as it reads it. |

`--no-home` leaves out what loads from your home folder (`~/.claude`) (`free-rein check`
leaves it out by default, so it reads the same on every machine; `--home` counts it);
`--runtime ID` reads the harness as another supported runtime would (claude,
codex, cursor, copilot (GitHub Copilot in VS Code), gemini or opencode);
any other id is an error.

## free-rein check

```bash
free-rein check                                  # text, for a person
free-rein check --format json                    # for a script
free-rein check --format sarif --output free-rein.sarif   # for code scanning
free-rein check --fail-on warning                # stricter: fail on warnings too
```

Findings come from four places:

- **The lint**: broken references, writes to your knowledge base that nothing
  checks, plans and builds that disagree, and so on.
- **Situations**: a high-stakes action (pushing, deleting, touching secrets,
  changing its own safeguards or instructions) that goes ahead with nothing
  stopping it (a warning), or that only Claude Code's own safety check decides
  (a note).
- **Your instructions**: a rule (never, always, ask first) that no permission
  rule, hook or approval step enforces (a warning).
- **Skills and friction**: a skill with no description or steps, routine work
  that asks you every time (notes).

Each finding says where it is (file and line, relative to the harness) and
what would fix it.

Exit codes: `0` nothing at or above `--fail-on` (default `error`); `1`
something is; `2` the command was wrong. `--fail-on none` never fails.

### In GitHub Actions

Code scanning shows each finding on the line it's about. The job clones Free Rein
and builds its core; replace `<free-rein>` with the Free Rein repository's clone URL
(while the repository is private, the job needs a token that can read it):

```yaml
name: Free Rein
on: [push, pull_request]
permissions:
  contents: read
  security-events: write
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: git clone --depth 1 <free-rein> "$RUNNER_TEMP/free-rein" && cd "$RUNNER_TEMP/free-rein/core" && npm ci && npm run build
      - run: node "$RUNNER_TEMP/free-rein/core/out/src/cli.js" check . --format sarif --output free-rein.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: free-rein.sarif, category: free-rein }
```

The SARIF holds only paths inside the harness, never your home folder or
anything else about the machine it ran on. (With `--home`, what your home folder's
settings allow or refuse, and commands from your recent Claude Code sessions in that folder,
can appear in the messages: keep that for your own use.)

## Sample harnesses in your repo

If your repo keeps other harnesses as samples (for tests, docs or demos), say
which folders in `.free-rein.json` at its root:

```json
{ "samples": ["samples/", "docs/examples/"] }
```

Free Rein leaves them out when it reads your repo's own harness, so their
instructions, skills and rules aren't counted as yours. Free Rein doesn't guess
from a folder's name: an undeclared `samples/`, `examples/` or `fixtures/`
folder with a `CLAUDE.md` is read, as Claude Code would load it when the agent
works there. (Finding the models a project uses, Free Rein does pass over test code,
in `tests/` and `test/`, which names models it doesn't use.)

## Tests

```bash
npm test          # behaviour tests and saved outputs
npm run golden    # after a deliberate change: rewrite the saved outputs, then review the diff
```

`src/py.ts` keeps the behaviour of the Python version Free Rein was first written
in (Unicode-aware regular expressions, rounding halves to even, `json.dumps`'
form), so files Free Rein writes stay the same as before.
