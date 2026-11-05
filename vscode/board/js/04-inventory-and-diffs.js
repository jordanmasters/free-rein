// ---- the summary strip: the top-level facts, each explained in a sentence
function light(){$('v44inv').querySelectorAll('[data-t]').forEach(el=>{const on=hiSet&&hiSet.includes(el.dataset.t);el.classList.toggle('lit',!!on);el.classList.toggle('dim',!!hiSet&&!on)})}
const supp=t=>{const all=[...t.inst,...(t.extra||[])];if(!all.length)return null;const c={};all.forEach(x=>c[x.pkg||'hand']=(c[x.pkg||'hand']||0)+1);return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]};
const SUPCOL={hand:"var(--hand)",...PKG};

let lastSig=null, fit=true, selRow=null;
// the Add flow, per piece: the plan the host measured (files before and after, effect, request), and what was written
const PLANS={}, WROTE={};
function lineDiff(a,b){const A=(a||'').split('\n'), B=(b||'').split('\n'); let i=0; while(i<A.length&&i<B.length&&A[i]===B[i]) i++;
  let j=0; while(j<A.length-i&&j<B.length-i&&A[A.length-1-j]===B[B.length-1-j]) j++;
  const ctx=A.slice(Math.max(0,i-2),i).map(x=>[' ',x]), rm=A.slice(i,A.length-j).map(x=>['-',x]), ad=B.slice(i,B.length-j).map(x=>['+',x]), tail=A.slice(A.length-j,A.length-j+2).map(x=>[' ',x]);
  return [...ctx,...rm,...ad,...tail]}
function fileDiff76(e){const L=e.before==null?(e.after||'').split('\n').map(x=>['+',x]):lineDiff(e.before,e.after), show=L.slice(0,40);
  return `<div class="df76"><div class="fh">${icon(e.before==null?'FilePlus':'FilePen',12)}<b>${esc(e.rel)}</b><small>${e.before==null?'new file':'changed'} · ${esc(e.note||'')}</small></div>
    <pre>${show.map(([k,x])=>`<span class="${k==='+'?'a':k==='-'?'r':'c'}">${k} ${esc(x)||' '}</span>`).join('')}${L.length>40?`<span class="c">… ${L.length-40} more lines</span>`:''}</pre></div>`}
function effectHTML(e){if(!e) return ''; const bits=[`${e.xp>=0?'+':''}${e.xp} XP`,e.level.to!==e.level.from?`level ${e.level.from} → ${e.level.to}`:'',e.piece&&e.piece.to!==e.piece.from?`${MAT[e.piece.from]} → ${MAT[e.piece.to]}`:'',
  ...(e.earned||[]).map(x=>'earns '+x),...(e.cleared||[]).map(x=>'clears '+x),...Object.entries(e.others||{}).map(([k,v])=>`also ${esc((find(k)||{}).name||k)} → ${MAT[v.to]}`),...(e.opened||[]).map(x=>'⚠ opens '+x),...(e.lost||[]).map(x=>'⚠ loses '+x)].filter(Boolean);
  return `<p class="ef76">${icon('Gauge',12)} Measured on a copy: ${bits.map(esc).join(' · ')}</p>`}
