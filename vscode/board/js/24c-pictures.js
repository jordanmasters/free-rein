// ---- The board's other two views. Loops: a library of the loops a harness has, shelf by scope (each action,
// each step, each route, over time), with where one's missing and ones you could add. Flows: one map, every route a line.
// Whatever you pick opens in the side panel, in the one shape every pick shares (24d-pane.js).
// One mark per meaning across both: the who-judges glyph, solid ring = blocks, dashed = advises; gold = you approve.
let LOOPSEL=null, INSTSEL=null, FLOWSEL=null;
const VCOL70={earned:'#7FD6A6','self-declared':'#F2C35B','no-send-back':'#C3A6FF',runaway:'#FF8A80','over-checked':'#8FB6FF',none:'#5C6170'};
const WHO70={shape:'a shape check',command:'a command',model:'a model',person:'a person',agent:'the agent',environment:'its tools'};
// who checks: a glyph each, the same wherever a check shows
const WHOIC={person:['User','you, a person'],model:['BrainCircuit','a model judges'],command:['Terminal','a command decides'],shape:['Brackets','a shape check'],agent:['Bot','the agent itself'],environment:['Wrench','what its tools return']};
const SPEED70={edit:'around each action',task:'around each step',run:'around a route',time:'around the harness'};
const VERDICTN={earned:'earned stop','self-declared':'self-declared','no-send-back':'checks, doesn\'t send back',runaway:'runaway','over-checked':'over-checked',none:'none'};
function whoMark(ck,size){const s=size||22;
  if(!ck) return `<span class="wh72 no" style="--s:${s}px" title="nothing checks it">${icon('CircleDashed',Math.round(s*.6))}</span>`;
  const [ic,t]=WHOIC[ck.who]||WHOIC.agent;
  return `<span class="wh72 ${ck.blocks?'bl':'ad'}" style="--s:${s}px" title="${esc(t)} · ${ck.blocks?'blocks':'advises'}">${icon(ic,Math.round(s*.6))}</span>`}
function whoLegend(){return `<div class="lg70k wl72">Who checks: ${['person','model','command','shape'].map(w=>`<span>${whoMark({who:w,blocks:true},16)} ${esc(WHOIC[w][1])}</span>`).join('')}<span>${whoMark(null,16)} nothing</span> · solid ring blocks, dashed advises</div>`}
const stepName=id=>String(id).replace(/^unit:|^executor:agent:/,'');
const shortPath=p=>String(p).split('/').slice(-2).join('/');

const SCOPEN={action:['Each action','the agent loop: act, see what the tools return, act again'],step:['Each step','how it knows a step is done'],route:['Each route','what repeats a whole route, and what ends it'],harness:['Over time','what turns what it learns into changes']};
const STOPN={evidence:'evidence',approval:'your yes','say-so':'its own word','with the edit':'the edit'};
// loops you could add, per scope: the piece that makes each, if the harness hasn't got one there yet
const LOOPTPL={action:[['auto-fix','Format and lint on each write',{who:'command',blocks:false}],['schema','Shape check on what it writes',{who:'shape',blocks:true}]],
  step:[['completion-check','Done check when it stops',{who:'command',blocks:true}],['independent-checker','A model judges the result',{who:'model',blocks:false}]],
  route:[['autonomous-runs','Repeat a route until it passes, with a cap',{who:'command',blocks:true}]],harness:[['evals','Evals that turn findings into work',{who:'command',blocks:false}]]};
