// ---- v44: one maturity scale, drawn the same way on tiles and on the core
const MAT=["Empty","Started","Equipped","Hardened"];
const MATD=["Nothing of this type yet.","Partly there.","In place.","In place, and backed by something that can stop a bad action: it stops or holds on its own, or an equipped safeguard guards it."];
function maturity(t){
  if(!HOLDOFF&&HOLD[t.id]!=null) return HOLD[t.id];   // held at its old level until its turn in a change (seqPlan)
  if(t.stage<=0) return 0; if(t.stage===1) return 1;
  if(kindOf(t)==="blocks") return 3;
  if(H.guards.some(g=>g.cap===t.id&&on(g.ctl))) return 3;
  if(exHard(t)) return 3;
  return 2;
}
// an example (not a real harness) can say a piece is hardened outright, to show the top of the scale (evaluate.ts)
const exHard=t=>t.maturity===3&&!!BASE.profile&&BASE.profile.kind==='example';
function hardenedBy(t){if(kindOf(t)==="blocks") return t.holds>0?"it holds on its own":"it can stop an action itself"; if(exHard(t)&&!H.guards.some(g=>g.cap===t.id&&on(g.ctl))) return "the example says so";
  const g=H.guards.find(g=>g.cap===t.id&&on(g.ctl)); return g?`guarded by ${find(g.ctl)?.name}`:""}
// the badge is a shape only: a star for an ability, a shield for a safeguard
function shape(k,size){
  return k==="cap"?`<svg class="bdg" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor"/></svg>`
    :`<svg class="bdg" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><path d="M8 1.2 13.5 3.2v4.6c0 3.4-2.4 5.8-5.5 7-3.1-1.2-5.5-3.6-5.5-7V3.2Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
}
const FIRMW={asks:"asks you",checks:"checks",blocks:"stops it"};
// what the tiles show beyond the piece itself, chosen in "Show on tiles": advice and analysis are off by default so
// the board stays calm; the rim marks Enforced on the tile and the circle (on: B+, off: B)
const TL=(()=>{const d={next:false,combo:false,sits:false,plat:false,rim:true};try{return {...d,...JSON.parse(localStorage.getItem('v44-tl')||'{}')}}catch(x){return d}})();
const TLN=[['next','Next step','pieces that would unlock the next tier or back your weakest kind of work, with the step they reach'],
  ['combo','One piece from a combo','pieces that would complete an achievement or fix a weak spot'],
  ['sits','Situations it decides','how many situations each piece decides, coloured by its worst verdict'],
  ['plat','Enforced by the platform','pieces held outside your files'],
  ['rim','Mark Enforced','an outline on the Enforced step and a rim on the circle, white once reached']];
let TLPOP=false;
function setTL(k,v){TL[k]=v;try{localStorage.setItem('v44-tl',JSON.stringify(TL))}catch(x){}lastSig=null;render()}
// a piece's ladder, from the core: only the steps that are real for it (Equipped, Tuned, Enforced), and how many it
// has reached. Equipped means something is there; a piece switched on or off on the board moves with it.
function ladderOf(t){const L=t.ladder||{steps:['Equipped'],reached:0}, held=!HOLDOFF&&HOLD[t.id]!=null?HOLD[t.id]:null;
  const r=t.stage<=0||held===0?0:Math.max(1,L.reached); return {steps:L.steps,reached:r}}
const stepWord=L=>L.reached?L.steps[L.reached-1]:'Not there yet';
const stepLine=L=>`${stepWord(L)}${L.steps.length>1?`, step ${L.reached} of ${L.steps.length}`:''}${L.reached<L.steps.length&&L.reached?`; next: ${L.steps[L.reached]}`:''}`;
// pieces that would finish something: the one missing piece of an achievement, or a piece that fixes an open weak spot
function comboNeeds(id){if(on(id)) return null;
  return (H.sets||[]).find(s=>s.kind==='synergy'&&s.status!=='active'&&s.ids.filter(x=>!on(x)).length===1&&s.ids.includes(id))
    ||(H.sets||[]).find(s=>s.kind==='curse'&&s.status==='active'&&(s.lifts||[]).includes(id))||null}
// the View menu: how the board looks, in one place. The sections around the core, fit, then what the tiles show
function tlMenu(){const opt=(attr,on,n,d)=>`<label><input type="checkbox" ${attr} ${on?'checked':''}><span>${n}${d?`<small>${d}</small>`:''}</span></label>`;
  return `<div class="tl56" role="dialog" aria-label="View"><b>View</b>${opt('data-vsolo="1"',!SOLO,'Sections around the core','off shows only the circle')}${opt('data-vfit="1"',fit,'Fit to the window','')}
    <b class="sub">Show on tiles</b>${TLN.map(([k,n,d])=>opt(`data-tl="${k}"`,TL[k],n,d)).join('')}</div>`}
// how many of a piece this harness has, as the tile shows it: in your files, in your home folder and packages (while
// home is shown), and built into the runtime (while its layer is on). The tile, its ring and its pane all use this.
function shownOf(t){const mine=[...(t.inst||[]),...(unseen?(t.extra||[]):[])], built=BASE.base_on!==false?(t.runtime_items||[]).length:0;
  return {mine, home:unseen?(t.extra||[]).length:0, built, tot:mine.length+built}}
// how much of this piece you can change (from the core), as a ring in the tile's corner, split clockwise from the top:
// solid = fixed (a vendor or your organization's managed policy holds it), grey = built in (you can switch it off or
// replace it, not rewrite it), the empty track = yours. A lock sits inside only when part of it is fixed. Who holds each
// part is said in words, in the hover card and the piece pane.
// measured against the same total the tile shows: your files, your home folder and packages (when shown), and what the
// runtime has built in (while its layer is on). Packages you added are yours to change, so they count as yours.
function heldOf(t){const hs=t.held||[]; if(!hs.length) return null;
  const S=shownOf(t), mine=S.mine, baseOn=BASE.base_on!==false;
  const fixed=hs.filter(h=>!h.soft).reduce((a,h)=>a+h.n,0), built=baseOn?hs.filter(h=>h.soft).reduce((a,h)=>a+h.n,0):0;
  const tot=Math.max(S.tot||t.count||0,fixed+built);
  if(!fixed&&!built) return null;
  const rt=(BASE.runtime||{}).name||'the runtime', pk=[...new Set(mine.map(x=>x.pkg).filter(Boolean))], fromPkg=mine.filter(x=>x.pkg).length;
  const yours=tot-fixed-built;
  const rows=[...hs.filter(h=>!h.soft).map(h=>({k:'fixed',n:h.n,text:h.by==='org'?'Fixed: your organization\'s managed policy holds it':`Fixed: ${rt} holds it; you can't change it`})),
    ...(built?[{k:'built',n:built,text:`Built into ${rt}: you can switch it off or replace it, not rewrite it`}]:[]),
    ...(yours>0?[{k:'yours',n:yours,text:fromPkg?(fromPkg>=yours?`From packages you added (${pk.join(', ')}): yours to change`:`Yours, including ${fromPkg} from packages you added (${pk.join(', ')})`):'Yours'}]:[])];
  return {fixed, built, tot, rows, text:rows.map(r=>`${r.text} (${r.n} of ${tot})`).join('. ')+'.'}}
