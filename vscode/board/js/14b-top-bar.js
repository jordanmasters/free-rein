// ---- the top bar's three menus and the side panel's divider
// One context button says what you're looking at (the folder, the program that reads it, its model, its layers) and opens
// the quick switches for each; the Layers tab keeps the detail. One "Draft" chip says what isn't live, changes and
// look-only previews alike, with the actions inside it. The board's own tools sit in one "more" menu. The divider between
// the board and the side panel resizes it (drag; double-click resets) and holds the panel's open and close button.
let CTXOPEN=false, MOREOPEN=false, MORESUB=null;
// how fresh the board is: when the extension read your files (BASE.read), and whether it's reading them now
let READING=false;
const agoText=at=>{const s=(Date.now()-Date.parse(at))/1000; if(!(s>=0)) return 'just now'; if(s<45) return 'just now'; const m=Math.round(s/60);
  if(m<60) return `${m} min ago`; const h=Math.round(m/60); if(h<24) return `${h} h ago`; return new Date(at).toLocaleDateString()};
const freshOf=()=>{const R=BASE.read; return R&&!R.profile&&R.at?R:null};
function freshDot(){const R=freshOf(); if(!R&&!READING) return '';
  return READING?`<i class="fd86 busy" title="Reading your files…">${icon('LoaderCircle',11)}</i>`:`<i class="fd86" title="Your files, read ${esc(agoText(R.at))}"></i>`}
// a scan as it runs (from the extension: why it started, then each step the core reports) and the last one, kept to
// show step by step with how long each took
let SCAN=null, LASTSCAN=null;
const SCANSTEPS=8;
const scanNow=()=>{const s=SCAN&&SCAN.steps[SCAN.steps.length-1]; return s?s.label:'Starting…'};
const msText=ms=>ms<1000?`${Math.max(1,Math.round(ms))} ms`:`${(ms/1000).toFixed(1)} s`;
// the scan, step by step: each with what it found and how long it took; the current one turning
function scanSteps(S,live){return `<ol class="ss87">${S.steps.map((s,i)=>{const cur=live&&i===S.steps.length-1;
  return `<li class="${cur?'cur':'ok'}">${cur?icon('LoaderCircle',12):icon('Check',12)}<span><b>${esc(s.label)}</b>${s.detail?`<small>${esc(s.detail)}</small>`:''}</span><i>${cur?'':msText((s.end||S.end||Date.now())-s.t)}</i></li>`}).join('')}</ol>`}
function scanLive(){const S=SCAN||LASTSCAN; if(!S) return '<div class="sl87 none"></div>';
  if(SCAN) return `<div class="sl87 live"><p class="hd">${icon('LoaderCircle',13)} <b>${S.draft?'Measuring the draft on a copy':'Scanning now'}</b><span>${esc(S.why)}</span></p>
    ${S.changed.length?`<p class="ch">${esc(S.changed.slice(0,4).join(', '))}${S.changed.length>4?` and ${S.changed.length-4} more`:''}</p>`:''}
    <i class="br87"><i style="width:${Math.min(100,Math.round(100*Math.max(0,S.steps.length-.5)/SCANSTEPS))}%"></i></i>${scanSteps(S,true)}</div>`;
  return `<details class="sl87"${S.failed?' open':''}><summary>${S.failed?'The last scan failed':'The last scan, step by step'} <span>${esc(S.why)} · took ${msText((S.end||Date.now())-S.at)}</span></summary>${scanSteps(S,false)}</details>`}
// a step updates the toast, the context button's dot and the Scans page in place; the rest of the board waits
function updateScanUI(){if(typeof document==='undefined'||typeof head!=='function') return;
  const dot=document.querySelector('#v44head .cb86 .fd86'); if(!dot||!dot.classList.contains('busy')) head();
  const row=document.querySelector('#v44head .fr86 .sk86 .v'); if(row&&READING) row.textContent=scanNow();
  const live=document.querySelector('#v44drawer .sl87'); if(live&&leftOpen&&topic==='scans') live.outerHTML=scanLive();
  drawToast()}

