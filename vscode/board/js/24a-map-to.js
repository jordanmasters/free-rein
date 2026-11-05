// ---- map to: the harness as Free Rein reads it (every piece, situation and layer), or listed the way an editor's own
// customization view lists it: its sections and scopes, for the agent you pick in it. The editors' names are data
// (model/editors.json, in BASE.editors); what each agent loads comes from the core (BASE.customizations).
let MAPTO=(()=>{try{return localStorage.getItem('v44-map')||'freerein'}catch(x){return 'freerein'}})(), MSHUT={};
// once an editor is chosen, the circle is the whole design space (the same as on Free Rein) or only what that editor's
// window can change: how little it is is the point. It opens on the whole space.
let MAPSPAN=(()=>{try{return localStorage.getItem('v44-span')==='edits'?'edits':'all'}catch(x){return 'all'}})();
const KINDN={instructions:'Instructions',skills:'Skills',commands:'Commands',agents:'Agents',hooks:'Hooks',mcp:'MCP servers',plugins:'Plugins'};
const KINDI={instructions:'BookOpen',skills:'Wrench',commands:'SquareSlash',agents:'Bot',hooks:'Webhook',mcp:'Plug',plugins:'Puzzle'};
const edOf=id=>(BASE.editors||[]).find(e=>e.id===id)||null;
// Where you use it (an editor's own window, and limiting the circle to what it edits) is off until it's worked out
const FLAG_EDITORS=false;
const mapped=()=>FLAG_EDITORS&&MAPTO!=='freerein'&&!!edOf(MAPTO);
// the pieces this editor's customization window edits directly (from the core: its sections say which)
function edPieces(){const ed=edOf(MAPTO); return ed?new Set(ed.edits||[]):null}
const editsOnly=()=>mapped()&&MAPSPAN==='edits';
const showPiece=t=>!editsOnly()||!edPieces()||edPieces().has(t.id);
const beyondPiece=t=>mapped()&&!editsOnly()&&!!edPieces()&&!edPieces().has(t.id);
function setSpan(k){MAPSPAN=k==='edits'?'edits':'all';try{localStorage.setItem('v44-span',MAPSPAN)}catch(x){}render()}
// whole space only: say which pieces this window doesn't change. The circle itself stays the Free Rein circle.
function paintBeyond(){const inv=$('v44inv'); if(!inv||!inv.classList) return;
  inv.classList.remove('mapped');
  const ed=edOf(MAPTO);
  inv.querySelectorAll('[data-t],[data-seg]').forEach(el=>{const t=find(el.dataset.t||el.dataset.seg), off=!!(t&&beyondPiece(t));
    el.classList.remove('away'); el.classList.remove('inwin'); el.classList.remove('beyond');
    const note=ed&&off?`. ${ed.name}'s ${ed.view} window doesn't change this`:'';
    if(el.dataset.t&&el.getAttribute('aria-label')) el.setAttribute('aria-label',el.getAttribute('aria-label').replace(/\. .+'s .+ window doesn't change this$/,'')+note);
    const title=el.querySelector&&el.querySelector('title'); if(title) title.textContent=title.textContent.replace(/\. .+'s .+ window doesn't change this$/,'')+note})}
const rtNow=()=>(PENDING&&PENDING.runtime)||(BASE.runtime||{}).id;
const edAgent=ed=>ed.harnesses.find(h=>h.runtime===rtNow())||null;
// read the harness again on another runtime, as the Runs on menu does
// MAPRT: the reading on another runtime was Map to's doing, so going back to Free Rein undoes it
let MAPRT=false;
function readAs(runtime){const bs=BASE.bases||[], b=bs.find(x=>x.id===runtime)||{id:runtime,name:runtime};
  if(typeof HOST==='undefined'||typeof acquireVsCodeApi!=='function'||BASE.profile) return false;
  const was=(bs.find(x=>x.id===rtNow())||{}).name||rtNow();
  keepHome();PREVSNAP={s:snap(),label:`Runs on ${b.name} instead of ${was}`};PENDING={runtime,what:`Reading ${BASE.name} on ${b.name}…`};MAPRT=true;head();busy();HOST.lens(runtime);return true}
