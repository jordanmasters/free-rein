// ---- the side panel's navigation: three tabs, and a trail back. The tab also sets how the board reads:
// Overview reads it for level, Trust & friction lights the pieces that decide situations, Layers shows the stack.
let SITQ='', SITST='', SITADD=false, PREVSIT=null;
// where you are, as a trail: the tab, then what you opened from it
function trailRoot(){if(selLayer) return ['Layers','layers'];
  if(selSit||selStake||(sel&&PREVSIT)) return ['Situations','sits'];
  if(sel||selSlot||selSet) return ['Pieces','pieces'];
  if(leftOpen&&topic) return [({layers:'Layers',sits:'Situations',pieces:'Pieces',native:(edOf(MAPTO)||{}).name||'Pieces'})[LIST]||'Situations',LIST];
  return [({layers:'Layers',sits:'Situations',pieces:'Pieces',native:(edOf(MAPTO)||{}).name||'Pieces'})[LIST]||'Situations',LIST]}
function trail(){const TOPN={changes:'What changed',tier:'Level and rank',trust:'Backed trust',found:'Equipped',guards:'Guards that hold',problems:'Weak spots',sets:'Achievements',legend:'How to read it'};
  if(leftOpen&&topic&&!sel&&!selSit&&!selStake&&!(selLayer&&selLayer!=='*')&&!selSlot&&!selSet) return [[TOPN[topic]||topic,null]];
  const [root,rl]=trailRoot(), out=[[root,rl?'tab:'+rl:'tab:'+LIST]];
  const D=ovOK()?ovData().d:null, S=id=>D&&D.situations.find(x=>x.id===id), SN=id=>((D&&D.stakes)||[]).find(x=>x.id===id)||{};
  if(sel){if(PREVSIT&&S(PREVSIT)){const s=S(PREVSIT);out.push([SN(s.stakes).name||'',`stake:${s.stakes}`],[s.what,`sit:${s.id}`])}
    const t=find(sel);if(t){if(!PREVSIT){out.push([t.slot.name,`sec:${t.slot.id}`]);const r=t.row&&(t.slot.rows||[]).find(x=>x.id===t.row);if(r)out.push([r.name,`row:${t.slot.id}/${r.id}`])}out.push([t.name,null])}}
  else if(selSit&&S(selSit)){const s=S(selSit);out.push([SN(s.stakes).name||'',`stake:${s.stakes}`],[s.what,null])}
  else if(selStake)out.push([(SN(selStake).name)||selStake,null]);
  else if(selLayer&&selLayer!=='*')out.push([layerName(selLayer),null]);
  else if(selSlot){const sl=H.slots.find(x=>x.id===selSlot), r=sl&&selRow&&(sl.rows||[]).find(x=>x.id===selRow);sl&&out.push([sl.name,r?`sec:${sl.id}`:null]);r&&out.push([r.name,null])}
  else if(selSet)out.push([setName(H.sets.find(x=>x.name===selSet)||{name:selSet}),null]);
  else if(leftOpen&&topic)out.push([TOPN[topic]||topic,null]);
  return out}
function navHTML(){const tr=trail();
  if(tr.length<2) return '';
  return `<nav class="nv52" aria-label="Where you are">
    ${tr.length>1?`<div class="cr52"><button data-back="1" aria-label="Back">${icon('ChevronLeft',13)}</button>${tr.map(([n,k],i)=>i<tr.length-1?`<button data-crumb="${k||''}" ${k?'':'disabled'}>${esc(n)}</button><i>›</i>`:`<b>${esc(n)}</b>`).join('')}</div>`:''}</nav>`}
function navBack(){if(sel&&PREVSIT){sel=null;selSit=PREVSIT;PREVSIT=null}
  else if(selStake){selStake=null;lightPieces(null)}
  else{sel=null;selSet=null;selSlot=null;leftOpen=false;topic=null;selSit=null;PREVSIT=null;selLayer=null}
  render();sitLit()}
