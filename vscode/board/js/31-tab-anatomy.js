// ---- the other tabs, in the same anatomy as Situations: a header (what it says now, its main action), a one-line
// next move, search and a legend that filters, slim folding groups with a bar and a count, calm rows.
const stageOf=t=>['empty','started','equipped','hardened'][Math.max(0,maturity(t))];
function grpHead(id,name,shut,bar,count,attr,extra=''){return `<header class="gh61" ${attr}="${id}" role="button" tabindex="0" aria-expanded="${!shut}">
    <span class="cv" aria-hidden="true">${icon('ChevronRight',14)}</span><span class="nm">${esc(name)}</span>${extra}<span class="vb63">${bar}</span><span class="ct">${count}</span></header>`}
function tabHead(title,line,actions){return `<header class="hd61"><div><h3>${title}</h3><p>${line}</p></div><span class="ac">${actions||''}</span></header>`}
