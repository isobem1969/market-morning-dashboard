import {valuePair,watchValuePairs} from './value-pair.js?v=previous-20261008';
import {PERIODS,chartPoints,nyDate,sectionOld} from './stocks-logic.js?v=averages-20261007';
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
function graph(stock,period){
  const pts=chartPoints(stock.price||{},period);
  if(!pts.length)return '<div class="empty">この期間のチャートを取得できていません。</div>';
  const w=720,h=360,left=84,right=704,top=18,bottom=252,volumeTop=274,volumeBottom=324;
  const prices=pts.map(p=>p.value),values=pts.flatMap(p=>[p.value,p.ma25,p.ma75]).filter(Number.isFinite);
  const min=Math.min(...prices),max=Math.max(...prices),low=Math.min(...values),high=Math.max(...values),pad=Math.max((high-low)*.12,high*.002);
  const lo=Math.max(0,low-pad),hi=high+pad;
  const x=i=>left+(right-left)*i/Math.max(1,pts.length-1),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  const path=key=>{let pen=false;return pts.map((p,i)=>{if(!Number.isFinite(p[key])){pen=false;return '';}const cmd=pen?'L':'M';pen=true;return `${cmd}${x(i).toFixed(2)},${y(p[key]).toFixed(2)}`;}).join(' ');};
  const line=path('value'),ma25=path('ma25'),ma75=path('ma75');
  const grid=Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*i/4,yy=y(v);return `<line x1="${left}" y1="${yy}" x2="${right}" y2="${yy}" stroke="#e4e9ec"/><text x="${left-10}" y="${yy+4}" text-anchor="end">${num(v)}</text>`;}).join('');
  const labels=[...new Set([0,Math.round((pts.length-1)/3),Math.round((pts.length-1)*2/3),pts.length-1])].map(i=>{const t=pts[i].time;const label=period==='1d'?new Intl.DateTimeFormat('ja-JP',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t*1000)):nyDate(t).slice(2).replaceAll('-','/');return `<text x="${x(i)}" y="352" text-anchor="${i===0?'start':i===pts.length-1?'end':'middle'}">${label}</text>`;}).join('');
  const volumes=pts.map(p=>p.volume).filter(v=>Number.isFinite(v)&&v>=0),vmax=Math.max(1,...volumes),barWidth=Math.max(.7,Math.min(9,(right-left)/pts.length*.7));
  const bars=pts.map((p,i)=>Number.isFinite(p.volume)&&p.volume>=0?`<rect x="${x(i)-barWidth/2}" y="${volumeBottom-p.volume/vmax*(volumeBottom-volumeTop)}" width="${barWidth}" height="${p.volume/vmax*(volumeBottom-volumeTop)}" fill="#5797e4"/>`:'').join('');
  const id=`fill-${stock.symbol}`,color='#15536b',last=pts.at(-1);
  const legend=`<div class="chart-legend"><span class="legend-price">株価 <strong>${num(last.value)}</strong></span><span class="legend-ma25">25日線 <strong>${num(last.ma25)}</strong></span><span class="legend-ma75">75日線 <strong>${num(last.ma75)}</strong></span></div>`;
  return `${legend}<div class="chart-wrap"><svg class="stock-chart" data-chart="${stock.symbol}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(stock.name)} ${PERIODS.find(p=>p[0]===period)[1]}の株価、25日・75日移動平均、出来高"><title>${esc(stock.name)} 最低 ${num(min)} USD、最高 ${num(max)} USD</title><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".35"/><stop offset="100%" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>${grid}<path d="${line} L${x(pts.length-1)},${bottom} L${left},${bottom} Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/><path data-ma="25" d="${ma25}" fill="none" stroke="#ee303b" stroke-width="2.6"/><path data-ma="75" d="${ma75}" fill="none" stroke="#3168ff" stroke-width="2.6"/><circle cx="${x(pts.length-1)}" cy="${y(last.value)}" r="4" fill="${color}"/><text x="${left-10}" y="294" text-anchor="end">出来高</text>${bars}<line x1="${left}" y1="${volumeBottom}" x2="${right}" y2="${volumeBottom}" stroke="#dfe6ec"/>${labels}</svg></div><div class="chart-footer"><span>${nyDate(pts[0].time).replaceAll('-','/')}〜${nyDate(last.time).replaceAll('-','/')} · ${pts.length}点</span><span>最低 <strong>${num(min)}</strong> ／ 最高 <strong>${num(max)}</strong></span></div><p class="chart-hover" aria-live="off">グラフに触れると株価・移動平均・出来高を表示</p><p class="chart-note">${['1d','1w'].includes(period)?'通常取引の5分足。25・75日線は前取引日までの終値で計算。':'25・75日線は各25・75取引日の終値の単純平均。最新取引日は取引中の値を含みます。'}日数不足は線を表示しません。${volumes.length<pts.length?'出来高の未取得部分は表示しません。':''}休場の間隔を詰めて表示。出典：Yahoo Finance。<a href="https://us.minkabu.jp/stocks/${stock.symbol}" target="_blank" rel="noopener noreferrer">みんかぶでチャートを見る ↗</a></p>`;
}
function highPanels(s){
 const h=s.highs||{},price=s.price?.value;
 return '<div class="stock-highs">'+[['week52','52週最高値'],['allTime',h.allTime?.complete?'上場来最高値':'取得期間内最高値']].map(([key,label])=>{
  const item=h[key]||{},ratio=Number.isFinite(price)&&Number.isFinite(item.value)&&item.value>0?price/item.value*100:null;
  const drop=ratio===null?null:ratio-100;
  return `<section class="stock-high"><h3>${label}</h3><p class="high-caption">現在株価 / 最高値</p><p class="high-percent">${num(ratio,1)}<small>%</small></p><div class="high-meter" aria-hidden="true"><span style="width:${ratio===null?0:Math.max(0,Math.min(100,ratio))}%"></span></div><p class="high-price">最高値 <strong>${num(item.value)}</strong> USD</p><p class="high-drop">最高値から ${signed(drop)}%</p><p class="source-note">記録日 ${esc(item.date||'—')}<br>${item.value==null?'取得待ち':stale(h)?'前回保存値 · ':''}${item.value!=null?'取得 '+stamp(h.lastSuccess):''}${key==='allTime'&&!item.complete?'<br>上場時からの全履歴は未確認':''}</p></section>`;
 }).join('')+'<p class="source-note high-basis">通常取引の日足高値 · Yahoo Finance<br>取得期間 '+esc(h.historyStart||'—')+'〜'+esc(h.asOfDate||'—')+'</p></div>';
}
function tile(s){
  const p=s.price||{},j=s.japan||{},old=stale(p),jold=stale(j),period=ranges.get(s.symbol)||'6m';
  const dir=Number.isFinite(p.change)?p.change>0?'up':p.change<0?'down':'neutral':'neutral';
  const sentiments=j.sentiment;
  const ratios=['per','pbr'].map(k=>{const r=j.ratios?.[k]||{};return `<div class="ratio"><dt>${k.toUpperCase()}（実績）</dt><dd>${num(r.value)}<small>${Number.isFinite(r.value)?'倍':'公表値なし'}</small></dd><small>公表 ${esc(r.sourceDate||'—')}</small></div>`;}).join('');
  let gauge=sentiments?`<div class="sentiment-labels"><span class="buy-label">買いたい ${num(sentiments.buy,1)}%</span><span class="sell-label">売りたい ${num(sentiments.sell,1)}%</span></div><div class="gauge" role="img" aria-label="買いたい${num(sentiments.buy,1)}%、様子見${num(sentiments.hold,1)}%、売りたい${num(sentiments.sell,1)}%"><span class="buy" style="width:${sentiments.buy}%"></span><span class="hold" style="width:${sentiments.hold}%"></span><span class="sell" style="width:${sentiments.sell}%"></span></div><p class="hold-label">様子見 ${num(sentiments.hold,1)}%</p>`:'<p class="source-note">データなし（投稿なし・未取得）</p><div class="gauge" role="img" aria-label="掲示板評価のデータなし"></div>';
  return `<article class="stock-tile" data-symbol="${s.symbol}" aria-label="${esc(s.name)}"><div class="tile-heading"><div><h2>${esc(s.name)}</h2><span class="ticker">${s.symbol} · 米国株 / USD</span></div><div class="tile-links"><a href="${esc(s.quoteUrl)}" target="_blank" rel="noopener noreferrer">Yahoo! 株価 ↗</a><a href="${esc(s.forumUrl)}" target="_blank" rel="noopener noreferrer">掲示板 ↗</a></div></div><div class="tile-body"><div class="reading"><div class="price-section"><div class="price-box ${dir}"><span class="price">${valuePair(p,num)}</span><span class="currency">USD</span></div><p class="change ${dir}"><span class="change-amount">${dir==='up'?'↑':dir==='down'?'↓':'→'} ${signed(p.change)}</span><span class="change-pct">(${signed(p.changePct)}%)</span></p><p class="price-label">${p.marketOpen?'通常取引中（遅延あり）':'前日終値（直近通常取引）'}${p.value==null?' · 未取得':''}</p><p class="data-date">米国取引日 ${esc(p.sessionDate||'—')} ／ 取得 ${stamp(p.lastSuccess)}</p><span class="badge ${old?'warning':''}">${old?'前回保存値・更新確認が必要':'取得成功'}${offline?' · 通信できません':''}</span></div>${highPanels(s)}</div><div class="chart-section"><div class="chart-header"><h3>株価の推移</h3><div class="periods" role="group" aria-label="${s.symbol}のチャート期間">${PERIODS.map(([key,label])=>`<button data-symbol="${s.symbol}" data-period="${key}" aria-pressed="${key===period}">${label}</button>`).join('')}</div></div>${graph(s,period)}${old?'<p class="chart-note">取得失敗または古い保存データです。日時を確認してください。</p>':''}<div class="chart-details" aria-label="PER・PBRと掲示板評価"><dl class="ratios">${ratios}</dl><div class="sentiment"><h3 class="sentiment-title">掲示板「みんなの評価」</h3>${gauge}<p class="source-note">直近1週間の投稿時の感情 · ${jold?'前回保存値 / ':''}取得 ${stamp(j.lastSuccess)}<br>PER・PBR／掲示板：Yahoo!ファイナンス</p></div></div>${researchPanel(s)}</div></div></article>`;
}
function render(){if(!data)return;container.innerHTML=data.stocks.map(tile).join('');const good=data.stocks.filter(s=>!stale(s.price)).length;status.textContent=`${offline?'通信できません · ':''}取得処理 ${stamp(data.generatedAt)} · 株価 ${good}/12 銘柄 · 自動取得15分ごとの予定（遅延あり）`;}
async function load(){
  if(loading)return;loading=true;refresh.disabled=true;
  try{const response=await fetch(`./data/stocks.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw Error('data');const next=await response.json();if(!Array.isArray(next.stocks)||next.stocks.length!==12)throw Error('schema');data=next;offline=false;try{localStorage.setItem('morning-stocks-v1',JSON.stringify(data));}catch{}render();}
  catch{offline=true;if(!data){try{data=JSON.parse(localStorage.getItem('morning-stocks-v1'));}catch{}}if(data)render();else status.textContent='データを取得できませんでした。「更新を確認」で再読み込みしてください。';}
  finally{loading=false;refresh.disabled=false;}
}
container.addEventListener('click',e=>{const reference=e.target.closest('[data-minkabu]');if(reference){e.preventDefault();const note=reference.parentElement.querySelector('.popup-note');try{window.open(reference.href,'_blank',popupFeatures(window.screen));note.textContent='開かない場合は、通常リンクを使用してください。';const fallback=document.createElement('a');fallback.href=reference.href;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='通常リンク ↗';note.append(' ',fallback);}catch{note.textContent='小窓を開けませんでした。';const fallback=document.createElement('a');fallback.href=reference.href;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='通常リンク ↗';note.append(' ',fallback);}return;}const button=e.target.closest('[data-period]');if(!button)return;ranges.set(button.dataset.symbol,button.dataset.period);const stock=data.stocks.find(s=>s.symbol===button.dataset.symbol);button.closest('.stock-tile').outerHTML=tile(stock);container.querySelector(`[data-symbol="${stock.symbol}"][data-period="${button.dataset.period}"]`)?.focus({preventScroll:true});});
container.addEventListener('pointermove',e=>{const svg=e.target.closest('svg[data-chart]');if(!svg||!data)return;const stock=data.stocks.find(s=>s.symbol===svg.dataset.chart);const pts=chartPoints(stock.price,ranges.get(stock.symbol)||'6m');const rect=svg.getBoundingClientRect();const pos=(e.clientX-rect.left)/rect.width*720;const index=Math.max(0,Math.min(pts.length-1,Math.round((pos-84)/(704-84)*(pts.length-1))));const point=pts[index];if(!point)return;const time=new Intl.DateTimeFormat('ja-JP',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(point.time*1000));svg.closest('.chart-section').querySelector('.chart-hover').textContent=`${time} 米国東部時間 · ${num(point.value)} USD · 25日線 ${num(point.ma25)} · 75日線 ${num(point.ma75)} · 出来高 ${Number.isFinite(point.volume)?num(point.volume,0)+'株':'未取得'}`;});
refresh.addEventListener('click',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});setInterval(()=>{if(!document.hidden)load();},5*60e3);load();


watchValuePairs(container);

function updateToday(){ document.querySelector('#today').textContent=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date()); }
updateToday();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateToday();});
setInterval(()=>{if(!document.hidden)updateToday();},60000);
