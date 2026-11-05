// Free Rein in VS Code. One harness at a time (the open folder unless you pick
// another); the sidebar shows its summary and asks the trust check first,
// the Pieces view lists every piece and where it is, the status bar shows its
// level, and the full board opens in an editor tab.
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { execFile } from "child_process";
import { core } from "./core";
import { readHarness, readProfile, listProfiles, discoverNear, callCore, Reading, cancelReadings, CANCELLED, coreHere } from "./read";
import { page } from "./page";
import { PiecesProvider, Section } from "./tree";
import * as sidebarMod from "./sidebar";
import type { Summary } from "./sidebar";
import * as st from "./state";
import { Trace, CombosProvider } from "./trace";
import { registerPlans, upgrade, applyNow, undoLast, apply as applyPlan, sendToClaude } from "./upgrade";
import { getPlan, Plan } from "./plan";
import { filesRead, changedSince, watchList, outside, logScan, Scan } from "./fresh";
import { Drafts, applyDraft, saveDraft, openDraft, createFromDraft } from "./draft";

let ctx: vscode.ExtensionContext;
let panel: vscode.WebviewPanel | undefined;
let view: vscode.WebviewView | undefined;
let status: vscode.StatusBarItem;
let reading: Reading | undefined;
let error: string | undefined;
let watchers: vscode.Disposable[] = [];
// when the board's data was read, and from which files: shown on the board, and checked again when you come back to it
let readAt = "", readFiles: string[] = [], loading = false;
// what started the next scan, for the list of scans: you, a file that changed, coming back to the window…
let why = { text: "", changed: new Set<string>() };
const because = (text: string, files: string[] = []) => { why.text = text; files.forEach(f => why.changed.add(f)); };
const pieces = new PiecesProvider();
const combosView = new CombosProvider();
let trace: Trace;
let pendingPiece: string | undefined;
let drafts: Drafts;

export function activate(c: vscode.ExtensionContext): any {
  ctx = c;
  drafts = new Drafts(ctx);
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  ctx.subscriptions.push(status);
  trace = new Trace(ctx.globalStorageUri);
  const files = { scheme: "file" };
  ctx.subscriptions.push(trace,
    vscode.languages.registerCodeLensProvider(files, trace),
    vscode.languages.registerHoverProvider(files, trace),
    vscode.window.registerTreeDataProvider("freeRein.combos", combosView),
    vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(e => trace.decorate(e))),
    vscode.commands.registerCommand("freeRein.showPiece", showPiece),
    // from a tree item (its node), a hover or the board (a piece id), or the palette (nothing: pick one)
    vscode.commands.registerCommand("freeRein.upgrade", (arg?: any) => trusted("upgrade this harness") && upgrade(deps(), typeof arg === "string" ? arg : arg?.p?.id)),
    vscode.commands.registerCommand("freeRein.undoUpgrade", () => trusted("undo an upgrade") && undoLast(deps())),
    vscode.commands.registerCommand("freeRein.applyDraft", () => trusted("apply a draft") && applyDraft(ddeps())),
    vscode.commands.registerCommand("freeRein.saveDraft", () => saveDraft(ddeps())),
    vscode.commands.registerCommand("freeRein.openDraft", () => openDraft(ddeps(), load)),
    vscode.commands.registerCommand("freeRein.discardDraft", () => setDraft({ add: [], ups: [], rules: [] })));
  registerPlans(ctx);

  ctx.subscriptions.push(
    vscode.window.registerTreeDataProvider("freeRein.pieces", pieces),
    vscode.window.registerWebviewViewProvider("freeRein.summary", { resolveWebviewView: v => { view = v; setupView(v); } }),
    vscode.commands.registerCommand("freeRein.open", openBoard),
    vscode.commands.registerCommand("freeRein.refresh", () => { because("You asked for a scan"); return load(); }),
    vscode.commands.registerCommand("freeRein.review", () => runReview()),
    vscode.commands.registerCommand("freeRein.pick", pick),
    vscode.commands.registerCommand("freeRein.useFolder", () => setTarget(folder())),
    vscode.commands.registerCommand("freeRein.trust", async () => { const t = target(); if (t) { await st.clearTrust(ctx.globalState, t); await load(); openBoard(); } }),
    vscode.commands.registerCommand("freeRein.settings", () => vscode.commands.executeCommand("workbench.action.openSettings", `@ext:${ctx.extension.id}`)),
    vscode.commands.registerCommand("freeRein.openAt", openAt),
    vscode.commands.registerCommand("freeRein.showSidebar", () => showSidebar()),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration("freeRein")) return;
      // what counts changes the numbers, so read again; the rest only changes how the board looks
      // what counts changes the numbers (the runtime reads different files), so read again
      if (["countHome", "path", "runtime", "build", "cursorRunMode"].some(k => e.affectsConfiguration(`freeRein.${k}`))) { because("Free Rein's settings changed"); load(); }
      if (e.affectsConfiguration("freeRein.showInFiles")) trace.set(H());
      post({ type: "prefs", prefs: prefs() });
      render();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { if (!ctx.workspaceState.get("freeRein.target")) load(); }),
    // back in the window: a file the watchers missed (another program, a folder they don't cover) reads it again
    vscode.window.onDidChangeWindowState(w => { if (w.focused) recheck(); }),
  );
  if (ctx.extensionMode === vscode.ExtensionMode.Development) devReload();
  if (target()) { because("You opened the folder"); load(); }
  else renderStatus();
  // what the editor tests reach: the current reading, and an upgrade without dialogs
  return {
    reading: () => reading,
    applyUpgrade: (piece: string) => { if (!trusted("upgrade this harness")) throw new Error("not trusted"); return applyNow(deps(), piece); },
    undoUpgrade: () => undoLast(deps()),
    setDraft: (d: { add?: string[]; ups?: string[] }) => setDraft(d),
  };
}

