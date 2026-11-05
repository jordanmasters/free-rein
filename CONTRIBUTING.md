# Contributing to Free Rein

Thanks for looking. Free Rein is early, open source under the MIT licence
(`LICENSE`), and contributions are welcome under it: a bug, a harness Free
Rein reads wrongly, or a claim about a runtime that's out of date. By
contributing you agree that your contribution is licensed under the MIT licence.

## Pace and scope

Free Rein has one maintainer, working on it in spare time. Issues are read,
usually within a week or two; a pull request may wait longer. For anything
bigger than a fix, open an issue first, so we can agree on it before you spend
the time.

Most welcome:

- a harness Free Rein reads wrongly (what it said, what's true, and a minimal
  example if you can share one);
- a claim about a runtime that's out of date or unsourced, with the vendor's
  page that says otherwise;
- bugs in the board, the extension or the command line, and wording that isn't
  plain.

Not for now: support for another runtime (each needs a sourced record and
someone to keep it current: open an issue to talk about it), profiles of hosted
AI products, and anything that sends data off the machine or has Free Rein call
a model itself.

## Sign off your commits (DCO)

Every commit is signed off under the [Developer Certificate of
Origin](https://developercertificate.org): you wrote the change, or have the
right to submit it under the project's licence. `git commit -s` adds the line:

```
Signed-off-by: Your Name <you@example.com>
```

## Set up

Node 22 or later (`.nvmrc`), on macOS or Linux.

```bash
npm run setup        # installs core/ and vscode/ (npm ci in each)
npm test             # the core's tests and saved outputs, then the extension's
npm run e2e          # the extension inside a real editor (downloads VS Code once,
                     # or FREE_REIN_EDITOR=<path to an installed VS Code or Cursor>)
```

`npm run setup` also turns on the repo's git hooks (`.githooks/`):

- **before each commit**: no secrets (with [gitleaks](https://github.com/gitleaks/gitleaks),
  `brew install gitleaks`; without it the hook only warns), no path into someone's
  home folder (`/Users/<name>/`), no file over 2 MB, and `CATALOG.md` matching its
  JSON. If you keep a list of words that must never be committed, point the hook at
  it: `git config freeRein.privateNames /path/to/list` (one regular expression a line;
  the list stays outside the repo).
- **on the commit message**: the `action(target): message` form (see Style).
- **before each push**: the full test suite.

`git commit --no-verify` (or `push --no-verify`) skips them once, when you're sure.
On GitHub the same checks and the tests run on every push and pull request
(`.github/workflows/`), and there they can't be skipped; a pull request's
commits must also be signed off.

`AGENTS.md` describes the layout and how to work here, for people and coding
agents alike.

To use your clone from Claude Code in other repos, `./install.sh` links it at
`~/.claude/free-rein` and its skill (`/address-findings`, which walks you
through each finding) into `~/.claude/skills`.

## Changes to the core

- Logic belongs in `core/`; the board, the extension and the CLI show what it
  returns.
- `core/test/golden/` holds saved outputs. After a deliberate change, run
  `npm run golden` and read the diff: only what you meant to change should move,
  and the pull request should say why it moved.
- Tests must not depend on your machine (each starts with an empty home folder
  and no plugins). Check against more than one harness: the kitchen and solo
  samples, and real ones through `FREE_REIN_TEST_HARNESSES`.
- Sample harnesses in `samples/` are kept byte for byte; don't
  reformat them.

## Claims about a runtime

Every answer in `model/runtimes/<id>.json` is `{how, status, source}`:
confirmed, believed, or no known way. A change needs a source (the vendor's
docs, changelog or release notes), the date it was checked and the version.
For closed-source runtimes, describe what they do; don't assert how they work
inside.

## Style

- Plain language in anything a person reads: explain before abbreviating.
- Don't copy text or code from other projects; credit influences in the docs.
- Commits: `action(target): message`, with actions `feat` `fix` `refactor`
  `docs` `chore` and targets `core` `vscode` `data` `infra`.

## Conduct

See `.github/CODE_OF_CONDUCT.md`. Security problems: see `.github/SECURITY.md`, not a public
issue.
