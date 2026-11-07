// ---- the character: a sprout, in the core. Its plant is the level, drawn: seven stages from 0
// to 50, so it only says what the number says. It reacts to what changes on the board (a piece, the level, a reading
// in progress) and goes back to neutral; it never wears a score. Its name, colour and whether it shows are the owner's
let CHAR=Object.assign({on:true,kind:'jack',name:'Sprout',color:'green'},(()=>{try{return JSON.parse(localStorage.getItem('v44-char')||'{}')}catch(e){return {}}})(),{kind:'jack'});
const CHCOL={green:{name:'Green',hi:'#E4FFD9',mid:'#9BDF8C',lo:'#4E9E58',ink:'#2E4A2A'},peach:{name:'Peach',hi:'#FFE6D6',mid:'#FFB08F',lo:'#D9785A',ink:'#5A2230'},
  blue:{name:'Blue',hi:'#E1F0FF',mid:'#8EC1F2',lo:'#4F82B8',ink:'#1F3550'},slate:{name:'Slate',hi:'#EEF0F4',mid:'#B4BAC6',lo:'#6E7584',ink:'#2A2E36'}};
const setChar=p=>{Object.assign(CHAR,p);try{localStorage.setItem('v44-char',JSON.stringify(CHAR))}catch(e){}if(typeof HOST!=='undefined')HOST.prefs({character:CHAR.on})};
const SOCKET=()=>CHAR.on&&CHAR.kind!=='sprout';
const GROW=[['Seed',0],['Shoot',5],['Two leaves',12],['Leafy',20],['Bushy',30],['Lush',40],['Full grown',50]];
const growOf=L=>GROW.reduce((s,[,f],i)=>L>=f?i:s,0);
const charName=()=>(CHAR.name||'').trim()||'Sprout';
const SPR=(()=>{const STEM=[0,11,15,20,26,29,31];
  const part=(s,ox,oy,inner)=>({s,html:`<g class="part" data-s="${s}" style="transform-origin:${ox}px ${oy}px">${inner}</g>`});
  const leaf=(x,y,ang,len,w)=>`<path d="M0 0 C${len*.3} ${-w} ${len*.72} ${-w} ${len} 0 C${len*.72} ${w*.85} ${len*.3} ${w*.85} 0 0Z" transform="translate(${x} ${y}) rotate(${ang})" fill="url(#chl82)" stroke="#3E8A45" stroke-width="1"/><path d="M0 0 L${len*.8} 0" transform="translate(${x} ${y}) rotate(${ang})" stroke="#3E8A45" stroke-width=".7" opacity=".6"/>`;
  function parts(stage){const by=18, h=STEM[stage], tip=by-h, P=[];
    if(stage===0) P.push(part(0,50,by,`<path d="M50 ${by} q-3 -5 0 -9 q3 4 0 9Z" fill="#7FD27A" stroke="#3E8A45" stroke-width=".9"/>`));
    if(stage>=1){P.push(part(1,50,by,`<path d="M50 ${by} C49 ${by-h*.4} 51.5 ${by-h*.7} 50 ${tip}" fill="none" stroke="#4FA350" stroke-width="2.6" stroke-linecap="round"/>`));P.push(part(1,50,by-h*.55,leaf(50,by-h*.55,-28,23,8.5)))}
    if(stage>=2) P.push(part(2,50,by-h*.45,leaf(50,by-h*.45,-152,22,8.2)));
    if(stage>=3){P.push(part(3,50,by-h*.85,leaf(50,by-h*.88,-58,16,6.2)));P.push(part(3,50,by-h*.8,leaf(50,by-h*.82,-124,16,6.2)))}
    // later stages just get leafier: a pair at the tip, a fuller pair low, then branches and a crown leaf
    if(stage>=4) P.push(part(4,50,tip,leaf(50,tip+1,-62,15,5.6)+leaf(50,tip+1,-118,15,5.6)));
    if(stage>=5) P.push(part(5,50,by-h*.2,leaf(50,by-h*.2,-10,20,7.2)+leaf(50,by-h*.16,-170,20,7.2)));
    if(stage===6){
      [[-1,20],[1,80]].forEach(([d,x])=>P.push(part(6,50,by-h*.5,`<path d="M50 ${by-h*.5} C${50+d*10} ${by-h*.56} ${x-d*6} ${tip+18} ${x} ${tip+10}" fill="none" stroke="#4FA350" stroke-width="2" stroke-linecap="round"/>${leaf(x,tip+10,d<0?-150:-30,15,5.6)}${leaf(x,tip+10,d<0?-104:-76,12,4.6)}`)));
      P.push(part(6,50,tip,leaf(50,tip-1,-90,13,5)));
      P.push(part(6,50,tip,`<g class="drift" style="--dl2:1.2s;--dx:-9px"><path d="M64 ${tip-6} c1.6 -2.2 4.6 -2.2 6.2 0 c-1.6 1.8 -4.6 1.8 -6.2 0Z" fill="#7FD27A" stroke="#3E8A45" stroke-width=".6"/></g>`));
      P.push(part(6,50,tip,[[-16,-14],[17,-18],[14,0]].map(([dx,dy])=>`<path class="glint" d="M${50+dx} ${tip+dy-4} l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2Z" fill="#E8FFD8"/>`).join('')))}
    return P}
  const eyes=(c)=>[40,60].map(x=>`<g class="eye"><g class="eyeball"><ellipse cx="${x}" cy="50" rx="5" ry="7" fill="#1B1520"/><circle cx="${x-1.5}" cy="47.3" r="2.1" fill="#fff"/><circle cx="${x+1.75}" cy="52.1" r=".9" fill="#fff" opacity=".8"/></g>
    <path class="happy" d="M${x-5} 51.4 Q${x} 42.3 ${x+5} 51.4" fill="none" stroke="#1B1520" stroke-width="2.75" stroke-linecap="round"/><rect class="lid" x="${x-6}" y="42" width="12" height="16" rx="5" fill="${c.mid}"/></g>`).join('');
  // a stage, or (previewing a level-up) the stage it would reach, with what's new drawn faintly
  function svg(stage,ghostFrom){const c=CHCOL[CHAR.color]||CHCOL.green, P=parts(stage);
    return `<svg viewBox="-6 -40 112 140" aria-hidden="true"><defs>
      <radialGradient id="chb82" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="${c.hi}"/><stop offset=".45" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.lo}"/></radialGradient>
      <linearGradient id="chl82" x1="0" x2="1"><stop offset="0" stop-color="#5DBE5E"/><stop offset="1" stop-color="#9BE38A"/></linearGradient>
      <radialGradient id="cha82" cx="50%" cy="50%" r="50%"><stop offset=".35" stop-color="rgba(214,255,190,.9)"/><stop offset="1" stop-color="rgba(160,240,140,0)"/></radialGradient>
      <radialGradient id="chh82" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(0,0,0,.55)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient></defs>
      <ellipse cx="50" cy="94" rx="26" ry="5" fill="url(#chh82)"/>
      <g class="body"><ellipse class="aura" cx="50" cy="56" rx="46" ry="46" fill="url(#cha82)"/><g class="sway">${P.map(p=>ghostFrom!=null&&p.s>ghostFrom?p.html.replace('class="part"','class="part gh82"'):p.html).join('')}</g>
        <path d="M50 16 C72 16 84 38 84 60 C84 82 70 93 50 93 C30 93 16 82 16 60 C16 38 28 16 50 16Z" fill="url(#chb82)"/>
        <ellipse cx="38" cy="30" rx="9" ry="5" fill="#fff" opacity=".5" transform="rotate(-25 38 30)"/>
        <g class="face">${eyes(c)}<ellipse cx="30" cy="59" rx="4.5" ry="2.6" fill="#FF6F8A" opacity=".4"/><ellipse cx="70" cy="59" rx="4.5" ry="2.6" fill="#FF6F8A" opacity=".4"/>
          <path class="mouth" d="M45 62 Q50 66 55 62" fill="${c.ink}" stroke="${c.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g class="dots"><circle cx="72" cy="6" r="3" fill="#ECEAE4"/><circle cx="81" cy="2" r="3" fill="#ECEAE4"/><circle cx="90" cy="-2" r="3" fill="#ECEAE4"/></g></g></svg>`}
  return {svg}})();
