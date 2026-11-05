// Python's behaviour the core keeps (py.ts), checked against answers Python gave (test/py-expected.json, made by
// Python 3.9 before it was retired): rounding halves to even, repr, re.escape, fnmatch, json.dumps' form, and
// str's splitlines, strip and split.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { round, repr, escape, fnmatch, dumps, loadsKeep, splitlines, strip, splitWs, re } from "../src/py";
import { REPO } from "./helpers";

const E = JSON.parse(fs.readFileSync(path.join(REPO, "core", "test", "py-expected.json"), "utf8"));

test("round halves to even, on the exact value", () => { for (const [x, n, want] of E.round) assert.equal(round(x, n), want, `round(${x}, ${n})`); });
test("repr and re.escape", () => {
  for (const [x, want] of E.repr) assert.equal(repr(x), want);
  for (const [x, want] of E.escape) assert.equal(escape(x), want);
});
test("fnmatch", () => { for (const [a, b, want] of E.fnmatch) assert.equal(fnmatch(a, b), want, `${a} ~ ${b}`); });
test("JSON written as json.dumps(indent=2) writes it", () => { for (const [src, want] of E.json) assert.equal(dumps(loadsKeep(src), 2), want); });
test("splitlines, strip and split as str does", () => {
  for (const [t, lines, stripped, words] of E.split) { assert.deepEqual(splitlines(t), lines); assert.equal(strip(t), stripped); assert.deepEqual(splitWs(t), words); }
});
test("regular expressions: \\w and \\b know Unicode letters; . and $ as Python's", () => {
  assert.equal(re("\\bcommit\\b").search("écommit"), null, "é is a letter, so there's no boundary before commit");
  assert.ok(re("\\bcommit\\b").search("— commit"));
  assert.deepEqual(re("[\\w-]+").findall("naïve-café x"), ["naïve-café", "x"]);
  assert.equal(re("a.b").search("a\rb")?.group(0), "a\rb", ". crosses \\r (only \\n stops it)");
  assert.ok(re("end$").search("the end\n"), "$ matches before a final newline");
  assert.equal(re("^x", { M: true }).findall("x\r\nx\rx").length, 2, "^ in multiline mode follows \\n only");
});
