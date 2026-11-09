// ---- Context: everything the agent reads (instructions, skills, its own notes), when each enters its context, where it
// applies, who wrote it, and what it says, sentence by sentence (core/src/report/words.ts). One channel per meaning:
// colour is the kind of sentence and nothing else; the row is when it loads; the heading is where it applies; a tag
// says who wrote it. Sizes are estimates (characters / 4).
// five hues in the reference order, checked for colour-blind separation on the board's surface (#14161B: worst
// adjacent ΔE 8.4, all at least 3:1), and a gray for what isn't placed. Steps and when-to-use share one; so do facts,
// definitions and claims
const WKIND=[['no','Never / avoid','#3987e5'],['do','Always / should','#d95926'],['how','Steps and when to use','#199e70'],['fact','Facts and definitions','#c98500'],
  ['pointer','Pointers','#d55181'],['residual','Not classified','#4B4F5A']];
const WCOL=Object.fromEntries(WKIND.map(([k,,c])=>[k,c]));
const WFOLD={direction:'how',trigger:'how',fact:'fact',definition:'fact',claim:'fact',pointer:'pointer'};
const WMOM=[['start','From the start of every session','Loaded before you type: every word here costs context in every session'],
  ['folder','When work reaches a folder','A subfolder\'s instructions, and rules for some paths, load once it works there'],
  ['use','When a skill or command is used','The body loads when it\'s used, and stays for the rest of the session'],
  ['demand','When your agent opens it','Its notes and the files instructions point to: read only when it needs them'],
  ['hook','When a hook adds it','Text a hook injects as a session runs: Free Rein reads hooks, it doesn\'t run them, so it can\'t see what they add']];
const WLAYER={org:'Your organization',user:'You, every repo',project:'This repo, shared',local:'This repo, just you'};
const WORDER=['org','user','project','local'];
// a sentence's colour key: a rule by its direction, else its kind
const wkey0=(k,st)=>k==='rule'?(/not/.test(st||'')?'no':'do'):(WFOLD[k]||'residual');
// a sentence your agent placed takes its kind, marked as your agent's (it never counts toward verdicts)
const wkey=s=>s.kind==='residual'&&s.agent?wkey0(s.agent.kind,s.agent.strength):wkey0(s.kind,s.strength);
const wtok=n=>n>=1000?`${(n/1000).toFixed(n>=10000?0:1)}k`:String(n);
function wname(f){const m=/skills\/([^/]+)\/SKILL\.md$/.exec(f.file); if(m) return '/'+m[1]; return f.file.split('/').pop()}
// the sentences of one part: a skill's description is its start, the rest its body
function wsents(f,when){const d=s=>s.from==='frontmatter description';
  return f.parts.length>1?f.sentences.filter(s=>when==='start'?d(s):!d(s)):f.sentences}
function wbar(sents,w){const n={},a={};for(const s of sents){const k=wkey(s);(s.agent&&s.kind==='residual'?a:n)[k]=((s.agent&&s.kind==='residual'?a:n)[k]||0)+1}
  const seg=(m,ag)=>WKIND.filter(([k])=>m[k]).map(([k,name])=>`<i class="${ag?'ag':''}" style="flex:${m[k]};--c:${WCOL[k]}" title="${esc(name)}${ag?', as your agent read it':''}: ${m[k]}"></i>`).join('');
  return `<span class="wb91" style="width:${w}%">${sents.length?seg(n,false)+seg(a,true):'<i style="flex:1;--c:#23262E"></i>'}</span>`}
