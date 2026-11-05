// ---- trust and friction, as situations (oversight.ts): specific things the agent does, what's at stake,
// what happens under this harness's rules, what decides it (a piece on the board), and whether that's right.
// Everyday work that asks you is babysitting; high stakes that ask you is good friction; high stakes that
// nothing stops is exposed. The board reads for it with the "Trust & friction" lens.
let BLENS='oversight';
let OVM=(()=>{try{return localStorage.getItem('v44-ovm')||''}catch(x){return ''}})();
let OVF=(()=>{try{return localStorage.getItem('v44-ovf')||'all'}catch(x){return 'all'}})();
let OVCELL=null, selSit=null, OVMORE=false;
const setOVM=k=>{OVM=k;try{localStorage.setItem('v44-ovm',k)}catch(x){}render()};
const setOVF=k=>{OVF=k;OVCELL=null;try{localStorage.setItem('v44-ovf',k)}catch(x){}render()};
const OUTN={ahead:'Goes ahead',classifier:'Claude Code decides',asks:'Asks you',depends:'A hook decides',held:'Held'};
const OUTD={ahead:'a rule of yours lets it, or nothing is asked',classifier:'no rule of yours covers it, so Claude Code\'s own safety check decides',asks:'it stops and waits for you',depends:'a hook runs first and may refuse it (Free Rein reads the hook, it doesn\'t run it)',held:'a rule or a hook refuses it'};
const VERN={ok:'Runs on its own',babysitting:'Babysitting',blocked:'Blocked',exposed:'Exposed',classifier:'Claude Code decides',good:'Good friction',held:'Held',depends:'Depends on a hook'};
const VERD={ok:'Everyday work that goes ahead: as it should.',babysitting:'Everyday work that stops for you: bad friction. A rule could decide it.',blocked:'Everyday work it\'s refused: friction that stops the work.',depends:'Everyday work a hook may refuse. Free Rein reads the hook\'s script but doesn\'t run it; the dry run, with hooks included, shows what it does.',
  exposed:'High stakes, and nothing stops it.',classifier:'High stakes, and no rule of yours covers it: Claude Code\'s own safety check decides (auto mode). It\'s the vendor\'s judgement, not something you set or can see.',good:'High stakes, and it asks you: good friction.',held:'High stakes, and something refuses it: trust you can lean on.'};
const JOBN={lets:'lets it act',refuses:'refuses',asks:'asks you',checks:'checks the result',records:'keeps a record'};
const JOBIC={lets:'Play',refuses:'ShieldX',asks:'Hand',checks:'ListChecks',records:'ScrollText'};
const STAKEIC={everyday:'Wrench',undo:'Undo2',outward:'Send',knowledge:'BrainCircuit',safeguards:'ShieldCheck',secrets:'KeyRound',accounts:'Mail'};
let OVC={b:null,k:'',v:null};
function ovData(){const o=BASE.oversight||{}, bm=o.by_mode||{}, sm=(o.set_mode||{}).mode||'auto', m=bm[OVM]?OVM:bm[sm]?sm:'auto', live=bm[m]||null;
  // a preview without some layers reads the situations that layer has: board.ts measured each layer with only its files
  const ls=LAYER!=='yours'&&BASE.layers&&BASE.layers[LAYER]&&BASE.layers[LAYER].situations, lm=ls&&(ls[m]||ls.auto);
  if(!live||!lm) return {modes:o.modes||[],m,d:live,set:o.set_mode||null};
  const k=LAYER+'|'+m; if(OVC.b===BASE&&OVC.k===k) return OVC.v;
  const {by,...rest}=lm;
  const d={...live, ...rest, layer:LAYER, situations:live.situations.filter(s=>by[s.id]).map(s=>({...s,...by[s.id]}))};
  const v={modes:o.modes||[],m,d,set:o.set_mode||null}; OVC={b:BASE,k,v}; return v}
