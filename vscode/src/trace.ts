// Tracing in the editor: above each piece a marker naming it, a dot in the
// gutter in its section's colour, and a hover that explains it. Plus the
// Combos view: each achievement and weak spot, its pieces, and their lines.
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { buildIndex, at, hoverMarkdown, combos, ComboRow, Entry, LEVELS } from "./trace-index";

const SECCOL: Record<string, string> = { context: "#60A5FA", protocols: "#FB923C", tools: "#2DD4BF", agents: "#A3E635", configuration: "#94A3B8",
  guardrails: "#818CF8", verification: "#22D3EE", validation: "#F472B6", observability: "#E879F9", memory: "#A78BFA" };

export class Trace implements vscode.CodeLensProvider, vscode.HoverProvider {
  private index = new Map<string, Entry[]>();
  private changed = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changed.event;
  private decos = new Map<string, vscode.TextEditorDecorationType>();

  constructor(private storage: vscode.Uri) {}

  set(h: any | undefined) {
    const count = (p: string) => { try { return fs.readFileSync(p, "utf8").split("\n").length; } catch { return null; } };
    this.index = h ? buildIndex(h, count) : new Map();
    this.changed.fire();
    vscode.window.visibleTextEditors.forEach(e => this.decorate(e));
  }

  private entries(doc: vscode.TextDocument) {
    return this.index.get(doc.uri.fsPath) ?? this.index.get(fs.existsSync(doc.uri.fsPath) ? fs.realpathSync(doc.uri.fsPath) : "") ?? [];
  }

  enabled() { return vscode.workspace.getConfiguration("freeRein").get<boolean>("showInFiles", true); }

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    if (!this.enabled()) return [];
    // one marker per line, naming every piece that starts there
    const byLine = new Map<number, Entry[]>();
    for (const e of this.entries(doc)) {
      const l = Math.max(0, Math.min(doc.lineCount - 1, (e.lines?.[0] ?? 1) - 1));
      byLine.set(l, [...(byLine.get(l) ?? []), e]);
    }
    return [...byLine].flatMap(([l, es]) => es.map(e => new vscode.CodeLens(new vscode.Range(l, 0, l, 0), {
      title: `◆ ${e.name} · ${e.sectionName} · Lv ${e.maturity} ${LEVELS[e.maturity]}${e.combos.some(c => c.role === "cause" && c.status === "active") ? " · ⚠ weak spot" : ""}`,
      tooltip: `${e.what} Click to open it in your harness.`,
      command: "freeRein.showPiece", arguments: [e.piece],
    })));
  }

  provideHover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
    if (!this.enabled()) return;
    const es = at(this.entries(doc), pos.line + 1);
    if (!es.length) return;
    const arg = encodeURIComponent(JSON.stringify([es[0].piece]));
    const md = new vscode.MarkdownString(hoverMarkdown(es) + `\n\n[Open it in your harness](command:freeRein.showPiece?${arg})` +
      (es[0].maturity < 3 ? ` · [Upgrade it…](command:freeRein.upgrade?${arg})` : ""));
    md.isTrusted = { enabledCommands: ["freeRein.showPiece", "freeRein.upgrade"] };
    return new vscode.Hover(md);
  }

  // a dot in the gutter at the first line of each piece, in its section's colour
  decorate(ed: vscode.TextEditor) {
    const es = this.enabled() ? this.entries(ed.document) : [];
    const bySec = new Map<string, vscode.Range[]>();
    for (const e of es) {
      const l = Math.max(0, (e.lines?.[0] ?? 1) - 1);
      bySec.set(e.section, [...(bySec.get(e.section) ?? []), new vscode.Range(l, 0, l, 0)]);
    }
    for (const [sec, type] of this.decos) if (!bySec.has(sec)) ed.setDecorations(type, []);
    for (const [sec, ranges] of bySec) ed.setDecorations(this.deco(sec), ranges);
  }

  private deco(sec: string) {
    let d = this.decos.get(sec);
    if (!d) {
      const file = vscode.Uri.joinPath(this.storage, `dot-${sec}.svg`);
      fs.mkdirSync(this.storage.fsPath, { recursive: true });
      fs.writeFileSync(file.fsPath, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="4" fill="${SECCOL[sec] ?? "#94A3B8"}"/></svg>`);
      d = vscode.window.createTextEditorDecorationType({ gutterIconPath: file, gutterIconSize: "contain", overviewRulerColor: SECCOL[sec], overviewRulerLane: vscode.OverviewRulerLane.Left });
      this.decos.set(sec, d);
    }
    return d;
  }

  dispose() { this.decos.forEach(d => d.dispose()); }
}

// --- the Combos view: what causes what --------------------------------------

