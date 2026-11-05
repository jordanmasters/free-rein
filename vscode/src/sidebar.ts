// The sidebar: a status card for the harness Free Rein is reading (which one, its
// core, where it stands) and the way into Free Rein. The trust check, the trust
// comparison and everything else live in the Free Rein panel.
import { randomBytes } from "crypto";
import { compare, Trust, TrustState } from "./state";

export interface Summary {
  name: string; root: string; uses: string[];
  level: number; xp: number; levelStart: number; nextAt: number;
  rank: string | null; rankTier: string | null;
  next: { name: string; tier: string; needs: string[]; weakSpots: number } | null;
  backed: number; equipped: number; total: number; weak: number; earned: number; achievements: number;
  trust: Trust;
  // the ring: each section and its pieces' maturity (0-3), as on the board's core
  sections: { id: string; name: string; types: { name: string; maturity: number }[] }[];
  palette?: string;
  // an out-of-the-box profile, not a folder: no trust check, nothing to upgrade
  profile?: { kind: string; build: string; checked_on: string } | null;
  // what it is: the runtime it runs on and its build (archetype)
  what?: string;
  // the runtime alone, for the core's small label
  runtimeName?: string;
  // how many layers the harness is made of (runtime, packages, your ~/.claude, your own files)
  layers?: number;
}

// the board's section colours; Warm and Calm mix them the same way the board does
const SECCOL: Record<string, string> = { context: "#60A5FA", protocols: "#FB923C", tools: "#2DD4BF", agents: "#A3E635", configuration: "#94A3B8",
  guardrails: "#818CF8", verification: "#22D3EE", validation: "#F472B6", observability: "#E879F9", memory: "#A78BFA" };
const mix = (a: string, b: string, t: number) => "#" + [1, 3, 5].map(k => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const secCol = (id: string, pal?: string) => { const c = SECCOL[id] ?? "#94A3B8"; return pal === "warm" ? mix(c, "#FF9A5C", .5) : pal === "calm" ? mix(c, "#8A8F9C", .62) : c; };
// sections clockwise from the top left, roughly where they sit around the board's core
const RING_ORDER = ["context", "protocols", "tools", "agents", "guardrails", "observability", "validation", "verification", "configuration", "memory"];
const LEVELS = ["Empty", "Started", "Equipped", "Hardened"];

// the board's core: a segment per piece in three blocks (one per level), a gold XP ring, the level and rank
export function coreSvg(s: Summary): string {
  const cx = 110, cy = 110, R0 = 83, R1 = 101, TAU = 2 * Math.PI;
  const P = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const arc = (ra: number, rb: number, a0: number, a1: number) => `M${P(rb, a0)}A${rb} ${rb} 0 0 1 ${P(rb, a1)}L${P(ra, a1)}A${ra} ${ra} 0 0 0 ${P(ra, a0)}Z`;
  const secs = [...s.sections].sort((a, b) => RING_ORDER.indexOf(a.id) - RING_ORDER.indexOf(b.id));
  const n = Math.max(1, secs.length), half = TAU / n / 2 - .04, bh = (R1 - R0) / 3;
  const ring = secs.map((sec, k) => {
    const mid = -TAU * 0.35 + k * TAU / n, col = secCol(sec.id, s.palette), m = sec.types.length, g = .016, w = (2 * half - g * (m - 1)) / Math.max(1, m);
    return `<g>${sec.types.map((t, q) => {
      const b0 = mid - half + q * (w + g), b1 = b0 + w;
      const base = `<path d="${arc(R0, R1, b0, b1)}" fill="#14161B" stroke="${t.maturity ? col : "#33363F"}" stroke-opacity="${t.maturity ? .55 : 1}" stroke-width=".8"/>`;
      const fill = [1, 2, 3].map(l => t.maturity >= l ? `<path d="${arc(R0 + (l - 1) * bh + .7, R0 + l * bh - .7, b0 + .004, b1 - .004)}" fill="${col}" opacity="${t.maturity === 3 ? 1 : l === t.maturity ? .95 : .8}"${t.maturity === 3 ? ' class="hard"' : ""}/>` : "").join("");
      return `<g class="seg" data-sec="${esc(sec.name)}" data-piece="${esc(t.name)}" data-stage="${LEVELS[t.maturity]}" data-col="${col}">${base}${fill}</g>`;
    }).join("")}</g>`;
  }).join("");
  const span = Math.max(1, s.nextAt - s.levelStart), fr = Math.min(1, Math.max(0, (s.xp - s.levelStart) / span)), r = 68, c = TAU * r;
  return `<svg viewBox="0 0 220 220" class="reactor" role="img" aria-label="Level ${s.level}, ${esc(s.rank ?? "unranked")}, ${s.xp} XP">
    <defs><radialGradient id="disc" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#25221A"/><stop offset=".75" stop-color="#121216"/><stop offset="1" stop-color="#0B0C0F"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="106" fill="none" stroke="rgba(242,195,91,.22)" stroke-width="1" class="halo"/>
    ${ring}
    <circle cx="${cx}" cy="${cy}" r="78" fill="url(#disc)" stroke="rgba(242,195,91,.4)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#24262D" stroke-width="5"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F2C35B" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c * fr).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" class="xp"/>
    ${s.runtimeName ? `<text x="${cx}" y="${cy - 46}" text-anchor="middle" class="t-w">${esc(s.runtimeName.length > 26 ? s.runtimeName.slice(0, 25) + "…" : s.runtimeName)}</text>` : ""}
    <text x="${cx}" y="${cy - 34}" text-anchor="middle" class="t-l">LEVEL</text>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" class="t-n">${s.level}</text>
    <text x="${cx}" y="${cy + 24}" text-anchor="middle" class="t-r">${esc(s.rank ?? "Unranked")}</text>
    <text x="${cx}" y="${cy + 49}" text-anchor="middle" class="t-x">${s.xp} XP</text>
  </svg>`;
}

const esc = (t: unknown) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function sidebarHtml(cspSource: string, s: Summary | null, trust: TrustState, error?: string): string {
  const nonce = randomBytes(16).toString("base64");
  const body = error ? errorView(error) : !s ? `<p class="dim">Reading the harness…</p>` : card(s, trust);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'">
<style>${CSS}</style></head><body>
${s ? `<button class="who" data-cmd="pick" title="Choose another harness"><b>${esc(s.name)}</b>${s.uses.length ? `<small>uses ${esc(s.uses.join(", "))}</small>` : ""}<span class="chev">▾</span></button>` : ""}
${body}
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
document.querySelectorAll('[data-cmd]').forEach(b=>b.addEventListener('click',()=>vscode.postMessage({type:b.dataset.cmd,arg:b.dataset.arg})));
const info=document.getElementById('info');
document.querySelectorAll('.seg').forEach(g=>{g.addEventListener('mouseenter',()=>{if(!info)return;g.classList.add('hov');
    info.innerHTML='<i style="background:'+g.dataset.col+'"></i><span class="sc">'+g.dataset.sec+'</span> · <b>'+g.dataset.piece+'</b> · '+g.dataset.stage;info.classList.add('on')});
  g.addEventListener('mouseleave',()=>{if(!info)return;g.classList.remove('hov');info.textContent=info.dataset.rest;info.classList.remove('on')})});
</script></body></html>`;
}

