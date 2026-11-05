// ---- Rules: what you wrote, grouped by what it says, one line each
const ruleKey=t=>t.toLowerCase().replace(/[*`>_]/g,'').replace(/^[-\s]+/,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function ruleGroups(){const S=BASE.said; if(!S) return []; const G={};
  S.statements.filter(x=>x.kind==='rule').forEach(x=>{const k=ruleKey(x.text); (G[k]=G[k]||{key:k,items:[]}).items.push(x)});
  return Object.values(G).map(g=>{const bs=g.items.map(bkOf), m=bs.filter(b=>b&&b.backed!==null), worst=m.find(b=>b.backed===false)?'false':m.find(b=>b.backed==='partly')?'partly':m.length?'true':'null';
    return {...g,text:g.items[0].text.replace(/^(>\s*|[-*]\s*)+/,'').replace(/\*\*/g,''),state:worst}})}
function rulesHome(A){const G=ruleGroups(), not=G.filter(g=>g.state==='false'||g.state==='partly'), yes=G.filter(g=>g.state==='true'), unm=G.filter(g=>g.state==='null');
  const r=g=>row80({mark:`<i class="mk80 ${BK[g.state][1]}">${icon(BK[g.state][2],10)}</i>`,name:esc(g.text.length>90?g.text.slice(0,88)+'…':g.text),val:g.items.length>1?`×${g.items.length}`:'',attr:`data-sub="rule:${esc(g.key)}"`});
  A.innerHTML=`<div class="pin54 pin61">${listSwitch()}${subHead('Rules',not.length?`<b class="ex">${not.length}</b> of what you wrote isn't enforced`:'What you wrote, and what holds it')}</div>
    <div class="ls80b">${not.length?`<p class="lb80">Not enforced</p>${not.map(r).join('')}`:''}${yes.length?`<p class="lb80">Enforced</p>${yes.map(r).join('')}`:''}
      ${unm.length?`<details class="mo80"><summary>${unm.length} not measured yet</summary>${unm.slice(0,60).map(r).join('')}</details>`:''}
      ${(BASE.said.unsaid||[]).length?`<p class="lb80">Enforced, never said</p>${BASE.said.unsaid.map(u=>row80({mark:`<i class="mk80 y">${icon('Shield',10)}</i>`,name:esc(u.what),val:u.outcome==='held'?'refused':'asks',go:false,tip:u.rule||u.how})).join('')}`:''}</div>`;
  bindAside(A); bindSub(A); bindTrustHover(A,ovData().d)}
function ruleDetail(A,key){const g=ruleGroups().find(x=>x.key===key); if(!g){SUB='rules';return rulesHome(A)}
  const st=g.items[0], b=bkOf(st), k=BK[g.state];
  A.innerHTML=`<div class="pin54 pin61">${listSwitch()}${subHead('A rule','')}</div>
    <div class="rd80"><p class="q80">${esc(g.text)}</p><p class="st80 ${k[1]}">${icon(k[2],12)} ${esc(k[0])}${b&&b.backed!==null?`<span>${esc(b.why)}</span>`:''}</p>
      ${ruleRow(st).replace(/<p>[\s\S]*?<\/p>/,'').replace(/<small>[\s\S]*?<\/small>/,'')}
      <p class="lb80">Where you wrote it</p>${g.items.map(x=>`<a class="src80" data-open="${esc(x.source.file)}" data-path="${esc(x.path||'')}" data-lines="${x.source.line}">${icon('FileText',12)} ${esc(x.source.file)}<i>:${x.source.line}</i></a>`).join('')}</div>`;
  bindSub(A); bindSaid(A)}
function bindSub(A){A.querySelectorAll('[data-sub]').forEach(b=>b.onclick=e=>{e.stopPropagation&&e.stopPropagation();SUB=b.dataset.sub||null;render()})}

// one kind of stakes, in the panel: how its situations are decided, by what, and what would decide them
function openStake(id){selStake=id;selSit=null;sel=null;selSet=null;selSlot=null;selLayer=null;leftOpen=false;topic=null;if(INSPHIDE)INSPHIDE=false;
  if(VIEW!=='board'){VIEW='board';try{localStorage.setItem('v44-view','board')}catch(x){}}render();stakeLit()}
const stakeLit=()=>{if(!selStake||!ovOK())return;focusSits(ovData().d.situations.filter(s=>s.stakes===selStake&&!s.accounted))};
function stakePane(id){const {d}=ovData(), w=(d.reins||[]).find(x=>x.id===id); if(!w) return '';
  const ss=d.situations.filter(s=>s.stakes===id), P={}, F={};
  ss.forEach(s=>{(s.by||[]).forEach(b=>{if(b.piece)P[b.piece]=(P[b.piece]||0)+1});if(s.fix&&s.fix.piece&&!(s.by||[]).some(b=>b.piece===s.fix.piece))F[s.fix.piece]=(F[s.fix.piece]||0)+1});
  const chip=(id2,n,cls)=>`<button class="pc51 ${cls}" data-goB="${id2}" data-hk="${id2}">${esc((find(id2)||{}).name||id2)} <small>${n}</small></button>`;
  const list=sitGroups(ss,{open:true,noOpen:true});
  return `<div class="dhead"><span class="crumb2">What's at stake</span><a data-closestake="1" aria-label="Close">×</a></div>
    <h3 class="kh50">${icon(STAKEIC[id]||'Circle',16)} ${esc(w.name)}</h3><p class="mute">${esc(w.about||'')}</p>
    <div class="sb54"><span class="ac" style="flex:${w.accounted}"></span><span class="ex" style="flex:${w.exposed}"></span><span class="cl" style="flex:${w.classifier}"></span><span class="ot" style="flex:${Math.max(0,w.situations-w.accounted-w.exposed-w.classifier)}"></span></div>
    <p class="sl54"><b>${w.accounted}</b> of ${w.situations} accounted for by this harness${w.exposed?` · <b class="ex">${w.exposed}</b> exposed`:''}${w.classifier?` · <b class="cl">${w.classifier}</b> left to Claude Code`:''}${w.defaults?` · ${w.defaults} decided by ${esc((BASE.runtime||{}).name||'the runtime')}'s defaults`:''}</p>
    <section class="rs50"><h4>Decided by</h4><div class="by51">${Object.keys(P).length?Object.entries(P).map(([k,n])=>chip(k,n,'lets')).join(''):`<span class="mute">Nothing in this harness: ${esc((BASE.runtime||{}).name||'the runtime')}'s defaults decide all of it.</span>`}</div>
      ${Object.keys(F).length?`<h4 style="margin-top:8px">Would be decided by</h4><div class="by51">${Object.entries(F).map(([k,n])=>chip(k,n,'fx')).join('')}</div>`:''}</section>
    <section class="rs50 sk54"><h4>Its situations, and your call</h4><div class="sl53">${list}</div></section>`}
function openLevel(){selStake=null;selSit=null;sel=null;selSet=null;selSlot=null;selLayer=null;leftOpen=true;topic='tier';if(INSPHIDE)INSPHIDE=false;render()}
// marks on the board, updated in place (a mode or a draft changes them; the board isn't rebuilt)
function secHead(sl){const f=sl.types.filter(t=>t.stage===2).length; if(!ovOK()) return `${f} of ${sl.types.length}`;
  const x=secSits(sl.id); return `${f} of ${sl.types.length}${x.n?` <i class="sc53" style="--wc:${VCOL[x.worst]}" title="Its pieces decide ${x.n} situation${x.n===1?'':'s'}">· decides ${x.n}</i>`:''}`}
function refreshMarks(){const inv=$('v44inv'); if(!inv||!inv.querySelectorAll) return;
  inv.querySelectorAll('[data-t]').forEach(el=>{const t=find(el.dataset.t); if(!t) return;
    el.querySelectorAll('.dc53,.jb51,.vb51').forEach(x=>x.remove()); el.classList.remove('lj51','w53','lz50'); el.style&&el.style.removeProperty&&el.style.removeProperty('--wc');
    const L=lensOf(t); L.cls.trim().split(/\s+/).filter(Boolean).forEach(c=>el.classList.add(c)); if(L.style&&el.style)el.style.setProperty('--wc',L.style.split(':')[1]);
    if(L.mark) el.insertAdjacentHTML('beforeend',L.mark)});
  drawMid();
  inv.querySelectorAll('[data-bag]').forEach(b=>{const sl=H.slots.find(x=>x.id===b.dataset.bag), sp=b.querySelector('header>span'); if(sl&&sp){const types=sl.types.filter(t=>typeof showPiece!=='function'||showPiece(t)); sp.innerHTML=secHead({...sl,types})}});
  tintPipes()}
function tintPipes(){const svg=$('v44pipes'); if(!svg||!svg.querySelectorAll) return; const on=ovOK();
  svg.querySelectorAll('[data-pipe]').forEach(g=>{const x=on?secSits(g.dataset.pipe):{n:0};if(on&&x.n)g.style.setProperty('--cd',VCOL[x.worst]);else g.style.removeProperty('--cd');g.classList.remove('nd53')})}
function drawRead(){const R=$('v44read'); if(R) R.hidden=true}