// a reaction (joy, flinch, squish) and a growth in progress, kept across redraws of the centre
let CHR=null, SPRG=null;
function applyChar(M){const ch=M&&M.querySelector&&M.querySelector('.ch82'); if(!ch) return; const now=performance.now();
  if(CHR&&now-CHR.t0<CHR.ms){ch.style.setProperty('--ad',`-${Math.round(now-CHR.t0)}ms`);ch.classList.add(CHR.cls)}
  if(SPRG&&now-SPRG.t0<1700)[...ch.querySelectorAll('.part')].filter(p=>+p.dataset.s>SPRG.from).forEach((p,i)=>{p.style.setProperty('--dl',`${(i*.12-(now-SPRG.t0)/1000).toFixed(2)}s`);p.classList.add('in')});
  ch.onpointerdown=()=>charReact('squish',450)}
// roots, from the sprout out to the ring: one to each section with something in place, thicker where more of it is
// (the same rule as the conduits outside). New ones grow out; kept across redraws like the rest
let VG={};
function roots(){if(!CHAR.on) return ''; const Q=(r,b)=>[110+r*Math.cos(b),110+r*Math.sin(b)], f2=p=>p[0].toFixed(1)+' '+p[1].toFixed(1), out=[], sock=SOCKET(), ports=[];
  H.slots.forEach((sl,si)=>{const as=sl.types.map(t=>segA[t.id]).filter(a=>a!=null), n=sl.types.length, ms=sl.types.map(t=>maturity(t)), k=ms.filter(m=>m>0).length;
    if(sock&&as.length&&!k){const pp=Q(41,circMean(as));ports.push(`<circle class="port dead" cx="${pp[0].toFixed(1)}" cy="${pp[1].toFixed(1)}" r="2.4"/>`)}
    if(!as.length||!k) return;
    // width: the conduit's own count (pieces in place, and started), scaled to the core
    // the cable outside, continued: its width (pieces in place, and started) where it meets the ring, tapering into the
    // sprout; its pulse speed and brightness are how much of it is backed (controls that check or block count most)
    const tl=sl.types.filter(t=>t.stage===2), inpl=tl.length, st=sl.types.filter(t=>t.stage===1).length, Wd=Math.max(2,1.5+inpl*2.2+st*.8), bk=inpl?sl.types.reduce((x,t)=>x+backedOf(t),0)/inpl:0;
    const wOut=Math.min(16,Wd/1.19), wIn=1.4, w=Math.max(1.6,Math.min(5,wOut*.4));
    const a=circMean(as), bend=((sl.id.length%3)-1)*.26+.3, c=sock?[Q(42,a),Q(55,a+bend*.45),Q(68,a-bend*.3),Q(81,a)]:[Q(4,a),Q(30,a+bend),Q(58,a-bend*.7),Q(81,a)], d=`M${f2(c[0])} C${f2(c[1])} ${f2(c[2])} ${f2(c[3])}`;
    const at=t=>{const u=1-t;return [0,1].map(k=>u*u*u*c[0][k]+3*u*u*t*c[1][k]+3*u*t*t*c[2][k]+t*t*t*c[3][k])}, L1=[], L2=[];
    for(let i=0;i<=18;i++){const t=i/18, p=at(t), q=at(Math.min(1,t+.01)), o=at(Math.max(0,t-.01)), dx=q[0]-o[0], dy=q[1]-o[1], n=Math.hypot(dx,dy)||1, hw=(wIn+(wOut-wIn)*Math.pow(t,2.6))/2;
      L1.push([p[0]-dy/n*hw,p[1]+dx/n*hw]);L2.push([p[0]+dy/n*hw,p[1]-dx/n*hw])}
    const body='M'+L1.map(f2).join(' L')+' L'+L2.reverse().map(f2).join(' L')+'Z';
    const full=ms.every(m=>m>=3);
    const port=sock?`<circle class="port" cx="${Q(41,a)[0].toFixed(1)}" cy="${Q(41,a)[1].toFixed(1)}" r="2.8"/>`:'';
    out.push(`<g class="vn82${sock?' cab':''}${full?' full':''}" data-vine="${sl.id}" style="--pi:${si};--fd:${(si*.37%2.4).toFixed(2)}s;--fs:${(5.6-3.8*bk).toFixed(2)}s;--fo:${(.22+.68*bk).toFixed(2)}"><path class="v" d="${body}"/><path class="fl" d="${d}" pathLength="1" stroke-width="${w.toFixed(2)}"/>
      <path class="zp" d="${d}" pathLength="1" stroke-width="${(w+1.4).toFixed(2)}"/><path class="sap" d="${d}" pathLength="1" stroke-width="${(w+.6).toFixed(2)}"/>${port}</g>`)});
  // they run into the sprout from all the way round; or, with Jack, into its ports
  const disc=sock?`<defs><radialGradient id="skg84" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="rgba(243,227,191,.85)"/><stop offset="1" stop-color="rgba(243,227,191,0)"/></radialGradient>
    <radialGradient id="sks84" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#1D2128"/><stop offset="1" stop-color="#0F1115"/></radialGradient></defs>
    <circle class="sk-aura" cx="110" cy="110" r="56" fill="url(#skg84)" opacity="${(.05+.5*Math.min(1,(H.backed||0)/100)).toFixed(2)}"/><circle class="disc" cx="110" cy="110" r="41"/>`:'';
  return `<g class="vines82${sock?' sock':''}">${disc}${ports.join('')}${out.join('')}</g>`}