export function deactivate() {}

// --- which harness -----------------------------------------------------------

const folder = () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
// the harness Free Rein reads: the one you picked for this workspace, else the open folder
const target = () => ctx.workspaceState.get<string>("freeRein.target") || folder();

const PROFILE = "profile:";
const isProfile = (t?: string) => !!t && t.startsWith(PROFILE);

async function setTarget(p: string | undefined) {
  await ctx.workspaceState.update("freeRein.target", p && p !== folder() ? p : undefined);
  reading = undefined;
  because("You switched folder");
  await load();
}

async function pick() {
  type Item = vscode.QuickPickItem & { path?: string; browse?: boolean };
  const cur = target(), here = folder();
  const items: Item[] = [];
  if (here) items.push({ label: "$(root-folder) This folder", description: path.basename(here), detail: here, path: here });
  const rec = st.recent(ctx.globalState).filter(p => p !== here && fs.existsSync(p));
  if (rec.length) items.push({ label: "Recent", kind: vscode.QuickPickItemKind.Separator }, ...rec.map(p => ({ label: `$(history) ${path.basename(p)}`, detail: p, path: p })));
  // harnesses next to this one: any folder an agent would load (CLAUDE.md, AGENTS.md, .claude/)
  const near = await discover(path.dirname(here ?? cur ?? os.homedir()));
  const more = near.filter(h => h.path !== here && !rec.includes(h.path));
  if (more.length) items.push({ label: "Nearby harnesses", kind: vscode.QuickPickItemKind.Separator },
    ...more.map(h => ({ label: `$(folder) ${h.name}`, description: h.uses.length ? `uses ${h.uses.join(", ")}` : "", detail: h.path, path: h.path })));
  // what each harness gives you out of the box, before anything of yours
  const profs = await listProfiles(freeReinDir()).catch(() => []);
  const run = profs.filter(p => p.kind === "runtime"), prod = profs.filter(p => p.kind === "product");
  if (run.length) items.push({ label: "Out of the box", kind: vscode.QuickPickItemKind.Separator },
    ...run.map(p => ({ label: `$(package) ${p.name}`, description: "out of the box", detail: `What ${p.name} gives you before you add anything (checked ${p.checked_on})`, path: PROFILE + p.id })));
  if (prod.length) items.push({ label: "Products on rails (described from their docs)", kind: vscode.QuickPickItemKind.Separator },
    ...prod.map(p => ({ label: `$(globe) ${p.name}`, description: p.build, detail: `Described from official docs and release notes (checked ${p.checked_on})`, path: PROFILE + p.id })));
  const refs = profs.filter(p => p.kind === "reference");
  if (refs.length) items.push({ label: "Hand-made chatbots on a model API (reference designs)", kind: vscode.QuickPickItemKind.Separator },
    ...refs.map(p => ({ label: `$(code) ${p.name.replace(/^Hand-made chatbot: /, "")}`, description: p.build, detail: p.about ?? "", path: PROFILE + p.id })));
  const exs = profs.filter(p => p.kind === "example");
  if (exs.length) items.push({ label: "Examples (not real harnesses)", kind: vscode.QuickPickItemKind.Separator },
    ...exs.map(p => ({ label: `$(beaker) ${p.name.replace(/^Example: /, "")}`, description: "example", detail: p.about ?? "", path: PROFILE + p.id })));
  items.push({ label: "", kind: vscode.QuickPickItemKind.Separator }, { label: "$(folder-opened) Choose a folder…", browse: true });
  for (const i of items) if (i.path && i.path === cur) i.description = [i.description, "current"].filter(Boolean).join(" · ");
  const choice = await vscode.window.showQuickPick(items, { title: "Free Rein: which harness?", placeHolder: "Free Rein reads one harness at a time", matchOnDetail: true });
  if (!choice) return;
  if (choice.browse) {
    const u = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: "Read this harness" });
    if (u?.[0]) await setTarget(u[0].fsPath);
  } else if (choice.path) await setTarget(choice.path);
}

function discover(base: string): Promise<{ name: string; path: string; uses: string[] }[]> {
  return discoverNear(base, freeReinDir()).catch(() => []);
}

// --- reading -----------------------------------------------------------------

const cfg = <T>(key: string, fallback: T) => vscode.workspace.getConfiguration("freeRein").get<T>(key) ?? fallback;
// what Free Rein wants you to know but needn't interrupt you with: View > Output > Free Rein
let channel: vscode.OutputChannel | undefined;
const log = (msg: string) => (channel ??= vscode.window.createOutputChannel("Free Rein")).appendLine(`${new Date().toLocaleTimeString()}  ${msg}`);
const prefs = () => ({ runtime: cfg("runtime", "claude"), countHome: cfg("countHome", true), palette: cfg("palette", "vivid"),
  character: cfg("character", true), characterKind: cfg("characterKind", "jack"), characterName: cfg("characterName", "Sprout"), characterColor: cfg("characterColor", "green"),
  sounds: cfg("sounds", "off"), agentReview: cfg("agentReview", false), editor: /cursor/i.test(vscode.env.appName) ? "cursor" : "vscode" });

