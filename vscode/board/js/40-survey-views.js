// ---- the survey: "Would you let it?"
let CARDS=null, CI=0, CA={};
function pickCards(){const d=ovOK()?ovData().d:null; if(!d) return [];
  const out=[]; d.stakes.forEach(st=>{const xs=d.situations.filter(x=>x.stakes===st.id).sort((a,b)=>(b.count-a.count)||((b.sources||[]).includes('checklist')-(a.sources||[]).includes('checklist')));
    xs.slice(0,st.id==='everyday'?2:2).forEach(x=>out.push(x))});
  return out.slice(0,12)}
const SCENE={everyday:'Ordinary work.',undo:'There\'s no undo for this.',outward:'Other people will see it.',knowledge:'Every later session will rely on it.',safeguards:'These are the rules that stop it.',secrets:'Keys, credentials, private files and personal information.',accounts:'It acts as you, in your own mail, calendar and documents.'};
function checkHTML(){if(!CARDS){CARDS=pickCards();CI=0;CA={}}
  if(!CARDS.length) return `<header class="vh50"><div><h2>Would you let it?</h2><p>Free Rein needs a reading of this harness's rules to deal the cards.</p></div></header><div class="ac50"><button class="b50" data-tqskip="1">Skip for now</button></div>`;
  const done=CI>=CARDS.length, c=CARDS[Math.min(CI,CARDS.length-1)], st=(ovData().d.stakes.find(x=>x.id===c.stakes)||{});
  const dots=CARDS.map((x,i)=>`<i class="${i<CI?'d':''}${i===CI?' on':''}"></i>`).join('');
  return `<div class="sv72"><header><p class="k">THE TRUST CHECK</p><h2>Would you let it?</h2><p>${CARDS.length} moments from ${esc(BASE.name)}. Answer from your gut, before you see the numbers.</p><div class="dots">${dots}</div></header>
    ${done?`<div class="card end"><p class="big">That's all ${CARDS.length}.</p><p>See how your harness compares with what you'd trust it to do.</p>
        <div class="ac"><button class="b50 pri" data-cardsgo="1">Show me</button><button class="b50" data-cardback="1">Back</button></div></div>`
      :`<div class="card s-${c.stakes}"><p class="sk">${icon(STAKEIC[c.stakes]||'Circle',14)} ${esc(st.name||'')}</p>
        <p class="big">The agent wants to <b>${esc(c.what.charAt(0).toLowerCase()+c.what.slice(1))}</b>.</p>${c.target&&c.what.indexOf(c.target)<0?`<code>${esc(c.target)}</code>`:''}
        <p class="sc">${esc(SCENE[c.stakes]||'')}${c.count?` It did this ${c.count.toLocaleString()} times here.`:''}</p>
        <div class="ch">${[['let','Let it','Check',1],['ask','Ask me','Hand',2],['never','Never','Ban',3]].map(([k,n,ic,key])=>`<button class="o ${k}${CA[c.id]===k?' on':''}" data-card="${k}">${icon(ic,18)}<b>${n}</b><small>${key}</small></button>`).join('')}</div>
        <div class="nav">${CI?'<button class="lk50" data-cardback="1">‹ Back</button>':'<span></span>'}<button class="lk50" data-tqskip="1">Skip the check</button></div></div>`}</div>`}
function bindCards(V){const next=k=>{const c=CARDS[CI]; if(!c) return; CA[c.id]=k; CI++; drawView()};
  V.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>next(b.dataset.card));
  V.querySelectorAll('[data-cardback]').forEach(b=>b.onclick=()=>{CI=Math.max(0,CI-1);drawView()});
  V.querySelectorAll('[data-cardsgo]').forEach(b=>b.onclick=()=>{const per={};CARDS.forEach(c=>{const v={let:4,ask:1,never:0}[CA[c.id]];if(v==null)return;(per[c.stakes]=per[c.stakes]||[]).push(v)});
    const stakes=Object.fromEntries(Object.entries(per).map(([k,v])=>[k,Math.round(v.reduce((a,b)=>a+b,0)/v.length)]));
    const legacy={edit:stakes.everyday,commands:stakes.undo,knowledge:stakes.knowledge,unattended:stakes.outward,done:stakes.everyday};
    Object.keys(legacy).forEach(k=>legacy[k]==null&&delete legacy[k]);
    PENDING={what:'Setting your answers beside the evidence…'};busy();head();
    HOST.answers({...legacy,stakes,cards:{...CA},style:styleOf(CA),at:new Date().toISOString()});CARDS=null;ANSWERED=true;LIST='sits';try{localStorage.setItem('v44-list','sits')}catch(x){}goView('board')});
  if(!window.__cardkeys){window.__cardkeys=true;addEventListener('keydown',e=>{if(!CARDS||VIEW!=='trust'||!askFirst()&&!CARDS.length) return; if(e.target&&/input|select|textarea/i.test(e.target.tagName)) return;
    const k={'1':'let','2':'ask','3':'never',ArrowLeft:'let',ArrowDown:'ask',ArrowRight:'never'}[e.key]; if(k&&CI<CARDS.length){e.preventDefault();CA[CARDS[CI].id]=k;CI++;drawView()}})}}
// the views other than the board
// the trust check comes before the numbers, so your answers aren't anchored by them (VS Code keeps them per harness)
let ANSWERED=false;   // the survey just sent: don't ask again while the answers travel
const askFirst=()=>typeof HOST!=='undefined'&&BASE.trustState==='none'&&!BASE.profile&&!ANSWERED;
let TQ={};
// what was applied through Free Rein, under the drafts it came from (History joined Drafts)
function appliedHTML(){const hs=[...(BASE.history||[])].reverse();
  return `<section class="cd50"><h3>Applied</h3>${hs.length?`<div class="ls50">${hs.map(h=>`<div class="row50"><div><b>${esc((h.applied||[]).join(', ')||'applied')}</b><small>${esc(new Date(h.at).toLocaleString())}${h.from?` · from level ${h.from.level} (${h.from.xp} XP)`:''}</small></div></div>`).join('')}</div>`:'<p class="mute">Nothing applied yet. Applying a draft records it here, with where the harness stood before.</p>'}</section>`+
    (DIFF&&!BASE.draft?`<section class="cd50"><h3>Last change this session</h3>${diffHTML(true)}</section>`:'')}