// ---- the scan as a notification, bottom right, above everything: while it runs, what it's doing and Cancel; when it
// ends, what it read and what moved, until you close it or it times out (longer when something moved)
let TOAST=null, TOASTT=null;
// the numbers a scan can move, from what the board shows now
function scanNumbers(){try{const x=xpOf(), S=ovOK()?ovData().d.situations:[], R=(BASE.said||{}).summary||{};
  return {xp:x, level:lvlOf(x), equipped:types().filter(t=>t.stage===2).length, exposed:S.filter(s=>s.verdict==='exposed').length, rules:R.rules||0, backed:R.backed||0}}catch(e){return null}}
function scanSummary(S){const a=S.before, b=S.after; if(!a||!b) return {moved:[],same:''};
  const moved=[], d=(k,n,f)=>{if(a[k]!==b[k]) moved.push(f(a[k],b[k]))};
  d('xp','XP',(p,q)=>`<b class="${q>p?'up':'dn'}">${q>p?'+':''}${q-p} XP</b>`); d('level','',(p,q)=>`level ${p} → ${q}`);
  d('equipped','',(p,q)=>`pieces in place ${p} → ${q}`); d('exposed','',(p,q)=>`<b class="${q<p?'up':'dn'}">exposed ${p} → ${q}</b>`);
  d('backed','',(p,q)=>`rules enforced ${p} → ${q}`);
  return {moved, same:`Level ${b.level} · ${b.xp} XP · ${b.exposed} exposed`}}
const stepDetail=(S,id)=>((S.steps.find(x=>x.id===id)||{}).detail||'');
function toastHTML(){const S=SCAN||LASTSCAN; if(!TOAST||!S) return '';
  const close=`<button class="x" data-toastx="1" aria-label="Close">${icon('X',13)}</button>`, why=`<p class="why">${esc(S.why)}${S.changed.length?`: <code>${esc(S.changed.slice(0,3).join(', '))}${S.changed.length>3?` +${S.changed.length-3}`:''}</code>`:''}</p>`;
  if(TOAST.state==='run'){const n=S.steps.length, pct=Math.min(100,Math.round(100*Math.max(0,n-.5)/SCANSTEPS));
    return `<div class="hd">${icon('LoaderCircle',14)}<b>${esc(PENDING?PENDING.what:S.draft?'Measuring the draft on a copy':'Scanning your files')}</b><span class="n">${n?`${Math.min(n,SCANSTEPS)} of ${SCANSTEPS}`:''}</span></div>${why}
      <p class="now">${esc(scanNow())}${(S.steps[n-1]||{}).detail?` <small>${esc(S.steps[n-1].detail)}</small>`:''}</p><i class="br87"><i style="width:${pct}%"></i></i>
      <div class="ac">${typeof HOST!=='undefined'?'<button class="lk50" data-scancancel="1">Cancel</button>':''}<button class="lk50" data-scans="1">Step by step</button></div>`}
  if(TOAST.state==='cancelled') return `<div class="hd">${icon('CircleSlash',14)}<b>Scan cancelled</b>${close}</div><p class="why">The board still shows the last scan that finished.</p>`;
  if(TOAST.state==='failed') return `<div class="hd bad">${icon('TriangleAlert',14)}<b>The scan failed</b>${close}</div>${why}<p class="now">${esc(S.error||'At: '+scanNow())}</p><div class="ac"><button class="lk50" data-scans="1">Step by step</button><button class="lk50" data-reread="1">Try again</button></div>`;
  const sm=scanSummary(S), read=[stepDetail(S,'files').split(',')[0],stepDetail(S,'prose'),stepDetail(S,'situations').split(',')[0]].filter(Boolean).join(' · ');
  return `<div class="hd ok">${icon('CircleCheck',14)}<b>${S.draft?'Draft measured':'Scan done'}</b><span class="n">${msText((S.end||Date.now())-S.at)}</span>${close}</div>${why}
    <p class="res">${sm.moved.length?sm.moved.join(' · '):`Nothing moved. ${esc(sm.same)}.`}</p>${read?`<p class="rd">Read: ${esc(read)}</p>`:''}
    <div class="ac"><button class="lk50" data-scans="1">See the scan</button><button class="lk50" data-checks="1">What it checks</button></div>`}
