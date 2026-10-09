import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPoints,sectionOld} from '../public/stocks-logic.js';
const point=(date,value=100)=>({time:Date.parse(`${date}T20:00:00Z`)/1000,value});
test('calendar month end clamps to February; week means seven calendar days',()=>{
 const daily=['2026-02-27','2026-02-28','2026-03-01','2026-03-25','2026-03-26','2026-03-31'].map(d=>point(d));
 assert.equal(selectPoints({daily},'1m')[0].time,point('2026-02-28').time);
 assert.equal(selectPoints({intraday:daily},'1w')[0].time,point('2026-03-25').time);
});
test('one day selects the latest New York session, including UTC midnight boundary',()=>{
 const intraday=[point('2026-10-05'),point('2026-10-06'),{time:Date.parse('2026-10-07T00:00:00Z')/1000,value:102}];
 assert.equal(selectPoints({intraday},'1d').length,2);
 assert.deepEqual(selectPoints({},'2y'),[]);
});
test('saved/error/offline-age values must not appear current',()=>{
 const now=Date.parse('2026-10-06T22:00:00Z'),iso=new Date(now).toISOString();
 assert.equal(sectionOld({status:'ok',lastSuccess:iso},iso,now),false);
 assert.equal(sectionOld({status:'error',lastSuccess:iso},iso,now),true);
 assert.equal(sectionOld({status:'ok',lastSuccess:'2026-10-06T20:00:00Z'},iso,now),true);
 assert.equal(sectionOld({status:'ok',lastSuccess:iso,marketOpen:true,asOf:'2026-10-06T20:00:00Z'},iso,now),true);
});

test('25 and 75 session averages warm up before the selected range',async()=>{
 const {dailyAverages,chartPoints}=await import('../public/stocks-logic.js');
 const daily=Array.from({length:100},(_,i)=>({time:Date.UTC(2026,0,i+1,20)/1000,value:i+1}));
 const a=dailyAverages(daily);
 assert.equal(a[23].ma25,null);assert.equal(a[24].ma25,13);
 assert.equal(a[73].ma75,null);assert.equal(a[74].ma75,38);
 assert.equal(a[99].ma25,88);assert.equal(a[99].ma75,63);
 const visible=chartPoints({daily},'1m');
 assert.ok(visible.length<100);assert.equal(visible.at(-1).ma75,63);
 assert.equal(visible[0].ma25,a.find(p=>p.time===visible[0].time).ma25);
});
test('intraday daily averages never use the current session final close',async()=>{
 const {chartPoints}=await import('../public/stocks-logic.js');
 const daily=Array.from({length:80},(_,i)=>({time:Date.UTC(2026,0,i+1,14)/1000,value:i+1}));
 daily[79].value=10000;
 const intraday=[{time:daily[79].time+3600,value:100,volume:50}];
 const p=chartPoints({daily,intraday},'1d')[0];
 assert.equal(p.ma25,67);assert.equal(p.ma75,42);assert.equal(p.volume,50);
 assert.equal(chartPoints({daily:daily.slice(0,10),intraday},'1d')[0].ma25,null);
});


test('selected period highs use actual highs, change with range and do not invent missing data',async()=>{
 const {periodHigh}=await import('../public/stocks-logic.js');
 const daily=[{...point('2025-10-01',90),high:200},{...point('2026-08-01',90),high:150},{...point('2026-10-01',90),high:110},{...point('2026-10-08',95),high:100}];
 const intraday=[{...point('2026-10-05',90),high:105},{...point('2026-10-08',95),high:99}];
 const p={daily,intraday};
 assert.equal(periodHigh(p,'1d').value,99);
 assert.equal(periodHigh(p,'1w').value,105);
 assert.equal(periodHigh(p,'1m').value,110);
 assert.equal(periodHigh(p,'6m').value,150);
 assert.equal(periodHigh(p,'1y').value,150);
 assert.equal(periodHigh(p,'2y').value,200);
 assert.equal(periodHigh({daily:[point('2026-10-08')]},'1m').value,null);
 assert.equal(periodHigh({},'1d').value,null);
});
