// The data files hold to their schemas (model/schema/), and every runtime claim can be traced: a claim
// that's confirmed or believed names a source the runtime lists, and every source has a date it was
// checked. Claims still waiting for a source are listed (spec.unsourced) and may not grow.
// (JSON Schema draft 2020-12 checked with ajv.)
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { modelDir, load as loadSpec, runtimeFiles, unsourced } from "../../src/read/spec";
import { REPO } from "../helpers";

const MODEL = modelDir();
const SCHEMA = path.join(REPO, "model", "schema");
const UNSOURCED_CEILING = 63;   // the backfill brings this down; it must never go up

const load = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

const validators = new Map<string, any>();
function validate(doc: any, schemaFile: string): string[] {
  if (!validators.has(schemaFile)) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    validators.set(schemaFile, ajv.compile(load(path.join(SCHEMA, schemaFile))));
  }
  const v = validators.get(schemaFile);
  return v(doc) ? [] : (v.errors || []).map((e: any) => `${e.instancePath.replace(/^\//, "")}: ${e.message}`);
}

test("schemas: pieces", () => {
  assert.deepEqual(validate(load(path.join(MODEL, "pieces.json")), "pieces.schema.json"), []);
});

test("schemas: each runtime", () => {
  for (const [rid, rt] of Object.entries(runtimeFiles())) {
    assert.equal(rt.id, rid, `${rid}: a runtime file is named after its id`);
    assert.deepEqual(validate(rt, "runtime.schema.json"), [], rid);
  }
});

test("schemas: profiles", () => {
  assert.deepEqual(validate(load(path.join(MODEL, "profiles.json")), "profiles.schema.json"), []);
});

test("symptoms.json fits its schema, and every piece it names exists", () => {
  const doc = load(path.join(MODEL, "symptoms.json"));
  assert.deepEqual(validate(doc, "symptoms.schema.json"), []);
  const pieces = new Set(load(path.join(MODEL, "pieces.json")).slots.flatMap((sl: any) => sl.items.map((i: any) => i.id)));
  for (const s of doc.symptoms) for (const p of s.pieces) assert.ok(pieces.has(p), `${s.id}: ${p}`);
});

test("schemas: editors, whose agents are runtimes Free Rein reads", () => {
  const doc = load(path.join(MODEL, "editors.json"));
  assert.deepEqual(validate(doc, "editors.schema.json"), []);
  const runtimes = new Set([...Object.keys(runtimeFiles()), ...load(path.join(MODEL, "profiles.json")).profiles.filter((p: any) => p.kind === "runtime").map((p: any) => p.id)]);
  for (const ed of doc.editors) for (const h of ed.harnesses) assert.ok(runtimes.has(h.runtime), `${ed.id}/${h.id}: ${h.runtime}`);
  const pieces = new Set(load(path.join(MODEL, "pieces.json")).slots.flatMap((sl: any) => sl.items.map((i: any) => i.id)));
  for (const ed of doc.editors) for (const s of ed.sections) for (const id of s.pieces)
    assert.ok(pieces.has(id), `${ed.id}/${s.kind}: ${id} is a piece`);
});

test("traceable: answers are for real pieces", () => {
  const pieces = new Set(load(path.join(MODEL, "pieces.json")).slots.flatMap((sl: any) => sl.items.map((i: any) => i.id)));
  for (const [rid, rt] of Object.entries(runtimeFiles())) {
    assert.deepEqual(Object.keys(rt.answers).filter(k => !pieces.has(k)).sort(), [], `${rid}: answers name pieces the model has`);
  }
});

test("traceable: real runtimes say what they were checked against", () => {
  for (const [rid, rt] of Object.entries(runtimeFiles())) {
    if (rt.sources && Object.keys(rt.sources).length) {   // "your own loop" has no product to check
      assert.ok(rt.version_checked && rt.checked_on, `${rid}: a runtime with sources records the version and date it was checked`);
    }
  }
});

test("traceable: named sources exist", () => {
  for (const [rid, rt] of Object.entries(runtimeFiles())) {
    const known = new Set(Object.keys(rt.sources || {}));
    const missing = [...new Set(Object.values(rt.answers as Record<string, any>).filter(a => a.source && !known.has(a.source)).map(a => a.source))].sort();
    assert.deepEqual(missing, [], `${rid}: a claim's source is in its runtime's list of sources`);
  }
});

test("traceable: unsourced claims do not grow", () => {
  const n = unsourced().length;
  assert.ok(n <= UNSOURCED_CEILING, `${n} confirmed or believed claims have no source (ceiling ${UNSOURCED_CEILING})`);
});

test("round trip: loaded shape", () => {
  const s = loadSpec();
  assert.ok("cores" in s);
  assert.ok(!("runtimes" in s));
  const hook = s.slots.flatMap((sl: any) => sl.items).find((i: any) => i.id === "hard-gate");
  assert.equal(hook.cores.claude[1], true);   // confirmed loads as true, as Free Rein has always read it
});

test("the parts catalog's page is rendered from catalog.json, never edited by hand", () => {
  const r = spawnSync(process.execPath, [path.join(REPO, "model", "parts", "render.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("one version for Free Rein: the repo, the core, the extension and the harness document's stamp agree", () => {
  const v = (p: string) => JSON.parse(fs.readFileSync(path.join(REPO, p), "utf8")).version;
  const { VERSION } = require("../../src/report/harness");
  assert.deepEqual([v("package.json"), v("core/package.json"), v("vscode/package.json"), VERSION], Array(4).fill(v("package.json")));
});
