// ---- v31: icons, a hue per section, a level to climb
const ICON={"commands":"SquareSlash","plan-first":"ClipboardList","git-workflow":"GitCommitHorizontal","review-workflow":"GitPullRequest",
 "folder-instructions":"FolderTree","session-start":"Sunrise","compaction":"Shrink","output-style":"PenLine",
 "plugins":"Puzzle","sees-app":"MonitorSmartphone","code-intel":"Braces","connected-accounts":"Mail",
 "model-routing":"Split","modalities":"Layers3","ci-agent":"Workflow","secrets-out":"LockKeyhole","network-limits":"Network","rewind":"History",
 "notifications":"Bell","spend-limits":"Gauge","settings-split":"Users","env-keys":"KeySquare","managed-policy":"Building2",
 "auto-fix":"Sparkles","visual-check":"ScanEye","sign-off":"Stamp","transcripts":"FileClock","status-line":"PanelBottom",
 "cost-tracking":"Coins","codebase-map":"Map","task-list":"ListTodo","session-recall":"MessagesSquare","ontology":"Network",
 "proj-instructions":"BookOpen","personal-instructions":"UserRound","live-injection":"Zap","contracts":"ScrollText","modes":"Layers",
 "skills":"Wrench","mcp":"Plug","web":"Globe","tool-search":"Search","subagents":"Bot","orchestration":"Workflow","autonomous-runs":"Repeat",
 "installer":"Package","setup":"SquareTerminal","pins":"Pin","check-commands":"ListChecks","human-gate":"Hand","hard-gate":"ShieldBan","permissions":"KeyRound",
 "sandbox":"Box","completion-check":"Flag","harness-checker":"ScanSearch","schema":"Brackets","independent-checker":"UserCheck","criteria":"Target","evals":"ChartLine",
 "feedback":"MessageSquareQuote","event-log":"Scroll","receipts":"Receipt","telemetry-export":"RadioTower","knowledge-base":"Library","retrieval":"FileSearch",
 "knowledge-graph":"Network","decisions":"Gavel","session-state":"History","saved-facts":"Brain","progress-log":"NotebookPen"};
const SECCOL={context:"#60A5FA",protocols:"#FB923C",tools:"#2DD4BF",agents:"#A3E635",configuration:"#94A3B8",guardrails:"#818CF8",verification:"#22D3EE",validation:"#F472B6",observability:"#E879F9",memory:"#A78BFA"};
// draw a Lucide icon from its data, so the page works without scanning the DOM; nothing if the library didn't load
function icon(name,size){
  const L=window.lucide, node=L&&L.icons&&L.icons[name]; if(!node) return '';
  const kids=(node[2]||[]).map(([tag,at])=>`<${tag} ${Object.entries(at).map(([k,v])=>`${k}="${v}"`).join(' ')}/>`).join('');
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kids}</svg>`;
}
