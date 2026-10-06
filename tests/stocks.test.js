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
