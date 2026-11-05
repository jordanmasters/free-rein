// The models list: models a harness uses are found, mentions are not, and the default fills in.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as models from "../../src/read/models";
import { rulesEdit } from "../../src/write/changes";
import { modelDir, setModelDir } from "../../src/read/spec";
import { tmpdir, write } from "../helpers";

/** A temporary root and home, removed afterwards */
function inDirs<T>(fn: (root: string, home: string) => T): T {
  const root = tmpdir(), home = tmpdir("free-rein-home-");
  try { return fn(root, home); }
  finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
}

// Found
test("found: uses are found", () => {
  inDirs((root, home) => {
    write(root, ".claude/settings.json", JSON.stringify({ model: "sonnet", env: { CLAUDE_CODE_SUBAGENT_MODEL: "haiku" } }));
    write(root, ".claude/agents/reviewer.md", "---\nname: reviewer\nmodel: opus\n---\nReview.\n");
    write(root, "scripts/setup.sh", "ollama pull llama3.2\n");
    write(root, "app/route.py", 'client.decisions.create(model="gpt-6-luna", questions=[])\nembed(model="nomic-embed-text")\n');
    const [hits] = models.found(root, home);
    const names = new Set(hits.map(([n, w]) => JSON.stringify([n, w.split(" (")[0]])));
    const has = (n: string, w: string) => assert.ok(names.has(JSON.stringify([n, w])), `${n}: ${w}`);
    has("sonnet", "the main model");
    has("haiku", "every subagent without its own");
    has("opus", "the reviewer subagent");
    has("llama3.2", "a local model it runs");
    has("gpt-6-luna", "the which-one and yes-or-no calls");
    has("nomic-embed-text", "turning text into vectors for search");
  });
});

test("found: mentions are not uses", () => {
  inDirs((root, home) => {
    write(root, "lib/detect.py", 'PATTERN = re.compile(r"gpt-6-luna|jev-latest|nomic-embed-text")\n');
    const [hits] = models.found(root, home);
    assert.deepEqual(hits, []);
  });
});

test("found: default fills in when nothing is set", () => {
  inDirs((root, home) => {
    const out = models.models(root, home);
    assert.equal(out.main_set, false);
    assert.equal(out.models.length, 1);
    assert.ok(out.models[0].used_for[0].includes("default"));
    assert.ok(out.note);
  });
});

test("found: a local server makes the main model local", () => {
  inDirs((root, home) => {
    write(root, ".claude/settings.json", JSON.stringify({ model: "qwen3-coder", env: { ANTHROPIC_BASE_URL: "http://localhost:11434" } }));
    const out = models.models(root, home);
    const main = out.models[0];
    assert.equal(main.runs, "local");
    assert.equal(out.main_set, true);
  });
});

test("found: in and out say who provides them", () => {
  const t = [{ id: "seer", name: "Seer", match: ["seer"], kind: "llm", runs: "cloud",
    inputs: { text: true, image: true, audio: false, video: false }, files: { pdf: false },
    outputs: { text: true, image: false, audio: false, video: false, decisions: false, vectors: false } }];
  // Python swaps models.table for a function returning t; the TypeScript table() reads models.json from the
  // model folder, so this points the model at a copy whose models.json holds t
  const data = tmpdir("free-rein-model-");
  inDirs((root, home) => {
    write(root, ".claude/settings.json", JSON.stringify({ model: "seer-2" }));
    const old = modelDir();
    fs.cpSync(old, data, { recursive: true });
    fs.writeFileSync(path.join(data, "models.json"), JSON.stringify({ models: t }));
    setModelDir(data);
    let out: any;
    try { out = models.models(root, home); }
    finally { setModelDir(null); fs.rmSync(data, { recursive: true, force: true }); }
    assert.deepEqual(out.inputs.image, { state: "yes", by: ["Seer"] });
    assert.equal(out.inputs.audio.state, "no");
    assert.equal(out.files.pdf.state, "no");
    assert.deepEqual(out.outputs.text.by, ["Seer"]);
  });
});

// Switch: a model choice in a draft is written where Claude Code reads it: `model` in the shared settings, or a subagent's frontmatter.
function inRoot<T>(fn: (root: string) => T): T {
  const root = tmpdir();
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("switch: main and agent", () => {
  inRoot(root => {
    write(root, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] } }));
    write(root, ".claude/agents/reviewer.md", "---\nname: reviewer\ndescription: Reviews\n---\nReview.\n");
    const es = rulesEdit(root, [{ kind: "model", rule: "main=sonnet" }, { kind: "model", rule: "agent:reviewer=haiku" },
      { kind: "ask", rule: "Bash(git push:*)" }])!;
    const by: Record<string, any> = Object.fromEntries(es.map((e: any) => [e.rel, e]));
    const st = JSON.parse(by[path.join(".claude", "settings.json")].after);
    assert.equal(st.model, "sonnet");
    assert.ok(st.permissions.ask.includes("Bash(git push:*)"));
    assert.ok(by[path.join(".claude", "agents", "reviewer.md")].after.includes("model: haiku"));
  });
});

test("switch: default takes the choice out", () => {
  inRoot(root => {
    write(root, ".claude/settings.json", JSON.stringify({ model: "opus" }));
    const es: any[] = rulesEdit(root, [{ kind: "model", rule: "main=default" }])!;
    assert.ok(!("model" in JSON.parse(es[0].after)));
  });
});

test("switch: nonsense is ignored", () => {
  inRoot(root => {
    assert.equal(rulesEdit(root, [{ kind: "model", rule: "main=$(rm -rf /)" }]), null);
  });
});
