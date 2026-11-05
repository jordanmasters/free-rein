// Drafts: what you'd change about a harness, measured on a copy, nothing real
// changed. Per folder (or per runtime profile, for a new harness): packages to
// add, pieces to upgrade, and the runtime you're viewing it as (a lens). Kept
// private, in the editor's own storage. Saved drafts are named and reopened
// later; Apply writes the upgrades and installs the packages (asking how each
// time); a draft on a runtime profile creates a new folder.
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { core } from "./core";
import { apply, showChanges, sendToClaude, UpgradeDeps } from "./upgrade";
import { getPlan } from "./plan";
import type { Plan, Edit } from "./plan";
import { callCore } from "./read";

// rules: your calls on situations, as permission rules ({kind: allow|ask|deny, rule, sit}), and model choices ({kind: model, rule: "main=sonnet"})
// what a draft's rules say, in words: calls on situations, and model choices
export function ruleWords(rules?: Rule[]) {
  const calls = (rules ?? []).filter(r => r.kind !== "model").length, picks = (rules ?? []).filter(r => r.kind === "model");
  return [...(calls ? [`${calls} call${calls === 1 ? "" : "s"} on situations`] : []), ...picks.map(r => `model: ${r.rule.replace("=", " → ").replace(/^agent:/, "")}`)];
}
export interface Rule { kind: string; rule: string; sit?: string; preset?: string }
export interface Draft { add: string[]; ups: string[]; runtime?: string; noBase?: boolean; rules?: Rule[] }
export interface Saved extends Draft { name: string; saved: string }
export interface Applied { at: string; applied: string[]; from: { xp: number; level: number }; to?: { xp: number; level: number } }

const EMPTY: Draft = { add: [], ups: [] };
const uniq = (xs: string[]) => [...new Set(xs)];

export type Sit = { tool: string; target: string; stakes?: string };

export class Drafts {
  constructor(private ctx: vscode.ExtensionContext) {}
  private map<T>(key: string, store: vscode.Memento) { return store.get<Record<string, T>>(key) || {}; }

  // the current draft for a harness (folder path or profile:id)
  get(t: string): Draft {
    const d = this.map<Draft>("freeRein.draft", this.ctx.workspaceState)[t];
    const old = this.map<string[]>("freeRein.tried", this.ctx.workspaceState)[t] || [];   // before drafts (0.5)
    return { ...EMPTY, ...(d || {}), add: uniq([...(d?.add || []), ...(d ? [] : old)]) };
  }
  async set(t: string, d: Draft) {
    const all = this.map<Draft>("freeRein.draft", this.ctx.workspaceState);
    all[t] = { add: uniq(d.add), ups: uniq(d.ups), ...(d.runtime ? { runtime: d.runtime } : {}), ...(d.noBase ? { noBase: true } : {}), ...(d.rules?.length ? { rules: d.rules } : {}) };
    await this.ctx.workspaceState.update("freeRein.draft", all);
    const tr = this.map<string[]>("freeRein.tried", this.ctx.workspaceState);
    if (tr[t]) { delete tr[t]; await this.ctx.workspaceState.update("freeRein.tried", tr); }
  }
  // the runtime a folder runs on: what you set for it, else the freeRein.runtime setting
  homeRuntime(t: string, fallback: string) { return this.map<string>("freeRein.runtimeFor", this.ctx.globalState)[t] || fallback; }
  async setHomeRuntime(t: string, r: string) {
    const all = this.map<string>("freeRein.runtimeFor", this.ctx.globalState); all[t] = r;
    await this.ctx.globalState.update("freeRein.runtimeFor", all);
  }

  // situations you added for this harness, read with the rest (core/src/judge/oversight.ts): private, like drafts
  sits(t: string): Sit[] { return this.map<Sit[]>("freeRein.situations", this.ctx.globalState)[t] || []; }
  async setSits(t: string, s: Sit[]) {
    const all = this.map<Sit[]>("freeRein.situations", this.ctx.globalState); all[t] = s;
    await this.ctx.globalState.update("freeRein.situations", all);
  }

  saved(t: string): Saved[] { return this.map<Saved[]>("freeRein.drafts", this.ctx.globalState)[t] || []; }
  async save(t: string, s: Saved) {
    const all = this.map<Saved[]>("freeRein.drafts", this.ctx.globalState);
    all[t] = [s, ...(all[t] || []).filter(x => x.name !== s.name)];
    await this.ctx.globalState.update("freeRein.drafts", all);
  }
  async remove(t: string, name: string) {
    const all = this.map<Saved[]>("freeRein.drafts", this.ctx.globalState);
    all[t] = (all[t] || []).filter(x => x.name !== name);
    await this.ctx.globalState.update("freeRein.drafts", all);
  }