function viewHTML(k){const K=briefKit(), hosted=typeof HOST!=='undefined', head=(t,p,extra='')=>`${askFirst()?'':`<button class="bk70" data-view="board">${icon('ChevronLeft',14)} Back to the board</button>`}<header class="vh50"><div><h2>${t}</h2><p>${p}</p></div>${extra}</header>`;
  if(k==='rules'){const t=RULESOF&&find(RULESOF); return head(t?`What ${esc(t.name)} says`:'What your harness says',"Every rule and sentence, where it's written, and whether anything of yours makes it so. Rules nothing enforces come first.")+rulesTableHTML()}
  if(k==='trust'&&askFirst()) return checkHTML();
  if(k==='trust'&&ovOK()) return ovViewHTML();
  if(k==='trust'){const cats=(BASE.trust&&BASE.trust.categories)||[];
    return head('Trust','How far this harness\'s own safeguards back the agent doing each kind of work without you, on the trust check\'s scale. Your own answers are the pins.',
        hosted&&!BASE.profile?`<button class="b50" data-retake="1">${K.ans?'Answer the trust check again':'Take the trust check'}</button>`:'')+
      `<section class="cd50">${K.headline()}</section><section class="cd50">${K.reins(false)}</section>
      <div class="gr50">${K.lanes.map((l,i)=>{const c=cats[i]||{}, gaps=(c.pieces||[]).filter(p=>p.state!=='yes');
        return `<section class="cd50 kd50"><h3>${esc(l.name)}</h3><p class="q">${esc(l.q)}</p>
          <dl><dt>Backed</dt><dd>${esc(K.band(l.e))} <small>${l.e}%</small></dd><dt>You</dt><dd>${l.m!=null?esc(K.SCALE[K.ans[l.id]]):'<span class="mute">not answered</span>'}</dd></dl>
          ${gaps.length?`<h4>What would back it more</h4><div class="pl50">${gaps.slice(0,6).map(p=>`<button data-goB="${p.id}">${esc(p.name)}</button>`).join('')}</div>`:'<p class="mute">Every piece that backs it is in place.</p>'}</section>`}).join('')}</div>`}
  if(k==='drafts'){const dr=BASE.draft, saved=((BASE.lens||{}).savedList)||[], nmOf=id=>{const t=find(id);return t?t.name:id};
    const cur=dr?`<section class="cd50 dr50"><h3>${icon('PencilRuler',15)} ${BASE.new?'New harness, not created yet':'The open draft'}</h3>
        <div class="it50">${[...(dr.rules||[]).map(r=>`<span class="rl53">${esc({allow:'Let it',ask:'Ask me',deny:'Never',model:'Model'}[r.kind]||r.kind)}: <code>${esc(r.kind==='model'?r.rule.replace('=',' → '):r.rule)}</code></span>`),...(dr.add||[]).map(p=>`<span>+ ${esc(p)}</span>`),...(dr.ups||[]).map(u=>`<span class="${(dr.requested||[]).includes(u)?'rq':''}">${icon('ArrowUp',11)} ${esc(nmOf(u))}${(dr.requested||[]).includes(u)?' <small>by request, not measured</small>':''}</span>`)].join('')}</div>
        ${hosted?`<div class="ac50"><button class="b50 pri" data-apply="1">${BASE.new?'Create the folder…':'Apply…'}</button><button class="b50" data-savedraft="1">Save draft</button><button class="b50" data-discard="1">Discard</button></div>`:''}
        ${diffHTML(true)}</section>`
      :`<section class="cd50 empty50"><h3>No draft open</h3><p>Add a package with <b>+ Package</b> in the Layers tab, or <b>Add to draft</b> in any piece's details. Free Rein measures every change together on a copy; nothing here changes until you apply it.</p></section>`;
    return head('Drafts','What you\'d change, measured before anything is written, and what you applied. Drafts are private: they stay in this editor.')+cur+
      `<section class="cd50"><h3>Saved drafts</h3>${saved.length?`<div class="ls50">${saved.map(d=>`<div class="row50"><div><b>${esc(d.name)}</b><small>${esc(new Date(d.saved).toLocaleString())} · ${esc([...(d.add||[]).map(x=>'+ '+x),...(d.ups||[]).map(x=>'↑ '+nmOf(x)),...((d.rules||[]).length?[`${d.rules.length} call${d.rules.length===1?'':'s'} on situations`]:[]),...(d.runtime?['on '+d.runtime]:[])].join(', ')||'empty')}</small></div>${hosted?`<button class="b50" data-opennamed="${esc(d.name)}">Open</button>`:''}</div>`).join('')}</div>`:'<p class="mute">Nothing saved yet. Save draft keeps the open one under a name.</p>'}</section>`+appliedHTML()}
  if(k==='simulate'){
    const KIND=[['edit','Edit a file','src/app.ts'],['command','Run a command','npm test'],['knowledge','Change what it knows','docs/decisions.md'],['done','Say it\'s done',''],['push','Push','git push']];
    const OUT={blocked:['Blocked','bad'],asks:['Stops for you','warn'],checked:['Checked','ok'],decides:['A classifier decides','mid'],alone:['On its own','mid']};
    const r=SIMRES, rows=SIMSTEPS.map((st,i)=>`<div class="sr50"><select data-simkind="${i}" aria-label="Step ${i+1}">${KIND.map(([v,n])=>`<option value="${v}" ${v===st.kind?'selected':''}>${esc(n)}</option>`).join('')}</select>
        ${st.kind==='done'?'<span class="mute">the agent says the work is finished</span>':`<input data-simtarget="${i}" value="${esc(st.target||'')}" placeholder="${esc((KIND.find(x=>x[0]===st.kind)||[])[2]||'')}" spellcheck="false">`}
        <button class="ib48" data-simrm="${i}" aria-label="Remove step">${icon('X',13)}</button></div>`).join('');
    const res=r?`<section class="cd50"><h3>${icon('Play',14)} What would happen${r.ran_hooks?' <span class="tag50 obs">hooks really ran, on a copy</span>':''}</h3>
        <p class="sm50"><b>${r.summary.alone}</b> of ${r.steps.length} steps go ahead without you · <b>${r.summary.stops}</b> stop${r.summary.stops===1?'s':''} for you${r.summary.blocked?` (${r.summary.blocked} blocked)`:''}</p>
        <ol class="tl50">${r.steps.map(st=>{const o=OUT[st.outcome]||['?',''];
          return `<li class="${o[1]}"><div class="h"><b>${esc(st.label)} ${st.target?`<code>${esc(st.target)}</code>`:''}</b><span class="oc ${o[1]}">${o[0]}</span></div>
            <ul>${st.why.map(w=>`<li>${esc(w.what)}${w.says?`<q>${esc(w.says)}</q>`:''}${w.path?` <a data-open="${esc(w.path)}" data-lines="${w.line||''}">${esc(w.path.split('/').slice(-2).join('/'))}${w.line?':'+w.line:''}</a>`:''}${w.source?` <span class="mute">(${esc(w.source)})</span>`:''}${w.observed?' <span class="obs">observed</span>':''}</li>`).join('')}</ul>
            ${st.missing.length&&st.outcome!=='blocked'?`<div class="ms"><span>To back it without you:</span>${st.missing.map(m=>`<button data-goB="${m.id}">${esc(m.name)}</button>`).join('')}</div>`:''}</li>`}).join('')}</ol></section>`:'';
    return head('Simulate','Play a task through this harness before an agent does it for real: what each step would run into, and why. Free Rein reads the rules; it can also run your hooks on a copy.')+
      `<section class="cd50"><h3>The task, step by step</h3><div class="ss50">${rows}</div>
        <div class="ac50"><button class="b50" data-simadd="1">${icon('Plus',13)} Add a step</button><button class="b50" data-simpre="typical">Typical change</button><button class="b50" data-simpre="risky">Risky change</button></div>
        <label class="ck50"><input type="checkbox" data-simhooks="1" ${SIMHOOKS?'checked':''}> Run the harness's hooks for real, on a copy of this folder (up to 20 seconds each)</label>
        <div class="ac50">${hosted&&!BASE.profile&&!BASE.new?`<button class="b50 pri" data-simrun="1" ${SIMSTEPS.length?'':'disabled'}>${icon('Play',13)} Run the dry run</button>`:'<span class="mute">Dry runs work on a folder, in VS Code.</span>'}${BASE.draft?'<span class="mute">Runs against the folder as it is, not the draft.</span>':''}</div></section>${res}`}
  if(k==='history') return viewHTML('drafts');
  if(k==='settings'){const ms=modesOf(BASE);
    const sw=(attr,v,label,hint)=>`<button class="sw48" ${attr} role="switch" aria-checked="${v}"><span class="tk"><i></i></span><span class="tx"><b>${label}</b>${hint?`<small>${hint}</small>`:''}</span></button>`;
    const seg=(attr,opts,val)=>`<span class="sg48${opts.length>4?' g3':''}">${opts.map(([kk,n])=>`<button ${attr}="${kk}" aria-pressed="${kk===val}">${esc(n)}</button>`).join('')}</span>`;
    return head('Settings','How your harness looks and reads. What counts (runtime, packages, your setup) is in the top bar.',hosted?`<button class="b50" data-vsset="1">${icon('Settings',14)} Free Rein settings in VS Code</button>`:'')+
      `<div class="gr50 two">
      <section class="cd50"><h3>Colours</h3>${seg('data-pal',Object.entries(PALS).map(([kk,pp])=>[kk,pp.name]),PAL)}</section>
      <section class="cd50"><h3>The centre</h3><p class="mute">What sits in the middle of your harness. Jack shows your runtime, with your harness's cables plugged into it; the Sprout is a character whose plant grows with your level.</p>${sw('data-chon="1"',CHAR.on,'Show it in the core','Off: the level number, as before')}
        ${seg('data-chkind',[['jack','Jack'],['sprout','Sprout']],CHAR.kind==='sprout'?'sprout':'jack')}
        ${CHAR.kind==='sprout'?`<label class="chn82"><span>Name</span><input data-chname="1" maxlength="18" value="${esc(CHAR.name)}" placeholder="Sprout"></label>
        ${seg('data-chcol',Object.entries(CHCOL).map(([kk,c])=>[kk,c.name]),CHAR.color)}`:''}</section></div>`}
  return ''}