// where Free Rein's data comes from: a Free Rein repo (the setting, else the repo this extension runs from while
// working on it), so a change to its data shows at once; null: the copy built into the extension (media/model), which
// matches its own core and is all an installed extension needs (a repo found elsewhere could be a different version)
function freeReinDir(): string | null {
  const has = (d: string) => fs.existsSync(path.join(d, "model", "pieces.json"));
  const set = cfg("path", "");
  if (set && has(set)) return set;
  const repo = path.resolve(ctx.extensionPath, "..");
  return has(repo) ? repo : null;
}

// the draft for the harness being read (packages to try, pieces to upgrade, a runtime lens): private, per folder
// the level the board shows: its own, when it has posted one for this harness; else pieces, combos and the
// situations covered (auto mode), from the board data's xp_total
let boardLevel: { key?: string; level: number; xp: number; rank: string } | undefined;
// where level n starts: level_curve × n², rounded up; the curve comes with the data ("rules")
const atLevel = (n: number, curve = 2.38) => core.levelStart(n, curve);
function levelOf(h: any) {
  if (boardLevel && boardLevel.key === h.key) return boardLevel;
  const pg = h.progression || {}, xp = pg.xp_total ?? pg.xp ?? 0;
  return { level: pg.level ?? 0, xp, rank: "" };
}
const draftOf = (t: string) => drafts.get(t);
// the runtime Free Rein reads with: the draft's lens, else what this folder runs on
// the modes you've told Free Rein, for settings a runtime keeps where no file shows them (Cursor's run mode in the editor)
const runChoice = (): Record<string, Record<string, string>> => { const c = cfg<string>("cursorRunMode", ""); return c ? { cursor: { "run mode": c } } : {}; };
const runtimeFor = (t: string) => draftOf(t).runtime || drafts.homeRuntime(t, cfg("runtime", "claude"));
async function setDraft(patch: Partial<{ add: string[]; ups: string[]; runtime: string | null; noBase: boolean; rules: { kind: string; rule: string; sit?: string }[] }>) {
  const t = target(); if (!t) return;
  const d = draftOf(t), home = isProfile(t) ? undefined : drafts.homeRuntime(t, cfg("runtime", "claude"));
  const runtime = patch.runtime === null ? undefined : patch.runtime ?? d.runtime;
  await drafts.set(t, { add: patch.add ?? d.add, ups: patch.ups ?? d.ups, runtime: runtime && runtime !== home ? runtime : undefined, noBase: patch.noBase ?? d.noBase, rules: patch.rules ?? d.rules });
  await load();
}