// the mode as a small control: the mode it's read in, and whether that's this harness's own setting or a what-if
function modeCtl(cls){const {modes,m,set}=ovData(); if(modes.length<2) return '';
  const own=set?set.mode:'auto', why=set&&set.set?`your setting: defaultMode ${set.value}${set.modelled?'':' (read as Manual)'}`:'Claude Code\'s default';
  return `<span class="mc65 ${cls||''}" title="Claude Code's permission mode: where no rule of yours covers an action, Auto lets its own safety check decide; Manual asks you. ${esc(why)}.">
    <span class="sg48">${modes.map(x=>`<button data-ovm="${x.id}" aria-pressed="${x.id===m}">${esc(x.name.replace(' mode',''))}</button>`).join('')}</span>
    <small>${m===own?`It starts in ${own==='auto'?'Auto':'Manual'}${set&&set.set?' (your setting)':' (Claude Code\'s default)'}.`:`What if it ran in ${m==='auto'?'Auto':'Manual'}? It starts in ${own==='auto'?'Auto':'Manual'}.`}</small></span>`}
const ovOK=()=>!!(ovData().d&&ovData().d.situations);
// what a draft or a variation changed: each situation's verdict before
function ovBefore(){const r=BASE.draft&&BASE.draft.reality;if(!r||!r.ov)return null;return r.ov[ovData().m]||r.ov.auto||null}
const ovFilter=s=>OVCELL?(s.outcome===OVCELL.o&&((OVCELL.r==='high')===(s.stakes!=='everyday'))):OVF==='trust'?s.stakes!=='everyday':OVF==='friction'?s.outcome==='asks'||s.verdict==='blocked':true;
function ovModes(){const {modes,m}=ovData(); if(modes.length<2) return '';
  const cur=modes.find(x=>x.id===m)||modes[0];
  return `<div class="om50"><span class="sg48">${modes.map(x=>`<button data-ovm="${x.id}" aria-pressed="${x.id===m}">${esc(x.name)}</button>`).join('')}</span><small>${esc(cur.note)}</small></div>`}
// the grid: everyday or high stakes, by what happens. Every cell is a verdict; a click filters the list
function ovGrid(compact){const {d}=ovData(), G=d.grid||{}, cols=['ahead','classifier','asks','depends','held'].filter(o=>o==='depends'?Object.values(G).some(r=>r.depends):o!=='classifier'||ovData().m==='auto'||Object.values(G).some(r=>r.classifier));
  const VC={everyday:{ahead:'ok',classifier:'ok',asks:'babysitting',held:'blocked',depends:'depends'},high:{ahead:'exposed',classifier:'classifier',asks:'good',depends:'depends',held:'held'}};
  return `<div class="gd51${compact?' c':''}" style="--cols:${cols.length}" role="table" aria-label="Situations by stakes and what happens">
    <span></span>${cols.map(o=>`<em role="columnheader" title="${esc(OUTD[o])}">${OUTN[o]}</em>`).join('')}
    ${['high','everyday'].map(r=>`<em class="rh" role="rowheader">${r==='high'?'High stakes':'Everyday'}</em>${cols.map(o=>{const c=(G[r]||{})[o], v=VC[r][o], on=OVCELL&&OVCELL.r===r&&OVCELL.o===o;
      return `<button class="gc ${v}${c?'':' z'}${on?' on':''}" data-cell="${r}:${o}" title="${esc(VERD[v])}" ${c?'':'disabled'}><b>${c?c.situations:0}</b><span>${esc(VERN[v])}</span>${!compact&&c&&c.actions?`<small>${c.actions.toLocaleString()} real actions</small>`:''}</button>`}).join('')}`).join('')}</div>`}
function ovHistory(){const h=(ovData().d||{}).history; if(!h) return '';
  if(!h.sessions) return `<p class="hs51 mute">${icon('History',13)} No past sessions here yet: once the agent has worked in this folder, Free Rein counts what it actually did (from Claude Code's transcripts on this machine).</p>`;
  return `<p class="hs51">${icon('History',13)} In the last ${h.sessions} session${h.sessions===1?'':'s'} here the agent took <b>${h.actions.toLocaleString()}</b> actions. Under these rules, <b class="${h.asks?'ak':''}">${h.asks.toLocaleString()}</b> would ask you${h.babysitting?`, <b class="bb">${h.babysitting.toLocaleString()}</b> of them everyday work`:''}; <b class="${h.exposed?'ex':''}">${h.exposed.toLocaleString()}</b> high-stakes went ahead or to Claude Code.</p>`}