// the dry run's task, and its last result (from simulate.ts, through VS Code)
let SIMSTEPS=[{kind:'edit',target:'src/app.ts'},{kind:'edit',target:'.env'},{kind:'command',target:'npm test'},{kind:'done',target:''}], SIMRES=null, SIMHOOKS=false;
const SIMPRE={typical:[{kind:'edit',target:'src/app.ts'},{kind:'command',target:'npm test'},{kind:'done',target:''}],
  risky:[{kind:'edit',target:'.env'},{kind:'command',target:'rm -rf build'},{kind:'knowledge',target:'docs/decisions.md'},{kind:'push',target:'git push --force'}]};
function drawView(){const V=$('v44view'), B=$('v44boardview'); if(!V||!B||!B.classList) return;
  if(askFirst()&&VIEW!=='trust'&&VIEW!=='settings') VIEW='trust';
  const board=VIEW==='board'; B.classList.toggle('off50',!board); V.hidden=board; V.classList&&V.classList.toggle('off50',board);
  if(board) return;
  V.innerHTML=viewHTML(VIEW); bindBrief(V); bindOv(V); bindSitAdd(V); bindCalls(V);
  V.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>applyQuick(b.dataset.quick));
  V.querySelectorAll('[data-rulef]').forEach(b=>b.onclick=()=>{RULEF=b.dataset.rulef||null;drawView()});
  V.querySelectorAll('[data-open]').forEach(a=>a.onclick=e=>{e.preventDefault&&e.preventDefault();typeof HOST!=='undefined'&&HOST.open(a.dataset.open,a.dataset.lines?[+a.dataset.lines,+a.dataset.lines]:null)});
  bindCards(V);
  V.querySelectorAll('[data-tqgo]').forEach(b=>b.onclick=()=>{PENDING={what:'Setting your answers beside the evidence…'};busy();head();HOST.answers({...TQ})});
  V.querySelectorAll('[data-tqskip]').forEach(b=>b.onclick=()=>{PENDING={what:'Skipping the trust check…'};busy();head();HOST.skipTrust()});
  V.querySelectorAll('[data-retake]').forEach(b=>b.onclick=()=>{TQ={};HOST.retake()});
  V.querySelectorAll('[data-simkind]').forEach(x=>x.onchange=()=>{const st=SIMSTEPS[+x.dataset.simkind];st.kind=x.value;if(x.value==='done')st.target='';drawView()});
  V.querySelectorAll('[data-simtarget]').forEach(x=>x.oninput=()=>{SIMSTEPS[+x.dataset.simtarget].target=x.value});
  V.querySelectorAll('[data-simrm]').forEach(x=>x.onclick=()=>{SIMSTEPS.splice(+x.dataset.simrm,1);drawView()});
  V.querySelectorAll('[data-simadd]').forEach(x=>x.onclick=()=>{SIMSTEPS.push({kind:'edit',target:''});drawView()});
  V.querySelectorAll('[data-simpre]').forEach(x=>x.onclick=()=>{SIMSTEPS=SIMPRE[x.dataset.simpre].map(o=>({...o}));SIMRES=null;drawView()});
  V.querySelectorAll('[data-simhooks]').forEach(x=>x.onchange=()=>{SIMHOOKS=x.checked});
  V.querySelectorAll('[data-simrun]').forEach(x=>x.onclick=()=>{PENDING={what:SIMHOOKS?'Running the dry run, hooks included, on a copy…':'Running the dry run…'};busy();head();HOST.simulate({steps:SIMSTEPS.filter(s=>s.kind==='done'||s.target),runHooks:SIMHOOKS})});
  V.querySelectorAll('[data-open]').forEach(a=>a.onclick=()=>typeof HOST!=='undefined'&&HOST.open(a.dataset.open,a.dataset.lines?[+a.dataset.lines,+a.dataset.lines]:null));
  V.querySelectorAll('[data-fdraft]').forEach(b=>b.onclick=()=>{const id=b.dataset.fdraft, ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];if(ups.includes(id))return;
    PENDING={what:`Measuring the draft with ${find(id).name}…`};busy();head();HOST.draft({ups:[...ups,id]})});
  const save=p=>{if(typeof HOST!=='undefined')HOST.prefs(p)};
  V.querySelectorAll('[data-cmbt]').forEach(b=>b.onclick=()=>{setCombos(!SHOWC);save({showCombos:SHOWC});setTimeout(render,360)});
  V.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;render()});
  V.querySelectorAll('[data-pal]').forEach(b=>b.onclick=()=>{PAL=b.dataset.pal;applyPal();lastSig=null;render();save({palette:{rarity:'vivid',heat:'warm',calm:'calm'}[PAL]})});
  V.querySelectorAll('[data-chon]').forEach(b=>b.onclick=()=>{setChar({on:!CHAR.on});render()});
  V.querySelectorAll('[data-chkind]').forEach(b=>b.onclick=()=>{setChar({kind:b.dataset.chkind});lastSig=null;render()});
  V.querySelectorAll('[data-chname]').forEach(x=>x.onchange=()=>{setChar({name:x.value.trim().slice(0,18)});render()});
  V.querySelectorAll('[data-chcol]').forEach(b=>b.onclick=()=>{setChar({color:b.dataset.chcol});render()});}
