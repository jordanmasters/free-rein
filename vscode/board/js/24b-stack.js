// ---- The stack: what the harness is working on, and its layers from the model out, as one bar of labelled segments.
// The Layers tab is the same list unfolded, in the same order and words; a segment opens the tab at its row. Each
// layer speaks its own language: the modes on offer depend on the agent picked before them.
let LYOPEN=null;            // the Layers tab's unfolded row
const MODEPICK={};          // modes picked here as a what-if, by control (Free Rein doesn't judge most of them)
const LVLN={'read-only':'reads only','asks':'asks first','edits':'edits on its own','checker':'a checker decides','all':'runs everything','allowed-only':'only what rules allow','follows':'set by the run mode'};
// Claude Code's situations are judged in Auto and Manual; any other mode reads them as the nearer of the two
const NEAR={'read-only':'manual','asks':'manual','allowed-only':'manual','edits':'auto','checker':'auto','all':'auto'};
const isClaudeRt=()=>((BASE.runtime||{}).core==='claude')&&ovOK()&&(ovData().modes||[]).length>1;
// the modes as they stand: the harness's own, with any what-if picked here (and Cursor's run mode you've told Free Rein)
function curPicks(){const R=BASE.run_mode; if(!R) return [];
  return R.picks.map(p=>{const id=MODEPICK[p.picker||''], m=id&&id!==p.id&&(R.modes||[]).find(x=>x.id===id&&(x.picker||'')===(p.picker||''));
    return m?{...m,what:true}:p})}
const modeLevel=ps=>{const f=ps.filter(p=>p.level!=='follows');return f.some(p=>p.level==='read-only')?'read-only':(f[0]||{}).level||null};
function pickMode(picker,id){const R=BASE.run_mode, m=R&&(R.modes||[]).find(x=>x.id===id&&(x.picker||'')===picker); if(!m) return;
  const own=R.picks.find(p=>(p.picker||'')===picker);
  if(own&&own.id===id) delete MODEPICK[picker]; else MODEPICK[picker]=id;
  if(isClaudeRt()){const lv=modeLevel(curPicks());setOVM(NEAR[lv]||'auto');return}
  render()}
const shortModel=n=>String(n||'').replace(/^Claude\s+/,'');
// the segments, in widening scope: what it's working on, the model, the program it runs on (and its built-ins), and the
// layers added on top. The mode lives in the Layers tab, in that program's words
const added=()=>layerList().filter(l=>l.id!=='rt');
// the layers the bar counts: every level the runtime reads this harness at, its built-ins included (the core's stack)
const stackLv=()=>BASE.stack?BASE.stack.levels.map(l=>({id:l.id,name:l.name,on:levelOn(l),try:false})):layerList();
function stackSegs(){const prof=BASE.profile, rt=BASE.runtime||{}, L=BASE.lens||{}, M=((BASE.models||{}).models||[]).filter(m=>m.name);
  const lay=stackLv(), on=lay.filter(l=>l.on), rtL=layerList().find(l=>l.id==='rt');
  const segs=[{key:'target',k:prof?'Product':'Working on',v:BASE.new?'New harness':BASE.name.replace(/, out of the box$/,''),tip:'Switch to another folder or a product'}];
  if(M.length) segs.push({key:'model',k:'Model',v:shortModel(M[0].name),s:M.length>1?`+${M.length-1}`:'',tip:M.map(m=>m.name).join('\n')});
  if(!prof||prof.kind==='runtime') segs.push({key:'runson',k:'Runs on',v:rt.name||'',what:!!(L.runtime&&L.home&&L.runtime!==L.home)||(rtL&&!rtL.on),tip:`${rt.name||'The program'}: loads the layers and runs the model${rtL?`; its built-ins ${rtL.on?'on':'off'}`:''}`});
  if(lay.length) segs.push({key:'layers',k:'Layers',v:on.length===lay.length?String(lay.length):`${on.length} of ${lay.length}`,what:on.length<lay.length||layerList().some(l=>l.try),
    tip:lay.map(l=>`${l.on?'●':'○'} ${l.name}${l.try?' (trying)':''}${l.on?'':' (off)'}`).join('\n')});
  return segs}
// a segment opens the Layers tab at its row
function openStack(key){INSPHIDE=false;try{localStorage.setItem('v44-insp','shown')}catch(x){}
  LIST='layers';try{localStorage.setItem('v44-list','layers')}catch(x){}selLayer='*';LYOPEN=key;if(['model','runson','mode'].includes(key))OPEN80.add('ly:builtin');MOVESOPEN=false;sel=null;selSet=null;selSlot=null;selSit=null;selStake=null;topic=null;leftOpen=false;
  if(VIEW!=='board'){VIEW='board';try{localStorage.setItem('v44-view','board')}catch(x){}}render();
  (window.requestAnimationFrame||setTimeout)(()=>{const r=document.querySelector(`#v44drawer [data-lyk="${key}"]`);r&&r.scrollIntoView&&r.scrollIntoView({block:'nearest'})})}
// what a segment lights: the model's name at the centre; the program's name and its built-in pieces; the layers' pieces
function segPieces(key){const ids=lid=>layerReport(lid).map(r=>r.id);
  if(key==='runson') return ids('rt'); if(key==='layers') return added().filter(l=>l.on).flatMap(l=>ids(l.id)); return []}
function litCenter(key){document.querySelectorAll('#v44inv .idn .lit').forEach(e=>e.classList.remove('lit'));
  const el=key==='model'?document.querySelector('#v44inv .idn .idm'):key==='runson'?document.querySelector('#v44inv .idn .idr'):null; el&&el.classList.add('lit')}
// Working on opens the list of folders and products (in the editor); the others open the Layers tab at their row
function bindStack(q){q('[data-seg]').forEach(b=>{const k=b.dataset.seg;
  b.onclick=()=>{if(k==='target'&&typeof acquireVsCodeApi==='function'){HOST.pick();return}openStack(k)};
  b.onmouseenter=()=>{litCenter(k);const ids=segPieces(k);ids.length&&lightPieces(ids)};b.onmouseleave=()=>{litCenter(null);lightPieces(null)}})}
// the Layers tab's own controls: a section unfolds; pick a mode (a what-if), the agent, or tell Free Rein Cursor's run mode
function bindStackPanel(box){const all=s=>box.querySelectorAll(s);
  all('[data-lyt]').forEach(h=>h.onclick=e=>{if(e.target.closest('button,select,a,input'))return;LYOPEN=LYOPEN===h.dataset.lyt?null:h.dataset.lyt;render()});
  all('[data-mpick]').forEach(b=>b.onclick=()=>{const [g,id]=b.dataset.mpick.split('|');pickMode(g,id)});
  all('[data-racur]').forEach(b=>b.onclick=()=>{if(typeof HOST!=='undefined')HOST.prefs({cursorRunMode:b.dataset.racur})});
  all('#ras60').forEach(s=>s.onchange=e=>{const L=BASE.lens||{};for(const k in MODEPICK)delete MODEPICK[k];if(L.home&&e.target.value===L.home&&L.runtime!==L.home)undoMove('rt');else chooseBase(e.target.value)});
  all('[data-pick]').forEach(b=>b.onclick=()=>typeof HOST!=='undefined'&&HOST.pick());
  all('.wm70 [data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;render()})}
