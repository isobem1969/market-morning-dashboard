import {quality,signal,overall} from './logic.js';
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={usd:'¥',vix:'V',fear:'FG',vi:'VI',brent:'B',sox:'S',fang:'F+',nasdaq:'N'};
const descriptions={usd:'為替 · 1ドルあたりの円',vix:'米国株の予想変動幅',fear:'米国市場の恐怖・欲望',vi:'日経平均の予想変動幅',brent:'ブレント期近先物',sox:'29314233 · 米国半導体',fang:'04311181 · 米国大型成長株',nasdaq:'89311265 · NASDAQ100'};
const store={get(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}};
let data=null,range=7,offline=false,loading=false;
function format(value,id){return Number.isFinite(value)?value.toLocaleString('ja-JP',{minimumFractionDigits:['usd','vix','vi','brent'].includes(id)?2:0,maximumFractionDigits:['sox','fang','nasdaq'].includes(id)?0:2}):'—';}
function datetime(value){if(!value)return'未取得';const d=new Date(value.length===10?value+'T00:00:00+09:00':value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ja-JP',{month:'2-digit',day:'2-digit',...(value.length>10?{hour:'2-digit',minute:'2-digit'}:{}),timeZone:'Asia/Tokyo'}).format(d)+(value.length>10?' JST':''): '日時不明';}
function metrics(){
  if(!data)return [];
  const manual=store.get('market-morning-manual');
  return data.metrics.map(m=>{
    if(m.id!=='fear'||!manual||!Number.isFinite(manual.value)||manual.value<0||manual.value>100)return m;
    if(m.status==='ok'&&m.asOf&&m.asOf.slice(0,10)>=manual.asOf)return m;
    return {...m,value:manual.value,asOf:manual.asOf,status:'manual',kind:'CNN確認・手入力',history:[{date:manual.asOf,value:manual.value}],change:null,changePct:null};
  });
}
function spark(points,id){
  const ps=points.filter(p=>Number.isFinite(p.value)&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)).slice(-range);
  if(ps.length<2)return'<div class="chart-empty">推移データを蓄積中</div>';
  const values=ps.map(p=>p.value),lo=Math.min(...values),hi=Math.max(...values),spread=hi-lo||1;
  const positions=ps.map((p,i)=>[(i/(ps.length-1)*200).toFixed(2),(35-(p.value-lo)/spread*30).toFixed(2)]);
  const line=positions.map(p=>p.join(',')).join(' ');
  return `<svg class="spark" viewBox="0 0 200 43" preserveAspectRatio="none" role="img" aria-label="${escape(id)} 直近${ps.length}回の推移"><path d="M0 40 H200" stroke="#e7efeb" fill="none"/><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${positions.at(-1)[0]}" cy="${positions.at(-1)[1]}" r="2.5" fill="currentColor"/></svg><div class="chart-dates"><span>${ps[0].date.slice(5).replace('-','/')}</span><span>${ps.at(-1).date.slice(5).replace('-','/')}</span></div>`;
}
function render(){
  if(!data)return;
  const ms=metrics(),now=Date.now(),ov=overall(ms,now,data.generatedAt,offline);
  $('.overview').className='overview '+ov.tone;
  $('#summary').textContent=ov.title;$('#summary-detail').textContent=ov.detail;
  $('#coverage').textContent=`判定用 ${ov.count}/3 指標`;
  $('#cards').innerHTML=ms.map(m=>{
    const q=quality(m,now,data.generatedAt,offline),sig=q.usable?signal(m.id,m.value):{tone:'',text:'判定対象外'};
    const change=Number.isFinite(m.change)?`${m.change>0?'↑ +':m.change<0?'↓ −':'→ '}${format(Math.abs(m.change),m.id)}${Number.isFinite(m.changePct)?` (${m.changePct>0?'+':''}${m.changePct.toFixed(2)}%)`:''}`:'前日比 —';
    const history=(m.history||[]).slice(-range);
    const peak=Number.isFinite(m.peak)&&m.peak>0&&Number.isFinite(m.value)?`<div class="peak"><div class="peak-ratio">最高値の <strong>${(m.value/m.peak*100).toFixed(1)}<small>%</small></strong></div><div class="peak-track" role="meter" aria-label="最高値に対する現在値の割合" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,m.value/m.peak*100).toFixed(1)}"><span style="width:${Math.min(100,Math.max(0,m.value/m.peak*100)).toFixed(1)}%"></span></div><div>最高値から ${((m.value/m.peak-1)*100).toFixed(1)}%</div><div>取得データの最高値 ${format(m.peak,m.id)}円</div></div>`:'';
    const url=/^https:\/\//.test(m.sourceUrl)?m.sourceUrl:'#';
    return `<article class="card ${sig.tone}" aria-label="${escape(m.name)}"><div class="card-head"><h3 class="card-title">${escape(m.name)}</h3><span class="icon" aria-hidden="true">${icons[m.id]||'•'}</span></div><div class="value">${format(m.value,m.id)}</div><div class="unit">${escape(m.unit)}</div><div class="change ${m.change>0?'up':m.change<0?'down':''}">${change}</div><span class="badge">${escape(sig.text)}</span>${peak}${spark(history,m.name)}<div class="meta"><p class="quality">${q.usable?'●':'⚠'} ${escape(q.label)}</p><div>${escape(descriptions[m.id])}</div><div>${escape(m.kind||'未取得')} · ${datetime(m.asOf)}</div><div>取得成功 ${datetime(m.lastSuccess)}</div><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(m.source)} ↗</a>${m.error?`<details><summary>取得エラー</summary>${escape(m.error)}</details>`:''}</div><details class="history-details"><summary>数値の推移を見る</summary><table aria-label="${escape(m.name)}の日次推移"><tbody>${history.length?history.slice().reverse().map(p=>`<tr><td>${escape(p.date)}</td><td>${format(p.value,m.id)}</td></tr>`).join(''):'<tr><td>未取得</td></tr>'}</tbody></table></details></article>`;
  }).join('');
}
async function refresh(){
  if(loading)return;loading=true;$('#refresh').disabled=true;
  $('#status').textContent='新しい保存データを確認しています…';
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    let response;try{response=await fetch('./data/market.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}
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
$('#today').textContent=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date());
$('#refresh').addEventListener('click',refresh);
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{
  range=Number(b.dataset.range);document.querySelectorAll('[data-range]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});render();
}));
$('#manual-form').addEventListener('submit',e=>{
  e.preventDefault();const value=Number($('#manual-value').value),asOf=$('#manual-date').value;
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  if(!Number.isFinite(value)||value<0||value>100||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||asOf>today){$('#manual-status').textContent='0〜100の値と、今日以前の公表日を指定してください。';return;}
  store.set('market-morning-manual',{value,asOf});$('#manual-status').textContent='手入力を保存しました。自動取得値が同じ日以降なら自動取得値を優先します。';render();
});
$('#clear-manual').addEventListener('click',()=>{store.remove('market-morning-manual');$('#manual-status').textContent='手入力を削除しました。';render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('online',refresh);
setInterval(()=>{if(!document.hidden)refresh();},5*60000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
refresh();
