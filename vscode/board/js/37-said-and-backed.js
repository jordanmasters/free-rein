// ---- what the harness says, and whether anything makes it so (core/src/read/statements.ts, core/src/judge/backing.ts)
const SAIDK={rule:'Rules',direction:'Directions',trigger:'Triggers',claim:'Claims',definition:'Definitions',pointer:'Pointers'};
const BK={true:['backed','y','Check','Backed: something of yours makes it so'],partly:['asks instead','p','CircleDot','It says never, but what holds only asks you first'],false:['not backed','n','X','Followed only if the model chooses to'],null:['not measured','u','Minus','Free Rein doesn\'t measure a situation for this yet']};
const saidOf=()=>BASE.said||null;
const bkOf=st=>{const S=saidOf(), b=S&&S.backing[st.id]; return b?b:null};
const bkKey=b=>b?String(b.backed):'null';
// situation id -> the statements that speak about it
function saidBySit(){const S=saidOf(); if(!S) return {}; if(S._by) return S._by; const by={};
  for(const st of S.statements){const b=S.backing[st.id]; (b&&b.situations||[]).forEach(r=>{(by[r.id]=by[r.id]||[]).push(st)})}
  Object.defineProperty(S,'_by',{value:by,enumerable:false}); return by}
// make an unbacked rule so: each of its situations gets the call the rule asks for (never, or ask), in the draft, measured
function makeSo(id){const S=saidOf(), st=S&&S.statements.find(x=>x.id===id), b=st&&S.backing[id]; if(!b||!ovOK()) return;
  const {d}=ovData(), ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], rules=[...draftRules()], c=b.want.includes('held')&&!b.want.includes('asks')?'never':b.want.includes('held')?'never':'ask';
  let n=0; b.situations.filter(r=>!r.ok).forEach(r=>{const x=d.situations.find(y=>y.id===r.id), call=x&&x.calls&&x.calls[c]; if(!call) return;
    const i=rules.findIndex(y=>y.sit===x.id); if(i>=0) rules.splice(i,1); rules.push({kind:call.kind,rule:call.rule,sit:x.id,preset:'said'}); n++});
  if(!n){PENDING={what:'Nothing to add: these situations can\'t be decided by a rule here'};head();setTimeout(()=>{PENDING=null;head()},1800);return}
  PENDING={what:`Measuring rules that make it so: ${st.text.slice(0,60)}…`};busy();head();HOST.draft({ups,rules})}
// where a rule applies: a mode's or a skill's rules apply while it runs, which a global permission rule can't express
function whereOf(st){if(st.scope!=='unit'&&st.scope!=='step') return null; const f=st.source.file, m=f.match(/([^/]+)\/(SKILL|PROTOCOL)\.md$/);
  return m?(m[2]==='PROTOCOL'?`the ${m[1]} protocol`:`/${m[1]}`):null}