function drawToast(){if(typeof document==='undefined') return; const root=document.getElementById('p34'); if(!root) return;
  let el=document.getElementById('v44scan'); if(!el){el=document.createElement('div');el.id='v44scan';el.className='st88';el.setAttribute('role','status');el.setAttribute('aria-live','polite');root.appendChild(el);
    el.addEventListener('mouseenter',()=>{clearTimeout(TOASTT)});el.addEventListener('mouseleave',()=>armToast())}
  el.innerHTML=toastHTML(); el.hidden=!el.innerHTML;
  el.querySelectorAll('[data-toastx]').forEach(b=>b.onclick=()=>{TOAST=null;drawToast()});
  el.querySelectorAll('[data-scancancel]').forEach(b=>b.onclick=()=>{b.disabled=true;b.textContent='Cancelling…';HOST.cancelScan()});
  armToast()}
// a toast that says something moved stays longer; one that says nothing moved goes quickly; a failure stays
function armToast(){clearTimeout(TOASTT); if(!TOAST||TOAST.state==='run'||TOAST.state==='failed') return;
  const S=LASTSCAN, moved=S&&scanSummary(S).moved.length; TOASTT=setTimeout(()=>{TOAST=null;drawToast()},TOAST.state==='cancelled'?4000:moved?12000:5000)}
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('click',e=>{const t=e.target; if(t&&t.closest&&t.closest('#v44scan [data-scans],#v44scan [data-checks]')){TOAST=null;setTimeout(drawToast,0)}});
// the two kinds of scan, by name: the rules scan (Free Rein's own checks, no AI, on its own when files change) and the
// agent review (your own AI, started by you; not built yet). The list of every scan is its own page
function freshBlock(){const R=freshOf(), hosted=typeof HOST!=='undefined'; if(!R&&!READING) return '';
  return `<div class="fr86">
    <div class="sk86"><div class="hd">${freshDot()}<b>Rules scan</b><span class="v">${READING?esc(scanNow()):`<span data-ago="${esc(R.at)}">${esc(agoText(R.at))}</span>`}</span>${hosted&&!READING?'<button class="lk50" data-reread="1">Scan again</button>':''}</div>
      <p>Free Rein's own checks, no AI. Runs by itself when your files change.</p></div>
    ${agentRow(false)}
    <button class="lk50 go" data-scans="1">Every scan, and when it ran ${icon('ArrowRight',12)}</button></div>`}
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('message',e=>{const m=e.data; if(!m) return;
    if(m.type==='reading'){READING=true;SCAN={why:m.why||'Scanning',changed:m.changed||[],draft:!!m.draft,auto:!!m.auto,at:m.at||Date.now(),steps:[],before:scanNumbers()};if(!m.auto)TOAST={state:'run'};updateScanUI()}
    else if(m.type==='scanstep'&&SCAN){const at=m.at||Date.now(), s=SCAN.steps.find(x=>x.id===m.id);
      if(s){s.label=m.label;if(m.detail)s.detail=m.detail}else{const p=SCAN.steps[SCAN.steps.length-1];if(p&&!p.end)p.end=at;SCAN.steps.push({id:m.id,label:m.label,detail:m.detail||'',t:at})}
      updateScanUI()}
    else if(m.type==='data'||m.type==='failed'||m.type==='cancelled'){READING=false;const had=!!SCAN;if(SCAN){const end=Date.now(),p=SCAN.steps[SCAN.steps.length-1];if(p&&!p.end)p.end=end;SCAN.end=end;SCAN.failed=m.type==='failed';SCAN.cancelled=m.type==='cancelled';SCAN.error=m.error||'';LASTSCAN=SCAN;SCAN=null}
      // the board redraws with the new data first; then the toast says what the scan found and what moved
      if(m.type==='cancelled'){PENDING=null;TOAST={state:'cancelled'};if(typeof head==='function')head();drawToast()}
      // a scan a file change started says nothing unless it found something new (or failed)
      else if(had) setTimeout(()=>{const S=LASTSCAN;if(S&&S.end&&!S.after)S.after=scanNumbers();
        if(S&&S.auto&&m.type!=='failed'&&!scanSummary(S).moved.length){if(TOAST&&TOAST.state==='run'){TOAST=null;drawToast()}return}
        TOAST={state:m.type==='failed'?'failed':'done'};drawToast()},0)}});
  setInterval(()=>{if(typeof document==='undefined') return; document.querySelectorAll('[data-ago]').forEach(el=>{el.textContent=agoText(el.dataset.ago)});
    const d=document.querySelector('#v44head .cb86 .fd86:not(.busy)'), R=freshOf(); if(d&&R) d.title=`Your files, read ${agoText(R.at)}`},30000)}
