// ---- the left drawer: inside the selected piece
function drawDrawer(){
  const d=$('v44drawer'); d.hidden=false;
  const t=find(sel), g=gains(sel), r=rtOf(t), hostd=typeof HOST!=='undefined'&&canDraft(), dUps=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], inPlan=hostd?dUps.includes(sel):plan.includes(sel);
  const backs=H.trustx.map((c,i)=>{const p=c.pieces.find(p=>p.id===t.id);return p?{c,i,p}:null}).filter(Boolean);
  const tiersNeed=H.tiers.filter(x=>x.needs.includes(t.id));
  const mySets=H.sets.filter(s=>s.kind==="synergy"&&s.ids.includes(t.id));
  const causes=H.sets.filter(s=>s.kind==="curse"&&s.status==="active"&&s.ids.includes(t.id));
  const missingCauses=H.sets.filter(s=>s.kind==="curse"&&s.status==="active"&&s.lifts.includes(t.id));
  const guardsOf=H.guards.filter(x=>x.cap===t.id), guarding=H.guards.filter(x=>x.ctl===t.id);
  const all=[...t.inst.map(x=>({...x,seen:true})),...(t.extra||[]).map(x=>({...x,seen:false}))], sc={};
  all.forEach(x=>{const k={org:"everyone",user:"you, every repo",project:"this repo",local:"you, this repo",session:"this session"}[x.scope]||"not traced";sc[k]=(sc[k]||0)+1});
  const audit={renamed:`renamed from ${esc(t.was)}`,merged:`merged from ${esc(t.was)}`,added:"added in the type audit",weak:"a weak type: few clear instances",pass:""}[t.audit];
  d.innerHTML=piecePane(t);
  d.querySelectorAll('[data-go]').forEach(a=>a.onclick=()=>{sel=a.dataset.go;if(zoom)zoom=find(sel)?.slot.id||zoom;render()});
  bindOv(d); bindPiece(d);
  d.querySelectorAll('[data-close]').forEach(a=>a.onclick=()=>{sel=null;selSet=null;render()});
  d.querySelectorAll('[data-sec]').forEach(a=>a.onclick=()=>{selSlot=a.dataset.sec;sel=null;selSet=null;render()});

  d.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{
    if(typeof HOST!=='undefined'&&canDraft()){const ups=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[], id=sel;
      PENDING={what:ups.includes(id)?`Taking ${find(id).name} out of the draft…`:`Measuring the draft with ${find(id).name}…`};busy();head();
      HOST.draft({ups:ups.includes(id)?ups.filter(x=>x!==id):[...ups,id]});return}
    const i=plan.indexOf(sel);i<0?plan.push(sel):plan.splice(i,1);render()});
}

