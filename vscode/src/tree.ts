// The Pieces view: sections, the pieces in each with their level, and under
// each piece the files and lines it was found in. Clicking a line opens it.
import * as vscode from "vscode";
import * as path from "path";

export interface Inst { label: string; path?: string | null; lines?: [number, number] | null; scope?: string | null; pkg?: string | null }
export interface Piece { id: string; name: string; what: string; maturity: number; kind: string; firm: string; inst: Inst[]; extra?: Inst[] }
export interface Section { id: string; name: string; job: string; types: Piece[] }

const LEVEL = ["Empty", "Started", "Equipped", "Hardened"];
const ICON = [
  new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("disabledForeground")),
  new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("charts.yellow")),
  new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("charts.green")),
  new vscode.ThemeIcon("verified-filled", new vscode.ThemeColor("charts.purple")),
];
const SCOPE: Record<string, string> = { org: "everyone", user: "you, every repo", project: "this repo", local: "you, this repo" };

type Node =
  | { kind: "section"; s: Section }
  | { kind: "piece"; p: Piece; s: Section }
  | { kind: "inst"; i: Inst; p: Piece; home: boolean };

export class PiecesProvider implements vscode.TreeDataProvider<Node> {
  private changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private sections: Section[] = [];
  private root = "";

  set(sections: Section[], root: string) {
    this.sections = sections; this.root = root; this.changed.fire(undefined);
  }

  getChildren(n?: Node): Node[] {
    if (!n) return this.sections.map(s => ({ kind: "section", s }));
    if (n.kind === "section") return n.s.types.map(p => ({ kind: "piece", p, s: n.s }));
    if (n.kind === "piece") return [
      ...n.p.inst.map(i => ({ kind: "inst" as const, i, p: n.p, home: false })),
      ...(n.p.extra ?? []).map(i => ({ kind: "inst" as const, i, p: n.p, home: true })),
    ];
    return [];
  }

  getTreeItem(n: Node): vscode.TreeItem {
    if (n.kind === "section") {
      const have = n.s.types.filter(p => p.maturity >= 2).length;
      const t = new vscode.TreeItem(n.s.name, vscode.TreeItemCollapsibleState.Collapsed);
      t.description = `${have} of ${n.s.types.length}`;
      t.tooltip = `${n.s.name}: ${n.s.job}`;
      t.iconPath = new vscode.ThemeIcon("symbol-namespace");
      return t;
    }
    if (n.kind === "piece") {
      const kids = n.p.inst.length + (n.p.extra?.length ?? 0);
      const t = new vscode.TreeItem(n.p.name, kids ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
      t.description = `Lv ${n.p.maturity} · ${LEVEL[n.p.maturity]}`;
      t.tooltip = new vscode.MarkdownString(`**${n.p.name}** · level ${n.p.maturity} of 3, ${LEVEL[n.p.maturity].toLowerCase()}\n\n${n.p.what}`);
      t.iconPath = ICON[n.p.maturity] ?? ICON[0];
      t.contextValue = n.p.maturity < 3 ? "piece-up" : "piece";
      return t;
    }
    const i = n.i;
    const t = new vscode.TreeItem(i.label, vscode.TreeItemCollapsibleState.None);
    const rel = i.path ? (i.path.startsWith(this.root + path.sep) ? path.relative(this.root, i.path) : i.path.replace(process.env.HOME ?? "~", "~")) : "";
    t.description = [rel && (i.lines ? `${rel}:${i.lines[0]}` : rel), i.scope && SCOPE[i.scope], i.pkg && `from ${i.pkg}`, n.home && "loads from ~/.claude"]
      .filter(Boolean).join(" · ");
    t.tooltip = i.path ? `${i.path}${i.lines ? ` lines ${i.lines[0]}–${i.lines[1]}` : ""}` : "Found, but Free Rein can't trace it to a file yet";
    t.iconPath = new vscode.ThemeIcon(i.path ? "go-to-file" : "question");
    if (i.path) t.command = { command: "freeRein.openAt", title: "Open", arguments: [i.path, i.lines] };
    return t;
  }
}