const LYNAME={org:'Your organization',local:'This repo',project:'This repo',user:'All repos'};
const LYTAG={org:'everyone',local:'just you',project:'shared',user:'just you',builtin:'built in'};
const LYORDER=['builtin','user','project','local','org'];
// the switch a level has, if any: the runtime's built-ins, your home folder, this repo's files
function levelSwitchAttr(l){return l.id==='builtin'?(!BASE.profile&&!BASE.new?`data-baseon="${levelOn(l)?0:1}"`:''):l.id==='user'?'data-homeon="1"':(l.id==='project'||l.id==='local')&&!BASE.profile?'data-yours="1"':''}

// the button: the folder's name, and under it the program, the model and the layers, short
function ctxBtn(){const segs=stackSegs(), get=k=>segs.find(s=>s.key===k), t=get('target'), what=segs.some(s=>s.what);
  const sub=[get('runson'),get('model'),get('layers')].filter(Boolean).map(s=>s.key==='layers'?`${s.v} layer${s.v==='1'?'':'s'}`:s.v);
  return `<span class="g59 cx86w"><button class="cb86${what?' what':''}" data-ctx="1" aria-expanded="${CTXOPEN}" aria-haspopup="dialog" title="What you're looking at: the folder, the program that reads it, its model and its layers">
    <span class="tx"><b>${freshDot()}${esc(t.v)}</b><small>${esc(sub.join(' · '))}${what?' · what-if':''}</small></span>${icon('ChevronDown',13)}</button>${CTXOPEN?ctxMenu():''}</span>`}
