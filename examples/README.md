# Examples

`preview.mjs` draws the board for any harness in your browser, without VS Code:

```bash
node examples/preview.mjs samples/solo          # a small sample harness
node examples/preview.mjs /path/to/your/repo    # yours
node examples/preview.mjs samples/kitchen --no-open   # write examples/preview/kitchen.html only
```

It builds the core and the board first, so it works from a fresh clone. The
sample harnesses are in `samples/`: `solo` is a small Claude Code harness (rules,
permission rules that allow, ask and refuse, a hook that refuses force pushes,
one skill); `kitchen` has one of everything Free Rein can read.