const ovPill=s=>`<span class="vp51 ${s.verdict}" title="${esc(VERD[s.verdict])}">${esc(VERN[s.verdict])}</span>`;
const ovOut=s=>`<span class="op51 ${s.outcome}">${esc(OUTN[s.outcome])}</span>`;
function ovBy(s){const ps=(s.by||[]).filter(b=>b.piece), rt=(s.by||[]).find(b=>!b.piece);
  return ps.length?ps.map(b=>`<button class="pc51 ${b.job}" data-goB="${b.piece}" data-hk="${b.piece}" title="${esc(b.what)}">${icon(JOBIC[b.job]||'Circle',11)} ${esc((find(b.piece)||{}).name||b.piece)}</button>`).join('')
    :`<span class="rt51" title="${esc(rt?rt.what:'')}">${icon('Package',11)} ${esc((BASE.runtime||{}).name||'the runtime')}'s default</span>`}
function ovFix(s,full){const f=s.fix; if(!f) return ''; const hosted=typeof HOST!=='undefined', dUps=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];
  const r=f.rule?`<code class="${f.how}">${f.how==='remove'?'remove':f.how} ${esc(f.rule)}</code>`:'';
  const p=f.piece?`<button class="pl50b" data-goB="${f.piece}" data-hk="${f.piece}">${esc(f.piece_name||f.piece)}</button>${hosted&&canDraft()?`<button class="b50 sm" data-fdraft="${f.piece}">${dUps.includes(f.piece)?'✓ In the draft':'Add to draft'}</button>`:''}`:'';
  return `<span class="fx51">${full?`<span class="w">To ${esc(f.why)}:</span>`:''}${r}${r&&p?'<i>or</i>':''}${p}${full&&f.rule&&hosted?`<button class="b50 sm" data-copy="${esc(f.rule)}">Copy the rule</button>`:''}</span>`}
function ovRow(s,bf){const was=bf&&bf[s.id]&&bf[s.id]!==s.verdict?bf[s.id]:null;
  return `<details class="sr51 ${s.verdict}${selSit===s.id?' on':''}" data-sit="${s.id}"><summary>
    <span class="w">${(s.sources||[]).includes('yours')?'<i class="yo">yours</i>':''}<b>${esc(s.what)}</b>${s.target&&s.what.indexOf(s.target)<0?` <code>${esc(s.target)}</code>`:''}</span>
    <span class="n">${s.count?`<b>×${s.count.toLocaleString()}</b>`:''}<small>${s.sources.map(x=>({rule:'your rule',checklist:'checklist',history:'did it',yours:'you added it'})[x]).join(' · ')}</small></span>
    ${ovOut(s)}<span class="by">${ovBy(s)}</span><span class="v">${was?`<s class="vp51 ${was}">${esc(VERN[was])}</s>`:''}${ovPill(s)}${callSeg(s)}</span></summary>
    <div class="dt51"><ul>${(s.by||[]).map(b=>`<li>${esc(b.what)}${b.path?` <a data-open="${esc(b.path)}" data-lines="${b.line||''}">${esc(b.path.split('/').slice(-2).join('/'))}${b.line?':'+b.line:''}</a>`:''}${b.source?` <span class="mute">(${esc(b.source)})</span>`:''}${b.believed?' <span class="mute">believed</span>':''}</li>`).join('')}</ul>
      ${s.examples&&s.examples.length?`<p class="ex">What it ran here: ${s.examples.map(e=>`<code>${esc(e.length>90?e.slice(0,90)+'…':e)}</code>`).join(' ')}</p>`:''}
      ${s.fix?`<div class="fr51">${ovFix(s,true)}</div>`:''}</div></details>`}
