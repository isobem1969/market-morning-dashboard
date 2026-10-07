export const MARKET_PERIODS=[['1w','1週'],['1m','1カ月'],['6m','6カ月'],['1y','1年'],['2y','2年']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2});
export function marketCutoff(date,period){
 const d=new Date(`${date}T12:00:00Z`);
 if(period==='1w')d.setUTCDate(d.getUTCDate()-6);
 else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-({'1m':1,'6m':6,'1y':12,'2y':24}[period]??6));d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}
 return d.toISOString().slice(0,10);
}
export function cleanMarketHistory(history){
 const byDate=new Map();
 for(const p of history||[]){if(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.value)&&p.value>=0&&Number.isFinite(Date.parse(p.date+'T12:00:00Z'))&&new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)===p.date)byDate.set(p.date,p);}
 return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function selectMarketHistory(history,period){
 const points=cleanMarketHistory(history);if(!points.length)return [];
 const start=marketCutoff(points.at(-1).date,period);return points.filter(p=>p.date>=start);
}
export function marketChart(m,period){
 const all=cleanMarketHistory(m.history),points=selectMarketHistory(all,period);
 const controls=`<div class="market-periods" role="group" aria-label="${esc(m.name)}のチャート期間">${MARKET_PERIODS.map(([key,label])=>`<button type="button" data-market-id="${m.id}" data-market-period="${key}" aria-pressed="${key===period}">${label}</button>`).join('')}</div>`;
 if(!points.length)return `<section class="market-plot">${controls}<div class="market-chart-empty">この期間の履歴を取得できていません。</div></section>`;
 const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),pad=Math.max((max-min)*.12,max*.002,.01),lo=Math.max(0,min-pad),hi=max+pad;
 const left=68,right=482,top=18,bottom=202,w=500,h=240;
 const start=Date.parse(points[0].date),end=Date.parse(points.at(-1).date);
 const x=p=>points.length===1?(left+right)/2:left+(Date.parse(p.date)-start)/(end-start)*(right-left),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
 const line=points.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
 const grid=Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*i/4;return `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#dce3e8" stroke-dasharray="3 4"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${num(v)}</text>`;}).join('');
 const indices=[...new Set([0,Math.round((points.length-1)/2),points.length-1])];
 const ticks=indices.map(i=>`<text x="${x(points[i])}" y="231" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}">${points[i].date.slice(2).replaceAll('-','/')}</text>`).join('');
 const last=points.at(-1),short=all[0].date>marketCutoff(last.date,period);
 return `<section class="market-plot">${controls}<svg class="market-chart" data-market-chart="${m.id}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(m.name)} ${MARKET_PERIODS.find(p=>p[0]===period)?.[1]}の推移。${points[0].date}から${last.date}"><title>${esc(m.name)} 最低${num(min)}、最高${num(max)}</title>${grid}<path d="${line}" fill="none" stroke="#1753a6" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${x(last)}" cy="${y(last.value)}" r="4" fill="#1753a6"/>${ticks}</svg><div class="market-caption"><span>${points[0].date.replaceAll('-','/')}〜${last.date.replaceAll('-','/')} · ${points.length}日</span><span>最低 <b>${num(min)}</b> ／ 最高 <b>${num(max)}</b></span></div><p class="market-hover" aria-live="off">グラフに触れると日付と価格を表示</p><p class="market-note">日次の市場値。最新日は更新時点の値を含みます。最新データの日付を終点に表示し、休場日の値は補間しません。${short?'選択期間より履歴が短いため、取得できた範囲を表示しています。':''}${m.id==='brent'?'ブレント期近先物：限月切り替えの影響があります。':''}</p></section>`;
}
export function marketHover(e,metrics,ranges){
 const svg=e.target.closest('svg[data-market-chart]');if(!svg)return;
 const m=metrics.find(m=>m.id===svg.dataset.marketChart);if(!m)return;
 const points=selectMarketHistory(m.history,ranges.get(m.id)||'6m');if(!points.length)return;
 const rect=svg.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,((e.clientX-rect.left)/rect.width*500-68)/(482-68)));
 const time=Date.parse(points[0].date)+fraction*(Date.parse(points.at(-1).date)-Date.parse(points[0].date));
 const p=points.reduce((best,p)=>Math.abs(Date.parse(p.date)-time)<Math.abs(Date.parse(best.date)-time)?p:best);
 svg.closest('.market-plot').querySelector('.market-hover').textContent=`${p.date.replaceAll('-','/')} · ${num(p.value)} ${m.unit}`;
}
