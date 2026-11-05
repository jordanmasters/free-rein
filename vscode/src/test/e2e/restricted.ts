// Inside the editor, on the same scratch copy but in Restricted Mode (the folder not trusted): Free Rein still reads and
// shows the harness, refuses to change it, and leaves every file as it was.
import * as vscode from "vscode";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until<T>(f: () => T | undefined, what: string, ms = 20000): Promise<T> {
  for (let t = 0; t < ms; t += 250) { const v = f(); if (v) return v; await wait(250); }
  throw new Error(`timed out waiting for ${what}`);
}
// every file under root with its contents, to compare before and after
function snapshot(root: string): string {
  const out: string[] = [];
  const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    if (e.name === ".git") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else out.push(`${path.relative(root, p)}\n${fs.readFileSync(p, "utf8")}`);
  } };
  walk(root);
  return out.join("\0");
}

export async function run(): Promise<void> {
  assert.strictEqual(vscode.workspace.isTrusted, false, "the folder opened in Restricted Mode");
  const ext = vscode.extensions.getExtension("free-rein.free-rein")!;
  const api = await ext.activate();
  const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const before = snapshot(root);

  const first = await until(() => api.reading(), "the first reading");
  assert.ok(first.harnesses[0].slots.length > 0, "the harness is read and shown");
  console.log(`e2e (restricted): read ${first.harnesses[0].name}`);

  await assert.rejects(async () => api.applyUpgrade("hard-gate"), /not trusted/, "an upgrade is refused");
  assert.strictEqual(snapshot(root), before, "no file changed");
  console.log("e2e (restricted): an upgrade was refused, and no file changed");
  console.log("e2e (restricted): ok");
}