// a level-up flashes Jack's ports round in gold, kept across redraws
let LVU=null;
function lvApply(){const v=document.querySelector('#v44inv .vines82'); if(!v||!LVU) return; const age=performance.now()-LVU;
  if(age>1700){LVU=null;v.classList.remove('lvup');return} v.style.setProperty('--lvd',`-${Math.round(age)}ms`);v.classList.add('lvup')}
// changes you can follow: each piece that moved takes its turn, in board order. Its tile lights (or dims), then its wire
// and its section's cable pulse toward the centre, then its ring segment and Jack's port take it in. A few changes go
// one by one; a whole layer speeds up so the sequence never drags. Kept across redraws (the board rebuilds)
let SEQS2=0, SEQSITS=[], SEQ=[], SEQEND=0, INVK=null, HOLD={}, HOLDOFF=false, SEQON=false, SEQREACT=null, LASTANG=null, PREMARK=null;
// a change Free Rein has to re-read for (switching the runtime's layer): it already knows which pieces the runtime supplies,
// so those are outlined and bouncing at once, while it reads; when the reading lands, the reveal starts straight away
function premarkBase(on){const bs=BASE.base_ships||{}, ids={};
  types().forEach(t=>{if(!on&&t.supplied==='runtime'&&t.stage>0) ids[t.id]=false; const b=bs[t.id]; if(on&&b&&b.ships>0&&t.stage<(b.ships>=2?2:1)) ids[t.id]=true});
  PREMARK=Object.keys(ids).length?{ids,t:performance.now()}:null; premarkApply()}