  history(t: string): Applied[] { return this.map<Applied[]>("freeRein.history", this.ctx.globalState)[t] || []; }
  async record(t: string, a: Applied) {
    const all = this.map<Applied[]>("freeRein.history", this.ctx.globalState);
    all[t] = [...(all[t] || []), a].slice(-200);
    await this.ctx.globalState.update("freeRein.history", all);
  }
}

// a draft's work, by Free Rein's core (core/src/write/drafts.ts)
const draftEdits = (deps: DraftDeps, root: string, d: Draft) => callCore<any>(deps.freeReinDir(), "edits", [root, d.ups, d.rules || []]);
const installIn = (deps: DraftDeps, root: string, id: string) => callCore<string[]>(deps.freeReinDir(), "installPackage", [root, id]);
const createIn = (deps: DraftDeps, dest: string, ups: string[], frameworks: string[]) => callCore<any>(deps.freeReinDir(), "create", [dest, ups, frameworks]);

export interface DraftDeps extends UpgradeDeps { target: () => string | undefined; h: () => any; drafts: Drafts; setTarget: (p: string) => Promise<void> }

const names = (h: any): Record<string, string> => Object.fromEntries((h?.slots ?? []).flatMap((s: any) => s.types).map((t: any) => [t.id, t.name]));
const info = (h: any, id: string) => (h?.available || []).find((a: any) => a.id === id) || { id, name: id };

// level n starts at level_curve·n² XP, rounded up, to max_level: the rules come with the data
// (the board data's "rules", from pieces.json progression), so this never keeps its own copy of the curve
export const levelAt = (xp: number, curve = 2.38, top = 50) => core.levelOf(xp, curve, top)[0];
// a level by the rules that came with this harness's data
const levelIn = (h: any, xp: number) => levelAt(xp, h?.rules?.level_curve ?? h?.progression?.level_curve, h?.rules?.max_level);
// the mode the harness is read in by default (core/src/report/board.ts readMode): the one its settings set, else auto
const readMode = (h: any) => { const m = h?.oversight?.set_mode?.mode; return m && h?.oversight?.by_mode?.[m] ? m : "auto"; };
// reality's XP: pieces and combos, plus the situations it covered, in that mode
const realXP = (h: any) => (h?.draft?.reality?.xp ?? 0) + (h?.draft?.reality?.sxp?.[readMode(h)] ?? 0);
// the numbers the draft changes, real → draft, in one line each
function effect(h: any): string[] {
  const r = h?.draft?.reality; if (!r) return [];
  const lv = (x: number) => levelIn(h, x), was = realXP(h), xp = h.progression?.xp_total ?? h.progression?.xp ?? 0;
  const out = [`Level ${lv(was)} → ${lv(xp)} · ${was} → ${xp} XP · backed trust ${r.backed}% → ${h.backed}%`];
  const now = Object.fromEntries(h.slots.flatMap((s: any) => s.types).map((t: any) => [t.id, t.maturity]));
  const L = ["Empty", "Started", "Equipped", "Hardened"];
  for (const [id, [n, m]] of Object.entries<any>(r.m)) if (now[id] !== m) out.push(`${n}: ${L[m]} → ${L[now[id]]}`);
  return out;
}

// how a package gets in for real: its installer, the agent, or not now
async function howToInstall(h: any, id: string, root: string | undefined): Promise<"installer" | "command" | "agent" | "skip" | undefined> {
  const a = info(h, id);
  type I = vscode.QuickPickItem & { v: "installer" | "command" | "agent" | "skip" };
  const items: I[] = [];
  if (a.kind === "framework" && root !== undefined)
    items.push({ label: `$(play) Run ${a.name}'s installer here`, detail: `Its own installer, with its defaults${a.install ? ` (what "${a.install}" does)` : ""}. Undo with git.`, v: "installer" });
  if (a.install) items.push({ label: "$(clippy) Copy the install command", detail: `${a.install}: you run it, in Claude Code or a terminal`, v: "command" });
  items.push({ label: "$(comment-discussion) Ask the agent to do it", detail: "Free Rein adds it to a request you hand to the agent", v: "agent" },
    { label: "$(circle-slash) Leave it out", detail: "It stays in the draft", v: "skip" });
  const pick = await vscode.window.showQuickPick(items, { title: `Free Rein: how should ${a.name} go in?`, ignoreFocusOut: true });
  return pick?.v;
}

