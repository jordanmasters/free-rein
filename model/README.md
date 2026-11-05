# model/

Free Rein's model of a harness, in words and as data; the code that reads it is `core/`.

- `graph-schema.md`: the harness model in words. Start here.
- `pieces.json`: the model as data: the 62 pieces in 10 sections, combos and weak
  spots, tiers and ranks, how XP is earned, and the trust categories.
- `runtimes/<id>.json`: how each runtime does each piece, every claim with a
  source and the date and version it was checked.
- `profiles.json`: what each runtime or product gives you out of the box, and
  example harnesses.
- `models.json`: the AI models Free Rein recognises in a harness. `ways.json`: the
  ways to add each piece.
- `editors.json`: how Cursor's and VS Code's own customization views name what
  Free Rein reads (their sections and scopes), which pieces each section edits, and
  which of Free Rein's runtimes each agent you can pick in them is read as.
- `schema/`: JSON Schemas for all of the above, and for the harness document
  (`harness.schema.json`) other tools can read.
- `parts/`: the parts catalog (`CATALOG.md` is rendered from `catalog.json` by
  `render.mjs`).