// select a piece from anywhere
function selectPiece(id){PREVSIT=selSit||null;sel=id;selSet=null;selSlot=null;selLayer=null;selSit=null;render()}
// light some pieces: their tiles, their own wires and their sections' conduits; dim everything else
function lightPieces(ids){const inv=$('v44inv'), bv=$('v44boardview');if(!inv||!inv.querySelectorAll)return;
  const all=[...inv.querySelectorAll('[data-t]'),...(bv&&bv.querySelectorAll?bv.querySelectorAll('[data-wt],[data-pipe]'):[])];
  if(!ids){inv.classList.remove('lyf50');bv&&bv.classList&&bv.classList.remove('lyf50w');all.forEach(el=>el.classList.remove('lyon50'));
    const fb=$('v44fit')&&$('v44fit').parentNode; fb&&fb.querySelectorAll&&fb.querySelectorAll('[data-set].lyon50').forEach(el=>el.classList.remove('lyon50'));return}
  const set=new Set(ids), secs=new Set(H.slots.filter(sl=>sl.types.some(t=>set.has(t.id))).map(sl=>sl.id));
  inv.classList.add('lyf50');bv&&bv.classList&&bv.classList.add('lyf50w');
  all.forEach(el=>el.classList.toggle('lyon50',el.dataset.t?set.has(el.dataset.t):el.dataset.wt?set.has(el.dataset.wt):secs.has(el.dataset.pipe)));
  // achievements and weak spots: lit when one of their pieces (or a fix) is lit
  const fb=$('v44fit')&&$('v44fit').parentNode;
  if(fb&&fb.querySelectorAll) fb.querySelectorAll('[data-set]').forEach(el=>{const st=H.sets.find(x=>x.name===el.dataset.set);
    el.classList.toggle('lyon50',!!st&&[...st.ids,...(st.lifts||[])].some(id=>set.has(id)))})}
// the folder as read on its own runtime, kept when you first look at it on another, so the Layers tab can say what the
// other runtime doesn't load (layers it has no place for, pieces it doesn't find). Gone after a reload: then it says less
let HOMESNAP=null;
function keepHome(){const L=BASE.lens||{}; if(L.runtime&&L.home&&L.runtime!==L.home) return;
  HOMESNAP={key:BASE.name, rt:(BASE.runtime||{}).name, m:snap().m, layers:layerList().map(l=>[l.id,l.name])}}
