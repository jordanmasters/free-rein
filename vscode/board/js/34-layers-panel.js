// ---- layers
// each layer's tile: what it is, in the colour its pieces carry on the board
const LAYERCOL={proj:'#F2C35B',home:'#7FB2FF',rt:'#B79CFF'};
const layerTint=l=>LAYERCOL[l.id]||l.col;
const LVLIC={org:'Building2',local:'FolderLock',project:'Users',user:'UserRound',builtin:'Cpu'};
// a colour per layer, for its dot, its bar and the pieces it lights
// a model what-if per runtime that keeps its model only in its app (Cursor, Copilot): shown, never written
const MWHATIF={};
const LYC={org:'#7FD6A6',local:'#F2A65B',project:'#F2C35B',user:'#7FB2FF',builtin:'#B79CFF'};
// a level is on unless you switched it off to preview: the built-ins, your home folder, this repo's files
const levelOn=l=>l.id==='builtin'?BASE.base_on!==false:l.id==='user'?HOMEON:(l.id==='project'||l.id==='local')?YOURS:true;
const stackCount=()=>BASE.stack?BASE.stack.levels.length:layerList().length;
const layerIcon=l=>l.id==='rt'?'Cpu':l.id==='home'?'House':l.id.startsWith('p:')?(l.id==='p:Free Rein'?'Spline':(PLUGINS[l.id.slice(2)]||{}).icon||'Package'):'FolderGit2';
// the runtime's model picker, shared by the Layers tab and the top bar's context menu: on Claude Code a pick goes in a
// draft; elsewhere in a draft where the runtime keeps the model in a repo file, or a what-if where it keeps it in its app
function modelPickHTML(){const prof=BASE.profile, M=((BASE.models||{}).models||[]).filter(m=>m.name), agentName=(BASE.stack&&BASE.stack.runtime)||(BASE.runtime||{}).name||'';
  const MD=BASE.models, mcur=MD?((typeof pickOf==='function'&&pickOf('main'))||MD.current):null, mopts=MD?[...(MD.choices||[])]:[];
  if(mcur&&!mopts.some(o=>o.value===mcur)) mopts.push({value:mcur,name:mcur});
  // the models this runtime can run, from its record (sourced); Free Rein can try a change in a draft on Claude Code only,
  // so elsewhere the row names its default and the open layer lists what it can run
  const RM=BASE.runtime_models, claudeRt=(BASE.runtime||{}).core==='claude';
  // on the row a short name (Auto when it has one, else its default); the full sentence is in the open layer
  const rmDefault=RM?((RM.choices||[]).some(c=>c.value==='auto')?'Auto':'its default model'):'';
  // other runtimes: a picker of the models it can run. Where it keeps the model in a repo file (Gemini CLI, OpenCode,
  // Codex) a pick goes in a draft, measured; where it keeps it only in its app (Cursor, Copilot) a pick is a what-if
  const rtid=(BASE.runtime||{}).id, rmRepo=RM&&RM.repo, rmDraft=rmRepo?((draftRules().find(r=>r.kind==='model'&&r.rule.startsWith(`main@${rtid}=`))||{}).rule||'').split('=')[1]:null;
  const rmCur=rmDraft||(rmRepo?RM.current:MWHATIF[rtid])||'', rmOpts=[{value:'',name:rmDefault||'its default'},...(RM?RM.choices||[]:[]).filter(c=>c.value&&c.value!=='auto'&&c.value!=='default')];
  if(rmCur&&!rmOpts.some(o=>o.value===rmCur)) rmOpts.push({value:rmCur,name:rmCur});
  const rmPick=RM&&!claudeRt?`<select class="rp75${rmDraft||(!rmRepo&&rmCur)?' wf75':''}" ${rmRepo?`data-rtmodel="${esc(rtid)}"`:`data-rtwhatif="${esc(rtid)}"`} aria-label="The model" title="${esc(rmRepo?`Try another model: it goes in a draft, written to ${RM.repo.file}`:`A what-if: ${agentName} keeps the model in its own picker, not in a file in the repo`)}">${rmOpts.map(o=>`<option value="${esc(o.value)}"${o.value===rmCur?' selected':''}>${esc(o.name)}</option>`).join('')}</select>`:'';
  const mPick=!claudeRt?rmPick:MD&&mopts.length&&typeof HOST!=='undefined'&&canDraft()&&!prof?`<select class="rp75" data-modelpick="main" aria-label="The model" title="Try another model: it goes in a draft, measured before anything is written">${mopts.map(o=>`<option value="${esc(o.value)}"${o.value===mcur?' selected':''}>${esc(o.value==='default'&&M.length?`${M[0].name.replace(/^Claude /,'')} (default)`:o.name)}</option>`).join('')}</select>`:M.length?`<span class="mn75">${esc(M[0].name)}</span>`:'';
  return mPick}
