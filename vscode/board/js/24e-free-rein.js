// ---- Free rein: the fourth view. How much the agent does on its own, and whether the rules written in its
// instructions hold, by kind of action (BASE.free_rein, from the core's judge/freerein.ts). It leads with one
// sentence and one number, then the tiles, then each kind of action as a card (worst first), then the written rules
// from said to enforced. A card opens its kind in the side panel's Situations tab.
// Colours: the five outcomes are a categorical palette validated for the dark surface (adjacent pairs, CVD-safe);
// the match states use the status colours, always with an icon and words.
const FRSEG=[['own','on its own','#d95926'],['runtime','its own check decides','#9085e9'],['maybe','a hook may refuse','#c98500'],['asks','asks you','#3987e5'],['refused','refused','#199e70']];
const FRST={critical:'#d03b3b',warning:'#fab219',good:'#0ca30c',info:'#8D919D'};
// match → [status, icon, words]; the order is the cards' order, worst first
const FRMATCH={unguarded:['critical','ShieldOff','Nothing says it, nothing stops it'],'only-asked':['critical','MessageSquareWarning','Said, but nothing enforces it'],
  'runtime-only':['warning','ShieldQuestion','Only {rt}\'s own check stands in the way'],'asks-instead':['warning','Hand','Asks you where the words say never'],
  'never-said':['info','EyeOff','Enforced, but no rule says so'],holds:['good','ShieldCheck','Your words and your rules agree'],none:['info','Minus','Nothing to compare']};
const FRORDER=['unguarded','only-asked','runtime-only','asks-instead','never-said','holds','none'];
// the tall segmented bar: one whole, its parts with their share inside when they fit; the legend names them in order
function frTall(parts,label){const tot=parts.reduce((a,p)=>a+p.n,0)||1;
  return `<div class="tb90" role="img" aria-label="${esc(label+': '+parts.filter(p=>p.n).map(p=>`${p.n} ${p.name}`).join(', '))}">${parts.filter(p=>p.n).map(p=>{const pc=Math.round(100*p.n/tot);
    return `<i style="flex:${p.n};background:${p.c}" title="${esc(`${p.name}: ${p.n} of ${tot} (${pc}%)`)}">${pc>=9?`<b>${pc}%</b>`:''}</i>`}).join('')}</div>
    <div class="lg90">${parts.filter(p=>p.n).map(p=>`<span><i style="background:${p.c}"></i>${esc(p.name)} <em>${p.n}</em></span>`).join('')}</div>`}
// the thin one, for a card: no text, its parts on hover
const frThin=parts=>{const tot=parts.reduce((a,p)=>a+p.n,0)||1;
  return `<div class="th90">${parts.filter(p=>p.n).map(p=>`<i style="flex:${p.n};background:${p.c}" title="${esc(`${p.n} ${p.name} (${Math.round(100*p.n/tot)}%)`)}"></i>`).join('')}</div>`};
const frNum=(n,one,many)=>`${n} ${n===1?one:many}`;

// free rein in the mode you're looking at: the harness's own, or one picked as a what-if (Free Rein judges Auto and
// Manual; another mode is read as the nearer of the two). The written rules are the same in every mode
// a runtime read from its pieces (anything but Claude Code, for now): the estimate for the kind of mode picked
function frNow(){const F=BASE.free_rein; if(!F) return null;
  if(F.by_level){const lv=typeof curPicks==='function'&&typeof modeLevel==='function'?modeLevel(curPicks()):null; const x=lv&&F.by_level[lv]; return x?{...F,...x,level:lv}:F}
  const m=ovOK()?ovData().m:F.mode; return {...F,...(((F.by_mode||{})[m])||{})}}
// the mode, as the header says it: the one picked, and which of the two judged modes it's read as
function frModeText(F){const ps=typeof curPicks==='function'?curPicks():[], lp=ps.find(p=>p.level!=='follows')||ps[0];
  if(F.estimated) return `${lp&&lp.name?`${lp.name} mode${lp.what?' (a what-if)':''}`:'its default mode'}, estimated`;
  const judged={auto:'Auto',manual:'Manual'}[F.mode]||F.mode;
  // the Situations tab's own Auto/Manual switch can read another mode than the picker's: then the one read is what's shown
  const near=lp&&typeof NEAR!=='undefined'?NEAR[lp.level]:null;
  if(near&&near!==F.mode) return `${judged} mode (a what-if)`;
  const nm=lp&&lp.name?lp.name:judged, what=lp&&lp.what?' (a what-if)':'';
  return nm.toLowerCase()===judged.toLowerCase()?`${judged} mode${what}`:`${nm} mode${what}, read as ${judged}`}
