// ---- Trust: what it can do without you. Rows unfold in place; a separate screen only for the full detail.
const OPEN80=new Set();
function fold80(key,o,body,sty){const on=OPEN80.has(key);
  return `<div class="f80${on?' on':''}"${sty?` style="${sty}"`:''}><button class="r80" data-fold80="${esc(key)}" aria-expanded="${on}" title="${esc(o.tip||'')}">${o.mark||''}<span class="nm">${o.name}</span>${o.val!=null?`<span class="vl">${o.val}</span>`:''}${icon('ChevronDown',13)}</button>${on?`<div class="fb80">${body()}</div>`:''}</div>`}
function trustHome(A){const {d}=ovData(), S=d.summary, hosted=typeof HOST!=='undefined'&&canDraft()&&!BASE.profile, ex=d.situations.filter(x=>x.verdict==='exposed');
  const order=[...d.stakes.filter(x=>x.high),...d.stakes.filter(x=>!x.high)], R=BASE.said&&BASE.said.summary;
  const stakeRow=st=>{const xs=d.situations.filter(x=>x.stakes===st.id); if(!xs.length) return ''; const w=worstOf(xs.map(x=>x.verdict)), r=(d.reins||[]).find(x=>x.id===st.id), a=r&&r.autonomy;
    const rs=xs.slice().sort((p,q)=>VRANK[p.verdict]-VRANK[q.verdict]||q.count-p.count), bf=ovBefore();
    return fold80('st:'+st.id,{mark:slight(w),name:esc(STAKESHORT[st.id]||st.name),val:st.high?esc(a?a.name:''):`${xs.filter(x=>x.verdict==='ok').length} fine`,tip:st.about},
      ()=>`${rs.slice(0,8).map(x=>sitRow(x,bf)).join('')}${rs.length>8?`<p class="mute">and ${rs.length-8} more</p>`:''}<button class="mo61" data-stake="${st.id}">How ${esc((STAKESHORT[st.id]||st.name).toLowerCase())} is decided ${icon('ArrowRight',12)}</button>`)};
  const nrules=R?R.unbacked+R.partly:0;
  A.innerHTML=`<div class="pin54 pin61">${listSwitch()}
      <header class="hd80"><div class="hl">${ex.length?`<b class="ex">${ex.length} risky thing${ex.length===1?'':'s'} go${ex.length===1?'es':''} ahead unchecked</b>`:`<b>Every risky thing stops or asks you</b>`}</div>
        <span class="ac">${hosted&&ex.length?`<button class="bt61 pri" data-fixex="1">${icon('Wand2',12)} Fix</button>`:''}</span></header>
</div>
    <div class="ls80b">${revealCard()}
      <p class="lb80">What's at stake</p>${order.map(stakeRow).join('')}
      <p class="lb80">What you wrote</p>${R?fold80('rules',{mark:slight(nrules?'exposed':'ok'),name:'Rules',val:nrules?`${nrules} not enforced`:`${R.backed} enforced`,tip:'What your instructions say, and whether anything makes it so'},
        ()=>{const G=ruleGroups().filter(g=>g.state==='false'||g.state==='partly');return `${G.slice(0,5).map(g=>row80({mark:`<i class="mk80 ${BK[g.state][1]}">${icon(BK[g.state][2],10)}</i>`,name:esc(g.text.length>90?g.text.slice(0,88)+'…':g.text),val:g.items.length>1?`×${g.items.length}`:'',attr:`data-sub="rule:${esc(g.key)}"`})).join('')}<button class="mo61" data-sub="rules">All rules ${icon('ArrowRight',12)}</button>`}):''}
      <div class="ac70"><button class="b50" data-view="trust">${icon('Maximize2',12)} Open the full table</button><button class="b50" data-view="simulate">${icon('Play',12)} Try a task</button></div>
      <p class="lb80">Everything</p>${row80({mark:icon('List',13),name:'All situations',val:`${S.situations}`,attr:'data-sub="all"',tip:'Every situation, with your call on each: allow, ask or never'})}
      ${hosted?(BASE.answers&&BASE.answers.cards?row80({mark:icon('Heart',13),name:'Your trust check',sub:STYLES[BASE.answers.style]?`You're ${esc(STYLES[BASE.answers.style][0])}`:'',val:'',attr:'data-showreveal="1"',tip:'What you said you would let it do, beside what your harness backs'})
        :row80({mark:icon('Heart',13),name:'Take the trust check',val:'',attr:'data-retake="1"',tip:'A few moments from this harness: would you let it? Then your answers beside the evidence'})):''}
    </div>`;
  bindAside(A); bindSub(A); bindRows(A); bindCalls(A);
  A.querySelectorAll('[data-fixex]').forEach(b=>b.onclick=()=>fixExposed());
  A.querySelectorAll('[data-showreveal]').forEach(b=>b.onclick=()=>goView('check'));
  A.querySelectorAll('[data-fold80]').forEach(b=>b.onclick=()=>{const k=b.dataset.fold80;OPEN80.has(k)?OPEN80.delete(k):OPEN80.add(k);render()});
  A.querySelectorAll('.mo61[data-stake]').forEach(b=>b.onclick=()=>openStake(b.dataset.stake));
  bindTrustHover(A,d)}
// pointing at a row lights what decides its situations, and marks what would
function bindTrustHover(A,d){const hov=(el,ss)=>{if(!el)return;el.onmouseenter=()=>{const xs=ss();focusSits(xs.length?xs:null)};el.onmouseleave=()=>selStake?stakeLit():sitLit()};
  const ofRules=G=>{const ids=new Set(G.flatMap(g=>g.items.flatMap(x=>((bkOf(x)||{}).situations||[]).map(r=>r.id))));return d.situations.filter(s=>ids.has(s.id))};
  hov(A.querySelector('.hd80 .hl'),()=>d.situations.filter(x=>x.verdict==='exposed'));
  A.querySelectorAll('[data-fold80^="st:"]').forEach(b=>{const id=b.dataset.fold80.slice(3);hov(b,()=>d.situations.filter(x=>x.stakes===id))});
  hov(A.querySelector('[data-fold80="rules"]'),()=>ofRules(ruleGroups().filter(g=>g.state==='false'||g.state==='partly')));
  A.querySelectorAll('[data-sub^="rule:"]').forEach(b=>{const k=b.dataset.sub.slice(5);hov(b,()=>ofRules(ruleGroups().filter(g=>g.key===k)))})}
