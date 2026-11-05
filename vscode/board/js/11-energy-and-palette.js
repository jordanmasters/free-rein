// ---- v24: energy. Each piece powers its section by level; sections power the core.
const TIERCOL={dotfile:"#9AA1B2",guided:"#5FCB8A",gated:"#5AA9F0",governed:"#B38CF5"};
// v29: one meaning per channel. Tiles: hue is the kind of piece, fill is progress.
// Wires and cables: one colour (the tier's), width is how much is in place, brightness is how much is backed.
const KINDS={cap:"Adds something the agent can do.",asks:"Relies on the model stopping to check with you, so it can be skipped.",checks:"Something checks the work and reports what it finds.",blocks:"Can refuse an action outright, whatever the model does."};
const KNAME={cap:"Ability",asks:"Safeguard · asks you",checks:"Safeguard · checks",blocks:"Safeguard · stops it"};
const BARS={cap:0,asks:1,checks:2,blocks:3};
// the corner badge: a star for an ability, a shield with one to three bars for a safeguard
function badge(k,size=16){
  if(k==="cap") return `<svg class="bdg" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor"/></svg>`;
  const n=BARS[k];
  return `<svg class="bdg" viewBox="0 0 26 16" width="${size*1.6}" height="${size}" aria-hidden="true"><path d="M7 1.2 12.5 3.2v4.6c0 3.4-2.4 5.8-5.5 7-3.1-1.2-5.5-3.6-5.5-7V3.2Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
    ${[0,1,2].map(q=>`<rect x="${15+q*3.6}" y="${11-q*3}" width="2.6" height="${4+q*3}" rx=".6" fill="currentColor" opacity="${q<n?1:.25}"/>`).join('')}</svg>`;
}
const kindOf=t=>t.kind!=="control"?"cap":(t.holds>0||t.firm==="blocks")?"blocks":t.firm==="checks"?"checks":"asks";
const KCOL={cap:"#5FCB8A",asks:"#E58C5A",checks:"#5AA9F0",blocks:"#B38CF5"};
const backedOf=t=>t.stage===2?({cap:0,asks:.25,checks:.7,blocks:1})[kindOf(t)]:0;   // how much a piece backs the agent working alone
let GOLD="#F2C35B";
const PALS={
 rarity:{name:"Vivid",kinds:{cap:"#5FCB8A",asks:"#E58C5A",checks:"#5AA9F0",blocks:"#B38CF5"},tiers:{dotfile:"#9AA1B2",guided:"#5FCB8A",gated:"#5AA9F0",governed:"#B38CF5"},gold:"#F2C35B",glow:true},
 heat:{name:"Warm",kinds:{cap:"#D9B26A",asks:"#C2553A",checks:"#E8893A",blocks:"#BFF4FF"},tiers:{dotfile:"#9AA1B2",guided:"#E8893A",gated:"#F2C35B",governed:"#BFF4FF"},gold:"#FFF1D6",glow:true},
 calm:{name:"Calm",kinds:{cap:"#4FB3A6",asks:"#CDB98A",checks:"#6FA8DC",blocks:"#7C83E8"},tiers:{dotfile:"#9AA1B2",guided:"#4FB3A6",gated:"#6FA8DC",governed:"#7C83E8"},gold:"#F2C35B",glow:false}};
let PAL="rarity"; try{PAL=localStorage.getItem('v44-pal')||"rarity"}catch(e){}
const BASESEC={...SECCOL};
const mixHex=(a,b,t)=>'#'+[1,3,5].map(k=>Math.round(parseInt(a.slice(k,k+2),16)*(1-t)+parseInt(b.slice(k,k+2),16)*t).toString(16).padStart(2,'0')).join('');
const PALSEC={rarity:{...BASESEC},
  heat:Object.fromEntries(Object.entries(BASESEC).map(([k,c])=>[k,mixHex(c,'#FF9A5C',.5)])),
  calm:Object.fromEntries(Object.entries(BASESEC).map(([k,c])=>[k,mixHex(c,'#8A8F9C',.62)]))};
