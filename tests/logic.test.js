import test from 'node:test';
import assert from 'node:assert/strict';
import {signal,quality,overall} from '../public/logic.js';
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
