// ---- what the pieces add up to: achievements and weak spots, as a list in the side panel (weak spots first:
// they're the things to address), reached from the board's summary row
// the board's summary row: situations, achievements, weak spots; each opens its list in the side panel
// the lens: the permission mode the situations are read in, and whether the board shows reality, a draft or a variation
// what differs from reality, in one place: changes (Apply writes them) and views (look only: a layer switched
// off, another runtime). Both blue; views dashed. Each can be taken back on its own.
let DIFFOPEN=false;
function diffItems(){const dr=BASE.draft, nmOf=id=>{const t=find(id);return t?t.name:id}, D=ovOK()?ovData().d:null, S=id=>D&&D.situations.find(x=>x.id===id);
  const ch=[...((dr&&dr.rules)||[]).map(r=>({k:'rule',id:r.sit,t:r.kind==='model'?`Model: ${r.rule.replace('=',' → ').replace(/^agent:/,'').replace(/^main@[\w-]+/,'main')}`:`${{allow:'Allow',ask:'Ask',deny:'Never'}[r.kind]}: ${(S(r.sit)||{}).what||r.rule}`})),
    ...((dr&&dr.ups)||[]).map(u=>({k:'up',id:u,t:`Add ${nmOf(u)}`})),...((dr&&dr.add)||[]).map(p=>({k:'pkg',id:p,t:`Install ${p}`}))];
  const vw=lensMoves().map(m=>({k:'view',id:m.k,t:m.t[0].toUpperCase()+m.t.slice(1)}));
  return {ch,vw}}
// the chip that shows them is in 14b-top-bar.js (lensCtl)