type CNode = { kind: "group"; label: string; rows: ComboRow[] } | { kind: "combo"; c: ComboRow }
  | { kind: "piece"; p: ComboRow["pieces"][number]; c: ComboRow } | { kind: "line"; f: ComboRow["pieces"][number]["found"][number] }
  | { kind: "would"; text: string };

export class CombosProvider implements vscode.TreeDataProvider<CNode> {
  private ev = new vscode.EventEmitter<CNode | undefined>();
  readonly onDidChangeTreeData = this.ev.event;
  private rows: ComboRow[] = [];
  private root = "";
  set(h: any | undefined, root: string) { this.rows = h ? combos(h) : []; this.root = root; this.ev.fire(undefined); }

  getChildren(n?: CNode): CNode[] {
    if (!n) {
      const ws = this.rows.filter(r => r.kind === "curse"), ach = this.rows.filter(r => r.kind === "synergy");
      return [{ kind: "group", label: "Weak spots", rows: ws }, { kind: "group", label: "Achievements", rows: ach }];
    }
    if (n.kind === "group") return n.rows.map(c => ({ kind: "combo", c }));
    if (n.kind === "combo") return n.c.pieces.map(p => ({ kind: "piece", p, c: n.c }));
    if (n.kind === "piece") {
      if (n.p.found.length) return n.p.found.map(f => ({ kind: "line", f }));
      return n.p.change ? [{ kind: "would", text: `Adding it: ${n.p.change.does} Touches ${n.p.change.files.join(", ")}.` }] : [];
    }
    return [];
  }

  getTreeItem(n: CNode): vscode.TreeItem {
    const C = vscode.TreeItemCollapsibleState;
    if (n.kind === "group") {
      const on = n.rows.filter(r => r.status === "active").length;
      const t = new vscode.TreeItem(n.label, C.Expanded);
      t.description = n.label === "Weak spots" ? `${on} open` : `${on} of ${n.rows.length} earned`;
      t.iconPath = new vscode.ThemeIcon(n.label === "Weak spots" ? "warning" : "star-full", new vscode.ThemeColor(n.label === "Weak spots" ? "errorForeground" : "charts.yellow"));
      return t;
    }
    if (n.kind === "combo") {
      const c = n.c, ws = c.kind === "curse";
      const t = new vscode.TreeItem(c.name, ws && c.status === "active" ? C.Expanded : C.Collapsed);
      const have = c.pieces.filter(p => p.role === "part" && p.have).length, need = c.pieces.filter(p => p.role === "part").length;
      t.description = ws ? (c.status === "active" ? "open" : "cleared") : c.status === "active" ? "earned" : `${have}/${need} parts`;
      t.tooltip = new vscode.MarkdownString(`**${c.name}** · ${ws ? "weak spot" : "achievement"}\n\n${c.effect}`);
      t.iconPath = ws ? new vscode.ThemeIcon(c.status === "active" ? "error" : "pass", new vscode.ThemeColor(c.status === "active" ? "errorForeground" : "charts.green"))
        : new vscode.ThemeIcon(c.status === "active" ? "star-full" : have ? "star-half" : "star-empty", new vscode.ThemeColor("charts.yellow"));
      return t;
    }
    if (n.kind === "piece") {
      const p = n.p;
      const t = new vscode.TreeItem(p.name, p.found.length || p.change ? C.Collapsed : C.None);
      t.description = p.role === "cause" ? (p.have ? "causes it" : "not present")
        : p.role === "fix" ? (p.have ? "✓ fixes it" : p.started ? "started · would fix it once equipped" : "would fix it")
        : p.have ? "✓ have it" : p.started ? "started" : "missing";
      t.iconPath = new vscode.ThemeIcon(p.have ? "pass-filled" : "circle-outline", p.have ? new vscode.ThemeColor(p.role === "cause" ? "errorForeground" : "charts.green") : undefined);
      t.command = { command: "freeRein.showPiece", title: "Show in your harness", arguments: [p.id] };
      if (!p.have && p.role !== "cause") t.contextValue = "piece-up";
      return t;
    }
    if (n.kind === "would") {
      const t = new vscode.TreeItem(n.text, C.None);
      t.iconPath = new vscode.ThemeIcon("lightbulb");
      t.tooltip = n.text;
      return t;
    }
    const f = n.f;
    const t = new vscode.TreeItem(f.label, C.None);
    const rel = f.path ? (f.path.startsWith(this.root + path.sep) ? path.relative(this.root, f.path) : f.path.replace(process.env.HOME ?? "~", "~")) : "";
    t.description = rel ? (f.lines ? `${rel}:${f.lines[0]}` : rel) : "not traced to a file yet";
    t.iconPath = new vscode.ThemeIcon(f.path ? "go-to-file" : "question");
    if (f.path) t.command = { command: "freeRein.openAt", title: "Open", arguments: [f.path, f.lines] };
    return t;
  }
}
