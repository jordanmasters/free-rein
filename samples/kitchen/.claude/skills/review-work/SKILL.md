---
name: review-work
description: Use when the user asks to review work before it ships; triggers on 'review'.
disable-model-invocation: true
---

Goal: Review the draft and record a verdict in vault/reviews.md.

## Procedure

1. **Read the draft** from drafts/current.md.
2. **Show the findings for review** and await approval before writing.
3. **Write the verdict** to vault/reviews.md and log it with `emit.py review-done`.
**Step 4 â€” Sign off on the result.**

If the user says no, stop. When in doubt, ask: "Proceed?"

The user must say something like "yes, ship it" or "approved"; a second confirmation is required for `vault/decisions.md`.

Then call /commit-it and see lib/tools.py and engines/review/PROTOCOL.md.

```bash
npm test
npm run lint
```

## Don'ts

- Never write to vault/ without approval.
- Don't skip the tests.

Bad bytes: ÿþ cafÃ© â‚ end.
Templates live in templates/ â€” âœ¨ emoji âœ¨.