function setMap(k){MAPTO=edOf(k)?k:'freerein'; if(edOf(MAPTO)){MAPSPAN='all';try{localStorage.setItem('v44-span','all')}catch(x){}} try{localStorage.setItem('v44-map',MAPTO)}catch(x){}
  // where you use it is chosen in Layers and stays there; it doesn't change the agent (Claude Code runs in VS Code and Cursor
  // too): an editor whose window doesn't list your agent says so, and offers to read it as one of its own
  if(LIST==='native'){LIST='layers';try{localStorage.setItem('v44-list',LIST)}catch(x){}}
  const ed=edOf(MAPTO);
  // back to Free Rein after an editor: read it on this folder's own runtime again, out of the preview
  const L=BASE.lens||{}; if(!ed&&MAPRT&&L.runtime&&L.home&&L.runtime!==L.home&&typeof HOST!=='undefined'&&HOST.lens){MAPRT=false;
    const nm=((BASE.bases||[]).find(b=>b.id===L.home)||{}).name||L.home;
    PREVSNAP={s:snap(),label:`Back to ${nm}`};PENDING={runtime:L.home,what:`Reading ${BASE.name} on ${nm}…`};head();busy();HOST.lens(null);return}
  if(!ed) MAPRT=false;
  render()}
function mapRow(){const here=(window.FREE_REIN_PREFS||{}).editor, eds=(BASE.editors||[]).slice().sort((a,b)=>(b.id===here)-(a.id===here)); if(!eds.length) return '';
  const b=(k,n,tip)=>`<button data-mapto="${k}" aria-pressed="${MAPTO===k||(k==='freerein'&&!mapped())}" title="${esc(tip)}">${esc(n)}</button>`;
  return `<div class="mp90" role="group" aria-label="Map to"><span class="k">Map to</span><span class="sg48">${b('freerein','Free Rein','The whole design space: every piece Free Rein reads and judges')}${eds.map(e=>b(e.id,e.name,`What ${e.name}'s ${e.view} window can change, inside the design space. Not a limit on Free Rein`)).join('')}</span></div>${spanRow()}`
}
// under Map to, once an editor is chosen: that window's limit, or the whole design space
function spanRow(){const ed=edOf(MAPTO); if(!ed) return '';
  const b=(k,n,tip)=>`<button data-mapspan="${k}" aria-pressed="${MAPSPAN===k}" title="${esc(tip)}">${esc(n)}</button>`;
  const n=(ed.edits||[]).length, of=types().length, count=`${ed.name}'s ${ed.view} window edits ${n} of ${of} pieces.`;
  const note=MAPSPAN==='edits'?`${count} The circle shows only those. Free Rein still covers the rest.`
    :`${count} The circle shows all ${of}, the same as on Free Rein.`;
  return `<div class="mp90" role="group" aria-label="What the circle shows"><span class="k">Circle</span><span class="sg48">${b('all','Whole space',`The whole design space, the same as on Free Rein.`)}${b('edits','What it edits',`What ${ed.name}'s ${ed.view} window can change. Not a limit on Free Rein.`)}</span></div><p class="sp90">${esc(note)}</p>`}
// one customization: its name, what it is, where it comes from; it opens the file, and lights the pieces it gives
function custRow(kind,x){const n=(x.pieces||[]).length, sub=[x.detail,n?`${n} piece${n>1?'s':''}`:''].filter(Boolean).join(' · ');
  return `<div class="rw61 rc90"${x.path?` data-copen="${esc(x.path)}"`:''} data-cpcs="${esc((x.pieces||[]).join(','))}" role="button" tabindex="0" title="${esc(x.path||x.label)}">
    <span class="ic">${icon(KINDI[kind],13)}</span><span class="tx"><b>${esc(x.label)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span>${x.path?icon('ArrowUpRight',12):''}</div>`}
function custGroup(id,name,kind,items,scopes,note){const shut=id in MSHUT?MSHUT[id]:!items.length;
  const order=['project','local','user','org','plugin'], by={};
  for(const x of items){const s=scopes[x.scope]||x.scope;(by[s]=by[s]||[]).push(x)}
  const names=[...new Set(order.map(s=>scopes[s]||s))].filter(s=>by[s]).concat(Object.keys(by).filter(s=>!order.some(o=>(scopes[o]||o)===s)));
  return `<section class="gp61${shut?' shut':''}">${grpHead(id,name,shut,'',String(items.length),'data-mshut',`<i class="ki90">${icon(KINDI[kind],12)}</i>`)}
    ${shut?'':`<div class="gb61">${note?`<p class="nt90">${esc(note)}</p>`:''}${items.length?names.map(s=>`<h5 class="sc90">${esc(s)} <span>${by[s].length}</span></h5>${by[s].map(x=>custRow(kind,x)).join('')}`).join(''):'<p class="em61">None that this agent loads.</p>'}</div>`}</section>`}
function customPanel(box){const ed=edOf(MAPTO); if(!ed) return false;
  const C=BASE.customizations||[], items=k=>(C.find(c=>c.kind===k)||{}).items||[], ag=edAgent(ed), listed=new Set(ed.sections.map(s=>s.kind));
  const total=ed.sections.reduce((a,s)=>a+items(s.kind).length,0), other=C.filter(c=>!listed.has(c.kind)&&c.items.length);
  const rtName=((BASE.bases||[]).find(b=>b.id===rtNow())||{}).name||rtNow();
  const pick=ed.harnesses.length>1?`<div class="ag90"><span class="k">Agent</span><span class="sg48">${ed.harnesses.map(h=>`<button data-maph="${esc(h.runtime)}" aria-pressed="${!!ag&&ag.id===h.id}" title="${esc((h.note||'')+(h.note?'. ':'')+'Read as Free Rein\' '+h.runtime+' runtime')}">${esc(h.name)}</button>`).join('')}</span></div>`:'';
  const line=BASE.profile?'A profile has no files of its own.':ag?`<b>${total}</b> customization${total===1?'':'s'} the ${esc(ag.name)} agent loads, in ${esc(ed.name)}'s sections.`
    :`Read on ${esc(rtName)}, not one of ${esc(ed.name)}'s agents. <button class="lk50" data-maph="${esc(ed.harnesses[0].runtime)}">Read it as ${esc(ed.harnesses[0].name)}</button>`;
  box.innerHTML=`<div class="pin54 pin61">${listSwitch()}<button class="lk50 bk75" data-list="layers">${icon('ChevronLeft',13)} Layers</button>${tabHead(`${esc(ed.name)} · ${esc(ed.view)}`,line,'')}${pick}</div>
    <div class="sl61">${!ag&&!BASE.profile?`<p class="em61">Its sections list what one of ${esc(ed.name)}'s agents loads, so read it on one first.</p>`:ed.sections.map(s=>custGroup('e:'+s.kind,s.name,s.kind,items(s.kind),ed.scopes)).join('')}
      ${ag&&other.length?other.map(c=>custGroup('o:'+c.kind,`${KINDN[c.kind]||c.kind}, also loaded`,c.kind,c.items,ed.scopes,`${ed.name}'s view has no section for these, but this agent loads them.`)).join(''):''}</div>`;
  box.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>setList(b.dataset.list));
  box.querySelectorAll('[data-mshut]').forEach(h=>h.onclick=()=>{const id=h.dataset.mshut, sh=h.closest('section').classList.contains('shut');MSHUT[id]=!sh;customPanel(box)});
  box.querySelectorAll('[data-maph]').forEach(b=>b.onclick=()=>{if(b.dataset.maph!==rtNow())readAs(b.dataset.maph)});
  box.querySelectorAll('[data-copen]').forEach(r=>r.onclick=()=>typeof HOST!=='undefined'&&HOST.open(r.dataset.copen,null));
  box.querySelectorAll('[data-cpcs]').forEach(r=>{const ids=r.dataset.cpcs?r.dataset.cpcs.split(','):[];r.onmouseenter=()=>ids.length&&lightPieces(ids);r.onmouseleave=()=>lightPieces(null)});
  return true}
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest&&e.target.closest('[data-mapto]');if(b){e.preventDefault();setMap(b.dataset.mapto);return}
  const s=e.target&&e.target.closest&&e.target.closest('[data-mapspan]');if(s){e.preventDefault();setSpan(s.dataset.mapspan)}});
