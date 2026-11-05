// ---- the plan tray
function drawPlan(){
  const el=$('v44plan');
  if(!plan.length||(typeof HOST!=='undefined'&&canDraft())){el.hidden=true;return}
  const txt=()=>[`Please add these to my harness (on ${CORES[core]}):`,...plan.map(id=>{const t=find(id);return `- ${t.name} (${t.slot.name}): ${t.change?t.change.does:t.what} ${t.change?'Files: '+t.change.files.join(', ')+'.':''} On ${CORES[core]}: ${rtOf(t)[0]}.`}),"Show me each change for approval before writing it."].join("\n");
  const tot=(()=>{const ids=new Set(plan);const cats=H.trustx.map(c=>{const w=c.pieces.reduce((a,p)=>a+p.w,0);return Math.round(100*(w?c.pieces.reduce((a,p)=>a+p.w*(ids.has(p.id)?1:p.val),0)/w:0))});return Math.round(cats.reduce((a,b)=>a+b,0)/Math.max(1,cats.length))})();
  el.hidden=false;
  el.innerHTML=`<div class="ph"><b>Your plan</b><span>${plan.length} change${plan.length>1?'s':''} · backed trust ${H.backed}% → <b class="gain">${tot}%</b></span><span style="flex:1"></span><button data-copy="1" class="primary">Copy as a request for Claude</button><button data-clear="1">Clear</button></div>
    <div class="pl">${plan.map(id=>{const t=find(id);return `<div><b>${esc(t.name)}</b><span>${esc(t.change?t.change.does:t.what)}</span><a data-rm="${id}" aria-label="Remove">×</a></div>`}).join('')}</div><pre id="v44txt" hidden></pre>`;
  el.querySelector('[data-copy]').onclick=()=>{const t=txt(), pre=$('v44txt');
    const done=()=>{el.querySelector('[data-copy]').textContent='Copied';setTimeout(()=>drawPlan(),1400)};
    try{navigator.clipboard.writeText(t).then(done).catch(()=>{pre.hidden=false;pre.textContent=t})}catch(e){pre.hidden=false;pre.textContent=t}};
  el.querySelector('[data-clear]').onclick=()=>{plan.length=0;render()};
  el.querySelectorAll('[data-rm]').forEach(a=>a.onclick=()=>{plan.splice(plan.indexOf(a.dataset.rm),1);render()});
}

