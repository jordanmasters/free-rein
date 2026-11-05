// ---- the cards: tile-sized, framed like trophies, in the space between the ring and the sections
const CW=66, CH=78;
function card(s){const st=comboState(s), need=s.ids, ws=s.kind==="curse";
  const crack=ws&&st==="curse"?`<svg class="ck39" viewBox="0 0 66 78" preserveAspectRatio="none"><path d="M44 0 38 17 46 25 34 41 41 50 31 78" /><path d="M38 17 27 21M34 41 22 44"/></svg>`:'';
  return `<button class="ac38 ${ws?'ws39 ':''}${st}" data-set="${esc(s.name)}" aria-label="${esc(setName(s))}: ${CST[st]}"><span class="fr"></span><span class="in">
    <span class="ic">${icon(SETICON[s.name]||(ws?'TriangleAlert':'Trophy'),22)}</span><b>${esc(setName(s))}</b>
    ${ws?`<span class="ft39">${st==='cleared'?'fixed':'weak spot'}</span>`:`<span class="pp">${need.map(id=>`<i class="${on(id)?'on':''}"></i>`).join('')}</span>`}</span>${crack}${st==='earned'?'<span class="cr38">★</span>':st==='cleared'?'<span class="cr38 ok">✓</span>':ws?'<span class="cr38 bad">!</span>':''}</button>`}
function vaultCard(n,more){return `<button class="ac38 vault39" data-vault="1" aria-label="${n} more in the vault"><span class="fr"></span><span class="in"><span class="ic">${icon('Lock',20)}</span><b>+${n} ${more?'more':'to discover'}</b><span class="ft39">vault</span></span></button>`}
// achievements in two rails beside the board, weak spots in a strip under it; both sit in screen space next to the scaled board
const RW=CW+8, SH=58;
function railHost(id,cls){const fb=$('v44fit')?.parentNode; if(!fb||!fb.querySelector) return null; let el=fb.querySelector('#'+id);
  if(!el&&document.createElement){el=document.createElement('div');el.id=id;el.className=cls;fb.appendChild(el)} return el}