const laneOf=id=>((BASE.loops||{}).loops||[]).find(l=>(l.instances||[]).some(i=>i.id===id));
const instOf=id=>{const l=laneOf(id);return l&&l.instances.find(i=>i.id===id)};
const instTitle=(i,l)=>i.id==='agent'?'The agent loop':i.id==='approve'?'Review before writing':i.id==='self'?`${i.steps.map(stepName).join(', ')}: no loop`:i.id.startsWith('done:')?`Done check · ${i.name}`:i.id.startsWith('judge:')?`Model judge · ${i.name}`:i.id==='guard'?'A hook guards writes':l.scope==='harness'?`Log · ${i.name}`:l.scope==='action'?`Format and lint · ${i.name}`:l.scope==='route'?`Route loop · ${i.name}`:i.name;
// the strip every loop card shares: trigger → who judges → feeds back → stops on
function loopStrip(i){return `<span class="ls73"><span class="s">${esc(i.trigger||'')}</span><b>→</b><span class="s ${i.check?'':'off'}">${whoMark(i.check,14)}${i.check?'':'none'}</span><b>→</b><span class="s ${i.sends_back?'':'off'}">↩ ${i.sends_back?'back':'none'}</span><b>→</b><span class="s">■ ${esc(STOPN[i.stop]||'—')}</span></span>`}
// Loops: a library, shelf by shelf (each scope), with the loops you have, where one's missing, and ones you could add.
// Picking one opens it in the side panel
function loopViewHTML(){const L=BASE.loops; if(!L) return '<p class="mute">No loops read for this harness.</p>';
  const ls=L.loops||[], have=ls.flatMap(l=>l.instances.filter(i=>!i.reads_only)), gaps=have.filter(i=>i.verdict==='self-declared'&&i.id!=='agent'||i.verdict==='runaway');
  const tpls=l=>(LOOPTPL[l.scope]||[]).filter(([p])=>{const t=find(p);return t&&t.stage<2});
  const card=(i,l)=>{const gap=i.verdict==='self-declared'&&i.id!=='agent'||i.verdict==='runaway';
    return `<button class="lc73${gap?' gap':''}${INSTSEL===i.id?' on':''}" data-inst="${esc(i.id)}"><span class="tp"><b>${esc(instTitle(i,l))}</b><i class="vd70" style="--vc:${VCOL70[i.verdict]}">${esc(i.runtime?'the runtime\'s':VERDICTN[i.verdict])}</i></span>${loopStrip(i)}<small>${esc(i.all?'every '+(l.scope==='action'?'action':'step'):i.steps.length?`${i.steps.length} step${i.steps.length>1?'s':''}`:i.place?shortPath(i.place.path):'')}</small></button>`};
  const tcard=([p,title,ck])=>`<button class="lc73 tpl" data-loopfix="${esc(p)}"><span class="tp"><b>+ ${esc(title)}</b></span><span class="ls73"><span class="s off">${whoMark(ck,14)}</span><small>adds ${esc(find(p).name)}</small></span></button>`;
  return `${symBanner()}<section class="lv70"><header class="ph70"><h3>Loops</h3><p>A loop: the agent tries, something outside it judges the result, and that judgment goes back into its context, until it succeeds or a cap ends it.</p></header>
    <p class="says">${have.length} loop${have.length===1?'':'s'} you have${gaps.length?`, ${gaps.length} place${gaps.length>1?'s':''} missing one`:''}. Pick one to see its parts and change them.</p>
    ${ls.map(l=>{const cs=l.instances.filter(i=>!i.reads_only), ro=l.instances.find(i=>i.reads_only), ts=tpls(l);
      return `<div class="sh73"><h4>${esc(SCOPEN[l.scope][0])} <small>${esc(SCOPEN[l.scope][1])}</small></h4><div class="cs73">${cs.map(i=>card(i,l)).join('')}${ts.map(tcard).join('')}</div>${ro?`<p class="mute">${ro.steps.length} step${ro.steps.length>1?'s':''} only read, so they don't need a loop.</p>`:''}</div>`}).join('')}
    ${whoLegend()}</section>`}
