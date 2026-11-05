// ---- the instrument panel: the side panel speaks the board's language. Mono caps for labels and counts,
const slight=(v,tip)=>`<i class="lt61 ${v}"${tip?` title="${esc(tip)}"`:''}></i>`;
const STAKESHORT={everyday:'Everyday',undo:'Hard to undo',outward:'Leaves machine',knowledge:'What it knows',safeguards:'Safeguards',secrets:'Sensitive data',accounts:'Connected accounts'};
const worstOf=vs=>[...vs].sort((a,b)=>VRANK[a]-VRANK[b])[0];
// a situation's row: state light, what it does, its target and verdict, your call. The whole row lights the board.
function sitRow(s,bf){const was=bf&&bf[s.id]&&bf[s.id]!==s.verdict?bf[s.id]:null, yours=(s.sources||[]).includes('yours');
  return `<div class="rw61 ${s.verdict}${selSit===s.id?' on':''}" data-row61="${s.id}" role="button" tabindex="0" title="${esc(s.target||'')}">
    ${slight(s.verdict,VERN[s.verdict])}
    <span class="tx"><b>${yours?'<i class="yo">yours</i>':''}${esc(s.what)}${s.count?`<span class="n">×${s.count.toLocaleString()}</span>`:''}${(sb=>sb.length?`<i class="sd79" title="${esc(sb.slice(0,3).map(x=>x.source.file+':'+x.source.line+' — '+x.text.replace(/^[-*]\s*/,'').slice(0,90)).join('\n'))}">${icon('MessageSquareQuote',10)} said${sb.length>1?' ×'+sb.length:''}</i>`:'')(saidBySit()[s.id]||[])}</b>
      <span class="ln"><small><span class="v ${s.verdict}${s.verdict==='exposed'||was?' loud':''}"${was?` title="Was: ${esc(VERN[was])}"`:''}>${esc(VERN[s.verdict])}</span>${was?'<i class="dr61">in draft</i>':''}</small>${callSeg(s)}</span></span>${rmSit(s)}</div>`}
// a group starts folded unless something in it is exposed; your click wins after that
let LASTWORST=null;
function gShut(id){const w=worstGroup(); if(w!==LASTWORST){LASTWORST=w;GSHUT={}}   // what's worst changed: open it again
  if(id in GSHUT) return GSHUT[id]; return id!==w}
// the one group open by default: the one with the worst verdict, first in the list's order
function worstGroup(){const d=ovData().d; if(!d) return null; const order=[...d.stakes.filter(x=>x.high),...d.stakes.filter(x=>!x.high)];
  let best=null,bv=99; order.forEach(st=>{const v=Math.min(...d.situations.filter(x=>x.stakes===st.id).map(x=>VRANK[x.verdict]),99); if(v<bv){bv=v;best=st.id}}); return bv<=VRANK.classifier?best:null}
const VORDG=['exposed','classifier','babysitting','blocked','depends','good','held','ok'];
// what the harness backs, per kind of stakes, on the trust check's scale (0-4): the share of its situations it covers
const TSCALE=()=>((BASE.trust&&BASE.trust.scale)||["Not at all","Only with my review","Usually","Mostly","Completely"]);
function trustGap(st){const {d}=ovData(), xs=d.situations.filter(x=>x.stakes===st.id); if(!xs.length) return null;
  const backed=Math.round(4*xs.filter(x=>x.accounted).length/xs.length), a=myTrust(st.id);
  return {backed,mine:a,gap:a!=null&&a>backed}}
