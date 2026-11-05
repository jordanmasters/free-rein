// ---- modalities: what the harness can take in and do, across its models (models.ts), drawn as a grid:
// a row per model, a column per modality, a dot where it can. The harness row on top adds them up.
// in: what a model is trained to take in; files: formats its API converts first; out: what it gives back
const INS=[['text','Text','Type'],['image','Images','Image'],['audio','Audio','AudioLines'],['video','Video','Clapperboard']];
const OUTS=[['text','Text','Type'],['image','Images','Image'],['audio','Audio','AudioLines'],['video','Video','Clapperboard'],['decisions','Decisions','Split'],['vectors','Vectors','Search']];
function st(v){return v===true||v==='yes'?'y':v===false||v==='no'?'n':'u'}
function chips(list,get,who){return list.map(([k,n,ic])=>{const v=get(k), c=st(v&&v.state!==undefined?v.state:v);
  return `<span class="ch75 ${c}" title="${esc(n)}: ${c==='y'?'native'+(v&&v.by&&v.by.length?', in '+v.by.join(', '):''):c==='n'?'not native: no model here does it directly':'not stated by its maker'}${who?' ('+esc(who)+')':''}">${icon(ic,11)}${esc(n)}</span>`}).join('')}
function ioRows(get,who){return `<div class="io75"><span class="l">Reads</span><span class="cs">${chips(INS,k=>get('inputs',k),who)}</span></div>
    <div class="io75"><span class="l">Makes</span><span class="cs">${chips(OUTS,k=>get('outputs',k),who)}</span></div>`}
function takesLine(){const M=BASE.models; if(!M||!M.inputs) return ''; const yi=INS.filter(([k])=>M.inputs[k].state==='yes'), yo=OUTS.filter(([k])=>M.outputs[k].state==='yes');
  return `<span class="tk75 n">reads</span>${yi.map(([k,n])=>`<span class="tk75">${esc(n.toLowerCase())}</span>`).join('')}<span class="tk75 n">makes</span>${yo.map(([k,n])=>`<span class="tk75">${esc(n.toLowerCase())}</span>`).join('')}`}
