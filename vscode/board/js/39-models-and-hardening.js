// ---- a collection's items, each hardened its own way (hardening.ts): a row per item, a column per way.
// Each cell: has it, needs it and lacks it (a gap), or doesn't need it. Ways that cover every item at once come first.
const WAYIC={checked:'ScanSearch',limited:'Lock','on-request':'MousePointerClick',guarded:'ShieldCheck',tested:'FlaskConical',watched:'Eye'};
function profileHTML(t){const P=t.profile; if(!P||!P.items) return ''; const S=P.summary, W=P.ways;
  const top=Object.entries(S.gaps||{}).sort((a,b)=>b[1]-a[1]), wn=id=>(W.find(w=>w.id===id)||{}).name||id;
  const all=top.filter(([k,n])=>n===S.n&&(k==='checked'||k==='watched'));
  const rows=[...P.items].sort((a,b)=>b.gaps.length-a.gaps.length||b.issues.length-a.issues.length||a.name.localeCompare(b.name));
  const cell=(i,w)=>{const has=i.has[w.id], need=i.need.includes(w.id)||(w.id==='checked'&&i.need.includes('checked'));
    return has?`<i class="pc77 y" title="${esc(w.name)}: ${esc(has)}">${icon('Check',10)}</i>`:need?`<i class="pc77 g" title="${esc(w.name)}: needed, and missing">${icon('X',10)}</i>`:`<i class="pc77 n" title="${esc(w.name)}: not needed for what it does"></i>`};
  const does=i=>[i.does.writes?'writes files':'',i.does.runs?'runs commands':'',i.does.model_starts?'the model starts it':'you start it',i.does.relied_on?`relied on by ${i.callers.length}`:''].filter(Boolean).join(' · ');
  return `<p class="pf77">${S.ok} of ${S.n} have what they need.${top.length?` The commonest gaps: ${top.map(([k,n])=>`${esc(wn(k))} ${n}`).join(' · ')}.`:''}${S.issues?` ${S.issues} have a problem in the skill itself.`:''}</p>
    ${all.map(([k,n])=>`<div class="op76 spot"><div class="h"><b>${icon(WAYIC[k],13)} One change closes ${n} gaps: ${esc(wn(k))}</b><small>${k==='checked'?'Nothing checks the skills when they change. A hook or CI step that runs a check over them (Free Rein\' lint, or one that validates each SKILL.md) covers every skill at once.':'Nothing records which skills run. A hook on the Skill tool that logs each one covers every skill at once.'}</small></div></div>`).join('')}
    <div class="pg77"><div class="r hd"><span></span>${W.map(w=>`<span title="${esc(w.name)}: ${esc(w.about)}">${icon(WAYIC[w.id],12)}<small>${esc(w.name.replace('Only on request','On request'))}</small></span>`).join('')}</div>
      ${rows.map(i=>`<div class="r${i.gaps.length?'':' ok'}"><span class="nm" title="${esc(does(i))}${i.issues.length?' — '+esc(i.issues.join('; ')):''}"><b>${esc(i.name)}${i.issues.length?` ${icon('TriangleAlert',10)}`:''}</b><small>${esc(does(i))}</small></span>${W.map(w=>cell(i,w)).join('')}</div>`).join('')}</div>
    <p class="lg75"><i class="pc77 y">${icon('Check',9)}</i> has it <i class="pc77 g">${icon('X',9)}</i> needs it, missing <i class="pc77 n"></i> not needed for what it does</p>`}
// the models pane: what the whole harness takes in and gives back; the core model that powers it, which you can
// switch; each agent and the model it runs on; and models added for one job. A switch goes in the draft, measured.
const runOf=m=>m.runs==='local'?['This machine','HardDrive']:m.runs==='either'?['Local or cloud','Shuffle']:m.runs==='cloud'?['Cloud','Cloud']:['Where it runs: not known','CircleHelp'];
const pickOf=target=>{const r=draftRules().find(x=>x.kind==='model'&&x.rule.startsWith(target+'='));return r?r.rule.slice(target.length+1):null};
function setModel(target,val){const M=BASE.models; if(!M||typeof HOST==='undefined'||!canDraft()) return;
  // what's live, not what the draft shows: so choosing it again takes the change out of the draft
  const L=M.live||{current:M.current,agents:Object.fromEntries((M.agents||[]).map(a=>[a.name,a.model]))};
  const live=target==='main'?L.current:L.agents[target.slice(6)];
  const ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], rules=draftRules().filter(r=>!(r.kind==='model'&&r.rule.startsWith(target+'=')));
  if(val!==live) rules.push({kind:'model',rule:`${target}=${val}`,sit:'model:'+target,preset:'model'});
  PENDING={what:`Measuring the harness on ${val}…`};busy();head();HOST.draft({ups,rules})}
