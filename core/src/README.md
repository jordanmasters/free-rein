# core/src

Free Rein reads a harness, judges it, and reports on it or changes it. Each folder
is one of those steps; data flows read → judge → report or write.

## read/: what the harness is

| File | What it does |
|---|---|
| `extract.ts` | Reads a harness folder into a graph of nodes and edges (`model/graph-schema.md`): instructions, skills, hooks, settings, agents, MCP servers, and what each reads or writes |
| `statements.ts` | The prose of a harness as typed statements (rules, steps, pointers) |
| `discover.ts` | Finds harnesses in or near a folder |
| `git.ts` | Which files git tracks, read from `.git/index` (no git command runs): committed is shared with your team, the rest only yours |
| `models.ts` | Which AI models a harness uses, for what, and where they run |
| `runtimes.ts` | Which files each runtime reads (Claude Code, Codex, Cursor, …) |
| `plugins.ts` | Loads frameworks' plugins (`docs/plugins.md`) |
| `spec.ts` | Loads Free Rein's model (`model/pieces.json`, `model/runtimes/`) |
| `home.ts` | Whether your home folder (`~/.claude`) counts, where Claude Code keeps a folder's sessions and memory, and which home folders belong to this repo alone |
| `memory.ts` | The notes your agent keeps for itself (Claude Code's auto memory, Codex's memories): the index that loads at the start, each note's type, date and the files it names |

## judge/: how it stands

| File | What it does |
|---|---|
| `evaluate.ts` | Each piece's state and level, combos and weak spots, XP: the model applied to one harness |
| `progress.ts` | Where each piece is, how far it has matured, which pieces guard which |
| `customizations.ts` | What an editor's customization view would list: each instruction file, skill, command, agent, hook, MCP server and plugin the runtime loads, and the pieces it gives |
| `tiers.ts` | The tiers (Equipped, Tuned, Enforced, Proven) for pieces that have them |
| `hardening.ts` | Each skill's profile: what it needs, has and lacks |
| `oversight.ts` | Situations: what happens when the agent does each risky thing, and what decides it |
| `simulate.ts` | Settings, permission rules and hooks as Claude Code applies them; the dry run of a task |
| `backing.ts` | Which rules in the prose something enforces, and which only ask |
| `lint.ts` | Findings a person can act on (dangling references, unguarded writes, …) |
| `loops.ts` | Loops at four scopes (each action, step, route, over time): each place one runs, its trigger, who judges, what comes back, what stops it, and its verdict |
| `flows.ts` | How work flows: steps and their roles, handoffs with the sentence that says when, the main routes, gates and loops across steps |
| `moves.ts` | Everything worth doing next, in one list: risky situations, rules nothing enforces, loop and flow findings, the next pieces; merged and ranked |
| `freerein.ts` | Free rein: the share of actions the agent does on its own, the written rules (measured, enforced, only asked), and each kind of action's words beside what happens |
| `checks.ts` | How Free Rein knows: every check it makes (pieces, situations, rules in prose, lint, loops, the runtime's record), by how it knows (read, matched, recorded), with what each found |
| `symptoms.ts` | "Something wrong?": which pieces answer each symptom in `model/symptoms.json`, and which are missing |

## report/: what it says

| File | What it does |
|---|---|
| `board.ts` | Everything the board draws, for one harness or a profile, with a draft measured on a copy |
| `harness.ts` | The harness document (`free-rein.harness/1`, `model/schema/harness.schema.json`) |
| `score.ts` | The reference scorer: XP and level from a harness document (also built into the board) |
| `check.ts` | `free-rein check`: findings with a level, a place and a fix; text, JSON or SARIF |
| `review.ts` | The agent review: the brief for your agent, the sensitive files it mustn't read (named, never opened), and its review read back, keeping only findings whose quotes check out |
| `words.ts` | Context: everything the agent reads (instructions, skills, its own notes), when each loads, where it applies, who wrote it, and what it says, sentence by sentence, with your agent's reading laid over |
| `stack.ts` | The layers: the levels a runtime reads a harness at (its own words, from `model/runtimes/<id>.json`), what's at each and where it came from, what each sets, how they combine |

## write/: what it changes

| File | What it does |
|---|---|
| `changes.ts` | Upgrades: each template's file changes, the plan with its measured effect, a request for the agent |
| `drafts.ts` | A draft's combined edits, creating a harness, putting files back |
| `packages.ts` | Packages you can try in a copy (frameworks, Free Rein's skills, Claude Code plugins) |

## At the top

- `cli.ts`: the `free-rein` command line. `worker.ts`: the core in a worker thread,
  for the extension. `index.ts`: what the package exports.
- `py.ts`: Free Rein was first written in Python; this keeps its behaviour
  (Unicode regular expressions, rounding, JSON's form), so results match. Use
  it for text, paths and regular expressions.