function chooseBase(id){keepHome();const bases=BASE.bases||[], b=bases.find(x=>x.id===id)||{id,core:id}, rid=((BASE.lens||{}).runtime)||(BASE.runtime||{}).id;
  const was=(bases.find(x=>x.id===rid)||{}).name||rid, label=`Runs on ${b.name} instead of ${was}`;
  if(typeof HOST!=='undefined'){PREVSNAP={s:snap(),label};PENDING={runtime:b.id,what:`Reading ${BASE.name} on ${b.name}…`};head();busy();HOST.lens(b.id);return}
  track(label,()=>{BASE.runtime={id:b.id,name:b.name,core:b.core};core=CORES[b.core]?b.core:core;render()})}
let LAYER="yours", YOURS=true, HOMEON=true, showAdd=false, addQ='', PENDING=null, DIFF=null, diffAll=false;
// a draft (VS Code): changes not made yet, measured on a copy. A folder, or a runtime's profile (a new harness)
const canDraft=()=>!BASE.profile||BASE.profile.kind==='runtime';
// a variation: anything the board shows that isn't reality. Lenses (a layer or package off, a mode, another
// runtime) and draft changes are both moves off the real line, like a variation on a chess analysis board
let REAL=null;
const lensMoves=()=>{const L=BASE.lens||{}, bases=BASE.bases||[], nm=id=>(bases.find(b=>b.id===id)||{}).name||id, out=[];
  if(L.runtime&&L.home) out.push({k:'rt',t:`on ${nm(L.runtime)}, not ${nm(L.home)}`});
  if(BASE.base_on===false) out.push({k:'base',t:`without ${(BASE.runtime||{}).name||'the runtime'}'s defaults`});
  Object.keys(pkgOn).filter(p=>pkgOn[p]===false&&supplies(p)).forEach(p=>out.push({k:'p:'+p,t:`without ${p}`}));
  if(!HOMEON&&hasHome()) out.push({k:'home',t:'without your ~/.claude'});
  if(!YOURS) out.push({k:'proj',t:'without your own files'});
  if(mode!=='all') out.push({k:'mode',t:mode==='base'?'no working mode':`only in ${mode} mode`});
  // a model or a mode picked as a what-if: shown, never written
  const rtid=(BASE.runtime||{}).id; if(typeof MWHATIF!=='undefined'&&MWHATIF[rtid]) out.push({k:'mw:'+rtid,t:`on ${MWHATIF[rtid]}, as a what-if`});
  if(typeof MODEPICK!=='undefined') for(const g in MODEPICK){const m=((BASE.run_mode||{}).modes||[]).find(x=>x.id===MODEPICK[g]&&(x.picker||'')===g); if(m) out.push({k:'mp:'+g,t:`${m.name} ${g||'mode'}, as a what-if`})}
  return out};
function realSnap(){const keep={pk:{...pkgOn},y:YOURS,h:HOMEON,m:mode}, h0=H;
  Object.keys(pkgOn).forEach(p=>{if(pkgOn[p]===false)pkgOn[p]=true});YOURS=true;HOMEON=true;mode='all';
  H=derive(layered(BASE)); const r=snap();
  Object.assign(pkgOn,keep.pk);YOURS=keep.y;HOMEON=keep.h;mode=keep.m;layered(BASE);H=h0;return r}
const undoMove=k=>{if(k==='base'){premarkBase(true);PREVSNAP={s:snap(),label:'Counting the runtime\'s defaults again'};PENDING={what:'Reading it again…'};busy();head();HOST.base(true);return}
  if(k==='rt'){PREVSNAP={s:snap(),label:'Back to this folder\'s own runtime'};PENDING={what:'Reading it on this folder\'s runtime…'};busy();head();HOST.lens(null);return}
  if(k.startsWith('mw:'))MWHATIF[k.slice(3)]=null;if(k.startsWith('mp:')){delete MODEPICK[k.slice(3)];if(isClaudeRt()){setOVM(NEAR[modeLevel(curPicks())]||'auto');return}}
  if(k.startsWith('p:'))pkgOn[k.slice(2)]=true;if(k==='home')HOMEON=true;if(k==='proj')YOURS=true;if(k==='mode')mode='all';render();layoutFit()};
const drCls=(id,m)=>{const r=BASE.draft&&BASE.draft.reality&&BASE.draft.reality.m[id];
  if(r) return m>r[1]?' dr48':m<r[1]?' dr48 dg48':'';
  const v=REAL&&REAL.m[id]; if(!v) return ''; return m>v[1]?' vr48':m<v[1]?' vr48 dg48':''};
// what changed when the stack changes: a snapshot before, one after, and the difference spelled out
function snap(){const T=types(), cur=H.tiers.filter(t=>t.reached).pop();
  return {key:BASE.key, xp:xpOf(), backed:H.backed, rank:cur&&RANKS[cur.id]?RANKS[cur.id][0]:'Unranked',
    cats:(H.trustx||[]).map((c,i)=>[c.name,(H.cats||[])[i]??0]),
    m:Object.fromEntries(T.map(t=>[t.id,[t.name,Math.max(0,maturity(t)),t.slot.id]])),
    ach:H.sets.filter(x=>x.kind==="synergy"&&x.status==="active").map(x=>x.name),
    weak:H.sets.filter(x=>x.kind==="curse"&&x.status==="active").map(x=>x.name)}}
function diffOf(a,b,label){
  const up=[],down=[];Object.keys(b.m).forEach(id=>{const x=a.m[id]?a.m[id][1]:0,y=b.m[id][1];if(y>x)up.push([id,x,y]);if(y<x)down.push([id,x,y])});
  const cats=b.cats.map(([n,v],i)=>[n,(a.cats[i]||[n,0])[1],v]).filter(([,x,y])=>x!==y);
  const minus=(p,q)=>p.filter(x=>!q.includes(x));
  return {label,a,b,up,down,cats,earned:minus(b.ach,a.ach),lost:minus(a.ach,b.ach),opened:minus(b.weak,a.weak),cleared:minus(a.weak,b.weak)}}