let loadGen = 0;
async function load() {
  const t = target();
  if (!t) { reading = undefined; render(); return; }
  error = undefined;
  render();
  // only the latest reading counts: an older, slower one (another runtime, a package since removed) is dropped
  const gen = ++loadGen;
  let got: typeof reading;
  const cause = { text: why.text || "Read", changed: [...why.changed] }, t0 = Date.now(); why = { text: "", changed: new Set() };
  // what the scan is doing, as it does it: why it started, then each step the core reports, with the time it began
  const d0 = isProfile(t) ? null : draftOf(t), measuring = !!(d0 && (d0.add.length || d0.ups.length || (d0.rules || []).length || d0.runtime || d0.noBase));
  loading = true; post({ type: "reading", why: measuring ? "Measuring the draft on a copy" : cause.text, changed: cause.changed.map(f => f.replace(t + path.sep, "").replace(os.homedir(), "~")), draft: measuring, at: t0 });
  const onStep = (s: { id: string; label: string; detail?: string }) => { if (gen === loadGen) post({ type: "scanstep", ...s, at: Date.now() }); };
  try {
    const dir = freeReinDir();
    got = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "Free Rein: reading the harness" },
      () => isProfile(t) ? readProfile(t.slice(PROFILE.length), dir, draftOf(t).add, draftOf(t).ups, cfg("countHome", true), onStep)
        : readHarness(t, dir, cfg("countHome", true), runtimeFor(t), cfg<string>("build", "auto") === "auto" ? "" : cfg<string>("build", "auto"), draftOf(t).add, draftOf(t).ups, !!draftOf(t).noBase, drafts.sits(t), draftOf(t).rules || [], runChoice(), onStep));
    if (gen !== loadGen) return;
    reading = got;
    // stamped when read, with the files it came from (a profile comes from Free Rein's records, not your files)
    readAt = new Date().toISOString(); readFiles = isProfile(t) ? [] : filesRead(got, t);
    // what the board needs to show the draft: the lens and the folder's own runtime, saved drafts
    const h0: any = reading?.harnesses[0];
    // the trust check's answers, so the board can show where your trust runs ahead of the evidence
    if (h0) { const ts: any = isProfile(t) ? undefined : st.trustState(ctx.globalState, t); h0.answers = ts?.answers ?? null;
      h0.trustState = isProfile(t) ? "skipped" : !ts ? "none" : ts.answers ? "answered" : "skipped"; }
    if (h0) h0.lens = { home: isProfile(t) ? null : drafts.homeRuntime(t, cfg("runtime", "claude")), runtime: draftOf(t).runtime ?? null, saved: drafts.saved(t).length, ups: draftOf(t).ups, rules: draftOf(t).rules || [], noBase: !!draftOf(t).noBase,
      savedList: drafts.saved(t).map(d => ({ name: d.name, saved: d.saved, add: d.add, ups: d.ups, rules: d.rules || [], runtime: d.runtime })) };
    // what Free Rein applied here, for the History view
    if (h0) h0.history = drafts.history(t);
    if (h0) h0.yourSits = isProfile(t) ? [] : drafts.sits(t);
    if (h0) h0.read = { at: readAt, files: readFiles.length, profile: isProfile(t) };
    // the list of scans: each scan of your files as they are (a draft or another runtime is measured on a copy, not a scan)
    const key = `freeRein.scans:${t}`;
    if (h0 && !isProfile(t) && !h0.draft && !draftOf(t).runtime && !draftOf(t).noBase) { const s = summary();
      if (s) { const ov: any = h0.oversight, m = ov?.set_mode?.mode || "auto", sits: any[] = ov?.by_mode?.[m]?.situations || [];
        await ctx.globalState.update(key, logScan(ctx.globalState.get<Scan[]>(key, []), { at: readAt, kind: "rules", why: cause.text,
          changed: cause.changed.map(f => f.startsWith(t + path.sep) ? path.relative(t, f) : f.replace(os.homedir(), "~")).slice(0, 12), ms: Date.now() - t0,
          files: readFiles.length, xp: s.xp, level: s.level, equipped: s.equipped, backed: s.backed, exposed: sits.filter(x => x.verdict === "exposed").length,
          ...(h0.free_rein ? { free: h0.free_rein.pct, rules: h0.free_rein.rules.written, measured: h0.free_rein.rules.measured, enforced: h0.free_rein.rules.enforced } : {}) })); } }
    if (h0) h0.scans = isProfile(t) ? [] : ctx.globalState.get<Scan[]>(key, []).slice(-50);
    if (!isProfile(t)) await st.addRecent(ctx.globalState, t);
  } catch (e) {
    if (gen !== loadGen) return;
    // cancelled: the board keeps the last scan it has; nothing failed
    if (e instanceof Error && e.message === CANCELLED) { loading = false; post({ type: "cancelled" }); if (!isProfile(t)) watch(t); return; }
    reading = undefined; error = e instanceof Error ? e.message : String(e);
    log(`couldn't read ${t}: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    post({ type: "failed", error });
  }
  loading = false;
  if (!isProfile(t)) watch(t); else { watchers.forEach(w => w.dispose()); watchers = []; }
  render();
  if (panel && reading) panel.title = `Free Rein · ${H().name}`;
  if (reading) post({ type: "data", data: reading });
}

// read again when anything an agent loads at session start changes: what each supported runtime loads in the folder
// and (when it counts) from your home folder, a commit, and any other file the reading came from
function watch(t: string) {
  watchers.forEach(w => w.dispose()); watchers = [];
  let timer: NodeJS.Timeout | undefined;
  const again = (u?: vscode.Uri) => { because(u ? "A file changed" : "Files changed", u ? [u.fsPath] : []); clearTimeout(timer); timer = setTimeout(load, 800); };
  const home = cfg("countHome", true);
  const on = (base: string, glob: string) => {
    const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(base), glob));
    w.onDidChange(again); w.onDidCreate(again); w.onDidDelete(again);
    watchers.push(w);
  };
  for (const { base, glob } of watchList(t, home)) if (fs.existsSync(base)) on(base, glob);
  for (const f of readFiles.filter(f => outside(f, t, home)).slice(0, 100)) on(path.dirname(f), path.basename(f));
}

// the agent review: the user's own agent reads the harness for what Free Rein's rules can't check, and writes
// .free-rein/review.json, which the board reads back (core/src/report/review.ts). Only ever started here, by the user:
// Free Rein runs no model and sends nothing; the agent does, as it does in its normal work, so it asks first
async function runReview() {
  // a preview, behind its setting until it's been tried on real repos
  if (!cfg("agentReview", false)) {
    const on = await vscode.window.showInformationMessage("Free Rein: the agent review is a preview, off for now. Turn it on in Settings (Free Rein: Agent Review).", "Open the setting");
    if (on) vscode.commands.executeCommand("workbench.action.openSettings", "freeRein.agentReview");
    return;
  }
  const t = target();
  if (!t || isProfile(t)) { vscode.window.showInformationMessage("Free Rein: an agent review reads a folder. Open one first."); return; }
  if (!reading) { vscode.window.showInformationMessage("Free Rein: wait for the scan to finish, then ask again."); return; }
  if (!trusted("ask your agent to review this harness")) return;
  const C = coreHere(freeReinDir()), sens: { file: string; tracked: boolean }[] = C.sensitiveFiles(t), rt = runtimeFor(t), claude = rt === "claude";
  const go = await vscode.window.showWarningMessage(`Ask your own ${claude ? "Claude Code" : "agent"} to review this harness?`, { modal: true,
    detail: `It reads the harness's instructions, skills, agents and hooks, and sends them to your model's provider, the same as in your normal work. Free Rein sends nothing itself.\n\n`
      + (sens.length ? `${sens.length} sensitive file${sens.length === 1 ? "" : "s"} (${sens.slice(0, 4).map(s => s.file).join(", ")}${sens.length > 4 ? ", …" : ""}) ${claude ? "are denied to it: it can't read them" : "are named in the brief as off limits (asked, not enforced: only Claude Code can deny them here)"}.\n\n` : "")
      + `It writes one file, ${C.REVIEW_DIR}/${C.REVIEW_FILE}. The board picks it up and keeps only the findings whose quotes are really in the files.` }, "Start the review");
  if (go !== "Start the review") return;
  const dir = path.join(t, C.REVIEW_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, C.BRIEF_FILE), C.reviewBrief(t, H()), { mode: 0o600 });
  if (!fs.existsSync(path.join(dir, ".gitignore"))) fs.writeFileSync(path.join(dir, ".gitignore"), `# the brief is written fresh for each review\n${C.BRIEF_FILE}\n`);
  const prompt = `Read ${C.REVIEW_DIR}/${C.BRIEF_FILE} and do what it says: review this harness and write ${C.REVIEW_DIR}/${C.REVIEW_FILE}.`;
  if (!claude) {
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage(`Free Rein: the brief is in ${C.REVIEW_DIR}/${C.BRIEF_FILE}. The request is copied: paste it into your agent.`);
    return;
  }
  // Claude Code, in a terminal in the folder: it may read and search; it may write only the review without asking; it
  // can't run commands, fetch, or read the sensitive files (permission rules given at the start: believed to apply to
  // every tool that reads files, as Claude Code documents)
  const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
  const deny = ["Bash", "WebFetch", "WebSearch", "NotebookEdit", ...sens.map(s => `Read(./${s.file})`)];
  const allow = ["Read", "Grep", "Glob", `Edit(./${C.REVIEW_DIR}/${C.REVIEW_FILE})`, `Write(./${C.REVIEW_DIR}/${C.REVIEW_FILE})`];
  const term = vscode.window.createTerminal({ name: "Free Rein: agent review", cwd: t });
  term.show();
  term.sendText(`claude ${q(prompt)} --permission-mode default --allowedTools ${allow.map(q).join(" ")} --disallowedTools ${deny.map(q).join(" ")}`);
  because("Your agent started a review");
}

// the files the board was read from, checked again: any changed since, it reads them again
function recheck() {
  const t = target();
  if (!t || isProfile(t) || loading || !reading || !readAt) return;
  const ch = changedSince(readFiles, readAt);
  if (ch.length) { because("Back in the window: files had changed", ch); load(); }
}

// --- showing it --------------------------------------------------------------

const H = () => reading?.harnesses[0] as any;
const trust = () => { const t = target(); return isProfile(t) ? { skipped: true } as st.TrustState : t ? st.trustState(ctx.globalState, t) : undefined; };

function summary(): Summary | null {
  const h = H(); if (!h) return null;
  const pg = h.progression, types = h.slots.flatMap((s: any) => s.types), L = levelOf(h);
  const syn = h.sets.filter((s: any) => s.kind === "synergy");
  return {
    name: h.name, root: target()!, uses: ((h.uses || []) as string[]).map(id => h.plugins?.[id]?.name ?? id),
    level: L.level, xp: L.xp, levelStart: atLevel(L.level, h.rules?.level_curve), nextAt: atLevel(L.level + 1, h.rules?.level_curve),
    rank: pg.rank?.name ?? null, rankTier: pg.rank?.tier ?? null,
    next: pg.next_rank ? { name: pg.next_rank.name, tier: pg.next_rank.tier, needs: pg.next_rank.needs, weakSpots: pg.next_rank.weak_spots.length } : null,
    backed: h.backed, equipped: types.filter((t: any) => t.stage === 2).length, total: types.length,
    weak: h.sets.filter((s: any) => s.kind === "curse" && s.status === "active").length,
    earned: syn.filter((s: any) => s.status === "active").length, achievements: syn.length,
    trust: h.trust,
    sections: h.slots.map((x: any) => ({ id: x.id, name: x.name, types: x.types.map((t: any) => ({ name: t.name, maturity: t.maturity })) })),
    palette: cfg("palette", "vivid"),
    profile: h.profile ?? null,
    // one line: what it runs on (or is viewed as), then a draft if one is open; the build stays out until it means something
    what: (h.lens?.runtime ? `viewed as ${h.runtime?.name}` : h.runtime?.name ?? "") + (h.profile?.kind === "product" ? " · on rails" : "") + (h.draft ? ` · draft: ${[...(h.draft.add || []).map((x: string) => "+ " + x), ...(h.draft.ups || []).map((x: string) => "↑ " + x), ...(h.draft.rules?.length ? [`${h.draft.rules.length} call${h.draft.rules.length === 1 ? "" : "s"} on situations`] : [])].join(", ")}` : ""),
    runtimeName: h.runtime?.name,
    // the layers, as the board counts them: the runtime, each package, your ~/.claude (if anything of yours loads from it), your own files
    layers: 1 + new Set(types.flatMap((t: any) => [...(t.inst || []), ...(t.extra || [])].map((x: any) => x.pkg).filter(Boolean))).size
      + (types.some((t: any) => [...(t.inst || []), ...(t.extra || [])].some((x: any) => !x.pkg && (x.scope === "user" || x.scope === "org"))) ? 1 : 0)
      + (h.profile ? 0 : 1),
  };
}

function render() {
  // the sidebar: the board, compact (the circle and the side panel's tabs) once there's a reading; the card before
  if (view) {
    if (target() && reading && !error && cfg("compactBoard", true)) {
      if (!viewBoard) { viewBoard = true; view.webview.html = boardHtml(view.webview, vscode.Uri.joinPath(ctx.extensionUri, "media"), true); }
    } else {
      viewBoard = false;
      view.webview.html = sidebar().sidebarHtml(view.webview.cspSource, target() ? summary() : null, trust(), target() ? error : "Open a folder, or pick a harness to read.");
    }
  }
  const h = H();
  pieces.set(h ? h.slots as Section[] : [], target() ?? "");
  combosView.set(h, target() ?? "");
  trace.set(h);
  renderStatus();
}

function renderStatus() {
  const h = H(), t = trust();
  if (!target()) { status.hide(); return; }
  status.command = "freeRein.open";
  if (error) { status.text = "$(warning) Free Rein"; status.tooltip = `Free Rein couldn't read this harness: ${error}`; }
  else if (!h) { status.text = "$(sync~spin) Free Rein"; status.tooltip = "Free Rein is reading the harness"; }
  else if (!t) { status.text = "$(question) Free Rein: trust check"; status.tooltip = "Answer five questions before you see the numbers"; status.command = "freeRein.showSidebar"; }
  else {
    const L = levelOf(h);
    status.text = `$(star-full) Lv ${L.level}${L.rank ? ` · ${L.rank}` : ""}`;
    status.tooltip = `Free Rein · ${h.name}: level ${L.level} (${L.xp} XP), ${L.rank ? `lowest grade: ${L.rank}` : "not graded yet"}. Click to open your harness.`;
  }
  status.show();
}

const showSidebar = () => vscode.commands.executeCommand("freeRein.summary.focus");

function setupView(v: vscode.WebviewView) {
  v.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, "media")] };
  v.webview.onDidReceiveMessage(async m => {
    const t = target();
    if (viewBoard) return onBoard(m);
    switch (m?.type) {
      case "pick": return pick();
      case "open": return openBoard();
      case "refresh": because("You asked for a scan"); return load();
      case "settings": return vscode.commands.executeCommand("freeRein.settings");
      case "skip": if (t) await st.skipTrust(ctx.globalState, t); return render();
      case "retake": if (t) await st.clearTrust(ctx.globalState, t); return render();
      case "answers": if (t && m.answers) await st.saveAnswers(ctx.globalState, t, m.answers); return render();
    }
  }, undefined, ctx.subscriptions);
  v.onDidChangeVisibility(() => { if (v.visible) { viewBoard = false; render(); } });
  render();
}

