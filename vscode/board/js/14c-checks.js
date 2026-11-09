// ---- How Free Rein knows: every check it makes (BASE.checks, from the core's judge/checks.ts), by how it knows, with
// what each found here; and, on a piece or a situation, the check behind it. No model: each finding comes from one of these.
const KINDW={read:['Read','from a file\'s structure: settings, frontmatter, hooks, how files point at each other'],
  matched:['Matched','by a pattern on the wording: a rule said another way is missed, and a pattern can misfire'],
  recorded:['Recorded','from Free Rein\'s record of the runtime: each claim with a source, a date and a status']};
const kindTag=k=>`<i class="kd86 k-${k}" title="${esc((KINDW[k]||[])[1]||'')}">${esc((KINDW[k]||[k])[0])}</i>`;
// the words a rule was recognised by, marked in its text
function markWords(text,words){let h=esc(text); for(const w of [...new Set(words||[])].sort((a,b)=>b.length-a.length)){const e=esc(w); if(e) h=h.split(e).join(`\u0000${e}\u0001`)}
  return h.replace(/\u0000/g,'<mark class="mw86">').replace(/\u0001/g,'</mark>')}
const whereRow=w=>`<div class="wr86">${w.path?`<a data-open="${esc(w.path)}" data-lines="${w.line||''}">${esc(w.file||w.path)}${w.line?':'+w.line:''}</a>`:`<span>${esc(w.file)}</span>`}
  ${w.text?`<q>${markWords(String(w.text).replace(/^[-*]\s*/,'').replace(/\*\*/g,''),w.matched)}</q>`:''}${w.note?`<small>${esc(w.note)}</small>`:''}</div>`;
const VWORD={held:'held',asks:'asks you',good:'asks you',ok:'runs on its own',babysitting:'babysitting',blocked:'blocked',exposed:'exposed',depends:'depends on a hook',classifier:'its own check decides'};

// the checks behind the diagnoses first (rules in your words, risky actions), then the rest
const CKORDER=['prose','situations','lint','loops','pieces','runtime'];
// the page: one fold per check, the ones that found something first; the rest folded together
function checksHTML(){const G=BASE.checks;
  if(!G) return `<p class="mu74">Out of the box, Free Rein reads ${esc((BASE.runtime||{}).name||'the product')}'s record, not your files: every answer has a source, a date and a status.</p>`;
  const item=(g,i)=>{const val=g.id==='situations'?esc(VWORD[i.verdict]||i.verdict||''):i.hits?String(i.hits):'';
    return fold80(`ck:${g.id}:${i.id}`,{name:`${esc(i.name)}${i.looks?`<small>${esc(i.looks)}</small>`:''}`,val,tip:i.looks},
      ()=>`${i.where.length?i.where.map(whereRow).join(''):`<p class="mu74">${i.hits?`${i.hits} here.`:'Nothing here.'}</p>`}
        ${g.id==='pieces'&&i.open?`<button class="lk50" data-go="${esc(i.open)}">Open ${esc(i.name)}</button>`:''}`)};
  const grp=g=>{const on=g.items.filter(i=>i.hits), off=g.items.filter(i=>!i.hits);
    return `<section class="cg86"><p class="lb80">${esc(g.name)} ${kindTag(g.kind)}</p>
      <p class="mu74">${esc(g.about)} <b>${g.id==='situations'?`${g.items.length} played out here.`:`${on.length} of ${g.items.length} found something here.`}</b></p>${on.map(i=>item(g,i)).join('')}
      ${off.length?fold80(`ck:${g.id}:none`,{name:`<span class="dimk">${off.length} that found nothing here</span>`,val:''},()=>off.map(i=>item(g,i)).join('')):''}</section>`};
  return `<p class="mu74">No AI model: everything on the board comes from one of these checks, run on the files on this machine. Each says how it knows.</p>
    <div class="kl86">${Object.keys(KINDW).map(k=>`<p>${kindTag(k)} ${esc(KINDW[k][1])}</p>`).join('')}</div>${CKORDER.map(id=>G.find(g=>g.id===id)).filter(Boolean).concat(G.filter(g=>!CKORDER.includes(g.id))).map(grp).join('')}`}

// on a piece: what it looks for, where it found it, how it knows
function knowsPiece(t){const g=(BASE.checks||[]).find(x=>x.id==='pieces'), i=g&&g.items.find(x=>x.id===t.id); if(!i) return '';
  return `<p class="mu74">${kindTag('read')} Counted from the files' structure, not their wording: a file, a setting or a hook of its kind${i.looks?`, such as ${esc(i.looks.replace(/\.$/,''))}`:''}.</p>
    ${i.where.length?`<p class="lb80">Found in</p>${i.where.map(whereRow).join('')}`:'<p class="mu74">Not found in the files read.</p>'}
    <p class="mu74">How each runtime does it is recorded, with sources (On each runtime).</p><button class="lk50" data-checks="1">Every check Free Rein makes</button>`}
