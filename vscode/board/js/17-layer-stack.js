// ---- the layers as a stack: the runtime at the bottom, your own files on top
const layerPkgs=()=>{const tried=BASE.tried||[], has=[...new Set(BASE.slots.flatMap(s=>s.types.flatMap(t=>[...(t.inst||[]),...(t.extra||[])].map(x=>x.pkg).filter(Boolean))))];
  return BASE.profile&&BASE.profile.kind!=='runtime'?[]:[...has.filter(p=>!tried.includes(p)),...tried]};
// bottom to top, as they load
function layerList(){const out=[{id:'rt',name:layerName('rt'),col:'#5B606C',on:BASE.base_on!==false}], tried=BASE.tried||[];
  layerPkgs().forEach(p=>out.push({id:'p:'+p,name:p,col:PKG[p]||'#8D919D',on:pkgOn[p]!==false,try:tried.includes(p)}));
  if((!BASE.profile||BASE.profile.kind==='runtime')&&hasHome()) out.push({id:'home',name:'your ~/.claude',col:'#A7AAB6',on:HOMEON});
  if(!BASE.profile&&!BASE.new) out.push({id:'proj',name:'your own files',col:'#ECEAE4',on:YOURS});
  return out}
// what a layer brings, in a few words: its pieces, with how many of each where there's more than one
function brings(lid){const rows=layerReport(lid);if(!rows.length)return 'nothing Free Rein measures';
  const w=rows.map(r=>r.name+(r.mine.length>1?` ×${r.mine.length}`:'')), more=w.length>3?` and ${w.length-3} more`:'';
  return 'brings '+esc(w.slice(0,3).join(', '))+more}
