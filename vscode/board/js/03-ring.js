// ---- ring: the ten slots; click one to zoom into its types
const cx=270, cy=270;
const polar=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
function band(ra,rb,a0,a1){const [x0,y0]=polar(rb,a0),[x1,y1]=polar(rb,a1),[x2,y2]=polar(ra,a1),[x3,y3]=polar(ra,a0);const lg=a1-a0>Math.PI?1:0;
  return `M${x0} ${y0} A${rb} ${rb} 0 ${lg} 1 ${x1} ${y1} L${x2} ${y2} A${ra} ${ra} 0 ${lg} 0 ${x3} ${y3} Z`}
const G0=78, G1=160;

function bindTypes(root){
  root.querySelectorAll('[data-t]').forEach(el=>{
    el.ondblclick=e=>{e.stopPropagation();const t=find(el.dataset.t),p=t&&t.inst.find(x=>x.path);if(p)HOST.open(p.path,p.lines)};
    el.onclick=e=>{e.stopPropagation();if(INSPHIDE){INSPHIDE=false;try{localStorage.setItem('v44-insp','shown')}catch(x){}}sel=sel===el.dataset.t?null:el.dataset.t;selSet=null;if(sel&&selSlot&&find(sel)?.slot.id!==selSlot)selSlot=null;render()};
    el.onmouseenter=e=>{hov=el.dataset.t;hp.t=hov;paint();tipType(hov,e)};el.onmousemove=moveTip;
    el.onmouseleave=()=>{hov=null;hp.t=null;paint();$('v44tip').hidden=true}});
}

const SETNAME={};
const setName=s=>SETNAME[s.name]||s.name;
let hiSet=null;