// a researched way to add it: what it is, what it takes (commands as code you can copy), where it runs, its page
const WAYK={tool:['Package','A tool to install'],service:['Cloud','A service to connect'],setting:['Settings2','A Claude Code setting'],build:['Hammer','Build it yourself']};
function wayHTML(w,i,id){const k=WAYK[w.kind]||WAYK.tool, cmds=[...String(w.takes||'').matchAll(/`([^`]+)`/g)].map(x=>x[1]);
  const text=esc(w.takes||'').replace(/`([^`]+)`/g,'<code>$1</code>'), srcs=String(w.source||'').split(/\s*;\s*/).filter(Boolean);
  return `<div class="op76 way"><div class="h"><b>${icon(k[0],13)} ${esc(w.name)}</b><small>${esc(k[1])}${w.runs?` · ${esc({local:'runs on this machine',cloud:'runs in the cloud',either:'local or cloud'}[w.runs]||w.runs)}`:''}</small></div>
    <p class="tk76">${text}</p>
    <div class="ac76">${cmds.length?`<button class="b50" data-copyw76="${esc(id)}:${i}">${icon('Copy',13)} Copy ${cmds.length===1?'the command':'the commands'}</button>`:''}${srcs.map(u=>`<a class="lk50" href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//,'').replace(/\/$/,'').split('/').slice(0,3).join('/'))} ↗</a>`).join('')}</div></div>`}
function addFlow(t,m,tmpl,hosted){if(!hosted) return '';
  const P=PLANS[t.id], W=WROTE[t.id], verb=m>=2?'Harden it':'Add it', vsc=typeof acquireVsCodeApi==='function'&&!window.FREE_REIN_WEB;
  if(!W&&m>=3) return '';
  if(W) return `<div class="ad76 done"><p>${icon('CircleCheck',14)} Written: ${W.map(esc).join(', ')}. Free Rein is reading it again.</p><button class="b50" data-undo76="${t.id}">${icon('Undo2',13)} Undo</button></div>`;
  const opts=[], spots=H.sets.filter(x=>x.kind==='curse'&&x.status==='active'&&(x.ids.includes(t.id)||x.lifts.includes(t.id)));
  if(m>=1) spots.forEach(x=>opts.push(`<div class="op76 spot"><div class="h"><b>${icon('TriangleAlert',13)} A weak spot here: ${esc(x.name)}</b><small>${esc(x.effect||'')}</small></div>
    ${x.lifts.length?`<div class="ac76">${x.lifts.filter(id=>id!==t.id).map(id=>`<button class="b50" data-go="${id}">${icon('ArrowRight',13)} ${esc((find(id)||{}).name||id)}</button>`).join('')}</div>`:''}${x.lifts_text?`<p class="tk76">${esc(x.lifts_text)}</p>`:''}</div>`));
  if(tmpl) opts.push(`<div class="op76 pri"><div class="h"><b>${icon('Wand2',13)} Free Rein writes it</b><small>${esc(t.change&&t.change.does||'A ready-made change for this repo.')}</small></div>
    ${P&&!P.error?`${effectHTML(P.effect)}${P.edits.map(fileDiff76).join('')}${P.verified?'':`<p class="nt75">${icon('TriangleAlert',12)} After this, Free Rein still doesn't read it as in place.</p>`}
      <div class="ac76"><button class="b50 pri" data-write76="${t.id}">${icon('Check',13)} Write ${P.edits.length} file${P.edits.length===1?'':'s'}</button><button class="b50" data-planx76="${t.id}">Not now</button></div>
      <small class="mute">${vsc?'Written as one edit: Undo puts every file back.':'Undo is offered right after; git keeps the history too.'}</small>`
    :P&&P.error?`<p class="nt75">${icon('TriangleAlert',12)} ${esc(P.error)}</p>`:P===undefined||P===null?`<div class="ac76"><button class="b50 pri" data-plan76="${t.id}">${icon('Eye',13)} See what it writes</button><small class="mute">Shows each file and measures the effect. Nothing is written.</small></div>`:''}</div>`);
  (t.ways||[]).forEach((w,i)=>opts.push(wayHTML(w,i,t.id)));
  opts.push(`<div class="op76${tmpl||(t.ways||[]).length||spots.length?'':' pri'}"><div class="h"><b>${icon('Bot',13)} ${m>=1?'Have Claude Code do it':'Have Claude Code build it'}</b><small>${m>=1?'Free Rein writes a request from where this piece stands now: what\'s there, what the next level needs, its weak spots. Claude Code shows you its plan before changing anything.':tmpl||(t.ways||[]).length?'For a version made for this repo instead.':'Free Rein has no ready-made change for this, so Claude Code makes it from a request Free Rein writes. It shows you its plan before changing anything.'}</small></div>
    ${P&&P.request?`<details class="rq76"><summary>The request</summary><pre>${esc(P.request)}</pre></details><div class="ac76">${vsc?`<button class="b50${tmpl?'':' pri'}" data-build76="${t.id}">${icon('SquareTerminal',13)} Send to Claude Code</button>`:''}<button class="b50" data-copy76="${t.id}">${icon('Copy',13)} Copy request</button></div>`
      :`<div class="ac76"><button class="b50" data-plan76="${t.id}">${icon('Eye',13)} See the request</button></div>`}</div>`);
  const hard=m===2&&!tmpl&&!(H.guards||[]).some(g=>g.cap===t.id);
  return `<div class="ad76"><h5>${m>=2?'Make it stronger':verb}</h5>${hard?`<p class="mute">Free Rein doesn't define what hardens ${esc(t.name)} yet, so the steps here are about its weak spots and how it's used.</p>`:opts.length>1?`<p class="mute">${opts.length} ways. Pick the one that fits.</p>`:''}${opts.join('')}</div>`}
function rowLit(inv){const sl=selSlot&&!sel&&selRow&&H.slots.find(x=>x.id===selSlot), ids=sl?sl.types.filter(t=>t.row===selRow).map(t=>t.id):null;
  inv.querySelectorAll('[data-t]').forEach(el=>el.classList.toggle('rowsel75',!!ids&&el.closest('[data-bag]')?.dataset.bag===selSlot&&!ids.includes(el.dataset.t)));
  inv.querySelectorAll('.rl75[data-row]').forEach(l=>l.classList.toggle('on',!!ids&&l.dataset.slot===selSlot&&l.dataset.row===selRow))}   // selRow: one group (row) of the selected section
function drawInventory(){
  const inv=$('v44inv');
  const spanKey=(typeof editsOnly==='function'&&editsOnly()&&typeof edPieces==='function')?[...edPieces()].sort().join(','):'';
  const sig=JSON.stringify([BASE.key,core,mode,unseen,pkgOn,LAYER,typeof MAPSPAN==='undefined'?'':MAPSPAN,spanKey]);
  inv.classList&&['level','oversight'].forEach(k=>inv.classList.toggle('bl-'+k,BLENS===k));
  if(sig===lastSig){
    inv.querySelectorAll('[data-t]').forEach(el=>el.classList.toggle('sel',el.dataset.t===sel));
    inv.querySelectorAll('[data-bag]').forEach(el=>el.classList.toggle('secsel',el.dataset.bag===selSlot&&!sel));
    light(); refreshMarks(); rowLit(inv); if(typeof paintBeyond==='function')paintBeyond(); return;
  }
  // a fresh reading of the same harness redraws in place: no entrance, so the changes can be followed one by one
  const again=INVK===BASE.key; INVK=BASE.key; lastSig=sig; if(!again) inv.classList.remove('settled');
  inv.innerHTML=coreHTML()+H.slots.map(sl=>{const types=sl.types.filter(t=>typeof showPiece!=='function'||showPiece(t));
    if(typeof editsOnly==='function'&&editsOnly()&&!types.length) return '';
    const asks=types.reduce((a,t)=>a+t.asks,0), holds=types.reduce((a,t)=>a+t.holds,0), shown={...sl,types};
    return `<section class="g19 bag22${selSlot===sl.id&&!sel?' secsel':''}" style="grid-area:${sl.id};--sec:${SECCOL[sl.id]}" data-bag="${sl.id}"><header data-sec="${sl.id}" role="button" tabindex="0" title="About this section"><b>${esc(sl.name)} <span class="info">ⓘ</span></b><span>${secHead(shown)}</span></header><p class="job">${esc(sl.job[0].toUpperCase()+sl.job.slice(1))}${asks||holds?` · ${holds} of ${asks+holds} hold on their own`:''}</p>
      <div class="tiles19${sl.rows?' rows75':''}">${sl.rows?sl.rows.map(r=>{const ts=types.filter(t=>t.row===r.id);return ts.length?`<span class="rl75" data-row="${r.id}" data-slot="${sl.id}" role="button" tabindex="0">${esc(r.name)}</span>${ts.map(t=>tile(t)).join('')}`:''}).join('')+types.filter(t=>!t.row).map(t=>tile(t)).join(''):types.map(t=>tile(t)).join('')}</div></section>`}).join('');
  bindTypes(inv); light(); refreshMarks(); rowLit(inv); if(typeof paintBeyond==='function')paintBeyond();
  inv.querySelectorAll('[data-bag]').forEach(b=>{b.onmouseenter=()=>{hp.bag=b.dataset.bag;paint()};b.onmouseleave=()=>{hp.bag=null;paint()};
    b.onclick=e=>{if(e.target.closest&&e.target.closest('[data-t]'))return;selSlot=selSlot===b.dataset.bag&&!sel?null:b.dataset.bag;sel=null;selSet=null;render()}});
  if(!again) inv.querySelectorAll('.t19').forEach((t,k)=>t.style.animationDelay=(k*14)+'ms');
  if(!$('v44pipes')){const p=document.createElementNS?document.createElementNS('http://www.w3.org/2000/svg','svg'):null;if(p&&inv.parentNode){p.id='v44pipes';p.setAttribute('class','pipes22');p.setAttribute('aria-hidden','true');inv.parentNode.insertBefore(p,inv)}}
  (window.requestAnimationFrame||setTimeout)(layoutFit);
  if(again) inv.classList.add('settled'); else setTimeout(()=>inv.classList&&inv.classList.add('settled'),900);
  const co=inv.querySelector('[data-core]'); if(co) co.onclick=()=>openLevel();
  inv.querySelectorAll('[data-sec]').forEach(h=>{const go=e=>{e&&e.stopPropagation&&e.stopPropagation();selSlot=h.dataset.sec;selRow=null;sel=null;selSet=null;topic=null;leftOpen=false;render()};h.onclick=go;h.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
  // a row's label: what the row means on hover, its pieces lit; a click opens the section
  inv.querySelectorAll('.rl75[data-row]').forEach(l=>{const sl=H.slots.find(x=>x.id===l.dataset.slot), r=sl&&(sl.rows||[]).find(x=>x.id===l.dataset.row); if(!r) return;
    const ids=sl.types.filter(t=>t.row===r.id).map(t=>t.id);
    l.onmouseenter=e=>{$('v44tip').innerHTML=`<b>${esc(sl.name)}: ${esc(r.name)}</b><span class="lt-l">${esc(r.about)}</span><span class="lt-l">${ids.map(i=>esc((find(i)||{}).name||i)).join(', ')}</span>`;$('v44tip').hidden=false;moveTip(e);
      inv.querySelectorAll('[data-t]').forEach(el=>el.classList.toggle('rowdim75',el.closest('[data-bag]')===l.closest('[data-bag]')&&!ids.includes(el.dataset.t)))};
    l.onmousemove=moveTip; l.onmouseleave=()=>{$('v44tip').hidden=true;inv.querySelectorAll('.rowdim75').forEach(el=>el.classList.remove('rowdim75'))};
    l.onclick=e=>{e.stopPropagation();selSlot=sl.id;selRow=r.id;sel=null;selSet=null;topic=null;leftOpen=false;render()}});
}
// the one detail panel: a piece, a set, or the harness overview; closed until you ask
function drawDetail(){
  try{localStorage.removeItem('v44-itab')}catch(x){}
  if(LIST==='native'&&!mapped()){LIST='pieces';try{localStorage.setItem('v44-list','pieces')}catch(x){}}
  if(LIST==='layers'&&!MOVESOPEN&&(VIEW!=='board'||BVIEW==='has')&&!selLayer&&!sel&&!selSet&&!selSlot&&!selSit&&!selStake&&!(leftOpen&&topic)) selLayer='*';
  if(LIST!=='layers'&&selLayer){LIST='layers';try{localStorage.setItem('v44-list','layers')}catch(x){}}
  drawDetail0();
  const box=$('v44drawer'); if(!box||!box.insertAdjacentHTML||(box.classList&&box.classList.contains('off50'))) return;
  box.insertAdjacentHTML('afterbegin',navHTML()); bindNav(box); bindSitAdd(box);
  // the sidebar: where you are goes above the circle, not under it
  if(COMPACT){const top=$('v44top'); let host=$('v44navtop');
    if(!host&&top&&top.insertAdjacentHTML){top.insertAdjacentHTML('afterend','<div class="nt81" id="v44navtop"></div>');host=$('v44navtop')}
    if(host){host.innerHTML='';const nv=box.querySelector('.nv52');if(nv)host.appendChild(nv);host.hidden=!nv}}
}
function drawDetail0(){
  const box=$('v44drawer'), open=sel||selSet||selSlot;
  box.hidden=false; $('v44edgeR').hidden=true; box.classList&&box.classList.toggle('rest50',!open&&!(leftOpen&&topic));
  const picked=open||(leftOpen&&topic)||selLayer;
  // picking something new shows the panel (the pickers do that); a redraw never overrides your hiding it
  const shell=$('v44shell'), away=askFirst()||INSPHIDE||(VIEW!=='board'&&!open&&!(leftOpen&&topic));
  if(shell&&shell.classList) shell.classList.toggle('noinsp50',away); box.classList&&box.classList.toggle('off50',away);
  // the moves, opened from the bell, come before anything else the panel would show
  if(MOVESOPEN&&!INSPHIDE){box.classList&&box.classList.remove('rest50','off50');shell&&shell.classList&&shell.classList.remove('noinsp50');movesPane(box);return}
  if(!open&&mapped()&&LIST==='native'&&!selLayer&&!selSit&&!selStake&&!(leftOpen&&topic)&&!INSPHIDE){box.classList&&box.classList.remove('rest50','off50');
    const sh=$('v44shell');sh&&sh.classList&&sh.classList.remove('noinsp50');customPanel(box);bindBrief(box);return}
  if(!open&&selLayer&&!INSPHIDE&&!(leftOpen&&topic)){box.classList&&box.classList.remove('rest50','off50');const sh=$('v44shell');sh&&sh.classList&&sh.classList.remove('noinsp50');
    box.innerHTML=selLayer==='*'?layersPanel():layerPane(selLayer).replace(/<a data-closelayer="1"[^>]*>×<\/a>/,'<a data-layer="*" aria-label="Back to all layers">×</a>');bindBrief(box);bindStackPanel(box);
    box.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>setList(b.dataset.list));
    // Layers built like Pieces: a row opens (fold), lights its pieces on hover; a piece inside opens it
    box.querySelectorAll('[data-fold80]').forEach(b=>b.onclick=e=>{if(e.target.closest&&e.target.closest('.sw64'))return;const k=b.dataset.fold80;OPEN80.has(k)?OPEN80.delete(k):OPEN80.add(k);render()});
    const lvPieces=id=>((BASE.stack&&BASE.stack.levels.find(l=>l.id===id))||{pieces:[]}).pieces, pkPieces=n=>((BASE.stack&&BASE.stack.packages.find(p=>p.name===n))||{pieces:[]}).pieces;
    box.querySelectorAll('[data-hly]').forEach(b=>{b.onmouseenter=()=>lightPieces(lvPieces(b.dataset.hly));b.onmouseleave=()=>lightPieces(null)});
    // where you use it: the editor's own window, inline (its sections fold; a row opens its file and lights its pieces)
    box.querySelectorAll('[data-mshut]').forEach(h=>h.onclick=()=>{const id=h.dataset.mshut, sh=h.closest('section').classList.contains('shut');MSHUT[id]=!sh;render()});
    box.querySelectorAll('[data-maph]').forEach(b=>b.onclick=()=>{if(b.dataset.maph!==rtNow())readAs(b.dataset.maph)});
    box.querySelectorAll('[data-copen]').forEach(r=>r.onclick=()=>typeof HOST!=='undefined'&&HOST.open(r.dataset.copen,null));
    box.querySelectorAll('[data-cpcs]').forEach(r=>{const ids=r.dataset.cpcs?r.dataset.cpcs.split(','):[];r.onmouseenter=()=>ids.length&&lightPieces(ids);r.onmouseleave=()=>lightPieces(null)});
    bindLayerCtl(box);
    box.querySelectorAll('[data-honly]').forEach(b=>{b.onmouseenter=()=>lightPieces(b.dataset.honly.split(','));b.onmouseleave=()=>lightPieces(null)});
    box.querySelectorAll('[data-hpk]').forEach(b=>{b.onmouseenter=()=>lightPieces(pkPieces(b.dataset.hpk));b.onmouseleave=()=>lightPieces(null)});
    box.querySelectorAll('[data-pcopen]').forEach(b=>{b.onclick=()=>{selLayer=null;selectPiece(b.dataset.pcopen)};b.onmouseenter=()=>lightPieces([b.dataset.pcopen]);b.onmouseleave=()=>lightPieces(null)});
    box.querySelectorAll('[data-ovm]').forEach(b=>b.onclick=e=>{e.stopPropagation();setOVM(b.dataset.ovm)});
    box.querySelectorAll('.dl62 [data-backreal]').forEach(b=>b.onclick=()=>{const t=document.querySelector('.st60 [data-backreal]');t&&t.click()});
    box.querySelectorAll('[data-lyrow]').forEach(r=>{const l=r.dataset.lyrow;r.onclick=e=>{if(e.target.closest&&e.target.closest('button,select,label'))return;selLayer=l;render()};
      r.onmouseenter=()=>lightPieces(l==='rt'?Object.entries((BASE.layers&&BASE.layers.base||{}).stage||{}).filter(([,v])=>v>0).map(([k])=>k):layerReport(l).map(x=>x.id));r.onmouseleave=()=>lightPieces(null)});
    box.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{selLayer=b.dataset.layer;render()});
    box.querySelectorAll('[data-hlayer]').forEach(el=>{el.onmouseenter=()=>{const l=el.dataset.hlayer;lightPieces(l==='rt'?Object.entries((BASE.layers&&BASE.layers.base||{}).stage||{}).filter(([,v])=>v>0).map(([k])=>k):layerReport(l).map(r=>r.id))};el.onmouseleave=()=>lightPieces(null)});
    box.querySelectorAll('[data-rtback]').forEach(b=>b.onclick=()=>undoMove('rt'));
    box.querySelectorAll('.ro85 [data-xhl]').forEach(el=>{el.onmouseenter=()=>lightPieces(el.dataset.xhl.split(','));el.onmouseleave=()=>lightPieces(null)});
    box.querySelectorAll('[data-addp]').forEach(b=>b.onclick=e=>{e.stopPropagation();showAdd=!showAdd;head()});
    box.querySelectorAll('[data-untry]').forEach(b=>b.onclick=()=>{PREVSNAP={s:snap(),label:`Stopped trying ${b.dataset.untry}`};PENDING={what:`Reading it again without ${b.dataset.untry}…`};head();busy();HOST.tryPkgs((BASE.tried||[]).filter(x=>x!==b.dataset.untry))});
    const all=layerReport(selLayer).map(r=>r.id);
    box.querySelectorAll('[data-hl]').forEach(el=>{el.onmouseenter=()=>lightPieces([el.dataset.hl]);el.onmouseleave=()=>lightPieces(null)});
    box.querySelectorAll('.lrs').forEach(el=>{el.onmouseleave=()=>lightPieces(null)});
    const hd=box.querySelector('h3');if(hd){hd.onmouseenter=()=>lightPieces(all);hd.onmouseleave=()=>lightPieces(null)}
    box.querySelectorAll('[data-go]').forEach(a=>a.onclick=()=>{selLayer=null;VIEW='board';selectPiece(a.dataset.go)});
    return}
  if(!open){
    if(leftOpen&&topic){box.innerHTML=topicPane();bindBrief(box);bindXP(box);if(topic==='checks')bindChecks(box);
      box.querySelectorAll('[data-closetopic]').forEach(a=>a.onclick=()=>{leftOpen=false;topic=null;render()});
      box.querySelectorAll('.rp71 [data-stake]').forEach(b=>b.onclick=()=>openStake(b.dataset.stake));
      box.querySelectorAll('[data-go]').forEach(a=>a.onclick=()=>{VIEW='board';selectPiece(a.dataset.go)});
      box.querySelectorAll('[data-set]').forEach(a=>{const st=H.sets.find(x=>x.name===a.dataset.set);if(st)a.onclick=()=>{selSet=st.name;sel=null;selSlot=null;render()}});
      return}
    // in Loops and Flows, a picked loop or step; with nothing picked there (or on the Moves tab), the moves
    if(!selSit&&!selStake&&VIEW==='board'){
      if(BVIEW==='checks'&&INSTSEL&&instOf(INSTSEL)){box.classList&&box.classList.remove('rest50');box.innerHTML=loopPane(INSTSEL);bindPane(box);return}
      if(BVIEW==='flows'&&FLOWSEL&&BASE.flows&&BASE.flows.steps.some(s=>s.id===FLOWSEL)){box.classList&&box.classList.remove('rest50');box.innerHTML=stepPane(FLOWSEL);bindPane(box);return}
      // the moves are the panel at rest: below 900px it stays closed until you pick something
      if(BVIEW!=='has'&&RESTMOVES){box.classList&&box.classList.add('rest50');movesPane(box);return}}
    if(selSit&&ovOK()&&ovData().d.situations.some(x=>x.id===selSit)){box.classList&&box.classList.remove('rest50');box.innerHTML=sitPane(selSit);bindBrief(box);bindOv(box);
      box.querySelectorAll('[data-goB]').forEach(b=>b.onclick=()=>{VIEW='board';selectPiece(b.dataset.gob)});(window.requestAnimationFrame||setTimeout)(sitLit);return}
    if(ovOK()&&!selLayer){box.classList&&box.classList.remove('rest50');
      if(selStake){box.innerHTML=stakePane(selStake);bindBrief(box);bindOv(box);bindCalls(box);bindScope(box);bindRows(box);(window.requestAnimationFrame||setTimeout)(stakeLit);return}
      if(LIST==='pieces'){piecesHome(box);bindBrief(box);return}
      if(LIST==='sits'&&SUB==='rules'){rulesHome(box);bindBrief(box);return}
      if(LIST==='sits'&&SUB&&SUB.startsWith('rule:')){ruleDetail(box,SUB.slice(5));bindBrief(box);return}
      if(LIST==='sits'&&SUB!=='all'){trustHome(box);bindBrief(box);return}
      sitsPanel(box);bindBrief(box);return}
    box.innerHTML=restHTML();bindBrief(box);bindOv(box);return}
  if(selSlot&&!sel&&!selSet){
    const sl=H.slots.find(x=>x.id===selSlot), R=selRow&&(sl.rows||[]).find(r=>r.id===selRow), ts=R?sl.types.filter(t=>t.row===R.id):sl.types, f=ts.filter(t=>t.stage===2), m=ts.filter(t=>t.stage<=0), asks=ts.reduce((a,t)=>a+t.asks,0), holds=ts.reduce((a,t)=>a+t.holds,0);
    const ids=new Set(ts.map(t=>t.id));
    const backs=H.trustx.map((c,i)=>({c,i,w:c.pieces.filter(p=>ids.has(p.id)).reduce((a,p)=>a+p.w,0),tot:c.pieces.reduce((a,p)=>a+p.w,0)})).filter(x=>x.w);
    const tiersNeed=H.tiers.filter(t=>t.needs.some(id=>ids.has(id)));
    const probs=H.sets.filter(x=>x.kind==="curse"&&x.status==="active"&&(x.ids.some(id=>ids.has(id))||x.lifts.some(id=>ids.has(id))));
    const nexts=ts.filter(t=>H.next[t.id]);
    const comp=t=>`<a data-go="${t.id}" class="${stCls(t)}"><i></i><b>${esc(t.name)}</b><span>${status(t)}${seen(t)?` · ${seen(t)} found`:''}${t.kind==='control'?` · a control that ${t.firm||'asks'}`:''}</span><span class="w">${esc(t.what)}</span></a>`;
    box.innerHTML=`<div class="dhead"><span class="crumb2">${R?`<a data-secback="1">${esc(sl.name)}</a> › a group`:'A section'}</span><a data-close="1" aria-label="Close">×</a></div>
      <h3>${esc(R?R.name:sl.name)} <span class="st ${f.length===ts.length?'st-found':'st-missing'}">${f.length} of ${ts.length} found</span></h3>
      <p>${esc(R?R.about:(sl.about||SLOTDESC[sl.id]||sl.job))}</p>
      ${R&&R.id==='model'&&BASE.models?`<div class="grm75">${modelsHTML()}</div>`:''}
      ${!R&&sl.rows?`<p class="rgs75">${sl.rows.map(r=>`<a data-rowgo="${r.id}">${esc(r.name)}</a>`).join('')}</p>`:''}
      <span class="lbar" style="margin:6px 0 10px"><i style="width:${100*f.length/ts.length}%"></i></span>
      <details open><summary>Why it matters</summary>
        ${backs.length?`<p>Its pieces make up ${backs.map(b=>`<b>${Math.round(100*b.w/b.tot)}%</b> of the evidence for <b>${esc(b.c.name)}</b> (now ${H.cats[b.i]}%)`).join(', ')}.</p>`:'<p class="dimk">None of its pieces count toward backed trust directly.</p>'}
        ${tiersNeed.length?`<p>${tiersNeed.map(t=>`<b>${esc(t.name)}</b> needs ${t.needs.filter(id=>ids.has(id)).map(id=>esc(find(id)?.name||id)).join(' and ')}`).join('; ')}.</p>`:''}
        ${asks||holds?`<p>Of its guards, <b>${holds}</b> hold on their own and <b>${asks}</b> rely on the model asking.</p>`:''}
      </details>
      <details open><summary>Its components</summary>
        <div class="comp19">${!R&&sl.rows?sl.rows.map(r=>{const rs=ts.filter(t=>t.row===r.id);return rs.length?`<h5 class="rg75"><a data-rowgo="${r.id}">${esc(r.name)}</a><span>${esc(r.about)}</span></h5>${rs.map(comp).join('')}`:''}).join('')+ts.filter(t=>!t.row).map(comp).join(''):ts.map(comp).join('')}</div>
      </details>
      ${probs.length?`<details open><summary>Problems here</summary>${probs.map(p=>`<div class="risk"><b>${esc(p.name)}</b><span>${esc(p.effect)}</span>${p.lifts.length?`<span>Fix: ${p.lifts.map(id=>`<a data-go="${id}">${esc(find(id)?.name||id)}</a>`).join(' or ')}</span>`:''}</div>`).join('')}</details>`:''}
      ${nexts.length?`<details open><summary>Next steps here</summary>${nexts.map(t=>`<a class="nxl" data-go="${t.id}"><b>${esc(t.name)}</b><span>${esc(H.next[t.id].join('; '))}</span></a>`).join('')}</details>`:''}
      ${m.length?`<p class="dimk">Missing: ${m.map(t=>esc(t.name)).join(', ')}. Click one to see how to add it.</p>`:''}`;
    bindModels(box);
    box.querySelectorAll('[data-rowgo]').forEach(a=>a.onclick=e=>{e.preventDefault&&e.preventDefault();selRow=a.dataset.rowgo;render()});
    box.querySelectorAll('[data-secback]').forEach(a=>a.onclick=()=>{selRow=null;render()});
    box.querySelectorAll('[data-go]').forEach(a=>a.onclick=()=>{sel=a.dataset.go;selSet=null;render()});
    box.querySelectorAll('[data-close]').forEach(a=>a.onclick=()=>{selSlot=null;sel=null;selSet=null;topic=null;render()});
    return;
  }
  if(selSet){const s=H.sets.find(x=>x.name===selSet);
    box.innerHTML=`<div class="dhead"><span class="crumb2">${s.kind==='curse'?'A problem':'A set'}</span><a data-close="1" aria-label="Close">×</a></div>
      <h3>${esc(setName(s))} <span class="st ${s.status==='active'&&s.kind==='synergy'?'st-found':s.kind==='curse'&&s.status==='active'?'st-missing':'st-missing'}">${s.kind==='curse'?(s.status==='active'?'Happening now':'Not happening'):(s.status==='active'?'Active':'Not yet')}</span></h3>
      <p>${esc(s.effect)}</p>
      ${s.ids.length?`<h4 class="sec">${s.kind==='curse'?'Caused by':'Its pieces'}</h4>${s.ids.map(id=>`<a class="nxl" data-go="${id}"><b>${on(id)?'✓ ':''}${esc(find(id)?.name||id)}</b><span>${on(id)?'found':'missing'}</span></a>`).join('')}`:''}
      ${s.kind==='curse'&&(s.lifts.length||s.lifts_text)?`<h4 class="sec">Fix it</h4>${s.lifts.map(id=>`<a class="nxl" data-go="${id}"><b>${esc(find(id)?.name||id)}</b><span>add this</span></a>`).join('')}${s.lifts_text?`<p>${esc(s.lifts_text)}</p>`:''}`:''}`;
  } else if(sel){ drawDrawer(); return; }
  box.querySelectorAll('[data-go]').forEach(a=>a.onclick=()=>{sel=a.dataset.go;selSet=null;render()});
  box.querySelectorAll('[data-close]').forEach(a=>a.onclick=()=>{sel=null;selSet=null;selSlot=null;render()});
}
let selSet=null, selSlot=null;