function track(label,fn,why){const a=snap();fn();DIFF=diffOf(a,snap(),label);DIFF.why=why;diffAll=false;head();drawDetail()}
// a package that supplies nothing the runtime loads: say that, rather than "no difference"
// does anything of yours load from your home folder (not a package's)
const hasHome=()=>!!(BASE.layers&&BASE.layers.home)&&BASE.slots.some(s=>s.types.some(t=>[...(t.inst||[]),...(t.extra||[])].some(x=>(x.scope==="user"||x.scope==="org")&&!x.pkg)));
const supplies=p=>BASE.slots.some(s=>s.types.some(t=>[...(t.inst||[]),...(t.extra||[])].some(x=>x.pkg===p)));
let PREVSNAP=null;   // taken when VS Code starts reading again; the difference shows when the new reading lands
function landed(was){const p=PREVSNAP;PREVSNAP=null;if(!was||was.key!==BASE.key){DIFF=null;head();return}
  coreSweep();
  const d=diffOf(p?p.s:was,snap(),p?p.label:'Read again after a harness file changed');
  const tp=p&&/^Trying /.test(p.label)?p.label.slice(7):null;
  if(tp&&!supplies(tp)) d.why=`${(BASE.runtime||{}).name||'This runtime'} doesn't load anything ${tp} adds.`;
  if(p||d.up.length||d.down.length||d.cats.length||d.a.xp!==d.b.xp){DIFF=d;diffAll=false}head();drawDetail()}
// the difference on show: a draft against reality (kept), else the last change you made (dismissable)
const curDiff=()=>BASE.draft&&BASE.draft.reality?Object.assign(diffOf(realWithSits(),snap(),BASE.new?'The new harness compared with an empty folder on '+BASE.new.name:'This draft compared with live'),{keep:true})
  :REAL?Object.assign(diffOf(REAL,snap(),'This preview compared with your files'),{keep:true}):DIFF;
// one line in the stack; the details open in the side drawer, so the board doesn't move
function diffChip(){const d=curDiff();if(!d)return '';
  const lv=x=>lvlOf(x), dx=d.b.xp-d.a.xp, n=d.up.length+d.down.length, tone=v=>v>0?'up':v<0?'dn':'';
  const bits=!dx&&!n&&d.a.backed===d.b.backed?['no difference']:[
    lv(d.a.xp)!==lv(d.b.xp)?`<b class="${tone(lv(d.b.xp)-lv(d.a.xp))}">Level ${lv(d.a.xp)} → ${lv(d.b.xp)}</b>`:'',
    dx?`<b class="${tone(dx)}">${dx>0?'+':''}${dx} XP</b>`:'',
    d.a.backed!==d.b.backed?`trust ${d.a.backed}% → ${d.b.backed}%`:'',
    n?`${n} piece${n===1?'':'s'} changed`:''].filter(Boolean);
  return `<span class="dc48${leftOpen&&topic==='changes'?' on':''}"><button data-topic="changes" title="See everything that changed">${icon('GitCompare',13)}<span class="l">${esc(d.label)}</span><span class="v">${bits.join('<i>·</i>')}</span><u>Details</u></button>${d.keep?'':`<button class="ib48 x" data-undiff="1" aria-label="Dismiss">${icon('X',12)}</button>`}</span>`}
function diffHTML(full){
  const d=curDiff();if(!d)return '';
  const lv=x=>lvlOf(x), dx=d.b.xp-d.a.xp, sg=n=>n>0?`+${n}`:`${n}`, tone=n=>n>0?'up':n<0?'dn':'';
  const kv=(k,a,b,t)=>`<span class="kv ${t}"><em>${k}</em><b>${a}</b>${a===b?'':`${icon('ArrowRight',11)}<b>${b}</b>`}</span>`;
  // situations the draft moves: their verdict before and after (oversight.ts, in the draft's reality)
  const bf=BASE.draft&&ovBefore(), sm=bf&&ovOK()?ovData().d.situations.filter(x=>bf[x.id]&&bf[x.id]!==x.verdict):[];
  const none=!dx&&!d.up.length&&!d.down.length&&!d.cats.length&&d.a.backed===d.b.backed&&!sm.length;
  const pc=([id,x,y])=>`<button class="pc" data-go="${id}" style="--sec:${SECCOL[d.b.m[id][2]]||'#888'}">${esc(d.b.m[id][0])} <small>${MAT[x]} → ${MAT[y]}</small></button>`;
  const lim=full||diffAll?1e9:6, more=d.up.length+d.down.length-Math.min(d.up.length,lim)-Math.min(d.down.length,lim);
  const row=(k,cls,items)=>items.length?`<div class="dr ${cls}"><em>${k}</em><span>${items.join('')}</span></div>`:'';
  return `<div class="df48${full?' side':''}" role="status">
    <div class="dh">${icon('GitCompare',14)}<b>${esc(d.label)}</b></div>
    ${none?`<p>${esc(d.why||'No piece changes level and no number moves: what it supplies is already there without it.')}</p>`:`
    <div class="ks">${kv('Level',lv(d.a.xp),lv(d.b.xp),tone(lv(d.b.xp)-lv(d.a.xp)))}${kv('XP',d.a.xp,`${d.b.xp}${dx?` <small>(${sg(dx)})</small>`:''}`,tone(dx))}${kv('Backed trust',d.a.backed+'%',d.b.backed+'%',tone(d.b.backed-d.a.backed))}${d.a.rank!==d.b.rank?kv('Rank',esc(d.a.rank),esc(d.b.rank),''):''}</div>
    ${row('Trust','',d.cats.map(([n,x,y])=>`<span class="tc ${tone(y-x)}">${esc(n)} <small>${x}% → ${y}%</small></span>`))}
    ${row('Situations','',sm.slice(0,lim).map(x=>`<button class="pc" data-sitopen="${x.id}">${esc(x.what)} <small>${esc(VERN[bf[x.id]]||bf[x.id])} → ${esc(VERN[x.verdict])}</small></button>`))}
    ${row('Up','up',d.up.slice(0,lim).map(pc))}${row('Down','dn',d.down.slice(0,lim).map(pc))}
    ${more>0?`<button class="mo" data-diffall="1">Show ${more} more</button>`:''}
    ${row('Earned','up',d.earned.map(n=>`<span class="dtg gold">${icon('Trophy',11)} ${esc(n)}</span>`))}${row('Lost','dn',d.lost.map(n=>`<span class="dtg">${icon('Trophy',11)} ${esc(n)}</span>`))}
    ${row('Weak spot','dn',d.opened.map(n=>`<span class="dtg bad">opened: ${esc(n)}</span>`))}${row('Weak spot','up',d.cleared.map(n=>`<span class="dtg">cleared: ${esc(n)}</span>`))}`}
  </div>`}   // PENDING: what VS Code is reading now