function placeCards(k,boardL,boardW,h){
  const L=railHost('v44railL','rail40 l'), R=railHost('v44railR','rail40 r'), S=railHost('v44strip','strip40'), T=railHost('v44teth','teth40'); if(!L||!R||!S) return;
  [L,R].forEach(x=>x.classList&&x.classList.toggle('narrow49',NARROW));
  if($('v44shell')){[L,R,S].forEach(x=>{x.hidden=true;x.innerHTML=''});return}   // the band above the board has them
  [L,R,S].forEach(x=>x.hidden=!SHOWC); if(!SHOWC){[L,R,S].forEach(x=>x.innerHTML='');return}
  const fresh=[L,R,S].filter(x=>x.classList.contains('gone')||!x.innerHTML);
  const syn=H.sets.filter(s=>s.kind==="synergy"), ORD=["earned","near","locked"];
  const rows=Math.max(1,Math.floor((h+8)/(CH+8))), rowsC=Math.max(1,Math.floor((h+6)/(58+6)));
  const F=$('v44fit').parentNode.getBoundingClientRect(), mid=boardL+boardW/2;
  const at=s=>{const rs=s.ids.map(id=>$('v44inv')?.querySelector(`[data-t="${id}"]`)).filter(Boolean).map(x=>x.getBoundingClientRect());
    if(!rs.length) return {x:mid,y:h*k/2}; return {x:rs.reduce((a,r)=>a+r.left+r.width/2,0)/rs.length-F.left, y:rs.reduce((a,r)=>a+r.top+r.height/2,0)/rs.length-F.top}};
  const pos={}; syn.forEach(s=>pos[s.name]=at(s));
  const left=[], right=[]; syn.forEach(s=>(pos[s.name].x<mid?left:right).push(s));
  // keep the rails within capacity; move the cards nearest the middle across first
  const near=(p,q)=>Math.abs(pos[p.name].x-mid)-Math.abs(pos[q.name].x-mid);
  while(left.length>rows&&right.length<rows){left.sort(near);right.push(left.shift())}
  while(right.length>rows&&left.length<rows){right.sort(near);left.push(right.shift())}
  const fill=(el,list,side)=>{list.sort((p,q)=>pos[p.name].y-pos[q.name].y); const compact=list.length>rows, ch=compact?58:CH, cap=compact?rowsC:rows; let shown=list, over=[];
    if(list.length>cap){const pri=[...list].sort((p,q)=>ORD.indexOf(comboState(p))-ORD.indexOf(comboState(q))); const keep=new Set(pri.slice(0,cap-1)); shown=list.filter(s=>keep.has(s)); over=list.filter(s=>!keep.has(s))}
    // each card wants to sit level with its pieces; push down to avoid overlap, then back up if it runs off the bottom
    const gap=8, top0=16, want=shown.map(s=>pos[s.name].y/k-ch/2), y=[];
    shown.forEach((s,q)=>{y[q]=Math.max(want[q],q?y[q-1]+ch+gap:top0)});
    const extra=over.length?ch+gap:0, maxB=h-extra; for(let q=shown.length-1;q>=0;q--){const lim=q===shown.length-1?maxB-ch:y[q+1]-gap-ch; if(y[q]>lim) y[q]=Math.max(q?0:top0,lim)}
    el.className='rail40 '+side+(compact?' compact':'')+(el.classList.contains('gone')?' gone':'');
    el.innerHTML=`<em class="rh40">${side==='l'?'Achievements':'&nbsp;'}</em>`+shown.map((s,q)=>card(s).replace('<button class="ac38',`<button style="position:absolute;left:0;top:${y[q].toFixed(1)}px" class="ac38`)).join('')
      +(over.length?vaultCard(over.length,true).replace('<button class="ac38',`<button style="position:absolute;left:0;top:${(h-ch).toFixed(1)}px" class="ac38`):'');
    el.style.cssText=`left:${side==='l'?boardL-RW*k-10:boardL+boardW+10}px;top:0;height:${h}px;transform:scale(${k});transform-origin:top left`;
    return over};
  const over=[...fill(L,left,'l'),...fill(R,right,'r')];
  // weak spots: one row under the board
  const ws=H.sets.filter(s=>s.kind==="curse"&&(s.status==="active"||s.status==="cleared")).sort((p,q)=>(p.status==="active"?0:1)-(q.status==="active"?0:1));
  S.innerHTML=`<em class="rh40 bad">Weak spots · ${ws.filter(s=>s.status==="active").length}</em>`+ws.map(wsCard).join('');
  S.style.cssText=`left:${boardL+boardW/2}px;top:${h*k+8}px;transform:translateX(-50%) scale(${k});transform-origin:top center`;
  [L,R,S].forEach(bindCombo);
  fresh.forEach(x=>{x.classList.add('gone');void x.offsetWidth;(window.requestAnimationFrame||setTimeout)(()=>x.classList.remove('gone'))});
  [L,R].forEach(el=>{const v=el.querySelector('[data-vault]'); if(v){v.onmouseenter=e=>{$('v44tip').innerHTML=`<div class="tc37 locked"><div class="th37"><span><em>Vault</em><b>${over.length} more</b></span></div><span class="tx37">More achievements than the rail has room for. Earned ones and the closest to earning stay out; these wait here.</span>
      <div class="sl37">${over.map(s=>`<span class="ps37 need no"><span class="pi">${icon(SETICON[s.name]||'Trophy',15)}</span><b>${esc(setName(s))}</b><em>${s.ids.filter(on).length}/${s.ids.length}</em></span>`).join('')}</div></div>`;$('v44tip').hidden=false;moveTip(e)};
    v.onmousemove=moveTip; v.onmouseleave=()=>{$('v44tip').hidden=true}; v.onclick=e=>{e.stopPropagation();leftOpen=true;topic="sets";render()}}});
}
function wsCard(s){const st=comboState(s), fix=(s.lifts||[]), fixOn=fix.filter(on);
  return `<button class="ws40 ${st}" data-set="${esc(s.name)}" aria-label="${esc(setName(s))}: ${CST[st]}"><span class="fr"></span><span class="in"><span class="ic">${icon(SETICON[s.name]||'TriangleAlert',18)}</span>
    <span class="t"><b>${esc(setName(s))}</b><em>${st==='cleared'?`fixed by ${esc(fixOn.map(id=>find(id)?.name||id).join(', '))}`:fix.length?`fix: ${esc(fix.map(id=>find(id)?.name||id).join(' or '))}`:esc(s.lifts_text||'')}</em></span></span>${st==='curse'?'<span class="cr38 bad">!</span>':'<span class="cr38 ok">✓</span>'}</button>`}
