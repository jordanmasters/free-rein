// ---- reading the board: Situations (where it opens), Pieces, Level. The board stays in the middle; the
// centre is the agent, and in Situations and Pieces it shows the reins: per kind of stakes, how far the agent
// goes without you, coloured by whether that's backed.
let REINHOV=null;
const draftRules=()=>(BASE.draft&&BASE.draft.rules)||[];
const CALLK={allow:'let',ask:'ask',deny:'never'};
// your call on one situation: what it is now, and the draft's, if it changed it
// the call shows only decisions: a rule of yours already here, or one in the draft (blue). No rule: nothing
// selected, and Claude Code (or the runtime's default) decides. Clicking the selected one in the draft takes it back.
const CALLN2={let:'Allow',ask:'Ask',never:'Never'};
function ownCall(s){const b=(s.by||[]).find(x=>x.piece==='permissions'&&x.rule); return b?{lets:'let',asks:'ask',refuses:'never'}[b.job]:null}
function callSeg(s){const hosted=typeof HOST!=='undefined'&&canDraft()&&!BASE.profile; if(!hosted||!s.calls) return '';
  const dr=draftRules().find(r=>r.sit===s.id), own=ownCall(s), cur=dr?CALLK[dr.kind]:own;
  return `<span class="cs53${dr?' dr':''}" role="group" aria-label="Your call">${['let','ask','never'].map(c=>{const can=!!s.calls[c]&&!(s.fixed&&!dr), on=c===cur;
    const tip=on&&dr?`In the draft: ${dr.kind} ${dr.rule}. Click to take it back`:on?'Your rule already does this':!can?'Something you can\'t change here holds it (a hook, or a rule outside this folder)':`Add to the draft: ${s.calls[c].kind} ${s.calls[c].rule}`;
    return `<button data-call="${esc(s.id)}:${c}" aria-pressed="${on}" ${can||on?'':'disabled'} title="${esc(tip)}">${CALLN2[c]}</button>`}).join('')}</span>`}
function setCall(id,c,tag){const {d}=ovData(), s=d.situations.find(x=>x.id===id); if(!s) return;
  const others=draftRules().filter(r=>r.sit!==id), dr=draftRules().find(r=>r.sit===id), ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];
  let rules;
  if(dr&&CALLK[dr.kind]===c) rules=others;                          // the selected one: take it back out of the draft
  else{if(!dr&&ownCall(s)===c) return; const r=s.calls[c]; if(!r||(s.fixed&&!dr)) return; rules=[...others,{kind:r.kind,rule:r.rule,sit:id,...(tag?{preset:tag}:{})}]}
  PENDING={what:dr&&CALLK[dr.kind]===c?`Taking the call on ${s.what} out of the draft…`:`Measuring your call: ${CALLN2[c].toLowerCase()}, on ${s.what}…`};busy();head();
  const back=dr&&CALLK[dr.kind]===c; document.querySelectorAll('[data-call]').forEach(b=>{if(!b.dataset.call.startsWith(id+':'))return;const on=!back&&b.dataset.call===id+':'+c;b.setAttribute('aria-pressed',on);b.classList.toggle('wait82',on)});
  HOST.draft({ups,rules})}
// quick sets: your call on the high-stakes situations, for a common way of working
function quickHTML(){const {d}=ovData(), Q=d.quick||[], hosted=typeof HOST!=='undefined'&&canDraft()&&!BASE.profile; if(!Q.length||!hosted) return '';
  return `<div class="qs53"><span>Start from</span>${Q.map(q=>`<button data-quick="${q.id}" title="${esc(q.about)}">${esc(q.name)}</button>`).join('')}</div>`}
function applyQuick(id){const {d}=ovData(), q=(d.quick||[]).find(x=>x.id===id); if(!q) return;
  const ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], rules=[...draftRules()];
  let n=0;
  d.situations.forEach(s=>{const c=q.calls[s.key]||q.calls[s.stakes]; if(!c||!s.calls) return;
    const i=rules.findIndex(r=>r.sit===s.id), cur=i>=0?CALLK[rules[i].kind]:s.call;
    if(c===cur) return; const r=s.calls[c]; if(!r) return;
    if(i>=0) rules.splice(i,1); rules.push({kind:r.kind,rule:r.rule,sit:s.id,preset:q.id}); n++});
  if(!n){PENDING={what:`${q.name}: every call already matches`};head();setTimeout(()=>{PENDING=null;head()},1800);return}
  PENDING={what:`${q.name}: measuring ${n} call${n===1?'':'s'}…`};busy();head();HOST.draft({ups,rules})}