function premarkApply(){document.querySelectorAll('#v44inv .pm84').forEach(el=>el.classList.remove('pm84','mk-up','mk-dn')); if(!PREMARK) return;
  Object.entries(PREMARK.ids).forEach(([id,up])=>[document.querySelector(`#v44inv [data-t="${id}"]`),document.querySelector(`#v44inv [data-seg="${id}"]`)].forEach(el=>el&&el.classList.add('pm84',up?'mk-up':'mk-dn')))}
// while Free Rein is reading or revealing a change, the switches that would start another one are softly locked
const LOCKSEL='[data-mapto],[data-maph],[data-mapspan],[data-pick],[data-hp],#bsi50,#ras60,[data-rtpick],[data-yours],[data-homeon],[data-baseon],[data-p],[data-untry],[data-addp],[data-add],[data-call],[data-nextdraft],[data-fdraft],[data-discard],[data-backreal],[data-unlens],[data-sethome],[data-opennamed],[data-simrun],[data-savedraft]';
let LOCKB=false;
function lockBind(){if(LOCKB) return; LOCKB=true; document.addEventListener('click',e=>{if(!(PENDING||SEQON)) return; const c=e.target&&e.target.closest&&e.target.closest(LOCKSEL); if(c){e.stopPropagation();e.preventDefault()}},true)}
function lockShow(){const on=!!(PENDING||SEQON), v=document.querySelector('.v44'), p=$('p34'); v&&v.classList&&v.classList.toggle('lock84',on); p&&p.classList&&p.classList.toggle('lock84',on);
  const s=$('bsi50'); if(s) s.disabled=on; const r=$('ras60'); if(r) r.disabled=on}
// a piece released on its turn: its tile and the ring update in place (no full rebuild, so nothing blinks)
function releaseInPlace(ids){const inv=$('v44inv'); if(!inv) return; const secs=new Set();
  ids.forEach(id=>{const el=inv.querySelector(`[data-t="${id}"]`), t=find(id); if(!t) return; secs.add(t.slot.id); segUpdate(id); if(!el) return;
    const tmp=document.createElement('div'); tmp.innerHTML=tile(t).trim(); const n=tmp.firstElementChild; if(!n) return;
    const L=lensOf(t); L.cls.trim().split(/\s+/).filter(Boolean).forEach(c=>n.classList.add(c)); if(L.style)n.style.setProperty('--wc',L.style.split(':')[1]); if(L.mark) n.insertAdjacentHTML('beforeend',L.mark);
    el.replaceWith(n)});
  bindTypes(inv);
  secs.forEach(id=>{const b=inv.querySelector(`[data-bag="${id}"]`), sl=H.slots.find(x=>x.id===id), sp=b&&b.querySelector('header>span'); if(sl&&sp) sp.innerHTML=secHead(sl)})}
// A change lands in one beat: every affected piece is outlined (green up, red down) and, a moment later, all of them
// play their change together (block, tile, wire, cable); then the level and XP move. While Free Rein is still reading, the
// centre spins and the pieces it already knows about bounce (premarkBase), so there's never a quiet wait
function seqPlan(ch){const now=performance.now(), n=ch.length+SEQSITS.length; if(!n) return now;
  const rx=$('v44inv')?.querySelector('.core38 .rx39'), c=rx&&rx.getBoundingClientRect(), cx=c?c.left+c.width/2:0, cy=c?c.top+c.height/2:0;
  const angOf=id=>{const el=document.querySelector(`#v44inv [data-seg="${id}"]`)||document.querySelector(`#v44inv [data-t="${id}"]`); if(!el||!c) return 0;
    const r=el.getBoundingClientRect(); let a=Math.atan2((r.left+r.width/2)-cx,-((r.top+r.height/2)-cy)); return a<0?a+2*Math.PI:a};
  // the outlines come on together and bounce for a beat, so you see every spot; then all of them play at once
  // three full bounces (0.6s for the outline to pop on, then 0.8s each); two if they were already bouncing while it read
  const T=0, s1=now+120, s2=s1+600+(PREMARK?2:3)*800;
  SEQ=ch.map(x=>({...x,a:angOf(x.id),m:s1,t0:s2}));
  PREMARK=null; premarkApply(); lockShow();
  SEQEND=s2+T+900; SEQS2=s2;
  // sound: a tick at the top of each bounce, then one chime as they all play (up, down, or both), then whatever waited
  {const nb=PREMARK?2:3; for(let k=0;k<nb;k++) snd('tick',s1+600+k*800+280);
    const all=[...ch,...SEQSITS], ups=all.some(x=>x.up), dns=all.some(x=>!x.up); snd(ups&&dns?'mixed':ups?'up':'down',s2); sndFlush(s2+550)}
  SEQ.forEach(x=>{FL[x.id]={cls:x.up?'up82':'dn82',t0:x.t0}; if(x.up&&x.sec) ZP[x.sec]=Math.max(ZP[x.sec]||0,x.t0+250); HOLD[x.id]=x.old});
  SEQON=true; lastSig=null; render(); if(LASTANG) placeArcs(LASTANG);   // the board shows the old levels until each piece's turn (the ring too, at once)
  clockHand(s1,T,2); flTick(); vgApply(); seqApply(); return SEQEND}
