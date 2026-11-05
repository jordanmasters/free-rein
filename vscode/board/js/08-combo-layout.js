// ---- v44: combos. Every recipe is a pair; achievements when both are in, weak spots when one piece causes trouble
let SHOWC=false, SOLO=false, wasC=false;   // combinations are in the side panel, not around the board
let COMBO="cards", LAY="corners", MID="bars";
let GEO=null;
const segA={};
const SETICON={"Continuity":"Infinity","Curated canon":"BookCheck","Grounded recall":"Anchor","Defense in depth":"ShieldPlus","Knows when to stop":"OctagonX","Learning loop":"RefreshCw","Designed crew":"Users","Earned completion":"BadgeCheck",
  "Approval fatigue":"BellRing","Heavy pack":"Weight","Unread record":"FileX","Accidental swarm":"Bug","Too many tools to choose from":"ListX","Marks its own work":"PencilLine","Closed loop":"Repeat","Paper trail":"ScrollText","Safe autopilot":"Sparkles"};
const CST={earned:"Earned",near:"One piece away",locked:"Not started",curse:"Weak spot",cleared:"Fixed"};
function comboState(s){if(s.kind==="synergy"){const have=s.ids.filter(on).length;return s.status==="active"?"earned":s.ids.length-have===1?"near":"locked"}
  return s.status==="active"?"curse":s.status==="cleared"?"cleared":"dormant"}
function circMean(as){let x=0,y=0;as.forEach(a=>{x+=Math.cos(a);y+=Math.sin(a)});return Math.atan2(y,x)}
function combos(){return H.sets.map(s=>{const st=comboState(s), mem=s.ids.length?s.ids:(s.lifts||[]), as=mem.map(id=>segA[id]).filter(a=>a!==undefined);
  return {s,st,mem,as,a:as.length?circMean(as):0}}).filter(c=>c.st!=="dormant"&&c.as.length)}
function iconAt(name,x,y,size,col){const L=window.lucide,node=L&&L.icons&&L.icons[name];if(!node)return '';
  return `<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${(node[2]||[]).map(([t,at])=>`<${t} ${Object.entries(at).map(([k,v])=>`${k}="${v}"`).join(' ')}/>`).join('')}</svg>`}
const ICOL={earned:"#1A1508",near:"#F2C35B",locked:"#4A4F5B",curse:"#FF8A80",cleared:"#6B7080"};
function medal(c,x,y,r){const nm=SETICON[c.s.name]||(c.s.kind==="curse"?"TriangleAlert":"Trophy");
  const ring=c.st==="earned"?`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#md36)" stroke="#FFE7A6" stroke-width="1"/>`
    :c.st==="near"?`<circle cx="${x}" cy="${y}" r="${r}" fill="#1D1A12" stroke="#F2C35B" stroke-width="1.1"/><path d="M${x} ${y-r}A${r} ${r} 0 0 0 ${x} ${y+r}Z" fill="rgba(242,195,91,.28)"/><circle cx="${x}" cy="${y}" r="${r+2.5}" fill="none" stroke="#F2C35B" stroke-width=".8" class="pulse36"/>`
    :c.st==="locked"?`<circle cx="${x}" cy="${y}" r="${r}" fill="#121318" stroke="#3A3E49" stroke-width="1" stroke-dasharray="2 1.6"/>`
    :c.st==="curse"?`<circle cx="${x}" cy="${y}" r="${r}" fill="#2A1214" stroke="#FF6B6B" stroke-width="1.1"/><path d="M${x+r*.2} ${y-r} l-${r*.35} ${r*.55} l${r*.4} ${r*.25} l-${r*.3} ${r*.5}" fill="none" stroke="#FF6B6B" stroke-width=".7" opacity=".8"/>`
    :`<circle cx="${x}" cy="${y}" r="${r}" fill="#15171C" stroke="#4A4F5B" stroke-width="1"/>`;
  return `<g class="md36 ${c.st}" data-set="${esc(c.s.name)}" tabindex="0">${ring}${iconAt(nm,x,y,r*1.1,ICOL[c.st])}${c.st==="cleared"?`<circle cx="${x+r*.75}" cy="${y-r*.75}" r="${r*.38}" fill="#3FAF8F"/>`:''}</g>`}
let preview=null;
function drawCombos(){
  const inv=$('v44inv'); if(!inv||!inv.querySelector) return; const G=inv.querySelector('.cmb36'), C=inv.querySelector('.ctr36'); if(G) G.innerHTML=''; if(C) C.innerHTML='';
  drawMid();
}
// the centre: one harness level from XP; hovering a piece previews what it would add
function bindLayers(){const inv=$('v44inv'); if(!inv||!inv.querySelectorAll) return;
  inv.querySelectorAll('[data-layer]').forEach(bt=>bt.onclick=e=>{e.stopPropagation();if(LAYER===bt.dataset.layer)return;LAYER=bt.dataset.layer;render();layoutFit()})}
