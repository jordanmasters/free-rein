// ---- a piece, in the side panel: what it is and where it stands, what doing something about it earns,
// one clear next step, and the rest folded until you want it.
// skills in this repo the runtime being read doesn't load, and who does (from the core: another runtime, or a plugin once installed)
const elsewhere=(t,rtName)=>{const els=t.elsewhere||[]; if(!els.length) return '';
  const who=id=>id==='plugin'?'a plugin, once installed':((((BASE.bases||[]).find(b=>b.id===id)||{}).name||id).replace(/\s*\(.*?\)\s*/g,'').trim());
  // grouped by who loads them; a few named, many counted
  const by={}; els.forEach(e=>{const k=e.for.map(who).join(', '); (by[k]=by[k]||[]).push('/'+e.name.replace(/@.*/,''))});
  const parts=Object.entries(by).map(([k,ns])=>ns.length<=4?`${ns.map(esc).join(', ')} (for ${esc(k)})`:`${ns.length} for ${esc(k)}`);
  return `<p class="mute">${els.length} more in this repo that ${esc(rtName)} doesn't load: ${parts.join('; ')}</p>`};
let PCOPEN=(()=>{try{return JSON.parse(localStorage.getItem('v44-pcopen')||'{}')}catch(x){return {}}})();
const pcFold=(k,def)=>k in PCOPEN?PCOPEN[k]:def;
function fold(k,title,badge,body,def,tone=''){return `<details class="ac55 ${tone}" data-fold="${k}" ${pcFold(k,def)?'open':''}><summary><span class="t">${title}</span>${badge!=null&&badge!==''?`<span class="b">${badge}</span>`:''}<span class="cv">${icon('ChevronDown',14)}</span></summary><div class="bd">${body}</div></details>`}
function piecePane(t){const g=gains(t.id), m=maturity(t), k=kindOf(t), hosted=typeof HOST!=='undefined', hostd=hosted&&canDraft(), dUps=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], inPlan=hostd?dUps.includes(t.id):plan.includes(t.id);
  const tmpl=(BASE.templates||[]).includes(t.id), sec=SECCOL[t.slot.id]||'#8D919D', ic=icon(ICON[t.id]||'Sparkles',22);
  // what you have: what's in your files, and what the runtime gives you out of the box (its level counts too)
  // what the runtime ships counts as a layer of its own: listed beside yours, with its source, whenever it's on
  const rtName=(BASE.runtime||{}).name||'the runtime', ship=BASE.base_on!==false&&(BASE.base_ships||{})[t.id], fromRt=t.supplied==='runtime'&&!t.inst.length&&t.stage>0;
  const all=[...(ship&&ship.ships?[{label:(t.runtime_items||[]).length?`${(t.runtime_items||[]).length} bundled, always there: ${(t.runtime_items||[]).map(x=>'/'+x).join(', ')}${Object.keys(t.runtime_when||{}).length?`. And ${Object.keys(t.runtime_when).length} more when they apply: ${Object.entries(t.runtime_when).map(([k,v])=>'/'+k+' ('+v+')').join('; ')}`:''}`:(ship.note||t.badge||'Built in'),pkg:'built into '+rtName,seen:true,rt:true,src:ship.source}]:fromRt?[{label:t.badge||'Built in',pkg:'built into '+rtName,seen:true,rt:true}]:[]),...t.inst.map(x=>({...x,seen:true})),...(t.extra||[]).map(x=>({...x,seen:!!unseen}))];
  const backs=H.trustx.map((c,i)=>{const p=c.pieces.find(p=>p.id===t.id);return p?{c,i,p}:null}).filter(Boolean);
  const tiersNeed=H.tiers.filter(x=>x.needs.includes(t.id)&&!x.reached), mySets=H.sets.filter(s=>s.kind==="synergy"&&s.ids.includes(t.id));
  const causes=H.sets.filter(s=>s.kind==="curse"&&s.status==="active"&&s.ids.includes(t.id)), clears=H.sets.filter(s=>s.kind==="curse"&&s.status==="active"&&s.lifts.includes(t.id));
  const guardsOf=H.guards.filter(x=>x.cap===t.id), guarding=H.guards.filter(x=>x.ctl===t.id);
  const D=ovOK()?ovData().d:null, P=D&&(D.pieces||{})[t.id], decides=P?P.decides.length:0, settles=D?D.situations.filter(s=>s.fix&&s.fix.piece===t.id).length:0;
  const KN={cap:'Ability',asks:'Safeguard · asks you',checks:'Safeguard · checks',blocks:'Safeguard · refuses'}[k];
  // what doing something about it earns, only what's true here
  const rw=[];
  if(m<3&&t.upgrade_xp) rw.push(['Sparkles',`+${t.upgrade_xp} XP`,'xp']);
  // the rank it raises: a kind of stakes whose next grade needs only this piece
  if(m<2) reinsOf().filter(r=>r.autonomy.next&&!r.autonomy.next.situations.length&&r.autonomy.next.any_of.some(x=>x.piece===t.id)).forEach(r=>rw.push(['ArrowUpRight',`Raises ${esc((SHORTK[r.id]||r.name).toLowerCase())} to ${esc(r.autonomy.next.name)}`,'rk']));
  if(g&&g.trust>0) rw.push(['Scale',`+${g.trust} backed trust`,'tr']);
  if(settles&&m<2) rw.push(['ShieldCheck',`Would settle ${settles} situation${settles===1?'':'s'}`,'st']);
  (g?g.sets:[]).forEach(s=>rw.push(['Trophy',`Completes ${esc(setName(s))}`,'ach']));
  (g?g.clears:clears).forEach(s=>rw.push(['ShieldAlert',`Clears the weak spot ${esc(s.name)}`,'cl']));
  const next=hosted?addFlow(t,m,tmpl,hosted)+(t.stage!==2?`<div class="cta55"><button class="b50" data-plan="1">${inPlan?icon('Check',13)+' In the draft':icon('PencilRuler',13)+' '+(hostd?'Add to draft':'Add to plan')}</button><small>Or try it in a draft with other changes, measured together.</small></div>`:''):m>=3?'':`<div class="cta55">${hosted&&m<3?`<button class="b50 pri" data-upgrade="${t.id}">${icon(!tmpl?'MessageSquare':m>=2?'ShieldPlus':'Wand2',14)} ${!tmpl?'Ask the agent':m>=2?'Harden it':'Add it now'}</button>`:''}
      ${t.stage!==2?`<button class="b50" data-plan="1">${inPlan?icon('Check',13)+' In the draft':icon('PencilRuler',13)+' '+(hostd?'Add to draft':'Add to plan')}</button>`:''}
      <small>${hosted?(tmpl?'Free Rein shows every file it would write, and writes nothing until you say Write.':'Free Rein has no template for this, so it writes nothing: it gives you a request to hand your agent.'):'Free Rein writes it in the editor.'}</small></div>`;
  const stg=t.tier?`${tierPips(t.tier,true)}<b>${esc(t.tier.name)}</b>${t.tier.next?`<small>next: ${esc(t.tier.next.name)}</small>`:''}`:`${stepBar(ladderOf(t)).replace('lv44 ld','lv44 ld big')}<b>${t.stage<0?"Can't tell":esc(stepWord(ladderOf(t)))}</b>${fromRt?`<small>from ${esc(rtName)}</small>`:seen(t)>1?`<small>×${seen(t)}</small>`:''}`;
  // the folds
  const have=all.length?`<ul class="in55">${all.slice(0,30).map(x=>`<li class="${x.seen?'':'dim'}"><span class="d" style="background:${pkgCol(x.pkg)}"></span><span class="l">${esc(x.label)}<small>${esc(x.pkg||({org:'everyone',user:'you, every repo',project:'this repo',local:'you, this repo'}[x.scope]||''))}${x.hold?` · ${x.hold==='holds'?'holds on its own':'only asks'}`:''}${x.src?` · <a href="${esc(x.src)}" target="_blank" rel="noopener">its docs</a>`:''}</small></span>${x.path?`<button class="ib48" data-open="${esc(x.path)}" data-lines="${x.lines?x.lines.join('-'):''}" title="Open ${esc(x.path)}">${icon('ExternalLink',12)}</button>`:''}</li>`).join('')}</ul>${all.length>30?`<p class="mute">and ${all.length-30} more</p>`:''}`+(heldOf(t)?holdCard(t):'')+elsewhere(t,rtName)
    :`<div class="em55">${icon(ic?ICON[t.id]||'Sparkles':'Sparkles',18)}<p><b>Nothing here yet.</b>${t.example?` For example: ${esc(t.example)}.`:''}</p></div>`;
  const why=[...(backs.length?[`<li>${icon('Scale',13)}<span>Counts as evidence that the agent can be trusted to ${backs.map(({c,i})=>`<b>${esc(c.name.toLowerCase())}</b> <small>${H.cats[i]}% backed now</small>`).join(', ')}.</span></li>`]:[]),

    ...mySets.map(s=>`<li>${icon('Trophy',13)}<span>Part of the achievement <b>${esc(setName(s))}</b>${s.status==='active'?' (earned)':`, which also needs ${s.ids.filter(x=>x!==t.id&&!on(x)).map(x=>`<a data-go="${x}">${esc(find(x)?.name||x)}</a>`).join(', ')||'nothing else'}`}.</span></li>`),
    ...guardsOf.map(x=>`<li>${icon('ShieldCheck',13)}<span>${x.active?'Guarded by':'Would be guarded by'} <a data-go="${x.ctl}">${esc(find(x.ctl)?.name)}</a>.</span></li>`),
    ...guarding.map(x=>`<li>${icon('ShieldCheck',13)}<span>${x.active?'Guards':'Would guard'} <a data-go="${x.cap}">${esc(find(x.cap)?.name)}</a>.</span></li>`)];
  const risk=[...causes.map(s=>`<div class="rk55"><b>${esc(s.name)}</b><span>${esc(s.effect)}</span>${s.lifts.length?`<span class="fx">Fix: ${s.lifts.map(id=>`<a data-go="${id}">${esc(find(id)?.name||id)}</a>`).join(' or ')}</span>`:''}</div>`),
    ...clears.map(s=>`<div class="rk55 cl"><b>${esc(s.name)}</b><span>${esc(s.effect)}</span><span class="fx">Adding this clears it.</span></div>`)];
  const rts=Object.entries(CORES).sort(([a],[b])=>(b===core)-(a===core)).map(([kk,n])=>{const x=t.rt&&t.rt[kk]||[t.how&&t.how[kk]||'—',true];
    return `<div class="rt55${kk===core?' cur':''}"><b>${esc(n)}</b><span>${esc(x[0])}</span>${x[1]===false?'<i class="bl">believed</i>':x[1]===null?'<i class="nw">no known way</i>':''}</div>`}).join('');
  return `<div class="dhead"><span class="crumb2"><a data-sec="${t.slot.id}">${esc(t.slot.name)}</a></span><a data-close="1" aria-label="Close">×</a></div>
    <section class="hd55" style="--sc:${sec}"><div class="ic">${ic||`<b>${esc(t.name[0])}</b>`}</div><div class="tx"><h3>${esc(t.name)}</h3><div class="mt">${stg}<span class="kn">${shape(k,11)} ${KN}</span></div></div></section>
    <p class="wh55">${esc(t.what)}</p>
    ${rw.length?`<div class="rw55">${rw.map(([i2,txt,c])=>`<span class="${c}">${icon(i2,12)} ${txt}</span>`).join('')}</div>`:m>=3?`<p class="ok55">${icon('BadgeCheck',14)} Hardened: ${esc(hardenedBy(t)||'it holds')}.</p>`:''}
    ${(mv=>mv?moveCard(mv):'')(movesAll().find(m=>m.fix.piece===t.id))}
    ${t.tier?fold('tiers','Levels',`${t.tier.reached} of ${t.tier.of}${t.tier.next?' · next: '+t.tier.next.name:''}`,tiersHTML(t),false):''}
    ${(h=>h?fold('said','What it says',(BASE.said.statements.filter(x=>x.piece===t.id&&x.kind==='rule').length||'')+' rules',h,true):'')(saidHTML(t))}
    ${piecesModels(t)}
    ${t.profile&&t.profile.summary.n?fold('profile','How each one is hardened',`${t.profile.summary.ok}/${t.profile.summary.n}`,profileHTML(t),true):''}
    ${decides?fold('decides','What it decides',decides,pieceOv(t).replace(/^<details open><summary>What it decides<\/summary>/,'').replace(/<\/details>$/,''),true):''}
    ${fold('have','What you have',shownOf(t).tot||all.length||'none',have,all.length>0&&all.length<=8)}
    ${next}
    ${why.length?fold('why','Why it matters',why.length,`<ul class="wy55">${why.join('')}</ul>`,!all.length):''}
    ${risk.length?fold('risk','Risks',risk.length,risk.join(''),true,'bad'):''}
    ${t.change?fold('change',m>=2?'How to strengthen it':'What adding it does','',`<p>${esc(t.change.does)}</p><p class="mute">Touches ${t.change.files.map(f=>`<code>${esc(f)}</code>`).join(', ')}</p>`,false):''}
    ${fold('rt','On each runtime',Object.keys(CORES).length,rts,false)}
    ${(h=>h?fold('knows','How Free Rein knows','',h,false):'')(knowsPiece(t))}`}