function ruleRow(st,opts={}){const b=bkOf(st), k=BK[bkKey(b)], hosted=typeof HOST!=='undefined'&&canDraft()&&!BASE.profile, where=whereOf(st);
  const fixable=b&&b.backed!==true&&b.backed!==null&&b.situations.some(r=>!r.ok)&&!where;
  return `<div class="sr79 ${k[1]}"><span class="mk" title="${esc(k[3])}">${icon(k[2],11)}</span><div class="tx">
      <p>${esc(st.text.replace(/^(>\s*|[-*]\s*)+/,'').replace(/\*\*/g,''))}</p>
      <small><a data-open="${esc(st.source.file)}" data-path="${esc(st.path||'')}" data-lines="${st.source.line}" title="Open it">${esc(st.source.file)}:${st.source.line}</a> · ${esc(k[0])}${b&&b.backed!==null?`: ${esc(b.why)}`:''}</small>
      ${b&&b.situations.length&&opts.full!==false?`<span class="ss79">${b.situations.slice(0,4).map(r=>`<button data-sit79="${esc(r.id)}" class="${r.ok?'y':r.partly?'p':'n'}" title="${esc(r.what)}: ${esc(r.outcome)}${r.by&&r.by.length?' · '+esc(r.by.map(x=>x.piece).join(', ')):''}">${esc(r.what.length>34?r.what.slice(0,33)+'…':r.what)}</button>`).join('')}${b.situations.length>4?`<i>+${b.situations.length-4}</i>`:''}</span>`:''}
      ${where&&b&&b.backed!==true&&b.backed!==null?`<p class="wh79">${icon('Info',11)} Applies while ${esc(where)} runs. A permission rule would apply everywhere, so this needs a hook that knows what's running.</p>`:''}
      ${hosted&&fixable?`<button class="b50 sm" data-makeso="${esc(st.id)}">${icon('Wand2',12)} ${b.backed==='partly'?'Refuse it instead':'Make it so'}</button>`:''}</div></div>`}
function bindSaid(root){root.querySelectorAll('[data-makeso]').forEach(b=>b.onclick=e=>{e.stopPropagation&&e.stopPropagation();makeSo(b.dataset.makeso)});
  root.querySelectorAll('[data-sit79]').forEach(b=>b.onclick=e=>{e.stopPropagation&&e.stopPropagation();openSit(b.dataset.sit79)});
  root.querySelectorAll('[data-open]').forEach(a=>{if(!a.onclick)a.onclick=e=>{e.preventDefault&&e.preventDefault();const f=a.dataset.open;if(typeof HOST!=='undefined'&&HOST.open)HOST.open(a.dataset.path||f,a.dataset.lines?[+a.dataset.lines]:null)}})}
// 1. a piece's pane: what its files say
// what it says: how much of what's written is enforced, as one meter; the rules nothing enforces, grouped by what
// they're about (top three); every rule, with its file and line, in a table in the main area
function saidHTML(t){const S=saidOf(); if(!S) return ''; const mine=S.statements.filter(x=>x.piece===t.id); if(!mine.length) return '';
  const rules=mine.filter(x=>x.kind==='rule'), cnt=k=>rules.filter(x=>bkKey(bkOf(x))===k).length, n=rules.length||1;
  const seg=[['true','#7FD6A6','enforced'],['partly','#F2C35B','asks instead'],['false','#FF8A80','need a guard'],['null','#3A3F4B','not measured yet']];
  const groups={}; rules.filter(x=>['false','partly'].includes(bkKey(bkOf(x)))).forEach(x=>{const b=bkOf(x), s0=(b.situations||[])[0], k=s0?s0.what:'Other rules'; (groups[k]=groups[k]||[]).push(x)});
  const gs=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length), others=Object.keys(SAIDK).filter(k=>k!=='rule').map(k=>[k,mine.filter(x=>x.kind===k).length]).filter(([,c])=>c);
  const hosted=typeof HOST!=='undefined'&&canDraft();
  return `${rules.length?`<div class="mt79">${seg.map(([k,c])=>cnt(k)?`<i style="flex:${cnt(k)};background:${c}" title="${cnt(k)} ${seg.find(x=>x[0]===k)[2]}"></i>`:'').join('')}</div>
    <p class="lg79">${seg.filter(([k])=>cnt(k)).map(([k,c,l])=>`<span><i style="background:${c}"></i>${cnt(k)} ${l}</span>`).join('')}</p>`:''}
    ${gs.slice(0,3).map(([what,xs])=>`<div class="gc79"><span class="d"></span><div class="tx"><b>${esc(what)}</b><small>${xs.length} rule${xs.length>1?'s':''} say${xs.length>1?'':'s'} so${(w=>w.length?' · '+w.join(', '):'')([...new Set(xs.map(x=>whereOf(x)).filter(Boolean))].slice(0,2).map(esc))}</small></div>${hosted&&ovOK()?`<button class="b50 sm" data-makeso="${esc(xs[0].id)}">Guard it</button>`:''}</div>`).join('')}
    ${gs.length>3?`<p class="mute">and ${gs.length-3} more things your rules ask for</p>`:''}
    <button class="lk50" data-rulesall="${esc(t.id)}">See all ${mine.length} ${rules.length===mine.length?'rules':'things it says'}, with their files</button>
    ${others.length?`<p class="mute">Besides rules: ${others.map(([k,c])=>`${c} ${SAIDK[k].toLowerCase()}`).join(' · ')}</p>`:''}`}
// every rule and sentence a piece says, as a table in the main area: what it says, where, whether anything enforces it
let RULESOF=null, RULEF=null;
function rulesTableHTML(){const S=saidOf(); if(!S) return '<p class="mute">Nothing read.</p>';
  const rows=S.statements.filter(x=>!RULESOF||x.piece===RULESOF), t=RULESOF&&find(RULESOF), ord=b=>({false:0,partly:1,true:2,null:3})[bkKey(b)];
  const ST={false:['needs a guard','#FF8A80'],partly:['asks instead','#F2C35B'],true:['enforced','#7FD6A6'],null:['not measured','#8D919D']};
  const shown=rows.filter(x=>!RULEF||bkKey(bkOf(x))===RULEF).sort((a,b)=>ord(bkOf(a))-ord(bkOf(b))||String(a.source.file).localeCompare(b.source.file)||a.source.line-b.source.line);
  const f=k=>{const c=rows.filter(x=>bkKey(bkOf(x))===k).length;return c?`<button class="b50 sm${RULEF===k?' cur':''}" data-rulef="${k}">${ST[k][0]} · ${c}</button>`:''};
  return `<p class="mute rc86">Found by matching words, not read by a model: the <mark class="mw86">marked</mark> words are what made each sentence a rule. A rule said another way is missed. <button class="lk50" data-checks="1">Every check</button></p><div class="rf79"><button class="b50 sm${!RULEF?' cur':''}" data-rulef="">all · ${rows.length}</button>${['false','partly','true','null'].map(f).join('')}</div>
    <div class="tw79"><table class="rt79"><thead><tr><th>What it says</th><th>Where</th><th>Enforced?</th><th>About</th></tr></thead><tbody>${shown.slice(0,400).map(x=>{const b=bkOf(x), st=ST[bkKey(b)], s0=b&&(b.situations||[])[0];
      return `<tr><td>${markWords(String(x.text).replace(/^[-*]\s*/,'').replace(/\*\*/g,'').slice(0,220),x.matched)}${x.kind!=='rule'?` <small class="mute">${esc((SAIDK[x.kind]||x.kind).toLowerCase().replace(/s$/,''))}</small>`:''}</td>
        <td><a data-open="${esc(x.source.file)}" data-path="${esc(x.path||'')}" data-lines="${x.source.line}">${esc(String(x.source.file).split('/').slice(-2).join('/'))}:${x.source.line}</a></td>
        <td><span class="vd70" style="--vc:${st[1]}">${st[0]}</span></td><td class="mute">${esc(s0?s0.what:'')}</td></tr>`}).join('')}</tbody></table></div>${shown.length>400?`<p class="mute">The first 400 of ${shown.length}.</p>`:''}`}