// the clock hand: a slim light that goes round the ring itself, on the same clock as the outlines
function clockHand(start,T,laps){return;   // no light: the outlines popping on, in clock order, are the sweep
  if(calm()) return; const rx=$('v44inv')?.querySelector('.core38 .rx39'); if(!rx) return;
  rx.querySelectorAll('.lap84').forEach(n=>n.remove()); const d=document.createElement('div'); d.className='lap84';
  d.style.animationDuration=T+'ms'; d.style.animationIterationCount=laps; d.style.animationDelay=Math.round(start-performance.now())+'ms';
  rx.appendChild(d); setTimeout(()=>d.remove(),start-performance.now()+T*laps+150)}
const s2of=()=>SEQS2;
function seqApply(){const now=performance.now(); let live=false, rel=false;
  const out=[]; SEQ.forEach(x=>{if(!x.rel&&now>=x.t0){x.rel=true;delete HOLD[x.id];out.push(x.id)}});
  if(out.length) releaseInPlace(out);
  const on=(el,cls,yes)=>{if(el&&el.classList.contains(cls)!==yes) el.classList.toggle(cls,yes)};
  const mark=(el,cls,t)=>{if(!el) return; if(now-t>1700){el.classList.remove(cls);return} live=true; if(!el.classList.contains(cls)){el.style.animationDelay=`${Math.round(t-now)}ms`;el.classList.add(cls)}};
  SEQ.forEach(x=>{const tile=document.querySelector(`#v44inv [data-t="${x.id}"]`), seg=document.querySelector(`#v44inv [data-seg="${x.id}"]`), k=x.up?'mk-up':'mk-dn', shown=now>=x.m&&now<x.t0;
    if(now<x.t0+500) live=true; on(tile,k,shown); on(seg,k,shown);
    mark(tile,x.up?'arr84':'dep84',x.t0);
    mark(document.querySelector(`[data-wt="${x.id}"]`),x.up?'wz84':'wd84',x.t0+120);
    x.sec&&mark(document.querySelector(`[data-pipe="${x.sec}"]`),x.up?'pz84':'pd84',x.t0+240)});
  SEQSITS.forEach(s=>{const shown=now<s2of();document.querySelectorAll(`[data-row61="${s.id}"],[data-sitrow="${s.id}"],[data-sitopen="${s.id}"]`).forEach(el=>{
    on(el,s.up?'vk-up':'vk-dn',shown); mark(el,s.up?'vf-up':'vf-dn',s2of())}); if(now<s2of()+1700) live=true});
  if(live) requestAnimationFrame(seqApply); else {SEQ=[];SEQSITS=[];HOLD={};SEQON=false;lockShow();render();layoutFit()}}   // one redraw at the end syncs the cables; the centre catches up
// a piece that moves up sends a bright pulse down its section's root into the sprout, which charges up as it lands
let ZP={};
function vgApply(){const now=performance.now(); document.querySelectorAll('#v44inv [data-vine]').forEach(v=>{const id=v.dataset.vine, t=VG[id], z=ZP[id];
  if(z!=null){const age=now-z; if(age>1000){delete ZP[id];v.classList.remove('zap')}else if(!v.classList.contains('zap')){v.style.setProperty('--zd',`${Math.round(-age)}ms`);v.classList.add('zap')}}
  if(t==null) return; const age=now-t;
  if(age>2000){delete VG[id];v.classList.remove('grow');return} v.style.setProperty('--vd',`-${Math.round(age)}ms`);v.classList.add('grow')})}
const liveSecs=()=>H.slots.filter(sl=>sl.types.some(t=>maturity(t)>0)).map(sl=>sl.id);
function charReact(cls,ms){CHR={cls,ms,t0:performance.now()}; const ch=document.querySelector('#v44inv .ch82');
  if(ch){ch.classList.remove('joy','flinch','squish');void ch.getBoundingClientRect();ch.style.setProperty('--ad','0ms');ch.classList.add(cls)}
  clearTimeout(charReact.t); charReact.t=setTimeout(()=>{CHR=null;const c=document.querySelector('#v44inv .ch82');c&&c.classList.remove(cls)},ms)}
function sparks(rx){if(calm()) return; const r=rx.getBoundingClientRect(), ch=rx.querySelector('.ch82'), b=ch?ch.getBoundingClientRect():r;
  for(let i=0;i<14;i++){const s=document.createElement('i');s.className='spark82';const a=Math.random()*Math.PI*2, d=24+Math.random()*34;
    s.style.left=(b.left-r.left+b.width/2)+'px';s.style.top=(b.top-r.top+b.height*.2)+'px';s.style.setProperty('--dx',(Math.cos(a)*d).toFixed(0)+'px');s.style.setProperty('--dy',(Math.sin(a)*d-16).toFixed(0)+'px');rx.appendChild(s);setTimeout(()=>s.remove(),950)}}