function ctxMenu(){const hosted=typeof HOST!=='undefined', prof=BASE.profile, ST=BASE.stack, M=((BASE.models||{}).models||[]).filter(m=>m.name);
  const agentName=(ST&&ST.runtime)||(BASE.runtime||{}).name||'', mp=modelPickHTML()||(M.length?`<b>${esc(M[0].name)}</b>`:'');
  const sw=l=>{const a=levelSwitchAttr(l), on=levelOn(l); return a?`<button class="sw64" ${a} role="switch" aria-checked="${on}" title="${on?'Switch it off to see the harness without it. A preview only: nothing changes':'Switch it back on'}"><i></i></button>`:'<span class="sw64 fx" title="Can\'t be switched off"></span>'};
  const lv=ST?LYORDER.map(id=>ST.levels.find(l=>l.id===id)).filter(Boolean):[];
  const rows=lv.map(l=>{const on=levelOn(l), n=l.pieces.length;
    return `<div class="lr86${on?'':' off'}" data-hly="${l.id}"><span class="li75">${icon(LVLIC[l.id]||'Layers',14)}</span><span class="nm"><b>${esc(l.id==='builtin'?agentName:(LYNAME[l.id]||l.name))}</b> <i class="tg75${LYTAG[l.id]==='just you'?' me':''}">${esc(LYTAG[l.id]||'')}</i><small>${n} piece${n===1?'':'s'}${on?'':' · off'}</small></span>${sw(l)}</div>`}).join('');
  return `<div class="cx86 pop86" role="dialog" aria-label="What you're looking at">${freshBlock()}
    <div class="r"><span class="k">${prof?'Product':'Working on'}</span><span class="v"><b>${esc(BASE.new?'New harness':BASE.name.replace(/, out of the box$/,''))}</b></span>${hosted?'<button class="lk50" data-pick="1">Change…</button>':''}</div>
    ${!prof||prof.kind==='runtime'?`<div class="r"><span class="k">Runs on</span><span class="v">${rtPickHTML('data-rtpick="1"')}</span></div>`:''}
    ${mp?`<div class="r" title="The model your agent runs on. Free Rein itself uses no AI model"><span class="k">Its model</span><span class="v">${mp}</span></div>`:''}
    ${(ms=>ms?`<div class="r"><span class="k">Mode</span><span class="v md96s">${ms}</span></div>`:'')(modePickHTML())}
    ${rows?`<p class="h">Layers <small>switch one off to preview without it</small></p>${rows}`:''}
    ${rows?`<button class="lk50 go" data-seg="layers">Open the Layers tab ${icon('ArrowRight',12)}</button>`
      :prof?`<p class="h">Out of the box <small>Free Rein reads ${esc(BASE.name.replace(/, out of the box$/,''))}'s record, not files: there are no layers of yours to switch</small></p>`:''}</div>`}

// the chip: nothing when everything is live; otherwise "Draft · n", and inside it what differs, in two groups
function lensCtl(){const hosted=typeof HOST!=='undefined', dr=BASE.draft, {ch,vw}=diffItems();
  if(!ch.length&&!vw.length) return '';
  let dx='';
  if(dr&&dr.reality&&!BASE.new&&!vw.length){const r=realWithSits(), x1=xpOf(), d1=x1-(r.xp||0), L0=lvlOf(r.xp||0), L1=lvlOf(x1);
    dx=d1||L1!==L0?`<p class="dx86">${d1?`<b class="${d1>0?'up':'dn'}">${d1>0?'+':''}${d1} XP</b>`:''}${L1!==L0?` level ${L0} → ${L1}`:''}</p>`:''}
  const n=ch.length+vw.length, nm=BASE.new?'New harness':'Draft';
  const list=DIFFOPEN?`<div class="dp67 pop86" role="dialog" aria-label="What isn't live">
      <p class="hd">What you see differs from your files${dx?':':'.'}</p>${dx}
      ${ch.length?`<h5>Changes <small>Apply writes these</small></h5>${ch.map(x=>`<div class="r"><span>${esc(x.t)}</span><button data-undiff="${x.k}:${esc(x.id)}" aria-label="Take it back">${icon('X',11)}</button></div>`).join('')}`:''}
      ${vw.length?`<h5 class="v">Look only <small>nothing to apply</small></h5>${vw.map(x=>`<div class="r v">${icon('Eye',12)}<span>${esc(x.t)}</span><button data-undomove="${esc(x.id)}" aria-label="Back">${icon('X',11)}</button></div>`).join('')}`:''}
      <div class="ft">${vw.length?`<button class="ac60" data-backreal="1">${ch.length?'Clear the look-only':'Back to your files'}</button>`:''}<span class="sp"></span>
        ${ch.length&&hosted?`<button class="ac60" data-discard="1">Discard</button><button class="ac60" data-savedraft="1">Save</button><button class="ac60 pri" data-apply="1">${BASE.new?'Create…':'Apply…'}</button>`:''}</div>
      ${ch.length&&hosted&&!COMPACT?`<button class="lk50 go" data-view="drafts">Saved drafts and what you applied ${icon('ArrowRight',12)}</button>`:''}</div>`:'';
  return `<span class="g59 df86"><button class="dc86" data-diffopen="1" aria-expanded="${DIFFOPEN}" title="Differs from your files: ${esc([...ch,...vw].map(x=>x.t).join('; '))}">${icon('PencilRuler',14)}<b>${nm}</b><i class="ct86">${n}</i></button>${list}</span>`}

// the board's own tools, in one menu: something wrong (with Loops and Flows), how the board looks, drafts, settings, the legend
function moreMenu(){const board=VIEW==='board', S=board&&FLAG_LOOPS?(BASE.symptoms||[]).filter(s=>bviewOn(s.view)):[];  // "something wrong?" comes back with Loops and Flows: with Harness alone it lists too little
  const sub=(k,ic,n,d)=>`<button class="mi86" data-moresub="${k}" aria-expanded="${MORESUB===k}">${icon(ic,14)}<span>${n}${d?`<small>${d}</small>`:''}</span>${icon(MORESUB===k?'ChevronUp':'ChevronDown',12)}</button>`;
  const item=(attr,ic,n)=>`<button class="mi86" ${attr}>${icon(ic,14)}<span>${n}</span></button>`;
  return `<div class="mr86 pop86" role="menu" aria-label="More">
    ${S.length?sub('sym','Stethoscope','Something wrong?','start from what you see')+(MORESUB==='sym'?`<div class="sl86">${S.map(s=>`<button class="si70${SYMSEL===s.id?' on':''}" data-sym="${s.id}"><span>${esc(s.name)}</span><small>${s.have.length} of ${s.pieces.length} in place · ${esc(BVIEWS.find(([k])=>k===s.view)[1].toLowerCase())}</small></button>`).join('')}${SYMSEL?'<button class="lk50" data-symclear="1">Clear</button>':''}</div>`:''):''}
    ${board?sub('view','SlidersHorizontal','View','how the board looks')+(MORESUB==='view'?tlMenu():''):''}
    ${COMPACT?'':item('data-view="drafts"','PencilRuler','Drafts, and what you applied')}
    ${item('data-view="settings"','Settings','Settings')}
    ${item('data-topic="legend"','CircleHelp','Legend: what everything means')}
    ${item('data-scans="1"','History','Scans: every one, and when it ran')}
    ${item('data-checks="1"','ListChecks','How Free Rein checks: every check, and what it found')}</div>`}
function moreBtn(){return `<span class="g59 tools mo86w"><button class="ib48" data-more="1" aria-expanded="${MOREOPEN}" aria-haspopup="menu" title="More: view, drafts, settings, legend" aria-label="More">${icon('Ellipsis',16)}${SYMSEL?'<i class="dt86"></i>':''}</button>${MOREOPEN?moreMenu():''}</span>`}

// one open menu at a time; a click outside or Esc closes it
function closePops(){if(!CTXOPEN&&!MOREOPEN&&!DIFFOPEN) return false; CTXOPEN=false;MOREOPEN=false;DIFFOPEN=false;MORESUB=null;return true}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('click',e=>{const t=e.target; if(!t||!t.closest) return; if(t.closest('.pop86,[data-ctx],[data-more],[data-diffopen]')) return; if(closePops()) head()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&closePops()){e.stopPropagation();head()}},true)}
// a menu that would run off the window moves back in (below 500px they're sheets, by CSS)
function clampPops(){if(typeof window==='undefined'||!window.innerWidth) return; const W=window.innerWidth;
  document.querySelectorAll('#v44head .pop86').forEach(p=>{if(!p.getBoundingClientRect) return; p.style.marginLeft='';
    if(W<=500) return; const t=p.parentElement&&p.parentElement.getBoundingClientRect(), r=p.getBoundingClientRect(); if(!r.width||!t) return;
    // open toward the side with room: from the trigger's left edge, or its right edge, then kept 8px inside the window
    const fromLeft=t.left, fromRight=t.right-r.width, x=fromLeft+r.width<=W-8?fromLeft:fromRight>=8?fromRight:Math.max(8,W-8-r.width);
    p.style.left='0';p.style.right='auto';p.style.marginLeft=`${x-t.left}px`})}