function bindPiece(d){bindSaid(d);d.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>openMove(b.dataset.move));
  d.querySelectorAll('[data-rulesall]').forEach(b=>b.onclick=()=>{RULESOF=b.dataset.rulesall;RULEF=null;goView('rules')});
  d.querySelectorAll('[data-listall]').forEach(b=>b.onclick=()=>{LISTALL[b.dataset.listall]=!LISTALL[b.dataset.listall];render()});
  d.querySelectorAll('[data-fold]').forEach(x=>x.addEventListener('toggle',()=>{PCOPEN[x.dataset.fold]=x.open;try{localStorage.setItem('v44-pcopen',JSON.stringify(PCOPEN))}catch(e){}}));
  if(typeof HOST!=='undefined'){d.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>HOST.upgrade(b.dataset.upgrade));
    d.querySelectorAll('[data-plan76]').forEach(b=>b.onclick=()=>{const id=b.dataset.plan76;PLANS[id]=null;b.disabled=true;b.innerHTML=icon('Loader',13)+' Measuring on a copy…';HOST.plan(id)});
    d.querySelectorAll('[data-copyw76]').forEach(b=>b.onclick=()=>{const [id,i]=b.dataset.copyw76.split(':'), w=((find(id)||{}).ways||[])[+i]; if(!w) return;
      const txt=[...String(w.takes||'').matchAll(/`([^`]+)`/g)].map(x=>x[1]).join('\n'); HOST.copy(txt); try{navigator.clipboard&&navigator.clipboard.writeText(txt).catch(()=>{})}catch(x){} b.innerHTML=icon('Check',13)+' Copied'});
    d.querySelectorAll('[data-planx76]').forEach(b=>b.onclick=()=>{delete PLANS[b.dataset.planx76];render()});
    d.querySelectorAll('[data-write76]').forEach(b=>b.onclick=()=>{b.disabled=true;b.innerHTML=icon('Loader',13)+' Writing…';HOST.write(b.dataset.write76)});
    d.querySelectorAll('[data-undo76]').forEach(b=>b.onclick=()=>{b.disabled=true;HOST.undo(b.dataset.undo76)});
    d.querySelectorAll('[data-copy76]').forEach(b=>b.onclick=()=>{const p=PLANS[b.dataset.copy76];if(p&&p.request){HOST.copy(p.request);try{navigator.clipboard&&navigator.clipboard.writeText(p.request).catch(()=>{})}catch(x){}b.innerHTML=icon('Check',13)+' Copied'}});
    d.querySelectorAll('[data-build76]').forEach(b=>b.onclick=()=>{HOST.build(b.dataset.build76);b.innerHTML=icon('Check',13)+' Sent to a terminal'});
    d.querySelectorAll('[data-open]').forEach(a=>a.onclick=()=>HOST.open(a.dataset.open,a.dataset.lines?a.dataset.lines.split('-').map(Number):null))}}
