import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PAGES} from '../public/page-registry.js';
import {nyDate,chartPoints,periodHigh} from '../public/stocks-logic.js';
import {stockGraph} from '../public/stock-chart.js';
import {analystPanel} from '../public/analyst-panel.js';
test('all six pages have matching ordered navigation and exactly one selected page',async()=>{
 assert.deepEqual(PAGES.map(p=>p.label),['株式指標','投資信託','米国株','日本株','ヒートマップ','NASDAQ100・RSI']);
 for(const page of PAGES){
  const html=await readFile(new URL('../public/'+(page.url==='./'?'index.html':page.url.slice(2)),import.meta.url),'utf8');
  const nav=html.match(/<nav class="morning-pages"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
  assert.deepEqual([...nav.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m=>[m[1],m[2].replace(/<[^>]*>/g,'')]),PAGES.map(p=>[p.url,p.label]));
  assert.ok(nav.includes('href="'+page.url+'" aria-current="page"'));
 }
});
test('Tokyo intraday selections and highs use Japanese dates across UTC midnight',()=>{
 const time=t=>Date.parse(t)/1000;
 const daily=[{time:time('2026-11-17T00:00:00Z'),value:100,high:105},{time:time('2026-11-18T00:00:00Z'),value:110,high:115}];
 const intraday=[{time:time('2026-11-17T23:59:00Z'),value:111,high:112},{time:time('2026-11-18T00:05:00Z'),value:113,high:114}];
 const price={daily,intraday,timeZone:'Asia/Tokyo'};
 assert.equal(nyDate(intraday[1].time,'Asia/Tokyo'),'2026-11-18');
 assert.equal(nyDate(intraday[1].time),'2026-11-17');
 assert.equal(chartPoints(price,'1d').length,2);
 assert.equal(periodHigh(price,'1d').date,'2026-11-18');
});
test('Japanese graph and analyst target show yen and Tokyo trading times',()=>{
 const now=new Date().toISOString(),stock={symbol:'9984.T',currency:'JPY',timeZone:'Asia/Tokyo',name:'ソフトバンクグループ',price:{timeZone:'Asia/Tokyo',value:100,daily:[],intraday:[{time:Date.parse('2026-11-18T00:05:00Z')/1000,value:100,high:101}]},research:{target:120,recommendation:'buy',status:'ok',lastSuccess:now}};
 const graph=stockGraph(stock,'1d');assert.ok(graph.includes('09:05'));assert.ok(graph.includes(' 円'));assert.ok(!graph.includes('USD'));
 const panel=analystPanel(stock,()=>now);assert.ok(panel.includes('120.00円'));assert.ok(!panel.includes('$120.00'));
});