async function openBoard() {
  if (!target()) { vscode.window.showWarningMessage("Free Rein: open a folder, or pick a harness to read."); return pick(); }
  // the trust check comes before the numbers: the board opens on it (Trust view) until you answer or skip
  if (!reading) await load();
  if (!reading) return;
  if (panel) { panel.reveal(); return; }
  const media = vscode.Uri.joinPath(ctx.extensionUri, "media");
  panel = vscode.window.createWebviewPanel("freeRein.loadout", `Free Rein · ${H().name}`, vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] });
  const w = panel.webview, uri = (f: string) => w.asWebviewUri(vscode.Uri.joinPath(media, f)).toString();
  w.html = boardHtml(w, media);

  w.onDidReceiveMessage(onBoard, undefined, ctx.subscriptions);
  panel.onDidDispose(() => { panel = undefined; }, undefined, ctx.subscriptions);
  panel.onDidChangeViewState(e => { if (e.webviewPanel.active) recheck(); }, undefined, ctx.subscriptions);
}

// plans the piece pane has shown, so Write writes exactly what you looked at
const plans = new Map<string, Plan>();
// what the board posts, from the full board or the sidebar's compact one
function onBoard(m: any) {
    // Expand (only the sidebar's compact board sends it): the full board takes over, so the sidebar closes
    if (m?.type === "openFull") {
      openBoard().then(() => { panel?.webview.postMessage({ type: "view", view: m.view }); vscode.commands.executeCommand("workbench.action.closeSidebar"); });
      return;
    }
    if (m?.type === "open" && typeof m.path === "string") openAt(m.path, m.lines);
    if (m?.type === "pick") pick();
    if (m?.type === "refresh") { because("You asked for a scan"); load(); return; }
    if (m?.type === "cancelScan") { cancelReadings(); return; }
    if (m?.type === "review") { runReview(); return; }
    // turning the agent review on, from its row on the board (a setting, for the user, in every window)
    if (m?.type === "enableReview") { vscode.workspace.getConfiguration("freeRein").update("agentReview", true, vscode.ConfigurationTarget.Global); return; }
    if (m?.type === "upgrade" && typeof m.id === "string") vscode.commands.executeCommand("freeRein.upgrade", m.id);
    // the piece pane's Add flow: the plan (measured on a copy, nothing written), Write as one undoable edit, Undo
    if (m?.type === "plan" && typeof m.id === "string") { const root = deps().root(); if (!root) return;
      getPlan(freeReinDir(), root, m.id).then(p => { plans.set(m.id, p); post({ type: "plan", id: m.id, plan: p }); })
        .catch(e => post({ type: "plan", id: m.id, plan: { error: e instanceof Error ? e.message : String(e) } })); return; }
    if (m?.type === "write" && typeof m.id === "string") { const p = plans.get(m.id); if (!p) return;
      if (!trusted("write this change")) { post({ type: "failed" }); return; }
      applyPlan(p, deps(), true).then(() => post({ type: "written", id: m.id, files: p.edits.map(e => e.rel) })); return; }
    if (m?.type === "undo") { if (!trusted("undo a change")) return; undoLast(deps()).then(() => post({ type: "undone", id: m.id })); return; }
    if (m?.type === "copy" && typeof m.text === "string") { vscode.env.clipboard.writeText(m.text); return; }
    if (m?.type === "build" && typeof m.id === "string" && trusted("ask Claude Code to build this")) { const p = plans.get(m.id), root = deps().root(); if (p && root) sendToClaude(p.name, p.piece, p.request, root); return; }
    const ids = (x: unknown) => Array.isArray(x) ? x.filter((v: unknown) => typeof v === "string") as string[] : undefined;
    if (m?.type === "try" && ids(m.ids)) setDraft({ add: ids(m.ids) });
    const rules = (x: unknown) => Array.isArray(x) ? x.filter((r: any) => r && ["allow", "ask", "deny", "model"].includes(r.kind) && typeof r.rule === "string").map((r: any) => ({ kind: r.kind, rule: r.rule, ...(typeof r.sit === "string" ? { sit: r.sit } : {}), ...(typeof r.preset === "string" ? { preset: r.preset } : {}) })) : undefined;
    if (m?.type === "draft") setDraft({ add: ids(m.add), ups: ids(m.ups), rules: rules(m.rules) });
    if (m?.type === "lens") setDraft({ runtime: typeof m.runtime === "string" ? m.runtime : null });
    if (m?.type === "home" && typeof m.runtime === "string") { const t = target(); if (t && !isProfile(t)) drafts.setHomeRuntime(t, m.runtime).then(() => setDraft({ runtime: null })); }
    if (m?.type === "discard") setDraft({ add: [], ups: [], rules: [] });
    if (m?.type === "base") setDraft({ noBase: !m.on });
    // a situation of your own: what would happen if the agent did this here
    const ts0 = target();
    if (m?.type === "addSit" && !(ts0 && !isProfile(ts0) && typeof m.target === "string" && m.target.trim())) post({ type: "failed" });
    if (m?.type === "addSit" && ts0 && !isProfile(ts0) && typeof m.target === "string" && m.target.trim())
      drafts.setSits(ts0, [...drafts.sits(ts0).filter(x => !(x.tool === m.tool && x.target === m.target.trim())), { tool: String(m.tool || "Bash"), target: m.target.trim(), ...(typeof m.stakes === "string" && m.stakes ? { stakes: m.stakes } : {}) }]).then(load);
    if (m?.type === "removeSit" && ts0 && typeof m.target === "string") drafts.setSits(ts0, drafts.sits(ts0).filter(x => !(x.tool === m.tool && x.target === m.target))).then(load);
    if (m?.type === "saveDraft") saveDraft(ddeps());
    if (m?.type === "openDraft") openDraft(ddeps(), load);
    if (m?.type === "apply" && trusted("apply a draft")) applyDraft(ddeps());
    if (m?.type === "openDraftNamed" && typeof m.name === "string") { const t = target(); const d = t ? drafts.saved(t).find(x => x.name === m.name) : undefined; if (t && d) drafts.set(t, { add: d.add, ups: d.ups, runtime: d.runtime, rules: d.rules }).then(load); else post({ type: "failed" }); }
    // a dry run of a task through the harness (core/src/judge/simulate.ts), on the folder as it is
    if (m?.type === "simulate" && Array.isArray(m.steps)) simulate(m.steps, !!m.runHooks);
    if (m?.type === "trustCheck") vscode.commands.executeCommand("freeRein.trust");
    // the trust check, answered on the board's Trust view; kept per harness, as the sidebar did
    const tt = target();
    if (m?.type === "answers" && tt && m.answers && typeof m.answers === "object") st.saveAnswers(ctx.globalState, tt, m.answers).then(load);
    if (m?.type === "skip" && tt) st.skipTrust(ctx.globalState, tt).then(load);
    if (m?.type === "retake" && tt) st.clearTrust(ctx.globalState, tt).then(load);
    if (m?.type === "settings") vscode.commands.executeCommand("freeRein.settings");
    if (m?.type === "copy" && typeof m.text === "string") vscode.env.clipboard.writeText(m.text).then(() => vscode.window.showInformationMessage(`Copied: ${m.text}`));
    // the board's own switches save to settings, which flow back to the board and sidebar
    if (m?.type === "prefs" && m.prefs) {
      const c = vscode.workspace.getConfiguration("freeRein"), map: Record<string, string> = { runtime: "runtime", palette: "palette", countHome: "countHome", build: "build", character: "character", characterKind: "characterKind", characterName: "characterName", characterColor: "characterColor", sounds: "sounds", cursorRunMode: "cursorRunMode" };
      for (const [k, v] of Object.entries(m.prefs)) if (map[k]) c.update(map[k], v, vscode.ConfigurationTarget.Global);
    }
    // the board's own level (pieces, combos and the situations covered, in the mode it's read in)
    if (m?.type === "summary" && typeof m.level === "number") { boardLevel = { key: H()?.key, level: m.level, xp: m.xp, rank: m.rank }; renderStatus(); render(); }
    if (m?.type === "summary" && pendingPiece) { panel?.webview.postMessage({ type: "select", id: pendingPiece }); pendingPiece = undefined; }
}

