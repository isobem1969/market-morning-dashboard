import test from 'node:test';
import assert from 'node:assert/strict';
import {historyComparison,historyCoverageMarkup,historyCalculationMarkup} from '../public/high-history.js';
import {dataHealth,healthMarkup} from '../public/data-health.js';
// Fixed observations keep public-source failures and wall-clock age out of unit tests.
const stamp=new Date().toISOString(),end='2026-11-20';
const partial=[
 ['LLY','1972-06-01',1475.25,1347.1099853515625,'2026-11-16'],
 ['KO','1970-01-02',100.55999755859375,96.98999786376953,'2026-11-16'],
 ['JNJ','1970-01-02',290.25,270.4700012207031,'2026-11-16'],
 ['9984.T','2000-01-04',9074,3025,'2026-06-02'],
 ['4755.T','2000-04-19',2395,554.7000122070312,'2015-04-10'],
 ['8035.T','2000-01-04',16252,8309,'2026-07-01']
].map(([symbol,start,peak,price,peakDate])=>({symbol,name:symbol,
 price:{value:price,sessionDate:end,status:'ok',lastSuccess:stamp},
 highs:{status:'ok',lastSuccess:stamp,historyStart:start,asOfDate:end,allTime:{value:peak,date:peakDate,complete:false}}}));
const complete=structuredClone(partial[0]);complete.highs.allTime.complete=true;
const stocks=[...partial,complete];
test('the six acquired-history comparisons expose actual start, end, peak and arithmetic',()=>{
 assert.equal(partial.length,6);
 for(const s of partial){const h=historyComparison(s);assert.equal(h.valid,true,s.symbol);assert.equal(h.start,s.highs.historyStart);assert.equal(h.end,s.highs.asOfDate);assert.equal(h.ratio,s.price.value/s.highs.allTime.value*100);assert.equal(h.drop,h.ratio-100);const html=historyCalculationMarkup(h);assert.ok(html.includes(h.start)&&html.includes(h.end)&&html.includes(h.peakDate));assert.match(html,/取得済み期間/);assert.match(html,/取得済み期間内の最高値/);assert.match(html,/最高値に対する比率/);assert.match(html,/最高値から/);assert.ok(!html.includes('上場来最高値'));}
});
test('unknown, reversed or impossible coverage dates never produce a fabricated percentage',()=>{
 for(const patch of [{historyStart:null},{asOfDate:'1960-01-01'},{historyStart:'2026-02-30'},{allTime:{value:100,date:'1800-01-01',complete:false}}]){const s=structuredClone(partial[0]);Object.assign(s.highs,patch);const h=historyComparison(s);assert.equal(h.valid,false);assert.equal(h.ratio,null);assert.match(historyCoverageMarkup(h),/計算を保留/);assert.match(historyCalculationMarkup(h),/計算はできません/);assert.ok(!historyCalculationMarkup(h).includes('0.0％'));}
 for(const value of [0,-1,null,NaN]){const s=structuredClone(partial[0]);s.price.value=value;assert.equal(historyComparison(s).valid,false);}
});
test('yen and dollar units, complete histories and price dates are kept explicit',()=>{
 assert.equal(historyComparison(partial.find(s=>s.symbol.endsWith('.T'))).unit,'円');assert.equal(historyComparison(partial.find(s=>!s.symbol.endsWith('.T'))).unit,'USD');const h=historyComparison(stocks.find(s=>s.highs.allTime.complete));assert.doesNotMatch(historyCoverageMarkup(h),/全履歴は未確認/);assert.ok(historyCalculationMarkup(h).includes(h.priceDate));
});
test('bounded histories are not errors; a failed refresh still carries its range and calculation',()=>{
 const d={stocks:{stocks:partial.filter(s=>!s.symbol.endsWith('.T'))},japan:{stocks:partial.filter(s=>s.symbol.endsWith('.T'))}};
 let model=dataHealth(d,null);assert.equal(model.issues.filter(i=>i.item==='最高値').length,0);
 const failed=structuredClone(d);failed.stocks.stocks[0].highs.status='error';failed.stocks.stocks[0].highs.error='403 Forbidden';
 model=dataHealth(failed,null);const entries=model.issues.filter(i=>i.item==='最高値'&&i.history);assert.equal(entries.length,1);assert.equal(entries[0].history.valid,true);
 const html=healthMarkup(model);assert.ok(html.includes(partial[0].highs.historyStart));assert.match(html,/表示株価/);assert.match(html,/403/);assert.match(html,/<details class="health-issues" open>/);
});
