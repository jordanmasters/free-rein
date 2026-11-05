# Harness parts

> Generated from `catalog.json` — do not edit by hand.

The parts bin. Each part is a ROLE, named independently of any runtime; `runtimes` records how a given runtime realizes it. `node_type` ties the part to model/graph-schema.md, which makes parts of the same type candidates for substitution. `provides` and `requires` are what make a swap checkable: a part may only be placed where its requirements are provided.

## Capabilities

What a part may declare in `requires`, and what another part must `provide`.

| Capability | Meaning |
|---|---|
| `binding` | configuration resolved at runtime into paths and values |
| `context-injection` | something places standing text into the model's context |
| `coordination-contract` | a protocol governing behavior across subsequent turns |
| `delegation` | work handed to a separate context or process |
| `effect-gate` | an interposition point on an effect path |
| `external-capability` | capability reached outside the runtime's built-ins |
| `hook-runtime` | the runtime can execute a script on a tool-call event and act on its exit status |
| `routable-unit` | a named unit the runtime can route to or invoke |
| `sandbox` | an isolated place to act without touching the real workspace |
| `schedule-runtime` | the runtime can fire work on a schedule |
| `structured-prompt` | the runtime can render a fixed set of options for the human to select |
| `subagent-runtime` | the runtime can delegate work to a separate context |
| `substrate` | a stateful store the harness reads or writes |
| `temporal-activation` | work triggered by time rather than by intent |
| `trace` | an append-only record of what happened |

## Parts by node type

Parts sharing a `node_type` are candidates for substitution. Candidacy is not sufficiency — `requires` decides whether a swap is actually valid.

### `black-box`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `proprietary-runtime` | the runtime itself: system prompt, context management, built-in tool behavior | — | Claude Code (verified) | Codex (verified) |

### `config`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `runtime-binding` | binds the harness to paths and settings at runtime | — | settings.json, a framework's config (verified) | config.toml (verified) |

### `contract`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `engine-protocol` | behavioral contract loaded once, governing subsequent turns | `context-injection` | engines/<name>/PROTOCOL.md (verified) | — |

### `executor`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `isolation` | a separate working copy for an agent to act in | — | git worktree (verified) | sandbox modes (verified) |
| `orchestration` | deterministic multi-agent script | `subagent-runtime` | Workflow scripts (verified) | parallel subagent workflows; no scripted orchestration documented (unverified) |
| `scheduled-run` | work fired on a schedule | `schedule-runtime` | scheduled cloud agents (verified) | — |
| `self-paced-loop` | recurrence the model paces itself | — | /loop (verified) | — |
| `subagent` | delegated work in a separate context with its own tools | `subagent-runtime` | .claude/agents/<name>.md (verified) | custom agents under agents.* in config.toml (verified) |
| `tool-extension` | capabilities beyond the runtime's built-ins | — | MCP server (verified) | MCP server (verified) |

### `gate`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `event-hook-gate` | deterministic interception of a tool call before it runs | `hook-runtime` | PreToolUse hook with non-zero exit (verified) | PreToolUse hook in config.toml or hooks.json (refusal not confirmed) (unverified) |
| `human-checkpoint` | explicit human sign-off, requested in prose | — | approval language in a skill or protocol (verified) | approval language in a prompt (unverified) |
| `permission-policy` | declarative allow / deny / ask on tool use | — | settings.json permissions (verified) | approval modes (verified) |
| `structured-checkpoint` | human sign-off rendered as selectable options | `structured-prompt` | AskUserQuestion (verified) | — |

### `sink`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `telemetry-sink` | append-only record of what happened | `hook-runtime` | JSONL written from hooks (verified) | hooks appending to a log (verified) |

### `substrate`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `authoritative-store` | human-curated store of record; writes are gated | — | plain markdown vault (verified) | plain markdown vault (verified) |
| `session-state` | foreground state carried across turns | — | .claude/state/ (verified) | SessionStart / SessionEnd hooks keeping a state file (verified) |

### `surface`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `injected-banner` | per-prompt context injected by infrastructure | `hook-runtime` | UserPromptSubmit hook stdout (verified) | UserPromptSubmit or SessionStart hook adding context (verified) |
| `persistent-memory` | facts that survive across sessions | — | memory directory (verified) | memories, off by default (features.memories) (verified) |
| `project-constitution` | standing instructions injected at session start | — | CLAUDE.md (verified) | AGENTS.md (verified) |
| `user-constitution` | cross-project standing instructions | — | ~/.claude/CLAUDE.md (verified) | ~/.codex/AGENTS.md (unverified) |

### `unit`

| Part | Role | Requires | claude-code | codex |
|---|---|---|---|---|
| `skill` | routable unit: routing signal plus body, loaded on match | — | .claude/skills/<name>/SKILL.md (verified) | skills, configured under skills.* in config.toml (verified) |
| `slash-command` | manually invoked unit | — | /<skill-name> (verified) | /<prompt-name> (unverified) |

## Coverage

22 parts across 9 node types.

5 realizations are claimed but unverified — they must not be relied on until checked:

- `event-hook-gate` / codex
- `human-checkpoint` / codex
- `orchestration` / codex
- `slash-command` / codex
- `user-constitution` / codex