function picker(target,cur,withInherit){const M=BASE.models, hosted=typeof HOST!=='undefined'&&canDraft()&&!BASE.profile, d=pickOf(target), v=d||cur;
  const opts=[...(withInherit?[{value:'inherit',name:'The core model'}]:[]),...(M.choices||[]).filter(c=>!withInherit||c.value!=='default')];
  if(!opts.some(o=>o.value===v)) opts.push({value:v,name:v});
  return `<label class="pk75${d?' dr':''}"><span>${d?'In the draft':'Runs on'}</span><select data-modelpick="${esc(target)}" ${hosted?'':'disabled title="Open it in VS Code to switch"'}>${opts.map(o=>`<option value="${esc(o.value)}"${o.value===v?' selected':''}>${esc(o.name)}${o.value!==o.name&&o.value!=='inherit'&&o.value!=='default'?` (${esc(o.value)})`:''}</option>`).join('')}</select></label>`}
function modelCard(m,extra=''){const r=runOf(m);
  return `<div class="mc75${m.known?'':' unk'}"><div class="h"><b>${esc(m.name)}</b><small>${icon(r[1],10)} ${esc(r[0])}</small></div>${extra}
    ${ioRows((side,k)=>m[side]&&m[side][k])}</div>`}
function modGrid(){const M=BASE.models; if(!M) return '';
  const by=id=>M.models.find(m=>m.id===id), core=by(M.core), pdf=M.files&&M.files.pdf, ag=M.agents||[], others=(M.others||[]).map(by).filter(Boolean);
  const srcs=[...new Set(M.models.flatMap(m=>m.source?(Array.isArray(m.source)?m.source:[m.source]):[]))];
  return `<p class="nt75 lead">${icon('Info',12)} What its models do natively: what each one reads and makes with the model itself. Your agent can do more through tools: Claude makes only text, yet it can still make a video by writing the code that renders one.</p>
    <div class="mc75 all"><div class="h"><b>Natively, across all its models</b><small>${M.models.length} model${M.models.length===1?'':'s'}</small></div>${ioRows((side,k)=>M[side][k])}
</div>
    <h5 class="mh75">${icon('Cpu',12)} Core model <small>powers the harness: the agent you talk to</small></h5>
    ${core?modelCard(core,`<p>${pickOf('main')?'Switched in the draft: measured here, nothing written until you apply it.':M.main_set?'Set in your settings.':'Not set here, so Claude Code\'s default runs it.'}</p>${picker('main',M.current,false)}${(M.cores||[]).length>1?`<p class="fl75">${icon('Split',11)} Two models: ${(M.cores||[]).map(id=>{const m=by(id);return m?esc(m.name)+' '+esc((m.used_for.find(u=>u.startsWith('the main model'))||'').replace(/^the main model /,'').replace(/ \(.*$/,'')):''}).join(', ')}</p>`:''}`):`<p class="nt75">Not known.</p>`}
    <h5 class="mh75">${icon('Bot',12)} Agents <small>helpers it hands work to, each on its own model or the core's</small></h5>
    ${ag.length?ag.map(a=>{const m=a.model_id&&by(a.model_id);return `<div class="ag75"><div class="h"><b>${esc(a.name)}</b><small>${a.model==='inherit'?'on the core model':esc(m?m.name:a.model)}</small></div>${a.about?`<p>${esc(a.about)}</p>`:''}${picker('agent:'+a.name,a.model,true)}</div>`}).join(''):`<p class="nt75">${icon('Info',12)} No subagents of your own here.</p>`}
    ${others.length?`<h5 class="mh75">${icon('Puzzle',12)} Added for one job <small>decisions, search, speech, a local model</small></h5>${others.map(m=>modelCard(m,`<p>${esc(m.used_for.join('; '))}</p>`)).join('')}`:''}
    <p class="lg75"><span class="ch75 y">native</span><span class="ch75 n">not native</span><span class="ch75 u">not stated by its maker</span></p>
    ${M.note?`<p class="nt75">${icon('Info',12)} ${esc(M.note)}</p>`:''}
    ${srcs.length?`<details class="ms75"><summary>Sources</summary>${[...srcs,M.choices_from].filter(Boolean).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(String(u).replace(/^https?:\/\//,'').replace(/[#?].*$/,''))}</a>`).join('')}</details>`:''}`}
function bindModels(){}
// every model switcher, wherever it shows (a piece, a group, level and rank): one listener
document.addEventListener&&document.addEventListener('change',e=>{const el=e.target; if(el&&el.matches&&el.matches('[data-modelpick]')) setModel(el.dataset.modelpick,el.value)});
function modelsHTML(){if(!BASE.models) return ''; return `<h3 style="margin-top:18px">Modalities</h3><p class="mute">What its models read and make natively.</p>${modGrid()}`}
// the pieces that own models: Modalities shows the grid; Model routing shows which model does which job
function piecesModels(t){const M=BASE.models; if(!M||!['model-routing','modalities'].includes(t.id)) return '';
  if(t.id==='modalities') return fold('models','What its models read and make',`${INS.filter(([k])=>M.inputs[k].state==='yes').length} in · ${OUTS.filter(([k])=>M.outputs[k].state==='yes').length} out`,modGrid(),true);
  const one=M.models.length===1&&!(M.agents||[]).some(a=>a.model!=='inherit');
  return fold('models','Which model does what',M.models.length,`${one?`<p class="nt75">${icon('Info',12)} One model does every job here. Routing gives each job its own: a fast one to search, a strong one to review.</p>`:''}${modGrid()}`,true)}
// after the survey: the reveal, once, at the top of Situations
// a situation in words: "Edit a skill (ux-review)", not the path it was played out on
function sitPlain(s){const t=s.target||'', m=/\.claude\/skills\/([^/]+)\//.exec(t);
  if(s.tool==='Edit'||s.tool==='Write'){if(m) return `Change the ${m[1]} skill`; const b=t.split('/').pop(); return `Change ${b||t}`}
  if(s.tool==='Bash'){const ws=t.trim().split(/\s+/), keep=[]; for(const w of ws){if(keep.length>=3||/["'`$|<>()\\]/.test(w)||w.length>24) break; keep.push(w)} return `Run ${keep.join(' ')||ws[0]}${keep.length<ws.length?' …':''}`}
  return s.what}
function revealCard(){const a=BASE.answers; if(!a||!a.cards||!ovOK()) return ''; let seenK='v44-reveal-'+(BASE.key||''); try{if(localStorage.getItem(seenK)===a.at) return ''}catch(x){}
  const {d}=ovData(), S=id=>d.situations.find(x=>x.id===id), ahead=Object.entries(a.cards).filter(([id,c])=>c==='let'&&S(id)&&['exposed','classifier'].includes(S(id).verdict)).map(([id])=>S(id)), f=frictionRate(), st=STYLES[a.style];
  return `<div class="rv71"><div class="h">${st?`<b>You're ${esc(st[0])}</b><span>${esc(st[1])}.</span>`:'<b>Your trust check</b>'}<button class="x" data-revealx="1" aria-label="Dismiss">${icon('X',12)}</button></div>
    ${ahead.length?`<p>You said <b>Let it</b> to <b class="ex">${ahead.length} risky thing${ahead.length===1?'':'s'}</b> where nothing of yours would catch a mistake: ${(n=>n===ahead.length?'nothing stops them':n?'nothing stops some, and only Claude Code\'s own check stands in front of the rest':'only Claude Code\'s own check stands in the way')(ahead.filter(x=>x.verdict==='exposed').length)}.</p>
      <ul class="rl71">${ahead.filter((x,i)=>ahead.findIndex(y=>sitPlain(y)===sitPlain(x))===i).slice(0,3).map(x=>`<li><button data-sitopen="${esc(x.id)}" title="${esc(x.target||'')}">${esc(sitPlain(x))}</button></li>`).join('')}</ul>`
      :'<p>Everything you said <b>Let it</b> to, something in your harness backs.</p>'}
    ${f&&f.baby?`<p>And it would ask you about <b class="bb">${f.baby.toLocaleString()}</b> everyday things a session.</p>`:''}<div class="ac"><button class="bt61" data-view="check">See all your answers ${icon('ArrowRight',12)}</button></div></div>`}
function applyCards(){const a=BASE.answers, {d}=ovData(), ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], rules=[...draftRules()];
  Object.entries(a.cards||{}).forEach(([id,c])=>{const s=d.situations.find(x=>x.id===id); if(!s||!s.calls||ownCall(s)===c) return; const r=s.calls[c]; if(!r) return;
    const i=rules.findIndex(x=>x.sit===id); if(i>=0) rules.splice(i,1); rules.push({kind:r.kind,rule:r.rule,sit:id,preset:'survey'})});
  try{localStorage.setItem('v44-reveal-'+(BASE.key||''),a.at)}catch(x){}
  PENDING={what:'Measuring your answers as calls…'};busy();head();HOST.draft({ups,rules})}
