// ---- layers explained: what each one is, which pieces it supplies, and which only it supplies
let selLayer=null, INSPHIDE=(()=>{try{return localStorage.getItem('v44-insp')==='hidden'}catch(x){return false}})();
function setInsp(h){INSPHIDE=h;try{localStorage.setItem('v44-insp',h?'hidden':'shown')}catch(x){}render();layoutFit()}
const LAYERDEF={
  rt:{kind:'Runtime',what:'What runs the agent. What it ships out of the box is the base everything else sits on.'},
  pkg:{kind:'Package',what:'Something installed on top of the runtime, written by someone else: skills, hooks, settings and folders that come as a bundle. Files it put into this folder count as its own, marked when you\'ve changed them since.'},
  home:{kind:'Your ~/.claude',what:'Your own files in your home folder: your personal instructions, settings, skills and hooks. They load in every project on this machine, not just this one.'},
  proj:{kind:'Your own files',what:'Files in this folder that no package put there: the instructions, skills, settings and hooks you (or your agent) wrote. They load only here, and travel with the repo.'}};
// which layer a found thing belongs to
const layerOf=x=>x.pkg?'p:'+x.pkg:(x.scope==='user'||x.scope==='org')?'home':'proj';
const layerOn=l=>l==='rt'?BASE.base_on!==false:l.startsWith('p:')?pkgOn[l.slice(2)]!==false:l==='home'?HOMEON:YOURS;
function layerReport(lid){const L=BASE.layers||{}, base=L.base?L.base.stage:{}, rows=[];
  BASE.slots.forEach(sl=>sl.types.forEach(t=>{const src={};
    // show the file it comes from where there is one (its last two parts), else its label
    const show=x=>x.path?x.path.split('/').filter(Boolean).slice(-2).join('/'):x.label;
    [...(t.inst||[]),...(t.extra||[])].forEach(x=>{const l=layerOf(x);(src[l]=src[l]||[]).push(show(x)+(x.changed?' (changed by you)':''))});
    if((base[t.id]||0)>0||(BASE.base_ships||{})[t.id]) src.rt=src.rt||[((BASE.base_ships||{})[t.id]||{}).note||'out of the box'];
    if(!src[lid]) return;
    const others=Object.keys(src).filter(l=>l!==lid&&layerOn(l));
    const total=Object.keys(src).filter(l=>l!=='rt').reduce((a,l)=>a+src[l].length,0);
    rows.push({id:t.id,name:t.name,slot:sl.id,mine:src[lid],others,only:!others.length,total,src,state:t.stage<0?"Can't tell":stepWord(ladderOf(t))})}));
  return rows}
const layerName=l=>l==='rt'?((BASE.runtime||{}).name||'the runtime'):l.startsWith('p:')?l.slice(2):l==='home'?'your ~/.claude':'your own files';
// switching a layer off, measured the same way the board measures everything (then put back)
function layerEffect(lid){const keep={pk:{...pkgOn},y:YOURS,h:HOMEON}, h0=H, a=snap();
  if(lid.startsWith('p:'))pkgOn[lid.slice(2)]=!layerOn(lid)?true:false; if(lid==='home')HOMEON=!HOMEON; if(lid==='proj')YOURS=!YOURS;
  H=derive(layered(BASE)); const b=snap();
  Object.assign(pkgOn,keep.pk);YOURS=keep.y;HOMEON=keep.h;layered(BASE);H=h0;return diffOf(a,b,'')}
