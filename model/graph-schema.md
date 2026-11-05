# Harness graph schema

The model behind Free Rein: how a harness is represented as a graph. Extractors
emit this; lint and the board consume it. Field names are normative; the JSON
shape is fixed by the harness document (`model/schema/harness.schema.json`).

## The two axes

Every unit in a harness, from a CLAUDE.md paragraph to a scheduled cloud agent,
is classified on two orthogonal axes. File format is incidental; these are not.

**Activation — how a unit comes alive.**

| Value | Meaning | Example |
|---|---|---|
| `manual` | human invokes it directly | `/release` typed by the user |
| `semantic` | routed by description-matching against intent | skill frontmatter description |
| `temporal` | schedule fires it | cron, scheduled cloud agent, wakeup |
| `event` | infrastructure event fires it | hook on PreToolUse, task completion |
| `cascade` | another unit invokes it | skill → skill handoff |
| `loop` | self-pacing recurrence | /loop, dynamic wakeups |

**Authority — what must agree before an effect commits.** Lives on the
**edge being guarded**, not on the gate node. A gate is the interposition
point; the axes describe what passing through it means. One gate may guard
several edges at different settings, which is why the properties cannot live
on the node.

| Property | Values | Meaning |
|---|---|---|
| `verifier` | `structural` \| `deterministic` \| `probabilistic` \| `human` | what produces the verdict. `structural`: the shape makes the error unrepresentable — types, required frontmatter, schema. `deterministic`: code inspects and decides — lint, tests, validators. `probabilistic`: a model judges against a rubric. `human`: a person decides |
| `binding` | `advisory` \| `blocking` | what failure does. `advisory` records a finding and proceeds; `blocking` means the effect cannot commit |
| `locus` | `model` \| `infrastructure` | who can bypass it. `model`: prose the model is trusted to follow. `infrastructure`: a hook or interceptor watching the action itself |

A gate node may declare the axes it **imparts**; an edge passing through it
inherits them unless it overrides. Extraction resolves the inherited value
onto the edge, so lint and the viewer read edges, never nodes.

The design rule the ladder encodes: every check should sit as far down
`structural → deterministic → probabilistic → human` as it will go. Human
attention is the scarcest resource in the system and should only meet what
nothing below it could decide. A check sitting higher than its property
requires is a finding (`over-verified`), not a virtue.

`none` is not a value on any axis — it is the absence of any gate on an effect
path (the `naked-write` lint class).

Composition is by **weakest link, per axis**:

- `verifier` — the *lowest-authority* verifier on the path governs. A human
  sign-off reached only through an unchecked prose instruction is not a human
  gate end-to-end.
- `binding` — `advisory` anywhere on a path makes the path advisory up to the
  first blocking link; blocking is only effective downstream of it.
- `locus` — `model` anywhere upstream makes the path model-enforced to that
  point. A hard check that runs only because prose told the model to invoke it
  is `model` end-to-end; it becomes `infrastructure` only downstream of the
  interception point.

Extraction records all three per link; path-level values are derived.

Prose that *asserts* enforcement properties ("gates are enforced by hooks")
is a `claim` statement, not an edge property. Lint compares claims
against extracted values (`claimed-actual-mismatch`); mismatch is a finding,
never silently reconciled.

