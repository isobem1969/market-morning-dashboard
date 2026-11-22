import test from 'node:test';
import assert from 'node:assert/strict';
import {dataHealth,expectedDates,healthMarkup} from '../public/data-health.js';
import {fundsOverviewState} from '../public/funds-overview.js';
const now=Date.parse('2026-11-22T03:00:00Z'),stamp=new Date(now).toISOString(),day='2026-11-20';
const point={time:Date.parse(day+'T14:00:00Z')/1000,value:100,high:110};
const fundIds=['sox','fang','nasdaq','nasdaq_ifree','sp500_slim','allcountry_slim','schd','tqqq','soxl'];
const calendar={schemaVersion:1,feeds:Object.fromEntries(['jpFund','jpPrice','jpDaily','usPrice','usDaily'].map(k=>[k,[{date:day,dueAt:day+'T00:00:00Z'},{date:'2026-11-24',dueAt:'2026-11-24T23:00:00Z'}]]))};
function fixture(){
 const base={status:'ok',lastSuccess:stamp,asOf:day,value:100};
 const stock=(i,japan=false)=>({symbol:'S'+i,name:'銘柄'+i,price:{...base,sessionDate:day,timeZone:japan?'Asia/Tokyo':'America/New_York',daily:[point],intraday:[point]},highs:{...base,historyStart:'2020-01-02',asOfDate:day,allTime:{value:110,date:day,complete:true}},japan:{...base,ratios:{per:{value:10,availability:'published'},pbr:{value:2,availability:'published'}}},research:{...base,target:120}});
 return {market:{generatedAt:stamp,metrics:[...['usd','vix','fear','vi','brent'],...fundIds].map(id=>({...base,id,name:id,peak:110,history:[{date:day,value:100}]}))},drawdowns:Object.fromEntries(['fang','nasdaq','sp500_slim','allcountry_slim','schd','tqqq','soxl'].map(id=>[id,{...base,currentYear:2026,years:{2026:[{date:day,value:-10}]}}])),stocks:{stocks:Array.from({length:13},(_,i)=>stock(i))},japan:{stocks:Array.from({length:4},(_,i)=>stock(i,true))},heatmap:{stocks:Array.from({length:37},(_,i)=>({...base,name:'H'+i,sessionDate:day,periods:Object.fromEntries(['1d','1w','1m'].map(k=>[k,{changePct:1}]))}))},rsi:{...base,generatedAt:stamp,confirmed:{rsi:50},prices:Object.fromEntries(['ndx','tqqq','soxl'].map(k=>[k,{...base,closeHistory:[{date:day,value:100}]}]))}};
}
test('closed markets retain the latest session without a weekend false alert',()=>{
 assert.equal(dataHealth(fixture(),calendar,now).kind,'ready');assert.equal(expectedDates(calendar,now).jpFund,day);
});
test('an HTTP-success snapshot with a failed field is red, even if its page rendered',()=>{
 const data=fixture(),m=data.market.metrics.find(m=>m.id==='fang');m.status='error';m.error='403 Forbidden';
 const state=dataHealth(data,calendar,now);assert.equal(state.kind,'error');assert.ok(state.issues.some(i=>i.label==='fang'&&i.reason.includes('403')));assert.match(healthMarkup(state),/fang/);
});
test('freshly downloaded old publications and an incomplete graph cannot be green',()=>{
 const data=fixture(),m=data.market.metrics.find(m=>m.id==='fang');m.asOf='2026-10-29';m.history=[{date:'2026-10-29',value:100}];
 assert.equal(dataHealth(data,calendar,now).kind,'error');m.asOf=day;
 assert.ok(dataHealth(data,calendar,now).issues.some(i=>i.reason.includes('グラフの最終日')));
});
test('a denied primary followed by a current backup is healthy',()=>{
 const data=fixture(),m=data.market.metrics.find(m=>m.id==='fang');m.sourceAttempts=[{status:'error',error:'403'},{status:'ok'}];
 assert.equal(dataHealth(data,calendar,now).kind,'ready');
});
test('unpublished ratios are distinct from a failed retrieval',()=>{
 const data=fixture(),per=data.stocks.stocks[0].japan.ratios.per;per.value=null;per.availability='unpublished';
 const state=dataHealth(data,calendar,now);assert.equal(state.kind,'ready');assert.equal(state.unpublished.length,1);
 data.stocks.stocks[0].japan.status='error';assert.equal(dataHealth(data,calendar,now).kind,'error');
});
test('failed refresh, missing symbols or invalid acquired-history coverage remains red',()=>{
 assert.equal(dataHealth(fixture(),calendar,now,{stocks:'再確認が必要'}).kind,'error');
 const data=fixture();data.japan.stocks.pop();assert.equal(dataHealth(data,calendar,now).kind,'error');
 const coverage=fixture();coverage.stocks.stocks[0].highs.allTime.complete=false;assert.equal(dataHealth(coverage,calendar,now).kind,'ready');coverage.stocks.stocks[0].highs.historyStart=null;assert.ok(dataHealth(coverage,calendar,now).issues.some(i=>i.reason.includes('取得済み期間')));
 assert.equal(dataHealth(fixture(),null,now).kind,'error');
});
test('fund overview follows each selected range and separates unconfirmed saved-value hits',()=>{
 const m={id:'fang',name:'FANG＋',value:60,peak:1000,asOf:day,lastSuccess:stamp,history:[{date:'2026-06-01',value:100},{date:day,value:60}]};
 const ranges=new Map([['fang','6m']]);let state=fundsOverviewState([m],ranges,()=>({usable:true}));assert.equal(state.reached.length,1);
 ranges.set('fang','1d');state=fundsOverviewState([m],ranges,()=>({usable:true}));assert.equal(state.reached.length,0);
 ranges.set('fang','6m');state=fundsOverviewState([m],ranges,()=>({usable:false}));assert.equal(state.reached.length,0);assert.equal(state.pending.length,1);assert.equal(state.references.length,1);
});

test('bounded histories are healthy while real failures, stale data and missing peaks remain red',()=>{
 for(const patch of [{historyStart:null},{asOfDate:'2010-01-01'},{allTime:{value:null,date:day,complete:false}},{allTime:{value:110,date:'1900-01-01',complete:false}},{status:'error',error:'403 Forbidden'},{lastSuccess:'2026-11-19T00:00:00Z'}]){
  const d=fixture();const h=d.stocks.stocks[0].highs;h.allTime.complete=false;Object.assign(h,patch);assert.equal(dataHealth(d,calendar,now).kind,'error',JSON.stringify(patch));
 }
 const d=fixture();for(const s of [...d.stocks.stocks,...d.japan.stocks])s.highs.allTime.complete=false;assert.equal(dataHealth(d,calendar,now).kind,'ready');
});
