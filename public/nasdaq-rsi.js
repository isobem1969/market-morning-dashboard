import {readSnapshot,restoreSnapshot,updateSnapshot,prefetchOtherPages} from './shared-data.js?v=nasdaq-rsi-20261113';
const $=id=>document.getElementById(id),fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,period=104,usable=false;
$('today').textContent=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
export function rsiState(current,previous){
 if(current<40)return {label:previous<40&&current<previous?'40未満・低下継続':'40未満・検討開始／継続',kind:'buy'};
 if(previous<40&&current>=40)return {label:'40以上へ回復',kind:'normal'};
 if(current>75)return {label:previous>75&&current>previous?'75超・上昇継続':'75超・売り検討',kind:'sell'};
 if(previous>75&&current<=75)return {label:'75以下へ戻る',kind:'normal'};
 if(current>=70)return {label:'75に接近・売り準備',kind:'sell'};
 return {label:'通常・条件到達を待つ',kind:'normal'};
}
function watch(key){
 const buy=key==='buy',record=data[key],run=record.current||record.last,active=!!record.current;
 const thresholds=buy?['40未満：検討開始','35未満：さらに低下','30未満：大幅低下']:['70以上：75に接近','75超：売り検討','80超・85超：高水準'];
 return `<section class="watch ${buy?'':'sell'} ${active&&usable?'active':''}"><h3>${buy?'40近辺｜買い検討':'75近辺｜売り検討'}</h3><strong>${!usable?'判定保留':active?'条件が継続中':'現在は条件外'}</strong><p>${run?`${active?'今回':'直近'}の開始日：<b>${esc(run.start)}</b><br>確定週数：<b>${run.weeks}週</b>${run.end?` ／ 終了：${esc(run.end)}`:''}`:'取得履歴に該当する週はありません。'}</p><div class="bands">${thresholds.map(t=>`<span>${t}</span>`).join('')}</div><p><small>週足確定時の厳密な ${buy?'RSI &lt; 40':'RSI &gt; 75'} で記録。${active?'':'表示履歴は終了済みの条件です。'}</small></p></section>`;
}
function price(key,name,symbol){
 const target={ndx:'nasdaq',tqqq:'tqqq',soxl:'soxl'}[key],heading=`<h2><a class="indicator-panel-link" href="./#metric-${target}"><span>${name} <span aria-hidden="true">→</span></span><small>朝の指標のパネルへ移動</small></a></h2>`;
 const p=data.prices[key];if(!p)return `<section class="panel">${heading}<p>最新データを確認しています。「更新を確認」で再取得できます。</p></section>`;const change=p.value-p.previous,cls=change>0?'positive':change<0?'negative':'';
 return `<section class="panel"><div class="price-title">${heading}<a href="https://finance.yahoo.com/quote/${symbol}/" target="_blank" rel="noopener">取得元 ↗</a></div><div class="quote-row"><span class="previous">${fmt(p.previous,2)}</span><span class="arrow">→</span><strong class="quote ${cls}">${fmt(p.value,2)}</strong></div><p class="caption">${esc(p.asOf)} 米国日付 ／ ${p.marketOpen?'通常取引中・遅延あり':'直近通常取引の終値'} ／ ${key==='ndx'?'ポイント':'USD'}</p><div class="price-details"><div><small>最高終値に対する割合</small><strong>${fmt(p.ratio)}%</strong></div><div><small>最高終値からの下落率</small><strong class="negative">${fmt(p.drawdown)}%</strong></div></div><div class="peak">最高終値 ${fmt(p.peak,2)}</div><p class="caption">取得期間：${esc(p.historyStart)}〜${esc(p.asOf)}<br>日中高値ではなく、取得期間の最高終値が基準です。</p></section>`;
}
function drawChart(){
 const rows=data.history.slice(-period),provisional=data.provisional;
 const W=window.innerWidth<650?600:1100,H=385,L=54,R=54,T=20,B=44,w=W-L-R,h=H-T-B;
 const count=rows.length+(provisional?1:0),x=i=>L+i/Math.max(1,count-1)*w,y=v=>T+(100-v)/100*h;
 let svg=`<svg class="rsi-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="NASDAQ100の週足RSI。水平線30、35、40、75、80、85。"><rect x="${L}" y="${y(40)}" width="${w}" height="${y(0)-y(40)}" fill="#fff8e7"/><rect x="${L}" y="${y(100)}" width="${w}" height="${y(75)-y(100)}" fill="#effaf3"/>`;
 for(const v of [0,20,40,60,80,100])svg+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e9ed"/><text x="${L-10}" y="${y(v)+5}" text-anchor="end" fill="#536875" font-size="15">${v}</text>`;
 for(const v of [30,35,40,75,80,85])svg+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="${v<50?'#e08309':'#239464'}" stroke-width="${[40,75].includes(v)?2:1.4}" ${[40,75].includes(v)?'':'stroke-dasharray="5 4"'}/><text x="${W-R+8}" y="${y(v)+5}" fill="${v<50?'#a65c00':'#187345'}" font-size="15" font-weight="700">${v}</text>`;
 svg+=`<polyline fill="none" stroke="#173e65" stroke-width="3" points="${rows.map((r,i)=>`${x(i)},${y(r.rsi)}`).join(' ')}"/>`;
 const end=rows.at(-1);svg+=`<circle cx="${x(rows.length-1)}" cy="${y(end.rsi)}" r="5" fill="#173e65"><title>${esc(end.date)} 確定RSI ${fmt(end.rsi)}</title></circle>`;
 if(provisional)svg+=`<line x1="${x(rows.length-1)}" y1="${y(end.rsi)}" x2="${x(rows.length)}" y2="${y(provisional.rsi)}" stroke="#e18719" stroke-width="2.5" stroke-dasharray="6 5"/><circle cx="${x(rows.length)}" cy="${y(provisional.rsi)}" r="5" fill="#e18719"><title>未確定 ${fmt(provisional.rsi)}</title></circle>`;
 for(let i=0;i<=4;i++){const n=Math.round((rows.length-1)*i/4);svg+=`<text x="${x(n)}" y="${H-14}" text-anchor="${i===0?'start':i===4?'end':'middle'}" fill="#536875" font-size="15">${rows[n].date}</text>`;}
 svg+='<line id="rsi-crosshair" y1="20" y2="341" stroke="#778994" stroke-dasharray="4 4" visibility="hidden"/></svg>';
 $('rsi-chart').innerHTML=svg;
 const el=$('rsi-chart').querySelector('svg');el.addEventListener('pointermove',e=>{const rect=el.getBoundingClientRect(),pos=(e.clientX-rect.left)/rect.width*W,n=Math.max(0,Math.min(count-1,Math.round((pos-L)/w*(count-1)))),p=rows[n]||provisional,line=$('rsi-crosshair');line.setAttribute('x1',x(n));line.setAttribute('x2',x(n));line.setAttribute('visibility','visible');$('chart-info').textContent=`${p.date} ｜ RSI ${fmt(p.rsi,2)}${n>=rows.length?'（未確定）':'（確定）'}`;});
 document.querySelectorAll('[data-weeks]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.weeks)===period)));
}
function render(next){
 data=next;
 const serverAge=Date.now()-Date.parse(data.generatedAt),priceAge=Date.now()-Date.parse(data.prices.ndx.asOf+'T21:00:00Z');
 usable=Number.isFinite(data.prices.soxl?.value)&&data.status==='ok'&&serverAge<30*3600000&&priceAge<5*86400000;
 const state=rsiState(data.confirmed.rsi,data.previous.rsi),delta=data.confirmed.rsi-data.previous.rsi,p=data.provisional;
 const updated=new Date(data.generatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
 $('rsi-status').textContent=`サーバー更新：${updated}（日本時間）｜ ${data.source}`;
 $('rsi-content').className=usable?'rsi-ready':'';
 $('rsi-content').innerHTML=`${usable?'':`<div class="warning">保存済みデータを表示しています。取得失敗またはデータが古いため、現在の条件判定は保留です。<br>最終取得：${updated}（日本時間）</div>`}<div class="hero-grid"><section class="panel hero ${usable?state.kind:''}"><h2>確定した週足RSI（14週）</h2><div class="rsi-asof">確定週の最終取引日：${data.confirmed.date}（米国）</div><div class="value-box"><div class="value-row"><span class="previous">${fmt(data.previous.rsi)}</span><span class="arrow">→</span><strong class="rsi-value">${fmt(data.confirmed.rsi)}</strong></div><div class="delta ${delta>0?'positive':delta<0?'negative':''}">${delta>0?'▲ +':delta<0?'▼ ':''}${fmt(delta)} <small>前週比</small></div></div><span class="status-badge ${state.kind}">${usable?state.label:'判定保留'}</span><p class="caption">前週 ${data.previous.date} → 最新確定週 ${data.confirmed.date}</p></section><section class="panel"><h2>今週の暫定RSI <span class="unconfirmed">未確定</span></h2><div class="provisional-value">${p?fmt(p.rsi):'—'}</div><p class="caption">${p?`${p.date}までの通常取引価格から算出。<br>確定RSIとの差：${fmt(p.rsi-data.confirmed.rsi)}ポイント。`:'表示する暫定値はありません。確定した値は「確定した週足RSI」を確認してください。'}</p><p class="caption">今週の最終取引が終了するまでは変わります。<br>開始日・継続週数の判定には使用しません。</p></section></div><section class="panel"><div class="chart-heading"><h2>週足RSIの推移</h2><div class="periods">${[[52,'1年'],[104,'2年'],[260,'5年'],[520,'10年']].map(([v,t])=>`<button data-weeks="${v}" aria-pressed="${v===period}">${t}</button>`).join('')}</div></div><div class="chart-wrap" id="rsi-chart"></div><div class="chart-info" id="chart-info">グラフを指で触れる／マウスを重ねると日付とRSIを確認できます。</div><p class="caption">濃紺：確定値 ／ オレンジの点線：今週の未確定値。40・35・30、75・80・85の水平線を表示。</p></section><div class="watch-grid">${watch('buy')}${watch('sell')}</div><div class="price-grid">${price('ndx','NASDAQ100','%5ENDX')}${price('tqqq','TQQQ','TQQQ')}${price('soxl','SOXL','SOXL')}</div>`;
 document.querySelectorAll('[data-weeks]').forEach(b=>b.addEventListener('click',()=>{period=Number(b.dataset.weeks);drawChart();}));drawChart();
 if(!usable)(window.__morningPreloadState||={}).rsi='再確認が必要';
}
async function refresh(){
 $('rsi-status').textContent='最新の保存データを確認しています…';
 try{render(await updateSnapshot('rsi'));}catch{(window.__morningPreloadState||={}).rsi='再確認が必要';$('rsi-status').textContent='更新を確認できませんでした。保存値がある場合はその日時の値です。';if(data){data={...data,status:'error'};render(data);}}
}
const saved=readSnapshot('rsi');if(saved)render(saved);else restoreSnapshot('rsi').then(v=>{if(v&&!data)render(v);});
void refresh();void prefetchOtherPages('rsi');$('refresh').addEventListener('click',refresh);
let lastResume=0;document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastResume>60000){lastResume=Date.now();void refresh();}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