function errorView(msg: string) {
  return `<div class="err"><b>Free Rein couldn't read this harness</b><p>${esc(msg)}</p>
    <button class="primary" data-cmd="refresh">Try again</button> <button class="link" data-cmd="settings">Settings</button></div>`;
}

// a status card: the core, one line of where it stands, and the way into Free Rein. Everything else is on the board.
function card(s: Summary, trust: TrustState) {
  // no numbers before the trust check, so your answers aren't anchored by them
  if (!trust && !s.profile) return `<h2>Before you look: how much do you trust it?</h2>
    <p class="dim">Free Rein asks five quick questions before it shows any numbers for this harness, so your answers aren't anchored by them.</p>
    <div class="row"><button class="primary grow" data-cmd="open">Answer the trust check</button></div>`;
  const ahead = trust && "answers" in trust ? compare(s.trust, trust.answers).ahead : 0;
  const nx = s.next;
  // one line that says what you're pointing at: a piece when you hover the ring, else what it runs on
  const rest = esc(s.what || s.runtimeName || "");
  const stat = (k: string, v: string, sub = "", tone = "") => `<div class="st ${tone}"><span>${k}</span><b>${v}${sub ? `<small>${sub}</small>` : ""}</b></div>`;
  return `<button class="core" data-cmd="open" title="Open Free Rein">${coreSvg(s)}</button>
    <p class="info" id="info" data-rest="${rest}">${rest}</p>
    <div class="stats">
      ${stat("Layers", String(s.layers ?? "?"))}
      ${stat("Equipped", String(s.equipped), `/${s.total}`)}
      ${stat("Backed", `${s.backed}%`)}
      ${stat("Next rank", nx ? esc(nx.name) : "top", nx ? (nx.needs.length ? `${nx.needs.length} to go` : "ready") : "", "gold")}
    </div>
    ${ahead ? `<p class="note warn">You trust it beyond the evidence in ${ahead} of ${s.trust.categories.length} kinds of work.</p>` : ""}`;
}