// Apply: the upgrades written as one edit (undo puts every file back), packages as you choose
export async function applyDraft(deps: DraftDeps) {
  const t = deps.target(), h = deps.h(); if (!t || !h?.draft) return vscode.window.showInformationMessage("Free Rein: there's no draft to apply.");
  const d = deps.drafts.get(t), root = deps.root();
  if (!root) return createFromDraft(deps);
  const r = h.draft.reality;
  let e: { edits: Edit[]; applied: string[]; requested: string[] };
  try {
    e = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Free Rein: working out every file the draft writes" },
      () => draftEdits(deps, root, d));
  } catch (err) { return vscode.window.showErrorMessage(`Free Rein couldn't plan the draft: ${err instanceof Error ? err.message : err}`); }
  const nm = names(h);
  const detail = [...effect(h), "",
    ...e.edits.map(x => `${x.kind === "create" ? "New" : "Changes"} ${x.rel}: ${x.note}`),
    ...d.add.map(p => `Package ${info(h, p).name}: you choose how it goes in, next`),
    ...e.requested.map(p => `${nm[p] ?? p}: no template, so Free Rein writes a request for the agent`),
    ...(d.runtime ? ["", `Viewing as ${h.runtime?.name}: a lens, not applied (nothing to write)`] : [])].join("\n");
  if (!e.edits.length && !d.add.length && !e.requested.length) return vscode.window.showInformationMessage("Free Rein: nothing to write. This draft has no changes Free Rein can make itself.");
  const go = await vscode.window.showInformationMessage("Apply this draft?", { modal: true, detail }, ...(e.edits.length ? ["Show the changes"] : []), "Apply");
  if (go === "Show the changes") {
    await showChanges({ piece: "draft", name: "the draft", maturity: 0, template: true, edits: e.edits, request: "", effect: null, verified: true });
    if (await vscode.window.showInformationMessage("Apply the draft?", "Apply") !== "Apply") return;
  } else if (go !== "Apply") return;

  const asks: string[] = [], cmds: string[] = [], done: string[] = [], keep: string[] = [];
  for (const p of d.add) {
    const how = await howToInstall(h, p, root);
    if (!how || how === "skip") { keep.push(p); continue; }
    if (how === "installer") {
      try { await installIn(deps, root, p); done.push(p); }
      catch (err) { vscode.window.showErrorMessage(`${info(h, p).name}'s installer failed: ${err instanceof Error ? err.message : err}`); keep.push(p); }
    } else if (how === "command") { cmds.push(info(h, p).install); done.push(p); }
    else { asks.push(`Install ${info(h, p).name} in this repo${info(h, p).install ? ` (${info(h, p).install})` : ""}. ${info(h, p).about ?? ""}`); done.push(p); }
  }
  if (e.edits.length) await apply({ piece: "draft", name: "The draft", maturity: 0, template: true, edits: e.edits, request: "", effect: null, verified: true }, deps, true);
  for (const p of e.requested) {
    try {
      const plan = await getPlan(deps.freeReinDir(), root, p);
      asks.push(plan.request);
    } catch { asks.push(`Add ${nm[p] ?? p} to this harness.`); }
  }
  await deps.drafts.set(t, { add: keep, ups: [], runtime: d.runtime });
  await deps.drafts.record(t, { at: new Date().toISOString(), applied: [...e.applied, ...ruleWords(d.rules), ...done, ...e.requested.map(x => `${x} (asked the agent)`)], from: { xp: realXP(h), level: levelIn(h, realXP(h)) } });
  await deps.reload();
  await handOff(asks, cmds, root);
  vscode.window.showInformationMessage(`Free Rein: applied the draft${keep.length ? ` (still in the draft: ${keep.join(", ")})` : ""}.`, ...(e.edits.length ? ["Undo the file changes"] : []))
    .then(x => { if (x) vscode.commands.executeCommand("freeRein.undoUpgrade"); });
}

// what the person or the agent still has to do: copied, and optionally sent to Claude Code
async function handOff(asks: string[], cmds: string[], cwd: string) {
  if (!asks.length && !cmds.length) return;
  const text = [...(cmds.length ? ["Run:", ...cmds.map(c => `  ${c}`)] : []), ...(asks.length ? ["", "Ask the agent:", ...asks] : [])].join("\n").trim();
  await vscode.env.clipboard.writeText(asks.length ? asks.join("\n\n---\n\n") : cmds.join("\n"));
  const pick = await vscode.window.showInformationMessage(asks.length ? "Free Rein wrote a request for the agent and copied it." : "Free Rein copied the install commands.",
    { modal: true, detail: text }, ...(asks.length ? ["Send it to Claude Code in a terminal"] : []), "Done");
  if (pick !== "Send it to Claude Code in a terminal") return;
  sendToClaude("the draft", "draft", asks.join("\n\n---\n\n"), cwd);
}