function drawMid(){bindLayers();const inv=$('v44inv'), M=inv?.querySelector('.mid39'), C=inv?.querySelector('.ctr36'); if(!M||!C) return;
  const x=SEQON&&CM&&CM.key===BASE.key?CM.x:xpOf(), L=lvlOf(x), lo=lvlXP(L), hi=lvlXP(L+1), fr=L>=LVMAX?1:(x-lo)/(hi-lo), d=preview?xpGain(preview):0, L2=lvlOf(x+d), fr2=L2>L?1:(x+d-lo)/(hi-lo);
  const cur=H.tiers.filter(t=>t.reached).pop(), rk=cur&&RANKS[cur.id]?RANKS[cur.id][0]:'Unranked', r=108.4, c=2*Math.PI*r;   // XP: the rim, just outside the ring of pieces
  C.innerHTML=CHAR.on?roots():`<circle cx="110" cy="110" r="${r}" fill="none" stroke="rgba(242,195,91,.13)" stroke-width="3"/>
    <circle cx="110" cy="110" r="${r}" fill="none" stroke="#F2C35B" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(c*fr).toFixed(1)} ${c}" transform="rotate(-90 110 110)" class="xpa42"/>
    ${d>0?`<circle cx="110" cy="110" r="${r}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="${(c*(fr2-fr)).toFixed(1)} ${c}" stroke-dashoffset="${(-c*fr).toFixed(1)}" transform="rotate(-90 110 110)" class="xpg42"/>`:''}`;
  const pt=preview&&find(preview);
  M.className='mid39 xp42';
  const rtn=(BASE.runtime||{}).name, bld=[(BASE.build||{}).name,BASE.profile&&BASE.profile.kind==='product'?'on rails':''].filter(Boolean).join(' · ');
  const chr=CHAR.on, G=growOf(L), G2=growOf(L2);
  M.className='mid39 xp42'+(chr?' ch82m':'');
  // the runtime by its own name (a profile carries its own name in runtime.name, so look the runtime up), and the model when known
  const RTB=BASE.runtime||{}, rtName=(((BASE.bases||[]).find(b=>b.id===RTB.id||b.id===RTB.core)||{}).name||RTB.name||'Your agent').replace(/\s*\(.*?\)\s*/g,'').trim();
  const mdl=((((BASE.models||{}).models)||[]).find(m=>m.name)||{}).name||'';
  M.innerHTML=chr&&SOCKET()?`<div class="ch82 sk84${WATCH?' watch':''}"><div class="idn"><b class="idr">${esc(rtName)}</b>${mdl?`<span class="idm">${esc(mdl)}</span>`:''}</div>
      <svg class="face" viewBox="0 0 100 60" aria-hidden="true"><g class="f f-eyes"><g class="fc"><g class="ey"><circle cx="37" cy="24" r="7.5"/><circle cx="63" cy="24" r="7.5"/></g><path d="M41 38 q9 7 18 0"/></g></g>
        <g class="f f-squint" transform="translate(0 -2)"><path d="M28 27 q9 -9 18 0 M54 27 q9 -9 18 0"/><path class="fill" d="M38 37 q12 11 24 0 z"/></g>
        <g class="f f-grin" transform="translate(0 -3)"><path d="M26 28 q10 -14 20 0 M54 28 q10 -14 20 0"/><path class="fill gold" d="M33 35 q17 20 34 0 z"/><circle class="cheek" cx="24" cy="38" r="4"/><circle class="cheek" cx="76" cy="38" r="4"/></g>
        <g class="f f-worry" transform="translate(-3 1)"><path d="M28 16 l15 -5 M72 16 l-15 -5"/><circle cx="37" cy="25" r="5"/><circle cx="63" cy="25" r="5"/><path d="M36 43 q3.5 -4 7 0 q3.5 4 7 0 q3.5 -4 7 0 q3.5 4 7 0"/><path class="drop" d="M78 10 q4 6 0 9 q-4 -3 0 -9z"/></g>
        <g class="f f-dots"><circle cx="35" cy="30" r="4.5"/><circle cx="50" cy="30" r="4.5"/><circle cx="65" cy="30" r="4.5"/></g></svg></div>`
    :chr?`<div class="ch82" style="--chg:${(.06+.6*Math.min(1,(H.backed||0)/100)).toFixed(2)}">${SPR.svg(Math.max(G,G2),G2>G?G:null)}</div>`
  :`${rtn?`<em class="xw47">${esc(rtn)}<br><span>${esc(bld)}</span></em>`:''}<em class="xl42">Level</em><b class="xn42">${L2>L?`${L}<span class="xu42">→${L2}</span>`:L}</b>
    <span class="xx42">${d>0?`<b>+${d}</b> XP`:`${x} XP`}</span>${pt&&d>0?`<span class="xg42">${on(preview)?'when hardened':'adding '+esc(pt.name)}</span>`:`<span class="xg42 dim">${hi-x} more to level ${L+1}</span>`}${BASE.models?`<span class="xt75">${takesLine()}</span>`:''}`;
  {const rxe=M.parentNode; let lv=rxe&&rxe.querySelector&&rxe.querySelector('.lv83');
    if(chr&&rxe){if(!lv){rxe.insertAdjacentHTML('beforeend','<div class="lv83"></div>');lv=rxe.querySelector('.lv83')}
      lv.innerHTML=`<em class="xl42">Level</em><b class="xn42">${L2>L?`${L}<span class="xu42">→${L2}</span>`:L}</b><span class="xx42">${d>0?`<b>+${d}</b> XP`:`${x} XP`}</span>
        <span class="xpb83" aria-hidden="true"><i class="xpa83" style="width:${(fr*100).toFixed(1)}%"></i>${d>0?`<b style="left:${(fr*100).toFixed(1)}%;width:${(Math.max(0,fr2-fr)*100).toFixed(1)}%"></b>`:''}</span>`;
      lv.title=L>=LVMAX?`Level ${L}: the top level`:`Level ${L}: ${x} XP, ${hi-x} more to level ${L+1}`}
    else if(lv) lv.remove()}
  if(chr){applyChar(M);vgApply();lvApply();const ch=M.querySelector('.ch82');if(ch&&pt&&d>0)ch.classList.add(G2>G||L2>L?'eager':'peek')}
  const nx=GROW[G+1], who=chr&&SOCKET()?`<b>Jack: ${esc(rtName)}${mdl?` · ${esc(mdl)}`:''}, wrapped in your harness</b><span class="lt-l">The cables carry on into it, faster and brighter the more each section is backed; its glow is the harness's backed trust (${H.backed||0}%). It watches your pointer and reacts when something changes.</span>${BASE.models?`<span class="lt-l">${takesLine()}</span>`:''}`:chr?`<b>${esc(charName())}: ${GROW[G][0].toLowerCase()}</b><span class="lt-l">It grows with your level${nx?`. Next: ${nx[0].toLowerCase()} at level ${nx[1]}, ${nx[1]-L} to go`:', and this is the top of the scale'}. Its roots reach each section with something in place, thicker where more is; along each, every section with something in place feeds it a root, as wide as its cable, flowing faster and brighter the more of it is backed; its glow is the harness's backed trust (${H.backed||0}%); and a piece that moves up sends a pulse that charges it; it reacts when something on the board changes.</span>
    <span class="lt-l">${L>=LVMAX?'The top level.':`${hi-x} more XP to level ${L+1}.`}${rtn?` Runs on ${esc(rtn)}${bld?' · '+esc(bld):''}.`:''}</span>${BASE.models?`<span class="lt-l">${takesLine()}</span>`:''}`:'';
  M.onmouseenter=e=>{$('v44tip').innerHTML=`${who}<b>Level ${L} · ${x} XP</b><span class="lt-l">Every piece you level up earns XP: started +${PXP[1]}, equipped +${PXP[2]-PXP[1]}, hardened +${PXP[3]-PXP[2]}. Each achievement adds +${AXP}; clearing a weak spot adds +${WXP}.</span>
    <span class="lt-l">Situations your own harness decides add XP too. Click for level and how far it's trusted.</span>`;$('v44tip').hidden=false;moveTip(e)};
  M.onmousemove=moveTip; M.onmouseleave=()=>{$('v44tip').hidden=true};
  queueMotion();
  if(COMPACT){const fb=inv.closest('.fitbox23')||inv.parentNode, cr=$('v44crest'), lv=$('v44lvl'), fold=CSIZE!=='full';
    // folded: the circle, small, in the top card's corner (click for the full one), and the level beside it
    const xx=xpOf(), LL=lvlOf(xx), tip=`Level ${LL} · ${xx} XP, ${lvlXP(LL+1)-xx} to level ${LL+1}. Click for the full circle`;
    if(cr){cr.hidden=!fold;cr.innerHTML=fold?`<button class="cb82" data-csize="full" title="${tip}" aria-label="${tip}">${crest(40)}</button>`:''}
    if(lv){lv.hidden=true;lv.innerHTML=''}
    [cr,lv].forEach(n=>n&&n.querySelectorAll('[data-csize]').forEach(b=>b.onclick=()=>setCSize(b.dataset.csize)));
    // the size switch lives in the top bar now, beside Expand
    const z=$('v44czf'); z&&z.remove&&z.remove()}
}