function layerPane(lid){const kind=lid==='rt'?'rt':lid.startsWith('p:')?'pkg':lid, D=LAYERDEF[kind], nm=layerName(lid), on=layerOn(lid), rows=layerReport(lid);
  const fromHome=kind==='pkg'&&BASE.slots.some(s=>s.types.some(t=>[...(t.inst||[]),...(t.extra||[])].some(x=>x.pkg===lid.slice(2)&&(x.scope==='user'||x.scope==='org'))));
  const e=lid==='rt'?null:layerEffect(lid), lv=x=>lvlOf(x), n=e?e.up.length+e.down.length:0;
  const toggle=lid==='rt'?(BASE.profile||BASE.new?'':`data-baseon="${on?0:1}"`):kind==='pkg'?`data-p="${esc(lid.slice(2))}"`:lid==='home'?'data-homeon="1"':'data-yours="1"';
  const rtNote=lid==='rt'?`<div class="ef50"><b>${on?'Switching it off':'Switched off'}</b><span>${on?`Its out-of-the-box pieces stop counting, so you see only what's built on top of it. You can't run without a runtime; this shows what yours adds.`:`Only what's built on top of it counts. Switch it back on to count what it ships.`}</span>${toggle?`<button class="b50" ${toggle}>${on?'Switch its defaults off':'Switch them back on'}</button>`:''}</div>`:'';
  const only=rows.filter(r=>r.only), shared=rows.filter(r=>!r.only);
  // how a piece is supplied: this layer's share, then the rest by layer, then what it reads as
  const share=r=>{const n=r.mine.length, rest=r.others.filter(l=>l!=='rt').map(l=>`${layerName(l)} ${r.src[l].length}`), rt=r.others.includes('rt');
    const what=n===1?r.mine[0]:`${n}${r.total>n?` of ${r.total}`:''}`;
    const verb=lid==='proj'||lid==='home'?`You have ${esc(what)} here`:lid==='rt'?`${esc(nm)} ships it: ${esc(r.mine[0])}`:`${esc(nm)} brings ${esc(what)}`;
    return `${verb}${rest.length?`; the other${r.total-n===1?' comes':'s come'} from ${esc(rest.join(', '))}`:''}${rt?`${rest.length?', and ':'; '}${esc(layerName('rt'))} ships it out of the box`:''}`};
  const src=r=>lid==='rt'&&((BASE.base_ships||{})[r.id]||{}).source?` <a class="sr50" href="${esc(BASE.base_ships[r.id].source)}" title="Where this comes from">source</a>`:'';
  const row=r=>`<button class="lr50" data-go="${r.id}" data-hl="${r.id}" style="--sec:${SECCOL[r.slot]||'#888'}"><b>${esc(r.name)}<small>${esc(r.state)}${r.only?'':' either way'}</small></b><span>${share(r)}${src(r)}</span></button>`;
  return `<div class="dhead"><span class="crumb2">${esc(D.kind)}${kind==='pkg'&&fromHome?' · installed in your home folder':''}</span><a data-closelayer="1" aria-label="Close">×</a></div>
    <h3>${esc(nm)} ${on?'':'<span class="st st-missing">switched off</span>'}</h3>
    <p>${esc(D.what)}${kind==='pkg'&&fromHome?` It's installed in your home folder, so it loads in every project, this one included.`:''}</p>
    ${rtNote}${e?`<div class="ef50 ${n||e.a.xp!==e.b.xp?'':'none'}"><b>${on?'Switching it off':'Switching it back on'}</b>
      ${n||e.a.xp!==e.b.xp?`<span>level ${lv(e.a.xp)} → ${lv(e.b.xp)} · ${e.b.xp-e.a.xp>0?'+':''}${e.b.xp-e.a.xp} XP${n?` · ${n} piece${n===1?'':'s'} change${n===1?'s':''}`:''}</span>`
        :`<span>the score doesn't change${rows.length?`. It ${brings(lid)}, but ${shared.length===1?'that piece stays':'those pieces stay'} without it: ${esc([...new Set(shared.flatMap(r=>r.others))].map(layerName).join(' and ')||'something else')} also ${shared.length===1?'supplies it':'supply them'}`:''}</span>`}
      ${toggle?`<button class="b50" ${toggle}>${on?'Switch it off':'Switch it on'}</button>`:''}</div>`:''}
    ${shared.length?`<p class="rule50">${icon('Info',13)} A piece counts once, however many things supply it: Free Rein scores what the harness can do, not how much of each it has. ${shared.some(r=>r.mine.length>3)?`So ${esc(nm)}'s ${shared.filter(r=>r.mine.length>3).map(r=>`${r.mine.length} ${r.name.toLowerCase()}`).join(' and ')} matter to you, but switching it off leaves those pieces in place while anything else supplies them.`:''}</p>`:''}
    ${only.length?`<h4 class="sec">Only ${esc(nm)} brings</h4><p class="mute">Switch it off and these go.</p><div class="lrs">${only.map(row).join('')}</div>`:''}
    ${shared.length?`<h4 class="sec">It also brings</h4><p class="mute">Something else supplies these too, so they stay without it.</p><div class="lrs">${shared.map(row).join('')}</div>`:''}
    ${!rows.length?'<p class="mute">Nothing Free Rein measures comes from it here.</p>':''}`}