// open a piece's file beside the board, at its lines; a folder (a skill) opens its SKILL.md
async function openAt(p: string, lines?: [number, number] | null) {
  let u = vscode.Uri.file(p);
  try {
    if ((await vscode.workspace.fs.stat(u)).type & vscode.FileType.Directory) {
      const skill = vscode.Uri.joinPath(u, "SKILL.md");
      try { await vscode.workspace.fs.stat(skill); u = skill; } catch { return vscode.commands.executeCommand("revealInExplorer", u); }
    }
  } catch { vscode.window.showWarningMessage(`Free Rein: ${p} isn't there any more.`); return; }
  const at = lines ? new vscode.Range(lines[0] - 1, 0, lines[0] - 1, 0) : undefined;
  const ed = await vscode.window.showTextDocument(u, { viewColumn: panel ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active, preview: true, selection: at });
  if (lines) ed.revealRange(new vscode.Range(lines[0] - 1, 0, lines[1] - 1, 0), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

// open the board on one piece (from a marker in a file, a hover, or the Combos view)
async function showPiece(id: string) {
  if (panel) { panel.reveal(); panel.webview.postMessage({ type: "select", id }); return; }
  pendingPiece = id;   // the board says when it's ready (its first summary), then we select
  await openBoard();
}

// --- while developing (F5): the board and sidebar refresh themselves -------------

// every board on screen: the full one in the editor, and the compact one in the sidebar
const post = (m: unknown) => { panel?.webview.postMessage(m); if (view && viewBoard) view.webview.postMessage(m); };
let viewBoard = false;
function boardHtml(w: vscode.Webview, media: vscode.Uri, compact = false) {
  const uri = (f: string) => w.asWebviewUri(vscode.Uri.joinPath(media, f)).toString() + (dev ? `?v=${Date.now()}` : "");
  return page(media.fsPath, { css: uri("board.css"), lucide: uri("lucide.min.js"), board: uri("board.js"), cspSource: w.cspSource }, reading, prefs(), compact);
}

let dev = false;
// the sidebar's module, fresh from disk while developing, so a recompile shows without a reload
function sidebar(): typeof sidebarMod {
  if (!dev) return sidebarMod;
  const p = require.resolve("./sidebar");
  delete require.cache[p];
  return require(p);
}

function devReload() {
  dev = true;
  let t: NodeJS.Timeout | undefined;
  const soon = (f: () => void) => { clearTimeout(t); t = setTimeout(f, 250); };
  const media = vscode.Uri.joinPath(ctx.extensionUri, "media");
  const board = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(media, "board.*"));
  const redrawBoard = () => soon(() => { if (panel && reading) panel.webview.html = boardHtml(panel.webview, media); if (view && viewBoard) { viewBoard = false; render(); } });
  board.onDidChange(redrawBoard); board.onDidCreate(redrawBoard);
  const out = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.joinPath(ctx.extensionUri, "out"), "sidebar.js"));
  out.onDidChange(() => soon(render)); out.onDidCreate(() => soon(render));
  ctx.subscriptions.push(board, out);
  status.tooltip = "Free Rein (development): your harness and the sidebar refresh on save; other code needs ⌘R";
}