// lines from a rail card to its pieces on the board, drawn only while you hover it
function tethers(s,from){const T=$('v44teth'), fb=$('v44fit')?.parentNode; if(!T||!fb||!fb.getBoundingClientRect) return;
  if(!s||!from||!from.getBoundingClientRect){T.innerHTML='';return}
  const F=fb.getBoundingClientRect(), B=from.getBoundingClientRect(), rail=from.closest&&from.closest('.rail40'), strip=from.closest&&from.closest('.strip40');
  const fx=rail?(rail.classList.contains('l')?B.right:B.left)-F.left:B.left+B.width/2-F.left, fy=strip?B.top-F.top:B.top+B.height/2-F.top;
  const ws=s.kind==="curse", list=[...s.ids.map(id=>[id,ws?'bad':on(id)?'on':'off']),...(ws?(s.lifts||[]).map(id=>[id,'fix']):[])];
  const paths=list.map(([id,cls])=>{const el=$('v44inv')?.querySelector(`[data-t="${id}"]`); if(!el) return ''; const E=el.getBoundingClientRect();
    const tx=(rail?(rail.classList.contains('l')?E.left:E.right):E.left+E.width/2)-F.left, ty=(strip?E.bottom:E.top+E.height/2)-F.top;
    const mx=(fx+tx)/2, c1=strip?`${fx} ${fy-60}`:`${mx} ${fy}`, c2=strip?`${tx} ${ty+60}`:`${mx} ${ty}`;
    return `<path d="M${fx} ${fy}C${c1} ${c2} ${tx} ${ty}" class="${cls}"/><circle cx="${tx}" cy="${ty}" r="3.5" class="${cls}"/>`}).join('');
  T.innerHTML=`<svg width="${F.width}" height="${F.height}" viewBox="0 0 ${F.width} ${F.height}">${paths}</svg>`}
// a combo in focus: its pieces light on the board and on the ring; everything else steps back
function cbFocus(s){const inv=$('v44inv'), pipes=$('v44pipes'); if(!inv||!inv.querySelectorAll) return;
  const syn=s&&s.kind==="synergy", need=s?s.ids:[], fix=s&&!syn?(s.lifts||[]):[], all=[...need,...fix];
  const secs=new Set(all.map(id=>find(id)?.slot.id).filter(Boolean)), role=id=>need.includes(id)?(syn?'cbt':'cbbad'):fix.includes(id)?'cbfix':'';
  inv.classList.toggle('cbfocus',!!s); pipes&&pipes.classList&&pipes.classList.toggle('cbfocus',!!s);
  inv.querySelectorAll('[data-t]').forEach(el=>{const r=role(el.dataset.t);['cbt','cbbad','cbfix'].forEach(c=>el.classList.toggle(c,r===c))});
  inv.querySelectorAll('[data-seg]').forEach(el=>{const r=role(el.dataset.seg);['cbt','cbbad','cbfix'].forEach(c=>el.classList.toggle(c,r===c));el.classList.toggle('miss',!!r&&!on(el.dataset.seg))});
  inv.querySelectorAll('[data-bag]').forEach(el=>el.classList.toggle('cbin',secs.has(el.dataset.bag)));
  inv.querySelectorAll('[data-wt]').forEach(el=>el.classList.toggle('cbin',all.includes(el.dataset.wt)));
  pipes&&pipes.querySelectorAll&&pipes.querySelectorAll('[data-pipe]').forEach(el=>el.classList.toggle('cbin',secs.has(el.dataset.pipe)));
  inv.querySelectorAll('[data-cb]').forEach(g=>g.classList.toggle('hot',!!s&&g.dataset.cb===s.name));
  document.querySelectorAll('#p34 .md36,#p34 .ac38,#p34 .ws40').forEach(md=>md.classList.toggle('cbme',!!s&&md.dataset.set===s.name));
  document.querySelectorAll('#p34 .rail40,#p34 .strip40').forEach(r=>r.classList.toggle('cbfocus',!!s));
  inv.querySelectorAll('.shelf36 .sh36').forEach(sv=>{const md=sv.querySelector('.md36');sv.classList.toggle('cbme',!!s&&!!md&&md.dataset.set===s.name)})}
