// ---- v20: a compact status row; every topic opens in the side panel
let topic=null, leftOpen=false;
function legendHTML(){
  const demo=(stage,pkg)=>tile({id:"demo",name:"Blocking hooks",stage,count:stage===2?3:0,inst:stage>0?[{pkg}]:[],extra:[],rt:{},how:{}},true);
  const L=(r,steps)=>({steps,reached:r}), lt=(name,id,stage,ld,sec,extra)=>`<div>${tile({id,name,stage,count:stage>0?3:0,inst:[],extra:[],rt:{},how:{},ladderOverride:ld,...(extra||{})},true).replace('class="t19',`style="--sec:${sec}" class="t19`)}`;
  const E=['Equipped','Tuned','Enforced'];
  return `<h3>How to read a tile</h3>
    <div class="anat">${demo(2,null)}<ol><li><b>Top left:</b> how many Free Rein found.</li><li><b>Middle:</b> the piece's icon and name.</li><li><b>Bottom:</b> its steps, one bar for each step the piece has.</li></ol></div>
    <h4 class="sec">Steps</h4><p>Each piece has only the steps that are real for it, up to three: <b>Equipped</b> (something is there), <b>Tuned</b> (set up well, checked from the files), <b>Enforced</b> (something stops, checks or asks on its behalf). Some pieces are simply there or not, so they have one step.${TL.rim?' An outline on the last bar (a rim on the circle) marks Enforced; it turns white once reached.':''}</p>
    <div class="lgrid">${lt('Folder instructions','folder-instructions',0,L(0,E),'#60A5FA')}<span><b>Not there yet</b>Nothing of this piece yet.</span></div>
      ${lt('Skills','skills',2,L(1,E),'#2DD4BF')}<span><b>Equipped</b>Step 1 of 3.</span></div>
      ${lt('Skills','skills',2,L(2,E),'#2DD4BF')}<span><b>Tuned</b>Step 2 of 3.</span></div>
      ${lt('Permission rules','permissions',2,L(3,E),'#A78BFA')}<span><b>Enforced</b>Step 3 of 3, the top.</span></div>
      ${lt('Subagents','subagents',2,L(1,['Equipped']),'#A3E635')}<span><b>One step</b>There or not: in place is the top.</span></div></div>
    <h4 class="sec">When Free Rein can't say</h4><div class="lgrid"><div><i class="mk56 unk">?</i><span><b>Grey “?”</b>Free Rein can't tell whether it's there (a product that doesn't show it, or nothing to read).</span></div><div><i class="sw kw2"></i><span><b>Red stripes</b>Not available on ${CORES[core]}: it has no way to do this, or the product doesn't offer it.</span></div></div>
    <p>Out of your reach (your organization's policy or a product holds it) is said in the piece's pane, not on the tile.</p>
    <h4 class="sec">Show on tiles</h4><p>Extra marks you can switch on from ${icon('SlidersHorizontal',12)} <b>View</b> in the toolbar, each off until you choose it:</p><div class="lgrid">
      <div><i class="mk56 nx"><b>→ Tuned</b></i><span><b>Next step</b>A gold chip naming the step a piece would reach: it unlocks the next tier, or backs your weakest kind of work.</span></div>
      <div><i class="mk56 cb"></i><span><b>One piece from a combo</b>A gold outline: adding it completes an achievement or fixes a weak spot.</span></div>
      <div><i class="mk56 st"><b>${icon('Scale',9)}3</b></i><span><b>Situations it decides</b>A count of the situations a piece decides, coloured by its worst verdict (see Situations).</span></div>
      <div><i class="mk56 pl">${icon('Landmark',13)}</i><span><b>Enforced by the platform</b>Held outside your files.</span></div></div>
    <p>The core's ring shows every piece at once: one segment each, split into bands for its steps, lit as reached.</p>
    <h4 class="sec">Conduits are the amount</h4><p>Every wire and cable is one colour: your tier's. A wire runs from each piece that is in place or started to its section's output; a missing piece has none. A cable's width is how many pieces it carries; its brightness and pulse speed are how much of that is backed by controls that check or block. Hover a cable to see what it carries.</p>
    <h4 class="sec">Achievements and weak spots</h4><p>Every combo is a pair of pieces. An achievement is two pieces that work better together: a gold card when you have both, half-filled when one piece is missing, a dark outline when neither is in. The marks along the bottom of a card are its parts. Achievements sit in rails either side of the board. Weak spots are the red strip under it: one piece causing a problem until another piece fixes it. The centre shows the trust you've earned for each kind of action, in three steps (Ask me first, Show me after, Go ahead); hover a piece to see what it would earn. Hover any of them to light their pieces.</p>
    <h4 class="sec">Levels and XP</h4><p>Pieces earn XP as they come into place and get backed (+10, +25, +50); achievements add +50 and clearing a weak spot +30. XP adds up to the harness level in the centre. Ranks (Apprentice, Journeyman, Trusted, Master; names still open) need key pieces.</p>
    <h4 class="sec">The core</h4><p>The runtime the pieces plug into. Its ring has one arc per section, coloured by that section's strongest energy. Click it for the whole picture.</p>
    ${SOCKET()?`<h4 class="sec">The centre</h4><p>Your runtime: its name and model on a dark disc your harness plugs into. The cables carry on inside the ring and plug into its ports, faster and brighter the more of each section is backed; a port lights as energy lands. Its glow is the harness's backed trust. When your pointer is inside the ring or on a piece it turns to look; it grins on a level-up (the ports flash round in gold), squints when a piece moves up, looks worried when something drops, and shows dots while measuring. The bar under the level is XP to the next one.</p>`:''}
    ${CHAR.on&&CHAR.kind==='sprout'?`<h4 class="sec">The sprout</h4><p>The agent, at the centre. <b>Its plant is your level</b>: seed, shoot, two leaves, leafy, bushy, lush, full grown at 50. <b>Roots feed it</b>: every section with something in place sends a green root in, as wide as its cable where it meets the ring; energy flows faster and brighter the more of it is backed (enforced, not just asked). <b>Its glow</b> is the harness's backed trust. It reacts to changes (a hop and a spin on a level-up, a squish when a piece moves up, a flinch when something drops, dots while measuring), then goes back to neutral. The bar under the level is XP to the next one.</p>`:''}`;
}
// where the XP comes from: one bar split three ways, and each part opened into what earns it (scored by the core, so
// the board keeps no copy of the rules): pieces by section, each combo, situations by what's at stake
function xpParts(sc){const P=sc.parts, tot=Math.max(1,sc.xp), doc=liveDoc(), only=f=>FreeReinCore.score({pieces:doc.pieces.filter(f),combos:[],situations:[]},RULES).parts.pieces;
  const row=(attr,name,sub,xp,max,col)=>`<button class="xr84" ${attr} style="--c:${col}"><span class="nm">${name}${sub?`<small>${sub}</small>`:''}</span><span class="b"><i style="width:${max?Math.round(100*xp/max):0}%"></i></span><em>${xp}</em></button>`;
  const secs=H.slots.map(sl=>{const ids=new Set(sl.types.map(t=>t.id));return {sl,xp:only(p=>ids.has(p.id)),f:sl.types.filter(t=>t.stage===2).length,n:sl.types.length}}), mx=Math.max(1,...secs.map(x=>x.xp));
  const earned=H.sets.filter(s=>s.kind==='synergy'&&s.status==='active'), cleared=H.sets.filter(s=>s.kind==='curse'&&s.status==='cleared'), nsyn=H.sets.filter(s=>s.kind==='synergy').length;
  let st=[];try{const {d}=ovData();st=(d.stakes||[]).map(k=>{const xs=d.situations.filter(s=>s.stakes===k.id);
    return {k,n:xs.length,a:xs.filter(s=>s.accounted).length,xp:FreeReinCore.score({pieces:[],combos:[],situations:doc.situations.filter(s=>s.stakes===k.id)},RULES).parts.situations}}).filter(x=>x.n)}catch(e){}
  const ms=Math.max(1,...st.map(x=>x.xp)), T=types(), nf=T.filter(t=>t.stage===2).length, S=ovOK()?ovData().d.summary:null;
  const part=(k,name,line,xp,body)=>`<details class="xd84 ${k}"><summary><i class="k"></i><span class="nm"><b>${name}</b><small>${line}</small></span><em>${xp} XP</em>${icon('ChevronDown',13)}</summary><div class="xl84">${body}</div></details>`;
  return `<div class="xb84" title="Where the XP comes from"><i class="p" style="flex:${P.pieces}"></i><i class="c" style="flex:${P.combos}"></i><i class="s" style="flex:${P.situations}"></i></div>
    <div class="xg84">${part('p','Pieces',`${nf} of ${T.length} in place · ${Math.round(100*P.pieces/tot)}%`,P.pieces,secs.map(x=>row(`data-sec="${x.sl.id}" data-xhl="${x.sl.types.map(t=>t.id).join(',')}"`,esc(x.sl.name),`${x.f}/${x.n}`,x.xp,mx,SECCOL[x.sl.id]||'#8D919D')).join(''))}
      ${part('c','Combos',`${earned.length} of ${nsyn} achievements${cleared.length?`, ${cleared.length} weak spot${cleared.length===1?'':'s'} fixed`:''} · ${Math.round(100*P.combos/tot)}%`,P.combos,
        [...earned.map(s=>row(`data-set="${esc(s.name)}" data-xhl="${s.ids.join(',')}"`,esc(setName(s)),'achievement',AXP,AXP,'#F2C35B')),...cleared.map(s=>row(`data-set="${esc(s.name)}" data-xhl="${[...s.ids,...(s.lifts||[])].join(',')}"`,esc(setName(s)),'weak spot fixed',WXP,AXP,'#7FE0C2'))].join('')||'<p class="mute">None earned yet.</p>')}
      ${S?part('s','Situations',`${S.accounted} of ${S.situations} accounted for · ${Math.round(100*P.situations/tot)}%`,P.situations,st.map(x=>row(`data-stake="${x.k.id}" data-xst="${x.k.id}"`,esc(STAKESHORT[x.k.id]||x.k.name),`${x.a}/${x.n}${x.k.high?' · high stakes':''}`,x.xp,ms,'#7FBF95')).join('')):''}</div>`}
function bindXP(box){box.querySelectorAll('.xd84 [data-sec]').forEach(b=>b.onclick=()=>{selSlot=b.dataset.sec;sel=null;selSet=null;leftOpen=false;topic=null;render()});
  box.querySelectorAll('.xd84 [data-stake]').forEach(b=>b.onclick=()=>openStake(b.dataset.stake));
  box.querySelectorAll('.xd84 [data-xhl]').forEach(b=>{b.onmouseenter=()=>lightPieces(b.dataset.xhl.split(',').filter(Boolean));b.onmouseleave=()=>lightPieces(null)});
  box.querySelectorAll('.xd84 [data-xst]').forEach(b=>{b.onmouseenter=()=>focusSits(ovData().d.situations.filter(s=>s.stakes===b.dataset.xst));b.onmouseleave=()=>sitLit()})}
function topicHTML(k){
  if(k==="checks") return checksHTML();
  if(k==="scans") return scansHTML();
  if(k==="changes") return diffHTML(true)||'<p>Nothing changed yet. Switch a layer, try a package or add a piece to the draft.</p>';
  const T=types(), nf=T.filter(t=>t.stage===2).length, cur=H.tiers.filter(t=>t.reached).pop(), nt=H.nextTier;
  if(k==="tier"){const sc=scoreNow(), x=sc.xp, L=lvlOf(x), lo=lvlXP(L), hi=lvlXP(L+1), fr=Math.round(100*(x-lo)/(hi-lo));
    const px=sc.parts.pieces, sx=sc.parts.situations, cx=sc.parts.combos;
    const moves=types().filter(t=>maturity(t)<3).map(t=>({t,g:xpGain(t.id)})).filter(m=>m.g>0).sort((a,b)=>b.g-a.g).slice(0,3);
    return `<h3>Level ${L}</h3><p class="mute">Level is everything you've built. It only goes up.</p>
    <div class="lv73"><span class="b"><i style="width:${fr}%"></i></span><span>${x} XP · ${hi-x} to level ${L+1}</span></div>
    ${xpParts(sc)}
    ${moves.length?`<h4 class="sec">Most XP next</h4>${moves.map(m=>`<a class="nxl" data-go="${m.t.id}"><b>${esc(m.t.name)}</b><span>+${m.g} XP</span></a>`).join('')}`:''}
    <h3 style="margin-top:18px">Rank</h3><p class="mute">How far it can go without you, for each kind of stakes, from the evidence in your harness. Unlike level, a grade drops if you take a safeguard away.${BASE.answers?' The white tick is your trust.':''}</p>
    ${rankProfile(true)}
    <details class="gr73"><summary>What each grade means</summary>${((ovOK()&&ovData().d.grades)||[]).map(g=>`<p><b>${g.grade}. ${esc(g.name)}</b> ${esc(g.means)}</p>`).join('')}</details>${modelsHTML()}`}
  if(k==="trust") return `<h3>Backed trust · ${H.backed}%</h3><p>How far this harness's own controls (hooks, checks, sandboxes, logs) back the agent doing five kinds of work without you. Each control counts by how firmly it holds: asking 1, checking 2, blocking 3.</p>
    <div class="cats">${H.trustx.map((c,i)=>`<div><span>${esc(c.name)}</span><span class="lbar thin"><i style="width:${H.cats[i]}%"></i></span><b>${H.cats[i]}%</b></div>`).join('')}</div>
    <h4 class="sec">What would raise it most</h4>${Object.keys(H.next).map(id=>`<a class="nxl" data-go="${id}"><b>${esc(find(id)?.name||id)}</b><span>${esc(H.next[id].join('; '))}</span></a>`).join('')}`;
  if(k==="found") return `<h3>${nf} of ${T.length} types found</h3><p>Each tile is one type of thing a harness can have. Here is how each section stands.</p>
    <div class="comp19">${H.slots.map(sl=>{const f=sl.types.filter(t=>t.stage===2).length;return `<a data-sec="${sl.id}" class="${f===sl.types.length?'found':f?'started':'missing'}"><i></i><b>${esc(sl.name)} · ${f} of ${sl.types.length}</b><span class="w">${esc(sl.job)}</span></a>`}).join('')}</div>`;
  if(k==="guards") return `<h3>Guards that hold · ${H.paths.holds} of ${H.paths.total}</h3><p>A guard sits in front of a write the harness cares about. One that <b>holds</b> is enforced by the runtime, so it works whatever the model does. One that <b>asks</b> relies on the model stopping to check with you, so it can be skipped.</p>
    ${H.paths.holds?'':'<p class="warn">Every guard here relies on asking. Blocking hooks would let some hold on their own.</p>'}<a class="nxl" data-go="hard-gate"><b>Blocking hooks</b><span>${on('hard-gate')?'found':'missing'}</span></a>`;
  if(k==="problems"){const ps=H.sets.filter(s=>s.kind==="curse"&&s.status==="active");return `<h3>Problems · ${ps.length}</h3><p>Combinations Free Rein knows cause trouble, and the piece that fixes each.</p>
    ${ps.map(p=>`<div class="risk"><b>${esc(p.name)}</b><span>${esc(p.effect)}</span>${p.lifts.length?`<span>Fix: ${p.lifts.map(id=>`<a data-go="${id}">${esc(find(id)?.name||id)}</a>`).join(' or ')}</span>`:p.lifts_text?`<span>Fix: ${esc(p.lifts_text)}</span>`:''}</div>`).join('')||'<p class="dimk">None right now.</p>'}`}
  if(k==="sets") return `<h3>Sets: pieces that work better together</h3><p>When every piece of a set is found, you get its effect. Hover a set to light its tiles.</p>
    ${H.sets.filter(s=>s.kind==="synergy").sort((a,b)=>(b.status==="active")-(a.status==="active")).map(s=>`<div class="setrow ${s.status==='active'?'on':''}" data-set="${esc(s.name)}"><b>${s.status==='active'?'✓ ':''}${esc(setName(s))}</b><span>${esc(s.effect)}</span><span class="set-ids">${s.ids.map(id=>`<i class="${on(id)?'on':''}">${esc(find(id)?.name||id)}</i>`).join('')}</span></div>`).join('')}`;
  if(k==="legend") return legendHTML();
  return '';
}