// its eyes follow the pointer anywhere on the page; it blinks now and then
let EYEB=false, WATCH=false;
function eyesBind(){if(EYEB) return; EYEB=true; document.addEventListener('pointermove',e=>{const rx=document.querySelector('#v44inv .core38 .rx39'); if(!rx||!rx.querySelector('.ch82')) return; const r=rx.getBoundingClientRect(); if(!r.width) return;
  const ch=rx.querySelector('.ch82').getBoundingClientRect(), vx=e.clientX-(ch.left+ch.width/2), vy=e.clientY-(ch.top+ch.height*.55), dist=Math.hypot(vx,vy)||1, k=Math.min(1,dist/(r.width*.35)), ux=vx/dist*k, uy=vy/dist*k;
  const cx=e.clientX-(r.left+r.width/2), cy=e.clientY-(r.top+r.height/2); WATCH=Math.hypot(cx,cy)<r.width*.5||!!(e.target&&e.target.closest&&e.target.closest('#v44inv [data-t],#v44inv [data-bag],#v44inv [data-seg],#v44inv [data-pipe],#v44inv [data-arc]')); const sk=rx.querySelector('.sk84'); if(sk) sk.classList.toggle('watch',WATCH);
  const set=(n,v)=>rx.style.setProperty(n,v.toFixed(2)+'px'); set('--ex',ux*3.2);set('--ey',uy*3.4);set('--fx',ux*3.6);set('--fy',uy*2.6);set('--lx2',ux*2.5)},{passive:true});
  // leaving the panel altogether (another pane, another window): stop watching
  document.documentElement.addEventListener('mouseleave',()=>{WATCH=false;const sk=document.querySelector('#v44inv .sk84');sk&&sk.classList.remove('watch')});
  (function blink(){const ch=document.querySelector('#v44inv .ch82'); if(ch&&!calm()){ch.classList.add('blink');setTimeout(()=>ch.classList.remove('blink'),130)} setTimeout(blink,2600+Math.random()*3400)})()}
// the living core: after each render, compare with what the core showed last and move only what changed.
// First sight of a harness fills the ring and the XP arc; a piece that levels up flashes its segment, one that
// drops dims; XP counts to its new value; a new level pops the number and sends a gold ring out
let CM=null, CMq=false;
const calm=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return true}};
function queueMotion(){if(CMq||typeof requestAnimationFrame!=='function')return;CMq=true;requestAnimationFrame(()=>{CMq=false;coreMotion()})}
function coreMotion(){const inv=$('v44inv'), rx=inv&&inv.querySelector&&inv.querySelector('.core38 .rx39'); if(!rx) return;
  rx.querySelectorAll('[data-seg]').forEach(el=>{const a=segA[el.dataset.seg]; if(a!=null){el.style.setProperty('--lx',(Math.cos(a)*5).toFixed(1)+'px');el.style.setProperty('--ly',(Math.sin(a)*5).toFixed(1)+'px');
    el.style.setProperty('--w',(((a+Math.PI/2+2*Math.PI)%(2*Math.PI))/(2*Math.PI)*1.4-1.4).toFixed(2)+'s')}});
  rx.classList.toggle('meas82',!!PENDING); holdClicks(inv); tiltBind(rx); flTick(); eyesBind(); centreJack(rx); lockBind(); lockShow();
  if(PREMARK){if(PENDING) premarkApply(); else if(performance.now()-PREMARK.t>400){/* the reading is in: the sequence below takes over, or nothing changed */}}
  const x=xpOf(), L=lvlOf(x), m={}; HOLDOFF=true; types().forEach(t=>m[t.id]=Math.max(0,maturity(t))); HOLDOFF=false;
  let vs={}, sb={}; try{if(ovOK()) ovData().d.situations.forEach(s=>{vs[s.id]=s.verdict;sb[s.id]=(s.by||[]).map(b=>b.piece).filter(Boolean)})}catch(e){}
  const was=CM&&CM.key===BASE.key?CM:null, sv=liveSecs(); CM={key:BASE.key,x,L,m,sv,vs,sb};
  if(SEQON&&was){CM.x=was.x;CM.L=was.L;return}   // a change is being revealed: the level and XP move when it's done
  if(CHAR.on&&!calm()&&!preview){const t=performance.now(); sv.filter(id=>!was||!was.sv.includes(id)).forEach((id,i)=>VG[id]=t+(was?0:300+i*90)); vgApply()}
  if(calm()||preview) return;
  const segs=[...rx.querySelectorAll('[data-seg]')];
  const frOf=(v,l)=>l>=LVMAX?1:Math.max(0,Math.min(1,(v-lvlXP(l))/(lvlXP(l+1)-lvlXP(l))));
  const sweepArc=(f0,pop)=>{XA={a:was?was.x:x,b:x,f0,f1:frOf(x,L),pop,t0:performance.now()+(XWAIT||0)};XWAIT=0;xpTick()};
  const fx=cls=>{const d=document.createElement('div');d.className=cls;rx.appendChild(d);setTimeout(()=>d.remove(),1500)};
  if(!was){   // first sight: the ring fills round from the top, the arc fills, the number arrives
    const order=segs.map(el=>[el,((segA[el.dataset.seg]??0)+Math.PI/2+2*Math.PI)%(2*Math.PI)]).sort((a,b)=>a[1]-b[1]);
    order.forEach(([el,a],i)=>{el.style.setProperty('--d',(a/(2*Math.PI)*.7).toFixed(2)+'s');el.classList.add('in82');setTimeout(()=>el.classList.remove('in82'),1300)});
    sweepArc(0,true); return}
  const now=performance.now(), order=types().map(t=>t.id), changed=order.filter(id=>(m[id]??0)!==(was.m[id]??0)).map(id=>({id,up:(m[id]??0)>(was.m[id]??0),sec:(find(id)||{slot:{}}).slot.id}));
  // a situation decided differently (your call on it, a rule, a mode) is a change too, even when no piece moves a level:
  // the pieces that decide it (before or after) bounce with it, and its row in the side panel lights up when it lands
  const sits=was.vs?Object.keys(vs).filter(id=>was.vs[id]&&was.vs[id]!==vs[id]).map(id=>({id,up:(VRANK[vs[id]]??0)>=(VRANK[was.vs[id]]??0)})):[];
  sits.forEach(s=>[...new Set([...(sb[s.id]||[]),...((was.sb||{})[s.id]||[])])].forEach(pid=>{if(find(pid)&&!changed.some(c=>c.id===pid)) changed.push({id:pid,up:s.up,sec:find(pid).slot.id,same:true})}));
  SEQSITS=sits;
  // pieces moved: hold each at its old level and reveal them one by one; the centre and the XP follow when it's done
  if(!changed.length&&PREMARK&&!PENDING){PREMARK=null;premarkApply()}
  if(changed.length){CM.x=was.x;CM.L=was.L;SEQREACT={ups:changed.some(c=>c.up),dns:changed.some(c=>!c.up)};changed.forEach(c=>c.old=was.m[c.id]??0);seqPlan(changed);return}
  if(sits.length){CM.x=was.x;CM.L=was.L;seqPlan([]);return}
  sndFlush();
  if(L>was.L) snd('levelup'); else if(L<was.L) snd('leveldown');
  const R=SEQREACT; SEQREACT=null;
  if(CHAR.on){const Gw=growOf(was.L), G=growOf(L), ups=!!(R&&R.ups), dns=!!(R&&R.dns);
    if(L>was.L&&SOCKET()){LVU=now;lvApply()}
    if(G>Gw){SPRG={from:Gw,t0:now};charReact('joy',1400);applyChar(rx.querySelector('.mid39'));sparks(rx)}
    else if(G<Gw||L<was.L) charReact('flinch',900); else if(L>was.L) charReact('joy',1300); else if(ups) charReact('squish',700); else if(dns) charReact('flinch',900)}
  if(x===was.x) return;
  sweepArc(L>was.L?0:L<was.L?1:frOf(was.x,L),L>was.L);
  if(L>was.L){fx('burst82');const cr=document.querySelector('#v44crest .cr82');cr&&cr.classList.add('pop82')}}
