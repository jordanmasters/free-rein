// ---- Pieces: the next piece to add, the sections and their pieces, then the combos they earn (as trophy cards)
function piecesHome(A){const T=types(), f=T.filter(t=>t.stage===2).length, syn=H.sets.filter(x=>x.kind==='synergy'), P=(ovOK()?ovData().d.pieces:null)||{};
  const hosted=typeof HOST!=='undefined'&&canDraft(), dUps=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];
  const ORD={earned:0,near:1,locked:2}, shown=syn.filter(x=>comboState(x)!=='locked').sort((a,b)=>ORD[comboState(a)]-ORD[comboState(b)]), locked=syn.filter(x=>comboState(x)==='locked');
  const ws=H.sets.filter(x=>x.kind==='curse'&&(x.status==='active'||x.status==='cleared')).sort((a,b)=>(a.status==='active'?0:1)-(b.status==='active'?0:1));
  const earned=syn.filter(x=>x.status==='active').length, open=ws.filter(x=>x.status==='active').length;
  const nx=Object.keys(H.next||{})[0], nt=nx&&find(nx);
  const tierName=t=>t.tier?(t.tier.reached?t.tier.tiers[t.tier.reached-1].name:'Empty'):({hardened:'Hardened',equipped:'Equipped',started:'Started',empty:'Empty'})[stageOf(t)];
  const decides=t=>{const n=P[t.id]?P[t.id].decides.length:0; return n?`decides ${n} situation${n===1?'':'s'}`:''};
  const pieceRow=t=>row80({mark:`<i class="pd80 st-${stageOf(t)}"></i>`,name:esc(t.name),sub:decides(t),val:`<span class="tn80${t.tier&&!t.tier.next?' top':''}">${tierName(t)}${t.tier?` <small>${t.tier.reached}/${t.tier.tiers.length}</small>`:''}</span>`,attr:`data-pcopen="${t.id}"`,tip:tierName(t)});
  const secRow=sl=>{const ff=sl.types.filter(t=>t.stage===2).length, c=k=>sl.types.filter(t=>stageOf(t)===k).length;
    const bar=['hardened','equipped','started','empty'].map(k=>c(k)?`<i class="st-${k}" style="flex:${c(k)}"></i>`:'').join('');
    return fold80('sec:'+sl.id,{mark:`<i class="sd80" style="--sec:${SECCOL[sl.id]||'#8D919D'}"></i>`,name:esc(sl.name),val:`<span class="br80">${bar}</span><span class="n">${ff}/${sl.types.length}</span>`,tip:sl.about||''},
      ()=>`${sl.types.map(pieceRow).join('')}<button class="mo61" data-secopen="${sl.id}">All of ${esc(sl.name.toLowerCase())} on one screen ${icon('ArrowRight',12)}</button>`,`--sec:${SECCOL[sl.id]||'#8D919D'}`)
      .replace('<button class="r80"',`<button class="r80" data-hsec="${sl.id}"`)};
  A.innerHTML=`<div class="pin54 pin61">${listSwitch()}<header class="hd80"><div class="hl"><b>${f} of ${T.length} pieces · level ${lvlOf(xpOf())}</b></div></header>
      ${nt?`<div class="nm64 nx">${slight('st-equipped')}<button class="tx" data-pcopen="${nx}"><b>Next: ${esc(nt.name)}</b> <span>${nt.upgrade_xp?`+${nt.upgrade_xp} XP · `:''}${esc((H.next[nx]||[])[0]||'')}</span></button>${hosted?`<button class="fx" data-fdraft="${nx}">${dUps.includes(nx)?'✓ In draft':'Add to draft'}</button>`:''}</div>`:''}</div>
    <div class="ls80b">
      <p class="lb80">Sections <small>what it has · tap a piece to open it</small></p>${H.slots.map(secRow).join('')}
      <p class="lb80">Combos <small>what pieces earn together</small></p>
      <p class="cl81 gold">Achievements · ${earned} of ${syn.length}</p>
      ${shown.length?`<div class="cg81">${shown.map(card).join('')}</div>`:`<p class="mute em80">None earned or one piece away yet.</p>`}
      ${locked.length?fold80('cb:locked',{mark:icon('Lock',13),name:'Not started',val:locked.length,tip:'Achievements that need two or more pieces you don\'t have yet'},()=>`<div class="cg81">${locked.map(card).join('')}</div>`):''}
      ${ws.length?`<p class="cl81 bad">Weak spots · ${open}</p><div class="cg81 w">${ws.map(wsCard).join('')}</div>`:''}
    </div>`;
  bindAside(A); bindSub(A);
  A.querySelectorAll('[data-fold80]').forEach(b=>b.onclick=()=>{const k=b.dataset.fold80;OPEN80.has(k)?OPEN80.delete(k):OPEN80.add(k);piecesHome(A);bindBrief(A)});
  A.querySelectorAll('[data-secopen]').forEach(b=>b.onclick=()=>{selSlot=b.dataset.secopen;selRow=null;sel=null;selSet=null;render()});
  A.querySelectorAll('[data-pcopen]').forEach(b=>{b.onclick=e=>{if(e.target.closest&&e.target.closest('[data-fdraft]'))return;selectPiece(b.dataset.pcopen)};b.onmouseenter=()=>lightPieces([b.dataset.pcopen]);b.onmouseleave=()=>lightPieces(null)});
  A.querySelectorAll('[data-hsec]').forEach(b=>{const sl=H.slots.find(x=>x.id===b.dataset.hsec); if(!sl) return;
    b.onmouseenter=()=>lightPieces(sl.types.map(t=>t.id));b.onmouseleave=()=>lightPieces(null)});
  // a combo card: its pieces (and, for a weak spot, what would fix it) light on the board, its card opens beside it
  A.querySelectorAll('.cg81 [data-set]').forEach(el=>{const s=H.sets.find(x=>x.name===el.dataset.set); if(!s) return; const ids=[...s.ids,...(s.kind==='curse'?(s.lifts||[]):[])];
    el.onmouseenter=e=>{cbFocus(s);tipCombo(s,e);tipBeside(el,ids);lightPieces(ids)};
    el.onmouseleave=()=>{cbFocus(null);lightPieces(null);$('v44tip').hidden=true};
    el.onclick=e=>{e.stopPropagation&&e.stopPropagation();$('v44tip').hidden=true;selSet=s.name;sel=null;selSlot=null;render()}})}
