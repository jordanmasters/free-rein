// Inside the editor, on a scratch copy of the solo sample: activate, check views and markers,
// then upgrade a piece for real, check the files and the new level, and undo it.
import * as vscode from "vscode";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until<T>(f: () => T | undefined, what: string, ms = 20000): Promise<T> {
  for (let t = 0; t < ms; t += 250) { const v = f(); if (v) return v; await wait(250); }
  throw new Error(`timed out waiting for ${what}`);
}
const level = (r: any, id: string) => r?.harnesses[0].slots.flatMap((s: any) => s.types).find((t: any) => t.id === id)?.maturity;

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension("free-rein.free-rein")!;
  const api = await ext.activate();
  const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const cmds = await vscode.commands.getCommands(true);
  for (const c of ["freeRein.open", "freeRein.pick", "freeRein.upgrade", "freeRein.showPiece", "freeRein.openAt"]) assert.ok(cmds.includes(c), `command ${c}`);
  const first = await until(() => api.reading(), "the first reading");
  const start = level(first, "hard-gate");
  assert.ok(start < 3, `Blocking hooks starts below level 3 (${start})`);
  console.log(`e2e: read ${first.harnesses[0].name}, Blocking hooks at level ${start}`);

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, "CLAUDE.md")));
  await vscode.window.showTextDocument(doc);
  const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>("vscode.executeCodeLensProvider", doc.uri);
  assert.ok((lenses ?? []).some(l => l.command?.title.includes("Project instructions")), "marker on CLAUDE.md");
  console.log("e2e: marker on CLAUDE.md");

  // upgrade for real
  const plan = await api.applyUpgrade("hard-gate");
  const script = path.join(root, ".claude", "hooks", "protect-files.sh");
  assert.ok(fs.existsSync(script), "the hook script was written");
  assert.ok(fs.statSync(script).mode & 0o100, "and is executable");
  const settings = JSON.parse(fs.readFileSync(path.join(root, ".claude", "settings.json"), "utf8"));
  assert.ok(JSON.stringify(settings.hooks.PreToolUse).includes("protect-files.sh"), "registered before edits");
  const after = await until(() => level(api.reading(), "hard-gate") === 3 ? api.reading() : undefined, "Blocking hooks at level 3");
  console.log(`e2e: upgraded Blocking hooks → level ${level(after, "hard-gate")} (${plan.effect.xp >= 0 ? "+" : ""}${plan.effect.xp} XP)`);

  // the hook really refuses a protected file and allows the rest
  const { execFileSync } = require("child_process");
  const probe = (file: string) => { try { execFileSync("bash", [script], { input: JSON.stringify({ tool_input: { file_path: path.join(root, file) } }), env: { ...process.env, CLAUDE_PROJECT_DIR: root } }); return 0; } catch (e: any) { return e.status; } };
  assert.strictEqual(probe(".env"), 2, "blocks .env");
  assert.strictEqual(probe("app/page.tsx"), 0, "allows ordinary files");
  console.log("e2e: the hook blocks .env and allows app/page.tsx");

  // undo puts every file back
  const before = plan.edits.find((e: any) => e.rel.endsWith("settings.json")).before;
  await api.undoUpgrade();
  assert.ok(!fs.existsSync(script), "undo removes the new script");
  const now = fs.existsSync(path.join(root, ".claude", "settings.json")) ? fs.readFileSync(path.join(root, ".claude", "settings.json"), "utf8") : null;
  assert.strictEqual(now, before, "undo restores settings.json exactly");
  await until(() => level(api.reading(), "hard-gate") === start ? true : undefined, `Blocking hooks back at level ${start}`);
  console.log(`e2e: undo put every file back, and Blocking hooks is level ${start} again`);

  // a draft: measured on a copy, reality alongside, nothing in the folder changes
  const files = fs.readdirSync(root).sort().join(",");
  await api.setDraft({ ups: ["hard-gate", "evals"] });
  const dr = await until(() => api.reading()?.harnesses[0].draft, "the draft's reading");
  assert.deepStrictEqual(dr.measured, ["hard-gate"]);
  assert.deepStrictEqual(dr.requested, ["evals"]);
  assert.strictEqual(level(api.reading(), "hard-gate"), 3, "the draft reads Blocking hooks in place");
  assert.ok(dr.reality.xp < api.reading().harnesses[0].progression.xp, "the draft is worth more than reality");
  assert.ok(!fs.existsSync(script), "a draft writes nothing");
  assert.strictEqual(fs.readdirSync(root).sort().join(","), files);
  await api.setDraft({ add: [], ups: [] });
  await until(() => api.reading()?.harnesses[0].draft ? undefined : true, "the draft discarded");
  console.log(`e2e: a draft read Blocking hooks in place (${dr.reality.xp} → ${api.reading().harnesses[0].progression.xp === dr.reality.xp ? "back to " + dr.reality.xp : "?"} XP), wrote nothing, and discarded cleanly`);
  console.log("e2e: ok");
}