// the list, grouped by what's at stake; high stakes first. Everyday work shows what matters, the rest folds
function ovList(){const {d}=ovData(), bf=ovBefore(), rows=d.situations.filter(ovFilter);
  if(!rows.length) return `<section class="cd50"><p class="mute">Nothing here${OVCELL?' in that cell':OVF==='friction'?': nothing asks you':''}.</p></section>`;
  const order=[...d.stakes.filter(x=>x.high),...d.stakes.filter(x=>!x.high)];
  return order.map(st=>{let rs=rows.filter(s=>s.stakes===st.id); if(!rs.length) return '';
    const n=rs.length; let more=0;
    if(st.id==='everyday'&&!OVMORE&&!OVCELL&&rs.length>10){const keep=rs.filter(s=>s.verdict!=='ok').concat(rs.filter(s=>s.verdict==='ok').sort((a,b)=>b.count-a.count).slice(0,6));more=rs.length-keep.length;rs=rs.filter(s=>keep.includes(s))}
    const cnt=v=>rs.filter(s=>s.verdict===v).length;
    return `<section class="cd50 sg51"><header><h3>${icon(STAKEIC[st.id]||'Circle',15)} ${esc(st.name)}</h3><p>${esc(st.about)}</p><span class="ct">${n} situation${n===1?'':'s'}</span></header>
      <div class="sh51"><span>What it does</span><span>Seen here</span><span>What happens</span><span>What decides it</span><span>Verdict</span></div>
      ${rs.map(s=>ovRow(s,bf)).join('')}${more?`<button class="lk50 mr51" data-ovmore="1">Show ${more} more everyday situations that go ahead</button>`:''}</section>`}).join('')}
function ovDone(){const D=(ovData().d||{}).done; if(!D) return ''; const hosted=typeof HOST!=='undefined', dUps=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];
  return `<section class="cd50 dn51"><header><h3>${icon('Flag',15)} When it says it's done</h3><span class="vp51 ${D.verdict}">${esc(D.says)}</span></header>
    <p class="mute">What counts as done depends on the task. These are what can check finished work here, and what each one covers.</p>
    <div class="ck51">${D.checks.map(c=>`<button class="${c.state==='yes'?'in':c.state==='partial'?'part':'out'}" data-goB="${c.id}" data-hk="${c.id}"><b>${c.state==='yes'?icon('Check',12):''} ${esc(c.name)}</b><small>${esc(c.covers)}</small></button>`).join('')}</div>
    ${D.fix&&hosted&&canDraft()?`<div class="ac50"><span class="mute">To make it pass the checks before it stops:</span><button class="b50" data-fdraft="${D.fix.piece}">${dUps.includes(D.fix.piece)?'✓ In the draft':'Add '+esc(D.fix.piece_name||'')+' to the draft'}</button></div>`:''}</section>`}
// your trust check answers, against the high-stakes situations of each kind of work
function ovYou(){const K=briefKit(), {d}=ovData(); if(!K.ans) return '';
  const rows=K.lanes.filter(l=>l.id!=='done').map(l=>{const ss=d.situations.filter(s=>s.work===l.id&&s.stakes!=='everyday'), c=v=>ss.filter(s=>s.verdict===v).length;
    if(!ss.length) return '';
    const bar=['held','good','classifier','exposed'].map(v=>c(v)?`<i class="${v}" style="flex:${c(v)}" title="${c(v)} ${esc(VERN[v].toLowerCase())}"></i>`:'').join('');
    return `<div class="yr51"><span class="q">You trust it <b>${esc(K.SCALE[K.ans[l.id]]||'')}</b> to ${esc(l.name.toLowerCase())}.</span><span class="br">${bar}</span>
      <span class="t">${[['held','held'],['good','ask you'],['classifier','left to Claude Code'],['exposed','exposed']].filter(([v])=>c(v)).map(([v,n])=>`${c(v)} ${n}`).join(' · ')} <small>of ${ss.length} high-stakes</small></span></div>`}).join('');
  return rows?`<section class="cd50"><h3>${icon('Scale',15)} Your trust, against this</h3><p class="mute">Each answer from your trust check, beside what happens to that kind of work's high-stakes situations.</p>${rows}</section>`:''}