// in the pane: the same, as a labelled bar in words (yours, built in, can't edit), and who holds what
function holdCard(t){const h=heldOf(t); if(!h) return '';
  const segs=h.rows.map(r=>({k:r.k,n:r.n,label:r.k==='fixed'?`${r.n} can't edit`:r.k==='built'?`${r.n} built in`:`${r.n} yours`}));
  return `<div class="hb32">${segs.map(s=>`<i class="${s.k}" style="flex:${s.n}" title="${esc(s.label)}">${esc(s.label)}</i>`).join('')}</div><p class="mute">${esc(h.text)}</p>`}
function tile(t,demo){
  const wall=rtOf(t)[1]===null||!!t.not_offered, n=seen(t), k=demo?(t.kindOverride||"checks"):kindOf(t), m=demo?(t.matOverride??Math.max(0,Math.min(2,t.stage))):maturity(t), ic=icon(ICON[t.id]||"Sparkles",26), LZ=demo?{cls:'',mark:''}:lensOf(t);
  const L=demo&&t.ladderOverride?t.ladderOverride:ladderOf(t), unk=t.stage<0, nxt=!demo&&TL.next&&H.next[t.id]&&L.reached<L.steps.length, cmb=!demo&&TL.combo&&comboNeeds(t.id);
  const off=!demo&&typeof beyondPiece==='function'&&beyondPiece(t), ed=off&&typeof edOf==='function'?edOf(MAPTO):null;
  return `<button ${LZ.style?`style="${LZ.style}" `:''}class="t19 t31 t32 m${L.reached?2:0}${unk?' unk':''}${cmb?' cb56':''}${!demo&&typeof symPieces==='function'&&symPieces().includes(t.id)?' sym70':''}${LZ.cls}${drCls(t.id,m)}${sel===t.id?' sel':''}${wall?' wall':''}" ${demo?'tabindex="-1" aria-hidden="true"':`data-t="${t.id}"`} aria-label="${esc(t.name)}: ${unk?"Free Rein can't tell whether it's there":stepLine(L)}, ${KNAME[k]}${n?', '+n+' equipped':''}${off?`. ${ed.name}'s ${ed.view} window doesn't change this`:''}${!demo&&heldOf(t)?'. '+esc(heldOf(t).text):''}${cmb?`. ${cmb.kind==='synergy'?'Completes':'Fixes'} ${esc(setName(cmb))}`:''}">
    ${(()=>{const S=shownOf(t), nh=S.mine.length, nr=S.built, tot=S.tot;
      const tip=[nh?`${nh} in your files${unseen&&(t.extra||[]).length?` (${(t.extra||[]).length} from your home folder)`:''}`:'',nr?`${nr} built into ${(BASE.runtime||{}).name||'the runtime'}${Object.keys(t.runtime_when||{}).length?`, and ${Object.keys(t.runtime_when).length} more when they apply`:''}`:''].filter(Boolean).join(' + ');
      return `<span class="n" ${tot?`title="${tot} in this harness: ${esc(tip)}"`:''}>${!unk&&tot?'×'+tot:''}</span>`})()}
    <span class="ic31">${unk?`<b class="unk56" title="Free Rein can't tell whether this is there">?</b>`:ic||`<b class="noic">${esc(t.name[0])}</b>`}</span><span class="nm">${esc(t.name)}</span>
    ${nxt?`<span class="nx56" title="Next step: ${esc(H.next[t.id].join('; '))}">→ ${esc(L.steps[L.reached])}</span>`:''}
    ${!demo&&(t.control==='vendor'||t.control==='org')?'':!demo&&TL.plat&&t.stage>0&&t.control==='platform'?`<span class="ct47 plat" title="Enforced by the platform, not by your files">${icon('Landmark',11)}</span>`:''}
    ${unk||wall?'':stepBar(L)}${LZ.mark}</button>`;
}
// the step bar along the bottom of a tile: one step per real step of its ladder, lit as reached; Enforced gets a rim
function stepBar(L){return `<span class="lv44 ld" title="${esc(stepLine(L))}">${L.steps.map((s,i)=>`<i class="${i<L.reached?'on':''}${s==='Enforced'&&TL.rim?' en':''}"></i>`).join('')}</span>`}
// the core's ring: each section's arc split into one segment per type, its bands the piece's ladder
// a segment's insides (hit area, outline, one fill per level), built the same way for the whole ring or for one segment
const SEGR0=83, SEGR1=101;
const segArc=(ra,rb,a0,a1)=>{const p=(r,a)=>[110+r*Math.cos(a),110+r*Math.sin(a)];const [x0,y0]=p(rb,a0),[x1,y1]=p(rb,a1),[x2,y2]=p(ra,a1),[x3,y3]=p(ra,a0);
  return `M${x0} ${y0}A${rb} ${rb} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${ra} ${ra} 0 0 0 ${x3} ${y3}Z`};
