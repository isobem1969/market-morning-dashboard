import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {historyComparison,historyCoverageMarkup,historyCalculationMarkup} from '../public/high-history.js';
import {dataHealth,healthMarkup} from '../public/data-health.js';
const stocks=['stocks','japan-stocks'].flatMap(k=>JSON.parse(fs.readFileSync(new URL('../public/data/'+k+'.json',import.meta.url))).stocks);
const partial=stocks.filter(s=>s.highs.allTime.complete!==true);
test('the six acquired-history comparisons expose actual start, end, peak and arithmetic',()=>{
 assert.equal(partial.length,6);
 for(const s of partial){const h=historyComparison(s);assert.equal(h.valid,true,s.symbol);assert.equal(h.start,s.highs.historyStart);assert.equal(h.end,s.highs.asOfDate);assert.equal(h.ratio,s.price.value/s.highs.allTime.value*100);assert.equal(h.drop,h.ratio-100);const html=historyCalculationMarkup(h);assert.ok(html.includes(h.start)&&html.includes(h.end)&&html.includes(h.peakDate));assert.match(html,/取得済み期間/);assert.match(html,/全履歴は未確認/);assert.match(html,/最高値に対する比率/);assert.match(html,/最高値から/);assert.ok(!html.includes('上場来最高値'));}
});
test('unknown, reversed or impossible coverage dates never produce a fabricated percentage',()=>{
 for(const patch of [{historyStart:null},{asOfDate:'1960-01-01'},{historyStart:'2026-02-30'},{allTime:{value:100,date:'1800-01-01',complete:false}}]){const s=structuredClone(partial[0]);Object.assign(s.highs,patch);const h=historyComparison(s);assert.equal(h.valid,false);assert.equal(h.ratio,null);assert.match(historyCalculationMarkup(h),/計算はできません/);assert.ok(!historyCalculationMarkup(h).includes('0.0％'));}
 for(const value of [0,-1,null,NaN]){const s=structuredClone(partial[0]);s.price.value=value;assert.equal(historyComparison(s).valid,false);}
});
test('yen and dollar units, complete histories and price dates are kept explicit',()=>{
 assert.equal(historyComparison(partial.find(s=>s.symbol.endsWith('.T'))).unit,'円');assert.equal(historyComparison(partial.find(s=>!s.symbol.endsWith('.T'))).unit,'USD');const h=historyComparison(stocks.find(s=>s.highs.allTime.complete));assert.doesNotMatch(historyCoverageMarkup(h),/全履歴は未確認/);assert.ok(historyCalculationMarkup(h).includes(h.priceDate));
});
test('the top alert contains the same range and calculated values as each partial-history panel',()=>{
 const d=Object.fromEntries([['stocks','stocks'],['japan','japan-stocks']].map(([k,f])=>[k,JSON.parse(fs.readFileSync(new URL('../public/data/'+f+'.json',import.meta.url)))]));const model=dataHealth(d,null);const entries=model.issues.filter(i=>i.item==='最高値'&&i.history);assert.equal(entries.length,6);for(const i of entries){assert.equal(i.history.valid,true);assert.ok(i.reason.includes(i.history.start));assert.ok(i.reason.includes(i.history.end));}const html=healthMarkup(model);for(const s of partial){assert.ok(html.includes(s.highs.historyStart));assert.ok(html.includes(s.highs.asOfDate));}assert.match(html,/表示株価/);
});