function head(){
  // in VS Code, HOST picks harnesses; in the sketch, the board does it itself
  const hosted=typeof HOST!=='undefined', prof=BASE.profile;
  const pkgs=[...new Set(BASE.slots.flatMap(s=>s.types.flatMap(t=>[...(t.inst||[]),...(t.extra||[])].map(x=>x.pkg).filter(Boolean))))].filter(p=>p in pkgOn||true);
  const ib=(attr,ic,label,pressed)=>`<button class="ib48" ${attr} title="${esc(label)}" aria-label="${esc(label)}"${pressed!=null?` aria-pressed="${pressed}"`:''}>${icon(ic,16)}</button>`;
  const bases=BASE.bases||Object.entries(CORES).map(([id,name])=>({id,name,core:id})), rid=(PENDING&&PENDING.runtime)||(BASE.runtime||{}).id||core;
  const addMenu=()=>{const av=BASE.available||[], tried=BASE.tried||[], q=addQ.trim().toLowerCase();
    const kindOf=a=>a.kind==='plugin'?`Claude Code plugin · ${a.market}`:a.kind==='framework'?'Framework':'Skills';
    const list=av.filter(a=>!pkgs.includes(a.id)&&!tried.includes(a.id)&&(!q||(a.name+' '+(a.about||'')+' '+(a.parts||[]).join(' ')).toLowerCase().includes(q)));
    const rows=list.map(a=>`<button class="ar48" data-add="${esc(a.id)}"><span class="t"><b>${esc(a.name)}</b><small>${esc(kindOf(a))}</small></span>${a.about?`<span class="d">${esc(a.about)}</span>`:''}<span class="p">Adds ${esc((a.parts||[]).join(', '))}${(a.runs_on||[]).length===1&&a.runs_on[0]==='claude'?' · loads in Claude Code':''}</span></button>`).join('');
    return `<div class="am48" role="dialog" aria-label="Add a package">
      <div class="ph48"><b>Try a package</b><button class="ib48 x" data-addp="1" aria-label="Close">${icon('X',14)}</button></div>
      <p>Free Rein installs it on a copy of this folder, the way it really installs, and reads it again. Nothing here changes.</p>
      <label class="se48">${icon('Search',14)}<input id="aq48" type="search" placeholder="Search ${av.length} packages" value="${esc(addQ)}" autocomplete="off"></label>
      <div class="al48">${rows||'<span class="dimk">No package matches.</span>'}</div></div>`};
  const lens=BASE.lens||{};
  // the harness, as a sentence you can edit
  const idLine=()=>{const baseName=prof?BASE.name.replace(/, out of the box$/,''):BASE.new?BASE.new.name:((bases.find(b=>b.id===rid)||{}).name||rid);
    const lensOn=!!(lens.runtime&&lens.home);
    // the top bar: what you're looking at (one button: the folder, its program, model and layers), the three views, what
    // isn't live; on the right the moves and the board's own tools. The side panel's switch is on the divider beside it
    return `<div class="id49 tb59">
      ${ctxBtn()}
      ${typeof viewSwitch==='function'?viewSwitch():''}
      ${lensCtl()}
      ${COMPACT?`<span class="g59 cz81 tb81" role="group" aria-label="Size">${[['full','Circle','The full circle'],['mini','PanelTop','The small circle']].map(([k,ic,t])=>`<button data-csize="${k}" aria-pressed="${CSIZE===k}" title="${t}" aria-label="${t}">${icon(ic,13)}</button>`).join('')}<button data-openfull="board" title="Open your harness full size, with every section around the circle" aria-label="Expand">${icon('Maximize2',13)}</button></span>`:''}
      <span class="fl59"></span>
      ${READING?'':PENDING?`<span class="nt48 pend fp81" role="status">${icon('LoaderCircle',13)} ${esc(PENDING.what)}</span>`:''}
      ${(n=>`<span class="g59 bl75"><button class="ib48" data-moves="1" aria-pressed="${MOVESOPEN}" title="${n?`${n} thing${n===1?'':'s'} to do next`:'Nothing to do next'}" aria-label="Moves: ${n}">${icon('Bell',15)}${n?`<i class="ct75">${n}</i>`:''}</button></span>`)(movesAll().length)}
      ${moreBtn()}
</div>`};
  $('v44head').innerHTML=`<div class="bar48 hv49">${idLine()}
      ${showAdd?addMenu():''}</div>`;
  const q=s=>document.querySelectorAll('#v44head '+s), one=s=>document.querySelector('#v44head '+s);
  q('[data-pick]').forEach(b=>b.onclick=()=>HOST.pick());
  bindTopBar(q);
  q('[data-moves]').forEach(b=>b.onclick=()=>{MOVESOPEN=!MOVESOPEN;if(MOVESOPEN){INSTSEL=null;FLOWSEL=null;if(typeof showInsp==='function')showInsp()}render()});
  q('[data-bview]').forEach(b=>b.onclick=()=>setBView(b.dataset.bview));
  bindStack(q);
  q('[data-tl]').forEach(b=>b.onchange=()=>setTL(b.dataset.tl,b.checked));
  q('[data-vsolo]').forEach(b=>b.onchange=()=>{setSolo(!b.checked);head()});
  q('[data-vfit]').forEach(b=>b.onchange=()=>{fit=b.checked;head();layoutFit()});
  q('[data-hp]').forEach(b=>b.onclick=()=>{const s=one('#h48');if(s&&s.showPicker)s.showPicker();else if(s)s.focus()});
  const h48=one('#h48'); if(h48) h48.onchange=e=>{BASE=D.harnesses.find(h=>h.key===e.target.value);mode="all";sel=null;selSet=null;plan.length=0;render()};
  q('[data-undomove]').forEach(b=>b.onclick=()=>undoMove(b.dataset.undomove));
  q('[data-openfull]').forEach(b=>b.onclick=()=>typeof HOST!=='undefined'&&HOST.openFull&&HOST.openFull(b.dataset.openfull));
  q('.tb81 [data-csize]').forEach(b=>b.onclick=()=>setCSize(b.dataset.csize));
  q('[data-diffopen]').forEach(b=>b.onclick=()=>{const o=!DIFFOPEN;closePops();DIFFOPEN=o;head()});
  q('[data-undiff]').forEach(b=>b.onclick=e=>{e.stopPropagation();const v=b.dataset.undiff, k=v.split(':')[0], id=v.slice(k.length+1), dr=BASE.draft||{}, ups=dr.ups||[], rules=dr.rules||[];
    PENDING={what:'Taking it out of the draft…'};busy();head();
    if(k==='rule')HOST.draft({ups,rules:rules.filter(r=>r.sit!==id)});else if(k==='up')HOST.draft({ups:ups.filter(u=>u!==id),rules});else HOST.tryPkgs((BASE.tried||[]).filter(p=>p!==id))});
  q('.st60 [data-view]').forEach(b=>b.onclick=()=>goView(b.dataset.view));
  q('[data-backreal]').forEach(b=>b.onclick=()=>{closePops();const rt=lensMoves().some(m=>m.k==='rt');for(const k in MWHATIF)MWHATIF[k]=null;for(const k in MODEPICK)delete MODEPICK[k];if(BASE.base_on===false)HOST.base(true);Object.keys(pkgOn).forEach(p=>{if(pkgOn[p]===false)pkgOn[p]=true});YOURS=true;HOMEON=true;mode='all';DIFF=null;if(rt)undoMove('rt');else{render();layoutFit()}});
  const wait=w=>{PENDING={what:w};head();busy()};
  q('[data-discard]').forEach(b=>b.onclick=()=>{wait('Discarding the draft…');HOST.discard()});
  q('[data-savedraft]').forEach(b=>b.onclick=()=>HOST.saveDraft());
  q('[data-apply]').forEach(b=>b.onclick=()=>HOST.apply());
  q('[data-addp]').forEach(b=>b.onclick=e=>{e.stopPropagation();showAdd=!showAdd;head();const i=one('#aq48');if(i)i.focus()});
  q('[data-add]').forEach(b=>b.onclick=()=>{showAdd=false;addQ='';PREVSNAP={s:snap(),label:`Trying ${b.dataset.add}`};PENDING={what:`Installing ${b.dataset.add} on a copy and reading it again…`};head();busy();HOST.tryPkgs([...(BASE.tried||[]),b.dataset.add])});
  const aq=one('#aq48'); if(aq){aq.oninput=e=>{addQ=e.target.value;const pos=e.target.selectionStart;head();const i=one('#aq48');if(i){i.focus();i.setSelectionRange(pos,pos)}};aq.onkeydown=e=>{if(e.key==='Escape'){showAdd=false;head()}}}
  const am=one('.am48'); if(am){am.onclick=e=>e.stopPropagation();
    setTimeout(()=>{const off=e=>{if(!am.contains(e.target)){showAdd=false;document.removeEventListener('click',off);head()}};document.addEventListener('click',off)},0)}
  q('[data-topic]').forEach(b=>b.onclick=()=>{const k=b.dataset.topic;closePops();if(leftOpen&&topic===k){leftOpen=false;topic=null}else{leftOpen=true;topic=k}render()});
  drawDivider();
}

window.__v44redraw=()=>layoutFit();
// the harness at one layer: what the runtime ships, plus packages, plus yours (the data's layers)
