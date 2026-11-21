import test from 'node:test';
import assert from 'node:assert/strict';
import {belowHigh,highCondition,conditionMarkup} from '../public/high-condition.js';
import {stockAlerts} from '../public/stock-alerts.js';
import {fundAlertState,fundCard} from '../public/fund-panel.js';
const now=Date.parse('2026-11-22T00:00:00Z'),stamp=new Date(now).toISOString();
const point=(date,high=100)=>({time:Date.parse(date+'T18:00:00Z')/1000,value:high,high});
function stock(){return {price:{value:69,status:'ok',lastSuccess:stamp,daily:[point('2026-10-01'),point('2026-11-20')],intraday:[point('2026-11-20')]},highs:{status:'ok',lastSuccess:stamp,allTime:{value:100,complete:true}}};}
test('strict 80/70/60/50 boundaries use raw values, never rounded display',()=>{
 for(const [value,threshold] of [[80,null],[79.999,80],[70,80],[69.999,70],[60,70],[59.999,60],[50,60],[49.999,50]])assert.equal(belowHigh(value,100)?.threshold??null,threshold);
 for(const value of [null,undefined,NaN,0,-1,Infinity])assert.equal(belowHigh(value,100),null);
});
test('six-hour-old, failed-refresh and offline prices retain explicitly saved-value hits',()=>{
 const s=stock(),old=new Date(now-6*3600000).toISOString();s.price.lastSuccess=old;s.highs.lastSuccess=old;
 for(const offline of [false,true]){const state=stockAlerts(s,'6m',{generatedAt:old,offline,now});assert.equal(state.active,true);assert.equal(state.reference,true);assert.equal(state.hits.find(h=>h.key==='6m').threshold,70);}
 s.price.status='error';assert.equal(stockAlerts(s,'6m',{generatedAt:stamp,now}).reference,true);
 const text=conditionMarkup(highCondition(69,100,{reference:true}));assert.match(text,/保存値の判定/);assert.match(text,/70％未満/);assert.match(text,/data-reference="true"/);
});
test('incomplete listing history is labeled acquired-period, while valid period hits continue',()=>{
 const s=stock();s.highs.allTime.complete=false;const state=stockAlerts(s,'6m',{generatedAt:stamp,now});
 assert.equal(state.active,true);assert.equal(state.hits.find(h=>h.key==='allTime').label,'取得期間内');assert.ok(state.unchecked.includes('allTime'));assert.match(state.reasons.join(),/全履歴が未確認/);
 s.price.lastSuccess='invalid';assert.equal(stockAlerts(s,'6m',{generatedAt:stamp,now}).hits.length,0);
 s.price.lastSuccess=new Date(now+86400000).toISOString();assert.equal(stockAlerts(s,'6m',{generatedAt:stamp,now}).hits.length,0);
});
test('fund period and acquired-history comparisons share thresholds and render active state',()=>{
 const m={id:'sox',name:'ニッセイSOX',value:49,peak:100,lastSuccess:stamp,asOf:'2026-11-20',history:[{date:'2026-10-01',value:100},{date:'2026-11-20',value:49}]};
 const state=fundAlertState(m,'6m',{usable:false});assert.equal(state.active,true);assert.equal(state.all.hit.threshold,50);assert.equal(state.all.reference,true);
 const text=fundCard(m,{usable:false,label:'保存値'},'6m',{datetime:v=>v});assert.match(text,/peak-alert-active/);assert.match(text,/50％未満/);assert.match(text,/保存値の判定/);assert.match(text,/high-reached/);
 m.value=100;assert.equal(fundAlertState(m,'6m',{usable:true}).any,false);
});
test('unavailable or threshold-exact values have an explicit neutral state',()=>{
 assert.match(conditionMarkup(highCondition(80,100)),/条件外/);assert.doesNotMatch(conditionMarkup(highCondition(80,100)),/is-hit/);
 assert.match(conditionMarkup(highCondition(60,null)),/判定不可/);assert.doesNotMatch(conditionMarkup(highCondition(60,null)),/is-hit/);
});

test('all-time hits never override a clear selected period',()=>{const s=stock();s.price.value=99;s.highs.allTime.value=1000;const state=stockAlerts(s,'1d',{generatedAt:stamp,now});assert.equal(state.active,false);assert.ok(state.hits.some(h=>h.key==='allTime'));const m={id:'sox',value:99,peak:1000,lastSuccess:stamp,asOf:'2026-11-20',history:[{date:'2026-11-20',value:99}]};const a=fundAlertState(m,'1d',{usable:true});assert.equal(a.active,false);assert.ok(a.all.hit);assert.equal(a.selected.hit,null);});

test('failed all-time refresh does not make a freshly verified selected period stale',()=>{const s=stock();s.highs.status='error';const state=stockAlerts(s,'6m',{generatedAt:stamp,now});assert.equal(state.reference,false);assert.equal(state.hits.find(h=>h.key==='6m').reference,false);assert.equal(state.hits.find(h=>h.key==='allTime').reference,true);});