// the view: what happens, then the list, then done, then your trust
function ovViewHTML(){const K=briefKit(), hosted=typeof HOST!=='undefined', {d}=ovData();
  const n=(d.situations||[]).length, h=d.history;
  return `<header class="vh50"><div><h2>Situations</h2><p>What happens when the agent does each of these things here, what decides it, and whether that's the right call. ${n} situations: from this harness's rules, a checklist of high-stakes cases${h&&h.sessions?', and what the agent actually did in this folder':''}.</p></div>${hosted&&!BASE.profile?`<button class="b50" data-retake="1">${K.ans?'Answer the trust check again':'Take the trust check'}</button>`:''}</header>
    <section class="cd50 tp51"><div class="ctl"><span class="sg48">${[['all','All situations'],['trust','Trust: high stakes'],['friction','Friction: what stops it']].map(([k,l])=>`<button data-ovf="${k}" aria-pressed="${OVF===k&&!OVCELL}">${l}</button>`).join('')}</span>${''}</div>
      ${ovHistory()}${ovGrid(false)}${OVCELL?`<p class="fl51">Showing one cell. <button class="lk50" data-cell="">Show all</button></p>`:''}
      <p class="nt51">${d.note}. Matching is Free Rein's reading of how ${esc((BASE.runtime||{}).name||'the runtime')} decides, not its own.</p></section>
    <div class="ad53">${quickHTML()}</div><div class="ad53">${sitAddHTML()}</div>${ovList()}${ovDone()}${ovYou()}`}
// one situation, in the side panel: lights the pieces that decide it
function sitPane(id){const {d}=ovData(), s=d&&d.situations.find(x=>x.id===id); if(!s) return '';
  const st=d.stakes.find(x=>x.id===s.stakes)||{}, other=(BASE.oversight.by_mode||{})[ovData().m==='auto'?'manual':'auto'], o2=other&&other.situations.find(x=>x.id===id);
  return `<div class="dhead"><span class="crumb2">Trust and friction · ${esc(st.name||'')}</span><a data-closesit="1" aria-label="Close">×</a></div>
    <h3 class="kh50">${icon(STAKEIC[s.stakes]||'Circle',16)} ${esc(s.what)}${rmSit(s)}</h3>${s.target&&s.what.indexOf(s.target)<0?`<code class="tg51">${esc(s.target)}</code>`:''}
    <p class="mute">${esc(st.about||'')}</p>
    <div class="sv51">${ovOut(s)}${ovPill(s)}${callSeg(s)}</div><p>${esc(VERD[s.verdict])}</p>
    ${o2&&o2.outcome!==s.outcome?`<p class="mute">In ${ovData().m==='auto'?'Manual':'Auto'} mode: ${esc(OUTN[o2.outcome].toLowerCase())}, ${esc(VERN[o2.verdict].toLowerCase())}.</p>`:''}
    <section class="rs50"><h4>What decides it</h4><div class="by51">${ovBy(s)}</div><ul class="wy51">${(s.by||[]).map(b=>`<li>${esc(b.what)}${b.path?` <a data-open="${esc(b.path)}" data-lines="${b.line||''}">${esc(b.path.split('/').slice(-2).join('/'))}${b.line?':'+b.line:''}</a>`:''}</li>`).join('')}</ul></section>
    ${s.count?`<section class="rs50"><h4>Here, in past sessions</h4><p>The agent did this <b>${s.count.toLocaleString()}</b> time${s.count===1?'':'s'}.</p>${s.examples.length?`<p class="ex">${s.examples.map(e=>`<code>${esc(e.length>80?e.slice(0,80)+'…':e)}</code>`).join(' ')}</p>`:''}</section>`:''}
    ${s.fix?`<section class="rs50"><h4>What would settle it</h4><div class="fr51">${ovFix(s,true)}</div></section>`:''}
    ${knowsSit(s)}`}
