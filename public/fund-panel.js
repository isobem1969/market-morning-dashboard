export const FUND_META={
 sox:{name:'ニッセイSOX',code:'29314233'},
 fang:{name:'iFreeNEXT FANG＋',code:'04311181'},
 nasdaq:{name:'SBI NASDAQ100',code:'89311265'}
};
export const FUND_PERIODS=[['1d','1日'],['1w','1週'],['1m','1カ月'],['6m','6カ月'],['1y','1年'],['2y','2年']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
export function fundPoints(history,period='6m'){
 const byDate=new Map();
 for(const p of history||[]){
  if(!Number.isFinite(p.value)||p.value<=0||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))continue;
  const d=new Date(p.date+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==p.date)continue;
  byDate.set(p.date,{date:p.date,value:p.value});
 }
 const all=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
 let s25=0,s75=0;
 const averages=all.map((p,i)=>{s25+=p.value;s75+=p.value;if(i>=25)s25-=all[i-25].value;if(i>=75)s75-=all[i-75].value;return {...p,ma25:i>=24?s25/25:null,ma75:i>=74?s75/75:null};});
 if(!averages.length)return [];
 const end=averages.at(-1).date;
 if(period==='1d')return averages.slice(-1);
 const d=new Date(end+'T00:00:00Z');
 if(period==='1w')d.setUTCDate(d.getUTCDate()-6);
 else{
  const months=({'1m':1,'6m':6,'1y':12,'2y':24})[period]??6,day=d.getUTCDate();
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);
  d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));
 }
 return averages.filter(p=>p.date>=d.toISOString().slice(0,10));
}
function graph(m,period){
 const pts=fundPoints(m.history,period);
 if(!pts.length)return '<div class="fund-empty">この期間の基準価額を取得できていません。</div>';
 const values=pts.flatMap(p=>[p.value,p.ma25,p.ma75]).filter(Number.isFinite),low=Math.min(...values),high=Math.max(...values);
 const pad=Math.max((high-low)*.12,high*.003),lo=Math.max(0,low-pad),hi=high+pad,left=84,right=704,top=18,bottom=252;
 const x=i=>pts.length===1?(left+right)/2:left+(right-left)*i/(pts.length-1),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
 const path=key=>{let pen=false;return pts.map((p,i)=>{if(!Number.isFinite(p[key])){pen=false;return '';}const cmd=pen?'L':'M';pen=true;return cmd+x(i).toFixed(2)+','+y(p[key]).toFixed(2);}).join(' ');};
 const line=path('value'),last=pts.at(-1),min=Math.min(...pts.map(p=>p.value)),max=Math.max(...pts.map(p=>p.value));
 const grid=Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*i/4,yy=y(v);return '<line x1="'+left+'" y1="'+yy+'" x2="'+right+'" y2="'+yy+'" stroke="#e4e9ec"/><text x="'+(left-10)+'" y="'+(yy+4)+'" text-anchor="end">'+num(v)+'</text>';}).join('');
 const labels=[...new Set([0,Math.round((pts.length-1)/3),Math.round((pts.length-1)*2/3),pts.length-1])].map(i=>'<text x="'+x(i)+'" y="285" text-anchor="'+(pts.length===1?'middle':i===0?'start':i===pts.length-1?'end':'middle')+'">'+pts[i].date.slice(2).replaceAll('-','/')+'</text>').join('');
 const area=pts.length>1?'<path d="'+line+' L'+right+','+bottom+' L'+left+','+bottom+' Z" fill="url(#fund-fill-'+m.id+')"/>':'';
 return '<div class="fund-legend"><span class="nav-line">基準価額 <strong>'+num(last.value)+'</strong></span><span class="ma25-line">25日線 <strong>'+num(last.ma25)+'</strong></span><span class="ma75-line">75日線 <strong>'+num(last.ma75)+'</strong></span></div><div class="fund-chart-wrap"><svg class="fund-chart" data-fund-chart="'+m.id+'" viewBox="0 0 720 300" role="img" aria-label="'+esc(FUND_META[m.id].name)+'の基準価額と25・75日移動平均"><defs><linearGradient id="fund-fill-'+m.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15536b" stop-opacity=".3"/><stop offset="1" stop-color="#15536b" stop-opacity=".02"/></linearGradient></defs>'+grid+area+'<path d="'+line+'" fill="none" stroke="#15536b" stroke-width="2.4"/><path data-ma="25" d="'+path('ma25')+'" fill="none" stroke="#ee303b" stroke-width="2.6"/><path data-ma="75" d="'+path('ma75')+'" fill="none" stroke="#3168ff" stroke-width="2.6"/><circle cx="'+x(pts.length-1)+'" cy="'+y(last.value)+'" r="4" fill="#15536b"/>'+labels+'</svg></div><div class="fund-chart-footer"><span>'+pts[0].date.replaceAll('-','/')+'〜'+last.date.replaceAll('-','/')+' · '+pts.length+'公表日</span><span>最低 <strong>'+num(min)+'円</strong> ／ 最高 <strong>'+num(max)+'円</strong></span></div><p class="fund-hover">グラフに触れると基準価額・移動平均を表示</p><p class="fund-chart-note">'+(period==='1d'?'1日は最新公表日の1点です。日中の値動きはありません。':'取得済みの公表値だけを表示。選択期間より履歴が短い場合は、取得できた範囲だけを表示します。')+'25・75日線は25・75公表日の基準価額の単純平均。日数不足は表示しません。休場日の値は追加しません。</p>';
}
export function fundCard(m,q,period,{datetime}){
 const meta=FUND_META[m.id],dir=Number.isFinite(m.change)?m.change>0?'up':m.change<0?'down':'neutral':'neutral';
 const amount=Number.isFinite(m.change)?(m.change>0?'+':m.change<0?'−':'')+num(Math.abs(m.change))+'円':'—';
 const pct=Number.isFinite(m.changePct)?' ('+(m.changePct>0?'+':'')+num(m.changePct,2)+'%)':'';
 const ratio=Number.isFinite(m.peak)&&m.peak>0&&Number.isFinite(m.value)?m.value/m.peak*100:null;
 const peak=ratio!==null?'<div class="peak'+(ratio<=80?' peak-discount':'')+'"><div class="peak-ratio">最高値の <strong>'+num(ratio,1)+'<small>%</small></strong></div><div class="peak-track" role="meter" aria-label="最高値に対する現在値の割合" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.min(100,ratio).toFixed(1)+'"><span style="width:'+Math.min(100,Math.max(0,ratio)).toFixed(1)+'%"></span></div><div>最高値から '+num(ratio-100,1)+'%</div><div class="fund-peak-price"><span>取得データの最高値</span><strong>'+num(m.peak)+'円</strong></div></div>':'';
 const base='https://itf.minkabu.jp/fund/'+meta.code;
 const href=base+'#:~:text='+encodeURIComponent('基準価額');
 const source=/^https:\/\//.test(m.sourceUrl)?m.sourceUrl:'#';
 return '<article class="card fund-card" data-fund="'+m.id+'" aria-label="'+esc(m.name)+'"><div class="fund-heading"><div><h3>'+meta.name+'</h3><span>'+meta.code+' · 投資信託 / 円</span></div><a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">運用会社の公表値 ↗</a></div><div class="fund-body"><div class="fund-reading"><div class="fund-price-box '+dir+'"><span class="fund-price">'+num(m.value)+'</span><span>円</span></div><p class="fund-change '+dir+'">'+(dir==='up'?'↑':dir==='down'?'↓':'→')+' '+amount+pct+'</p><p class="fund-date">基準価額 · 1万口あたり<br>公表 '+datetime(m.asOf)+' ／ 取得 '+datetime(m.lastSuccess)+'</p><span class="badge">'+(q.usable?'取得成功':esc(q.label))+'</span>'+peak+'</div><div class="fund-plot"><div class="fund-chart-header"><h4>基準価額の推移</h4><div class="fund-periods" role="group" aria-label="'+meta.name+'のチャート期間">'+FUND_PERIODS.map(([key,label])=>'<button type="button" data-fund-id="'+m.id+'" data-fund-period="'+key+'" aria-pressed="'+(key===period)+'">'+label+'</button>').join('')+'</div></div>'+graph(m,period)+'<div class="fund-reference-action"><a class="fund-minkabu" data-fund-minkabu="'+m.id+'" href="'+href+'" target="_blank" rel="noopener noreferrer" aria-label="'+meta.name+'のみんかぶを小窓で開く">みんかぶ</a><span class="fund-popup-note" role="status"></span></div></div></div>'+(m.historyNote?'<p class="fund-chart-note">'+esc(m.historyNote)+'</p>':'')+(m.error?'<details class="history-details"><summary>取得エラー</summary>'+esc(m.error)+'</details>':'')+'</article>';
}
export function openFundReference(a){
 const s=window.screen,aw=Number(s.availWidth)||1280,ah=Number(s.availHeight)||800;
 const width=Math.min(520,Math.max(100,aw-48)),height=Math.min(560,Math.max(100,ah-120));
 const left=(Number(s.availLeft)||0)+Math.max(0,aw-width-24),top=(Number(s.availTop)||0)+Math.max(0,ah-height-100);
 const note=a.parentElement.querySelector('.fund-popup-note');
 try{window.open(a.href,'_blank','popup=yes,width='+width+',height='+height+',left='+left+',top='+top+',resizable=yes,scrollbars=yes,noopener');note.textContent='開かない場合は通常リンクを使用してください。';}
 catch{note.textContent='小窓を開けませんでした。';}
 const fallback=document.createElement('a');fallback.href=a.href;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='通常リンク ↗';note.append(' ',fallback);
}
export function fundHover(e,metrics,ranges){
 const svg=e.target.closest('[data-fund-chart]');if(!svg)return;
 const m=metrics.find(m=>m.id===svg.dataset.fundChart);if(!m)return;
 const ps=fundPoints(m.history,ranges.get(m.id)||'6m'),r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*720;
 const index=Math.max(0,Math.min(ps.length-1,Math.round((x-84)/620*Math.max(1,ps.length-1)))),p=ps[index];if(!p)return;
 svg.closest('.fund-plot').querySelector('.fund-hover').textContent=p.date+' · 基準価額 '+num(p.value)+'円 · 25日線 '+num(p.ma25)+'円 · 75日線 '+num(p.ma75)+'円';
}