function sitGroups(rows,opts={}){const {d}=ovData(), bf=ovBefore(), order=[...d.stakes.filter(x=>x.high),...d.stakes.filter(x=>!x.high)];
  return order.map(st=>{const all=d.situations.filter(x=>x.stakes===st.id), rs=rows.filter(s=>s.stakes===st.id).sort((a,b)=>((b.sources||[]).includes('yours')-(a.sources||[]).includes('yours'))); if(!rs.length) return '';
    const acc=all.filter(x=>x.accounted).length, w=worstOf(all.map(x=>x.verdict)), shut=!opts.open&&!SITQ&&!SITF&&!OVCELL&&gShut(st.id);
    const cnt=v=>rs.filter(x=>x.verdict===v).length, summ=[...new Set(rs.map(x=>x.verdict))].sort((a,b)=>VRANK[a]-VRANK[b]).map(v=>`<span class="sv">${slight(v)}${cnt(v)} ${esc(VERN[v].replace(/^(Runs|Good|Held|Exposed|Babysitting|Blocked)/,m=>m.toLowerCase()))}</span>`).join('');
    const bar=VORDG.map(v=>cnt(v)?`<i class="${v}" style="flex:${cnt(v)}"></i>`:'').join(''), fine=rs.every(x=>x.verdict==='ok');
    return `<section class="gp61${shut?' shut':''}${fine?' fine':''}" id="gp-${st.id}"><header class="gh61" data-gshut="${st.id}" role="button" tabindex="0" aria-expanded="${!shut}" title="${esc(st.about)}">
        <span class="cv" aria-hidden="true">${icon('ChevronRight',14)}</span><span class="nm">${esc(st.name)}</span>${(g=>g&&g.gap?`<span class="tg70" title="You trust it ${esc(TSCALE()[g.mine].toLowerCase())}; what this harness backs is ${esc(TSCALE()[g.backed].toLowerCase())}">${icon('TriangleAlert',11)} trust ahead</span>`:'')(trustGap(st))}
        <span class="vb63" title="${esc([...new Set(rs.map(x=>x.verdict))].map(v=>cnt(v)+' '+VERN[v].toLowerCase()).join(', '))}">${bar}</span><span class="ct">${rs.length}</span></header>
      ${shut?'':`<div class="gb61">${(g=>g&&g.mine!=null?`<div class="tt70${g.gap?' gap':''}"><span class="lb">Your trust</span><span class="sc70">${TSCALE().map((x,i)=>`<i class="${i<=g.backed?'b':''}${i===g.mine?' m':''}" title="${esc(x)}"></i>`).join('')}</span><span class="tx">${g.gap?`You trust it <b>${esc(TSCALE()[g.mine].toLowerCase())}</b>; the harness backs <b>${esc(TSCALE()[g.backed].toLowerCase())}</b>. Close it with your calls below.`:`You trust it <b>${esc(TSCALE()[g.mine].toLowerCase())}</b>; the harness backs that.`}</span></div>`:'')(trustGap(st))}${rs.map(s=>sitRow(s,bf)).join('')}${opts.noOpen?'':`<button class="mo61" data-stake="${st.id}">How ${esc(st.name.toLowerCase())} is decided ${icon('ArrowRight',12)}</button>`}</div>`}</section>`}).join('')||`<p class="em61">No situation matches. ${typeof HOST!=='undefined'&&!BASE.profile?'Add it as your own, and Free Rein reads what would happen.':''}</p>`}
function asideList(){const {d}=ovData(); return sitGroups(d.situations.filter(sitMatch))}
function fixExposed(){const {d}=ovData(), ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], rules=[...draftRules()];
  d.situations.filter(x=>x.verdict==='exposed'&&x.calls).forEach(x=>{const c=x.stakes==='secrets'?'never':'ask', r=x.calls[c]; if(!r) return;
    const i=rules.findIndex(y=>y.sit===x.id); if(i>=0) rules.splice(i,1); rules.push({kind:r.kind,rule:r.rule,sit:x.id,preset:'exposed'})});
  PENDING={what:'Measuring the fix for what\'s exposed…'};busy();head();HOST.draft({ups,rules})}