// the list beside the board
function sitsAside(){const A=$('v44sits'); if(A) A.hidden=true}
function bindScope(box){box.querySelectorAll('[data-closestake]').forEach(a=>a.onclick=()=>{selStake=null;lightPieces(null);render()});
  box.querySelectorAll('[data-stake]').forEach(b=>{b.onclick=()=>openStake(b.dataset.stake);b.onmouseenter=()=>focusSits(ovData().d.situations.filter(s=>s.stakes===b.dataset.stake&&!s.accounted));b.onmouseleave=()=>lightPieces(null)});
  box.querySelectorAll('[data-secopen]').forEach(b=>b.onclick=()=>{selSlot=b.dataset.secopen;sel=null;render()});
  box.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{leftOpen=true;topic=b.dataset.topic;render()})}
function bindAside(A){bindOv(A);bindSitAdd(A);bindScope(A);
  A.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>setList(b.dataset.list));
  A.querySelectorAll('[data-gshut]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.gshut;GSHUT[id]=!gShut(id);const L=A.querySelector('#sl53');if(L){L.innerHTML=asideList();bindAside(A)}else render()});
  A.querySelectorAll('[data-sitf]').forEach(b=>b.onclick=()=>{SITF=SITF===b.dataset.sitf?null:b.dataset.sitf;render();const ss=ovData().d.situations.filter(x=>SITF&&sitF(x));focusSits(ss.length?ss:null)});
  A.querySelectorAll('[data-clearf]').forEach(b=>b.onclick=()=>{SITF=null;SITST='';OVCELL=null;lightPieces(null);render()});
  A.querySelectorAll('[data-qmenu]').forEach(b=>b.onclick=e=>{e.stopPropagation();QMENU=!QMENU;render();if(QMENU)setTimeout(()=>{const off=ev=>{if(!(ev.target.closest&&ev.target.closest('.pm54'))){QMENU=false;document.removeEventListener('click',off);render()}};document.addEventListener('click',off)},0)});
  A.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>goView(b.dataset.view));
  A.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{QMENU=false;applyQuick(b.dataset.quick)});
  A.querySelectorAll('[data-fixex]').forEach(b=>b.onclick=()=>fixExposed());
  A.querySelectorAll('[data-revealx]').forEach(b=>b.onclick=()=>{try{localStorage.setItem('v44-reveal-'+(BASE.key||''),(BASE.answers||{}).at)}catch(x){}render()});
  A.querySelectorAll('[data-applycards]').forEach(b=>b.onclick=()=>applyCards());
  A.querySelectorAll('[data-retake]').forEach(b=>b.onclick=()=>{CARDS=null;HOST.retake()});
  A.querySelectorAll('[data-fric]').forEach(b=>b.onclick=()=>{FRICOPEN=!FRICOPEN;render()});
  A.querySelectorAll('[data-cutfric]').forEach(b=>b.onclick=()=>cutFriction());
  A.querySelectorAll('[data-unpreset]').forEach(b=>b.onclick=()=>{const id=b.dataset.unpreset, rules=draftRules().filter(r=>r.preset!==id), ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];
    PENDING={what:'Taking the preset out of the draft…'};busy();head();HOST.draft({ups,rules})});
  bindCalls(A);
  const q=A.querySelector('#sq53'); if(q){q.oninput=()=>{SITQ=q.value;const L=A.querySelector('#sl53');if(L){L.innerHTML=asideList();bindOv(L);bindCalls(L);bindSitAdd(L);bindRows(A)}}}
  A.querySelectorAll('[data-sitrow]').forEach(r=>{const s=ovData().d.situations.find(x=>x.id===r.dataset.sitrow);r.onmouseenter=()=>focusSits(s?[s]:null);r.onmouseleave=sitLit})}
function bindCalls(root){root.querySelectorAll('[data-call]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation&&e.stopPropagation();const i=b.dataset.call.lastIndexOf(':');setCall(b.dataset.call.slice(0,i),b.dataset.call.slice(i+1))})}
