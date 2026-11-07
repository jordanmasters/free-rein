// ---- the brief: what it can be left to do (a headline), the five reins, the best next move, the facts
function briefKit(){
  const hosted=typeof HOST!=='undefined';
  const cur=H.tiers.filter(t=>t.reached).pop(), rk=cur&&RANKS[cur.id]?RANKS[cur.id]:null;
  const probs=H.sets.filter(x=>x.kind==="curse"&&x.status==="active"), syn=H.sets.filter(x=>x.kind==="synergy"), act=syn.filter(x=>x.status==="active");
  const SCALE=(BASE.trust&&BASE.trust.scale)||["Not at all","Only with my review","Usually","Mostly","Completely"];
  const CATS=(BASE.trust&&BASE.trust.categories)||[];
  const INF={edit:'edit files',knowledge:'change what it knows',commands:'run commands',done:"decide it's done",unattended:'act unattended'};
  const PRES={edit:'edits files',knowledge:'changes what it knows',commands:'runs commands',done:"decides it's done",unattended:'acts unattended'};
  const ans=BASE.answers||null, mineOf=id=>ans&&ans[id]!=null?Math.round(100*ans[id]/Math.max(1,SCALE.length-1)):null;
  const lanes=CATS.map((c,i)=>({id:c.id,name:c.name,q:c.question,e:(H.cats||[])[i]??c.evidence_score,m:mineOf(c.id)}));
  const bi=e=>Math.max(0,Math.min(SCALE.length-1,Math.round(e/25))), band=e=>SCALE[bi(e)];
  const join=xs=>xs.length<2?(xs[0]||''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1];
  const w=(l,f)=>`<button class="w49 ${bi(l.e)>=3?'ok':bi(l.e)<=1?'rv':'md'}" data-lane="${l.id}" title="${esc(l.q)}: backed ${l.e}%">${esc(f[l.id]||l.name.toLowerCase())}</button>`;
  const headline=()=>{const alone=lanes.filter(l=>bi(l.e)>=3), mid=lanes.filter(l=>bi(l.e)===2), rev=lanes.filter(l=>bi(l.e)<=1);
    const a=alone.length?`Its safeguards back it to ${join(alone.map(l=>w(l,INF)))} on its own.`:`Its safeguards don't yet back it to do anything on its own.`;
    const m=mid.length?` Usually fine to let it ${join(mid.map(l=>w(l,INF)))}.`:'';
    const r=rev.length?` Keep reviewing when it ${join(rev.map(l=>w(l,PRES)))}.`:` Nothing needs your review by default.`;
    const ahead=lanes.filter(l=>l.m!=null&&l.m>l.e+0);
    return `<p class="hl49">${a}${m}${r}</p>${ahead.length?`<p class="gp49w">${icon('TriangleAlert',13)} You trust it more than its safeguards back when it ${join(ahead.map(l=>esc(PRES[l.id]||l.name)))}.</p>`:!ans&&hosted&&!BASE.profile?`<p class="gp49w mute">Answer the trust check in the sidebar to see where your trust runs ahead of the evidence.</p>`:''}`};
  const nextId=Object.keys(H.next||{})[0], nT=nextId&&find(nextId);
  const dUps=(BASE.lens&&BASE.lens.ups)||(BASE.draft&&BASE.draft.ups)||[];
  const nextCard=()=>nT?`<div class="nx49"><em>${icon('Sparkles',12)} Best next step</em>
      <b>${esc(nT.name)}</b><span>${esc(reward(nextId))}${nT.upgrade_xp?` · +${nT.upgrade_xp} XP`:''}</span>
      <span class="ac"><button data-nextsee="${nextId}">See it</button>${hosted&&canDraft()?`<button class="pri" data-nextdraft="${nextId}">${dUps.includes(nextId)?'✓ In the draft':'Add to draft'}</button>`:''}</span></div>`
    :`<div class="nx49"><em>Best next step</em><b>Nothing suggested</b><span>Every piece the next level needs is in place.</span></div>`;
  const facts=()=>`<p class="fc49"><button data-topic="tier">Level ${lvlOf(xpOf())} · ${esc(rk?rk[0]:'Unranked')}</button><i>·</i><button data-topic="trust">${H.backed}% backed overall</button><i>·</i><button data-topic="problems" class="${probs.length?'bad':''}">${probs.length} weak spot${probs.length===1?'':'s'}</button><i>·</i><button data-topic="sets" class="gold">${act.length} of ${syn.length} achievements</button></p>`;
  const reins=(compact)=>`<div class="rn49${compact?' c':''}">${compact?'':`<div class="sc49"><span></span><span class="pt">${SCALE.map((x,i)=>`<i style="left:${i*25}%">${esc(x)}</i>`).join('')}</span><span></span></div>`}
      ${lanes.map(l=>{const tone=l.m!=null&&l.m>l.e+25?'far':l.m!=null&&l.m>l.e?'near':'';
        return `<button class="ln49 ${tone}" data-lane="${l.id}" title="${esc(l.q)}">
          <span class="nm">${esc(l.name)}</span>
          <span class="tr"><u style="width:${l.e}%"></u>${l.m!=null&&l.m>l.e?`<s style="left:${l.e}%;width:${l.m-l.e}%"></s>`:''}${l.m!=null?`<b style="left:${l.m}%" title="Your trust: ${esc(SCALE[ans[l.id]]||'')}"></b>`:''}${[25,50,75].map(x=>`<a style="left:${x}%"></a>`).join('')}</span>
          <span class="v">${esc(band(l.e))}<small>${l.e}%</small></span></button>`}).join('')}
      ${ans?`<div class="lg49"><span><u></u>backed by its safeguards</span><span><b></b>your trust</span><span><s></s>trust beyond the evidence</span></div>`:''}</div>`;
  return {headline,reins,nextCard,facts,lanes,SCALE,band,bi,dUps,ans,CATS};
}
