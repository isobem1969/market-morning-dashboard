const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;
const positive=n=>Number.isFinite(n)&&n>0;
const number=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
export function historyComparison(stock){
 const h=stock.highs||{},p=stock.price||{},peak=h.allTime||{};
 const start=day(h.historyStart),end=day(h.asOfDate),peakDate=day(peak.date);
 const rangeValid=!!start&&!!end&&start<=end;
 const valid=rangeValid&&!!peakDate&&peakDate>=start&&peakDate<=end&&positive(peak.value)&&positive(p.value);
 const ratio=valid?p.value/peak.value*100:null;
 return {start,end,rangeValid,valid,complete:peak.complete===true,peak:peak.value,peakDate,
         price:p.value,priceDate:day(p.sessionDate),ratio,drop:ratio===null?null:ratio-100,
         unit:stock.currency==='JPY'||stock.symbol?.endsWith('.T')?'円':'USD'};
}
export function historyCoverageMarkup(h){
 const range=h.rangeValid?h.start+'〜'+h.end:(h.start||'開始日未確認')+'〜'+(h.end||'終了日未確認');
 return '<p class="high-history-coverage"><strong>取得済み期間</strong><span>'+esc(range)+'</span><small>'+(h.complete?'取得した履歴の範囲です。':'上場時からの全履歴は未確認です。この範囲内の最高値を基準に計算します。')+'</small></p>';
}
export function historyCalculationMarkup(h){
 if(!h)return '';
 return '<div class="health-history-calculation">'+historyCoverageMarkup(h)+(h.valid?
  '<p>期間内最高値 <strong>'+number(h.peak)+' '+esc(h.unit)+'</strong>（'+esc(h.peakDate)+'）<br>表示株価 <strong>'+number(h.price)+' '+esc(h.unit)+'</strong>（'+esc(h.priceDate||'取引日未確認')+'）</p><p>最高値に対する比率 <strong>'+number(h.ratio,1)+'％</strong> ／ 最高値から <strong>'+(h.drop<0?'−':h.drop>0?'+':'')+number(Math.abs(h.drop))+'％</strong></p><small>比率＝表示株価 ÷ 取得期間内最高値 × 100。選択中のグラフ期間とは別の固定比較です。</small>':
  '<p>期間・高値記録日・株価を確認できないため、この範囲での計算はできません。</p>')+'</div>';
}