function applyPal(){
  const p=PALS[PAL]; Object.assign(KCOL,p.kinds); Object.assign(TIERCOL,p.tiers); GOLD=p.gold; Object.assign(SECCOL,PALSEC[PAL]||BASESEC); try{localStorage.setItem('v44-pal',PAL)}catch(e){}
  let st=document.getElementById('v44pal');
  if(!st&&document.createElement){st=document.createElement('style');st.id='v44pal';document.head&&document.head.appendChild(st)}
  if(!st) return;
  st.textContent=''+`
    .v44 .t30.next{box-shadow:0 0 0 2px ${GOLD},0 0 16px color-mix(in srgb,${GOLD} 45%,transparent)!important}
    .v44 .chip20.tier{border-color:color-mix(in srgb,${GOLD} 55%,transparent)}.v44 .chip20.tier b{color:${GOLD}}
    .v44 .tl.nx b{color:${GOLD}}.v44 .tl.nx{border-left-color:${GOLD}}
    ${p.glow?'':'.v44 .core22 .reactor{filter:none!important}.v44 .core22 .halo{animation:none}.v44 .port25{animation:none}.v44 .flow25{animation-duration:9s!important}.v44 .t32.m3{box-shadow:none}.v44 .hard32{filter:none}'}`;
}
const tierCol=()=>{const c=H.tiers.filter(t=>t.reached).pop();return c?TIERCOL[c.id]||"#9AA1B2":"#6B7080"};
const rgb=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)).join(",");
function energy(t){
  if(t.stage<=0) return 0; if(t.stage===1) return 1;
  if(t.holds>0||(t.kind==="control"&&t.firm==="blocks")) return 4;
  if(t.kind==="control"&&t.firm==="checks") return 3;
  return 2;
}
const BUS={context:"bottom",protocols:"bottom",tools:"bottom",agents:"bottom",memory:"right",guardrails:"left",configuration:"top",verification:"top",validation:"top",observability:"top"};
// v27: curves in the manner of React Flow's bezier edges. Each tile has a handle on the side that
// faces its section's output; a curve leaves the handle square to the tile and enters the output
// square to the section's edge. Curves fan in under the tiles and meet at the output.
function drawWires(outs){
  const inv=$('v44inv'); if(!inv||!inv.querySelectorAll) return {};
  const res={}, I=inv.getBoundingClientRect();
  H.slots.forEach(sl=>{
    const bag=inv.querySelector(`[data-bag="${sl.id}"]`); if(!bag||!bag.getBoundingClientRect) return;
    let svg=bag.querySelector('svg.wires24');
    if(!svg&&document.createElementNS){svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','wires24');svg.setAttribute('aria-hidden','true');bag.insertBefore(svg,bag.firstChild)}
    if(!svg) return;
    const B=bag.getBoundingClientRect(), W=B.width, Hh=B.height, side=BUS[sl.id]||"bottom";
    svg.setAttribute('viewBox',`0 0 ${W} ${Hh}`); svg.setAttribute('width',W); svg.setAttribute('height',Hh);
    const o2=outs&&outs[sl.id], ox=o2?o2.x:W/2, oy=o2?o2.y:Hh/2;
    const out=side==="bottom"?[ox,Hh-1]:side==="top"?[ox,1]:side==="right"?[W-1,oy]:[1,oy];
    const nrm=side==="bottom"?[0,1]:side==="top"?[0,-1]:side==="right"?[1,0]:[-1,0];
    const tiles=[...bag.querySelectorAll('[data-t]')].map(el=>{const r=el.getBoundingClientRect(), t=find(el.dataset.t);
      return t&&{id:el.dataset.t,t,x0:r.left-B.left,y0:r.top-B.top,x1:r.right-B.left,y1:r.bottom-B.top}}).filter(Boolean);
    let s='';
    tiles.forEach(p=>{ if(p.t.stage<=0) return;      // a missing piece sends nothing, so it has no wire
      const hx=side==="right"?p.x1:side==="left"?p.x0:(p.x0+p.x1)/2, hy=side==="bottom"?p.y1:side==="top"?p.y0:(p.y0+p.y1)/2;
      const dist=Math.hypot(out[0]-hx,out[1]-hy), k=Math.max(18,dist*.45), b=backedOf(p.t), w=p.t.stage===2?2.4:1.4;
      const d=`M${hx.toFixed(1)} ${hy.toFixed(1)} C${(hx+nrm[0]*k).toFixed(1)} ${(hy+nrm[1]*k).toFixed(1)} ${(out[0]-nrm[0]*k).toFixed(1)} ${(out[1]-nrm[1]*k).toFixed(1)} ${out[0].toFixed(1)} ${out[1].toFixed(1)}`;
      s+=`<g class="wt37" data-wt="${p.id}"><path d="${d}" stroke="#0E0F13" stroke-width="${w+3}" fill="none" stroke-linecap="round"/>
        <path data-w="${p.id}" d="${d}" style="stroke:var(--cd)" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${p.t.stage===2?.55+.4*b:.4}" ${p.t.stage===1?'stroke-dasharray="3 3"':''}/>
        ${p.t.stage===2?`<path d="${d}" class="flow25" stroke="#fff" stroke-opacity="${(.25+.7*b).toFixed(2)}" stroke-width="1.3" stroke-dasharray="1.5 10" fill="none" stroke-linecap="round" style="animation-duration:${(2.6-1.6*b).toFixed(2)}s"/>`:''}
        <circle cx="${hx}" cy="${hy}" r="2.3" style="fill:var(--cd)" stroke="#0E0F13" stroke-width="1"/></g>`;
    });
    const live=tiles.filter(p=>p.t.stage>0), n=live.length;
    s+=`<circle cx="${out[0]}" cy="${out[1]}" r="${5+n*.4}" style="fill:${n?'var(--cd)':'#3A3E49'}" stroke="#0E0F13" stroke-width="2" class="${n?'port25':''}"/>`;
    svg.innerHTML=s;
    res[sl.id]={x:B.left-I.left+out[0],y:B.top-I.top+out[1],nx:nrm[0],ny:nrm[1],levels:tiles.map(p=>energy(p.t)),n,
      inplace:tiles.filter(p=>p.t.stage===2).length,started:tiles.filter(p=>p.t.stage===1).length,backed:tiles.reduce((a,p)=>a+backedOf(p.t),0)};
  });
  return res;
}
// what flows where, in words
function kindList(ts){return Object.keys(KINDS).map(k=>{const xs=ts.filter(t=>kindOf(t)===k);return xs.length?`<span class="lt-l kl30">${badge(k,11)} ${KNAME[k]}: ${xs.map(t=>esc(t.name)+(t.stage===1?' (started)':'')).join(', ')}</span>`:''}).join('')}
function tipArc(id,e){const sl=H.slots.find(x=>x.id===id), f=sl.types.filter(t=>t.stage===2), b=f.reduce((a,t)=>a+backedOf(t),0);
  $('v44tip').innerHTML=`<b>${esc(sl.name)}</b><span class="lt-sub">${f.length} of ${sl.types.length} pieces in place</span>${kindList(sl.types.filter(t=>t.stage>0))}
    <span class="lt-l dimk">How far the arc fills is how many of this section's pieces are in place; how bright it is, how much of that is backed by controls that check or block.</span><span class="lt-l dimk">Click to open the section</span>`;
  $('v44tip').hidden=false;moveTip(e)}
function tipPipe(id,e){const sl=H.slots.find(x=>x.id===id), live=sl.types.filter(t=>t.stage>0), f=sl.types.filter(t=>t.stage===2), b=f.reduce((a,t)=>a+backedOf(t),0);
  $('v44tip').innerHTML=`<b>${esc(sl.name)} → core</b><span class="lt-sub">${f.length} in place${live.length>f.length?`, ${live.length-f.length} started`:''} · backed ${f.length?Math.round(100*b/f.length):0}%</span>${kindList(live)}
    <span class="lt-l dimk">Width is how many pieces are in place. Brightness and pulse speed are how much of it is backed: controls that check or block count most, capabilities and requests least.</span><span class="lt-l dimk">Click to open the section</span>`;
  $('v44tip').hidden=false;moveTip(e)}
function tipGauge(e){$('v44tip').innerHTML=`<b>Backed trust · ${H.backed}%</b><span class="lt-l">How far this harness's own controls back the agent working without you, across five kinds of work.</span>
    <span class="lt-l dimk">The gold ring is that share. The tier below it is the level reached. Click for the full picture.</span>`;$('v44tip').hidden=false;moveTip(e)}
function bindCore(){
  const inv=$('v44inv'); if(!inv||!inv.querySelectorAll) return;
  inv.querySelectorAll('[data-arc]').forEach(a=>{a.onmouseenter=e=>{hp.arc=a.dataset.arc;paint();if(!hp.seg)tipArc(a.dataset.arc,e)};a.onmousemove=moveTip;
    a.onmouseleave=()=>{hp.arc=null;paint();$('v44tip').hidden=true};
    a.onclick=e=>{e.stopPropagation();selSlot=a.dataset.arc;sel=null;selSet=null;render()}});
  const g=inv.querySelector('.gaugehit'); if(g){g.onmouseenter=tipGauge;g.onmousemove=moveTip;g.onmouseleave=()=>{$('v44tip').hidden=true}}
  const p=$('v44pipes'); if(p&&p.querySelectorAll) p.querySelectorAll('[data-pipe]').forEach(el=>{const id=el.dataset.pipe;
    el.onmouseenter=e=>{hp.pipe=id;paint();tipPipe(id,e)};el.onmousemove=moveTip;el.onmouseleave=()=>{hp.pipe=null;paint();$('v44tip').hidden=true};
    el.onclick=e=>{e.stopPropagation();selSlot=id;sel=null;selSet=null;render()}});
}

// stage 2: section bus → core rim, one stream per energy level present


// spread the arcs: equal widths, each kept as close to its conduit's direction as the others allow
function spreadArcs(tgt){
  const ids=Object.keys(tgt).sort((a,b)=>tgt[a]-tgt[b]), n=ids.length, TAU=2*Math.PI, step=TAU/H.slots.length;
  const p=ids.map(id=>tgt[id]);
  for(let it=0;it<200;it++){let moved=false;
    for(let k=0;k<n;k++){const a=k, b=(k+1)%n; let d=p[b]-p[a]; if(b===0) d+=TAU;
      if(d<step-1e-4){const push=(step-d)/2; p[a]-=push; p[b]+=push; moved=true}}
    if(!moved) break}
  const out={}; ids.forEach((id,k)=>out[id]=p[k]); return out;
}
// stage 2, v26: straight radial conduits into equal arcs. Width is the energy a section sends;
// coloured strands, side by side like a cable, show what it's made of.
// compact: no sections on screen, so the ring's arcs point where the sections sit on the full harness (its grid)
const GRID={context:[0,0],protocols:[1,0],tools:[2,0],agents:[3,0],memory:[0,1],guardrails:[3,1],configuration:[0,2],verification:[1,2],validation:[2,2],observability:[3,2]};
function compactAngles(){const ccx=2, ccy=1.75, tgt={};
  H.slots.forEach(sl=>{const g=GRID[sl.id]; if(!g) return; const y0=g[1]===0?0:g[1]===1?1:2.5, y1=g[1]===0?1:g[1]===1?2.5:3.5, x0=g[0]+.05, x1=g[0]+.95;   // the gap between sections, so neighbours never tie
    const nx=Math.max(x0,Math.min(ccx,x1)), ny=Math.max(y0,Math.min(ccy,y1)); tgt[sl.id]=Math.atan2(ny-ccy,nx-ccx)});
  return spreadArcs(tgt)}
function compactArcs(){placeArcs(compactAngles()); bindCore()}
function drawConduits(){
  if(typeof COMPACT!=='undefined'&&COMPACT){compactArcs();return}
  const inv=$('v44inv'), svg=$('v44pipes'), coreEl=inv&&(inv.querySelector('[data-core] .reactor')||inv.querySelector('[data-core]'));
  if(!svg||!coreEl||!coreEl.getBoundingClientRect||!inv.getBoundingClientRect) return;
  const R=inv.getBoundingClientRect(), C=coreEl.getBoundingClientRect(); if(!R.width) return;
  const ccx=C.left-R.left+C.width/2, ccy=C.top-R.top+C.height/2, cr=Math.min(C.width,C.height)*.48;
  // 1. where each conduit should enter: equal arcs, spread near each section's direction
  const rects={}, tgt={};
  H.slots.forEach(sl=>{const el=inv.querySelector(`[data-bag="${sl.id}"]`);if(!el||!el.getBoundingClientRect)return;const B=el.getBoundingClientRect();
    const r={x0:B.left-R.left,y0:B.top-R.top,x1:B.right-R.left,y1:B.bottom-R.top};rects[sl.id]=r;
    const nx=Math.max(r.x0,Math.min(ccx,r.x1)), ny=Math.max(r.y0,Math.min(ccy,r.y1)); tgt[sl.id]=Math.atan2(ny-ccy,nx-ccx)});
  const pos=spreadArcs(tgt);
  // 2. slide each section's output along its facing edge so the conduit points straight at its arc
  const outs={};
  H.slots.forEach(sl=>{const r=rects[sl.id]; if(!r) return; const a=pos[sl.id], side=BUS[sl.id]||"bottom", c=Math.cos(a), s=Math.sin(a);
    let x,y;
    if(side==="bottom"||side==="top"){y=side==="bottom"?r.y1:r.y0; x=Math.abs(s)>1e-3?ccx+(y-ccy)/s*c:(r.x0+r.x1)/2; x=Math.max(r.x0+16,Math.min(r.x1-16,x))}
    else {x=side==="right"?r.x1:r.x0; y=Math.abs(c)>1e-3?ccy+(x-ccx)/c*s:(r.y0+r.y1)/2; y=Math.max(r.y0+16,Math.min(r.y1-16,y))}
    outs[sl.id]={x:x-r.x0,y:y-r.y0}});
  const buses=drawWires(outs);
  // 3. the cables
  svg.setAttribute('viewBox',`0 0 ${R.width} ${R.height}`); svg.setAttribute('width',R.width); svg.setAttribute('height',R.height);
  svg.innerHTML=H.slots.map(sl=>{const b=buses[sl.id]; if(!b) return '';
    const a=pos[sl.id], ex=ccx+cr*Math.cos(a), ey=ccy+cr*Math.sin(a), dx=ex-b.x, dy=ey-b.y, L=Math.hypot(dx,dy)||1;
    const k=Math.max(22,L*.42), c1=[b.x+b.nx*k,b.y+b.ny*k], c2=[ex+Math.cos(a)*k,ey+Math.sin(a)*k];
    const p0=[-b.ny,b.nx], p1=[-Math.sin(a),Math.cos(a)], flip=(p0[0]*p1[0]+p0[1]*p1[1])<0?-1:1;   // offsets at each end, kept on the same side
    const cv=(o)=>{const q0=[b.x+p0[0]*o,b.y+p0[1]*o], q3=[ex+p1[0]*o*flip,ey+p1[1]*o*flip];
      return `M${q0[0]} ${q0[1]} C${c1[0]+p0[0]*o} ${c1[1]+p0[1]*o} ${c2[0]+p1[0]*o*flip} ${c2[1]+p1[1]*o*flip} ${q3[0]} ${q3[1]}`};
    const Wd=Math.max(2,1.5+b.inplace*2.2+b.started*.8), bk=b.inplace?b.backed/b.inplace:0;
    const line=(o,w,col,extra='')=>`<path d="${cv(o)}" ${col==='tc'?'style="stroke:var(--cd)"':`stroke="${col}"`} stroke-width="${w}" stroke-linecap="round" fill="none" ${extra}/>`;
    let g=`<path d="${cv(0)}" stroke="#14161B" stroke-width="${Wd+6}" stroke-linecap="round" fill="none"/>`;
    if(!b.n) g+=line(0,1.4,'#4A4F5B','stroke-dasharray="3 5"');
    else{ g+=line(0,Wd,'tc',`opacity="${(.45+.5*bk).toFixed(2)}"`);
      g+=line(0,Math.max(1.4,Wd*.32),'#fff',`class="flow25" stroke-opacity="${(.3+.65*bk).toFixed(2)}" stroke-dasharray="2 ${Math.round(16-8*bk)}" style="animation-duration:${(2.8-1.9*bk).toFixed(2)}s"`)}
    return `<g class="pipe22 pipe25" data-pipe="${sl.id}">${g}<path d="${cv(0)}" stroke="transparent" stroke-width="${Wd+12}" fill="none"/>
      <circle cx="${b.x}" cy="${b.y}" r="${4+Math.min(6,b.inplace*.6)}" style="fill:${b.n?'var(--cd)':'#3A3E49'}" stroke="#0E0F13" stroke-width="1.5"/></g>`}).join('');
  const CE=inv.querySelector('.core38'), CB=CE&&CE.getBoundingClientRect?CE.getBoundingClientRect():C;
  inv.querySelectorAll('[data-bag]').forEach(el=>{const B=el.getBoundingClientRect(); el.style.setProperty('--fx',(ccx-(B.left-R.left+B.width/2)).toFixed(0)); el.style.setProperty('--fy',(ccy-(B.top-R.top+B.height/2)).toFixed(0))});
  GEO={ccx,ccy,cr:Math.min(C.width,C.height)*.5,rs:C.width/220,pos,W:R.width,Hh:R.height,k:1,cell:{x0:CB.left-R.left,y0:CB.top-R.top,x1:CB.right-R.left,y1:CB.bottom-R.top}};
  placeArcs(pos);
  tintPipes();
  bindCore();
  const tot=H.slots.reduce((a,sl)=>a+sl.types.reduce((x,t)=>x+energy(t),0),0), max=types().length*4;
  const rc=inv.querySelector('[data-core] .reactor'); if(rc&&rc.style) rc.style.filter=`drop-shadow(0 0 ${10+40*tot/max}px rgba(${rgb(tierCol())},${(.15+.5*tot/max).toFixed(2)}))`;
}

// fit the whole unit to the window: measure at full size, draw the conduits, then scale
let settleT=null;
let NARROW=false;
function layoutFit(){
  if(typeof COMPACT!=='undefined'&&COMPACT){const box=$('v44fit');if(box&&box.style){box.style.transform='none';const fb=box.parentNode;fb&&fb.style&&(fb.style.height='')}drawConduits();return}
  const box=$('v44fit'), inv=$('v44inv'); if(!box||!box.getBoundingClientRect) return;
  const prev=box.style.transform||'none', fb=box.parentNode;
  box.classList.add('noanim'); box.style.transform='none'; fb&&(fb.style.height='');
  drawConduits();
  const top=box.getBoundingClientRect().top, availH=(window.innerHeight||900)-Math.max(0,top)-14, w=box.offsetWidth||1, h=box.offsetHeight||1;
  const availW=(fb&&fb.clientWidth)||w;
  // the board plus a rail each side must fit the width; the board plus the strip must fit the height
  // narrow: if the achievement rails would shrink the board below 60%, they step aside (Achievements stays in the stats)
  NARROW=SHOWC&&(availW-24)/(w+2*RW)<.72;
  [$('v44railL'),$('v44railR')].forEach(x=>x&&x.classList&&x.classList.toggle('narrow49',NARROW));
  const inShell=!!$('v44shell'), rw=SHOWC&&!NARROW&&!inShell?RW:0, sh=SHOWC&&!inShell?SH+10:0;
  let k=Math.min(1,(availW-24)/(w+2*rw)); if(fit) k=Math.min(k,availH/(h+sh)); k=Math.max(.32,k);
  box.style.transform=prev; void box.offsetWidth; box.classList.remove('noanim');
  const next=`scale(${k})`, moving=box.classList.contains('anim')&&prev!=='none'&&prev!==next;
  box.style.transform=next; fb&&(fb.style.height=(h*k+(SHOWC?SH*k+12:4))+'px');
  if(GEO) GEO.k=k;
  const boardW=w*k, boardL=(availW-boardW)/2;
  clearTimeout(settleT);
  if(moving) settleT=setTimeout(()=>placeCards(k,boardL,boardW,h),480); else placeCards(k,boardL,boardW,h);
}
// achievements and weak spots slide away first, then the board grows; showing them reverses it
// the board only animates when a toggle changes it, never on an ordinary layout
let animT=null;
function animate(){const box=$('v44fit'); if(!box||!box.classList) return; [box,box.parentNode].forEach(x=>x&&x.classList&&x.classList.add('anim'));
  clearTimeout(animT); animT=setTimeout(()=>[box,box.parentNode].forEach(x=>x&&x.classList&&x.classList.remove('anim')),900)}
function setCombos(v){if(v===SHOWC) return; animate();
  cbFocus(null);tethers(null);
  const els=['v44railL','v44railR','v44strip'].map(id=>$(id)).filter(Boolean);
  if(!v){els.forEach(x=>x.classList&&x.classList.add('gone'));setTimeout(()=>{SHOWC=false;layoutFit()},340)}
  else{SHOWC=true;layoutFit()}}
// the core on its own: sections fold into it and the ring grows into a summary of the whole harness
function setSolo(v){if(v===SOLO) return; animate(); const inv=$('v44inv'); if(!inv||!inv.classList) return;
  SOLO=v; cbFocus(null); tethers(null); hp.t=hp.seg=hp.bag=hp.arc=hp.pipe=null;
  if(v){wasC=SHOWC; if(SHOWC) setCombos(false); inv.classList.add('solo'); $('v44pipes')?.classList?.add('solo')}
  else{inv.classList.remove('solo'); $('v44pipes')?.classList?.remove('solo'); if(wasC) setTimeout(()=>setCombos(true),420)}}

// what's under the pointer: a piece (tile or ring segment) or a whole section (bag, arc or conduit)
const hp={t:null,seg:null,bag:null,arc:null,pipe:null};
// a section in focus gets a soft glow (bag, ring band, conduit); only the hovered piece gets an outline, in both places
function paint(){const inv=$('v44inv'); if(!inv||!inv.querySelectorAll) return;
  const pv=hp.t||hp.seg||null; if(pv!==preview){preview=pv;drawMid()}
  const pid=hp.t||hp.seg, pt=pid&&find(pid), sec=pt?pt.slot.id:(hp.bag||hp.arc||hp.pipe);
  inv.querySelectorAll('[data-bag]').forEach(el=>el.classList.toggle('secfocus',el.dataset.bag===sec));
  inv.querySelectorAll('[data-vine]').forEach(el=>el.classList.toggle('hv',el.dataset.vine===sec)); const vs=inv.querySelector('.vines82'); vs&&vs.classList.toggle('dim',!!sec);
  inv.querySelectorAll('[data-arc]').forEach(el=>el.classList.toggle('secfocus',el.dataset.arc===sec));
  inv.querySelectorAll('[data-t]').forEach(el=>el.classList.toggle('focus',el.dataset.t===pid));
  inv.querySelectorAll('[data-seg]').forEach(el=>{el.classList.toggle('hov',el.dataset.seg===pid);const t=!pid&&sec&&find(el.dataset.seg);el.classList.toggle('hsec',!!t&&t.slot.id===sec)});
  inv.classList.toggle('hasfocus',!!sec);
  const p=$('v44pipes'); p&&p.querySelectorAll&&p.querySelectorAll('[data-pipe]').forEach(el=>el.classList.toggle('hot',el.dataset.pipe===sec))}

// what each section is for, in a sentence a harness user would recognise
const SLOTDESC={
 context:"Everything the agent reads before it starts on your request: your rules, the project's rules, and anything pushed in on each prompt. It sets what the agent knows and how it behaves by default.",
 protocols:"How work flows once it starts: the working protocols and modes that say what to do in what order, and when to stop and ask.",
 tools:"What the agent can pick up and use: skills, tool servers, the web, and a way to choose among them when there are many.",
 agents:"Work the agent hands to helpers: subagents with their own context, orchestration that runs many of them, and runs that start on a schedule or loop.",
 configuration:"Where it runs and how that's set up: an installer, one-command setup, pinned versions, and the check commands that prove the work.",
 guardrails:"What can stop it: approvals that ask you, hooks that can refuse on their own, permission rules, a sandbox, and a check before it calls the work done.",
 verification:"Did we build it right: tests, checks of the harness itself, shape checks, and a reviewer that isn't the one who did the work.",
 validation:"Did we build the right thing: what done means before work starts, evals that measure quality, and a look back at approvals and rejections.",
 observability:"What you can see afterwards: an append-only record of what happened, a receipt for each session, and an export to your own monitoring.",
 memory:"What it knows over time: a knowledge base it trusts, a way to find things in it, decisions, the current session's state, saved facts and a progress log."};

