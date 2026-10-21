import {stockGraph as graph} from './stock-chart.js?v=daily-axis-20261022';
import {analystPanel} from './analyst-panel.js?v=analyst-20261022';
import {stockAlerts} from './stock-alerts.js?v=stock-alerts-20261017';
import {valuePair,watchValuePairs} from './value-pair.js?v=green-arrow-20261008';
import {PERIODS,chartPoints,nyDate,sectionOld,periodHigh} from './stocks-logic.js?v=period-high-20261009';
const container=document.querySelector('#stocks'),status=document.querySelector('#status'),refresh=document.querySelector('#refresh');
const ranges=new Map();let data=null,offline=false,loading=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const signed=v=>Number.isFinite(v)?`${v>0?'+':v<0?'−':''}${num(Math.abs(v))}`:'—';
const stamp=t=>Number.isFinite(Date.parse(t))?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t))+' JST':'日時不明';
function stale(p){return offline||sectionOld(p,data.generatedAt);}
function popupFeatures(screenInfo){
 const aw=Number(screenInfo.availWidth)||1280,ah=Number(screenInfo.availHeight)||800;
 const width=Math.min(520,Math.max(100,aw-48)),height=Math.min(560,Math.max(100,ah-120));
 const left=(Number(screenInfo.availLeft)||0)+Math.max(0,aw-width-24);
 const top=(Number(screenInfo.availTop)||0)+Math.max(0,ah-height-100);
 return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,noopener`;
}
function researchPanel(s){return `<div class="reference-action"><a class="minkabu-small" data-minkabu="${s.symbol}" href="https://us.minkabu.jp/stocks/${s.symbol}/researches#:~:text=${encodeURIComponent('目標株価')}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.name)}のみんかぶを小窓で開く" title="${esc(s.name)}のみんかぶを小窓で開く">みんかぶ</a><span class="popup-note" role="status"></span></div>`;}
function highPanels(s,period){
 const h=s.highs||{},p=s.price||{},price=p.value,selected=periodHigh(p,period),label=PERIODS.find(([key])=>key===period)?.[1]||'6カ月';
 return '<div class="stock-highs">'+[['period',label+'最高値'],['allTime',h.allTime?.complete?'上場来最高値':'取得期間内最高値']].map(([key,title])=>{
  const item=key==='period'?selected:h[key]||{},source=key==='period'?p:h;
  const ratio=Number.isFinite(price)&&Number.isFinite(item.value)&&item.value>0?price/item.value*100:null,drop=ratio===null?null:ratio-100;
  const basis=key==='period'?(item.value==null?'期間内の高値データを取得待ち':(['1d','1w'].includes(period)?'通常取引の5分足高値':'通常取引の日足高値')+'<br>表示期間 '+esc(item.start)+'〜'+esc(item.end)):'通常取引の日足高値'+(!item.complete?'<br>上場時からの全履歴は未確認':'');
  return `<section class="stock-high" data-high-kind="${key}" ${key==='period'?`data-high-period="${period}"`:''}><h3>${title}</h3><p class="high-caption">現在株価 / 最高値</p><p class="high-percent">${num(ratio,1)}<small>%</small></p><div class="high-meter" aria-hidden="true"><span style="width:${ratio===null?0:Math.max(0,Math.min(100,ratio))}%"></span></div><p class="high-price">最高値 <strong>${num(item.value)}</strong> USD</p><p class="high-drop">最高値から ${signed(drop)}%</p><p class="source-note">記録日 ${esc(item.date||'—')}<br>${item.value==null?'':stale(source)?'前回保存値 · ':''}${item.value!=null?'取得 '+stamp(source.lastSuccess)+'<br>':''}${basis}</p></section>`;
 }).join('')+'<p class="source-note high-basis">Yahoo Finance · 上段はグラフの期間切り替えと連動<br>上場来高値の取得期間 '+esc(h.historyStart||'—')+'〜'+esc(h.asOfDate||'—')+'</p></div>';
}

function alertState(s,period=ranges.get(s.symbol)||'6m'){
 return stockAlerts(s,period,{generatedAt:data.generatedAt,offline});
}
function hitText(hit){return hit.label+'最高値の'+hit.threshold+'％未満（現在'+num(hit.ratio,1)+'％）';}
function alertNotice(s,state){
 if(!state.hits.length)return '';
 const details=state.hits.map(hit=>hit.key==='allTime'
  ?'<span class="stock-alert-chip">'+esc(hitText(hit))+'</span>'
  :'<button type="button" data-symbol="'+esc(s.symbol)+'" data-alert-period="'+hit.key+'" aria-label="'+esc(hitText(hit))+'のグラフを表示">'+esc(hitText(hit))+' ↗</button>').join('');
 return '<div class="stock-alert-notice"><strong>'+ (state.active?'指定条件に到達':'別の期間で指定条件に到達')+'</strong><p>'+(state.active?'上場来または表示中の期間が条件に該当しています。':'該当する期間のグラフが隠れています。下の期間ボタンで表示できます。')+'</p><div class="stock-alert-chips">'+details+'</div></div>';
}
function renderStockOverview(){
 const overview=document.querySelector('#stock-overview');
 const states=data.stocks.map(s=>({s,state:alertState(s)}));
 const reached=states.filter(({state})=>state.hits.length);
 const pending=states.filter(({state})=>state.unchecked.length).length;
 overview.classList.toggle('is-alert',reached.length>0);
 document.querySelector('#stock-alert-title').textContent=reached.length?'🔴 指定条件に到達 · '+reached.length+'銘柄':pending?'判定できた範囲では指定条件への到達なし':'指定条件への到達なし';
 document.querySelector('#stock-alert-detail').textContent='最高値の80％・70％・60％・50％未満を判定。濃い黄色＝上場来または表示中の期間、薄い黄色＝別の期間に到達。'+(pending?' '+pending+'銘柄は一部または全条件の判定を保留しています。':'');
 document.querySelector('#stock-alert-list').innerHTML=reached.map(({s,state})=>'<a class="stock-alert-summary" href="#stock-'+esc(s.symbol)+'"><strong>'+esc(s.name)+'（'+esc(s.symbol)+'）</strong><span>'+state.hits.map(hit=>esc(hitText(hit))).join(' ／ ')+'</span></a>').join('');
}

function tile(s){
  const p=s.price||{},j=s.japan||{},old=stale(p),jold=stale(j),period=ranges.get(s.symbol)||'6m';
  const alerts=alertState(s,period);
  const dir=Number.isFinite(p.change)?p.change>0?'up':p.change<0?'down':'neutral':'neutral';
  const ratios=['per','pbr'].map(k=>{const r=j.ratios?.[k]||{};return `<div class="ratio"><dt>${k.toUpperCase()}（実績）</dt><dd>${num(r.value)}<small>${Number.isFinite(r.value)?'倍':'公表値なし'}</small></dd><small>公表 ${esc(r.sourceDate||'—')}</small></div>`;}).join('');
  return `<article id="stock-${s.symbol}" class="stock-tile ${alerts.active?'stock-alert-active':alerts.hits.length?'stock-alert-hidden':''}" data-symbol="${s.symbol}" aria-label="${esc(s.name)}"><div class="tile-heading"><div><h2>${esc(s.name)}</h2><span class="ticker">${s.symbol} · 米国株 / USD</span></div><div class="tile-links"><a href="${esc(s.quoteUrl)}" target="_blank" rel="noopener noreferrer">Yahoo! 株価 ↗</a></div></div>${alertNotice(s,alerts)}<div class="tile-body"><div class="reading"><div class="price-section"><div class="price-box ${dir}"><span class="price">${valuePair(p,num)}</span><span class="currency">USD</span></div><p class="change ${dir}"><span class="change-amount">${dir==='up'?'↑':dir==='down'?'↓':'→'} ${signed(p.change)}</span><span class="change-pct">(${signed(p.changePct)}%)</span></p><p class="price-label">${p.marketOpen?'通常取引中（遅延あり）':'前日終値（直近通常取引）'}${p.value==null?' · 未取得':''}</p><p class="data-date">米国取引日 ${esc(p.sessionDate||'—')} ／ 取得 ${stamp(p.lastSuccess)}</p><span class="badge ${old?'warning':''}">${old?'前回保存値・更新確認が必要':'取得成功'}${offline?' · 通信できません':''}</span></div>${highPanels(s,period)}</div><div class="chart-section"><div class="chart-header"><h3>株価の推移</h3><div class="periods" role="group" aria-label="${s.symbol}のチャート期間">${PERIODS.map(([key,label])=>{const hit=alerts.hits.find(h=>h.key===key);return `<button data-symbol="${s.symbol}" data-period="${key}" class="${hit?'period-hit':''}" aria-pressed="${key===period}" ${hit?`title="${esc(hitText(hit))}"`:''}>${label}${hit?`<small>${hit.threshold}％未満</small>`:''}</button>`;}).join('')}</div></div>${graph(s,period)}${old?'<p class="chart-note">取得失敗または古い保存データです。日時を確認してください。</p>':''}<div class="chart-details" aria-label="PER・PBRと目標株価・アナリスト評価"><dl class="ratios">${ratios}</dl><div class="analysis-container">${analystPanel(s,stamp,offline)}</div></div>${researchPanel(s)}</div></div></article>`;
}
function render(){if(!data)return;document.querySelector('#watchlist-title').textContent='いつもの'+data.stocks.length+'銘柄';container.innerHTML=data.stocks.map(tile).join('');renderStockOverview();const good=data.stocks.filter(s=>!stale(s.price)).length;status.textContent=`${offline?'通信できません · ':''}取得処理 ${stamp(data.generatedAt)} · 株価 ${good}/${data.stocks.length} 銘柄 · 自動取得15分ごとの予定（遅延あり）`;}
async function load(){
  if(loading)return;loading=true;refresh.disabled=true;
  try{const response=await fetch(`./data/stocks.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw Error('data');const next=await response.json();if(!Array.isArray(next.stocks)||next.stocks.length<12)throw Error('schema');data=next;offline=false;try{localStorage.setItem('morning-stocks-v1',JSON.stringify(data));}catch{}render();}
  catch{offline=true;if(!data){try{data=JSON.parse(localStorage.getItem('morning-stocks-v1'));}catch{}}if(data)render();else status.textContent='データを取得できませんでした。「更新を確認」で再読み込みしてください。';}
  finally{loading=false;refresh.disabled=false;}
}
container.addEventListener('click',e=>{const reference=e.target.closest('[data-minkabu]');if(reference){e.preventDefault();const note=reference.parentElement.querySelector('.popup-note');try{window.open(reference.href,'_blank',popupFeatures(window.screen));note.textContent='開かない場合は、通常リンクを使用してください。';const fallback=document.createElement('a');fallback.href=reference.href;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='通常リンク ↗';note.append(' ',fallback);}catch{note.textContent='小窓を開けませんでした。';const fallback=document.createElement('a');fallback.href=reference.href;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='通常リンク ↗';note.append(' ',fallback);}return;}const button=e.target.closest('[data-period],[data-alert-period]');if(!button)return;const period=button.dataset.period||button.dataset.alertPeriod;ranges.set(button.dataset.symbol,period);const stock=data.stocks.find(s=>s.symbol===button.dataset.symbol);button.closest('.stock-tile').outerHTML=tile(stock);renderStockOverview();container.querySelector(`[data-symbol="${stock.symbol}"][data-period="${period}"]`)?.focus({preventScroll:true});});
container.addEventListener('pointermove',e=>{const svg=e.target.closest('svg[data-chart]');if(!svg||!data)return;const stock=data.stocks.find(s=>s.symbol===svg.dataset.chart);const pts=chartPoints(stock.price,ranges.get(stock.symbol)||'6m');const rect=svg.getBoundingClientRect();const pos=(e.clientX-rect.left)/rect.width*720;const index=Math.max(0,Math.min(pts.length-1,Math.round((pos-84)/(704-84)*(pts.length-1))));const point=pts[index];if(!point)return;const time=new Intl.DateTimeFormat('ja-JP',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(point.time*1000));svg.closest('.chart-section').querySelector('.chart-hover').textContent=`${time} 米国東部時間 · ${num(point.value)} USD · 25日線 ${num(point.ma25)} · 75日線 ${num(point.ma75)} · 出来高 ${Number.isFinite(point.volume)?num(point.volume,0)+'株':'未取得'}`;});
refresh.addEventListener('click',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});setInterval(()=>{if(!document.hidden)load();},5*60e3);load();


watchValuePairs(container);

function updateToday(){ document.querySelector('#today').textContent=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date()); }
updateToday();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateToday();});
setInterval(()=>{if(!document.hidden)updateToday();},60000);
