// ---- trust: autonomy per kind of stakes (from the evidence, survey or not), your trust beside it, a trust style,
const SHORTK={everyday:'Everyday',undo:'Hard to undo',outward:'Leaves the machine',knowledge:'What it knows',safeguards:'Its safeguards',secrets:'Sensitive data',accounts:'Connected accounts'};
const GMEAN=g=>(((ovOK()&&ovData().d.grades)||[]).find(x=>x.grade===g)||{}).means||'';
const reinsOf=()=>ovOK()?(ovData().d.reins||[]).filter(r=>r.autonomy):[];
// your answers, per kind of stakes (0-4), from the survey; older answers by kind of work map across
function myTrust(id){const a=BASE.answers; if(!a) return null; if(a.stakes&&id in a.stakes) return a.stakes[id];
  const w={everyday:'edit',undo:'commands',outward:'unattended',knowledge:'knowledge',safeguards:'edit',secrets:'edit',accounts:'unattended'}[id]; return w in a?a[w]:null}
// your trust on the 0-4 scale, as an autonomy grade (0-5): "completely" is autonomous
const trustGrade=v=>v==null?null:[0,1,2,3,5][v];
function lowest(){const R=reinsOf(); if(!R.length) return null; return [...R].sort((a,b)=>a.autonomy.grade-b.autonomy.grade||(b.high-a.high))[0]}
function pips(g,mine,cls=''){return `<span class="pp71 ${cls}">${[0,1,2,3,4].map(i=>`<i class="${i<g?'on':''}${mine!=null&&i===Math.max(0,mine-1)?' me':''}"></i>`).join('')}</span>`}
// the rank: the profile, six kinds of stakes, each with its grade; the lowest as a hint, not a title
function rankProfile(full){const R=reinsOf(); if(!R.length) return '';
  const lo=lowest();
  return `<div class="rp71${full?' full':''}">${R.map(r=>{const a=r.autonomy, m=trustGrade(myTrust(r.id)), gap=m!=null&&m>a.grade;
    return `<button class="r ${gap?'gap':''}" data-stake="${r.id}" title="${esc(r.name)}: ${esc(a.name)}${a.next?`. Next, ${esc(a.next.name)}: ${esc(a.next.means.toLowerCase())}`:''}${m!=null?`. You trust it ${esc(TSCALE()[myTrust(r.id)].toLowerCase())}`:''}">
      <span class="nm">${esc(SHORTK[r.id]||r.name)}</span>${pips(a.grade,m)}<span class="g">${esc(a.name)}</span>
      ${full?`<span class="nx full">${esc(GMEAN(a.grade))}.${a.next?` <i>Next, ${esc(a.next.name.toLowerCase())}: ${a.next.situations.length?`settle ${a.next.situations.length===1?esc(a.next.situations[0].what.toLowerCase()):a.next.situations.length+' situations'}`:`add ${esc(a.next.any_of.map(x=>x.name).join(' or '))}`}.</i>`:''}</span>`:''}</button>`}).join('')}</div>
    ${lo&&lo.autonomy.next?`<p class="lo71">${icon('ArrowUpRight',12)} Raise <b>${esc((SHORTK[lo.id]||lo.name).toLowerCase())}</b> next: ${lo.autonomy.next.situations.length?`settle ${lo.autonomy.next.situations.slice(0,2).map(x=>esc(x.what.toLowerCase())).join(', ')}`:`add ${esc(lo.autonomy.next.any_of.map(x=>x.name).join(' or '))}`}, and it moves to “${esc(lo.autonomy.next.name.toLowerCase())}”.</p>`:''}`}
// friction per session, from history in the mode you're reading
function frictionRate(){const h=ovOK()&&ovData().d.history; if(!h||!h.sessions) return null; return {per:Math.round(h.asks/h.sessions),baby:Math.round(h.babysitting/h.sessions),h}}
// the trust style, from the survey's cards
const STYLES={pilot:['The Pilot','Hands over a lot, and wants a say on the rest'],delegator:['The Delegator','Hands over a lot, and draws hard lines'],hawk:['The Hawk','Hands over little, and wants to be asked'],sentinel:['The Sentinel','Hands over little, and refuses what matters']};
function styleOf(cards){const v=Object.values(cards||{}); if(!v.length) return null; const n=v.length, let_=v.filter(x=>x==='let').length/n, ask=v.filter(x=>x==='ask').length, nev=v.filter(x=>x==='never').length;
  const asky=ask>=nev; return let_>=.5?(asky?'pilot':'delegator'):(asky?'hawk':'sentinel')}
