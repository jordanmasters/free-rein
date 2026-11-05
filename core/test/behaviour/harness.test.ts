// The harness document (free-rein.harness/1) and the reference scorer.
//
// Reads the sample harness in samples/solo with an empty home folder, so the result doesn't depend on the
// machine: the document must match its schema and the stored golden copy (the same file the Python test
// keeps), and the reference scorer must give the board's numbers.
// Refresh the golden copy after a deliberate change: FREE_REIN_GOLDEN=1
// (JSON Schema checked with ajv.)
import { test, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { board } from "../../src/report/board";
import { document } from "../../src/report/harness";
import { score } from "../../src/report/score";
import { load } from "../../src/read/spec";
import { FIXTURES, REPO, tmpdir, withHome } from "../helpers";

const SOLO = path.join(FIXTURES, "solo");
const GOLDEN = path.join(REPO, "core", "test", "golden", "solo.harness.json");

/** The document without what changes on every read (when, and which Free Rein). */
const stable = (doc: any) => Object.fromEntries(Object.entries(doc).filter(([k]) => k !== "read_at" && k !== "free_rein"));

let tmp: string, h: any, doc: any;

before(() => {
  // an empty home folder, and the sample copied out of the Free Rein repo, so nothing on this machine leaks into the result
  tmp = tmpdir();
  const home = path.join(tmp, "home"), solo = path.join(tmp, "solo");
  fs.mkdirSync(home);
  fs.cpSync(SOLO, solo, { recursive: true });
  withHome(home, () => {
    h = board(solo);
    doc = document(h, load(), solo);
  });
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("harness document: matches its schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const v = ajv.compile(JSON.parse(fs.readFileSync(path.join(REPO, "model", "schema", "harness.schema.json"), "utf8")));
  const ok = v(doc);
  assert.deepEqual(ok ? [] : (v.errors || []).map((e: any) => `${e.instancePath.replace(/^\//, "")}: ${e.message}`), []);
});

test("harness document: paths are relative", () => {
  for (const p of doc.pieces) for (const i of p.instances) assert.ok(!(i.path || "").startsWith("/"), `${p.id}: ${i.path}`);
});

test("harness document: sees the sample", () => {
  const by: Record<string, any> = Object.fromEntries(doc.pieces.map((p: any) => [p.id, p]));
  assert.equal(by["proj-instructions"].state, "yes");
  assert.ok(by["proj-instructions"].instances.map((i: any) => i.path).includes("CLAUDE.md"));
  assert.equal(by["permissions"].state, "yes");
  assert.equal(by["skills"].state, "yes");
});

test("harness document: golden", () => {
  if (process.env.FREE_REIN_GOLDEN) fs.writeFileSync(GOLDEN, JSON.stringify(stable(doc), null, 2) + "\n");
  assert.deepEqual(JSON.parse(JSON.stringify(stable(doc))), JSON.parse(fs.readFileSync(GOLDEN, "utf8")),
    "the document changed; if on purpose, refresh with FREE_REIN_GOLDEN=1");
});

test("harness document: scorer gives the board's numbers", () => {
  const s = score(doc, load()), pg = h.progression;
  assert.equal(s.xp, pg.xp_total ?? pg.xp);
  assert.equal(s.level, pg.level);
});
