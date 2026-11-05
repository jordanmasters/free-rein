/* ---------------- 34. v44: animated show and hide; the core on its own ---------------- */
(()=>{
const D=V13DATA;
const $=id=>document.getElementById(id);
const esc=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
// frameworks with a Free Rein plugin mark what they supply in their own colour; Free Rein's own skills in pink
const PLUGINS=((((window.FREE_REIN_DATA||{}).harnesses||[{}])[0]||{}).plugins)||{};
const PKG={"Free Rein":"var(--a-freerein)",...Object.fromEntries(Object.entries(PLUGINS).map(([id,p])=>[id,p.colour||"var(--a-other)"]))}, pkgCol=p=>p?PKG[p]||"var(--a-other)":"var(--hand)";
const pkgKey=p=>p?(PKG[p]?"pk-"+String(p).replace(/[^A-Za-z0-9_-]/g,"_"):"a-other"):"hand";
const CORES=Object.assign({claude:"Claude Code",codex:"Codex"},((window.FREE_REIN_DATA||{}).harnesses||[{}])[0].cores||{});
const W={asks:1,checks:2,blocks:3};
const TIER_MEANS={dotfile:"It knows your rules. Nothing stops a mistake, and nobody reviews what it changes.",
  guided:"It follows a way of working, keeps a knowledge base, and asks you before changing it. You are the safety net.",
  gated:"Some mistakes are refused without you, and there is a record of what happened. Routine work can run while you look away.",
  governed:"Done is defined and checked, quality is measured, and every session leaves a receipt. The closest to working on its own."};
let BASE=D.harnesses[0], H=null, core="claude", mode="all", unseen=true, view="ring", zoom=null, sel=null, hov=null;
const pkgOn={"Free Rein":true,...Object.fromEntries(Object.keys(PLUGINS).map(id=>[id,true]))}, plan=[];
const modesOf=B=>[...new Set(B.slots.flatMap(s=>s.types.flatMap(t=>t.inst.flatMap(x=>x.ctx||["base"]))))].filter(x=>x!=="base").sort();

