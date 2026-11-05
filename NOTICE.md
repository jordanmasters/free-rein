# Notice

Free Rein
Copyright 2026 The Free Rein authors

Licensed under the MIT licence (`LICENSE`).

Free Rein is an independent project. It is not affiliated with, endorsed by or
sponsored by Anthropic, OpenAI, GitHub, Microsoft, Google, Anysphere (Cursor) or
SST (OpenCode).

Product names (Claude Code, Codex, Cursor, GitHub Copilot, VS Code, Gemini CLI,
OpenCode, and others) are used only to identify the runtimes Free Rein
reads, and remain the trademarks of their owners. Free Rein shows no third-party
logos.

What Free Rein says about each runtime comes from that runtime's own documentation,
changelogs and observed behaviour, cited per claim in
`model/runtimes/<id>.json` with the date and version checked.

## Privacy

Free Rein runs on your machine. It makes no network calls and sends no telemetry.

To read a harness it reads files in that folder and, unless you turn it off
(`--no-home`, or the extension's `freeRein.countHome` setting), what Claude Code
loads from your home folder:

- `~/.claude`: your settings, skills, instructions and plugins;
- `~/.claude/projects/<folder>/`: the session transcripts Claude Code keeps for
  that folder (the most recent 20 to 40), to see which connectors you've set up,
  which skills and Stop hooks ran, and what the agent did, for the situations;
- `~/.free-rein/plugins/`: plugins you've installed (code, run when Free Rein reads).

`free-rein check` leaves your home folder out by default, so its report is the same
on every machine and carries nothing about yours.

Free Rein uses no AI model. The one exception you can choose is the agent review
in the VS Code extension: only when you start it, and after it asks you, it opens
your own agent (Claude Code) in a terminal to read the harness and write
`.free-rein/review.json`. Your agent then sends those files to its model's
provider, as it does in your normal work; Free Rein itself still sends nothing.
Reads of files that look like secrets (`.env`, keys, credentials) are denied to
it, and Free Rein drops any finding that quotes one.

Free Rein writes only when you ask it to (an upgrade, a draft applied, a new
harness). To measure a change
before you make it, it copies the folder to a temporary folder and removes the
copy afterwards. The dry run runs the harness's own hooks only when you ask, and
the VS Code extension won't write or run anything in a folder you haven't
trusted (Restricted Mode).

## Credits

- [Lucide](https://lucide.dev) icons, ISC licence (`vscode/media/lucide.LICENSE.txt`).
- [Geist](https://vercel.com/font) and Geist Mono fonts, by Vercel with basement.studio,
  SIL Open Font License 1.1 (`vscode/board/fonts/OFL.txt`).