// a piece's part in trust and friction, in its own pane
function pieceOv(t){if(!ovOK()) return ''; const {d}=ovData(), p=(d.pieces||{})[t.id]; if(!p) return '';
  const JT={lets:'Allows without asking',asks:'Asks you before',refuses:'Refuses',checks:'Checks',records:'Keeps a record of'};
  const rows=p.decides.map(x=>({...x,s:d.situations.find(s=>s.id===x.id)})).filter(x=>x.s), by=j=>rows.filter(x=>x.job===j).sort((a,b)=>VRANK[a.s.verdict]-VRANK[b.s.verdict]||b.s.count-a.s.count);
  const line=x=>{const b=(x.s.by||[]).find(b=>b.piece===t.id)||{}, plain=!(x.s.sources||[]).includes('checklist')&&!(x.s.sources||[]).includes('yours');
    return `<button class="px53" data-sitopen="${x.s.id}"><span>${plain?`<code>${esc(x.s.target)}</code>`:esc(x.s.what)}<small>${b.rule?esc(b.rule):''}${b.path?` · ${esc(b.path.split('/').slice(-2).join('/'))}${b.line?':'+b.line:''}`:''}${x.s.count?` · done ${x.s.count.toLocaleString()}× here`:''}</small></span>${ovPill(x.s)}</button>`};
  return `<details open><summary>What it decides</summary>
    ${rows.length?['refuses','asks','lets'].filter(j=>by(j).length).map(j=>`<div class="pg53"><h5>${JT[j]} · ${by(j).length}</h5>${by(j).slice(0,8).map(line).join('')}${by(j).length>8?`<p class="mute">and ${by(j).length-8} more</p>`:''}</div>`).join('')
      :'<p class="dimk">It doesn\'t decide any situation Free Rein read; it works after the fact.</p>'}</details>`}
// the board, read for trust and friction: each piece by its jobs and the verdicts of what it decides
function lensOf(t){if(!TL.sits||!ovOK()) return {cls:'',mark:''}; const p=(ovData().d.pieces||{})[t.id];
  if(!p) return {cls:' lz50',mark:''};
  const vs=p.decides.map(x=>x.verdict), cnt=v=>vs.filter(x=>x===v).length, order=['held','good','ok','depends','classifier','babysitting','blocked','exposed'];
  if(!vs.length) return {cls:'',mark:''};
  const worst=[...vs].sort((a,b)=>VRANK[a]-VRANK[b])[0];
  return {cls:' lj51 w53',style:`--wc:${VCOL[worst]||'#5B606C'}`,mark:`<span class="dc53" title="Decides ${vs.length} situation${vs.length===1?'':'s'}; colour: its worst verdict (see Situations)">${icon('Scale',9)}${vs.length}</span>`,old:`<span class="jb51">${p.jobs.slice(0,3).map(j=>`<i class="${j}" title="${esc(JOBN[j])}">${icon(JOBIC[j],10)}</i>`).join('')}</span>${vs.length?`<span class="vb51" title="${order.filter(cnt).map(v=>cnt(v)+' '+VERN[v].toLowerCase()).join(', ')}">${order.filter(cnt).map(v=>`<i class="${v}" style="flex:${cnt(v)}"></i>`).join('')}</span>`:''}`}}
function openSit(id){if(INSPHIDE)INSPHIDE=false;selSit=selSit===id&&VIEW==='board'?null:id;sel=null;selSet=null;selSlot=null;selLayer=null;leftOpen=false;topic=null;VIEW='board';try{localStorage.setItem('v44-view','board')}catch(x){}render();sitLit()}
// pointing at situations: light the pieces that decide them, and mark the ones that would ("would decide it")
function focusSits(ss){const inv=$('v44inv'); inv&&inv.querySelectorAll&&inv.querySelectorAll('.fx53').forEach(el=>el.classList.remove('fx53'));
  if(!ss||!ss.length){lightPieces(null);return}
  const dec=new Set(ss.flatMap(s=>(s.by||[]).map(b=>b.piece).filter(Boolean))), fix=new Set();
  ss.forEach(s=>{if(!s.fix)return;if(s.fix.piece&&!dec.has(s.fix.piece))fix.add(s.fix.piece);if(s.fix.rule&&!dec.has('permissions'))fix.add('permissions')});
  lightPieces([...dec,...fix]);
  fix.forEach(id=>{const el=inv&&inv.querySelector(`[data-t="${id}"]`);el&&el.classList&&el.classList.add('fx53')})}
