// ---- the same recomputation as v16, plus problems
const PROPOSED=[];
function derive(B){
  // reading a framework's own repo: its project files are the framework's
  const own=B.own_package, pk=x=>x.pkg||(own&&x.scope==="project"?own:null);
  const act=x=>{const p=pk(x),c=x.ctx||["base"];return (!p||pkgOn[p]!==false)&&(mode==="all"||c.includes(mode)||(mode!=="base"&&c.includes("base"))||(mode==="base"&&c.includes("base")))};
  const slots=B.slots.map(sl=>({...sl,types:sl.types.map(t=>{
    const inst=t.inst.map(x=>({...x,pkg:pk(x)})).filter(act), extra=(t.extra||[]).filter(act);
    let st=t.stage; if(st>0&&t.inst.length&&!inst.length) st=0; if(st===0&&unseen&&extra.length) st=2;
    // present only because of something that loads from home (a package's skill or hook): gone when that's switched off
    if(st>0&&t.fromHome&&!t.inst.length&&(t.extra||[]).length&&!extra.length) st=0;
    // what loads from your home folder (~/.claude) counts beside the repo's own when you count it, and goes when its layer is off
    const own=t.inst.length?Math.max(inst.length?1:0,Math.round((t.count-(unseen&&t.stage>0&&t.inst.length?(t.extra||[]).length:0))*inst.length/t.inst.length)):0;
    const count=st<=0?0:t.inst.length?own+(unseen?extra.length:0):t.count+(st===2&&t.stage===0?extra.length:0);
    return {...t,slot:sl,stage:st,inst,extra,count,fromHome:st===2&&t.stage===0,asks:inst.filter(x=>x.hold==="asks").length,holds:inst.filter(x=>x.hold==="holds").length}})}));
  slots.forEach(sl=>sl.types.forEach(t=>t.slot=sl));
  const st={},was={};slots.forEach(s=>s.types.forEach(t=>st[t.id]=t.stage));B.slots.forEach(s=>s.types.forEach(t=>was[t.id]=t.stage));
  const ok=id=>st[id]===2;
  const trustx=B.trustx.map(c=>({...c,pieces:c.pieces.map(p=>({...p,val:st[p.id]===was[p.id]&&!B.layered?p.val:st[p.id]===2?1:st[p.id]===1?.5:0}))}));
  let prev=true;const tiers=B.tiersx.map(t=>{const r=prev&&t.needs.every(ok);prev=r;return {...t,id:t.name.toLowerCase(),reached:r}});
  // keep Free Rein's own verdict unless a switch changed one of the set's pieces (its rules can include conditions the board can't see)
  const moved=s=>B.layered||[...s.ids,...(s.lifts||[])].some(id=>st[id]!==was[id]);
  const sets=[...B.sets,...PROPOSED].map(s=>!moved(s)&&!s.proposed?s:s.kind==="synergy"?{...s,status:s.ids.every(ok)?"active":"locked"}
    :{...s,status:s.lifts.some(ok)?"cleared":s.ids.length&&!s.ids.every(ok)?"dormant":s.status==="dormant"&&!s.ids.length?"dormant":"active"});
  const guards=B.guards.map(x=>({...x,active:ok(x.cap)&&ok(x.ctl)}));
  const cats=trustx.map(c=>{const w=c.pieces.reduce((a,p)=>a+p.w,0);return Math.round(100*(w?c.pieces.reduce((a,p)=>a+p.w*p.val,0)/w:0))});
  const top=[...tiers].reverse().find(t=>t.reached), nt=tiers.find(t=>!t.reached), next={};
  if(nt) nt.needs.filter(id=>!ok(id)).forEach(id=>(next[id]=next[id]||[]).push(`unlocks ${nt.name}`));
  const wi=cats.indexOf(Math.min(...cats));
  if(wi>=0) trustx[wi].pieces.filter(p=>p.val<1).sort((a,b)=>b.w-a.w).slice(0,2).forEach(p=>(next[p.id]=next[p.id]||[]).push(`backs “${trustx[wi].name}” (${cats[wi]}%)`));
  return {...B,slots,trustx,tiers,sets,guards,next,cats,tier:top?top.name:null,nextTier:nt,backed:Math.round(cats.reduce((a,b)=>a+b,0)/Math.max(1,cats.length))};
}
const types=()=>H.slots.flatMap(s=>s.types);
const find=id=>types().find(t=>t.id===id);
const on=id=>find(id)?.stage===2;
const seen=t=>t.count||t.inst.length;
const status=t=>MAT[maturity(t)];
const stCls=t=>t.stage<0?"nc":t.stage===2?"found":t.stage===1?"started":"missing";
const rtOf=t=>t.rt&&t.rt[core]?t.rt[core]:[t.how&&t.how[core]||"—",true];
// the scoring rules come with the data (pieces.json progression, via board.ts "rules"); these numbers are only a fallback
const RULES=(((window.FREE_REIN_DATA||{}).harnesses||[{}])[0]||{}).rules||{};
const PXP=RULES.piece_xp||[0,10,35,85], AXP=RULES.achievement_xp??50, WXP=RULES.cleared_xp??30;
const RANKS={dotfile:["Apprentice","Sprout"],guided:["Journeyman","Compass"],gated:["Trusted","ShieldCheck"],governed:["Master","Crown"]};
// XP and level come from Free Rein's reference scorer (core/src/report/score.ts, built in as FreeReinCore): the board hands it
// a harness document of what's on now (pieces, combos, the situations covered in the mode you're reading), so it
// keeps no copy of the rules of its own
function liveDoc(){
  const pieces=types().map(t=>{const sm=t.profile&&t.profile.summary;
    return {id:t.id,state:t.stage>=2?'yes':t.stage===1?'partial':'no',maturity:Math.max(0,maturity(t)),...(t.tier?{tier:{reached:t.tier.reached||0,of:t.tier.of||0}}:{}),
      ...(t.stage>0&&sm&&sm.n?{items_complete:{ok:sm.ok,of:sm.n}}:{})}});
  const combos=H.sets.map(s=>({id:s.name,kind:s.kind,status:s.status,pieces:s.ids||[]}));
  let situations=[];try{situations=ovOK()?ovData().d.situations.map(s=>({id:s.id,stakes:s.stakes,accounted:!!s.accounted})):[]}catch(e){}
  return {pieces,combos,situations}}