let FRICOPEN=false;
// the allow rule for everyday work: as wide as the kind of command (grep, not grep -c)
const allowRule=x=>x.fix&&x.fix.how==='allow'&&x.fix.rule?x.fix.rule:x.calls.let.rule;
function realFriction(){const {d}=ovData(), h=d.history, hosted=typeof HOST!=='undefined'&&canDraft()&&!BASE.profile; if(!h||!h.sessions||!h.asks) return '';
  const bb=d.situations.filter(x=>x.verdict==='babysitting'&&x.count&&x.calls&&x.calls.let).sort((a,b)=>b.count-a.count), top=bb.slice(0,5), cut=top.reduce((a,x)=>a+x.count,0);
  return `<div class="rf70"><button class="hd" data-fric="1" aria-expanded="${FRICOPEN}">${icon('Hand',13)}<span>In your last ${h.sessions} session${h.sessions===1?'':'s'} it would have asked you <b>${h.asks.toLocaleString()}</b> time${h.asks===1?'':'s'}${h.babysitting?`, <b class="bb">${h.babysitting.toLocaleString()}</b> for everyday work`:''}</span>${icon(FRICOPEN?'ChevronUp':'ChevronDown',13)}</button>
    ${FRICOPEN?`<div class="bd">${top.length?`<p>Allowing these would cut <b>${cut.toLocaleString()}</b> of them:</p>${top.map(x=>`<div class="r"><span>${esc(x.what)}</span><b>×${x.count.toLocaleString()}</b><code>${esc(allowRule(x))}</code></div>`).join('')}${hosted?`<button class="bt61 pri" data-cutfric="1">Allow these ${top.length}</button>`:''}`:'<p>No everyday work asks you; what asks you is high stakes, good friction.</p>'}</div>`:''}</div>`}
function cutFriction(){const {d}=ovData(), ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], rules=[...draftRules()];
  d.situations.filter(x=>x.verdict==='babysitting'&&x.count&&x.calls&&x.calls.let).sort((a,b)=>b.count-a.count).slice(0,5).forEach(x=>{const i=rules.findIndex(r=>r.sit===x.id);if(i>=0)rules.splice(i,1);rules.push({kind:'allow',rule:allowRule(x),sit:x.id,preset:'friction'})});
  PENDING={what:'Measuring the rules that cut the most interruptions…'};busy();head();HOST.draft({ups,rules})}