const WBACK={true:['ShieldCheck','#4FC24F','Enforced'],partly:['Hand','#fab219','Asks, doesn\'t refuse'],false:['MessageSquareWarning','#FF8A80','Only said: nothing enforces it']};
function wreading(f,when){const ss=wsents(f,when).slice().sort((a,b)=>a.line-b.line);
  return `<div class="rd91">${ss.map(s=>{const b=s.kind==='rule'&&s.backed!=null&&s.backed!==undefined?WBACK[String(s.backed)]:null;
    const ag=s.kind==='residual'&&s.agent;
    return `<a class="sn91${ag?' ag':''}" data-open="${esc(f.path)}" data-lines="${s.line}" title="Line ${s.line}: open it"><i style="--c:${WCOL[wkey(s)]}"></i><span>${esc(s.text.replace(/\*\*/g,''))}${ag?' <small class="ag91">your agent\'s reading</small>':''}</span>${b?`<em style="color:${b[1]}" title="${esc(b[2])}">${icon(b[0],12)}</em>`:''}</a>`}).join('')||'<p class="mu74">Nothing Free Rein could read as a sentence.</p>'}</div>`}
function wfile(f,when,max){const p=f.parts.find(x=>x.when===when), ss=wsents(f,when);
  const who=f.who==='agent'?'<i class="wh91 ag">your agent</i>':f.who==='package'?`<i class="wh91 pk">${esc(f.pkg||'package')}</i>`:'';
  const r=f.rules, rl=when!=='start'||f.parts.length===1?[r.enforced?`${r.enforced} enforced`:'',r.only_said?`${r.only_said} only said`:''].filter(Boolean).join(' · '):'';
  const nt=f.note&&f.note.findings.length?`<small class="nf91">${icon('TriangleAlert',11)} ${esc(f.note.findings.join('; '))}</small>`:'';
  return `<details class="wf91"><summary><span class="nm">${esc(wname(f))}${who}</span>${wbar(ss,Math.max(2,100*p.tokens/max))}<span class="tk">~${wtok(p.tokens)}</span>${rl?`<span class="rl">${esc(rl)}</span>`:''}${nt}</summary>
    <div class="fp91"><a data-open="${esc(f.path)}">${esc(f.file)}</a>${f.note?`<span>${esc([f.note.type,f.note.modified].filter(Boolean).join(' · '))}</span>`:''}</div>${wreading(f,when)}</details>`}
