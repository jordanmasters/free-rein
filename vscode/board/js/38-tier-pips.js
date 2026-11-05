// ---- tiers: Equipped → Tuned → Enforced → Proven (tiers.ts). Pips, one per tier; the next fills with progress.
function tierFrac(T){const n=T.next&&T.next.progress; return n&&n[1]?Math.max(0,Math.min(1,n[0]/n[1])):0}
function tierPips(T,big){return `<span class="lv44 tr${big?' big':''}" title="${esc(T.name)}${T.next?` · next: ${esc(T.next.name)}${T.next.progress?` (${T.next.progress[0]} of ${T.next.progress[1]})`:''}`:' · top tier'}">${T.tiers.map((x,i)=>`<i class="${i<T.reached?'on':''}">${i===T.reached&&T.next?`<b style="width:${Math.round(100*tierFrac(T))}%"></b>`:''}</i>`).join('')}</span>`}
// the next level and what it needs, top three; every level one click further. A level that waits on skills of your
// own, when yours all come from a package, points at pinning the package instead of a dead end
function tiersHTML(t){const T=t.tier; if(!T) return '';
  const nx=T.next&&T.tiers[T.reached], all=LISTALL['tiers:'+t.id], pkg=nx&&/from a package/.test(nx.why||'');
  const next=nx?`<div class="tn79"><span class="k">Next · ${esc(nx.name)}${nx.progress&&nx.progress[1]?` · ${nx.progress[0]} of ${nx.progress[1]}`:''}</span>
      <p>${esc((nx.missing||[]).length?nx.missing.length+' to fix first':nx.why||nx.means)}</p>
      ${(nx.missing||[]).slice(0,3).map(m=>`<p class="ms79"><b>${esc(m.name)}</b> ${esc(m.why)}</p>`).join('')}${(nx.missing||[]).length>3?`<p class="mute">and ${nx.missing.length-3} more</p>`:''}
      ${pkg&&find('pins')?`<button class="b50" data-go="pins">${icon('Pin',12)} Meanwhile: pin the package and check its source</button>`:''}</div>`:`<p class="ok55">${icon('BadgeCheck',14)} Top level reached.</p>`;
  return next+`<button class="lk50" data-listall="tiers:${esc(t.id)}">${all?'Hide the levels':`See all ${T.tiers.length} levels`}</button>`+(all?`<div class="ti78">${T.tiers.map((x,i)=>{const done=i<T.reached, cur=T.next&&i===T.reached;
    return `<div class="tr78 ${done?'done':cur?'cur':'lock'}"><span class="mk">${done?icon('Check',12):cur?icon('ArrowRight',12):icon('Lock',11)}</span><div><b>${esc(x.name)}</b><p>${esc(x.means)}</p>${x.source?`<p class="src"><a href="${esc(x.source)}" target="_blank" rel="noopener">its source</a></p>`:''}</div></div>`}).join('')}</div>`:'')}
