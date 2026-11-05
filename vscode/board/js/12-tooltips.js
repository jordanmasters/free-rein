// ---- hover cards
function tipType(id,e){const t=find(id),g=gains(id),r=rtOf(t), m=maturity(t), k=kindOf(t), sp=supp(t), L=ladderOf(t), unk=t.stage<0;
  $('v44tip').innerHTML=`<b>${esc(t.name)}</b><span class="lt-sub lt-one">${esc(t.slot.name)} · ${unk?"Can't tell":esc(stepWord(L))}</span>${H.next[id]&&L.reached<L.steps.length?`<span class="lt-q34">→ Next step: ${esc(L.steps[L.reached])} · ${esc(why(id))}</span>`:''}<span class="lt-sub">${esc(t.slot.name)} · ${t.kind==='control'?'a control':'a capability'}</span><span class="lt-st st-${unk?'notchecked':L.reached?'equipped':'empty'}">${unk?"Can't tell":esc(stepWord(L))}${seen(t)?` ×${seen(t)}`:''}</span>
    <span class="lt-l lv44t">${unk?"<b>Free Rein can't tell whether it's there</b>":`${stepBar(L).replace('lv44 ld','lv44 ld big')}<b>${esc(stepLine(L))}</b>`}</span>
    <span class="lt-l">${esc(t.what)}</span>${g&&(g.trust>0||g.unlock||g.clears.length)?`<span class="lt-gain">Adding it: ${[g.trust>0&&`<b>+${g.trust} backed trust</b>`,g.unlock&&`unlocks the ${esc(RANKS[g.unlock.id]?RANKS[g.unlock.id][0]:g.unlock.name)} rank`,g.clears.length&&`clears ${g.clears.map(x=>esc(x.name)).join(', ')}`].filter(Boolean).join(' · ')}</span>`:''}
    <span class="lt-l"><span class="kl30">${shape(k,12)} ${k==='cap'?'Ability':'Safeguard · '+FIRMW[k]}: ${KINDS[k].toLowerCase()}</span>
    ${L.reached&&L.steps[L.reached-1]==='Enforced'&&hardenedBy(t)?`<span class="lt-l"><b>Enforced</b>: ${esc(hardenedBy(t))}</span>`:''}
    ${sp?`<span class="lt-l dimk">Supplied by ${sp==='hand'?'you':esc(sp)}</span>`:''}</span>
    ${r[1]===null?`<span class="lt-l warn">Not available on ${CORES[core]}</span>`:''}${typeof beyondPiece==='function'&&beyondPiece(t)?`<span class="lt-l">${esc(edOf(MAPTO).name)}'s ${esc(edOf(MAPTO).view)} window doesn't change this. Free Rein still covers it.</span>`:''}<span class="lt-l dimk">Click to open its details</span>`;
  $('v44tip').hidden=false;moveTip(e)}
// a tooltip sits beside the pointer, but never over the circle at the centre: if it would, it moves to the side of
// the circle that's free (and with the pointer inside the circle, it sits just outside the ring)
function moveTip(e){const tp=$('v44tip');if(!tp)return;const w=window.innerWidth||1200,h=window.innerHeight||800,tw=tp.offsetWidth||220,th=tp.offsetHeight||60;
  const rx=document.querySelector('#v44inv .core38 .rx39'), c=rx&&rx.getBoundingClientRect&&rx.getBoundingClientRect(), hit=(x,y)=>c&&c.width&&x<c.right+6&&x+tw>c.left-6&&y<c.bottom+6&&y+th>c.top-6;
  const fit=(x,y)=>x>=8&&y>=8&&x+tw<=w-8&&y+th<=h-8;
  const inCore=c&&c.width&&Math.hypot(e.clientX-(c.left+c.width/2),e.clientY-(c.top+c.height/2))<c.width/2;
  const cands=inCore?[[e.clientX<c.left+c.width/2?c.left-tw-10:c.right+10,e.clientY-th/2],[e.clientX<c.left+c.width/2?c.right+10:c.left-tw-10,e.clientY-th/2],[e.clientX-tw/2,c.bottom+10],[e.clientX-tw/2,c.top-th-10]]
    :[[e.clientX+16,e.clientY+16],[e.clientX-tw-16,e.clientY+16],[e.clientX+16,e.clientY-th-12],[e.clientX-tw-16,e.clientY-th-12]];
  let p=cands.find(([x,y])=>fit(x,y)&&!hit(x,y))||cands.find(([x,y])=>!hit(Math.max(8,Math.min(w-tw-8,x)),Math.max(8,Math.min(h-th-8,y))))||cands[0];
  tp.style.left=Math.max(8,Math.min(w-tw-8,p[0]))+"px";tp.style.top=Math.max(8,Math.min(h-th-8,p[1]))+"px"}

