// ---- the shell: a rail of views, the main view, and an inspector beside it
const VIEWS=[['board','Harness','Orbit'],['trust','Situations','ListChecks'],['drafts','Drafts','PencilRuler'],['simulate','Simulate','Play'],['history','History','History']];
let VIEW=(()=>{try{const v=localStorage.getItem('v44-view')||'board';if(v==='friction'){localStorage.setItem('v44-ovf','friction');return 'trust'}return v}catch(x){return 'board'}})();
function goView(k){INSPVIEW=false;if(COMPACT&&k!=='board'&&typeof HOST!=='undefined'&&HOST.openFull){HOST.openFull(k);return}VIEW=k;try{localStorage.setItem('v44-view',k)}catch(x){}render();if(k==='board')layoutFit()}
// the board's three pictures of the same harness: the parts, the loops they make, how work flows between steps
const BVIEWS=[['has','Harness','What it has: the parts, and what holds','Orbit'],['checks','Loops','How it knows it\'s done: it tries, something judges, the judgment comes back','RefreshCw'],['flows','Flows','Who does what, in what order','Route'],['free','Free rein','How much it does on its own, and whether your written rules hold','Gauge']];
// Loops and Flows aren't ready: behind a flag, off. On, they're back as views, with their moves and symptoms (a page
// that sets window.FREE_REIN_FLAGS = {loops: true} before the board loads turns it on, as the tests do)
const FLAG_LOOPS=!!(typeof window!=='undefined'&&window.FREE_REIN_FLAGS&&window.FREE_REIN_FLAGS.loops);
const bviewOn=k=>FLAG_LOOPS||k==='has'||k==='free';
// the moves the board shows: without the flag, none that belong to Loops or Flows
const movesAll=()=>(BASE.moves||[]).filter(m=>FLAG_LOOPS||!['checks','flows'].includes(m.view));
let BVIEW=(()=>{try{const v=localStorage.getItem('v44-bview');return BVIEWS.some(([k])=>k===v)&&bviewOn(v)?v:'has'}catch(x){return 'has'}})();
// a view other than Harness opens with its moves in the side panel; picking a tab there leaves them
let RESTMOVES=true;
function setBView(k){if(!bviewOn(k))k='has';BVIEW=k;RESTMOVES=true;if(k!=='has'&&selLayer==='*')selLayer=null;try{localStorage.setItem('v44-bview',k)}catch(x){}render();if(k==='has')layoutFit()}
// the three views, in the top bar: an icon and a short name each, with a count of what needs fixing in Loops and Flows
const viewsOn=()=>VIEW==='board'&&!COMPACT&&!askFirst();
function viewSwitch(){if(!viewsOn()) return '';
  const n={checks:((BASE.loops||{}).findings||[]).length,flows:((BASE.flows||{}).findings||[]).length};
  // each view's score, in the tab: pieces in place for Harness, the free-rein share for Free rein
  const T=types(), F=typeof frNow==='function'?frNow():BASE.free_rein, sc={has:[`${T.filter(t=>t.stage===2).length}/${T.length}`,'pieces in place'],free:F?[`${F.pct}%`,`does ${F.pct}% of the actions Free Rein tests on its own${F.exposed?`; ${F.exposed} high-stakes with nothing in the way`:''}`]:null};
  return `<span class="g59 vw83" role="tablist" aria-label="Views of the harness">${BVIEWS.filter(([k])=>bviewOn(k)).map(([k,name,tip,ic])=>`<button role="tab" data-bview="${k}" aria-selected="${BVIEW===k}" title="${esc(name)}: ${esc(tip)}">${icon(ic,14)}<span class="nm">${esc(name)}</span>${sc[k]?`<b class="sc83${k==='free'&&F&&F.exposed?' bad':''}" title="${esc(sc[k][1])}">${esc(sc[k][0])}</b>`:''}${n[k]?`<i class="ct83">${n[k]}</i>`:''}</button>`).join('')}</span>`}
// the left rail is gone: Situations, Drafts, Simulate and Settings open from where they belong, and come back with
// "Back to the board" or Esc. The views switch in the top bar; above the board, only a chosen symptom's banner
function drawRail(){const R=$('v44rail'); if(R){R.hidden=true;R.innerHTML=''}
  const S=$('v44vsw'); if(!S) return; const on=viewsOn(), ban=on&&BVIEW==='has'&&typeof symBanner==='function'?symBanner():''; S.hidden=!ban; S.innerHTML=ban; if(!on) return;
  const P=$('v44bview'), F=$('v44boardview'); if(P&&F&&F.classList){const pic=BVIEW!=='has'; P.hidden=!pic; F.classList.toggle('pic70',pic);
    if(pic){P.innerHTML=BVIEW==='checks'?(typeof loopViewHTML==='function'?loopViewHTML():''):BVIEW==='free'?freeViewHTML():(typeof flowViewHTML==='function'?flowViewHTML():'');
      if(BVIEW==='free') bindFree(P); else if(typeof bindBView==='function') bindBView(P)}}}
