#!/bin/bash
# Free Rein install: links Free Rein at ~/.claude/free-rein and its skills into
# ~/.claude/skills, so a harness repo can run Free Rein without a copy of it.
# Safe to re-run.

set -e

FREE_REIN_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

mkdir -p "$CLAUDE_DIR/skills"

# Free Rein's core (TypeScript): the skills run its command line, core/out/src/cli.js. Needs Node 22 or later.
if command -v npm >/dev/null 2>&1; then
  (cd "$FREE_REIN_DIR/core" && npm ci --silent && npm run --silent build) && echo "  ✓ core built"
else
  echo "  SKIP core build (npm not found): install Node 22+, then run this again"
fi

if [ -L "$CLAUDE_DIR/free-rein" ]; then
  rm "$CLAUDE_DIR/free-rein"
elif [ -e "$CLAUDE_DIR/free-rein" ]; then
  echo "  SKIP free-rein ($CLAUDE_DIR/free-rein exists and is not a link — remove it to reinstall)"
fi
[ -e "$CLAUDE_DIR/free-rein" ] || { ln -s "$FREE_REIN_DIR" "$CLAUDE_DIR/free-rein"; echo "  ✓ free-rein → $CLAUDE_DIR/free-rein"; }

for skill_dir in "$FREE_REIN_DIR/skills"/*/; do
  [ -d "$skill_dir" ] || continue
  name="$(basename "$skill_dir")"
  target="$CLAUDE_DIR/skills/$name"
  if [ -L "$target" ]; then
    rm "$target"
  elif [ -e "$target" ]; then
    echo "  SKIP $name (exists at $target and is not a link — remove it to reinstall)"
    continue
  fi
  ln -s "$skill_dir" "$target"
  echo "  ✓ skill: $name"
done