// on a situation: how it was played out
function knowsSit(s){const rt=(BASE.runtime||{}).name||'the runtime', bel=(s.by||[]).some(b=>b.believed);
  return `<section class="rs50"><h4>How Free Rein knows</h4><p class="mu74">${kindTag('read')} Played through your permission rules in the order ${esc(rt)} applies them, and the hooks that would catch <code>${esc(`${s.tool} ${s.target}`.trim())}</code>.${bel?' A hook is read, not run: what its script decides is believed, not known. The dry run can run it on a copy.':''}</p>
    <button class="lk50" data-checks="1">Every check Free Rein makes</button></section>`}

function openChecks(){if(typeof showInsp==='function'&&INSPHIDE) setInsp(false); sel=null;selSet=null;selSlot=null;selSit=null;selStake=null;selLayer=null;MOVESOPEN=false;leftOpen=true;topic='checks';render()}
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-checks]'); if(b){e.preventDefault();closePops();openChecks()}});
function bindChecks(root){
  root.querySelectorAll('[data-fold80]').forEach(b=>b.onclick=()=>{const k=b.dataset.fold80;OPEN80.has(k)?OPEN80.delete(k):OPEN80.add(k);render()});
  root.querySelectorAll('[data-open]').forEach(a=>a.onclick=e=>{e.preventDefault&&e.preventDefault();typeof HOST!=='undefined'&&HOST.open(a.dataset.open,a.dataset.lines?[+a.dataset.lines,+a.dataset.lines]:null)})}

// ---- Scans: every scan of your files, newest first, with what started it and what it found (BASE.scans, kept by
// the extension per folder); and the agent review, which only you start (not built yet)
const clock=at=>{const d=new Date(at), today=new Date().toDateString()===d.toDateString();
  return `${today?'Today':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}, ${d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`};
// what changed, in words: a skill sync is Claude Code's, one file is its name, several are the first and a count
function scanWhat(files){const F=files||[]; if(!F.length) return '';
  const nm=f=>{const p=f.split(/[\\/]/), b=p[p.length-1]; return b==='SKILL.md'&&p.length>1?`the ${p[p.length-2]} skill`:b};
  if(F.every(f=>/[\\/]skills[\\/]synced[\\/]/.test(f))) return 'Claude Code synced your skills';
  const n=[...new Set(F.map(nm))]; return n.length===1?n[0]:`${n[0]} and ${n.length-1} more`}
// what the scan found, against the one before: in words, or nothing
function scanFound(a,b){if(!b) return {txt:'First scan logged',same:false}; const out=[], d=(x,y,one,many)=>{const k=x-y; if(k) out.push(`${Math.abs(k)} ${k>0?'more':'fewer'} ${Math.abs(k)===1?one:many}`)};
  if(a.level!==b.level) out.push(`Level ${b.level} → ${a.level}`); if(a.xp!==b.xp) out.push(`${a.xp>b.xp?'+':''}${a.xp-b.xp} XP`);
  d(a.equipped,b.equipped,'piece in place','pieces in place'); d(a.exposed,b.exposed,'exposed situation','exposed situations');
  return out.length?{txt:out.join(' · '),same:false,up:a.xp>=b.xp}:{txt:'Nothing changed',same:true}}