function bindTopBar(q){
  q('[data-ctx]').forEach(b=>b.onclick=()=>{const o=!CTXOPEN;closePops();CTXOPEN=o;head()});
  q('[data-more]').forEach(b=>b.onclick=()=>{const o=!MOREOPEN;closePops();MOREOPEN=o;head()});
  q('[data-moresub]').forEach(b=>b.onclick=()=>{MORESUB=MORESUB===b.dataset.moresub?null:b.dataset.moresub;head()});
  // a menu item closes the menu; the item's own handler (on the document) then does its job
  q('.mr86 [data-view],.mr86 [data-topic],.mr86 [data-checks],.mr86 [data-scans],.mr86 [data-sym],.cx86 [data-seg],.cx86 [data-pick],.dp67 [data-view]').forEach(b=>b.addEventListener('click',()=>{closePops()}));
  q('[data-rtpick]').forEach(s=>s.onchange=e=>onRtPick(e.target.value));
  const box=document.querySelector('#v44head .cx86'); if(box){bindLayerCtl(box);
    box.querySelectorAll('[data-hly]').forEach(r=>{const ps=((BASE.stack&&BASE.stack.levels.find(l=>l.id===r.dataset.hly))||{pieces:[]}).pieces;r.onmouseenter=()=>lightPieces(ps);r.onmouseleave=()=>lightPieces(null)})}
  clampPops()}
// reading the folder as another program: every layer is read the way it would
function onRtPick(v){const L=BASE.lens||{};for(const k in MODEPICK)delete MODEPICK[k];if(L.home&&v===L.home&&L.runtime!==L.home)undoMove('rt');else chooseBase(v)}