// a draft on a runtime's out-of-the-box profile: a new harness, created as a new folder
export async function createFromDraft(deps: DraftDeps) {
  const t = deps.target(), h = deps.h(); if (!t || !h?.new) return;
  const d = deps.drafts.get(t);
  const parent = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: "Create it in here", title: "Free Rein: where should the new harness go?" });
  if (!parent?.[0]) return;
  const name = await vscode.window.showInputBox({ title: "Free Rein: name the new folder", value: "new-harness", validateInput: v => !v.trim() ? "A name, please" : fs.existsSync(path.join(parent[0].fsPath, v.trim())) ? "That folder already exists" : null });
  if (!name) return;
  const dest = path.join(parent[0].fsPath, name.trim());
  const frameworks: string[] = [];
  const cmds: string[] = [], asks: string[] = [];
  for (const p of d.add) {
    const how = await howToInstall(h, p, dest);
    if (how === "installer") frameworks.push(p);
    else if (how === "command") cmds.push(info(h, p).install);
    else if (how === "agent") asks.push(`Install ${info(h, p).name} in this repo${info(h, p).install ? ` (${info(h, p).install})` : ""}.`);
  }
  let out: { path: string; written: string[]; applied: string[]; requested: string[] };
  try {
    out = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Free Rein: creating ${name}` },
      () => createIn(deps, dest, d.ups, frameworks));
  } catch (err) { return vscode.window.showErrorMessage(`Free Rein couldn't create it: ${err instanceof Error ? err.message : err}`); }
  const nm = names(h);
  for (const p of out.requested) asks.push(`Add ${nm[p] ?? p} to this harness.`);
  await deps.drafts.setHomeRuntime(dest, h.new.runtime);
  await deps.drafts.set(t, { add: [], ups: [] });
  await deps.drafts.record(dest, { at: new Date().toISOString(), applied: [`created on ${h.new.name}`, ...out.applied, ...frameworks], from: { xp: realXP(h), level: levelIn(h, realXP(h)) } });
  await deps.setTarget(dest);
  await handOff(asks, cmds, dest);
  const open = await vscode.window.showInformationMessage(`Free Rein: created ${name} (${out.written.length} files) and is reading it now.`, "Open the folder in a new window");
  if (open) vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(dest), { forceNewWindow: true });
}

// keep the current draft under a name, to come back to
export async function saveDraft(deps: DraftDeps) {
  const t = deps.target(), h = deps.h(); if (!t) return;
  const d = deps.drafts.get(t);
  const nm = names(h);
  const what = [...d.add.map(p => `+ ${p}`), ...d.ups.map(u => `↑ ${nm[u] ?? u}`), ...ruleWords(d.rules), ...(d.runtime ? [`on ${h?.runtime?.name ?? d.runtime}`] : [])].join(", ");
  const name = await vscode.window.showInputBox({ title: "Free Rein: save this draft as", prompt: what || "an empty draft", value: what.slice(0, 60) || "Draft" });
  if (!name) return;
  await deps.drafts.save(t, { ...d, name, saved: new Date().toISOString() });
  vscode.window.showInformationMessage(`Free Rein: saved the draft "${name}". Open it again from Drafts.`);
}

export async function openDraft(deps: DraftDeps, reload: () => Promise<void>) {
  const t = deps.target(); if (!t) return;
  const list = deps.drafts.saved(t);
  if (!list.length) return vscode.window.showInformationMessage("Free Rein: no saved drafts for this harness yet.");
  type I = vscode.QuickPickItem & { s: Saved };
  const pick = await vscode.window.showQuickPick<I>(list.map(s => ({
    label: s.name, description: new Date(s.saved).toLocaleString(), s,
    detail: [...s.add.map(p => `+ ${p}`), ...s.ups.map(u => `↑ ${names(deps.h())[u] ?? u}`), ...ruleWords(s.rules), ...(s.runtime ? [`on ${s.runtime}`] : [])].join("  ") || "empty",
    buttons: [{ iconPath: new vscode.ThemeIcon("trash"), tooltip: "Delete this draft" }],
  })), { title: "Free Rein: open a saved draft (measured again against today's harness)" });
  if (!pick) return;
  await deps.drafts.set(t, { add: pick.s.add, ups: pick.s.ups, runtime: pick.s.runtime, rules: pick.s.rules });
  await reload();
}