// any [data-view] goes to that view, wherever it's drawn; Esc comes back to the board
if(typeof document!=='undefined'&&document.addEventListener){document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-view]');if(b&&!b.closest('#v44rail')){e.preventDefault();goView(b.dataset.view)}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&VIEW!=='board'&&!askFirst()&&!(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))){goView('board')}})}
// what every brief-bearing place needs wired: the reins, the next move, topics, pieces, views, the lens
function bindBrief(root){if(!root||!root.querySelectorAll) return; const hosted=typeof HOST!=='undefined', K=briefKit();
  // the trust lanes open Free rein, the view that sums up what it does on its own (the Situations tab has the detail)
  root.querySelectorAll('[data-lane]').forEach(b=>b.onclick=()=>{if(VIEW!=='board'){VIEW='board';try{localStorage.setItem('v44-view','board')}catch(x){}}setBView('free')});
  root.querySelectorAll('[data-nextsee]').forEach(b=>b.onclick=()=>{if(VIEW!=='board')VIEW='board';selectPiece(b.dataset.nextsee)});
  root.querySelectorAll('[data-nextdraft]').forEach(b=>b.onclick=()=>{const id=b.dataset.nextdraft;if(!hosted||K.dUps.includes(id))return;PENDING={what:`Measuring the draft with ${find(id).name}…`};busy();head();HOST.draft({ups:[...K.dUps,id]})});
  root.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{leftOpen=true;topic=b.dataset.topic;sel=null;selSet=null;selSlot=null;render()});
  root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>goView(b.dataset.view));
  root.querySelectorAll('[data-goB]').forEach(b=>b.onclick=()=>{VIEW='board';selectPiece(b.dataset.gob)});
  root.querySelectorAll('[data-undiff]').forEach(b=>b.onclick=()=>{DIFF=null;render()});
  root.querySelectorAll('[data-unlens]').forEach(b=>b.onclick=()=>{PREVSNAP={s:snap(),label:'Back to this folder\'s own runtime'};PENDING={what:'Reading it on this folder\'s runtime…'};busy();head();HOST.lens(null)});
  root.querySelectorAll('[data-sethome]').forEach(b=>b.onclick=()=>{PENDING={what:'Saving this folder\'s runtime…'};busy();head();HOST.home((BASE.lens||{}).runtime)});
  root.querySelectorAll('[data-discard]').forEach(b=>b.onclick=()=>{PENDING={what:'Discarding the draft…'};busy();head();HOST.discard()});
  root.querySelectorAll('[data-savedraft]').forEach(b=>b.onclick=()=>HOST.saveDraft());
  root.querySelectorAll('[data-opendraft]').forEach(b=>b.onclick=()=>HOST.openDraft());
  root.querySelectorAll('[data-opennamed]').forEach(b=>b.onclick=()=>{PENDING={what:`Opening the draft "${b.dataset.opennamed}"…`};busy();head();HOST.openDraftNamed(b.dataset.opennamed)});
  root.querySelectorAll('[data-apply]').forEach(b=>b.onclick=()=>HOST.apply());
  root.querySelectorAll('[data-trustcheck]').forEach(b=>b.onclick=()=>HOST.trustCheck());
  root.querySelectorAll('[data-vsset]').forEach(b=>b.onclick=()=>HOST.settings());
  root.querySelectorAll('.df48 [data-go]').forEach(b=>b.onclick=()=>{VIEW='board';selectPiece(b.dataset.go)});}
// the inspector when nothing is picked: the brief, beside the board
function restHTML(){const K=briefKit(), lens=BASE.lens||{}, bases=BASE.bases||[], nm=id=>(bases.find(b=>b.id===id)||{}).name||id;
  return `<div class="dhead"><span class="crumb2">${esc(BASE.new?'New harness':BASE.name)} · at a glance</span></div>
    ${lens.runtime&&lens.home?`<div class="ln50"><p>${icon('Eye',13)} Viewing as <b>${esc(nm(lens.runtime))}</b>; this folder runs on ${esc(nm(lens.home))}.</p><span><button data-sethome="1">Make it this folder's runtime</button><button data-unlens="1">Back</button></span></div>`:''}
    ${diffChip()}
    <section class="rs50">${K.headline()}</section>
    ${ovOK()?'':`<section class="rs50"><h4>Trust, by kind of work <button class="lk50" data-view="trust">Open Trust ›</button></h4>${K.reins(true)}</section>`}
    <section class="rs50">${K.nextCard()}</section>
    <section class="rs50">${K.facts()}</section>`}
function topicPane(){const NAMES={changes:'What changed',tier:'Level and rank',trust:'Backed trust',found:'Equipped',guards:'Guards that hold',problems:'Weak spots',sets:'Achievements',legend:'How to read it',checks:'How Free Rein checks',scans:'Scans'};
  return `<div class="dhead"><span class="crumb2">${esc(NAMES[topic]||'This harness')}</span><a data-closetopic="1" aria-label="Close">×</a></div>${topicHTML(topic)}`}
