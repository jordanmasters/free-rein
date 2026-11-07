// ---- One shape for everything you can pick (a loop, a step, a piece), and the list of moves. Three levels in each:
// a glance (name, status, one sentence), the next move, then folded sections with a count each. A list shows its top
// three; the rest are one click further.
let MOVESOPEN=false, PFOLD=(()=>{try{return JSON.parse(localStorage.getItem('v44-pfold')||'{}')}catch(x){return {}}})(), MOVEPICK=[], MOVESALL=false, LISTALL={};
const foldOpen=(id,dflt)=>id in PFOLD?PFOLD[id]:dflt;
function paneHTML(o){
  return `<div class="pn73"><div class="cr73"><span>${(o.crumb||[]).map(esc).join(' › ')}</span><button class="x73" data-closepane="1" aria-label="Close">${icon('X',14)}</button></div>
    <div class="hd73">${o.mark||''}<div class="nm"><b>${esc(o.name)}</b>${o.chip&&o.chip[0]?`<i class="vd70" style="--vc:${o.chip[1]}">${esc(o.chip[0])}</i>`:''}</div></div>
    ${o.now?`<p class="nw73">${esc(o.now)}</p>`:''}${o.move||''}
    ${(o.sections||[]).map(s=>{const open=foldOpen(s.id,s.open);return `<section class="se73${open?' open':''}"><button class="sh" data-pfold="${esc(s.id)}" aria-expanded="${open}"><b>${esc(s.title)}</b><span>${esc(s.count||'')}</span>${icon('ChevronDown',13)}</button>${open?`<div class="sb">${s.body}</div>`:''}</section>`}).join('')}</div>`}
// a list's top few, and a way to see the rest
function listTop(items,n,cls){const k=items.join('').length+':'+items.length, all=LISTALL[k];
  return `<div class="lt73${cls?' '+cls:''}">${(all?items:items.slice(0,n)).join('')}</div>${items.length>n?`<button class="lk50" data-listall="${esc(k)}">${all?'Show fewer':`Show all ${items.length}`}</button>`:''}`}
const EFFN={quick:'quick',medium:'some work',larger:'more work'}, SRCN={situations:'situations',rules:'your rules',loops:'loops',flows:'flows',pieces:'pieces'};
// a move: what to do, why, what it earns, how much work
function moveCard(m,pick){return `<div class="mc73${pick?' pk':''}${MOVEPICK.includes(m.id)?' on':''}">${pick?`<input type="checkbox" data-mpick="${esc(m.id)}" aria-label="Pick ${esc(m.title)}"${MOVEPICK.includes(m.id)?' checked':''}>`:''}
  <button class="tx" data-move="${esc(m.id)}"><b>${esc(m.title)}</b><small>${esc(m.why)}</small><span class="tg">${m.sources.map(s=>`<i>${SRCN[s]}</i>`).join('')}<i class="ef ${m.effort}">${EFFN[m.effort]}</i></span></button>
  <span class="xp73">${m.xp?`+${m.xp} XP`:m.protects?`protects ${m.protects}`:''}</span></div>`}
// the side panel with nothing picked: the moves for the view you're in
function movesPane(box){const all=movesAll(), v=VIEW==='board'?BVIEW:'has', ms=v==='has'?all:v==='free'?all.filter(m=>(m.sources||[]).some(s=>s==='situations'||s==='rules')):all.filter(m=>m.view===v);
  const shown=MOVESALL?ms:ms.slice(0,5), picked=MOVEPICK.filter(id=>all.some(m=>m.id===id)), xp=all.filter(m=>picked.includes(m.id)).reduce((a,m)=>a+(m.xp||0),0), hosted=typeof HOST!=='undefined'&&canDraft();
  // at rest (not opened from the bell), the tabs stay above the moves: picking one leaves them
  const tabs=!MOVESOPEN&&typeof listSwitch==='function'?`<div class="rt93">${listSwitch(true)}</div>`:'';
  box.innerHTML=`${tabs}<div class="pn73 mv73p"><div class="cr73"><span>${MOVESOPEN?'Notifications':v==='checks'?'Loops':v==='free'?'Free rein':'Flows'}</span>${MOVESOPEN?`<button class="x73" data-movesclose="1" aria-label="Close">${icon('X',14)}</button>`:''}</div><div class="hd73"><div class="nm"><b>${v==='has'?'What to do next':v==='checks'?'Next for your loops':v==='free'?'Rein it in':'Next for your flows'}</b><small>${ms.length?`${ms.length} thing${ms.length>1?'s':''} to do, most important first`:'nothing to do here'}${v!=='has'&&all.length>ms.length?` · ${all.length} in all`:''}</small></div></div>
    ${ms.length?`<p class="nw73">Pick one to see it, or tick a few and fix them together in one draft.</p><div class="ml73">${shown.map(m=>moveCard(m,true)).join('')}</div>${ms.length>5?`<button class="lk50" data-movesall="1">${MOVESALL?'Show fewer':`Show all ${ms.length}`}</button>`:''}`
      :`<p class="nw73">${v==='has'?'Nothing to do: every risk is held and every loop stops on evidence.':'Nothing to fix in this view.'}</p>`}
    ${picked.length?`<div class="ft73"><span>${picked.length} picked${xp?` · +${xp} XP`:''}</span><button class="b50 pri" data-fixmoves="1"${hosted?'':' disabled title="Open it in the editor to make a draft"'}>Fix in one draft</button></div>`:''}</div>`;
  bindPane(box); box.querySelectorAll('.rt93 [data-list]').forEach(b=>b.onclick=()=>setList(b.dataset.list))}