// segments flashing after a change, kept on whatever nodes the ring has now (it redraws), resumed where they were
let FL={};
function flTick(){const rx=$('v44inv')?.querySelector('.core38 .rx39'), now=performance.now(); let live=false;
  Object.entries(FL).forEach(([id,f])=>{const age=now-f.t0; if(age>1500){delete FL[id];rx&&rx.querySelector(`[data-seg="${id}"]`)?.classList.remove('up82','dn82');return}
    live=true; const el=rx&&rx.querySelector(`[data-seg="${id}"]`); if(el&&!el.classList.contains(f.cls)){el.style.animationDelay=`${Math.round(-age)}ms`;el.classList.add(f.cls)}
    const mk=f.cls==='up82'&&rx&&rx.querySelector(`[data-mk="${id}"] .mki`); if(mk&&!mk.classList.contains('in')){mk.style.animationDelay=`-${Math.round(age)}ms`;mk.classList.add('in')}});
  if(live)requestAnimationFrame(flTick)}
// while a reading is out, the board answers to hover but not to clicks (a second change would race the first)
function holdClicks(inv){if(inv._hold) return; inv._hold=1; inv.addEventListener('click',e=>{if(PENDING){e.stopPropagation();e.preventDefault()}},true)}
// the core leans toward the pointer and its centre floats a little above the ring: a toy you can push, nothing more
function tiltBind(rx){if(rx._tilt||calm()) return; rx._tilt=1; const co=rx.closest('.core38')||rx;
  co.addEventListener('pointermove',e=>{if(CHAR.on){['--tx','--ty','--px','--py'].forEach(k=>rx.style.removeProperty(k));return}const r=rx.getBoundingClientRect(), dx=(e.clientX-r.left)/r.width-.5, dy=(e.clientY-r.top)/r.height-.5;
    rx.style.setProperty('--tx',(dx*14).toFixed(2)+'deg');rx.style.setProperty('--ty',(-dy*14).toFixed(2)+'deg');rx.style.setProperty('--px',(dx*8).toFixed(1)+'px');rx.style.setProperty('--py',(dy*8).toFixed(1)+'px');rx.classList.add('lean82')});
  co.addEventListener('pointerleave',()=>{['--tx','--ty','--px','--py'].forEach(k=>rx.style.removeProperty(k));rx.classList.remove('lean82')})}
