# Glossary

The words Free Rein uses, in the order you meet them.

**Harness.** Everything around an AI coding agent that shapes what it does:
its instructions (`CLAUDE.md`, `AGENTS.md`), skills, tools and MCP servers,
subagents, hooks, permission rules, sandboxes, memory and the files it keeps.
One repo's harness can be read by several runtimes.

**Runtime.** The agent program that loads a harness. Free Rein supports six:
Claude Code, Codex, Cursor, GitHub Copilot (in VS Code), Gemini CLI and
OpenCode. Each loads different files and does each thing its own way;
`model/runtimes/<id>.json` records how, with a source for every claim, and
`open.json` describes your own loop, built without a runtime.

**Framework.** A layer some harnesses add on top of a runtime: modes, protocols,
its own hooks, a knowledge base, review gates. A framework teaches Free Rein its
parts through a plugin (`docs/plugins.md`).

**Piece.** One kind of thing a harness can have: project instructions, skills,
blocking hooks, permission rules, a completion check, an event log… Free Rein knows
62, in ten **sections**: Instructions, Protocols, Abilities, Agents, Environment,
Guardrails, Verification, Validation, Observability and Memory.

**Level of a piece.** How far it has come: empty, started, equipped, hardened.
Hardened means it holds on its own (a hook that refuses, a rule that's
enforced), not just that it's written down.

**XP, level and rank.** A harness earns XP for its pieces' levels, the
combinations it completes, the weak spots it clears and the situations it
covers. Enough XP raises its level; its pieces decide its rank (Apprentice,
Journeyman, …). A game's terms for a plain question: how complete is this
harness?

**Combo and weak spot.** Pieces that are stronger together (a completion check
plus an event log) make a combo, an achievement. Pieces that leave a gap
together (agents that write, with nothing reviewing them) make a weak spot.

**Situation.** Something the agent might do here: edit a file, push, delete a
folder, change its own settings. **Everyday** work should run on its own; **high
stakes** should ask you or be refused. For each situation Free Rein says what would
happen and what decides it:

| Verdict | Means |
|---|---|
| Runs on its own | Everyday work that goes ahead, as it should |
| Babysitting | Everyday work that stops to ask you: a rule could decide it |
| Blocked | Everyday work that's refused |
| Depends on a hook | A hook runs first and may refuse it; Free Rein reads hooks, it doesn't run them (the dry run can) |
| Good friction | High stakes, and it asks you |
| Held | High stakes, and something refuses it |
| Exposed | High stakes, and nothing stops it |
| Claude Code decides | High stakes, no rule of yours covers it, and Claude Code's own safety check decides |