const rimArc=(r,a0,a1)=>{const p=a=>[110+r*Math.cos(a),110+r*Math.sin(a)], [x0,y0]=p(a0), [x1,y1]=p(a1); return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`};
function segInner(t,b0,b1,col){const R0=SEGR0, R1=SEGR1, g=.016, L=ladderOf(t), m=L.reached, arc=segArc;
  const base=`<path class="rim" d="${arc(R0,R1,b0,b1)}" fill="#14161B" stroke="${m?col:'#33363F'}" stroke-opacity="${m?.55:1}" stroke-width=".8"/>`;
  // one band per real step, sharing the segment's depth: a 1-step piece that's there is full
  const n=L.steps.length, bh=(R1-R0)/n, fill=L.steps.map((s,i)=>`<path d="${arc(R0+i*bh+.7,R0+(i+1)*bh-.7,b0+.004,b1-.004)}" ${i<m?`fill="${col}" opacity=".95"`:n>1?'fill="#1C1F26" stroke="#353A45" stroke-width=".5"':'fill="none"'}/>`).join('')
    +(TL.rim&&L.steps.includes('Enforced')?`<path d="${rimArc(R1+1.8,b0+.004,b1-.004)}" fill="none" stroke="${m===n?'#ECEAE4':'#4A505C'}" stroke-width="1.6"/>`:'');
  const ed=typeof edOf==='function'?edOf(MAPTO):null, off=typeof beyondPiece==='function'&&beyondPiece(t);
  return `<path class="hit" d="${arc(R0-3,R1+3,b0-g/2,b1+g/2)}"/>${base}${fill}<title>${esc(t.name)}: ${t.stage<0?"can't tell":stepLine(L)}${ed&&off?`. ${ed.name}'s ${ed.view} window doesn't change this`:''}</title>`}
// one segment, redrawn in place (its group, classes and animations stay)
function segUpdate(id){const el=document.querySelector(`#v44inv [data-seg="${id}"]`), t=find(id); if(!el||!t||el.dataset.b0==null) return;
  el.innerHTML=segInner(t,+el.dataset.b0,+el.dataset.b1,el.dataset.col)}
