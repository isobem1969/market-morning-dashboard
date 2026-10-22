const UNIVERSE={"sp":[{"name":"情報技術","span":7,"height":320,"stocks":[{"symbol":"NVDA","name":"エヌビディア","layoutWeight":22},{"symbol":"MSFT","name":"マイクロソフト","layoutWeight":20},{"symbol":"AAPL","name":"アップル","layoutWeight":18},{"symbol":"AVGO","name":"ブロードコム","layoutWeight":10},{"symbol":"ORCL","name":"オラクル","layoutWeight":6},{"symbol":"AMD","name":"AMD","layoutWeight":5}]},{"name":"通信・ネット","span":5,"height":320,"stocks":[{"symbol":"GOOGL","name":"アルファベット","layoutWeight":20},{"symbol":"META","name":"メタ","layoutWeight":16},{"symbol":"NFLX","name":"ネットフリックス","layoutWeight":9},{"symbol":"DIS","name":"ディズニー","layoutWeight":5}]},{"name":"一般消費財","span":5,"height":240,"stocks":[{"symbol":"AMZN","name":"アマゾン","layoutWeight":22},{"symbol":"TSLA","name":"テスラ","layoutWeight":17},{"symbol":"HD","name":"ホームデポ","layoutWeight":7},{"symbol":"MCD","name":"マクドナルド","layoutWeight":6}]},{"name":"金融","span":4,"height":240,"stocks":[{"symbol":"BRK-B","name":"バークシャー","layoutWeight":20},{"symbol":"JPM","name":"JPモルガン","layoutWeight":15},{"symbol":"V","name":"ビザ","layoutWeight":12},{"symbol":"MA","name":"マスターカード","layoutWeight":9}]},{"name":"ヘルスケア","span":3,"height":240,"stocks":[{"symbol":"LLY","name":"イーライリリー","layoutWeight":16},{"symbol":"JNJ","name":"J&J","layoutWeight":12},{"symbol":"ABBV","name":"アッヴィ","layoutWeight":10}]},{"name":"生活必需品","span":4,"height":240,"stocks":[{"symbol":"COST","name":"コストコ","layoutWeight":15},{"symbol":"PG","name":"P&G","layoutWeight":10},{"symbol":"KO","name":"コカ・コーラ","layoutWeight":9}]},{"name":"エネルギー","span":4,"height":240,"stocks":[{"symbol":"XOM","name":"エクソンモービル","layoutWeight":14},{"symbol":"CVX","name":"シェブロン","layoutWeight":10}]},{"name":"資本財・公益","span":4,"height":240,"stocks":[{"symbol":"CAT","name":"キャタピラー","layoutWeight":10},{"symbol":"GE","name":"GEエアロ","layoutWeight":10},{"symbol":"NEE","name":"ネクステラ","layoutWeight":8}]}],"nas":[{"name":"情報技術","span":7,"height":320,"stocks":[{"symbol":"NVDA","name":"エヌビディア","layoutWeight":23},{"symbol":"MSFT","name":"マイクロソフト","layoutWeight":21},{"symbol":"AAPL","name":"アップル","layoutWeight":20},{"symbol":"AVGO","name":"ブロードコム","layoutWeight":13},{"symbol":"AMD","name":"AMD","layoutWeight":7},{"symbol":"ADBE","name":"アドビ","layoutWeight":5}]},{"name":"通信・ネット","span":5,"height":320,"stocks":[{"symbol":"GOOGL","name":"アルファベット","layoutWeight":23},{"symbol":"META","name":"メタ","layoutWeight":20},{"symbol":"NFLX","name":"ネットフリックス","layoutWeight":14}]},{"name":"一般消費財","span":5,"height":240,"stocks":[{"symbol":"AMZN","name":"アマゾン","layoutWeight":24},{"symbol":"TSLA","name":"テスラ","layoutWeight":20},{"symbol":"BKNG","name":"ブッキング","layoutWeight":8}]},{"name":"半導体・装置","span":4,"height":240,"stocks":[{"symbol":"MU","name":"マイクロン","layoutWeight":12},{"symbol":"AMAT","name":"アプライドM","layoutWeight":11},{"symbol":"LRCX","name":"ラムリサーチ","layoutWeight":10},{"symbol":"QCOM","name":"クアルコム","layoutWeight":9}]},{"name":"生活・ヘルスケア","span":3,"height":240,"stocks":[{"symbol":"COST","name":"コストコ","layoutWeight":16},{"symbol":"PEP","name":"ペプシコ","layoutWeight":10},{"symbol":"AMGN","name":"アムジェン","layoutWeight":9}]}]};
const names={sp:'S&P500',nas:'NASDAQ100'},periodNames={'1d':'前取引日比','1w':'1週間前比','1m':'1カ月前比'};
let view='both',period='1d',data=null,offline=false,loading=false,selected=null;
const dialog=document.querySelector('#detail'),cacheKey='market-morning-heatmap-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const date=s=>s?s.slice(0,10).replaceAll('-','/'):'未取得';
const stamp=s=>s&&Number.isFinite(Date.parse(s))?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s))+' JST':'未取得';
function record(symbol){return data?.stocks.find(s=>s.symbol===symbol)||{};}
function stale(r){return offline||r.status!=='ok'||!r.lastSuccess||Date.now()-Date.parse(r.lastSuccess)>30*3600000||!data?.generatedAt||Date.now()-Date.parse(data.generatedAt)>30*3600000;}
function change(stock){const v=record(stock.symbol).periods?.[period]?.changePct;return Number.isFinite(v)?v:null;}
function color(value){if(!Number.isFinite(value)||value===0)return '#617078';const n=Math.abs(value);return value>0?(n>=3?'#116a2d':n>=2?'#23833b':n>=1?'#39834b':'#526f58'):(n>=3?'#9d2429':n>=2?'#c13e39':n>=1?'#b85b53':'#82605c');}
function changeText(value){return Number.isFinite(value)?(value>0?'↑ ＋':value<0?'↓ −':'→ ')+Math.abs(value).toFixed(2)+'％':'未取得';}
function rectangles(items,x,y,w,h){
 if(items.length===1)return [{item:items[0],x,y,w,h}];
 const total=items.reduce((s,item)=>s+item.layoutWeight,0);let split=1,sum=items[0].layoutWeight;
 while(split<items.length-1&&Math.abs(sum+items[split].layoutWeight-total/2)<Math.abs(sum-total/2)){sum+=items[split].layoutWeight;split++;}
 const fraction=sum/total,a=items.slice(0,split),b=items.slice(split);
 return w>=h?[...rectangles(a,x,y,w*fraction,h),...rectangles(b,x+w*fraction,y,w*(1-fraction),h)]:[...rectangles(a,x,y,w,h*fraction),...rectangles(b,x,y+h*fraction,w,h*(1-fraction))];
}
function render(){
 const ok=data?.stocks.filter(s=>s.status==='ok').length||0,total=data?.stocks.length||new Set(Object.values(UNIVERSE).flatMap(ss=>ss.flatMap(s=>s.stocks.map(s=>s.symbol)))).size;
 document.querySelector('#heatmap-status').textContent=data?(offline?'通信できません・保存データを参考表示 · ':'')+'取得 '+stamp(data.generatedAt)+' · 成功 '+ok+'/'+total+'銘柄 · 自動取得15分ごとの予定（遅延あり）':'価格データを読み込んでいます…';
 document.querySelector('#panels').innerHTML=Object.entries(UNIVERSE).filter(([key])=>view==='both'||view===key).map(([key,sectors])=>{
 const stocks=sectors.flatMap(s=>s.stocks),up=stocks.filter(s=>change(s)>0).length,down=stocks.filter(s=>change(s)<0).length,missing=stocks.filter(s=>change(s)===null).length;
 return '<section class="index-panel" aria-label="'+names[key]+'主要銘柄"><div class="panel-head"><div><h2>'+names[key]+'</h2><p>主要'+stocks.length+'銘柄（抜粋） · '+periodNames[period]+' · 配当を含まない株価騰落率</p></div><div class="breadth"><span class="positive-count">↑ 上昇 '+up+'</span><span class="negative-count">↓ 下落 '+down+'</span>'+(missing?'<span>未取得 '+missing+'</span>':'')+'</div></div><div class="sector-grid">'+sectors.map((sector,index)=>'<section class="sector" style="--span:'+sector.span+';--height:'+sector.height+'px"><h3>'+sector.name+'<small>'+sector.stocks.length+'銘柄</small></h3><div class="tiles" data-index="'+key+'" data-sector="'+index+'"></div></section>').join('')+'</div><p class="panel-note">面積：見やすさ優先の固定レイアウト（時価総額・指数構成比ではありません） ／ 色：'+periodNames[period]+' ／ 銘柄をタップすると詳細を表示</p></section>';
 }).join('');
 layout();
 if(dialog.open&&selected)showDetail(selected,false);
}
function layout(){document.querySelectorAll('.tiles').forEach(box=>{
 const key=box.dataset.index,index=Number(box.dataset.sector),stocks=UNIVERSE[key][index].stocks;
 box.innerHTML=rectangles(stocks,0,0,box.clientWidth,box.clientHeight).map(({item,x,y,w,h})=>{
 const value=change(item),r=record(item.symbol),old=stale(r)&&Number.isFinite(value);
 return '<button type="button" class="tile '+(w<135||h<105?'compact':'')+'" style="left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px;background:'+color(value)+'" data-index="'+key+'" data-sector="'+index+'" data-symbol="'+item.symbol+'" aria-label="'+esc(item.name)+' '+item.symbol+' '+changeText(value)+(old?'・保存値':'')+'"><span class="ticker">'+item.symbol+'</span><span class="company">'+esc(item.name)+'</span><span class="move">'+changeText(value)+'</span>'+(old?'<small>保存値</small>':'')+'</button>';
 }).join('');
});}
function showDetail(selection,open=true){
 selected=selection;const {key,index,symbol}=selection,sector=UNIVERSE[key][index],s=sector.stocks.find(s=>s.symbol===symbol),r=record(symbol),comparison=r.periods?.[period],v=comparison?.changePct,old=stale(r);
 document.querySelector('#detail-name').textContent=s.name;
 document.querySelector('#detail-symbol').textContent=symbol+' · '+(r.exchange||'米国株')+' · '+names[key];
 document.querySelector('#detail-price-label').textContent=(old?'保存値・参考表示 · ':'')+(r.marketOpen?'通常取引中（遅延あり）':'直近通常取引の終値');
 document.querySelector('#detail-price').textContent=Number.isFinite(r.value)?'$'+num(r.value):'未取得';
 document.querySelector('#detail-move').textContent=changeText(v);document.querySelector('#detail-move').style.color=color(v);
 document.querySelector('#detail-sector').textContent=sector.name+' ／ '+periodNames[period];
 const fields=[
 ['株価の増減',Number.isFinite(comparison?.change)?(comparison.change>0?'+':comparison.change<0?'−':'')+'$'+num(Math.abs(comparison.change)):'未取得'],
 ['比較元の株価',comparison?'$'+num(comparison.referencePrice)+'（'+date(comparison.referenceDate)+'）':'履歴不足・未取得'],
 ['米国取引日',date(r.sessionDate)],
 ['価格の公表時刻',r.quotedAt?stamp(r.quotedAt):'時刻未取得'],
 ['出来高（取引日）',Number.isFinite(r.volume)?num(r.volume,0)+'株':'未取得'],
 ['当日高値 / 安値',num(r.dayHigh)+' / '+num(r.dayLow)+' USD'],
 ['52週高値 / 安値',num(r.week52High)+' / '+num(r.week52Low)+' USD'],
 ['取得日時',stamp(r.lastSuccess)]
 ];
 document.querySelector('#detail-facts').innerHTML=fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('');
 document.querySelector('#detail-status').textContent=old?'前回保存値または未取得です。表示日時を確認してください。':'Yahoo Financeの通常取引データ。時間外株価は含みません。';
 document.querySelector('#detail-link').href='https://finance.yahoo.co.jp/quote/'+encodeURIComponent(symbol);
 if(open)dialog.showModal();
}
async function refresh(){
 if(loading)return;loading=true;const button=document.querySelector('#refresh-heatmap');button.disabled=true;
 try{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let response;
 try{response=await fetch('./data/heatmap.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}
 if(!response.ok)throw Error('HTTP '+response.status);const next=await response.json();
 if(next.schemaVersion!==1||!Array.isArray(next.stocks)||!next.generatedAt)throw Error('Invalid heatmap data');
 data=next;offline=false;try{localStorage.setItem(cacheKey,JSON.stringify(data));}catch{}
 }catch{offline=true;if(!data)try{data=JSON.parse(localStorage.getItem(cacheKey)||'null');}catch{}}
 finally{loading=false;button.disabled=false;render();if(!data)document.querySelector('#heatmap-status').textContent='価格データを取得できません。「更新を確認」で再試行できます。';}
}
document.querySelector('#views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));render();});
document.querySelector('#periods').addEventListener('click',e=>{const b=e.target.closest('[data-period]');if(!b)return;period=b.dataset.period;document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.period===period));render();});
document.querySelector('#panels').addEventListener('click',e=>{const b=e.target.closest('[data-symbol]');if(b)showDetail({key:b.dataset.index,index:Number(b.dataset.sector),symbol:b.dataset.symbol});});
dialog.querySelector('.close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
function updateToday(){document.querySelector('#today').textContent=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date());}
document.querySelector('#refresh-heatmap').addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateToday();refresh();}});
window.addEventListener('online',refresh);
setInterval(()=>{if(!document.hidden)refresh();},5*60000);
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(layout,100);}).observe(document.querySelector('#panels'));
updateToday();render();refresh();