**Auto and manual mode.** Claude Code's permission modes. In auto mode, what no
rule of yours covers is decided by Claude Code's own check; in manual mode it
asks you. Free Rein reads a harness in the mode its settings set (auto when they
don't say); `free-rein read --mode manual` reads it the other way.

**Written versus enforced.** A rule in your instructions ("never edit `.env`")
only asks the agent. It's enforced when a permission rule, a hook or a sandbox
makes it so. Free Rein matches each rule to what backs it.

**Harness, Free rein.** The board's views of one harness. **Harness** is the
parts: what it has, and what holds. **Free rein** is what that adds up to: how
much it does on its own, and whether your written rules hold.

**Free rein (the view and the number).** How much the agent does on its own:
of the actions Free Rein plays out, the share that go ahead without asking you
or being refused (the runtime's own safety check counted apart). Beside it, the
**written rules**: the rules in your instructions, how many Free Rein can
measure (they're about an action it plays out), and of those how many something
enforces, how many ask instead of refusing, and how many are only asked. By kind
of action (pushing, deleting, secrets…), what your words say sits beside what
happens: they agree; said but nothing enforces it; enforced but no rule says so;
nothing says it and nothing stops it; or only the runtime's own check stands in
the way.

**Context.** The board's view of everything your agent reads: instructions, skills
and the notes it keeps for itself, by when each enters its context (from the start
of every session, when work reaches a folder, when a skill is used, when the agent
opens it, when a hook adds it), where it applies and who wrote it (you, a package,
your agent). Each sentence has a kind: a rule (never, avoid, always, should), a
step, a trigger (when to use it), a definition, a fact (how the project is or
works), a claim, a pointer, or not classified. Sizes are estimates, about four
characters to a token. Your agent can read what the patterns couldn't place; its
reading is shown as its own and never counts toward verdicts.

**Your agent's notes (memory).** What the agent writes down for itself between
sessions, such as Claude Code's auto memory: an index that loads at the start of
every session, and notes it reads when it needs them. They apply to this repo,
just you, though they sit in your home folder. Free Rein reads them on your
machine only; what it shares (the harness document, `check`) counts them, never
quotes them.

**What to do next.** The bell's list: every problem the board finds (a risky
situation, rules nothing enforces, a piece the harness would gain most from)
becomes one thing to do, with why, what it earns and how much work it is, most
important first. Things that fix the same problem are merged; several can be
fixed together in one draft.

**Trust.** How much you'd let the agent do alone (edit files, run commands,
decide it's done…), set beside what the harness actually backs.

**Layers.** The levels a runtime reads a harness at, most specific first: your
organization, this repo just for you (`.claude/settings.local.json`,
`CLAUDE.local.md`), this repo shared (`CLAUDE.md`, `.claude/`), you in every
repo (`~/.claude`), and the runtime's own built-ins. Each runtime names its own
(`model/runtimes/<id>.json`, with sources). For settings, the most specific
level that sets a key wins; instructions from every level are loaded together.
The session (flags given at the start) is a level too, but Free Rein reads
files, so it doesn't see it. **Packages** (a framework, plugins) are where
parts came from, not a level: a package's parts sit in a level, usually yours.

**Your files, as last read.** What the board shows when nothing is in a draft:
the harness as Free Rein last read it from your files, with the time it read
them. It reads them again when one changes. It's what a new session would load;
a session already running loaded its files when it started, and flags given at
the start aren't in any file. Free Rein reads files only: it uses no AI model and
sends nothing anywhere.

**How Free Rein knows.** No AI model: every finding comes from a check, and each
check says how it knows. **Read** means from a file's structure (settings,
frontmatter, hooks, how files point at each other). **Matched** means a pattern
on the wording: a rule in your instructions is recognised by a strength word
(never, always) and an action (push, delete), so a rule said another way is
missed. **Recorded** means from Free Rein's record of the runtime, each claim
with a source and a status. The board lists every check under More → How Free
Rein checks, and marks the words each rule was matched by.

**Agent review.** A second look by your own agent, for what Free Rein's rules
can't check. You start it; Free Rein writes the brief and reads back
`.free-rein/review.json`, keeping only findings whose quotes are really in the
files they cite and none from a sensitive file. Its findings are marked as your
agent's, not a rule's, and don't count toward XP or verdicts.

**Draft and upgrade.** An upgrade is one change Free Rein can make (a blocking hook,
permission rules) or ask the agent to make. A draft tries changes on a copy
first, so you see their effect before anything is written. Anything that differs from
your files, a change to apply or a look-only preview (a layer switched off,
another runtime, a model picked as a what-if), shows in the one **Draft** chip.

**Sample harnesses.** Harnesses a repo keeps as examples, not its own. A repo
names them in `.free-rein.json` (`{"samples": ["samples/"]}`), and Free Rein leaves them
out of the repo's harness.

**Saved outputs.** For people working on Free Rein: `core/test/golden/` holds what
Free Rein produced for the sample harnesses. A change that moves them must mean to.

**Where these words come from.** The source-code study *Harness Engineering*
(Barbaste et al., 2026, [arXiv 2609.00006](https://arxiv.org/abs/2609.00006))
finds that agents' rules move from prose into configuration over time, which is
what written versus enforced measures.