// who wrote it, as the dashboard groups it: you, each package, your agent
const wwho=f=>f.who==='agent'?'Your agent\'s notes':f.who==='package'?(f.pkg||'A package'):'Yours';
const wpct=(n,of)=>of?Math.round(100*n/of):0;
const wtip=(t,...ls)=>esc([t,...ls].join('\n'));
// the dashboard: the headline numbers, what loads at the start, where the words live, what they say (with an example
// of each), and the rules Free Rein can test. Tables and ranked bars on one baseline: read as text, not decoded
function wdash(W){const T=W.totals, later=T.tokens-T.start_tokens, unc=wpct(T.unclassified,T.sentences);
  const tile=(label,value,sub,ic,st)=>`<div class="st90${st?' s-'+st:''}"><span class="lb">${icon(ic,13)}${esc(label)}</span><span class="vl">${value}</span><span class="sb">${sub}</span></div>`;
  const noteIssues=W.files.filter(f=>f.note&&f.note.findings.length).length;
  const kpi=`<div class="tiles90">${tile('At the start of every session',`~${wtok(T.start_tokens)}<small> tokens</small>`,`before you type; up to ~${wtok(later)} more as it works`,'Sunrise')}
    ${tile('Files it reads',String(T.files),`${W.files.filter(f=>f.who==='you').length} yours, ${W.files.filter(f=>f.who==='package').length} from packages, ${T.agent_notes} your agent's notes`,'Files')}
    ${tile('Rules enforced',`${T.enforced}<small> of ${T.enforced+T.asks+T.only_said} it can test</small>`,`${T.rules} rules in all; most aren't about an action Free Rein plays out`,'ShieldCheck',T.only_said?'warning':'')}
    ${tile('Not classified',`${unc}<small>%</small>`,'of sentences: mostly preferences with no never or always','CircleHelp',unc>30?'warning':'')}
    ${T.agent_notes?tile('Your agent\'s notes',String(T.agent_notes),noteIssues?`${noteIssues} need${noteIssues===1?'s':''} a look: a file that's gone, or old`:`${T.agent_rules} rules it gave itself`,'Brain',noteIssues?'warning':''):''}</div>`;
  // what loads at the start, by who wrote it: ranked, largest first, one baseline
  const st={}; for(const f of W.files){const p=f.parts.find(x=>x.when==='start'); if(p){const k=f.who==='package'?`${f.pkg||'A package'}'s skills`:f.who==='agent'?'Your agent\'s notes (the index)':'Your instructions and skills'; st[k]=(st[k]||0)+p.tokens}}
  const sr=Object.entries(st).sort((a,b)=>b[1]-a[1]), smax=Math.max(1,...sr.map(x=>x[1]));
  const start=`<section class="cd92"><h3>What loads at the start<small>Every session begins with these, before you type: ~${wtok(T.start_tokens)} tokens.</small></h3>
    <div class="rk92">${sr.map(([k,n])=>`<div class="rr92"><span class="l">${esc(k)}</span><span class="t"><i style="width:${Math.max(1,100*n/smax)}%"></i></span><b>~${wtok(n)}</b><em>${wpct(n,T.start_tokens)}%</em></div>`).join('')}</div></section>`;
  // where the words live: a row per layer
  const LS=WORDER.filter(l=>W.files.some(f=>f.layer===l));
  const lrow=l=>{const fs=W.files.filter(f=>f.layer===l), at=fs.reduce((n,f)=>n+(f.parts.find(p=>p.when==='start')||{tokens:0}).tokens,0), all=fs.reduce((n,f)=>n+f.parts.reduce((a,p)=>a+p.tokens,0),0);
    const who={}; for(const f of fs){const k=f.who==='package'?(f.pkg||'package'):f.who==='agent'?'your agent':'you'; who[k]=(who[k]||0)+1}
    return `<tr><th>${esc(WLAYER[l])}</th><td class="n">${fs.length}</td><td class="n">~${wtok(at)}</td><td class="n">~${wtok(all-at)}</td><td class="w">${esc(Object.entries(who).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${n}`).join(' · '))}</td></tr>`};
  const where=`<section class="cd92"><h3>Where your words live<small>Where each file applies, and how much of it loads at the start or later.</small></h3>
    <div class="tw92"><table class="tb92"><thead><tr><th>Applies to</th><th class="n">Files</th><th class="n">At the start</th><th class="n">Later</th><th>Written by</th></tr></thead><tbody>${LS.map(lrow).join('')}</tbody></table></div></section>`;
  // what the words say: a row per kind, with how many and a real example from your own files where there is one
  const cnt={}, ex={}, all=T.sentences||1; const mineFirst=W.files.slice().sort((a,b)=>(a.who==='you'?0:a.who==='agent'?2:1)-(b.who==='you'?0:b.who==='agent'?2:1));
  // a good example says its kind in its own words: a rule its never or always, a step its verb; short, a whole sentence
  const SAYS={no:/\b(never|don'?t|do not|avoid|must not|no )\b/i,do:/\b(always|must|should|only)\b/i,how:/^(\d+[.)]\s*)?[A-Z]?[a-z]+\b|\buse (this )?when\b/,fact:/\b(is|are|has|holds|runs|uses)\b/i,pointer:/`[^`]+`|\/[\w-]+|see /i,residual:/./};
  const LEADS={no:/^(never|don'?t|do not|avoid|no )/i,do:/^(always|must|only|prefer|use )/i};
  const score=(k,t,f)=>(f.who==='you'?0:f.who==='agent'?60:30)+(SAYS[k]&&SAYS[k].test(t)?0:200)+(LEADS[k]&&!LEADS[k].test(t)?80:0)+Math.abs(t.length-60)/4;
  for(const f of mineFirst) for(const s of f.sentences){const k=wkey(s); cnt[k]=(cnt[k]||0)+1; const t=s.text.replace(/\*\*/g,'').replace(/^[-*]\s*/,'').trim();
    if(t.length<16||t.length>110||/^[\[(#]/.test(t)||/:$/.test(t)) continue; const sc=score(k,t,f); if(!ex[k]||sc<ex[k].sc) ex[k]={t,f,line:s.line,sc}}
  const kmax=Math.max(1,...Object.values(cnt));
  const kinds=`<section class="cd92 wide"><h3>What your words say<small>Every sentence, sorted by kind. An example of each, from your own files first; click one to open it.</small></h3>
    <div class="tw92"><table class="tb92 kt92"><thead><tr><th>Kind</th><th class="n">Sentences</th><th class="s">Share</th><th>For example</th></tr></thead><tbody>${WKIND.filter(([k])=>cnt[k]).map(([k,name,c])=>`<tr><th><i class="sw92" style="background:${c}"></i>${esc(name)}</th><td class="n">${cnt[k]}</td>
      <td class="s"><span class="sv"><span class="t"><i style="width:${Math.max(1,100*cnt[k]/kmax)}%;background:${c}"></i></span><em>${wpct(cnt[k],all)}%</em></span></td>
      <td class="x">${ex[k]?`<a data-open="${esc(ex[k].f.path)}" data-lines="${ex[k].line}" title="${esc(ex[k].f.file)}, line ${ex[k].line}">“${esc(ex[k].t)}”<small>${esc(wname(ex[k].f))}</small></a>`:''}</td></tr>`).join('')}</tbody></table></div>
    ${T.agent_placed?`<p class="ft92">${icon('Sparkles',13)}<span>Your agent placed ${T.agent_placed} of the unclassified sentences; they're outlined in the files below and never counted.</span></p>`:''}</section>`;
  // the rules Free Rein can test, quoted: enforced, asks first, or only said
  const RB={false:['MessageSquareWarning','#FF8A80','Only said'],partly:['Hand','#fab219','Asks first'],true:['ShieldCheck','#4FC24F','Enforced']};
  const tested=[]; for(const f of W.files) for(const s of f.sentences) if(s.kind==='rule'&&s.backed!==null&&s.backed!==undefined) tested.push({s,f});
  tested.sort((a,b)=>['false','partly','true'].indexOf(String(a.s.backed))-['false','partly','true'].indexOf(String(b.s.backed)));
  const rules=`<section class="cd92 wide"><h3>Rules Free Rein can test<small>${tested.length?`${tested.length} of the ${T.rules} rules are about an action Free Rein plays out. Here's whether each holds.`:`None of the ${T.rules} rules is about an action Free Rein plays out, so it can't tell whether they hold.`}</small></h3>
    ${tested.length?`<div class="rl92">${tested.slice(0,12).map(({s,f})=>{const b=RB[String(s.backed)]; return `<a class="ri92" data-open="${esc(f.path)}" data-lines="${s.line}"><span class="st" style="color:${b[1]}">${icon(b[0],13)}${esc(b[2])}</span><span class="q">“${esc(s.text.replace(/\*\*/g,'').replace(/^[-*]\s*/,''))}”</span><small>${esc(wname(f))}${f.who==='package'?` · ${esc(f.pkg||'')}`:f.who==='agent'?' · your agent':''}</small></a>`}).join('')}</div>`:''}</section>`;
  return `<div class="db92">${kpi}${wreadHTML(W)}<div class="g92">${start}${where}</div>${kinds}${rules}</div>`}
function wordsViewHTML(){const W=BASE.words, rt=(BASE.runtime||{}).name||'the runtime';
  if(!W) return `<div class="fv90"><p class="mu74">Free Rein reads the words for a folder read on Claude Code, for now: switch the runtime back to see them.</p></div>`;
  const T=W.totals, max=Math.max(1,...W.files.flatMap(f=>f.parts.map(p=>p.tokens)));
  const later=T.tokens-T.start_tokens, pct=T.sentences?Math.round(100*T.unclassified/T.sentences):0;
  const lead=`Your agent reads <b>${T.files} file${T.files===1?'':'s'}</b>: about <b>${wtok(T.start_tokens)} tokens</b> at the start of every session, and up to ${wtok(later)} more as it works. `+
    (T.rules?`Of their ${T.rules} rule${T.rules===1?'':'s'}, ${T.enforced} ${T.enforced===1?'is':'are'} enforced.`:'')+(T.agent_notes?` ${T.agent_notes} file${T.agent_notes===1?' is':'s are'} notes your agent wrote for itself.`:'');
  const dash=wdash(W);
  const row=([k,name,tip])=>{
    if(k==='hook') return W.hooks.length?`<section class="wm91"><h3>${icon('Zap',14)}${esc(name)}<small>${esc(tip)}</small></h3>${W.hooks.map(h=>`<div class="wf91 hk"><span class="nm">${esc(h.label)}</span><span class="tk">${esc(WLAYER[h.layer]||'')}</span></div>`).join('')}</section>`:'';
    const fs=W.files.filter(f=>f.parts.some(p=>p.when===k)); if(!fs.length) return '';
    const sum=fs.reduce((n,f)=>n+f.parts.find(p=>p.when===k).tokens,0);
    const groups=WORDER.map(l=>[l,fs.filter(f=>f.layer===l)]).filter(([,g])=>g.length).map(([l,g])=>{
      // a package's files fold into one row, so your own words aren't lost among them
      const own=g.filter(f=>f.who!=='package'), pk={}; for(const f of g.filter(f=>f.who==='package')) (pk[f.pkg]=pk[f.pkg]||[]).push(f);
      const fold=Object.entries(pk).map(([n,ps])=>{const t=ps.reduce((a,f)=>a+f.parts.find(p=>p.when===k).tokens,0);
        return `<details class="pk91"><summary>${icon('Package',13)}<b>${esc(n)}</b><span>${ps.length} file${ps.length===1?'':'s'}</span><span class="tk">~${wtok(t)}</span></summary>${ps.map(f=>wfile(f,k,max)).join('')}</details>`}).join('');
      return `<div class="wl91"><h4>${esc(WLAYER[l]||l)}</h4>${own.map(f=>wfile(f,k,max)).join('')}${fold}</div>`}).join('');
    return `<section class="wm91" id="wm-${k}"><h3>${icon(k==='start'?'Sunrise':k==='folder'?'FolderTree':k==='use'?'Wrench':'BookOpen',14)}${esc(name)}<b>~${wtok(sum)}</b><small>${esc(tip)}</small></h3>${groups}</section>`};
  return `<div class="fv90 wv91"><div class="hd90"><div><p class="ey">Context · ${esc(rt)}</p><h2>${lead}</h2></div>
    <span class="bt91"><button class="lk50" data-rulesall="1">${icon('ListChecks',13)}All the rules</button>${typeof HOST!=='undefined'&&!BASE.profile?(AGENTREVIEW?`<button class="lk50" data-review="1">${icon('Sparkles',13)}${BASE.review?'Read again with your agent':'Ask your agent to read the rest'}</button>`:`<button class="lk50" data-reviewon="1">${icon('Sparkles',13)}Turn on your agent's reading</button>`):''}</span></div>${dash}
    ${W.recorded?'':`<p class="mu74">${esc(rt)}'s record doesn't say yet when each kind loads: these are Claude Code's moments.</p>`}
    <h3 class="sh92">Every file, by when it loads</h3>
    ${WMOM.map(row).join('')}
    <p class="mu74">Sizes are estimates: about four characters to a token. Open a file to read it sentence by sentence; a line opens it in the editor.</p></div>`}
function bindWords(P){
  // hover: what each mark is, in the board's own tooltip
  P.querySelectorAll('[data-wtip]').forEach(m=>{m.onmouseenter=e=>{const t=$('v44tip'); if(!t) return; const [h,...ls]=m.dataset.wtip.split('\n'); t.innerHTML=`<b>${esc(h)}</b>${ls.filter(Boolean).map(l=>`<span class="lt-l">${esc(l)}</span>`).join('')}`; t.hidden=false; typeof moveTip==='function'&&moveTip(e)};
    m.onmousemove=e=>typeof moveTip==='function'&&moveTip(e); m.onmouseleave=()=>{const t=$('v44tip'); if(t) t.hidden=true}});
  // a square opens its moment below
  P.querySelectorAll('[data-wgo]').forEach(b=>b.onclick=()=>{const s=P.querySelector('#wm-'+b.dataset.wgo); s&&s.scrollIntoView&&s.scrollIntoView({behavior:'smooth',block:'start'})});
  P.querySelectorAll('[data-rulesall]').forEach(b=>b.onclick=()=>{RULESOF=null;RULEF=null;goView('rules')});
  P.querySelectorAll('[data-open]').forEach(a=>a.onclick=e=>{e.preventDefault&&e.preventDefault();e.stopPropagation&&e.stopPropagation();typeof HOST!=='undefined'&&a.dataset.open&&HOST.open(a.dataset.open,a.dataset.lines?[+a.dataset.lines,+a.dataset.lines]:null)})}

// the extension says a review has started, or sends you to a view (from its notification that the review is back)
if(typeof window!=='undefined'&&window.addEventListener) window.addEventListener('message',e=>{const m=e.data; if(!m) return;
  if(m.type==='reviewing'&&typeof BASE!=='undefined'&&BASE){BASE.reviewing=m.since;render();return}
  if(m.type==='goto'&&m.bview){VIEW='board';try{localStorage.setItem('v44-view','board')}catch(x){}setBView(m.bview);
    if(m.agent) setTimeout(()=>{const d=document.getElementById('agent92');if(d){d.open=true;d.scrollIntoView&&d.scrollIntoView({behavior:'smooth',block:'start'})}},60)}});
// your agent's reading, on the Context view: waiting for it, or what it came back with
function wreadHTML(W){const RV=BASE.review, T=W.totals;
  if(BASE.reviewing&&(!RV||!RV.at||RV.at<BASE.reviewing)) return `<section class="cd92 wide rv92 wait"><h3>${icon('LoaderCircle',14)} Waiting for your agent's review<small>Asked ${esc(agoText(BASE.reviewing))}. When it writes .free-rein/review.json, Free Rein reads it back by itself and tells you.</small></h3></section>`;
  if(!RV||!RV.at) return '';
  const unc=T.sentences?Math.round(100*T.unclassified/T.sentences):0, after=T.sentences?Math.round(100*(T.unclassified-(T.agent_placed||0))/T.sentences):0;
  const rules=[]; for(const f of W.files) for(const s of f.sentences) if(s.kind==='residual'&&s.agent&&s.agent.kind==='rule') rules.push({s,f});
  const rr=rules.slice(0,6).map(({s,f})=>`<a class="ri92" data-open="${esc(f.path)}" data-lines="${s.line}"><span class="st ag">${icon('Sparkles',13)}${esc(/not/.test(s.agent.strength||'')?'Never / avoid':'Always / should')}</span><span class="q">“${esc(s.text.replace(/\*\*/g,'').replace(/^[-*]\s*/,''))}”</span><small>${esc(wname(f))}${f.who==='package'?` · ${esc(f.pkg||'')}`:''}</small></a>`).join('');
  return `<section class="cd92 wide rv92"><h3>${icon('Sparkles',14)} Your agent's reading<small>By ${esc(RV.agent)}, ${esc(agoText(RV.at))}. Every quote was checked against its file. It's shown as your agent's and never counts toward verdicts.</small></h3>
    <div class="rs92"><div><b>${RV.findings.length}</b><span>finding${RV.findings.length===1?'':'s'}${RV.dropped.length?`, ${RV.dropped.length} dropped`:''}</span></div>
      <div><b>${T.agent_placed||0}</b><span>sentences placed</span></div><div><b>${unc}% → ${after}%</b><span>not classified, before and after</span></div>
      <div><b>${T.agent_found_rules||0}</b><span>rules it found the patterns missed</span></div></div>
    ${rr?`<div class="rl92">${rr}</div>`:''}
    <p class="ft92">${RV.findings.length?`<button class="lk50" data-agentfind="1">${icon('ArrowRight',12)}See its ${RV.findings.length} finding${RV.findings.length===1?'':'s'}</button>`:''}${RV.changed_since.length?`<span><b>${RV.changed_since.length}</b> file${RV.changed_since.length===1?'':'s'} it cited changed since: ask again to bring it up to date.</span>`:''}</p></section>`}