// the mode it runs in, as a picker per control (Cursor has a chat mode and a run mode): each option says what kind of
// mode it is, and which is its own. Picking another is a what-if (Cursor's run mode you tell Free Rein instead)
function modePickHTML(){const R=BASE.run_mode; if(!R||!(R.modes||[]).length||typeof curPicks!=='function') return ''; const ps=curPicks(), rt=BASE.runtime||{};
  return [...new Set(R.modes.map(m=>m.picker||''))].map(g=>{const cur=ps.find(p=>(p.picker||'')===g), own=R.picks.find(p=>(p.picker||'')===g), tell=rt.core==='cursor'&&g==='run mode';
    return `<select class="rp75 md96${cur&&cur.what?' wf75':''}" data-modesel="${esc(g)}"${tell?' data-tell="1"':''} aria-label="${esc(g?g[0].toUpperCase()+g.slice(1):'Mode')}" title="${esc(tell?'Tell Free Rein which run mode you use: Cursor keeps it in its own settings':'The mode it runs in. Pick another to see the harness in it: a what-if, nothing changes')}">
      ${R.modes.filter(m=>(m.picker||'')===g).map(m=>`<option value="${esc(m.id)}"${cur&&cur.id===m.id?' selected':''}>${esc(m.name)}${own&&own.id===m.id?(own.set?' (its own)':' (default)'):''}</option>`).join('')}</select>${cur&&cur.level?`<i class="lv lv-${esc(cur.level)} lv96">${esc(LVLN[cur.level]||cur.level)}</i>`:''}`}).join('')}
// the program that reads the folder, as a picker (one runtime: its name)
function rtPickHTML(attr){const bases=BASE.bases||[], lens=BASE.lens||{}, rid=lens.runtime||(BASE.runtime||{}).id, agentName=(BASE.stack&&BASE.stack.runtime)||(BASE.runtime||{}).name||'';
  return !BASE.profile&&!BASE.new&&bases.length>1?`<select ${attr} class="rp75" aria-label="The program that reads this folder" title="Read it as another program: every layer is read the way it would">${bases.map(b=>`<option value="${esc(b.id)}" ${b.id===rid?'selected':''} title="${lens.home===b.id?'This folder\'s own runtime':''}">${esc(b.name)}</option>`).join('')}</select>`:`<b>${esc(agentName)}</b>`}