function layered(B){
  // your own files off: what the packages add on the runtime, or the runtime alone if no package is on
  const pk=[...new Set(B.slots.flatMap(s=>s.types.flatMap(t=>[...(t.inst||[]),...(t.extra||[])].map(x=>x.pkg).filter(Boolean))))];
  // your own files come in two parts: the project's, and your setup in your home folder (every project)
  const L2=B.layers||{};
  LAYER=YOURS&&HOMEON?"yours":YOURS&&L2.project?"project":HOMEON&&L2.home?"home":pk.some(p=>pkgOn[p]!==false)?"packages":"base";
  if(B.runtime&&B.runtime.core&&CORES[B.runtime.core]) core=B.runtime.core;
  if(LAYER==="yours"||!B.layers||!B.layers[LAYER]) return B;
  const L=B.layers[LAYER];
  return {...B, layered:true, backed:L.backed, slots:B.slots.map(sl=>({...sl,types:sl.types.map(t=>{const st=L.stage[t.id]??0;
    // base: nothing of yours; packages: only what a package supplies; project / home: one part of yours
    const mine=x=>x.scope==="user"||x.scope==="org";
    const keep=x=>LAYER==="packages"?!!x.pkg:LAYER==="project"?(!!x.pkg||!mine(x)):LAYER==="home"?(!!x.pkg||mine(x)):false;
    const ins=(t.inst||[]).filter(keep), ex=(t.extra||[]).filter(x=>LAYER==="home"?true:keep(x));
    const lt=L.tiers?L.tiers[t.id]:undefined, tier=!L.tiers?t.tier:lt&&st>0&&t.tier?{...t.tier,reached:lt.reached,of:lt.of,name:lt.name}:null;
    return {...t,stage:st,inst:ins,extra:ex,tier,count:st>0?Math.max(1,ins.length+ex.length):0,
      supplied:st>0?(ins.length||ex.length?"package":"runtime"):null,control:st>0?(ins.length||ex.length?"package":(t.control==="vendor"||t.control==="platform"?t.control:"default")):null}})}))}
}
// while VS Code reads the harness again, the board stays as it was but says so, and takes no clicks
function busy(){lockShow();const v=document.querySelector('.v44'), rx=$('v44inv')?.querySelector?.('.core38 .rx39'); rx&&rx.classList.toggle('meas82',!!PENDING&&!calm()); if(!PENDING)document.querySelectorAll('.wait82').forEach(b=>b.classList.remove('wait82')); if(v&&v.classList){v.classList.toggle('busy48',!!PENDING);v.classList.toggle('draft48',!!BASE.draft);v.classList.toggle('var48',!BASE.draft&&!!(BASE&&lensMoves().length))}}
// the board re-fits whenever its area changes size: the side panel opening or closing, a window resize
let FITRO=null, FITW=0;
function watchFit(){const fb=$('v44boardview'); if(FITRO||!fb||typeof ResizeObserver==='undefined') return;
  FITRO=new ResizeObserver(es=>{const w=Math.round(es[0].contentRect.width); if(Math.abs(w-FITW)<2) return; FITW=w;
    clearTimeout(FITRO.t); FITRO.t=setTimeout(()=>layoutFit(),60)}); FITRO.observe(fb)}
// compact (VS Code's sidebar): only the circle, with the side panel's tabs below it; other views open the full board
const COMPACT=typeof window!=='undefined'&&!!window.FREE_REIN_COMPACT;
// the circle's size in the sidebar: full, a mini bar (a small ring, level and XP), or one line; your choice is kept
let CSIZE=(()=>{try{const u=new URLSearchParams(location.search).get('csize'); const v=u||localStorage.getItem('v44-csize')||'full', z=v==='full'?'full':'mini'; if(u)localStorage.setItem('v44-csize',z); return z}catch(x){return 'full'}})();
function setCSize(v){CSIZE=v;try{localStorage.setItem('v44-csize',v)}catch(x){}render();layoutFit()}
function sizeCtl(){return `<span class="cz81" role="group" aria-label="Circle size">${[['full','Circle','The full circle'],['mini','PanelTop','The small circle, in one card']].map(([k,ic,t])=>`<button data-csize="${k}" aria-pressed="${CSIZE===k}" title="${t}">${icon(ic,12)}</button>`).join('')}</span>`}
// the small circle: the full circle's ring drawn small (each piece a segment, its level in three bands, the section's band
// inside), on the same dark rim with a gold edge, and the level in the middle with XP to the next one around it
function crest(px){const ang=compactAngles(), half=2*Math.PI/H.slots.length/2-.04, R0=SEGR0, R1=SEGR1, bh=(R1-R0)/3;
  const segs=H.slots.map(sl=>{const a=ang[sl.id]; if(a==null) return ''; const types=sl.types.filter(t=>typeof showPiece!=='function'||showPiece(t)); if(!types.length) return '';
    const col=SECCOL[sl.id], n=types.length, g=.03, w=(2*half-g*(n-1))/n;
    return `<path d="${segArc(R0-7,R0-3,a-half,a+half)}" fill="${col}" opacity=".55"/>`+types.map((t,q)=>{const b0=a-half+q*(w+g), b1=b0+w, m=maturity(t);
      return `<path d="${segArc(R0,R1,b0,b1)}" fill="#14161B" stroke="${m?col:'#33363F'}" stroke-opacity="${m?.6:1}" stroke-width="1.6"/>`
        +[1,2,3].map(k=>m>=k?`<path d="${segArc(R0+(k-1)*bh+1.2,R0+k*bh-1.2,b0+.01,b1-.01)}" fill="${col}" opacity="${m===3?1:k===m?.95:.8}"/>`:'').join('')}).join('')}).join('');
  const x=xpOf(), L=lvlOf(x), lo=lvlXP(L), hi=lvlXP(L+1), fr=L>=LVMAX?1:Math.max(0,Math.min(1,(x-lo)/(hi-lo))), r=60, c=2*Math.PI*r;
  return `<svg class="cr82" width="${px}" height="${px}" viewBox="0 0 220 220" aria-hidden="true"><defs><radialGradient id="cr82g" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#1C1E25"/><stop offset="1" stop-color="#0C0D11"/></radialGradient></defs>
    <circle cx="110" cy="110" r="108" fill="#101116" stroke="#F2C35B" stroke-opacity=".45" stroke-width="2"/>${segs}
    <circle cx="110" cy="110" r="${r+8}" fill="url(#cr82g)" stroke="#2A2D35" stroke-width="2"/>
    <circle cx="110" cy="110" r="${r}" fill="none" stroke="#24262D" stroke-width="7"/>
    <circle cx="110" cy="110" r="${r}" fill="none" stroke="#F2C35B" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c*fr).toFixed(1)} ${c}" transform="rotate(-90 110 110)"/>
    <text x="110" y="130" text-anchor="middle" font-family="Geist,system-ui,sans-serif" font-size="58" font-weight="700" fill="#F2C35B">${L}</text></svg>`}