function sitsPanel(A){const {d}=ovData(), S=d.summary, n=d.situations.length, hosted=typeof HOST!=='undefined'&&canDraft()&&!BASE.profile, Q=d.quick||[];
  const hs=d.situations.filter(x=>x.stakes!=='everyday'), alone=hs.filter(x=>x.outcome==='ahead'||x.outcome==='classifier').length;
  const VORD=['exposed','classifier','babysitting','blocked','depends','good','held','ok'], VLEG={exposed:'exposed',classifier:'Claude Code',babysitting:'babysat',blocked:'blocked',depends:'a hook decides',good:'asks you',held:'refused',ok:'fine'};
  const VTIP={exposed:'High stakes, and nothing stops it',classifier:'No rule of yours covers it: Claude Code\'s own safety check decides',babysitting:'Everyday work that asks you',blocked:'Everyday work that is refused',depends:'Everyday work a hook may refuse (read, not run)',good:'High stakes, and it asks you first: good friction',held:'Something refuses it: a rule or a hook',ok:'Everyday work that goes ahead'};
  const leg=VORD.filter(v=>d.situations.some(x=>x.verdict===v)).map(v=>`<button class="fl61${SITF===v?' on':''}" data-sitf="${v}" aria-pressed="${SITF===v}" title="${esc(VTIP[v])}. Click to show only these.">${slight(v)}<b>${d.situations.filter(x=>x.verdict===v).length}</b> ${VLEG[v]}</button>`).join('');
  const dr=draftRules().filter(r=>r.kind!=='model'), pres=[...new Set(dr.map(r=>r.preset).filter(Boolean))], own=dr.filter(r=>!r.preset).length;
  A.innerHTML=`<div class="pin54 pin61">${listSwitch()}
      ${subHead('All situations','')}<header class="hd61 hd80s"><div><h3>Situations</h3><p>${S.exposed?'Start with what\'s exposed.':alone?`${alone} of ${hs.length} high-stakes left to Claude Code.`:'Every high-stakes situation stops or asks.'}</p></div>
        <span class="ac">${hosted&&Q.length?`<span class="pm54"><button class="bt61" data-qmenu="1" aria-expanded="${QMENU}">Presets ${icon('ChevronDown',11)}</button>${QMENU?`<span class="mn54" role="menu">${Q.map(q=>`<button role="menuitem" data-quick="${q.id}"><b>${esc(q.name)}</b><small>${esc(q.about)}</small></button>`).join('')}</span>`:''}</span>`:''}${hosted?`<button class="bt61 pri" data-sitadd="1">${icon('Plus',12)} Add</button>`:''}</span></header>

      ${SITADD?`<div class="ad61">${sitAddHTML()}</div>`:''}${revealCard()}${realFriction()}
      <div class="fr61"><label class="sq61">${icon('Search',12)}<input id="sq53" type="search" placeholder="Find a situation" value="${esc(SITQ)}" spellcheck="false" autocomplete="off" aria-label="Find a situation"></label>
        <span class="fls" aria-label="What each colour means; click to filter">${leg}</span></div>
      ${dr.length?`<div class="dl62"><span class="sw"><i></i></span><span class="tx"><b>${dr.length} call${dr.length===1?'':'s'} in the draft.</b> Blue switches are changed, not applied.</span><button class="lk50" data-view="drafts">Review</button></div>`:`<div class="dl62 idle"><span class="tx">Live: the calls your harness makes now. Change one to start a draft.</span></div>`}
        ${dr.length&&(pres.length||own)?`<div class="pc62">${pres.map(id=>{const q=(Q.find(x=>x.id===id)||{exposed:{name:'Fix for what was exposed'},friction:{name:'Fewer interruptions'},survey:{name:'Your trust check'}}[id]||{name:id});return `<span class="ch">${icon('Layers2',12)} ${esc(q.name)} <small>${dr.filter(r=>r.preset===id).length}</small><button data-unpreset="${esc(id)}" aria-label="Remove ${esc(q.name)}" title="Take this preset's calls out of the draft">${icon('X',11)}</button></span>`}).join('')}${own?`<span class="ch mine">Your own calls <small>${own}</small></span>`:''}</div>`:''}
      ${SITF||SITST||OVCELL?`<div class="fl54">${icon('Filter',12)} <span>Showing ${esc(SITF?SITFN[SITF].replace(/^(?!Claude)./,c=>c.toLowerCase()):SITST?((d.stakes.find(x=>x.id===SITST)||{}).name||SITST):'one cell of the grid')}</span><button data-clearf="1">Clear</button></div>`:''}
</div>
    <div id="sl53" class="sl61">${asideList()}</div>
    <footer class="ft61"><button class="lk50" data-view="trust">Full table, with what the agent did here ›</button></footer>`;
  bindAside(A); bindRows(A); bindSub(A);
  const pin=A.querySelector('.pin61'); if(pin&&A.style) A.style.setProperty('--pinh',pin.offsetHeight+'px')}
// rows and the index: the whole row is the target
function bindRows(root){const {d}=ovData(), S=id=>d.situations.find(x=>x.id===id);
  root.querySelectorAll('[data-row61]').forEach(r=>{const s=S(r.dataset.row61);
    r.onmouseenter=()=>focusSits(s?[s]:null); r.onmouseleave=()=>selStake?stakeLit():sitLit();
    r.onclick=e=>{if(e.target.closest&&e.target.closest('.cs53,.rm52'))return; openSit(r.dataset.row61)};
    r.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openSit(r.dataset.row61)}}});
  root.querySelectorAll('.gh61[data-gshut]').forEach(h=>h.onclick=e=>{if(e.target.closest&&e.target.closest('[data-stake]'))return;const id=h.dataset.gshut;GSHUT[id]=!gShut(id);
    const L=root.querySelector('#sl53');if(L){L.innerHTML=asideList();bindAside(root);bindRows(root)}else render()})}
