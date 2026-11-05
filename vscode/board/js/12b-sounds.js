// ---- sounds: small tones made in the browser (Web Audio, no files), timed to a change landing on the board.
// freeRein.sounds sets the volume (off, quiet, normal). Only the window you're using plays them: the sidebar and the full
// board both redraw on a change, and one sound is enough
let SNDLV='off', SNDCTX=null, SNDQ=[], SNDTOUCH=0;
const SNDVOL={off:0,quiet:.35,normal:.7};
if(typeof document!=='undefined'&&document.addEventListener) document.addEventListener('pointerdown',()=>{SNDTOUCH=performance.now();sndCtx()},true);
function sndCtx(){if(!SNDVOL[SNDLV]) return null; try{SNDCTX=SNDCTX||new (window.AudioContext||window.webkitAudioContext)(); if(SNDCTX.state==='suspended') SNDCTX.resume()}catch(e){SNDCTX=null} return SNDCTX}
const sndMine=()=>performance.now()-SNDTOUCH<20000||(document.hasFocus&&document.hasFocus());
// one note: a sine (or other wave) with a soft attack and an exponential tail; optionally gliding to another pitch
function note(c,at,f,dur,o={}){const g=c.createGain(), v=(o.v??1)*.22*SNDVOL[SNDLV], os=c.createOscillator();
  os.type=o.type||'sine'; os.frequency.setValueAtTime(f,at); if(o.to) os.frequency.exponentialRampToValueAtTime(o.to,at+dur*.9);
  g.gain.setValueAtTime(.0001,at); g.gain.exponentialRampToValueAtTime(v,at+(o.atk||.012)); g.gain.exponentialRampToValueAtTime(.0001,at+dur);
  os.connect(g).connect(c.destination); os.start(at); os.stop(at+dur+.05)}
const SNDS={
  tick:(c,t)=>note(c,t,880,.09,{v:.35,type:'triangle'}),
  up:(c,t)=>{note(c,t,523.25,.32,{v:.8});note(c,t+.11,783.99,.45,{v:.8});note(c,t+.11,1567.98,.3,{v:.12})},
  down:(c,t)=>{note(c,t,392,.45,{v:.8,to:261.63});note(c,t+.02,196,.4,{v:.25,type:'triangle'})},
  mixed:(c,t)=>{SNDS.up(c,t);SNDS.down(c,t+.32)},
  levelup:(c,t)=>{[523.25,659.25,783.99,1046.5].forEach((f,i)=>note(c,t+i*.08,f,.35+i*.05,{v:.75}));note(c,t+.36,2093,.5,{v:.18,type:'triangle'})},
  leveldown:(c,t)=>[783.99,659.25,523.25].forEach((f,i)=>note(c,t+i*.11,f,.4,{v:.55})),
  bell:(c,t)=>{note(c,t,1046.5,1.4,{v:.7,atk:.004});note(c,t,2888,.7,{v:.18,atk:.004});note(c,t+.01,1568,1,{v:.2,atk:.004})},
  weak:(c,t)=>{note(c,t,130.81,.32,{v:.9,to:92.5});note(c,t,65.4,.25,{v:.4,type:'triangle'})},
  fixed:(c,t)=>{note(c,t,1318.5,.6,{v:.6,atk:.006});note(c,t+.06,1975.5,.4,{v:.15})}};
// play now, or at a moment on performance.now()'s clock (the board's animation clock)
function snd(name,atMs){if(!SNDVOL[SNDLV]||!sndMine()) return; const c=sndCtx(); if(!c||!SNDS[name]) return;
  const dt=Math.max(0,((atMs??performance.now())-performance.now())/1000); try{SNDS[name](c,c.currentTime+.01+dt)}catch(e){}}
// sounds noticed while drawing (an achievement, a weak spot) wait for the change to land, then play with it
function sndQueue(name){if(!SNDQ.includes(name)) SNDQ.push(name)}
function sndFlush(atMs){const q=SNDQ; SNDQ=[]; q.forEach((n,i)=>snd(n,(atMs??performance.now())+i*350))}
