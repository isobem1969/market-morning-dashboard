import test from 'node:test';
import assert from 'node:assert/strict';
import {signal,quality,overall,vixBand,selectVixHistory} from '../public/logic.js';
const now=Date.parse('2026-10-02T00:00:00Z'),pipeline='2026-10-01T23:00:00Z';
const m=(id,value)=>({id,name:id,value,status:'ok',asOf:'2026-10-01'});
test('alerts honor exact user boundaries',()=>{
 assert.equal(signal('vix',29.99).tone,'watch');assert.equal(signal('vix',30).tone,'alert');
 assert.equal(signal('fear',20).tone,'');assert.equal(signal('fear',19.99).tone,'alert');
 assert.equal(signal('vi',49.99).tone,'');assert.equal(signal('vi',50).tone,'alert');
});
test('missing, failed, stale and offline data cannot drive alerts',()=>{
 const high=m('vix',40);
 for(const metric of [{...high,status:'error'},{...high,value:null},{...high,asOf:'2026-09-20'}])assert.equal(quality(metric,now,pipeline).usable,false);
 assert.equal(quality(high,now,'2026-09-28T00:00:00Z').usable,false);
 assert.equal(quality(high,now,pipeline,true).usable,false);
 assert.equal(overall([{...high,status:'error'}],now,pipeline).title,'判定保留 · データ不足');
});
test('partial data is held; a verified triggered condition remains visible',()=>{
 assert.equal(overall([m('vix',16),m('vi',22)],now,pipeline).count,2);
 assert.equal(overall([m('vix',31),m('vi',22)],now,pipeline).tone,'alert');
 assert.equal(overall([m('vix',16),m('vi',22),m('fear',31)],now,pipeline).title,'指定条件への到達なし');
});
test('VIX reference bands have unambiguous exact boundaries',()=>{
 for(const [value,key] of [[0,'calm'],[9,'calm'],[14.99,'calm'],[15,'normal'],[19.99,'normal'],[20,'watch'],[29.99,'watch'],[30,'fear'],[39.99,'fear'],[40,'panic'],[80,'panic']])assert.equal(vixBand(value).key,key);
 for(const value of [null,NaN,Infinity,-1])assert.equal(vixBand(value),null);
});
test('VIX calendar ranges sort, deduplicate and handle month-end cutoffs',()=>{
 const points=[{date:'2026-05-31',value:16},{date:'2026-02-28',value:20},{date:'2026-02-27',value:21},{date:'2026-05-31',value:17},{date:'2026-02-30',value:18},{date:'2026-04-01',value:NaN}];
 assert.deepEqual(selectVixHistory(points,3),[{date:'2026-02-28',value:20},{date:'2026-05-31',value:17}]);
 assert.deepEqual(selectVixHistory([],12),[]);
});

import {fearBand,fearHistory} from '../public/fear-panel.js';
test('Fear & Greed exact and fractional boundaries, invalid scores and histories',()=>{
 for(const [v,key] of [[0,'extreme-fear'],[24.99,'extreme-fear'],[25,'fear'],[44.99,'fear'],[45,'neutral'],[55,'neutral'],[55.01,'greed'],[75,'greed'],[75.01,'extreme-greed'],[100,'extreme-greed']])assert.equal(fearBand(v)?.key,key);
 for(const v of [null,NaN,Infinity,-1,101])assert.equal(fearBand(v),null);
 assert.deepEqual(fearHistory([{date:'2026-10-01',value:28},{date:'2026-10-02',value:101},{date:'2026-10-03',value:-1}],3),[{date:'2026-10-01',value:28}]);
});

import {viBand} from '../public/vi-panel.js';
test('Nikkei VI reference bands include their lower boundary and accept scores over 100',()=>{
 for(const [v,key] of [[0,'low'],[19.99,'low'],[20,'normal'],[29.99,'normal'],[30,'watch'],[39.99,'watch'],[40,'high'],[49.99,'high'],[50,'very-high'],[120,'very-high']])assert.equal(viBand(v)?.key,key);
 for(const v of [null,NaN,Infinity,-1])assert.equal(viBand(v),null);
});