// a loop in the side panel: its five stations, what it covers, where it's set
function loopPane(id){const i=instOf(id), l=laneOf(id); if(!i) return '';
  const f=((BASE.loops||{}).findings||[]).find(x=>x.loop===l.id&&x.verdict===i.verdict), mv=(BASE.moves||[]).find(m=>m.sources.includes('loops')&&f&&m.why===f.title);
  const st=(n,label,val,off,extra)=>`<div class="st73"><span class="k">${n} · ${label}</span><span class="v${off?' off':''}">${val}</span>${extra||''}</div>`;
  const opt=w=>`<button class="b50 sm${i.check&&i.check.who===w?' cur':''}" data-loopfix="${{person:'human-gate',model:'independent-checker',command:'completion-check',shape:'schema'}[w]}">${whoMark({who:w,blocks:w!=='model'},12)} ${esc(WHOIC[w][1])}</button>`;
  return paneHTML({crumb:['Loops',SCOPEN[l.scope][0]],mark:whoMark(i.check,30),name:instTitle(i,l),chip:[i.runtime?'the runtime\'s':VERDICTN[i.verdict],VCOL70[i.verdict]],
    now:i.runtime?'Every agent runs this loop: tool output and errors come back after each action. The runtime runs it, so it can\'t be changed here; a formatter or tests after each edit make it judge each change.':i.check?`${WHOIC[i.check.who][1].replace(/^./,c=>c.toUpperCase())} ${i.check.blocks?'decides':'advises'}: ${i.check.what}.`:'Nothing judges it: it decides for itself when it\'s done.',
    move:mv?moveCard(mv):null,
    sections:[{id:'parts',title:'Its parts',count:'',open:true,body:`<div class="sts73">${st(0,'Trigger',esc(i.trigger||'—'))}${st(1,'Try','the agent does the work')}
      ${st(2,'Judge',i.check?`${whoMark(i.check,16)} ${esc(i.check.what)}`:'nothing judges it',!i.check,i.runtime?'':`<span class="op73">${['person','model','command','shape'].map(opt).join('')}</span>`)}
      ${st(3,'Feed back',esc(i.sends_back||'nothing comes back'),!i.sends_back)}${st(4,'Stop',`on ${esc(STOPN[i.stop]||'—')}${i.cap?` · cap: ${esc(i.cap)}`:''}`,i.stop==='say-so')}</div>`},
      {id:'covers',title:'Covers',count:i.all?'everything':String(i.steps.length),open:false,body:i.steps.length?listTop(i.steps.map(s=>`<button class="sc72" data-flowstep="${esc(s)}">${esc(stepName(s))}</button>`),3,'chips'):`<p class="mute">${i.all?'Every one, on every run.':'Whenever the model calls it.'}</p>`},
      ...(i.place?[{id:'where',title:'Where it\'s set',count:shortPath(i.place.path),open:false,body:`<button class="b50" data-open="${esc(i.place.path)}" data-lines="${i.place.line||''}">Open ${esc(shortPath(i.place.path))}</button>`}]:[]),
      ...(i.steps.length?[{id:'showflows',title:'Show in Flows',count:'',open:false,body:`<button class="b50" data-flowstep="${esc(i.steps[0])}">See where it sits</button>`}]:[])]})}

// Flows: one map, every route a line; steps that join come in on a branch, the ones also offered hang below their stop.
// Ways in above, side trips below. Picking a stop dims all but its neighbours; the side panel shows it
function stepChecks(){const t=((BASE.loops||{}).loops||[]).find(l=>l.id==='task'), m={};
  for(const i of (t&&t.instances)||[]) if(!i.reads_only&&i.check) (i.all?((BASE.flows||{}).steps||[]).map(s=>s.id):i.steps).forEach(s=>{(m[s]=m[s]||[]).push(i)});
  return m}
