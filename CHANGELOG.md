# Changelog

What changed, for people using Free Rein. The core (`core/`) and the extension
(`vscode/`) share one version number and move together.

## 0.2.0 (alpha)

The first public version, an early alpha: some parts are unfinished.

**Reading a harness**

- Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and OpenCode, each read
  the way it loads files, with every claim about a runtime sourced and dated
  (`model/runtimes/<id>.json`). Claude Code is read rule by rule; the others are
  estimated from the pieces in place and the kind of mode picked, and say so.
- 62 kinds of piece in ten sections, each with how far it has come (started,
  equipped, enforced), the achievements pieces earn together and the weak spots
  they leave.
- Rules read from every instruction file, skill, agent and command the runtime
  loads, in the repo, in your home folder and from packages; each matched to
  what enforces it.

**The VS Code extension**

- The Harness view: every piece around the agent, with a level and rank.
- The Free rein view: how much the agent does on its own, everyday work and
  high-stakes work apart; what your words say beside what happens for each kind
  of action; every written rule, enforced or only asked.
- The side panel: Pieces; Layers (built in, your own setup, this repo shared,
  this repo just for you), with the runtime, model and mode; Situations, each
  risky action with what decides it, and allow, ask or never for each.
- Drafts measured on a copy before anything is written, and upgrades written
  as one edit you can undo.
- Scans: the board reads again when a file it read changes, says when it last
  did, and lists every scan in plain words (runs that found nothing folded).
- The trust check: a few moments from your harness, "would you let it?", then
  every answer beside what your harness actually does.
- The bell: what to do next, most important first.
- How Free Rein knows: every check, and how it knows (read, matched, recorded).
- The agent review, a preview behind `freeRein.agentReview`: your own agent
  looks for what rules can't check; Free Rein keeps only findings whose quotes
  are in the files.

**The command line**

- `free-rein check` (text, JSON or SARIF for code scanning), `read` (the
  harness document, `free-rein.harness/1`), `score`, and `upgrades`.
- Plugins teach Free Rein a framework's parts (`docs/plugins.md`).
