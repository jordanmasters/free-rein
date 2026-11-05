---
name: address-findings
description: Walk through addressing Free Rein harness findings (naked-write, dangling-reference, spec-drift, vocabulary-mismatch, etc.). Re-runs the extractor and lint, surfaces each finding with the code behind it, proposes a concrete fix, and applies it after approval. Triggers when the user passes a finding to /address-findings, says "address that finding", "fix the harness findings", or wants to act on a scan report.
---

# /address-findings

Goal: turn harness scan findings into applied fixes, explicit declarations, or tracked items — never into silently ignored noise.

## Procedure

**Step 0 — Fresh scan.**
Run Free Rein's lint from the root of the harness being fixed (findings go stale
fast while editing). `install.sh` in the Free Rein repo links Free Rein at
`~/.claude/free-rein`:

```bash
node ~/.claude/free-rein/core/out/src/cli.js lint .
```

It prints the findings as JSON, most serious first.

If that path is missing, Free Rein isn't installed: say so, and point to
`install.sh` in the Free Rein repo.

1. **Identify the target.**
   - If the user passed a finding (class + subject, e.g. copied from `free-rein lint` or `free-rein check`), match it against the fresh scan. If it no longer appears, say so — it may already be fixed.
   - If no argument, list current findings grouped by severity (serious first) and let the user pick one or say "all serious".

2. **Surface the finding** in this shape:

   ```
   ### 🔍 Finding: [class] ([severity])
   [subject]
   [detail verbatim from lint]

   ### 📚 What's actually there
   [Read the provenance files behind the subject nodes. Show the relevant
   lines. Explain in plain language why the lint fired — cite file:line.]
   ```

3. **Classify the fix and propose it.** Every finding resolves one of four ways:

   - **Repair** — the harness is wrong: fix the code/prose/wiring (e.g. a
     dangling path, a vocabulary drift, a hook that never fires).
   - **Declare** — the behavior is intended and the graph should say so:
     mark a skill read-only, add the missing `patterns/*.yaml` spec, route
     the write through an explicit gate, add the missing config.
   - **Initialize** — the finding stems from missing setup: scaffold the
     missing file, or run the harness's own setup (a framework's init command, if it has one).
   - **Track** — not fixable now: record it with the harness's own tracking
     (a framework's task or question command, if it has one), with the finding text
     as context. With no tracker, say so and leave it as a note to the user.

   Show the proposed change as a diff preview. For anything touching a
   knowledge base, use the harness's own write path if it has one (a
   framework's command for updating it) — never edit its files around that path.

   Ask: "Apply this fix?"

4. **On approval, apply.** Then re-run the lint and confirm the finding
   cleared:

   ```
   ### ✅ Result
   [class] [subject] — cleared / still present (why)
   Findings: [N before] → [M after]
   ```

   If the fix touched extractor or lint code itself, say so explicitly — a
   finding cleared by changing the detector is a different claim than one
   cleared by fixing the harness.

5. **Follow-ons.**

   ```
   ### 🔗 Remaining
   - [next finding] — offer to continue
   - None (scan clean at this severity)
   ```

## Don'ts

- Don't weaken or delete a lint check to make a finding disappear — if the
  check is wrong, say so and fix it as its own reviewed change.
- Don't fix multiple unrelated findings in one un-reviewed batch; propose
  each, or get explicit "fix all serious" consent first.
- Don't mark an intended behavior as fixed by suppression — intended
  behavior gets declared in the graph (readonly flag, spec, gate), so the
  scan stays honest.
- Don't write to a knowledge base around its own review path.