function centreJack(rx){const d=rx.querySelector('.disc'), k=rx.querySelector('.sk84'); if(!d||!k) return;
  const a=d.getBoundingClientRect(), b=k.getBoundingClientRect(), sc=(rx.getBoundingClientRect().width/(rx.offsetWidth||1))||1, cur=(k.style.translate||'0px 0px').split(' ').map(parseFloat);
  const dx=(cur[0]||0)+((a.left+a.width/2)-(b.left+b.width/2))/sc, dy=(cur[1]||0)+((a.top+a.height/2)-(b.top+b.height/2))/sc;
  if(Math.abs(dx)<40&&Math.abs(dy)<40) k.style.translate=`${dx.toFixed(1)}px ${dy.toFixed(1)}px`}
// the XP on its way (arc and count), applied each frame to whatever nodes the core has now, since it redraws
let XA=null, XWAIT=0;
function xpTick(){if(!XA)return;const rx=$('v44inv')?.querySelector('.core38 .rx39'), k=Math.max(0,Math.min(1,(performance.now()-XA.t0)/1000)), e=1-Math.pow(1-k,3);
  const arc=rx&&rx.querySelector('.xpa42'), xx=rx&&rx.querySelector('.xx42'), c=2*Math.PI*(arc?+arc.getAttribute('r'):68), f=XA.f0+(XA.f1-XA.f0)*e;
  if(arc)arc.setAttribute('stroke-dasharray',`${(c*f).toFixed(1)} ${c}`);
  const bar=rx&&rx.querySelector('.xpa83'); if(bar)bar.style.width=(f*100).toFixed(1)+'%';
  if(xx&&!xx.querySelector('b'))xx.textContent=`${Math.round(XA.a+(XA.b-XA.a)*e)} XP`;
  const num=XA.pop&&k<.8&&rx&&rx.querySelector('.xn42'); if(num&&!num.classList.contains('pop82'))num.classList.add('pop82');   // a redrawn number pops on
  if(k<1)requestAnimationFrame(xpTick);else XA=null}
// after the harness is read again: a light passes round the ring, so a fresh read shows even when nothing moved
function coreSweep(){if(calm())return;const rx=$('v44inv')?.querySelector('.core38 .rx39');if(!rx)return;rx.querySelectorAll('.sweep82').forEach(n=>n.remove());
  const d=document.createElement('div');d.className='sweep82';rx.appendChild(d);setTimeout(()=>d.remove(),1400)}
function bindCombo(root){
  root.querySelectorAll('[data-set]').forEach(el=>{const s=H.sets.find(x=>x.name===el.dataset.set); if(!s) return;
    el.onmouseenter=e=>{cbFocus(s);tethers(s,el);tipCombo(s,e);tipBeside(el,[...s.ids,...(s.kind==="curse"?(s.lifts||[]):[])])};el.onmousemove=null;
    el.onmouseleave=()=>{cbFocus(null);tethers(null);$('v44tip').hidden=true};
    el.onclick=e=>{e.stopPropagation();selSet=s.name;sel=null;selSlot=null;render()}});
}
// put the tooltip next to the card on a side that keeps the card's pieces in view
function tipBeside(el,ids){const tp=$('v44tip'); if(!tp||!el.getBoundingClientRect) return;
  const W=window.innerWidth||1200, Hh=window.innerHeight||800, tw=tp.offsetWidth||290, th=tp.offsetHeight||260, B=el.getBoundingClientRect(), m=10;
  const avoid=ids.map(id=>$('v44inv')?.querySelector(`[data-t="${id}"]`)).filter(Boolean).map(x=>x.getBoundingClientRect());
  const cy=B.top+B.height/2, cx=B.left+B.width/2;
  const cands=[[B.right+m,cy-th/2],[B.left-tw-m,cy-th/2],[B.right+m,B.bottom-th],[B.right+m,B.top],[cx-tw/2,B.top-th-m],[cx-tw/2,B.bottom+m],[B.left-tw-m,B.top],[B.left-tw-m,B.bottom-th]];
  const fitIn=([x,y])=>[Math.max(8,Math.min(W-tw-8,x)),Math.max(8,Math.min(Hh-th-8,y))];
  const cost=([x,y])=>{let c=0;avoid.forEach(r=>{const ox=Math.max(0,Math.min(x+tw,r.right+6)-Math.max(x,r.left-6)), oy=Math.max(0,Math.min(y+th,r.bottom+6)-Math.max(y,r.top-6));c+=ox*oy});
    const ox=Math.max(0,Math.min(x+tw,B.right)-Math.max(x,B.left)), oy=Math.max(0,Math.min(y+th,B.bottom)-Math.max(y,B.top)); return c+ox*oy*4};
  let best=null,bc=1e18; cands.map(fitIn).forEach((p,i)=>{const c=cost(p)+i;if(c<bc){bc=c;best=p}});
  tp.style.left=best[0]+'px'; tp.style.top=best[1]+'px'}
