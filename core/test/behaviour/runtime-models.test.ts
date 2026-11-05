// A runtime's model in its own file in the repo: a draft writes it there, and the board reads it back.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { rulesEdit, repoModel } from "../../src/write/changes";

test("main@<runtime> writes Gemini CLI's, OpenCode's and Codex's own model setting; the default removes it", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rtm-"));
  fs.mkdirSync(path.join(root, ".codex"));
  fs.writeFileSync(path.join(root, ".codex/config.toml"), 'approval_policy = "on-request"\n\n[mcp_servers.x]\ncommand = "y"\n');
  const apply = (rule: string) => { for (const e of rulesEdit(root, [{ kind: "model", rule }]) || []) { fs.mkdirSync(path.dirname(e.path), { recursive: true }); fs.writeFileSync(e.path, e.after); } };
  apply("main@gemini=gemini-2.5-pro"); apply("main@opencode=anthropic/claude-sonnet-5-5"); apply("main@codex=gpt-6.1-sol");
  assert.deepEqual([repoModel(root, "gemini"), repoModel(root, "opencode"), repoModel(root, "codex")], ["gemini-2.5-pro", "anthropic/claude-sonnet-5-5", "gpt-6.1-sol"]);
  assert.match(fs.readFileSync(path.join(root, ".codex/config.toml"), "utf8"), /^model = "gpt-6.1-sol"\napproval_policy[\s\S]*\[mcp_servers\.x\]/, "a top-level key, above the first table");
  apply("main@codex=default");
  assert.equal(repoModel(root, "codex"), null, "its default: the line goes");
  assert.equal(rulesEdit(root, [{ kind: "model", rule: "main@cursor=gpt-5.5" }]), null, "Cursor keeps its model in its app: nothing to write");
});