function layersPanel(){const L=layerList().slice().reverse(), hosted=typeof HOST!=='undefined', bases=BASE.bases||[], lens=BASE.lens||{}, rid=lens.runtime||(BASE.runtime||{}).id;
  const xb=(BASE.layers&&BASE.layers.base)?BASE.layers.base.progression.xp:0, cost=l=>l.id==='rt'?xb:Math.abs((d=>d.a.xp-d.b.xp)(layerEffect(l.id)));
  const kind=l=>l.id==='rt'?'What it provides out of the box':l.id.startsWith('p:')?(l.try?'A package, on trial':'A package'):l.id==='home'?'Yours, in every project':'Yours, in this folder';
  const off=L.filter(l=>!l.on).length, add=hosted&&(BASE.available||[]).length&&canDraft();
  const row=(l,bare)=>{const c=cost(l), sw=l.id==='rt'?(!BASE.profile&&!BASE.new?`data-baseon="${l.on?0:1}"`:''):l.id.startsWith('p:')?`data-p="${esc(l.id.slice(2))}"`:l.id==='home'?'data-homeon="1"':'data-yours="1"';
    if(bare) return sw?`<button class="sw64" ${sw} role="switch" aria-checked="${l.on}" title="${l.on?'Switch its built-ins off to see the harness without them. A preview only':'Switch them back on'}"><i></i></button>`:'';
    return `<div class="rw61 rl64 rl80${l.on?'':' off'}${selLayer===l.id?' on':''}" data-lyrow="${esc(l.id)}" role="button" tabindex="0" style="--lc:${l.col}" title="${esc(kind(l))}${l.on&&c?` · ${l.id==='rt'?c:'+'+c} XP`:''}">
      <span class="li80" aria-hidden="true" style="--lc:${layerTint(l)}">${icon(layerIcon(l),17)}</span><span class="tx"><b>${esc(l.id==='rt'?l.name+'\'s built-ins':l.name.charAt(0).toUpperCase()+l.name.slice(1))}${l.try?' <i class="dr61">in draft</i>':''}${!l.on?' <i class="vw61">off</i>':''}</b><small>${esc(kind(l).replace(/^Yours, /,''))}</small>
</span>

      ${sw?`<button class="sw64" ${sw} role="switch" aria-checked="${l.on}" title="${l.on?'Switch it off to see the harness without it. A preview only: nothing is uninstalled':'Switch it back on'}"><i></i></button>`:'<span class="sw64 fx" title="Can\'t be switched off"></span>'}
      ${l.try?`<button class="rm52" data-untry="${esc(l.id.slice(2))}" aria-label="Stop trying it">${icon('X',11)}</button>`:''}</div>`};
  // the stack, in the bar's order and words: what it's working on, the model, the program it runs on and its modes, then the layers
  const prof=BASE.profile, rt=BASE.runtime||{}, M=((BASE.models||{}).models||[]).filter(m=>m.name), ps=curPicks(), lead=ps.find(p=>p.level!=='follows')||ps[0];
  const sec=(key,k,title,sub,right,body)=>`<div class="lr70${LYOPEN===key?' open':''}" data-lyk="${key}"><div class="rh" data-lyt="${key}" role="button" tabindex="0"><span class="tx"><span class="k">${k}</span><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span>${right||''}</div>${LYOPEN===key&&body?`<div class="bd">${body}</div>`:''}</div>`;
  const grp=(k,rows)=>rows.length?`<div class="lg70">${k}</div>${rows.join('')}`:'';
  const target=sec('target',prof?'Product':'Working on',esc(BASE.new?'New harness':BASE.name.replace(/, out of the box$/,'')),prof?'Out of the box':'A project folder',hosted?`<button class="lk50" data-pick="1">Change</button>`:'');
  // the main model leads; the others (for subagents, embeddings, local tools) are listed inside, each with its job
  const model=M.length?sec('model','Model',esc(M[0].name)+(M.length>1?` <small class="mute">+${M.length-1} more</small>`:''),esc(M[0].used_for&&M[0].used_for[0]||''),'',
    `${M.map(m=>`<div class="md70"><b>${esc(m.name)}</b><small>${esc((m.used_for||[]).join('; ')||'named in your files')}${(m.found_in||[]).length?` · ${esc(String(m.found_in[0]).split('/').slice(-2).join('/'))}`:''}</small></div>`).join('')}<p class="mute">Free Rein reads the models; you change them in ${esc(rt.name||'the agent')} and your files.</p>`):'';
  const away=!!(lens.runtime&&lens.home&&lens.runtime!==lens.home);
  const rtl0=L.find(l=>l.id==='rt');
  const runson=(!prof||prof.kind==='runtime')?sec('runson','Runs on',esc(rt.name||''),BASE.stack?`Reads the ${BASE.stack.levels.length} layers below, and runs the model`:'The program that loads the layers below and runs the model','',
    !prof&&!BASE.new&&bases.length>1?`<label class="lb70">Read it as <select id="ras60" aria-label="The program that reads this folder">${bases.map(b=>`<option value="${esc(b.id)}" ${b.id===rid?'selected':''}>${esc(b.name)}${lens.home===b.id?' (this folder\'s)':''}</option>`).join('')}</select></label>${away?`<button class="lk50" data-rtback="1">Back to ${esc((bases.find(b=>b.id===lens.home)||{}).name||lens.home)}</button>`:''}<p class="mute">Pick another to see this folder the way it would. The modes below change with it.</p>`:''):'';
  // the modes that program offers, in its own words; Free Rein judges situations in Claude Code's Auto and Manual
  const R=BASE.run_mode, S=BASE.sandbox, claude=isClaudeRt(), ov=claude?ovData().m:null;
  const modeRows=R?[...new Set((R.modes||[]).map(m=>m.picker||''))].map(g=>{const cur=ps.find(p=>(p.picker||'')===g), own=R.picks.find(p=>(p.picker||'')===g);
    return grp(g?g[0].toUpperCase()+g.slice(1):'',(R.modes||[]).filter(m=>(m.picker||'')===g).map(m=>{const here=cur&&cur.id===m.id, isOwn=own&&own.id===m.id, tell=rt.core==='cursor'&&m.picker==='run mode';
      return `<button class="mo70${here?' on':''}" ${tell?`data-racur="${esc(m.id)}"`:`data-mpick="${esc(g)}|${esc(m.id)}"`} title="${esc(m.note||'')}"><span class="n">${esc(m.name)}${isOwn?`<small>${own.set?`its own · ${esc(own.from)}`:tell?'assumed: Cursor\'s default. Pick yours':'its own · the default'}</small>`:here?'<small>what-if</small>':''}</span><i class="lv lv-${m.level}">${esc(LVLN[m.level]||m.level)}</i></button>`}))}).join(''):'';
  const notes=[claude&&lead?`Situations are read in ${ov==='manual'?'Manual':'Auto'}, the nearer of the two modes Free Rein judges.`:'',
    R&&!claude&&ovOK()?'Free Rein judges situations for Claude Code only, for now: picking a mode here doesn\'t change them.':'',
    S?`${S.default==='none'?'No sandbox':`Sandbox ${S.default} by default`}${S.how?`: ${esc(S.how)}`:''}${S.network?`. Network: ${esc(S.network)}`:''}.`:''].filter(Boolean).map(x=>`<p class="mute">${x}</p>`).join('');
  const mode=lead?sec('mode','Mode',esc(lead.name),esc(LVLN[modeLevel(ps)]||''),'',modeRows+notes):'';
  const pk=L.filter(l=>l.id.startsWith('p:')), yo=L.filter(l=>l.id==='home'||l.id==='proj'), rtl=L.find(l=>l.id==='rt'), ms=modesOf(BASE);
  // the package that brings the working modes: the one whose parts load only in a mode (the picker sits under it)
  const modePkg=(()=>{const c={}; for(const sl of BASE.slots) for(const t of sl.types) for(const x of [...(t.inst||[]),...(t.extra||[])]) if(x.pkg&&(x.ctx||[]).some(m=>m!=='base')) c[x.pkg]=(c[x.pkg]||0)+1;
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e[0])[0]||null})();
  const work=ms.length?`<div class="wm70"><span class="k">Working mode</span><span class="sg48">${[['all','All'],...ms.map(m=>[m,m[0].toUpperCase()+m.slice(1)]),['base','No mode']].map(([k,n])=>`<button data-m="${k}" aria-pressed="${mode===k}">${esc(n)}</button>`).join('')}</span></div>`:'';
  // Layers, built like Pieces. First the two things around them: the agent that reads them (with its model and mode) and
  // where you use it (an editor hosts agents; its own customization window, for the agent you picked). Then the layers,
  // grouped by where they apply and in the order the higher one wins, each with a short name, its pieces and its switch;
  // hover lights its pieces, open it for what it sets, its pieces and its files. Then packages; then how layers work
  const ST=BASE.stack, nL=ST?ST.levels.length:L.length, agentName=ST?ST.runtime:(rt.name||'');
  // the runtime is the bottom layer, so it's chosen there: its name is a picker; opened, it shows its models and modes
  const rtPick=rtPickHTML('id="ras60"');
  const eds=BASE.editors||[], ed=mapped()?edOf(MAPTO):null, ag=ed?edAgent(ed):null, C=BASE.customizations||[], items=k=>(C.find(c=>c.kind===k)||{}).items||[];
  const edN=ed?ed.sections.reduce((a,x)=>a+items(x.kind).length,0):0;
  const where=FLAG_EDITORS&&eds.length&&!prof?fold80('ly:where',{mark:`<span class="li75">${icon(ed&&ed.id==='cursor'?'MousePointer2':ed?'SquareCode':'SquareTerminal',14)}</span>`,name:'Where you use it',val:`<span class="sv75">${esc(ed?ed.name:'Terminal or its own app')}</span>`,tip:'The editor or app you run the agent in'},
    ()=>`<div class="sg48 wh75">${[['freerein','Terminal or app'],...eds.map(e=>[e.id,e.name])].map(([k,n])=>`<button data-mapto="${k}" aria-pressed="${(ed?ed.id:'freerein')===k}">${esc(n)}</button>`).join('')}</div>
      ${ed?`<p class="mu74">${esc(ed.name)} can run: ${ed.harnesses.map(h=>h.runtime===rtNow()?`<b>${esc(h.name)}</b> (yours)`:esc(h.name)).join(' · ')}.</p>
        ${ag?`<p class="lb80">Its ${esc(ed.view)} window <small>${edN} item${edN===1?'':'s'} for ${esc(ag.name)}</small></p>${ed.sections.map(x=>{const id='e:'+x.kind; if(!(id in MSHUT)) MSHUT[id]=true; return custGroup(id,x.name,x.kind,items(x.kind),ed.scopes)}).join('')}${spanRow()}`
          :`<p class="mu74">Its ${esc(ed.view)} window lists only ${esc(ed.harnesses.map(h=>h.name).join(', '))}'s setup, not ${esc(agentName)}'s. You can still use ${esc(agentName)} in ${esc(ed.name)}; these layers are what it reads.</p>${ed.harnesses.length?`<button class="lk50" data-maph="${esc(ed.harnesses[0].runtime)}">Read it as ${esc(ed.harnesses[0].name)} instead</button>`:''}`}`
      :`<p class="mu74">Pick the editor you use to see what its own customization window lists for your agent.</p>`}`):'';
  const sw=(attr,on,what)=>attr?`<button class="sw64" ${attr} role="switch" aria-checked="${on}" title="${on?`Switch ${what} off to see the harness without it. A preview only: nothing changes`:'Switch it back on'}"><i></i></button>`:'<span class="sw64 fx" title="Can\'t be switched off"></span>';
  const KINDS=[['Instructions',/(^|\/)(CLAUDE|AGENTS)(\.local)?\.md$|\.mdc$|copilot-instructions|\/rules\//],['Settings',/settings(\.local)?\.json$|config\.toml$/],['Skills',/\/skills\//],['Agents',/\/agents\//],['Commands',/\/commands\//],['Hooks',/hooks|\.sh$/]];
  const byKind=fs=>{const g={};for(const f of fs){const k=(KINDS.find(([,re])=>re.test(f))||['Other'])[0];(g[k]=g[k]||[]).push(f)} return [...KINDS.map(k=>k[0]),'Other'].filter(k=>g[k]).map(k=>[k,g[k]])};
  const pieceRow=id=>{const t=find(id); return t?row80({mark:`<i class="pd80 st-${stageOf(t)}"></i>`,name:esc(t.name),val:'',attr:`data-pcopen="${t.id}"`,tip:t.what}):''};
  // each layer by who gets it and what that means in files; no colour of its own (the pieces it lights keep theirs)
  // each layer named by where it applies, tagged by who gets it; the line under it says what that means, in general
  // terms, then the files this runtime reads there (from its record: ~/.claude for Claude Code, ~/.codex for Codex)
  const SHORT={...LYNAME,builtin:agentName}, TAG=LYTAG;
  const GEN={org:'managed settings, override everything',local:'kept out of git: ignored, or a .local file',project:'in git: everyone who clones it',user:'in every repo you open',builtin:'what it does with no files at all'};
  const fileHint=l=>{const f=(l.files||[]).filter(x=>!/^the managed/.test(x)).slice(0,2).map(x=>x.replace(/ \(.*\)$/,'')); return f.length?` · ${f.join(', ')}`:''};
  const SUB=Object.fromEntries(Object.keys(GEN).map(k=>[k,GEN[k]]));
  const WHO={org:'Everyone in your organization, in every repo',local:'Only you, in this repo: kept out of git on purpose',project:'Everyone who works on this repo: in git, or once it\'s committed',user:'Only you, in every repo on this machine',builtin:`Everyone who uses ${agentName}: what it ships`};
  const lvlRow=l=>{const k='ly:'+l.id, open=OPEN80.has(k), on=levelOn(l), n=l.pieces.length;
    const attr=l.id==='builtin'?(!BASE.profile&&!BASE.new?`data-baseon="${on?0:1}"`:''):l.id==='user'?'data-homeon="1"':(l.id==='project'||l.id==='local')&&!BASE.profile?'data-yours="1"':'';
    const from=l.from.filter(f=>f.name!=='yours'&&l.id!=='builtin').map(f=>`${f.n} from ${esc(f.name)}`);
    // opened: only what the row doesn't say. What it sets; the other models its files name; then each piece it gives,
    // with the file(s) that give it. The runtime's layer: its modes, then what it gives out of the box
    const gives=(l.gives||[]).filter(g=>find(g.piece));
    // a file in the repo git doesn't track yet (and doesn't ignore) is the repo's: shared once it's committed
    const unc=new Set(l.uncommitted||[]);
    const giveRow=g=>{const t=find(g.piece), wait=g.files.length&&g.files.every(f=>unc.has(f)); return row80({mark:`<i class="pd80 st-${stageOf(t)}"></i>`,name:esc(t.name),sub:g.files.length?esc(g.files.slice(0,3).join(', ')+(g.files.length>3?` and ${g.files.length-3} more`:''))+(wait?' · <i class="uc75">not committed yet</i>':''):'',val:'',attr:`data-pcopen="${t.id}"`,tip:t.what})};
    // the files this runtime reads at this level (from its record), named only once the layer is open
    const where=l.id!=='builtin'&&(l.files||[]).length?`<p class="lb80">Where ${esc(agentName)} reads it</p>${l.files.map(f=>`<p class="fl75">${esc(f)}</p>`).join('')}`:'';
    const body=()=>`${where}${!l.readable?`<p class="mu74">${esc(agentName)} keeps these where Free Rein can't read them.</p>`:''}
      ${l.id!=='builtin'&&l.sets.length?`<p class="st74">Sets ${esc(l.sets.join(' and '))}</p>`:''}
      ${(l.models||[]).length?`<p class="lb80">Models its files name</p>${l.models.map(m=>`<div class="md70"><b>${esc(m.name)}</b><small>${esc(m.for||'')}</small></div>`).join('')}`:''}
      ${l.id==='builtin'&&(RM||l.sets.length)?`<details class="if94"><summary>${icon('Info',13)}<span>Models and defaults</span><small>what it can run, and what it uses with nothing set</small>${icon('ChevronDown',12)}</summary>${l.sets.length?`<p class="st74">Sets ${esc(l.sets.join(' and '))}</p>`:''}${RM?`<p class="lb80">Models it can run <small>${esc(RM.providers==='any'?'any, through providers you set up':RM.providers==='several'?'a menu across vendors':'its maker\'s only')}</small></p>
        <p class="mu74">${esc(RM.how)}</p>${RM.default?`<p class="mu74">With nothing set: ${esc(RM.default)}.</p>`:''}${(RM.choices||[]).length?`<div class="mc75">${RM.choices.map(c=>`<span class="ch75${c.example?' ex':''}" title="${esc(c.value)}">${esc(c.name)}</span>`).join('')}${RM.providers==='any'?'<span class="ch75 ex">and any other its providers offer</span>':''}</div>`:''}
        ${RM.set_by&&RM.set_by.file?`<p class="mu74">Set in ${esc(RM.set_by.file)}${RM.set_by.key?` (${esc(RM.set_by.key)})`:''}.</p>`:''}${!claudeRt?(RM.repo?`<p class="mu74">Picking a model on the row tries it in a draft: Free Rein writes it to ${esc(RM.repo.file)}${RM.repo.note?` (${esc(RM.repo.note)})`:''} on a copy, measures it, and changes nothing until you apply.</p>`:`<p class="mu74">${esc(agentName)} keeps the model in its own picker, not in a file in the repo, so a pick on the row is a what-if: Free Rein can't write it for you.${MWHATIF[rtid]?` What-if now: <b>${esc(MWHATIF[rtid])}</b>.`:''}</p>`):''}`:''}</details>`:''}
      ${l.id==='builtin'&&notes?`<div class="nt96">${notes}</div>`:''}
      ${l.id==='builtin'&&away?`<button class="lk50" data-rtback="1">Back to ${esc((bases.find(b=>b.id===lens.home)||{}).name||lens.home)}</button>`:''}
      ${gives.length?`<p class="lb80">${l.id==='builtin'?'What it gives out of the box':'What its files give'} <small>${gives.length}</small></p>${gives.map(giveRow).join('')}`:''}
      ${unc.size?`<p class="mu74">${unc.size===1?'One file isn\'t':`${unc.size} files aren't`} committed yet: they're in this repo, but a teammate gets them only once you commit them.</p>`:''}`;
    const tag=`<i class="tg75 ${TAG[l.id]==='just you'?'me':''}">${esc(TAG[l.id]||'')}</i>`;
    // the runtime's row: its name is the picker, so its tag goes on the line under it
    const RM=BASE.runtime_models, claudeRt=(BASE.runtime||{}).core==='claude', rtid=(BASE.runtime||{}).id, mPick=modelPickHTML();
    const name=l.id==='builtin'?`<span class="nm bi75"><span class="bn">${rtPick}${mPick?`<span class="on75w">on</span>${mPick}`:''}${(ms=>ms?`<span class="on75w">in</span>${ms}`:'')(modePickHTML())}</span>${on?'':' <small class="vw61">off</small>'}<small>${tag} <b class="cn75">${n} piece${n===1?'':'s'} · </b>${esc(SUB.builtin)}</small></span>`
      :`<span class="nm"><span class="bn">${esc(SHORT[l.id]||l.name)} ${tag}</span>${on?'':' <small class="vw61">off</small>'}<small><b class="cn75">${n} piece${n===1?'':'s'} · </b>${esc(SUB[l.id]||'')}</small></span>`;
    // the packages whose parts sit in this layer, under it, each with its own switch
    const pks=pk.filter(x=>{const p=((ST&&ST.packages)||[]).find(y=>y.name===x.id.slice(2)); return p&&p.levels[0]===l.id});
    // the built-in row holds a picker, so it opens from its chevron; the others open from the whole row
    const head=l.id==='builtin'?`<div class="r80 bh75" data-hly="${l.id}"><span class="li75">${icon(LVLIC.builtin,15)}</span>${name}<span class="vl"><span class="pc75">${n} piece${n===1?'':'s'}</span></span><button class="cv75" data-fold80="${k}" aria-expanded="${open}" aria-label="Its models and modes">${icon('ChevronDown',13)}</button></div>`
      :`<button class="r80" data-fold80="${k}" data-hly="${l.id}" aria-expanded="${open}"><span class="li75">${icon(LVLIC[l.id]||'Layers',15)}</span>${name}<span class="vl"><span class="pc75">${l.readable||n?`${n} piece${n===1?'':'s'}`:'not readable'}</span></span>${icon('ChevronDown',13)}</button>`;
    return `<div class="f80 ly75${open?' on':''}${on?'':' off'}"><div class="rw75">${head}${sw(attr,on,'this layer')}</div>${open?`<div class="fb80">${body()}</div>`:''}${pks.map(pkRow).join('')}</div>`};
  const lvName=id=>`${SHORT[id]||id} (${TAG[id]||''})`;
  const pkRow=l=>{const p=((ST&&ST.packages)||[]).find(x=>x.name===l.id.slice(2)), adds=p?p.pieces.map(id=>(find(id)||{}).name).filter(Boolean):[], also=p?p.levels.slice(1):[], where=p&&p.levels.length?p.levels.map(lvName).join(', '):'';
    return `<div class="ly75 pg75${l.on?'':' off'}"><div class="rw75"><button class="r80" data-hpk="${esc(l.id.slice(2))}" data-lyrow="${esc(l.id)}" title="A package: where these parts came from${where?`, in ${where}`:''}">
      <span class="li75">${icon(layerIcon(l),13)}</span><span class="nm">${esc(l.name)}${l.try?' <small class="dr61">in draft</small>':''}<small>a package${adds.length?` · adds ${esc(adds.slice(0,3).join(', '))}${adds.length>3?` and ${adds.length-3} more`:''}`:''}${also.length?` · also in ${esc(also.map(lvName).join(', '))}`:''}</small></span></button>
      ${sw(`data-p="${esc(l.id.slice(2))}"`,l.on,'this package')}${l.try?`<button class="rm52" data-untry="${esc(l.id.slice(2))}" aria-label="Stop trying it">${icon('X',11)}</button>`:''}</div>${modePkg&&l.id.slice(2)===modePkg?work:''}</div>`};
  const CB=ST?ST.combine:{}, cmb=[['settings','Settings'],['rules','Rules'],['instructions','Instructions']].filter(([k])=>CB[k]).map(([k,n])=>`<p class="cb74"><b>${n}</b> ${esc(CB[k].how)}</p>`).join('');
  const how=ST?fold80('ly:how',{mark:`<span class="li75">${icon('Info',14)}</span>`,name:'How layers work',val:'',tip:'What wins, what isn\'t used here, what Free Rein can\'t see'},
    ()=>`${cmb}${ST.unused.length?`<p class="mu74">Not used here: ${ST.unused.map(u=>esc(lvName(u.id))).join(', ')}.</p>`:''}
      ${ST.session?`<p class="mu74">The session (${esc(ST.session.how.replace(/^--settings, /,''))}) is a layer too, but Free Rein reads files, so it doesn't see it.</p>`:''}
      ${ST.folders?`<p class="mu74">Folders: ${esc(ST.folders.how)}.</p>`:''}`):'';
  const lgrp=(title,ids)=>{const ls=ids.map(id=>(ST?ST.levels:[]).find(l=>l.id===id)).filter(Boolean); return ls.length?`<p class="lb80">${title}</p>${ls.map(lvlRow).join('')}`:''};
  // what only you have: pieces in the two just-you layers and nowhere shared, so a teammate's agent won't have them
  const lv=id=>(ST&&ST.levels.find(l=>l.id===id))||{pieces:[]}, shared=new Set([...lv('project').pieces,...lv('builtin').pieces,...lv('org').pieces]);
  const mine=[...new Set([...lv('local').pieces,...lv('user').pieces])].filter(id=>!shared.has(id)&&find(id));
  const only=mine.length?`<div class="on75" data-honly="${esc(mine.join(','))}">${icon('TriangleAlert',13)}<span><b>${mine.length} piece${mine.length===1?'':'s'} only you have</b>, so a teammate's agent won't: ${mine.map(id=>`<button class="lk50" data-pcopen="${id}">${esc(find(id).name)}</button>`).join(', ')}</span></div>`:'';
  const body=ST?`${lgrp('Layers <small>each adds to the one above · hover to light its pieces</small>',['builtin','user','project','local','org'])}
      <p class="mu74">For settings, the lower layer wins. To see what a teammate gets, switch off both "just you" layers.</p>${only}
      ${(u=>u.length?`<p class="lb80">Other packages</p>${u.map(pkRow).join('')}`:'')(pk.filter(x=>{const p=((ST&&ST.packages)||[]).find(y=>y.name===x.id.slice(2)); return !p||!p.levels.some(id=>ST.levels.some(l=>l.id===id))}))}
      ${work&&!pk.some(x=>modePkg&&x.id.slice(2)===modePkg)?work:''}
      ${add?`<button class="lk50 tp75" data-addp="1">${icon('Plus',12)} Try a package</button>`:''}
      ${how}`
    :BASE.profile?`<p class="mu74">${esc(BASE.name.replace(/, out of the box$/,''))} out of the box: Free Rein reads what it ships from its record, with a source for each answer, not from files. So there are no layers of yours to switch here.</p>
      ${hosted?'<button class="lk50" data-pick="1">Read a folder instead</button>':''}`
    :`${L.map(l=>pkRow({...l,id:l.id.startsWith('p:')?l.id:'p:'+l.id})).join('')}`;
  return `<div class="pin54 pin61">${listSwitch()}<header class="hd80"><div class="hl"><b>${BASE.profile&&!ST?`${esc(BASE.name.replace(/, out of the box$/,''))}, out of the box`:`${nL} layer${nL===1?'':'s'} · read by ${esc(agentName)}`}</b></div></header>
      </div>
    <div class="ls80b">${where}${body}</div>`}
