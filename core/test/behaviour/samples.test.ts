// Sample harnesses a repo declares (.free-rein.json "samples") are someone else's harness: Free Rein leaves them out of the
// repo's own. Nothing is guessed from a folder's name.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { extract } from "../../src/read/extract";
import { harness as statementsOf } from "../../src/read/statements";
import { declaredSamples } from "../../src/read/samples";
import { tmpdir, write } from "../helpers";

function repo(declare: unknown | null) {
  const root = tmpdir("free-rein-samples-");
  write(root, "CLAUDE.md", "# App\n\nRun the tests before you say you're done.\n");
  write(root, "samples/demo/CLAUDE.md", "# Demo\n\nNever touch the demo database.\n");
  write(root, "samples/demo/.claude/skills/demo-skill/SKILL.md", "---\nname: demo-skill\ndescription: Use when demoing.\n---\n1. Demo.\n");
  if (declare !== null) write(root, ".free-rein.json", JSON.stringify(declare));
  return root;
}
const nested = (root: string) => [...extract(root).nodes.keys()].filter(k => k.startsWith("surface:nested-claude-md"));
const said = (root: string) => statementsOf(root, extract(root).toJson()).some((s: any) => /demo database/.test(s.text));

test("a declared samples folder is left out of the repo's harness", () => {
  const root = repo({ samples: ["samples/"] });
  assert.deepEqual(nested(root), []);
  assert.equal(said(root), false);
});

test("undeclared, the same folder is read: a folder's name alone decides nothing", () => {
  const root = repo(null);
  assert.deepEqual(nested(root), ["surface:nested-claude-md:samples/demo"]);
  assert.equal(said(root), true);
});

test("a declaration can't reach outside the repo, and a bad file declares nothing", () => {
  assert.deepEqual(declaredSamples(repo({ samples: ["../", "/etc", "missing/", 3] })), []);
  const root = repo(null);
  write(root, ".free-rein.json", "{ not json");
  assert.deepEqual(declaredSamples(root), []);
});

test("examples/ and fixtures/ are read like any folder unless declared", () => {
  const root = tmpdir("free-rein-samples-names-");
  write(root, "CLAUDE.md", "# App\n");
  write(root, "examples/demo/CLAUDE.md", "# Example\n");
  write(root, "test/fixtures/h/CLAUDE.md", "# Fixture\n");
  assert.deepEqual(nested(root).sort(), ["surface:nested-claude-md:examples/demo", "surface:nested-claude-md:test/fixtures/h"]);
  write(root, ".free-rein.json", JSON.stringify({ samples: ["examples/", "test/fixtures/"] }));
  assert.deepEqual(nested(root), []);
});