function placeArcs(ang){LASTANG=ang;
  const ringG=$('v44inv')?.querySelector('.ring25'); if(!ringG) return;
  const cx=110, cy=110, ids=H.slots.map(s=>s.id).filter(id=>ang[id]!==undefined); if(!ids.length) return;
  const arc=segArc;
  const TAU=2*Math.PI, half=TAU/H.slots.length/2-.04, R0=83, R1=101;
  ringG.innerHTML=ids.map(id=>{const sl=H.slots.find(x=>x.id===id), a=ang[id], col=SECCOL[id], types=sl.types.filter(t=>typeof showPiece!=='function'||showPiece(t));
    if(!types.length) return '';
    const n=types.length, g=.016, w=(2*half-g*(n-1))/n;
    // the section's band (lit when the section is pointed at or selected): on the inner edge, under its blocks, which bounce outward
    return `<g class="arc33" data-arc="${id}"><path class="band33" d="${arc(R0-5.5,R0-2.5,a-half,a+half)}" fill="${col}"/>`+types.map((t,q)=>{const b0=a-half+q*(w+g), b1=b0+w;
      segA[t.id]=(b0+b1)/2;
      return `<g class="seg32" data-seg="${t.id}" data-b0="${b0}" data-b1="${b1}" data-col="${col}">${segInner(t,b0,b1,col)}</g>`}).join('')+`</g>`}).join('');
  // each segment is a piece you can hover and open
  ringG.querySelectorAll('[data-seg]').forEach(el=>{el.onmouseenter=e=>{e.stopPropagation();hp.seg=el.dataset.seg;paint();tipType(el.dataset.seg,e)};el.onmousemove=moveTip;
    el.onmouseleave=()=>{hp.seg=null;paint();$('v44tip').hidden=true};el.onclick=e=>{e.stopPropagation();sel=el.dataset.seg;selSet=null;render()}});
  if(typeof paintBeyond==='function') paintBeyond();
  drawCombos();
}


// the core: the ring, the achievement count, and the weak spots inside it
function coreHTML(){
  const cx=110, cy=110, ring=H.slots.map(sl=>`<g class="arc33" data-arc="${sl.id}"></g>`).join('');
  return `<div class="core22 core31 core36 core38" data-core="1">
    <div class="rx39"><svg viewBox="0 0 220 220" class="reactor"><defs><radialGradient id="cb38" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#25221A"/><stop offset=".75" stop-color="#121216"/><stop offset="1" stop-color="#0B0C0F"/></radialGradient>
      <radialGradient id="md36" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE7A6"/><stop offset=".55" stop-color="#F2C35B"/><stop offset="1" stop-color="#B9852B"/></radialGradient></defs>
      <circle cx="${cx}" cy="${cy}" r="106" fill="none" stroke="rgba(242,195,91,.22)" stroke-width="1" class="halo"/>
      <g class="ring25">${ring}</g>
      <circle cx="${cx}" cy="${cy}" r="78" fill="url(#cb38)" stroke="rgba(242,195,91,.4)" stroke-width="1"/>
      <g class="ctr36"></g><g class="cmb36"></g></svg><div class="mid39"></div></div>
    </div>`;
}