function freeViewHTML(){const F=frNow(), rt=(BASE.runtime||{}).name||'the runtime';
  if(!F) return `<div class="fv90"><p class="mu74">Free rein is measured for a folder: the actions an agent might take, played through its rules, and the rules written in its instructions.</p></div>`;
  const R=F.rules, on=F.own+F.runtime, mode=frModeText(F);
  const parts=k=>FRSEG.map(([key,name,c])=>({n:k[key],name:key==='runtime'?`${rt} decides`:name,c}));
  const mt=m=>{const x=FRMATCH[m]||FRMATCH.none; return {st:x[0],ic:x[1],t:x[2].replace('{rt}',rt)}};
  // the sentence the view leads with: how much it does alone, what's exposed, whether the written rules hold
  const lead=[`Your agent acts on its own in <b>${F.pct}%</b> of the ${F.actions} actions Free Rein tests`+(F.runtime?`, ${rt}'s own check deciding ${F.runtime} of them`:'')+'.',
    F.exposed?`<b class="cr">${frNum(F.exposed,'high-stakes action has','high-stakes actions have')} nothing in the way.</b>`:'No high-stakes action goes ahead unchecked.',
    R.measured?`${R.enforced} of the ${R.measured} written rules it can test ${R.enforced===1?'is':'are'} enforced.`:R.written?`None of the ${R.written} written rules is about an action it tests yet.`:''].filter(Boolean).join(' ');
  const tile=(label,value,sub,st,ic)=>`<div class="st90${st?' s-'+st:''}"><span class="lb">${ic?icon(ic,13):''}${esc(label)}</span><span class="vl">${value}</span><span class="sb">${sub}</span></div>`;
  const kinds=F.kinds.slice().sort((a,b)=>FRORDER.indexOf(a.match)-FRORDER.indexOf(b.match)||b.high-a.high);
  const card=k=>{const m=mt(k.match), what=parts(k).filter(p=>p.n).map(p=>`${p.n} ${p.name}`).join(' · ');
    return `<button class="kc90 s-${m.st}" data-stake="${esc(k.id)}" title="Open ${esc(k.name)} in Situations">
      <span class="ms" style="--sc:${FRST[m.st]}">${icon(m.ic,13)}${esc(m.t)}</span>
      <span class="nm">${esc(k.name)}${k.high?'':'<small>everyday</small>'}</span>
      <span class="rw"><em>Your words</em><span>${k.says?`<b>${esc(k.says)}</b> · ${frNum(k.rules,'rule','rules')}`:'<span class="dimk">say nothing</span>'}</span></span>
      <span class="rw"><em>When it tries</em><span>${esc(what||'—')}</span></span>${frThin(parts(k))}</button>`};
  // the written rules, from said to enforced; then the ones that don't hold, by the file they're in
  const fn=[['Written in its instructions',R.written,'#5B606C'],['About an action Free Rein tests',R.measured,'#3987e5'],['Enforced',R.enforced,FRST.good]];
  const mx=Math.max(1,R.written);
  const funnel=`<div class="fn90">${fn.map(([l,n,c])=>`<div class="fr"><span class="l">${esc(l)}</span><span class="tr"><i style="width:${Math.max(n?2:0,100*n/mx)}%;background:${c}"></i></span><b>${n}</b></div>`).join('')}</div>`;
  const byFile={}; for(const g of F.gaps) (byFile[g.file]=byFile[g.file]||[]).push(g);
  const skillOf=f=>{const m=/skills\/([^/]+)\/SKILL\.md$/.exec(f); return m?`/${m[1]}`:f.split('/').pop()};
  const clean=t=>String(t).replace(/^[-*]\s*/,'').replace(/\*\*/g,'').replace(/`/g,'');
  const gaps=Object.entries(byFile).map(([f,gs])=>`<div class="gf90"><div class="hd"><b>${esc(skillOf(f))}</b><a data-open="${esc(gs[0].path||'')}" data-lines="${gs[0].line}">${esc(f)}</a></div>
    ${gs.map(g=>`<div class="gr"><span class="ic" style="color:${g.backed===false?FRST.critical:FRST.warning}">${icon(g.backed===false?'MessageSquareWarning':'Hand',13)}</span>
      <span class="tx"><q>${esc(clean(g.text))}</q><small>${g.backed===false?'Only asked: nothing enforces it':'Asks you instead of refusing'}${g.what?` · ${esc(g.what)}`:''} · line ${g.line}</small></span>
      ${g.sits.length?`<button class="b50 sm" data-sitopen="${esc(g.sits[0])}">Enforce it</button>`:''}</div>`).join('')}</div>`).join('');
  // every written rule, grouped by status, each group a fold with what it means
  const RG=[['only-asked','Only asked','Said, but nothing enforces it: the agent can still do it.',FRST.critical,'MessageSquareWarning'],
    ['asks-instead','Ask you instead','The words say never; something asks you first instead of refusing.',FRST.warning,'Hand'],
    ['enforced','Enforced','A permission rule, a hook or a sandbox makes it so.',FRST.good,'ShieldCheck'],
    ['untested','Not tested yet','These name an action or a place (writing, committing, a folder), but Free Rein has no situation for it yet, so it can\'t tell whether anything enforces them. A rule that holds only at certain moments ("before the user confirms") is here too.','#3987e5','CircleDashed'],
    ['not-action','Not about an action','How to work, what to write, when to ask: guidance no permission rule or hook could enforce. Free Rein reads them, but there\'s nothing to test. The agent review, run by your own AI, is planned for these.','#5B606C','BookText']];
  const all=F.all||[];
  const ruleRow=r=>`<div class="rr90"><q>${esc(clean(r.text))}</q><span class="mt">${r.within?`<b>${esc(r.within)}</b> · `:''}<a data-open="${esc(r.path||'')}" data-lines="${r.line}">${esc(r.file.split('/').slice(-2).join('/'))}:${r.line}</a></span></div>`;
  const group=([st,name,about,c,ic])=>{const rs=all.filter(r=>r.status===st); if(!rs.length) return '';
    return `<details class="rg90"${st==='only-asked'?' open':''}><summary><span class="ic" style="color:${c}">${icon(ic,13)}</span><b>${esc(name)}</b><span class="ct">${rs.length}</span><span class="cv">${icon('ChevronDown',13)}</span></summary>
      <p class="ab">${esc(about)}</p>${rs.map(ruleRow).join('')}</details>`};
  const rulesSec=`<details class="sec90 fd90"${F.gaps.length?' open':''}><summary class="sh"><h3>Rules that don't hold <span class="ct">${F.gaps.length}</span></h3><p>Said in a skill or your instructions, but nothing stops the action.</p><span class="cv">${icon('ChevronDown',14)}</span></summary>
      ${gaps||`<p class="nt">${R.measured?'Every rule it can test holds.':'None found: no written rule is about an action Free Rein tests.'}</p>`}</details>
    <details class="sec90 fd90"><summary class="sh"><h3>All written rules <span class="ct n">${R.written}</span></h3><p>${R.measured} about an action Free Rein tests, ${R.enforced} enforced · ${R.untested||0} not tested yet · ${R.not_action||0} not about an action</p><span class="cv">${icon('ChevronDown',14)}</span></summary>
      ${funnel}<div class="rgs90">${RG.map(group).join('')}</div><button class="lk50" data-rulesall="">Open them as a table</button></details>`;
  return `<div class="fv90">
    <header class="hd90"><div><p class="ey">Free rein · ${esc(mode)} · ${esc(rt)}</p>${F.estimated?`<p class="es95">${icon('Info',13)} An estimate. Free Rein plays each action through the rules for Claude Code only, for now; for ${esc(rt)} it reads which pieces are in place (a hook or a sandbox that refuses, a gate that asks) and the kind of mode picked${F.level?` (${esc(({asks:'asks first',edits:'edits on its own',checker:'a checker decides',all:'runs everything','read-only':'reads only','allowed-only':'only what rules allow'})[F.level]||F.level)})`:''}.</p>`:''}</div><button class="lk50" data-checks="1">${icon('ListChecks',13)} How Free Rein knows</button></header>
    ${heroHTML(F,rt)}
    <section class="sec90"><div class="sh"><h3>Your words, beside what happens</h3><p>Each kind of action, worst first. Open one to see its actions and settle it.</p></div>
      <div class="kg90">${kinds.map(card).join('')}</div></section>
    ${rulesSec}
    ${agentFindingsHTML()}
  </div>`}
// the top: the share it does on its own, then each outcome as a row, stacked: what it means, how many, how many are
// high stakes, and (for refused) what refuses it. A row opens those situations; so does each tile below it
const OUTX={own:'Your permission rules or the mode let it go ahead: nothing asks you, nothing refuses.',
  runtime:'No rule of yours covers it. {rt}\'s own safety check decides each time, so it may go ahead or be stopped.',
  maybe:'A hook runs first and its script may refuse. Free Rein reads hooks, it doesn\'t run them, so it can\'t be sure.',
  asks:'It stops and waits for your yes.',
  refused:'Something of yours stops it every time: a deny rule, a hook that refuses, or a sandbox.'};
const OUTO={own:['ahead'],runtime:['classifier'],maybe:['depends'],asks:['asks'],refused:['held','blocked']};
// the top: the share it does on its own, then the actions split by what's at stake (everyday work should run on its
// own; high-stakes work is where free rein matters), each outcome a row that opens those actions; what each outcome
// means is said once, under them. Then the tiles, each opening what it counts
function heroHTML(F,rt){const D=ovOK()?ovData().d:null, SS=F.sits||(D?D.situations:[]), on=F.own+F.runtime;
  const every=SS.filter(s=>s.stakes==='everyday'), high=SS.filter(s=>s.stakes!=='everyday');
  const keyOf=s=>Object.keys(OUTO).find(k=>OUTO[k].includes(s.outcome))||'own';
  const nOf=(xs,k)=>xs.filter(s=>keyOf(s)===k).length;
  const nameOf=(k,name)=>k==='runtime'?`${rt} decides`:name[0].toUpperCase()+name.slice(1);
  const colOf=k=>(FRSEG.find(x=>x[0]===k)||[])[2]||'#5B606C';
  // the ring: what happens when it tries each action, its share of free rein in the middle
  const ring=(()=>{const R=62,C=2*Math.PI*R,tot=Math.max(1,F.actions); let off=0;
    const arcs=FRSEG.filter(([k])=>F[k]).map(([k,name,c])=>{const len=C*F[k]/tot, gap=F[k]===tot?0:2.5;
      const a=`<circle r="${R}" cx="80" cy="80" fill="none" stroke="${c}" stroke-width="16" stroke-dasharray="${Math.max(0.5,len-gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"><title>${esc(`${nameOf(k,name)}: ${F[k]} of ${F.actions}`)}</title></circle>`; off+=len; return a}).join('');
    return `<svg class="rg97" viewBox="0 0 160 160" width="168" height="168" role="img" aria-label="${esc(`Free rein ${F.pct}%`)}"><circle r="${R}" cx="80" cy="80" fill="none" stroke="#1D1F26" stroke-width="16"/>${arcs}
      <text x="80" y="82" text-anchor="middle" class="n">${F.pct}<tspan class="p">%</tspan></text><text x="80" y="104" text-anchor="middle" class="l">free rein</text></svg>`})();
  const chip=(k,name,c)=>F[k]?`<button class="cp97" data-fout="o:${k}" title="${esc(OUTX[k].replace('{rt}',rt))}"><i style="background:${c}"></i><b>${F[k]}</b>${esc(k==='runtime'?`${rt} decides`:name)}</button>`:'';
  // a kind of work: one square per action, coloured by what happens; a square opens its action; the chips its group
  const panel=(title,xs,grp,figure,label,verdict,tone)=>{const order=FRSEG.map(x=>x[0]), sq=xs.slice().sort((a,b)=>order.indexOf(keyOf(a))-order.indexOf(keyOf(b)));
    const legend=FRSEG.map(([k,name,c])=>{const n=nOf(xs,k); return n?`<button class="lc97" data-fout="o:${k}:${grp}" title="${esc(OUTX[k].replace('{rt}',rt))}"><i style="background:${c}"></i>${esc(nameOf(k,name))}<b>${n}</b></button>`:''}).join('');
    return `<div class="wk97 t-${tone}"><div class="hd"><span class="tt">${esc(title)}</span><span class="vd">${verdict}</span></div>
      <div class="fg"><span class="big">${figure}</span><span class="of">of ${xs.length}</span><span class="lb">${esc(label)}</span></div>
      <div class="wf97">${sq.map(s=>`<i style="background:${colOf(keyOf(s))}" data-sitopen="${esc(s.id)}" title="${esc((s.what||s.id)+': '+nameOf(keyOf(s),(FRSEG.find(x=>x[0]===keyOf(s))||[,''])[1]).toLowerCase())}"></i>`).join('')}</div>
      <div class="lg">${legend}</div></div>`};
  const eOn=nOf(every,'own')+nOf(every,'runtime'), eStop=every.length-eOn, hOn=nOf(high,'own')+nOf(high,'runtime'), hRt=nOf(high,'runtime'), hHeld=nOf(high,'asks')+nOf(high,'refused');
  const vE=!every.length?'':eStop?`${icon('Hand',12)} ${eStop} stop and wait`:`${icon('CircleCheck',12)} runs on its own, as it should`;
  const vH=!high.length?'':F.exposed?`${icon('ShieldOff',12)} ${F.exposed} with nothing in the way`:hRt?`${icon('ShieldQuestion',12)} ${hRt} left to ${esc(rt)}`:`${icon('ShieldCheck',12)} all held by you or your rules`;
  const R=F.rules;
  const tile=(label,value,sub,st,ic,attr,cta)=>`<button class="st90 ck91${st?' s-'+st:''}" ${attr}><span class="lb">${ic?icon(ic,13):''}${esc(label)}</span><span class="vl">${value}</span><span class="sb">${sub}</span><span class="cta">${esc(cta)} ${icon('ArrowRight',12)}</span></button>`;
  const legend=FRSEG.filter(([k])=>F[k]).map(([k,name,c])=>`<p><i style="background:${c}"></i><b>${esc(nameOf(k,name))}</b> ${esc(OUTX[k].replace('{rt}',rt))}</p>`).join('');
  return `<section class="hero97">
      <div class="top">${ring}<div class="tx"><h2>Your agent has free rein on <b>${F.pct}%</b> of what it tries</h2>
        <p>${on} of ${F.actions} actions go ahead without asking you or being refused.</p>
        <div class="cps">${FRSEG.map(([k,name,c])=>chip(k,name,c)).join('')}</div></div></div>
      <div class="cols">${panel('Everyday work',every,'every',eOn,'run on their own',vE,eStop?'warn':'good')}
        ${panel('High-stakes work',high,'high',hOn,'go ahead on their own',vH,F.exposed?'bad':hRt?'warn':'good')}</div>
      <p class="nt">Each square is one action Free Rein tested. Everyday work should run on its own; what matters is the high-stakes work.</p>
      <details class="lgd92"><summary>${icon('Info',13)} What each outcome means</summary>${legend}</details>
    </section>
    <section class="tiles90">
      ${tile('Exposed',F.exposed,F.exposed?'high-stakes actions go ahead with nothing in the way: not you, not a rule, not '+esc(rt)+'\'s check.':'No high-stakes action goes ahead with nothing in the way.',F.exposed?'critical':'good',F.exposed?'ShieldOff':'ShieldCheck','data-fout="exposed"',F.exposed?'Show them':'Show high stakes')}
      ${tile('Held by you or your rules',`${hHeld}<small> / ${high.length}</small>`,`high-stakes actions that ask you or are refused. The rest ${hRt?`are left to ${esc(rt)}'s own check`:'go ahead'}.`,high.length&&hHeld<high.length?'warning':'good','Hand','data-fout="o:asks:high"','Show what asks you')}
      ${tile('Written rules enforced',R.measured?`${R.enforced}<small> / ${R.measured}</small>`:'—',R.measured?`Of the ${R.measured} rules it can test (of ${R.written} written), how many a permission rule, hook or sandbox makes so.`:R.written?`${R.written} written, none about an action it tests yet.`:'No rules about actions written.',R.measured&&R.enforced<R.measured?'critical':R.measured?'good':'',R.measured&&R.enforced<R.measured?'MessageSquareWarning':'ScrollText','data-frrules="1"','See the rules')}
    </section>`}
function openOutcome(f){SITF=f;setList('sits');SUB='all';SITF=f;if(INSPHIDE&&typeof setInsp==='function')setInsp(false);else render()}
function bindFree(P){
  P.querySelectorAll('[data-fout]').forEach(b=>b.onclick=()=>openOutcome(b.dataset.fout));
  P.querySelectorAll('[data-frrules]').forEach(b=>b.onclick=()=>{const d=P.querySelectorAll('details.fd90')[1]; if(d){d.open=true;d.scrollIntoView&&d.scrollIntoView({behavior:'smooth',block:'start'})}});
  P.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>openStake(b.dataset.stake));
  P.querySelectorAll('[data-sitopen]').forEach(b=>b.onclick=()=>openSit(b.dataset.sitopen));
  P.querySelectorAll('[data-rulesall]').forEach(b=>b.onclick=()=>{RULESOF=null;RULEF=null;goView('rules')});
  P.querySelectorAll('[data-open]').forEach(a=>a.onclick=e=>{e.preventDefault&&e.preventDefault();typeof HOST!=='undefined'&&a.dataset.open&&HOST.open(a.dataset.open,a.dataset.lines?[+a.dataset.lines,+a.dataset.lines]:null)})}
