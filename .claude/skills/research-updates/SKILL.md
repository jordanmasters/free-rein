---
name: research-updates
description: Check Free Rein's model of agents (runtimes), editors and settings windows against what the vendors ship now. Lists what we recorded and when, researches releases, changelogs and docs since then, says whether the version we checked is still available, and proposes sourced updates to model/ for approval. Use when asked to "check for updates", "research what changed in Claude Code / Cursor / Codex / …", "is our runtime data current", or on a schedule (report only).
---

# /research-updates

Goal: keep Free Rein's model of the outside world current. For every agent, editor and settings window it
models, find what changed since it was last checked, and propose updates with sources. Nothing in `model/` or
`core/` changes without the person's approval.

Ground rules (from AGENTS.md):
- Every runtime answer is `{how, status, source}`. `confirmed` only when the vendor's own docs or release notes
  say it; `believed` for anything inferred or from a third party. Record the version and date it was checked.
- Closed-source runtimes (Claude Code, Cursor, …): describe behaviour, never assert internals.
- Paraphrase; don't copy text from vendor pages.
- Searches name products and versions only. Never paste repo content or private notes into a search.

## Step 0 — Inventory (no web yet)

Read what Free Rein records, and when it was checked. Check only the supported runtimes (`SUPPORTED` in
`core/src/read/runtimes.ts`: claude, codex, cursor, copilot, gemini, opencode); the other records are kept but not
maintained, so skip them unless asked:
- `model/runtimes/<id>.json`: `name`, `version_checked`, `checked_on`, each source's `url` and `checked`, and its
  `models` (whose models it runs, the names it takes, its default).
- `model/editors.json`: each editor's `view`, `version_checked`, `checked_on`, `source`, the agents it runs
  (`harnesses`) and its window's `sections`.
- `model/models.json`, `model/ways.json`, `model/profiles.json`: their `checked_on` and per-entry checks.
- The code tables in `core/src/read/runtimes.ts`: `READS` (which files each runtime reads), `HOME_SKILLS`,
  `CLAUDE_HOOKS`, `IGNORES_IN_CLAUDE_MD`.

Show one table, oldest first: thing · version checked · checked on · days since · number of sources.

## Step 1 — Scope

Default: everything checked more than 7 days ago. If the person named products, only those. On a schedule, take
the default and go to step 4 after researching (report only, no edits).

## Step 2 — Research each one

Use one subagent per vendor when there are several, in parallel. For each, find:
1. **Current version** and its date: release notes, changelog, GitHub releases, `npm view <pkg> versions`, the
   editor marketplace page.
2. **Changes since the version we checked** that touch Free Rein:
   - files and folders it reads (instructions, skills, agents, commands, rules, MCP, settings, hooks)
   - settings and permission keys, hook events, sandbox and network controls
   - its settings window: sections added, removed or renamed, and what each edits
   - agents an editor can now run (built in, extension, command line), or no longer runs
   - removals, deprecations, renamed docs pages (follow redirects; record the new URL)
3. **Versions**: is the version we checked still downloadable or installable (npm versions, GitHub release
   assets, the marketplace's version history, the vendor's download archive)? Are older versions still
   supported? Are the docs versioned, or only ever the latest? Say how you know, or "unknown".
4. **New things worth modelling**: a new agent, editor, settings window, or a way people use agents outside an
   editor (a hosted agent reached through chat, an agent in a cloud console). Note them; don't add them yet.

Keep each finding as: claim · source URL · the page's date or version (or "undated, read <today>").

## Step 3 — Compare with the model

For each finding, name the exact change it implies:
- `model/runtimes/<id>.json`: an answer's `how`/`status`/`source`, a new `sources` entry with `checked`
  `{on, version}`, `version_checked`, `checked_on`
- `core/src/read/runtimes.ts`: a `READS` entry (and the test that covers it)
- `model/editors.json`: the agents an editor runs, its window's sections and the pieces each edits
- a new runtime, editor or window (propose only)

Bump a checked date only for what was actually re-read today.

## Step 4 — Report

```
### <thing>: checked <version> on <date> → now <version> (<date>)
Still available: yes / no / unknown (how you know)
Changes that affect Free Rein:
- <change> (<source>)
Proposed edits:
- <file>: <change>
Unchanged, re-read today: <list>
```

End with the new things worth modelling, then ask: **approve, edit or skip each?** On a schedule, stop here.

## Step 5 — Apply what's approved

- Edit the data, keeping each file's formatting (2-space JSON). If `model/parts/` changed, run
  `node model/parts/render.mjs`.
- Run `npm test`. If saved outputs would move, say what you expect to change first, then `npm run golden` and
  show what did.
- Don't commit unless asked. When asked, use `feat(data): …` or `fix(data): …`.