const scoreNow=()=>FreeReinCore.score(liveDoc(),RULES);
function xpOf(){return scoreNow().xp}
const realWithSits=()=>{const r=BASE.draft.reality, m=ovOK()?ovData().m:'auto';return {...r,xp:(r.xp||0)+((r.sxp||{})[m]||0)}};
// level n starts at level_curve·n² XP, rounded up, to max_level (pieces.json progression, via the scorer)
const LVK=RULES.level_curve??2.38, LVMAX=RULES.max_level??50, lvlXP=n=>FreeReinCore.levelStart(n,LVK), lvlOf=x=>FreeReinCore.levelOf(x,LVK,LVMAX)[0];
function xpGain(id){const t=find(id); if(!t) return 0; const m=maturity(t); if(m===3) return 0; if(t.stage===2) return PXP[3]-PXP[2];
  const g=gains(id); return PXP[2]-PXP[m]+(g?g.sets.length*AXP+g.clears.length*WXP:0)}
function why(id){const g=gains(id), nt=H.nextTier, bits=[`+${xpGain(id)} XP`];
  if(nt&&nt.needs.includes(id)){const left=nt.needs.filter(n=>!on(n)).length, rk=RANKS[nt.id]?.[0]||nt.name;
    bits.push(left===1?`unlocks rank ${rk}`:`one of ${left} pieces for rank ${rk}`)}
  if(g&&g.sets.length) bits.push(`completes ${g.sets.map(s=>setName(s)).join(', ')}`);
  if(g&&g.clears.length) bits.push(`clears ${g.clears.map(s=>setName(s)).join(', ')}`);
  return bits.join(' · ')}
function reward(id){const g=gains(id), bits=[];
  if(g&&g.unlock) bits.push(`unlocks the ${(RANKS[g.unlock.id]||[g.unlock.name])[0]} rank`);
  if(g&&g.trust>0) bits.push(`+${g.trust} backed trust`);
  if(g&&g.clears.length) bits.push(`clears ${g.clears.map(x=>x.name).join(', ')}`);
  if(g&&g.sets.length) bits.push(`completes ${g.sets.map(x=>x.name).join(', ')}`);
  if(!bits.length) bits.push(...(H.next[id]||[]).map(r=>{const m=/^unlocks the (.+) (?:rank|tier)$/.exec(r), ti=m&&H.tiers.find(x=>x.name===m[1]||(RANKS[x.id]||[])[0]===m[1]);
    return ti?`one of ${ti.needs.filter(n=>!on(n)).length} still needed for the ${(RANKS[ti.id]||[ti.name])[0]} rank`:r}));
  return bits.join(' · ')}
function gains(id){
  const t=find(id); if(!t||t.stage===2) return null;
  const val=p=>p.id===id?1:p.val;
  const cats=H.trustx.map(c=>{const w=c.pieces.reduce((a,p)=>a+p.w,0);return Math.round(100*(w?c.pieces.reduce((a,p)=>a+p.w*val(p),0)/w:0))});
  const to=Math.round(cats.reduce((a,b)=>a+b,0)/Math.max(1,cats.length)), nt=H.nextTier;
  return {trust:to-H.backed,from:H.backed,to,cats,unlock:nt&&nt.needs.includes(id)&&nt.needs.every(n=>n===id||on(n))?nt:null,
    sets:H.sets.filter(s=>s.kind==="synergy"&&s.status!=="active"&&s.ids.includes(id)&&s.ids.every(n=>n===id||on(n))),
    clears:H.sets.filter(s=>s.kind==="curse"&&s.status==="active"&&s.lifts.includes(id))};
}