function flowViewHTML(){const F=BASE.flows;
  const head=`${symBanner()}<section class="lv70"><header class="ph70"><h3>Flows</h3><p>Who does what, in what order: the routes work takes across steps and agents, where you approve, what every task passes before it's done.</p></header>`;
  if(!F) return head+`<p class="mute">Products show no routes from outside.</p></section>`;
  if(!F.steps.length) return head+`<p class="says">${esc(F.says)} That's fine for single-agent work.</p></section>`;
  const S=Object.fromEntries(F.steps.map(s=>[s.id,s])), byName=Object.fromEntries(F.steps.map(s=>[s.name,s.id])), CK=stepChecks();
  const COL=['#8FB6FF','#7FD6A6','#C3A6FF','#F2A65B','#6FD3E0'], X0=210, DX=150, pos={}, lines=[]; let y=14;
  F.routes.forEach((r,ri)=>{const c=COL[ri%COL.length], nj=r.joins.reduce((n,j)=>n+j.from.length,0), ly=y+30+nj*24; let bn=0;
    r.stops.forEach((s,k)=>pos[s.step]={x:X0+k*DX,y:ly,c,main:true});
    r.joins.forEach(j=>{const at=pos[j.at]; j.from.forEach(path=>{const row=bn++, names=path.split(' → '); names.forEach((nm,ni)=>{const id=byName[nm]; if(!id||pos[id]) return; pos[id]={x:at.x-50-(names.length-1-ni)*120,y:ly-6-(nj-row)*24,c,branch:j.at}})})});
    const used={}; r.also.forEach(id=>{const nb=r.stops.map(s=>s.step).find(t=>F.handoffs.some(h=>(h.from===t&&h.to===id)||(h.to===t&&h.from===id)))||r.stops[0].step, k=used[nb]=(used[nb]||0)+1; pos[id]={x:pos[nb].x,y:ly+40+k*24,c,spur:nb}});
    lines.push({r,c,ly,top:y}); y=ly+60+Math.max(1,...Object.values(used))*24+24});
  const W=Math.max(400,...Object.values(pos).map(p=>p.x))+170, Hh=y, focus=FLOWSEL&&pos[FLOWSEL]?FLOWSEL:null;
  const near=new Set(focus?[focus,...F.handoffs.filter(h=>h.from===focus).map(h=>h.to),...F.handoffs.filter(h=>h.to===focus).map(h=>h.from)]:[]);
  let svg='';
  for(const L of lines){const st=L.r.stops.map(s=>pos[s.step]); svg+=`<text x="12" y="${L.top+16}" fill="${L.c}" font-size="12" font-weight="600">${esc(L.r.name)}</text><path d="M${st[0].x} ${L.ly} H${st[st.length-1].x}" stroke="${L.c}" stroke-width="5" stroke-linecap="round"${focus?' opacity=".35"':''}/>`}
  for(const p of Object.values(pos)){if(p.branch){const a=pos[p.branch]; svg+=`<path d="M${p.x} ${p.y} C ${p.x+40} ${p.y}, ${a.x-30} ${a.y}, ${a.x} ${a.y}" fill="none" stroke="${p.c}" stroke-width="2.5" opacity="${focus?.25:.7}"/>`}
    if(p.spur){const a=pos[p.spur]; svg+=`<path d="M${a.x} ${a.y} V${p.y}" stroke="${p.c}" stroke-width="1.5" stroke-dasharray="2 3" opacity="${focus?.2:.6}"/>`}}
  // loops across steps: a return arc from the step that judges back to the one it sends to
  for(const h of F.handoffs.filter(h=>h.back&&pos[h.from]&&pos[h.to])){const a=pos[h.from],b=pos[h.to]; svg+=`<path d="M${a.x} ${a.y-10} C ${a.x} ${a.y-50}, ${b.x} ${b.y-50}, ${b.x} ${b.y-10}" fill="none" stroke="#F2C35B" stroke-width="2" marker-end="url(#ar73)"><title>${esc(h.text)}</title></path>`}
  if(focus) for(const h of F.handoffs) if((h.from===focus||h.to===focus)&&pos[h.from]&&pos[h.to]&&!h.back){const a=pos[h.from],b=pos[h.to],mx=a.x+(b.x-a.x)/2;
    svg+=`<path d="M${a.x} ${a.y} C ${mx} ${a.y-30}, ${mx} ${b.y-30}, ${b.x} ${b.y}" fill="none" stroke="#ECEAE4" stroke-width="1.6" marker-end="url(#ar73w)"/>`}
  for(const [id,p] of Object.entries(pos)){const s=S[id]||{name:stepName(id)}, g=s.gate==='you approve', big=p.main, dim=focus&&!near.has(id);
    svg+=`<g class="st73${dim?' dim':''}" data-flowstep="${esc(id)}" tabindex="0"><circle cx="${p.x}" cy="${p.y}" r="${big?8:5.5}" fill="${g?'#F2C35B':'#0F1015'}" stroke="${g?'#F2C35B':p.c}" stroke-width="${big?3:2}"/>${id===focus?`<circle cx="${p.x}" cy="${p.y}" r="13" fill="none" stroke="#ECEAE4" stroke-width="1.5"/>`:''}
      <text x="${p.x}" y="${p.y+(big?24:4)}" dx="${big?0:p.spur?10:-10}" text-anchor="${big?'middle':p.spur?'start':'end'}" fill="${big?'#ECEAE4':'#B9BCC6'}" font-size="${big?12:11}" font-weight="${big?600:400}" class="mn73">${esc(s.name)}</text>
      ${big&&CK[id]?`<foreignObject x="${p.x-9}" y="${p.y+30}" width="18" height="18">${whoMark(CK[id][0].check,18)}</foreignObject>`:''}</g>`}
  const chip=id=>{const s=S[id];return `<button class="sc72${s.gate==='you approve'?' g':''}${FLOWSEL===id?' on':''}" data-flowstep="${esc(id)}">${esc(s.name)}</button>`};
  const band=(ids,label,cls)=>ids.length?`<div class="bd73 ${cls}"><small>${label}</small>${ids.map(chip).join('')}</div>`:'';
  const alone=F.steps.filter(s=>s.role==='alone'||(s.role==='work'&&!s.route&&!pos[s.id])).map(s=>s.id);
  return head+`<p class="says">${esc(F.says)}${F.routes.length?' Pick a stop to see where it leads.':''}</p>
    ${(F.stop_checks||[]).map(c=>`<div class="sk72">${whoMark({who:'command',blocks:true},22)}<span><b>Every task passes ${esc(c.name)}</b> before it's done · ${esc(c.what)}</span></div>`).join('')}
    <div class="mp73">${band(F.steps.filter(s=>s.role==='around').map(s=>s.id),'Ways in','top')}
      ${F.routes.length?`<div class="mv73w"><svg class="mp73s" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="${esc(F.says)}"><defs><marker id="ar73" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#F2C35B"/></marker><marker id="ar73w" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ECEAE4"/></marker></defs>${svg}</svg></div>`:''}
      ${band(F.steps.filter(s=>s.role==='side').map(s=>s.id),'From any stop','bot')}${band(alone,'On their own','bot')}</div>
    <div class="lg70k">a line is a main route · a branch joins it · dotted: also offered there · <span class="gd72"></span> you approve before it writes · <span style="color:#F2C35B">⤺</span> sends work back · ${whoMark({who:'person',blocks:true},14)} who checks it</div></section>`}
// a step in the side panel: what leads to it and what it offers, each with its condition; its loop, its file
function stepPane(id){const F=BASE.flows, s=F&&F.steps.find(x=>x.id===id); if(!s) return '';
  const ins=F.handoffs.filter(h=>h.to===id), outs=F.handoffs.filter(h=>h.from===id), nm=x=>(F.steps.find(y=>y.id===x)||{name:stepName(x)}).name, r=F.routes.find(x=>x.id===s.route);
  const edge=(h,o)=>`<div class="fe73"><button class="sc72" data-flowstep="${esc(o)}">${esc(nm(o))}</button>${h.when?`<small>${esc(h.when)}</small>`:''}</div>`;
  const ck=stepChecks()[id]||[], mv=(BASE.moves||[]).find(m=>m.id==='steps:'+s.name);
  return paneHTML({crumb:['Flows',r?r.name:({side:'Side trips',around:'Ways in',alone:'On their own'})[s.role]||'Steps'],mark:ck.length?whoMark(ck[0].check,30):whoMark(null,30),name:s.name,
    chip:s.gate?[s.gate,'#F2C35B']:[({work:'on a route',side:'a side trip',around:'a way in',alone:'on its own'})[s.role]||'',ck.length?'#7FD6A6':'#8D919D'],
    now:`${s.kind==='agent'?'An agent':'A skill'}${r?` on ${r.name}`:''}. ${ins.length} lead here, it offers ${outs.length}.${ck.length?` It's checked: ${ck.map(i=>instTitle(i,laneOf(i.id)).toLowerCase()).join(', ')}.`:s.writes.length?' It writes, and nothing checks it.':''}`,
    move:mv?moveCard(mv):null,
    sections:[{id:'in',title:'Leads here',count:String(ins.length),open:true,body:ins.length?listTop(ins.map(h=>edge(h,h.from)),3):'<p class="mute">Nothing offers it: you or the model start it.</p>'},
      {id:'out',title:'Offers next',count:String(outs.length),open:true,body:outs.length?listTop(outs.map(h=>edge(h,h.to)),3):'<p class="mute">Offers nothing next: the work ends here.</p>'},
      ...(ck.length?[{id:'loop',title:'Its loop',count:String(ck.length),open:false,body:ck.map(i=>`<button class="b50" data-inst="${esc(i.id)}">${whoMark(i.check,12)} ${esc(instTitle(i,laneOf(i.id)))}</button>`).join(' ')}]:[]),
      ...(s.place?[{id:'file',title:'Its file',count:shortPath(s.place.path),open:false,body:`<button class="b50" data-open="${esc(s.place.path)}" data-lines="${s.place.line||''}">Open it</button> <button class="b50" data-step="${s.kind==='agent'?'subagents':'skills'}">Its piece</button>`}]:[])]})}
function bindBView(P){
  P.querySelectorAll('[data-inst]').forEach(b=>b.onclick=e=>{if(e.target.closest&&e.target.closest('[data-flowstep]')) return; INSTSEL=INSTSEL===b.dataset.inst?null:b.dataset.inst;showInsp();render()});
  P.querySelectorAll('[data-loopfix]').forEach(b=>b.onclick=()=>{INSPHIDE=false;LIST='pieces';selectPiece(b.dataset.loopfix)});
  P.querySelectorAll('[data-open]').forEach(a=>a.onclick=e=>{e.preventDefault&&e.preventDefault();typeof HOST!=='undefined'&&HOST.open(a.dataset.open,a.dataset.lines?[+a.dataset.lines,+a.dataset.lines]:null)});
  bindFlow(P)}
// a step chosen anywhere (the map, a band, a loop's steps) opens it in Flows, and in the side panel
function bindFlow(P){P.querySelectorAll('[data-flowstep]').forEach(b=>b.onclick=e=>{e.stopPropagation&&e.stopPropagation();const id=b.dataset.flowstep||null;FLOWSEL=FLOWSEL===id?null:id;showInsp();if(FLOWSEL&&BVIEW!=='flows') setBView('flows'); else render()});
  P.querySelectorAll('[data-step]').forEach(g=>g.onclick=()=>{INSPHIDE=false;LIST='pieces';selectPiece(g.dataset.step)})}
function showInsp(){sel=null;selSet=null;selSlot=null;selSit=null;selStake=null;topic=null;leftOpen=false;selLayer=null;if(INSPHIDE&&typeof setInsp==='function') setInsp(false)}
// a way in from a problem: pick a symptom, the board switches to its view and outlines the pieces that answer it
let SYMSEL=null;
const symNow=()=>SYMSEL&&(BASE.symptoms||[]).find(s=>s.id===SYMSEL);
const symPieces=()=>{const s=symNow();return s?s.pieces:[]};
function symBanner(){const s=symNow(); if(!s) return '';
  const names=s.pieces.map(id=>(find(id)||{}).name||id);
  return `<div class="sb71">${icon('Stethoscope',13)}<span><b>${esc(s.name)}</b> · answered by ${esc(names.join(', '))}${s.missing.length?` · ${s.missing.length} missing`:''}</span><button class="lk50" data-symclear="1">Clear</button></div>`}
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest&&e.target.closest('[data-sym]'); if(b){const s=(BASE.symptoms||[]).find(x=>x.id===b.dataset.sym); if(!s) return; SYMSEL=s.id; lastSig=null; setBView(s.view); return}
  if(e.target&&e.target.closest&&e.target.closest('[data-symclear]')){SYMSEL=null;lastSig=null;render()}});