// the switches and pickers for the layers, wherever they're drawn: the Layers tab and the context menu
function bindLayerCtl(root){
  root.querySelectorAll('[data-modesel]').forEach(sel=>sel.onchange=()=>{if(sel.dataset.tell){if(typeof HOST!=='undefined')HOST.prefs({cursorRunMode:sel.value});return}pickMode(sel.dataset.modesel,sel.value)});
  root.querySelectorAll('[data-rtmodel]').forEach(sel=>sel.onchange=()=>{const rt=sel.dataset.rtmodel, v=sel.value||'default';
    if(typeof HOST==='undefined'||!canDraft()) return; const ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];
    const rules=draftRules().filter(r=>!(r.kind==='model'&&r.rule.startsWith(`main@${rt}=`))); if(v!==((BASE.runtime_models||{}).current||'default')) rules.push({kind:'model',rule:`main@${rt}=${v}`,sit:'model:main@'+rt,preset:'model'});
    PENDING={what:`Measuring the harness on ${v}…`};busy();head();HOST.draft({ups,rules})});
  root.querySelectorAll('[data-rtwhatif]').forEach(sel=>sel.onchange=()=>{MWHATIF[sel.dataset.rtwhatif]=sel.value||null;render()});
  root.querySelectorAll('[data-baseon]').forEach(b=>b.onclick=()=>{const on=b.dataset.baseon==='1';premarkBase(on);PREVSNAP={s:snap(),label:on?`Counting what ${layerName('rt')} ships again`:`Without ${layerName('rt')}'s defaults`};PENDING={what:'Reading it again…'};head();busy();if(typeof HOST!=='undefined')HOST.base(on)});
  root.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const p=b.dataset.p,on=pkgOn[p]!==false;track(on?`Switched off ${p}`:`Switched ${p} back on`,()=>{pkgOn[p]=!on;render()})});
  root.querySelectorAll('[data-homeon]').forEach(b=>b.onclick=()=>track(HOMEON?'Switched off your own setup (your home folder)':'Switched your own setup back on',()=>{HOMEON=!HOMEON;render()}));
  root.querySelectorAll('[data-yours]').forEach(b=>b.onclick=()=>track(YOURS?'Switched off the project\'s files':'Switched the project\'s files back on',()=>{YOURS=!YOURS;render()}));
}

// the divider: drag to size the side panel (280 to 640px, the board keeps 360px), double-click to reset; its button
// opens and closes the panel. Below 700px the panel slides over the board, and the button stays at the window's edge
const PWMIN=280, PWMAX=640;
const pwClamp=w=>Math.max(PWMIN,Math.min(PWMAX,Math.min(w,(window.innerWidth||1200)-380)));
let PWSET=false;
function drawDivider(){const el=$('v44rz'), sh=$('v44shell'); if(!el||!sh) return;
  if(!PWSET){PWSET=true; try{const w=+localStorage.getItem('v44-pw'); if(w&&sh.style&&sh.style.setProperty) sh.style.setProperty('--pw',w+'px')}catch(x){}}
  const away=inspAway();
  el.hidden=!!COMPACT; if(COMPACT) return;
  el.classList&&el.classList.toggle('shut',!!away);
  el.innerHTML=`<button class="rzb86" data-toginsp="1" aria-pressed="${!away}" title="${away?'Show':'Hide'} the side panel" aria-label="${away?'Show':'Hide'} the side panel">${icon(away?'PanelRightOpen':'PanelRightClose',14)}</button>`;
  el.querySelectorAll('[data-toginsp]').forEach(b=>b.onclick=e=>{e.stopPropagation();setInsp(!inspAway())});
  if(el.dataset&&el.dataset.bound) return; if(el.dataset) el.dataset.bound='1';
  const set=w=>{const v=pwClamp(w);sh.style.setProperty('--pw',v+'px');return v};
  el.addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('button')||INSPHIDE||window.innerWidth<=700) return;
    e.preventDefault(); const right=sh.getBoundingClientRect().right; el.classList.add('drag'); el.setPointerCapture&&el.setPointerCapture(e.pointerId);
    let last=null; const mv=ev=>{last=set(right-ev.clientX-5)};
    const up=()=>{el.classList.remove('drag');el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);
      if(last){try{localStorage.setItem('v44-pw',String(last))}catch(x){}} layoutFit()};
    el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)});
  el.addEventListener('dblclick',e=>{if(e.target.closest&&e.target.closest('button')) return; sh.style.removeProperty('--pw');try{localStorage.removeItem('v44-pw')}catch(x){} layoutFit()});
  el.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'||INSPHIDE) return; const d=$('v44drawer'); const cur=d&&d.getBoundingClientRect?d.getBoundingClientRect().width:360;
    const v=set(cur+(e.key==='ArrowLeft'?16:-16)); try{localStorage.setItem('v44-pw',String(v))}catch(x){} layoutFit()})}