const deps = () => ({
  root: () => isProfile(target()) ? undefined : target(), freeReinDir, reload: load,
  names: () => Object.fromEntries((H()?.slots ?? []).flatMap((s: any) => s.types).map((t: any) => [t.id, t.name])),
});

const ddeps = () => ({ ...deps(), target, h: H, drafts, setTarget });

/** Reading a harness only reads files, so Free Rein reads any folder. Changing one, or running its hooks, happens only in a
 * workspace you trust (VS Code's Restricted Mode). */
function trusted(what: string): boolean {
  if (vscode.workspace.isTrusted) return true;
  vscode.window.showWarningMessage(`Free Rein won't ${what} while this folder is in Restricted Mode. Trust the folder first.`, "Manage Workspace Trust")
    .then(c => { if (c) vscode.commands.executeCommand("workbench.trust.manage"); });
  return false;
}

async function simulate(steps: unknown[], runHooks: boolean) {
  const t = target(); if (!t || isProfile(t)) return;
  // running the harness's own hooks runs its code: only in a folder you trust
  if (runHooks && !trusted("run this harness's hooks")) { post({ type: "failed" }); return; }
  callCore(freeReinDir(), "simulate", [t, steps, runtimeFor(t), runHooks])
    .then(result => post({ type: "sim", result }))
    .catch(err => { post({ type: "failed" }); vscode.window.showErrorMessage(`Free Rein couldn't run the dry run: ${err instanceof Error ? err.message : err}`); });
}
