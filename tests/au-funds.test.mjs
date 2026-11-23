import test from 'node:test';
import assert from 'node:assert/strict';
import {FUND_IDS,metricPage} from '../public/asset-pages.js';
import {fundsOverviewState} from '../public/funds-overview.js';
import {fundCard,fundPoints} from '../public/fund-panel.js';
import {drawdownPanel} from '../public/drawdown-panel.js';
import {dataHealth} from '../public/data-health.js';
const ids=['au_nasdaq_leverage','au_nasdaq_triple'],stamp='2026-11-23T00:00:00Z',day='2026-11-20';
const metric=id=>({id,name:id,value:60,peak:100,status:'ok',lastSuccess:stamp,asOf:day,history:[{date:'2026-10-15',value:100},{date:day,value:60}]});
test('au funds are last, independently switch range and enter only the funds overview',()=>{
 assert.deepEqual(FUND_IDS.slice(-2),ids);
 const ms=ids.map(metric),ranges=new Map();
 assert.deepEqual(fundsOverviewState(ms,ranges,()=>({usable:true})).reached.map(x=>x.m.id),ids);
 ranges.set(ids[0],'1d');
 assert.deepEqual(fundsOverviewState(ms,ranges,()=>({usable:true})).reached.map(x=>x.m.id),[ids[1]]);
 for(const m of ms){assert.equal(metricPage(m.id),'funds');assert.match(fundCard(m,{usable:true},'6m',{datetime:v=>v}),/data-fund-high-period="6m"/);}
});
test('short new-fund series exposes actual bounds without inventing moving averages or a prior year',()=>{
 const m=metric(ids[1]);m.drawdown={name:m.name,startDate:'2026-10-15',asOf:day,currentYear:2026,years:{2025:[],2026:[{date:day,value:-40}]}};
 for(const p of fundPoints(m.history,'2y')){assert.equal(p.ma25,null);assert.equal(p.ma75,null);}
 const html=drawdownPanel(m);assert.match(html,/2026-10-15〜2026-11-20/);assert.match(html,/2026年のみ表示/);assert.doesNotMatch(html,/2025年 最大下落|undefined|NaN/);
});
test('au price, missing panel and drawdown failures are assigned to funds with the correct anchor',()=>{
 const ms=ids.map(metric),dd=Object.fromEntries(ids.map(id=>[id,{asOf:day,lastSuccess:stamp,currentYear:2026,years:{2026:[{date:day,value:-40}]}}]));
 const calendar={schemaVersion:1,feeds:Object.fromEntries(['jpFund','jpPrice','jpDaily','usPrice','usDaily'].map(k=>[k,[{date:day,dueAt:'2026-11-20T00:00:00Z'},{date:'2026-11-24',dueAt:'2026-11-24T23:00:00Z'}]]))};
 for(const id of ids){
  const data={market:{metrics:structuredClone(ms)},drawdowns:structuredClone(dd)};
  data.market.metrics.find(m=>m.id===id).status='error';data.drawdowns[id].error='403';
  const issues=dataHealth(data,calendar,Date.parse(stamp)).issues.filter(i=>i.href.endsWith('#metric-'+id));
  assert.equal(issues.length,2);assert.ok(issues.every(i=>i.page==='funds'));
  data.market.metrics=data.market.metrics.filter(m=>m.id!==id);
  assert.ok(dataHealth(data,calendar,Date.parse(stamp)).issues.some(i=>i.page==='funds'&&i.href.endsWith('#metric-'+id)&&i.item==='価格・グラフ'));
 }
});
