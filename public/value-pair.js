const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function previousValue(m){
 if(!Number.isFinite(m?.value))return null;
 if(Number.isFinite(m.change))return m.value-m.change;
 const date=(m.sessionDate||m.asOf||'').slice(0,10);
 const prior=(m.history||[]).filter(p=>Number.isFinite(p.value)&&p.date<date).sort((a,b)=>a.date.localeCompare(b.date));
 return prior.at(-1)?.value??null;
}
export function valuePair(m,format){
 const prev=previousValue(m),before=Number.isFinite(prev)?format(prev):'—',current=Number.isFinite(m.value)?format(m.value):'—';
 return '<span class="value-pair" aria-label="前取引日 '+escape(before)+'、最新値 '+escape(current)+'"><span class="previous-value" title="前取引日・前公表日の値">'+escape(before)+'</span><span class="value-arrow" aria-hidden="true">→</span><span class="current-value">'+escape(current)+'</span></span>';
}
export function watchValuePairs(root){
 let pending=false;
 const fit=()=>{pending=false;for(const row of root.querySelectorAll('.value-pair')){
  row.style.fontSize='';
  const base=parseFloat(getComputedStyle(row).fontSize),available=row.clientWidth;
  if(!available)continue;
  const needed=row.scrollWidth;
  if(needed>available)row.style.fontSize=(base*available/needed*.97)+'px';
 }};
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(fit);}};
 new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
 if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(root);
 window.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);schedule();
}