function bindNav(box){bindCalls(box);
  box.querySelectorAll('[data-back]').forEach(b=>b.onclick=navBack);
  box.querySelectorAll('[data-crumb]').forEach(b=>b.onclick=()=>{const k=b.dataset.crumb, [kind,id]=[k.split(':')[0],k.slice(k.indexOf(':')+1)];
    if(kind==='tab'){if(['sits','pieces','layers','native'].includes(id)){LIST=id;try{localStorage.setItem('v44-list',id)}catch(x){}}
      sel=null;selSet=null;selSlot=null;selRow=null;selSit=null;selStake=null;PREVSIT=null;leftOpen=false;topic=null;selLayer=LIST==='layers'?'*':null;lightPieces(null);render()}
    else if(kind==='stake'){PREVSIT=null;openStake(id)}
    else if(kind==='sit'){sel=null;PREVSIT=null;selSit=id;render();sitLit()}
    else if(kind==='sec'){sel=null;PREVSIT=null;selSlot=id;selRow=null;render()}
    else if(kind==='row'){const [sid,rid]=id.split('/');sel=null;PREVSIT=null;selSlot=sid;selRow=rid;render()}});}
// adding a situation of your own: what would happen if the agent did this, here
const STAKEOPTS=()=>((ovData().d||{}).stakes||[]);
function sitAddHTML(){const hosted=typeof HOST!=='undefined'&&!BASE.profile&&!BASE.new;
  if(!hosted) return '';
  if(!SITADD) return '';
  return `<form class="af52" data-sitform="1"><b>What would happen if the agent…</b>
    <span class="r"><select name="tool" aria-label="What it does"><option value="Bash">ran a command</option><option value="Edit">edited a file</option><option value="Read">read a file</option></select>
      <input name="target" placeholder="git push origin main · src/db/schema.sql · .env.production" spellcheck="false" autocomplete="off" required></span>
    <span class="r"><select name="stakes" aria-label="What's at stake"><option value="">Let Free Rein judge the stakes</option>${STAKEOPTS().map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
      <button class="b50 pri" type="submit">Add and read it</button><button class="b50" type="button" data-sitcancel="1">Cancel</button></span>
    <small class="mute">Kept for this harness in this editor, like drafts. Free Rein reads it against the same rules and hooks as the rest.</small></form>`}
function bindSitAdd(root){if(!root||!root.querySelectorAll) return;
  root.querySelectorAll('[data-sitadd]').forEach(b=>b.onclick=()=>{SITADD=true;render();const i=document.querySelector('[data-sitform] input');i&&i.focus()});
  root.querySelectorAll('[data-sitcancel]').forEach(b=>b.onclick=()=>{SITADD=false;render()});
  root.querySelectorAll('[data-sitform]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const tool=f.querySelector('[name=tool]').value, target=f.querySelector('[name=target]').value.trim(), stakes=f.querySelector('[name=stakes]').value;
    if(!target) return; SITADD=false; SITQ=''; PENDING={what:`Reading what would happen: ${target}…`};busy();head();HOST.addSit({tool,target,stakes})});
  root.querySelectorAll('[data-rmsit]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation&&e.stopPropagation();const [tool,...t]=b.dataset.rmsit.split('\u0001');
    PENDING={what:'Removing your situation…'};busy();head();HOST.removeSit({tool,target:t.join('\u0001')})})}
const rmSit=s=>(s.sources||[]).includes('yours')&&typeof HOST!=='undefined'?`<button class="rm52" data-rmsit="${esc(s.tool+'\u0001'+s.target)}" title="Remove your situation" aria-label="Remove">${icon('X',11)}</button>`:'';
// the Trust & friction tab: every situation, searchable, grouped by what's at stake
const sitMatch=s=>{const q=SITQ.trim().toLowerCase(); if(typeof SITF!=='undefined'&&!sitF(s)) return false; if(SITST==='high'&&s.stakes==='everyday') return false; if(SITST&&SITST!=='high'&&s.stakes!==SITST) return false;
  if(OVCELL&&!(s.outcome===OVCELL.o&&((OVCELL.r==='high')===(s.stakes!=='everyday')))) return false;
  return !q||[s.what,s.target,...(s.examples||[])].join(' ').toLowerCase().includes(q)};
const VRANK={exposed:0,babysitting:1,blocked:2,depends:2.5,classifier:3,good:4,held:5,ok:6};
const VCOL={exposed:'#FF8A80',babysitting:'#E58C5A',blocked:'#C9875E',classifier:'#E8B07A',good:'#F2C35B',held:'#B38CF5',ok:'#7FBF95',depends:'#9AA3B5'};
function secSits(slId){const sl=H.slots.find(x=>x.id===slId), P=(ovData().d||{}).pieces||{}, seen={};
  (sl?sl.types:[]).forEach(t=>((P[t.id]||{}).decides||[]).forEach(x=>{seen[x.id]=x.verdict}));
  const vs=Object.values(seen), worst=vs.sort((a,b)=>VRANK[a]-VRANK[b])[0];
  return {n:Object.keys(seen).length,worst}}
