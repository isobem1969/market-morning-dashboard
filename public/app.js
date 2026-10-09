import {valuePair,watchValuePairs} from './value-pair.js?v=green-arrow-20261008';
import {changePercent,percentLine} from './change-format.js?v=twoline-20261007';
import {marketChart,marketHover,selectMarketHistory} from './market-panel.js?v=ranges-20261007';
import {fundCard,fundHover,openFundReference} from './fund-panel.js?v=period-high-20261009';
import {viCard} from './vi-panel.js?v=green-arrow-20261008';
import {fearCard} from './fear-panel.js?v=green-arrow-20261008';
import {quality,signal,overall,VIX_BANDS,vixBand,selectVixHistory} from './logic.js?v=vix-20261006';
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={usd:'¥',vix:'V',fear:'FG',vi:'VI',brent:'B',sox:'S',fang:'F+',nasdaq:'N'};
const descriptions={usd:'為替 · 1ドルあたりの円',vix:'米国株の予想変動幅',fear:'米国市場の恐怖・欲望',vi:'日経平均の予想変動幅',brent:'ブレント期近先物',sox:'29314233 · 米国半導体',fang:'04311181 · 米国大型成長株',nasdaq:'89311265 · NASDAQ100'};
const store={get(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}};
const fundRanges=new Map(),marketRanges=new Map();
let drawdowns=store.get('market-morning-drawdowns')||{},data=null,vixMonths=12,fearMonths=12,viMonths=12,offline=false,loading=false;
function format(value,id){return Number.isFinite(value)?value.toLocaleString('ja-JP',{minimumFractionDigits:['usd','vix','vi','brent'].includes(id)?2:0,maximumFractionDigits:['sox','fang','nasdaq'].includes(id)?0:2}):'—';}
function datetime(value){if(!value)return'未取得';const d=new Date(value.length===10?value+'T00:00:00+09:00':value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ja-JP',{month:'2-digit',day:'2-digit',...(value.length>10?{hour:'2-digit',minute:'2-digit'}:{}),timeZone:'Asia/Tokyo'}).format(d)+(value.length>10?' JST':''): '日時不明';}
function metrics(){
  if(!data)return [];
  const manual=store.get('market-morning-manual');
  return data.metrics.map(original=>{
    const m={...original,drawdown:drawdowns[original.id]};
    if(m.id!=='fear'||!manual||!Number.isFinite(manual.value)||manual.value<0||manual.value>100)return m;
    if(m.status==='ok'&&m.asOf&&m.asOf.slice(0,10)>=manual.asOf)return m;
    return {...m,value:manual.value,asOf:manual.asOf,status:'manual',kind:'CNN確認・手入力',history:[{date:manual.asOf,value:manual.value}],change:null,changePct:null};
  });
}
function vixChart(points){
  if(points.length<2)return '<div class="vix-chart-empty">推移データを取得できていません</div>';
  const values=points.map(p=>p.value),low=Math.min(...values),high=Math.max(...values);
  const floor=Math.max(0,Math.floor(Math.min(10,low-2)/5)*5),ceiling=Math.max(45,Math.ceil((high+3)/5)*5);
  const start=Date.parse(points[0].date),end=Date.parse(points.at(-1).date);
  const x=p=>44+(Date.parse(p.date)-start)/(end-start)*578,y=v=>250-(v-floor)/(ceiling-floor)*220;
  const line=points.map(p=>`${x(p).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  const bands=VIX_BANDS.map(b=>{
    const min=Math.max(floor,b.min),max=Math.min(ceiling,b.max);
    return max>min?`<rect x="44" y="${y(max)}" width="578" height="${y(min)-y(max)}" fill="${b.color}" opacity=".055"/>`:'';
  }).join('');
  let grid='';
  for(let v=floor;v<=ceiling;v+=5)grid+=`<line x1="44" x2="622" y1="${y(v)}" y2="${y(v)}" stroke="#dce3e3" stroke-dasharray="3 4"/><text x="34" y="${y(v)+4}" text-anchor="end">${v}</text>`;
  const ticks=Array.from({length:4},(_,i)=>points[Math.round(i*(points.length-1)/3)]);
  const labels=ticks.map((p,i)=>`<text x="${x(p)}" y="278" text-anchor="${i===0?'start':i===3?'end':'middle'}">${p.date.slice(2).replaceAll('-','/')}</text>`).join('');
  const last=points.at(-1);
  return `<svg class="vix-chart" viewBox="0 0 640 290" role="img" aria-label="VIXの日次終値 ${points[0].date}から${last.date}。最低${low.toFixed(2)}、最高${high.toFixed(2)}"><defs><linearGradient id="vix-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bc303c" stop-opacity=".18"/><stop offset="1" stop-color="#bc303c" stop-opacity="0"/></linearGradient></defs>${bands}${grid}<polygon points="44,250 ${line} 622,250" fill="url(#vix-area)"/><polyline points="${line}" stroke="#b43b3b" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/><circle cx="${x(last)}" cy="${y(last.value)}" r="4" fill="#b43b3b"><title>${last.date}：${last.value.toFixed(2)}</title></circle>${labels}</svg><div class="vix-chart-caption"><span>${points[0].date.replaceAll('-','/')}〜${last.date.replaceAll('-','/')} · ${points.length}回の終値</span><span>最低 <b>${low.toFixed(2)}</b> ／ 最高 <b>${high.toFixed(2)}</b></span></div>`;
}
function vixCard(m,q,sig,change){
  const band=q.usable?vixBand(m.value):null,ps=selectVixHistory(m.history,vixMonths);
  const legend=VIX_BANDS.map(b=>`<li class="${band?.key===b.key?'active':''}" style="--band-color:${b.color}"><strong>${b.range}</strong><span>${b.label}</span>${band?.key===b.key?'<small>現在</small>':''}</li>`).join('');
  const url=/^https:\/\//.test(m.sourceUrl)?m.sourceUrl:'#';
  return `<article class="card vix-card ${q.usable?sig.tone:''}" data-band="${band?.key||'unknown'}" aria-label="${escape(m.name)}" style="--vix-color:${band?.color||'#61757d'}"><div class="card-head"><h3 class="card-title">VIX指数（恐怖指数）</h3><span class="vix-close">米国市場・日次終値</span></div><div class="vix-layout"><div class="vix-reading"><div class="value vix-value">${valuePair(m,v=>format(v,'vix'))}</div><div class="change vix-change ${m.change>0?'up':m.change<0?'down':''}">${change}</div><div class="badge vix-badge">${band?band.label:escape(sig.text)}</div><ul class="vix-legend" aria-label="VIXの数値による色分け">${legend}</ul><p class="vix-guide">区分は添付画像に沿った目安です。境界値は上の区分（15は青、20は黄）。10未満も緑で表示します。</p></div><div class="vix-plot"><div class="vix-plot-head"><strong>VIXの推移</strong><div class="range vix-range" aria-label="VIXグラフの期間">${[3,6,12].map(n=>`<button type="button" data-vix-months="${n}" class="${n===vixMonths?'selected':''}" aria-pressed="${n===vixMonths}">${n===12?'1年':n+'か月'}</button>`).join('')}</div></div>${vixChart(ps)}<p class="vix-series-note">選択期間内の取得済み終値を表示。休場日の値は補間しません。</p><details class="history-details"><summary>VIXの数値の推移を見る</summary><table aria-label="VIXの日次推移"><tbody>${ps.length?ps.slice().reverse().map(p=>`<tr><td>${escape(p.date)}</td><td style="color:${vixBand(p.value).color};font-weight:750">${format(p.value,'vix')}</td></tr>`).join(''):'<tr><td>未取得</td></tr>'}</tbody></table></details></div></div><div class="meta vix-meta"><p class="quality">${q.usable?'●':'⚠'} ${escape(q.label)}</p><span>公表 ${datetime(m.asOf)} · 取得成功 ${datetime(m.lastSuccess)}</span><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(m.source)} ↗</a>${m.error?`<details><summary>取得エラー</summary>${escape(m.error)}</details>`:''}</div></article>`;
}
function render(){
  if(!data)return;
  const ms=metrics(),now=Date.now(),ov=overall(ms,now,data.generatedAt,offline);
  $('.overview').className='overview '+ov.tone;
  $('#summary').textContent=ov.title;$('#summary-detail').textContent=ov.detail;
  $('#coverage').textContent=`判定用 ${ov.count}/3 指標`;
  $('#cards').innerHTML=ms.map(m=>{
    const q=quality(m,now,data.generatedAt,offline),sig=q.usable?signal(m.id,m.value):{tone:'',text:'判定対象外'};
    const isFund=['sox','fang','nasdaq'].includes(m.id);
    if(isFund)return fundCard(m,q,fundRanges.get(m.id)||'6m',{datetime});
    const amount=Number.isFinite(m.change)?`${m.change>0?'↑ +':m.change<0?'↓ −':'→ '}${format(Math.abs(m.change),m.id)}`:'前日比 —';
    const percent=percentLine(changePercent(m));
    const change=`<span class="change-amount">${amount}</span>${percent}`;
    if(m.id==='vix')return vixCard(m,q,sig,change);
    if(m.id==='fear')return fearCard(m,q,sig,fearMonths,{escape,datetime});
    if(m.id==='vi')return viCard(m,q,sig,viMonths,{escape,datetime});
    const marketPeriod=marketRanges.get(m.id)||'6m',history=selectMarketHistory(m.history,marketPeriod);
    const peak=Number.isFinite(m.peak)&&m.peak>0&&Number.isFinite(m.value)?`<div class="peak${m.value<=m.peak*0.8?' peak-discount':''}"><div class="peak-ratio">最高値の <strong>${(m.value/m.peak*100).toFixed(1)}<small>%</small></strong></div><div class="peak-track" role="meter" aria-label="最高値に対する現在値の割合" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,m.value/m.peak*100).toFixed(1)}"><span style="width:${Math.min(100,Math.max(0,m.value/m.peak*100)).toFixed(1)}%"></span></div><div>最高値から ${((m.value/m.peak-1)*100).toFixed(1)}%</div><div>取得データの最高値 ${format(m.peak,m.id)}円</div></div>`:'';
    const url=/^https:\/\//.test(m.sourceUrl)?m.sourceUrl:'#';
    return `<article class="card large-market-card ${sig.tone}" data-metric="${m.id}" aria-label="${escape(m.name)}"><div class="card-head"><h3 class="card-title">${escape(m.name)}</h3><span class="icon" aria-hidden="true">${icons[m.id]||'•'}</span></div><div class="value ${m.change>0?'up':m.change<0?'down':''}">${valuePair(m,v=>format(v,m.id))}</div><div class="unit">${escape(m.unit)}</div><div class="change${isFund?' fund-change':''} ${m.change>0?'up':m.change<0?'down':''}">${change}</div><span class="badge">${escape(sig.text)}</span>${peak}${marketChart(m,marketPeriod)}<div class="meta"><p class="quality">${q.usable?'●':'⚠'} ${escape(q.label)}</p><div>${escape(descriptions[m.id])}</div><div>${escape(m.kind||'未取得')} · ${datetime(m.asOf)}</div><div>取得成功 ${datetime(m.lastSuccess)}</div><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(m.source)} ↗</a>${m.error?`<details><summary>取得エラー</summary>${escape(m.error)}</details>`:''}</div><details class="history-details"><summary>数値の推移を見る</summary><table aria-label="${escape(m.name)}の日次推移"><tbody>${history.length?history.slice().reverse().map(p=>`<tr><td>${escape(p.date)}</td><td>${format(p.value,m.id)}</td></tr>`).join(''):'<tr><td>未取得</td></tr>'}</tbody></table></details></article>`;
  }).join('');
}
async function refresh(){
  if(loading)return;loading=true;$('#refresh').disabled=true;
  $('#status').textContent='新しい保存データを確認しています…';
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    const ddRequest=fetch('./data/fund-drawdowns.json?t='+Date.now(),{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{drawdowns=d;store.set('market-morning-drawdowns',d);}).catch(()=>{});
    let response;try{response=await fetch('./data/market.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});await ddRequest;}finally{clearTimeout(timer);}
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const next=await response.json();
    if(next.schemaVersion!==1||!Array.isArray(next.metrics)||next.metrics.length!==8||!next.generatedAt)throw new Error('データ形式を確認してください');
    data=next;offline=false;store.set('market-morning-cache',data);
    const ok=data.metrics.filter(m=>m.status==='ok').length;
    $('#status').textContent=`取得処理 ${datetime(data.generatedAt)} · 成功 ${ok}/8 · 画面確認 ${datetime(new Date().toISOString())}`;
  }catch(e){
    offline=true;data=data||store.get('market-morning-cache');
    $('#status').textContent=data?'通信できません。保存データを参考表示しています。判定は保留します。':'データを読み込めませんでした。接続と自動更新の実行状況を確認してください。';
    if(!data){$('#summary').textContent='データを読み込めません';$('#summary-detail').textContent='「更新を確認」で再試行できます。';$('#coverage').textContent='判定用 0/3 指標';}
  }finally{loading=false;$('#refresh').disabled=false;render();}
}
function updateToday(){ $('#today').textContent=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date()); }
updateToday();
$('#refresh').addEventListener('click',refresh);
$('#cards').addEventListener('pointermove',e=>{fundHover(e,metrics(),fundRanges);marketHover(e,metrics(),marketRanges);});
$('#cards').addEventListener('click',e=>{
  const market=e.target.closest('[data-market-period]');if(market){marketRanges.set(market.dataset.marketId,market.dataset.marketPeriod);render();$(`[data-market-id="${market.dataset.marketId}"][data-market-period="${market.dataset.marketPeriod}"]`)?.focus({preventScroll:true});return;}
  const reference=e.target.closest('[data-fund-minkabu]');if(reference){e.preventDefault();openFundReference(reference);return;}
  const period=e.target.closest('[data-fund-period]');if(period){fundRanges.set(period.dataset.fundId,period.dataset.fundPeriod);render();$(`[data-fund-id="${period.dataset.fundId}"][data-fund-period="${period.dataset.fundPeriod}"]`)?.focus({preventScroll:true});return;}
  const v=e.target.closest('[data-vi-months]');
  if(v){viMonths=Number(v.dataset.viMonths);render();$(`[data-vi-months="${viMonths}"]`)?.focus({preventScroll:true});return;}
  const f=e.target.closest('[data-fear-months]');
  if(f){fearMonths=Number(f.dataset.fearMonths);render();$(`[data-fear-months="${fearMonths}"]`)?.focus({preventScroll:true});return;}
  const b=e.target.closest('[data-vix-months]');
  if(!b)return;
  vixMonths=Number(b.dataset.vixMonths);render();
  $(`[data-vix-months="${vixMonths}"]`)?.focus({preventScroll:true});
});
$('#manual-form').addEventListener('submit',e=>{
  e.preventDefault();const value=Number($('#manual-value').value),asOf=$('#manual-date').value;
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  if(!Number.isFinite(value)||value<0||value>100||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||asOf>today){$('#manual-status').textContent='0〜100の値と、今日以前の公表日を指定してください。';return;}
  store.set('market-morning-manual',{value,asOf});$('#manual-status').textContent='手入力を保存しました。自動取得値が同じ日以降なら自動取得値を優先します。';render();
});
$('#clear-manual').addEventListener('click',()=>{store.remove('market-morning-manual');$('#manual-status').textContent='手入力を削除しました。';render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateToday();refresh();}});
window.addEventListener('online',refresh);
setInterval(()=>{if(!document.hidden)refresh();},5*60000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
refresh();

watchValuePairs(document.querySelector('#cards'));
