// ---- one board. At rest the right panel lists situations or pieces; the centre is the scope: how many
// situations this harness accounts for (its own pieces decide them, rightly for the stakes), by kind of stakes,
// and how many pieces are in place.
// the side panel opens on Moves (once, for anyone who had another tab saved), then remembers the tab you choose
// three tabs: Pieces, Layers, Situations. Moves are a notification (the bell in the top bar); the editor's own window is
// a row in Layers. A saved tab that's gone opens Pieces
let LIST=(()=>{try{const v=localStorage.getItem('v44-list');return ['pieces','layers','sits'].includes(v)?v:'pieces'}catch(x){return 'pieces'}})();
let GSHUT={}, SITF=null, selStake=null, QMENU=false;
const setList=k=>{LIST=k;SUB=null;RESTMOVES=false;MOVESOPEN=false;try{localStorage.setItem('v44-list',k)}catch(x){}selSit=null;selStake=null;sel=null;selSlot=null;selSet=null;leftOpen=false;topic=null;selLayer=k==='layers'?'*':null;render()};
const SITFN0={own:'goes ahead on its own',runtime:'Claude Code decides',maybe:'a hook may refuse',asks:'asks you first',refused:'is refused'};
const SITFN=new Proxy({stops:'Asks you or refused',exposed:'Exposed',classifier:'Claude Code decides',babysitting:'Babysat',blocked:'Blocked',depends:'Depends on a hook',good:'Asks you',held:'Refused',ok:'Runs on its own',accounted:'Accounted for'},{get:(o,f)=>{const x=sitO(String(f)); return x?`${x.stakes==='high'?'High-stakes work that ':x.stakes==='every'?'Everyday work that ':'What '}${SITFN0[x.k]}`:o[f]}});
// an outcome filter from Free rein (o:own, o:refused…): what happens when it tries, whatever the verdict says
const SITOK={own:['ahead'],runtime:['classifier'],maybe:['depends'],asks:['asks'],refused:['held','blocked']};
const sitO=f=>{const m=/^o:(\w+)(?::(every|high))?$/.exec(f||''); return m&&SITOK[m[1]]?{out:SITOK[m[1]],k:m[1],stakes:m[2]||null}:null};
const SITON={'o:own':'goes ahead on its own','o:runtime':'Claude Code\'s own check decides','o:maybe':'a hook may refuse','o:asks':'asks you first','o:refused':'refused','o:runtime-high':'high stakes, only Claude Code\'s own check in the way'};
const sitF=s=>!SITF||(sitO(SITF)?(o=>o.out.includes(s.outcome)&&(!o.stakes||(o.stakes==='every')===(s.stakes==='everyday')))(sitO(SITF)):SITF==='accounted'?s.accounted:SITF==='stops'?(s.verdict==='good'||s.verdict==='held'):s.verdict===SITF);
// three tabs: where it comes from (Layers), what it has (Pieces), what it can do without you (Trust)
let SUB=null;     // a screen inside a tab: 'all' (every situation), 'rules', 'rule:<key>'
// none: no tab pressed (the side panel shows a view's moves, above the tabs, until you pick one)
function listSwitch(none){const D=ovOK()?ovData().d:null, S=D&&D.summary, T=types(), ex=S?S.exposed:0, R=BASE.said&&BASE.said.summary, nr=R?R.unbacked+R.partly:0;
  const tab=(k,ic,name,val,dot,tip)=>`<button data-list="${k}" aria-pressed="${!none&&LIST===k}" title="${esc(tip)}">${icon(ic,15)}<span class="nm">${name}</span><span class="vl">${val}${dot?`<i class="dt" title="${esc(dot)}"></i>`:''}</span></button>`;
  return `<button class="x74" data-closeinsp="1" aria-label="Close the side panel" title="Close the side panel">${icon('X',15)}</button><div class="ls54 ls60 ls80" role="tablist" aria-label="Side panel">
    ${tab('pieces','Puzzle','Pieces',`${T.filter(t=>t.stage===2).length}/${T.length}`,H.sets.some(x=>x.kind==='curse'&&x.status==='active')?'weak spots':'','Its pieces, and the combos they earn')}
    ${tab('layers','Layers','Layers',(BASE.profile&&!BASE.stack?'out of the box':(n=>`${n} layer${n===1?'':'s'}`)(stackCount())),'','Where its parts apply and come from, layer by layer')}
    ${D?tab('sits','ListChecks','Situations',ex?`${ex} exposed`:'all decided',ex||nr?[ex?`${ex} exposed`:'',nr?`${nr} rules not enforced`:''].filter(Boolean).join(', '):'','What it can do without you, and whether what you wrote holds'):''}</div>`}
// a screen inside a tab: its title and a way back
function subHead(title,line){return `<header class="sh80"><button class="bk80" data-sub="" aria-label="Back">${icon('ChevronLeft',14)}</button><div><h3>${esc(title)}</h3>${line?`<p>${line}</p>`:''}</div></header>`}
// one row everywhere: a mark, a name, one value, a chevron
function row80(o){return `<button class="r80${o.cls?' '+o.cls:''}" ${o.attr||''} title="${esc(o.tip||'')}">${o.mark||''}<span class="nm">${o.name}${o.sub?`<small>${o.sub}</small>`:''}</span>${o.val!=null?`<span class="vl">${o.val}</span>`:''}${o.go===false?'':icon('ChevronRight',13)}</button>`}
