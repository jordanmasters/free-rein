// Upgrading a piece: see what it would do (measured by Free Rein on a copy of the
// harness), look at the exact changes side by side, apply them as an ordinary
// edit you can undo, or hand the agent a precise request instead.
import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getPlan, listUpgrades, effectLines, editLines, Plan } from "./plan";

const SCHEME = "free-rein-plan";
const proposed = new Map<string, string>();     // free-rein-plan:/<id>/<rel> -> the file as it would be

export function registerPlans(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, {
    provideTextDocumentContent: u => proposed.get(u.path) ?? "",
  }));
}

export interface UpgradeDeps { root: () => string | undefined; freeReinDir: () => string | null; names: () => Record<string, string>; reload: () => Promise<void> }

export async function upgrade(deps: UpgradeDeps, piece?: string) {
  const root = deps.root();
  if (!root) return vscode.window.showWarningMessage("Free Rein: open a folder, or pick a harness to read.");
  let dir: string | null;
  dir = deps.freeReinDir();
  if (!piece) {
    const ups = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "Free Rein: finding upgrades" },
      () => listUpgrades(dir, root));
    const pick = await vscode.window.showQuickPick(ups.map(u => ({ label: u.name, description: `level ${u.maturity} · +${u.upgrade_xp} XP`,
      detail: u.template ? "$(wand) Free Rein can make this change" : "$(comment-discussion) Ask the agent (Free Rein writes the request)", piece: u.piece })),
      { title: "Free Rein: which piece to upgrade?", matchOnDetail: true });
    if (!pick) return;
    piece = pick.piece;
  }
  let p: Plan;
  try {
    p = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Free Rein: working out what this would change" },
      () => getPlan(dir, root, piece!));
  } catch (e) { return vscode.window.showErrorMessage(`Free Rein couldn't plan this: ${e instanceof Error ? e.message : e}`); }

  if (!p.template) return askAgent(p, root);
  const detail = [...effectLines(p, deps.names()), "", ...editLines(p),
    p.verified ? "" : "\n⚠ After this change Free Rein still doesn't read the piece as in place."].join("\n");
  const choice = await vscode.window.showInformationMessage(`Upgrade ${p.name}?`, { modal: true, detail },
    "Show the changes", "Apply", "Ask the agent instead");
  if (choice === "Ask the agent instead") return askAgent(p, root);
  if (choice === "Show the changes") {
    await showChanges(p);
    const next = await vscode.window.showInformationMessage(`Apply the change for ${p.name}? ${effectLines(p)[1] ?? ""}`, "Apply", "Ask the agent instead");
    if (next === "Ask the agent instead") return askAgent(p, root);
    if (next !== "Apply") return;
  } else if (choice !== "Apply") return;
  await apply(p, deps);
}

export async function showChanges(p: Plan) {
  const id = `${p.piece}-${Date.now()}`;
  const rows = p.edits.map(e => {
    const right = vscode.Uri.from({ scheme: SCHEME, path: `/${id}/${e.rel}` });
    proposed.set(right.path, e.after);
    const left = e.before === null ? vscode.Uri.from({ scheme: SCHEME, path: `/${id}/empty/${e.rel}` }) : vscode.Uri.file(e.path);
    return { file: vscode.Uri.file(e.path), left, right };
  });
  // one editor with every file, where the editor supports it; else one diff per file
  try {
    await vscode.commands.executeCommand("vscode.changes", `Free Rein: ${p.name}`, rows.map(r => [r.file, r.left, r.right]));
  } catch {
    for (const r of rows) await vscode.commands.executeCommand("vscode.diff", r.left, r.right, `${path.basename(r.file.fsPath)} · Free Rein: ${p.name}`, { preview: false });
  }
}

// the last upgrade applied, so it can be undone: created files go, changed ones get their old text back
let last: Plan | undefined;
export async function undoLast(deps: UpgradeDeps) {
  const p = last;
  if (!p) return vscode.window.showInformationMessage("Free Rein: nothing to undo.");
  const we = new vscode.WorkspaceEdit();
  for (const e of p.edits) {
    const u = vscode.Uri.file(e.path);
    if (e.before === null) we.deleteFile(u, { ignoreIfNotExists: true });
    else {
      const doc = await vscode.workspace.openTextDocument(u);
      we.replace(u, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), e.before);
    }
  }
  if (!await vscode.workspace.applyEdit(we)) return vscode.window.showErrorMessage(`Free Rein couldn't undo ${p.name}.`);
  for (const e of p.edits) {
    const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === e.path);
    if (doc?.isDirty) await doc.save();
  }
  last = undefined;
  await deps.reload();
  vscode.window.showInformationMessage(`Free Rein: undid ${p.name}.`);
}

// for tests: plan and apply without the dialogs
export async function applyNow(deps: UpgradeDeps, piece: string) {
  const p = await getPlan(deps.freeReinDir(), deps.root()!, piece);
  await apply(p, deps, true);
  return p;
}

// written as one workspace edit, so Undo puts every file back
export async function apply(p: Plan, deps: UpgradeDeps, quiet = false) {
  const we = new vscode.WorkspaceEdit();
  for (const e of p.edits) {
    const u = vscode.Uri.file(e.path);
    if (e.before === null) we.createFile(u, { ignoreIfExists: false, overwrite: false, contents: Buffer.from(e.after) });
    else {
      const doc = await vscode.workspace.openTextDocument(u);
      if (doc.getText() !== e.before) {
        return vscode.window.showWarningMessage(`Free Rein: ${e.rel} changed since the plan was made. Run the upgrade again.`);
      }
      we.replace(u, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), e.after);
    }
  }
  if (!await vscode.workspace.applyEdit(we)) return vscode.window.showErrorMessage(`Free Rein couldn't apply the change for ${p.name}.`);
  last = p;
  for (const e of p.edits) {
    const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === e.path);
    if (doc?.isDirty) await doc.save();
    if (e.mode) try { fs.chmodSync(e.path, fs.statSync(e.path).mode | 0o111); } catch { /* not there yet */ }
  }
  await deps.reload();
  if (quiet) return;
  const first = p.edits[0];
  const open = await vscode.window.showInformationMessage(`${p.name} added. ${effectLines(p).slice(1, 3).join(" · ")}`, "Open " + path.basename(first.rel), "Undo");
  if (open === "Undo") { await undoLast(deps); return; }
  if (open) await vscode.window.showTextDocument(vscode.Uri.file(first.path));
}

// no template: a precise request, copied, and optionally sent to Claude Code in a terminal
// hand a request straight to Claude Code, in a terminal in the folder
// (the request goes in a new folder of its own, readable only by you, so no other program can plant or swap it)
export function sendToClaude(name: string, piece: string, request: string, root: string) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), `free-rein-request-${piece}-`)), "request.md");
  fs.writeFileSync(file, request, { mode: 0o600 });
  const t = vscode.window.createTerminal({ name: `Free Rein: ${name}`, cwd: root });
  t.show();
  t.sendText(`claude "$(cat '${file.replace(/'/g, "'\\''")}')"`);
}

async function askAgent(p: Plan, root: string) {
  await vscode.env.clipboard.writeText(p.request);
  const pick = await vscode.window.showInformationMessage(`Free Rein wrote a request for ${p.name} and copied it.`,
    { modal: true, detail: p.request }, "Send it to Claude Code in a terminal", "Done");
  if (pick !== "Send it to Claude Code in a terminal") return;
  sendToClaude(p.name, p.piece, p.request, root);
}
