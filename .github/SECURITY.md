# Security

Free Rein reads AI agent harnesses, and some of what it reads (hooks, plugins,
installers) is code. Its rules:

- Reading a harness only reads files. Running a harness's hooks (the dry run)
  happens only when you ask, and never in a VS Code folder you haven't trusted.
- Free Rein writes to a harness only when you ask it to.
- Free Rein makes no network calls.
- Plugins (`~/.free-rein/plugins/`) are code you install yourself; Free Rein runs them
  when it reads a harness. Install only plugins you trust.

## Reporting a problem

Please don't open a public issue. Report it privately to the maintainer
through GitHub (the repository's Security tab, "Report a vulnerability", once
the repository is public), with what you saw, how to reproduce it and the
version.

## Supported versions

Only the latest version is supported while Free Rein is before 1.0.