const sitLit=()=>{const s=selSit&&VIEW==='board'&&ovOK()&&ovData().d.situations.find(x=>x.id===selSit);focusSits(s?[s]:null)};
function bindOv(root){if(!root||!root.querySelectorAll) return; const {d}=ovData(); if(!d||!d.situations) return;
  const S=id=>d.situations.find(x=>x.id===id);
  root.querySelectorAll('[data-ovm]').forEach(b=>b.onclick=()=>setOVM(b.dataset.ovm));
  root.querySelectorAll('[data-ovf]').forEach(b=>b.onclick=()=>setOVF(b.dataset.ovf));
  root.querySelectorAll('[data-ovmore]').forEach(b=>b.onclick=()=>{OVMORE=true;drawView()});
  root.querySelectorAll('[data-cell]').forEach(b=>{const [r0,o0]=(b.dataset.cell||'').split(':');if(r0){b.onmouseenter=()=>focusSits(d.situations.filter(s=>s.outcome===o0&&((r0==='high')===(s.stakes!=='everyday'))));b.onmouseleave=sitLit}});
  root.querySelectorAll('[data-cell]').forEach(b=>b.onclick=()=>{const [r,o]=(b.dataset.cell||'').split(':');
    const next=!r?null:OVCELL&&OVCELL.r===r&&OVCELL.o===o?null:{r,o}, inInsp=root.closest&&root.closest('#v44drawer');
    if(inInsp){OVCELL=next;selSit=null;render();return}
    OVCELL=next;if(VIEW!=='trust'){VIEW='trust';try{localStorage.setItem('v44-view','trust')}catch(x){}}render()});
  root.querySelectorAll('[data-sit]').forEach(el=>{const s=S(el.dataset.sit), sm=el.querySelector('summary');
    if(sm){sm.onmouseenter=()=>focusSits(s?[s]:null);sm.onmouseleave=sitLit}});
  root.querySelectorAll('[data-sitopen]').forEach(b=>{const s=S(b.dataset.sitopen);
    b.onmouseenter=()=>focusSits(s?[s]:null);b.onmouseleave=sitLit;b.onclick=e=>{e.stopPropagation&&e.stopPropagation();openSit(b.dataset.sitopen)}});
  root.querySelectorAll('[data-hk]').forEach(b=>{b.onmouseenter=()=>lightPieces([b.dataset.hk]);b.onmouseleave=sitLit});
  root.querySelectorAll('[data-closesit]').forEach(a=>a.onclick=()=>{selSit=null;lightPieces(null);render()});
  root.querySelectorAll('[data-open]').forEach(a=>a.onclick=e=>{e.preventDefault&&e.preventDefault();typeof HOST!=='undefined'&&HOST.open(a.dataset.open,a.dataset.lines?[+a.dataset.lines,+a.dataset.lines]:null)});
  root.querySelectorAll('[data-copy]').forEach(b=>b.onclick=e=>{e.preventDefault&&e.preventDefault();typeof HOST!=='undefined'&&HOST.copy(b.dataset.copy)});
  root.querySelectorAll('[data-fdraft]').forEach(b=>b.onclick=e=>{e.preventDefault&&e.preventDefault();const id=b.dataset.fdraft, ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];if(ups.includes(id))return;
    PENDING={what:`Measuring the draft with ${find(id).name}…`};busy();head();HOST.draft({ups:[...ups,id]})});
  root.querySelectorAll('summary [data-goB],summary [data-hk],summary button').forEach(b=>{const f=b.onclick;b.addEventListener&&b.addEventListener('click',e=>e.preventDefault())})}
