@AGENTS.md

## Claude Code

- `.claude/settings.json` (shared) allows the repo's test and build commands
  and keeps secrets out of reach; personal settings go in
  `.claude/settings.local.json`, which git ignores.
- Before refreshing saved outputs (`npm run golden`), say what you expect to
  change; afterwards, show what did.