Deliberately out of scope for now (recorded so we don't re-argue them):
confirmation cardinality beyond one human (k-of-n quorum), and latency gates
(cooling-off periods). The schema leaves room; nothing implements them.

## Node types

Nine types. The first six carry the shape vocabulary in the viewer; `config`
and `sink` are secondary — small neutral chips, hidden behind toggles by
default; `black-box` is drawn distinctly from everything extracted.

**Node types are substitution classes.** Classification is not documentation —
it is the precondition for substitution. Two nodes of the same type are
candidates to replace one another, which is what makes a harness something you
recompose rather than rewrite. Candidacy is not sufficiency: see `requires`
below.

| Type | Shape | What it is | Key properties |
|---|---|---|---|
| `surface` | document | context-injection surface: CLAUDE.md, system-prompt fragment, hook-injected banner | `injection` (session-start \| per-prompt \| on-trigger), `weight` |
| `unit` | rounded rect | routable unit (skill): routing signal + body | `activation`, `weight`, `readonly` (self-declared) |
| `contract` | double-border rect | behavioral contract loaded once, governing subsequent turns (engine PROTOCOL.md) | `weight` |
| `gate` | shield | interposition point on an effect path | `imparts` (the authority axes it confers on guarded edges) |
| `substrate` | cylinder | stateful store: vault path, state file, queue | `authoritative` (bool) |
| `executor` | circle | something that runs: subagent, cron job, workflow, cloud task | `activation`, `runtime` (inline \| background \| scheduled \| cloud) |
| `config` | chip | binding node: settings.json, a framework's config | — |
| `sink` | chip | telemetry destination | — |
| `black-box` | dashed outline, hatched fill | something present in the harness whose interior cannot be extracted | `opacity` (proprietary \| unextractable \| not-yet-mapped), observable edges only |

A `black-box` records what is known — that the thing exists, and which edges
touch it — while marking the interior unknown. It is never inferred content.
Build on a proprietary runtime and there is permanently a black box in the
foundation; the more open the base, the lower the opaque floor sits. A map that
admits what it cannot see beats one that quietly implies completeness.
`not-yet-mapped` is the honest state for partial extraction, so it doubles as a
progress indicator.

Common to all nodes: `id`, `label`, `provenance` (adapter, file path, line
range), `requires` (see below), and `weight` where it applies — token cost of
injection, approximated by line count.

**`requires`** lists what must be present in the target graph for this node to
function: a runtime capability (`hook-runtime`), a substrate, another node.
Same type means *candidate* for substitution, not *compatible*: a gate whose
`locus` is `infrastructure` cannot drop into a harness with no hook runtime. A
swap is checked against `requires` before it is applied, and refused with the
unmet requirement named — a swap that cannot satisfy its requirements should be
unrepresentable rather than discovered broken later.

## Edge types

| Edge | Meaning | Viewer treatment |
|---|---|---|
| `writes` | unit/executor → substrate | solid arrow, heaviest stroke; **must pass through a gate shield — a gateless write renders as a visibly naked path** |
| `invokes` | unit → unit, unit → executor, unit → lib tool | solid arrow, normal ink |
| `reads` | unit/executor → substrate/surface | thin, low-contrast; off by default above mid-zoom |
| `routes-to` | intent/trigger → unit | dotted |
| `injects` | surface → context (with timing) | shown structurally via the surface band, not as drawn edges |
| `gates` | gate interposed on an effect path | the shield node itself |
| `implements` | pattern spec → unit/contract | inspector panel only |
| `binds` | config → runtime path/value | inspector panel only |
| `emits` / `consumes` | unit ↔ sink | hidden behind a toggle |
| `scaffolds-from` | unit → template | inspector panel only |

## Contexts

A harness is not one static structure — what is live depends on the experience
the human is inside. Every node carries `contexts`: the set of experiences in
which it is active.

- `base` — the ambient Claude Code environment: CLAUDE.md chain, settings-bound
  hooks, mode-entry skills, telemetry sinks. Present in every session.
- One context per mode a framework defines (through its Free Rein plugin): what
  additionally comes alive when that mode is entered, such as the mode's
  protocol, its skills, its vault, its gates.

Membership is extracted deterministically by the framework's plugin, from what
the framework declares (which skills, protocols and folders each mode brings);
nodes with no direct assignment inherit the union of their neighbors'
contexts. Without a framework, every node is in `base`. A node may be in many
contexts.

Viewer treatment: a context switcher renders one visual per experience. A
non-base context view shows `base` nodes dimmed underneath and the context's
own nodes at full strength — the mode is a layer over the ambient harness, not
a replacement for it. `base` view shows only the ambient layer.

## Effects

Every `writes` edge carries a severity class, because gate strength should be
justified by effect severity — the core design rule the viewer must surface:

- `local` — reversible workspace/state change
- `authoritative` — write to a human-curated substrate (vault, decisions)
- `external` — leaves the machine (send, publish, deploy); hardest to reverse

## Statements

Instructions, skills, protocols and modes are written in prose, and prose is
where a harness says what it means: what must never happen, what to do first,
when something applies, what is true about itself. Left as prose, none of it
can be checked or connected. Every such sentence becomes a **statement**: a
typed object Free Rein can match to what the harness actually does, compare with
other statements, and follow to the pieces it is about. This is the layer that
turns a set of separately written specs into one harness you can reason about.

**Kinds.**

| Kind | What it is | Example |
|---|---|---|
| `rule` | something that must, must not, or may only happen | "Never edit `.env`" |
| `direction` | a step to follow, in order | "Show the diff, then wait for approval" |
| `trigger` | when something applies or should be used | "Use when the user asks to add a task" |
| `claim` | something asserted as true about the harness | "Every release goes through /release" |
| `definition` | what a term means here | "A gate is a review step before a write" |
| `pointer` | a reference to another file, skill or tool | "See docs/glossary.md" |
| `residual` | prose that says something none of the above captures | kept, never dropped (Losslessness) |

**Fields** (common to every statement):

| Field | Meaning |
|---|---|
| `id` | stable: source file, line and a content hash |
| `kind` | one of the kinds above |
| `text` | the verbatim sentence |
| `source` | file, line range, and the node it belongs to (a surface, unit, contract) |
| `about` | what it concerns: an action (push, delete, write, publish, run), a tool, a path or glob, a skill, a term. A list; may be empty |
| `strength` | `must` \| `must-not` \| `should` \| `should-not` \| `may`, for rules; `null` for kinds without force |
| `scope` | where it applies: `harness` (every session), `folder` (a path), `unit` (one skill or mode), `step` (inside one procedure) |
| `read_by` | how it was classified: `pattern` (deterministic), `model` (a decision model; carries `confidence`), or `you` (a correction) |
| `believed` | true when `read_by` is `model`: a reading, not a confirmed fact |

**Links.** A statement is connected to what it is about, so the rest of the
model can use it:

| Link | From → to | Meaning |
|---|---|---|
| `backed-by` | rule → gate, permission rule, hook | something that holds makes the rule true whatever the model does. A rule with no `backed-by` is followed only if the model chooses to |
| `about` | statement → situation, node, substrate | what it concerns, resolved: "ask before pushing" → the push situations |
| `contradicts` | statement ↔ statement, or statement ↔ edge / rule | two say opposite things, or a statement says one thing and the harness does another |
| `collides` | trigger ↔ trigger | two triggers claim the same request, so routing between them is a guess |
| `defines` | definition → term, used by → statements | the same term means one thing everywhere it's used |

**What it makes checkable.**

- *Enforced* tiers: a piece's rules about actions are each `backed-by`
  something that holds (Project instructions: "ask before pushing" is backed
  by an `ask` rule for `git push`).
- Conflicts: two rules that disagree, or a rule and a permission rule that do
  ("always ask before deleting" with `allow: Bash(rm:*)`).
- Collisions: two skills whose triggers or names claim the same request.
- Drift: a claim the extracted graph contradicts (already `claimed-actual-mismatch`).
- Coverage: which rules nothing enforces, which situations no statement speaks to.

**Reading.** Statements are read in two passes, and every result keeps its
source line:

1. **Patterns** (deterministic): modal words (never, always, must, don't,
   only, may), "use when / triggers when", numbered and imperative steps,
   path and command literals, `@imports` and links. The current `statements`
   inventory on units and contracts (pointers, invocations, conditions,
   constraints, asks, emissions, examples) is this pass in its first form and
   keeps its shape.
2. **A decision model** for what patterns leave as `residual`: classifying a
   sentence into a kind, a strength and what it's about is a decision task,
   not a writing task. Results are `believed`, carry their confidence, are
   cached by content hash, and are never needed for the deterministic pass to
   work. Inputs are only the harness's own files.

You can correct any reading; a correction is kept by statement `id` and wins
over both passes until the sentence changes.

Matching prose to rules is fuzzier than reading settings. Every `backed-by`,
`about` and `contradicts` link shows the statement, what it was matched to,
and how, so a wrong match is visible and correctable rather than silently
counted.

## Losslessness (round-trip)

The graph is a decomposition of the harness, not a summary of it. Target
invariant: the source files are regenerable from the graph alone. Concretely:

- Every statement carries its verbatim source text and document order,
  not just its classification.
- Prose that resists classification is kept as `residual` statements —
  never dropped. A shrinking residual fraction is the measure that the
  statement taxonomy is becoming representative.
- Node `provenance` (file, line range) plus statement ordering must be
  sufficient to reassemble each file byte-for-byte modulo whitespace.

Round-trip regeneration isn't required yet; it is the standing
acceptance test for the taxonomy itself. When regeneration fails, the diff
is a finding about the schema, not about the harness.

## Lint classes

Checks run over the extracted graph. Each finding carries provenance and a
severity.

| Class | Detects |
|---|---|
| `dangling-reference` | edge whose target doesn't exist (renamed skill in an allowlist, missing config) |
| `orphan` | a document or store nothing references (dead template, unread doc); skills, agents, tools and instruction files are loaded by the runtime, so never orphans |
| `naked-write` | `writes` edge to an `authoritative` or `external` target with no gate on the path |
| `claimed-actual-mismatch` (not checked yet) | a `claim` statement asserts authority the extracted graph doesn't show (docs claim `locus: infrastructure`, edges resolve to `model`) |
| `vocabulary-mismatch` | two edges naming the same substrate by different paths (questions.md vs open-questions.md) |
| `emitted-unread` | `emits` edge with no matching `consumes` |
| `spec-drift` | extracted coordination doesn't match the `patterns/` spec that claims to describe it |
| `over-verified` (not checked yet) | an edge uses a costlier verifier than its property requires — a human on something a type could catch |
| `uncertifiable-path` | an effect path passes through a `black-box`; it can be bounded but never certified |
| `unsatisfied-requirement` | a node's `requires` names something absent from the graph |
| `unbacked-rule` | a `rule` statement about an action with no `backed-by`: followed only if the model chooses to |
| `statement-conflict` | two statements, or a statement and a rule or edge, that `contradict` |
| `trigger-collision` | two units whose triggers or names claim the same request |
| `term-drift` | one term with two `definition`s, or used against its definition |

Every defect found in a 2026-07 manual scan of a framework-heavy harness falls
into one of these classes; that scan was the acceptance test for this list.

## Adapters

An adapter knows one runtime's conventions and emits schema-conformant graph
JSON. It owns *where to look*; the schema owns *what things are*.

- **claude-code**: CLAUDE.md chain, `skills/*/SKILL.md` frontmatter
  and bodies (skill→skill mentions, path literals),
  `settings.json` hook registrations + hook script matchers/exit semantics,
  git hooks, `.claude/agents/`, workflow scripts, cron/routine registry,
  MCP config, state and telemetry files.
- **Plugins** (frameworks on top of a runtime): a framework that adds modes,
  protocols, its own hooks, a vault or review gates ships a Free Rein plugin that
  adds those to the graph, checks them, names its gates, and installs it. See
  `docs/plugins.md`.
- **Other runtimes** (Codex, Cursor, Copilot, Gemini CLI, OpenCode):
  the same schema; the Claude Code adapter reads their files too (AGENTS.md,
  their settings and MCP config), and `model/runtimes/<id>.json` says
  what each runtime loads and how it does each piece.
