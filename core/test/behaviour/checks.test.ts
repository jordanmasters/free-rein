// How Free Rein knows: every check, grouped by how it knows, with what it found; rules keep the words they matched.
import { test } from "node:test";
import * as assert from "node:assert";
import * as path from "path";
import { matched } from "../../src/read/statements";
import { board } from "../../src/report/board";
import { REPO } from "../helpers";

test("a rule keeps the words it was recognised by", () => {
  assert.deepStrictEqual(matched("- Never push to main without a review."), ["Never", "push"]);
  assert.deepStrictEqual(matched("Don't force-push to main."), ["Don't", "force-push"]);
  assert.deepStrictEqual(matched("Use `never` in code"), [], "a word in code isn't a rule's");
});

test("the board lists every check, by how it knows, with what each found", () => {
  const b: any = board(path.join(REPO, "samples", "kitchen"));
  const g = Object.fromEntries(b.checks.map((x: any) => [x.id, x]));
  assert.deepStrictEqual(b.checks.map((x: any) => [x.id, x.kind]),
    [["pieces", "read"], ["situations", "read"], ["prose", "matched"], ["lint", "read"], ["loops", "read"], ["runtime", "recorded"]]);
  assert.strictEqual(g.pieces.items.length, 62, "every piece's rule");
  const push = g.prose.items.find((i: any) => i.id === "push");
  assert.strictEqual(push.hits, 1); assert.deepStrictEqual(push.where[0].matched, ["Never", "push"]);
  assert.match(push.where[0].file, /^CLAUDE\.md$/); assert.strictEqual(push.where[0].line, 12);
  assert.ok(g.situations.items.every((i: any) => i.verdict), "each situation with its verdict");
  assert.match(g.runtime.items[0].looks, /\d+ confirmed/, "the record's claims, by status");
});