// the combo card: what it gives, the parts it needs as slots, and what to do next
function tipCombo(s,e){const st=comboState(s), nm=setName(s), syn=s.kind==="synergy", need=s.ids, have=need.filter(on).length, fix=syn?[]:(s.lifts||[]);
  const big=`<svg viewBox="0 0 40 40" width="40" height="40" class="tm37">${medal({s,st},20,20,16)}</svg>`;
  const slot=(id,kind)=>{const t=find(id), ok=on(id);
    return `<span class="ps37 ${kind} ${ok?'ok':'no'}"><span class="pi">${icon(ICON[id]||'Box',15)||'•'}</span><b>${esc(t?.name||id)}</b><em>${kind==='need'?(ok?'✓ equipped':'empty slot'):kind==='bad'?(ok?'present':'—'):(ok?'✓ equipped':'not yet')}</em></span>`};
  const pips=need.map(id=>`<i class="pp37${on(id)?' on':''}${syn?'':' bad'}"></i>`).join('');
  const word=syn?(st==="earned"?'Unlocked!':st==="near"?`${need.length-have} piece to go`:`${need.length-have} pieces to go`):(st==="curse"?'Active':st==="cleared"?'Cleared':'Dormant');
  const miss=need.filter(id=>!on(id)), fixOn=fix.filter(on);
  const cta=syn?(st==="earned"?`<span class="cta37 ok">★ Earned. ${esc(s.effect||'')}</span>`:miss.length===1?`<span class="cta37">Equip <b>${esc(find(miss[0])?.name||miss[0])}</b> to unlock it.</span>`:`<span class="cta37">Equip ${miss.map(id=>`<b>${esc(find(id)?.name||id)}</b>`).join(' and ')} to unlock it.</span>`)
    :(st==="cleared"?`<span class="cta37 ok">Cleared by ${fixOn.map(id=>`<b>${esc(find(id)?.name||id)}</b>`).join(', ')}.</span>`:fix.length?`<span class="cta37 bad">Equip ${fix.map(id=>`<b>${esc(find(id)?.name||id)}</b>`).join(' or ')} to clear it.</span>`:'');
  $('v44tip').innerHTML=`<div class="tc37 ${syn?'ach':'ws'} ${st}"><div class="th37">${big}<span><em>${syn?'Achievement':'Weak spot'}</em><b>${esc(nm)}</b></span></div>
    ${syn?`<div class="tp37">${pips}<span>${have}/${need.length} parts</span><strong>${word}</strong></div>`:`<div class="tp37"><strong class="ws37">${word}</strong></div>`}
    <span class="tx37">${syn?'<em>Reward</em> ':'<em>What goes wrong</em> '}${esc(s.effect||'')} ${syn?`<b class="xp42">+${AXP} XP</b>`:`<b class="xp42">+${WXP} XP when cleared</b>`}</span>
${s.proposed?'<span class="lt-l dimk">Proposed recipe; not in the model yet.</span>':''}
    ${need.length?`<div class="sl37"><em>${syn?'Parts':'Caused by'}</em>${need.map(id=>slot(id,syn?'need':'bad')).join('')}</div>`:''}
    ${fix.length?`<div class="sl37"><em>Fix with ${fix.length>1?'either':''}</em>${fix.map(id=>slot(id,'fix')).join('')}</div>`:''}
    ${cta}<span class="lt-l dimk">Click to open it</span></div>`;
  $('v44tip').hidden=false; moveTip(e)}
// a moment when a switch completes a pair
let lastAch=null, lastAchKey=null, lastWeak=null;
function achToast(){const now=H.sets.filter(s=>s.kind==="synergy"&&s.status==="active").map(s=>s.name), weak=H.sets.filter(s=>s.kind==="curse"&&s.status==="active").map(s=>s.name);
  if(lastAchKey===BASE.key&&lastWeak){if(weak.some(n=>!lastWeak.includes(n))) sndQueue('weak'); if(lastWeak.some(n=>!weak.includes(n))) sndQueue('fixed')}
  lastWeak=weak;
  if(lastAchKey===BASE.key&&lastAch){const nw=now.filter(n=>!lastAch.includes(n)); const t=$('v44toast');
    if(nw.length) sndQueue('bell');
    if(nw.length&&t){const s=H.sets.find(x=>x.name===nw[0]);t.innerHTML=`<b>Achievement: ${esc(setName(s))}</b><span>${esc(s.effect||'')}</span>`;t.hidden=false;t.classList.remove('pop');void t.offsetWidth;t.classList.add('pop');clearTimeout(t._timer);t._timer=setTimeout(()=>t.hidden=true,4200)}}
  lastAch=now; lastAchKey=BASE.key}
// a level-up moment when a switch pushes the harness over a level
let lastLevel=null, lastKey=null;
function levelToast(){
  const cur=H.tiers.filter(t=>t.reached).length;
  if(lastKey===BASE.key&&lastLevel!==null&&cur>lastLevel){const t=$('v44toast'); if(t){const nm=H.tiers[cur-1].name;
    t.innerHTML=`<b>Level up!</b><span>${esc(nm)}: ${esc(TIER_MEANS[H.tiers[cur-1].id]||'')}</span>`;t.hidden=false;t.classList.remove('pop');void t.offsetWidth;t.classList.add('pop');clearTimeout(t._timer);t._timer=setTimeout(()=>t.hidden=true,4200)}}
  lastLevel=cur; lastKey=BASE.key;
}
// conduits: drawn after layout, from each section to the core's edge
