import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FUND_IDS,ETF_IDS,MARKET_IDS,metricPage,panelHref,legacyPanelDestination} from '../public/asset-pages.js';
import {fundsOverviewState,rangeOverviewState} from '../public/funds-overview.js';
import {etfMetrics} from '../public/us-etfs.js';
import {dataHealth} from '../public/data-health.js';
const day='2026-11-20',now=Date.parse('2026-11-23T00:00:00Z'),stamp=new Date(now).toISOString();
const m=id=>({id,name:id,status:'ok',lastSuccess:stamp,asOf:day,value:60,peak:100,history:[{date:'2026-06-01',value:100},{date:day,value:60}]});
test('each metric has exactly one owning page and ETF order follows all thirteen equities',()=>{
 assert.equal(new Set([...FUND_IDS,...ETF_IDS,...MARKET_IDS]).size,14);assert.equal(FUND_IDS.length,7);assert.deepEqual(ETF_IDS,['tqqq','soxl']);
 for(const id of ETF_IDS){assert.equal(metricPage(id),'stocks');assert.equal(panelHref(id),'./stocks-reference.html#metric-'+id);for(const path of ['/market/','/market/index.html','/market/funds.html'])assert.equal(legacyPanelDestination(path,'#metric-'+id),panelHref(id));assert.equal(legacyPanelDestination('/market/stocks-reference.html','#metric-'+id),null);}
 assert.equal(panelHref('nasdaq'),'./funds.html#metric-nasdaq');assert.equal(legacyPanelDestination('/market/','#metric-sox'),'./funds.html#metric-sox');
 const html=fs.readFileSync(new URL('../public/stocks-reference.html',import.meta.url),'utf8');assert.ok(html.indexOf('id="stocks"')<html.indexOf('id="us-etfs"'));
});
test('fund conditions exclude ETFs, while ETF conditions keep independent selected ranges',()=>{
 const metrics=[...FUND_IDS,...ETF_IDS].map(m),ranges=new Map();assert.equal(fundsOverviewState(metrics,ranges,()=>({usable:true})).items.length,7);
 const etfs=etfMetrics({metrics},{tqqq:{name:'TQQQ drawdown'},soxl:{name:'SOXL drawdown'}});assert.deepEqual(etfs.map(m=>m.id),ETF_IDS);assert.equal(etfs[0].drawdown.name,'TQQQ drawdown');
 assert.equal(rangeOverviewState(etfs,ranges,()=>({usable:true})).reached.length,2);ranges.set('tqqq','1d');assert.deepEqual(rangeOverviewState(etfs,ranges,()=>({usable:true})).reached.map(i=>i.m.id),['soxl']);
 assert.equal(rangeOverviewState(etfs,ranges,()=>({usable:false})).pending.length,2);
});
test('ETF price and drawdown failures point to US stocks, not funds',()=>{
 const calendar={schemaVersion:1,feeds:Object.fromEntries(['jpFund','jpPrice','jpDaily','usPrice','usDaily'].map(k=>[k,[{date:day,dueAt:'2026-11-20T00:00:00Z'},{date:'2026-11-24',dueAt:'2026-11-24T23:00:00Z'}]]))};
 const data={market:{metrics:[...MARKET_IDS,...FUND_IDS,...ETF_IDS].map(m)},drawdowns:Object.fromEntries(['fang','nasdaq','sp500_slim','allcountry_slim','schd',...ETF_IDS].map(id=>[id,{asOf:day,lastSuccess:stamp,currentYear:2026,years:{2026:[{date:day,value:-40}]}}]))};
 for(const id of ETF_IDS){const copy=structuredClone(data);copy.market.metrics.find(m=>m.id===id).status='error';copy.drawdowns[id].error='Unavailable';const issues=dataHealth(copy,calendar,now).issues.filter(i=>i.href?.endsWith('#metric-'+id));assert.equal(issues.length,2);assert.ok(issues.every(i=>i.page==='stocks'&&i.href==='./stocks-reference.html#metric-'+id));}
});