const CSS = `
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);padding:8px 12px 16px;margin:0}
h2{font-size:13px;margin:12px 0 4px;text-wrap:balance}h3{font-size:12px;margin:16px 0 4px;display:flex;align-items:baseline;gap:6px}
p{margin:4px 0}.dim{color:var(--vscode-descriptionForeground)}.small{font-size:11px}.gold{color:var(--vscode-charts-yellow)}
.bad{color:var(--vscode-errorForeground)}.warn{color:var(--vscode-editorWarning-foreground)}.ok{color:var(--vscode-charts-green)}
button{font:inherit;cursor:pointer}
.who{display:flex;align-items:center;gap:6px;width:100%;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border,transparent);border-radius:4px;padding:5px 8px;text-align:left}
.who b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.who small{color:var(--vscode-descriptionForeground)}.who .chev{margin-left:auto}
.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;border-radius:3px;padding:5px 12px}
.primary:hover{background:var(--vscode-button-hoverBackground)}.primary:disabled{opacity:.45;cursor:default}
.link{background:none;border:0;color:var(--vscode-textLink-foreground);padding:0;font-size:11px}
.icon{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:0;border-radius:3px;width:28px;height:26px}
.row{display:flex;gap:6px;align-items:center;margin:10px 0}
.q{margin:10px 0}.scale{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.scale button{background:none;border:1px solid var(--vscode-input-border,var(--vscode-widget-border,#555));color:var(--vscode-descriptionForeground);border-radius:3px;padding:2px 7px;font-size:11px}
.scale button[aria-checked="true"]{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
.core{display:block;width:100%;max-width:240px;margin:10px auto 2px;padding:0;background:none;border:0;cursor:pointer}
.reactor{width:100%;height:auto;display:block;filter:drop-shadow(0 0 18px rgba(242,195,91,.18));transition:transform .2s,filter .2s}
.core:hover .reactor{transform:scale(1.02);filter:drop-shadow(0 0 22px rgba(242,195,91,.3))}
.reactor .hard{filter:drop-shadow(0 0 3px rgba(255,255,255,.35))}.reactor .xp{filter:drop-shadow(0 0 4px rgba(242,195,91,.7))}
.reactor text{font-family:var(--vscode-font-family)}
.t-l{font-size:9px;letter-spacing:2.6px;fill:#A7AAB6;font-family:var(--vscode-editor-font-family,monospace)!important}
.t-n{font-size:46px;font-weight:800;fill:#F2C35B;filter:drop-shadow(0 0 10px rgba(242,195,91,.45))}
.t-w{font-size:7.5px;fill:#C9CBD3;letter-spacing:.4px}
.t-r{font-size:13.5px;font-weight:700;fill:#ECEAE4}.t-t{font-size:8.5px;fill:#8D919D}
.t-x{font-size:9.5px;fill:#C9CBD3;font-family:var(--vscode-editor-font-family,monospace)!important}
.rank{text-align:center}.center{text-align:center}
.stand{text-align:center;margin:6px 0 2px}.note{font-size:11.5px;margin:8px 0;padding:6px 8px;border-radius:4px;background:var(--vscode-textBlockQuote-background,rgba(127,127,127,.1))}
.grow{flex:1}
.info{text-align:center;min-height:18px;margin:6px 0 10px;font-size:12px;color:var(--vscode-descriptionForeground);display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap}
.info.on{color:var(--vscode-foreground)}.info i{display:inline-block;width:8px;height:8px;border-radius:999px}.info .sc{color:var(--vscode-descriptionForeground)}
.seg{cursor:default}.seg.hov path{filter:brightness(1.5)}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.st{border:1px solid var(--vscode-widget-border,#444);border-radius:5px;padding:6px 8px;display:flex;flex-direction:column;gap:2px}
.st span{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--vscode-descriptionForeground)}
.st b{font-size:14px;font-variant-numeric:tabular-nums}.st b small{font-size:11px;font-weight:400;color:var(--vscode-descriptionForeground);margin-left:3px}
.st.gold b{color:var(--vscode-charts-yellow)}
.meters{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}
.m{border:1px solid var(--vscode-widget-border,#444);border-radius:4px;padding:5px 7px;display:grid;grid-template-columns:1fr auto;gap:3px 6px;align-items:baseline}
.m span{font-size:11px;color:var(--vscode-descriptionForeground)}.m b{font-variant-numeric:tabular-nums}
.m i{grid-column:1/3;height:3px;background:var(--vscode-widget-border,#444);border-radius:2px;overflow:hidden}.m u{display:block;height:100%;background:var(--vscode-foreground);opacity:.7}
.m.gold b{color:var(--vscode-charts-yellow)}.m.gold u{background:var(--vscode-charts-yellow);opacity:1}.m.bad b{color:var(--vscode-errorForeground)}.m.bad u{background:var(--vscode-errorForeground)}
.tc{margin:8px 0}.tch{display:flex;justify-content:space-between;gap:6px;font-size:11px}.tch span{text-align:right}
.bars{height:4px;background:var(--vscode-widget-border,#444);border-radius:2px;margin-top:3px;overflow:hidden}.bars i{display:block;height:100%}
i.you{background:var(--vscode-charts-blue)}i.ev{background:var(--vscode-charts-yellow)}
.legend{display:flex;gap:12px;font-size:10.5px;color:var(--vscode-descriptionForeground)}.legend i{display:inline-block;width:10px;height:4px;margin-right:4px;vertical-align:middle}
.err{border:1px solid var(--vscode-inputValidation-errorBorder,#a33);border-radius:4px;padding:8px;margin-top:10px}
`;