// tick a few moves and make one draft: their rules and their pieces, measured together, each one removable after
function fixMoves(){const all=movesAll(), ms=all.filter(m=>MOVEPICK.includes(m.id)); if(!ms.length||typeof HOST==='undefined') return;
  const ups=[...((BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[])], rules=[...(typeof draftRules==='function'?draftRules():[])], D=ovOK()?ovData().d:null;
  for(const m of ms){ if(m.fix.piece&&find(m.fix.piece)&&!ups.includes(m.fix.piece)) ups.push(m.fix.piece);
    for(const r of m.fix.rules){const x=D&&D.situations.find(s=>s.id===r.sit), c=x&&x.calls&&x.calls[r.how==='ask'?'ask':'never'];
      const i=rules.findIndex(y=>y.sit===r.sit); if(i>=0) rules.splice(i,1); rules.push({kind:c?c.kind:(r.how==='ask'?'ask':'deny'),rule:c?c.rule:r.rule,sit:r.sit,preset:'moves'})}}
  MOVEPICK=[]; PENDING={what:`Measuring ${ms.length} move${ms.length>1?'s':''} in one draft…`};busy();head();HOST.draft({ups,rules})}
// a move opens where it came from: its loop, its step, its situation, its piece
function openMove(id){const m=(BASE.moves||[]).find(x=>x.id===id); if(!m) return;
  if(m.id.startsWith('steps:')){FLOWSEL=((BASE.flows||{}).steps||[]).map(s=>s.id).find(s=>stepName(s)===m.id.slice(6))||null; if(FLOWSEL){showInsp();setBView('flows');return}}
  if(m.sources.includes('loops')){const f=((BASE.loops||{}).findings||[]).find(x=>x.title===m.why), l=f&&BASE.loops.loops.find(x=>x.id===f.loop), i=l&&l.instances.find(x=>x.verdict===f.verdict);
    if(i){INSTSEL=i.id;showInsp();setBView('checks');return}}
  if(m.fix.piece&&find(m.fix.piece)){INSPHIDE=false;selectPiece(m.fix.piece);return}
  if(m.sources.includes('situations')||m.sources.includes('rules')){setList('sits')}}
function bindPane(box){
  box.querySelectorAll('[data-pfold]').forEach(b=>b.onclick=()=>{const id=b.dataset.pfold, sec=b.closest('.se73'); PFOLD[id]=!(sec&&sec.classList.contains('open'));try{localStorage.setItem('v44-pfold',JSON.stringify(PFOLD))}catch(x){}render()});
  box.querySelectorAll('[data-listall]').forEach(b=>b.onclick=()=>{LISTALL[b.dataset.listall]=!LISTALL[b.dataset.listall];render()});
  box.querySelectorAll('[data-mpick]').forEach(b=>b.onchange=()=>{const id=b.dataset.mpick;MOVEPICK=b.checked?[...MOVEPICK,id]:MOVEPICK.filter(x=>x!==id);render()});
  box.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>openMove(b.dataset.move));
  box.querySelectorAll('[data-movesall]').forEach(b=>b.onclick=()=>{MOVESALL=!MOVESALL;render()});
  box.querySelectorAll('[data-fixmoves]').forEach(b=>b.onclick=fixMoves);
  box.querySelectorAll('[data-movesclose]').forEach(b=>b.onclick=()=>{MOVESOPEN=false;render()});
  box.querySelectorAll('[data-closepane]').forEach(b=>b.onclick=()=>{INSTSEL=null;FLOWSEL=null;render()});
  box.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>setList(b.dataset.list));
  if(typeof bindBView==='function') bindBView(box)}
// closing the side panel from inside it (when it slides over the board); the top bar's panel button opens it again
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-closeinsp]'); if(b&&typeof setInsp==='function') setInsp(true)});