function scansHTML(){const S=(BASE.scans||[]).filter(s=>s.kind!=='review').slice().reverse(), R=freshOf(), hosted=typeof HOST!=='undefined';
  // the agent's reviews, in the same timeline: when each came back, by what, and what it found
  const RVS=(BASE.scans||[]).filter(s=>s.kind==='review').slice().reverse();
  const rvRow=s=>`<div class="sr86 rv86"><div class="t"><b>${esc(clock(s.at))}</b><span>${esc(s.why)} <i class="kd86 k-agent">Your AI</i></span></div>
    <div class="r up">${s.findings} finding${s.findings===1?'':'s'}${s.placed?` · ${s.placed} sentence${s.placed===1?'':'s'} placed, ${s.agent_rules} rule${s.agent_rules===1?'':'s'}`:''}${s.dropped?` · ${s.dropped} dropped`:''}</div></div>`;
  const took=s=>s.ms<1000?`${s.ms} ms`:`${(s.ms/1000).toFixed(1)} s`;
  const facts=s=>`<div class="fc86">Level ${s.level} · ${s.xp} XP · ${s.equipped} pieces in place · ${s.exposed} exposed · read ${s.files} files in ${took(s)}</div>`;
  const files=F=>(F||[]).length?`<ul class="fl86">${F.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:'';
  const row=(s,i)=>{const f=scanFound(s,S[i+1]), w=scanWhat(s.changed);
    return `<div class="sr86${f.same?' same':''}"><div class="t"><b>${esc(clock(s.at))}</b><span>${esc(s.why)}${w?`: ${esc(w)}`:''}</span></div>
      <div class="r ${f.same?'same':f.up?'up':'dn'}">${esc(f.txt)}</div>
      <details class="dx86"><summary>Details</summary>${facts(s)}${files(s.changed)}</details></div>`};
  // a run of scans that found nothing new folds into one line; open it for the times
  const parts=[]; for(let i=0;i<S.length;){const f=scanFound(S[i],S[i+1]);
    if(!f.same){parts.push(row(S[i],i));i++;continue}
    let j=i; while(j<S.length&&scanFound(S[j],S[j+1]).same) j++;
    if(j-i<3){for(let k=i;k<j;k++) parts.push(row(S[k],k))}
    else parts.push(`<details class="sr86 grp86"><summary><div class="t"><b>${j-i} scans</b><span>${esc(clock(S[j-1].at))} to ${esc(clock(S[i].at).replace(/^Today, /,''))}</span></div><div class="r same">Nothing changed</div></summary>${S.slice(i,j).map((s,k)=>{const w=scanWhat(s.changed);return `<div class="gl86"><b>${esc(clock(s.at))}</b> ${esc(s.why)}${w?`: ${esc(w)}`:''}${(s.changed||[]).length?`<details class="dx86"><summary>Files</summary>${files(s.changed)}</details>`:''}</div>`}).join('')}</details>`);
    i=j}
  return `${scanLive()}<div class="sk86 big"><div class="hd">${freshDot()}<b>Rules scan</b> ${kindTag('read')}<span class="v">${R?esc(agoText(R.at)):''}</span>${hosted&&!READING?'<button class="lk50" data-reread="1">Scan again</button>':''}</div>
      <p>Free Rein's own checks, run on this machine with no AI: it reads your files and applies its rules. It runs by itself when a file it read changes, when you come back to the window, or when you ask. <button class="lk50" data-checks="1">What it checks</button></p></div>
    ${agentRow(true)}
    ${RVS.length?`<p class="lb80">Your agent's reviews <small>newest first</small></p>${RVS.slice(0,10).map(rvRow).join('')}`:''}
    <p class="lb80">Recent scans <small>${S.length?'newest first':''}</small></p>
    ${S.length?parts.join(''):'<p class="mu74">None logged yet. From now on, each scan of your files is logged here. A draft or a what-if is measured on a copy, so it isn\'t a scan.</p>'}
    <p class="mu74">Each scan shows what a new session would load. A session already running loaded its files when it started.</p>`}
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('click',e=>{const t=e.target; if(!t||!t.closest) return;
  if(t.closest('[data-scans]')){e.preventDefault();closePops();if(INSPHIDE)setInsp(false);sel=null;selSet=null;selSlot=null;selSit=null;selStake=null;selLayer=null;MOVESOPEN=false;leftOpen=true;topic='scans';render();return}
  if(t.closest('[data-reread]')&&typeof HOST!=='undefined'){READING=true;HOST.refresh();render()}});

// ---- the agent review, as the board shows it: when it ran and by what, how many findings held up, whether files
// changed since; and a button that asks the extension to start one (it asks you first). BASE.review, from the core
// the agent review is a preview, behind its setting (freeRein.agentReview): off, nothing of it shows
let AGENTREVIEW=false;
function agentRow(big){const hostedOn=typeof HOST!=='undefined'&&!BASE.profile;
  // off: still shown, so both kinds of scan are always in view; one click turns it on (the setting, for you)
  if(!AGENTREVIEW) return `<div class="sk86${big?' big':''} off"><div class="hd"><i class="fd86 no"></i><b>Agent review</b>${big?` <i class="kd86 k-agent">Your AI</i>`:''}<span class="v">Off · a preview</span>${hostedOn?'<button class="lk50" data-reviewon="1">Turn it on</button>':''}</div>
    <p>Your own AI (the agent you already use) reads the files for what rules miss${big?': a rule said another way, files that contradict each other, what a hook\'s script decides, vague skills. Only ever started by you; it asks first, and it can\'t read your sensitive files':''}. Turned on, you start it from here.</p></div>`;
  const RV=BASE.review, hosted=typeof HOST!=='undefined'&&!BASE.profile;
  const btn=hosted?`<button class="lk50" data-review="1">${RV?'Run it again':'Ask your agent'}</button>`:'';
  const st=BASE.reviewing?`Waiting for your agent · asked ${esc(agoText(BASE.reviewing))}`:RV&&RV.at?`${esc(agoText(RV.at))} · ${RV.findings.length} finding${RV.findings.length===1?'':'s'}`:'Not run yet';
  const by=RV?`${esc(RV.agent)}${RV.model?` (${esc(RV.model)}, as it reports)`:''}`:'';
  return `<div class="sk86${big?' big':''}${RV?'':' off'}"><div class="hd"><i class="fd86${RV?' ag':' no'}"></i><b>Agent review</b>${big?` <i class="kd86 k-agent">Your AI</i>`:''}<span class="v">${st}</span>${btn}</div>
    <p>${RV?`By ${by}. ${RV.dropped.length?`${RV.dropped.length} finding${RV.dropped.length===1?'':'s'} dropped (a quote that isn't in the file, or a sensitive file). `:''}${RV.changed_since.length?`<b class="cs">${RV.changed_since.length} file${RV.changed_since.length===1?'':'s'} it cited changed since.</b> `:''}`:''}${big?'Your own AI (the agent you already use) reads the files for what rules miss: a rule said another way, files that contradict each other, what a hook\'s script decides, vague skills. Only ever started by you; it says first that your files go to your model\'s provider, and it can\'t read your sensitive files. Its findings don\'t count toward XP or verdicts.':'Your own AI reads the files for what rules miss. Only ever started by you.'}
      ${big&&RV&&RV.findings.length?` <button class="lk50" data-agentfind="1">See its findings</button>`:''}</p></div>`}
// the findings, on the Free rein view: each with its kind, quote and where; never mixed with what the rules found
const AGK={'paraphrased-rule':'A rule in other words',contradiction:'Files that disagree','hook-behaviour':'What a hook decides','vague-skill':'A vague skill','stale-instruction':'Out of date','unstated-dependency':'Relies on something unsaid',other:'Other'};
function agentFindingsHTML(){const RV=BASE.review; if(!RV||!AGENTREVIEW) return '';
  const q=(f,l,t,p)=>`<div class="aq92"><q>${esc(t)}</q><a data-open="${esc(p||'')}" data-lines="${l}">${esc(f)}:${l}</a></div>`;
  const card=f=>`<div class="af92 s-${f.severity}"><div class="hd"><span class="kd">${esc(AGK[f.kind]||f.kind)}</span><span class="sv">${esc(f.severity)}</span></div>
    <b class="tt">${esc(f.title)}</b>${f.detail?`<p>${esc(f.detail)}</p>`:''}${q(f.file,f.found_line,f.quote,f.path)}${(f.also||[]).map(a=>q(a.file,a.line,a.quote,a.path)).join('')}
    ${f.fix?`<p class="fx">${icon('Wrench',12)} ${esc(f.fix)}</p>`:''}</div>`;
  return `<details class="sec90 fd90 ag92" id="agent92"${RV.findings.length?' open':''}><summary class="sh"><h3>Found by your agent <span class="ct n">${RV.findings.length}</span> <i class="kd86 k-agent">Your AI</i></h3>
    <p>By ${esc(RV.agent)}${RV.model?` (${esc(RV.model)})`:''}, ${esc(agoText(RV.at||new Date().toISOString()))}. Not by a rule: every quote was checked against its file; these don't count toward XP or verdicts.${RV.changed_since.length?` ${RV.changed_since.length} cited file${RV.changed_since.length===1?'':'s'} changed since.`:''}</p><span class="cv">${icon('ChevronDown',14)}</span></summary>
    ${RV.findings.length?`<div class="ag92g">${RV.findings.map(card).join('')}</div>`:'<p class="nt">It found nothing it could quote.</p>'}
    ${RV.dropped.length?`<p class="nt dim">Dropped: ${RV.dropped.map(d=>`${esc(d.title)} (${esc(d.reason)})`).join('; ')}.</p>`:''}
    ${typeof HOST!=='undefined'?'<button class="lk50" data-review="1">Run it again</button>':''}</details>`}
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('click',e=>{const t=e.target; if(!t||!t.closest) return;
  if(t.closest('[data-review]')&&typeof HOST!=='undefined'){e.preventDefault();closePops();HOST.review();return}
  if(t.closest('[data-reviewon]')&&typeof HOST!=='undefined'){e.preventDefault();HOST.enableReview();return}
  if(t.closest('[data-agentfind]')){e.preventDefault();VIEW='board';setBView('free');setTimeout(()=>{const d=document.getElementById('agent92');if(d){d.open=true;d.scrollIntoView&&d.scrollIntoView({behavior:'smooth',block:'start'})}},50)}});
