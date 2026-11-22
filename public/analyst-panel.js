const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(v)?v.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const labels={strong_buy:'強気買い',buy:'買い',hold:'中立',underperform:'弱気',sell:'売り',strong_sell:'強気売り'};
export function analystPanel(stock,stamp,offline=false){
 const r=stock.research||{},target=Number.isFinite(r.target)&&r.target>0?r.target:null,price=stock.price?.value;
 const missing=r.status==='error'?'未取得':'公表なし';
 const ifisLabels=['強気','やや強気','中立','やや弱気','弱気'],ifis=r.sourceUrl==='https://kabuyoho.jp/reportTarget?bcode='+stock.symbol.replace(/\.T$/,'')&&ifisLabels.includes(r.recommendationLabel);
 const opinion=ifis?r.recommendationLabel:labels[r.recommendation]||missing,tone=ifis?(['強気','やや強気'].includes(opinion)?'orange':['弱気','やや弱気'].includes(opinion)?'green':''):['strong_buy','buy'].includes(r.recommendation)?'orange':['underperform','sell','strong_sell'].includes(r.recommendation)?'green':'';
 const comparable=target&&Number.isFinite(price)&&price>0,delta=comparable?(target/price-1)*100:null;
 const compare=!comparable?'比較不可':price<target?'目標より低い':price>target?'目標より高い':'目標と同じ';
 const compareTone=!comparable?'':price<target?'orange':price>target?'green':'';
 const source=ifis?'IFIS 株予報Pro・アナリスト集計':'Yahoo Finance・アナリスト集計';
 const yahooBase='https://finance.yahoo.com/quote/'+encodeURIComponent(stock.symbol)+'/';
 const link=ifis?r.sourceUrl:[yahooBase,yahooBase+'analysis/',yahooBase+'key-statistics/'].includes(r.sourceUrl)?r.sourceUrl:yahooBase+'analysis/';
 const previous=offline||r.status!=='ok'||!Number.isFinite(Date.parse(r.lastSuccess))||Date.now()-Date.parse(r.lastSuccess)>24*3600000;
 return '<section class="research-panel analyst-panel" aria-label="'+esc(stock.symbol)+'の目標株価とアナリスト評価"><div class="research-top '+tone+'"><strong class="research-opinion">'+opinion+'</strong><div><span class="target-caption">平均目標株価</span><strong class="research-target">'+(target?(stock.currency==='JPY'?num(target)+'円':'$'+num(target)):missing)+'</strong></div></div><div class="research-verdicts"><div><span>目標株価との比較</span><strong class="research-badge '+compareTone+'">'+compare+'</strong></div><div><span>アナリスト</span><strong class="research-badge '+tone+'">'+opinion+'</strong></div></div>'+(delta!==null?'<p class="analyst-upside">目標まで '+(delta>0?'+':'')+num(delta)+'％'+(Number.isFinite(r.analysts)?' · '+(r.analystCountBasis==='rating'?'レーティングの集計 ':'目標株価の集計 ')+r.analysts+'人':'')+'</p>':'')+'<p class="research-source">'+(previous?(r.lastSuccess?'前回保存値・取得確認が必要 · ':'分析値の取得未完了 · '):'')+esc(source)+'<br>取得 '+stamp(r.lastSuccess)+' · 目標株価の公表日時は配信元未掲載<br>比較は現在株価と平均目標株価の大小関係です。みんかぶ独自の株価診断とは異なります。<br><a href="'+link+'" target="_blank" rel="noopener noreferrer">配信元の分析を見る ↗</a></p></section>';
}