function compactSetup(){if(!COMPACT) return; const sh=$('v44shell'); if(sh&&sh.classList){sh.classList.add('cp68');sh.classList.toggle('cs-mini',CSIZE==='mini');sh.classList.toggle('cs-off',CSIZE==='off')}
  INSPHIDE=false; if(!SOLO){SOLO=true;const inv=$('v44inv');inv&&inv.classList&&inv.classList.add('solo')} if(VIEW!=='board'&&!askFirst()) VIEW='board'}
function render(){
  compactSetup();
  H=derive(layered(BASE));
  REAL=!BASE.draft&&lensMoves().filter(x=>x.k!=='rt'&&x.k!=='base').length?realSnap():null;
  busy(); if(sel&&!find(sel)) sel=null;
  const st=document.querySelector('.v44'); if(st&&st.style&&st.style.setProperty){st.style.setProperty('--tc',tierCol());st.style.setProperty('--tcrgb',rgb(tierCol()))}
  {const cur=H.tiers.filter(t=>t.reached).pop(); HOST.summary({level:lvlOf(xpOf()),xp:xpOf(),rank:(l=>l?(SHORTK[l.id]||l.name)+': '+l.autonomy.name:'')(lowest()),name:BASE.name})}
  head(); drawRead(); sitsAside(); drawInventory(); drawCombos(); drawDetail(); drawRail(); drawView(); watchFit(); drawPlan(); levelToast(); achToast();
}
const applyPrefs=p=>{if(!p)return;if('agentReview' in p)AGENTREVIEW=!!p.agentReview;if(p.runtime&&CORES[p.runtime])core=p.runtime;if('countHome' in p)unseen=!!p.countHome;
  if(p.sounds&&SNDVOL[p.sounds]!=null)SNDLV=p.sounds;
  if(p.palette){PAL={vivid:'rarity',warm:'heat',calm:'calm'}[p.palette]||PAL;applyPal()}
  if('character' in p)CHAR.on=p.character!==false;if(p.characterKind==='jack'||p.characterKind==='socket')CHAR.kind='jack';if(p.characterKind==='sprout')CHAR.kind='sprout';if(typeof p.characterName==='string')CHAR.name=p.characterName;if(p.characterColor&&CHCOL[p.characterColor])CHAR.color=p.characterColor;lastSig=null};
applyPrefs(window.FREE_REIN_PREFS);
window.addEventListener('message',e=>{const m=e.data;if(m&&m.type==='prefs'){applyPrefs(m.prefs);render();layoutFit()}
  if(m&&m.type==='view'&&m.view){goView(m.view);return}
  if(m&&m.type==='select'&&find(m.id)){sel=m.id;selSet=null;selSlot=null;if(SOLO)setSolo(false);render()}});
window.addEventListener('message',e=>{const m=e.data;if(m&&m.type==='failed'){PENDING=null;PREVSNAP=null;render();return}if(m&&m.type==='sim'){SIMRES=m.result;PENDING=null;render();return}if(m&&m.type==='plan'){PLANS[m.id]=m.plan;render();return}if(m&&m.type==='written'){WROTE[m.id]=m.files||[];render();return}if(m&&m.type==='undone'){delete WROTE[m.id];PLANS[m.id]=null;render();return}if(!m||m.type!=='data'||!m.data||!m.data.harnesses)return;
  const was=H?snap():null;D.harnesses.splice(0,D.harnesses.length,...m.data.harnesses);BASE=D.harnesses[0];PENDING=null;lastSig=null;render();landed(was);layoutFit()});
applyPal();
render();
// for tests only: a page that sets window.FREE_REIN_PROBE before the board loads can read its numbers
if(window.FREE_REIN_PROBE) window.FREE_REIN_PROBE={xp:()=>xpOf(), level:x=>lvlOf(x??xpOf()), levelStart:n=>lvlXP(n), modes:()=>Object.keys((BASE.oversight||{}).by_mode||{}),
  mode:m=>{if(m!==undefined)OVM=m;return OVM}, packages:on=>{Object.keys(pkgOn).forEach(k=>pkgOn[k]=on);H=derive(BASE);return Object.keys(pkgOn).length},
  layer:on=>{unseen=on;H=derive(BASE)}};
})();
const relayout=()=>{const f=window.__v44redraw;f&&f()};
window.addEventListener('resize',relayout);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(relayout);
if(window.ResizeObserver){let t=null;new ResizeObserver(()=>{clearTimeout(t);t=setTimeout(relayout,120)}).observe(document.body)}
