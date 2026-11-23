import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionOverview,overviewMarkup} from '../public/overview-summary.js';
import {rangeOverviewState,renderFundsOverview} from '../public/funds-overview.js';
import {fundAlertState} from '../public/fund-panel.js';
import {overall} from '../public/logic.js';
test('saved ETF and mutual fund hits are counted once and visible without opening details',()=>{
 const ms=['tqqq','soxl','fang','au_nasdaq_triple'].map(id=>({id,name:id,value:60,peak:120,asOf:'2026-11-20',lastSuccess:'2026-11-23T10:00:00Z',history:[{date:'2026-06-01',value:100},{date:'2026-11-20',value:60}]}));
 const ranges=new Map(),model=rangeOverviewState(ms,ranges,()=>({usable:false,label:'更新失敗'}));
 assert.equal(model.reached.length,4);assert.equal(model.references.length,4);
 for(const i of model.items)assert.equal(model.reached.includes(i),fundAlertState(i.m,'6m',i.q).active);
 const host={};renderFundsOverview(host,model);assert.match(host.innerHTML,/保存値を含む条件到達 · 4銘柄/);assert.doesNotMatch(host.innerHTML,/<details/);
 ranges.set('tqqq','1d');assert.deepEqual(rangeOverviewState(ms,ranges,()=>({usable:false})).reached.map(i=>i.m.id),['soxl','fang','au_nasdaq_triple']);
});
test('unknown or future-dated prices never create a hit or a misleading all-clear',()=>{
 const model=conditionOverview([{key:'missing',label:'未取得',condition:{valid:false,hit:null,reference:true}}]);
 assert.equal(model.reached.length,0);assert.match(overviewMarkup(model),/判定保留/);assert.doesNotMatch(overviewMarkup(model),/指定条件への到達なし/);
 const m={value:50,peak:100,asOf:'2099-01-01',lastSuccess:'2099-01-01',history:[{date:'2026-01-01',value:100}]};
 assert.equal(fundAlertState(m,'6m',{usable:false}).active,false);
});
test('current and saved price hits share inclusion rules but retain distinct labels',()=>{
 const rows=[false,true].map((reference,i)=>({key:String(i),href:'#price-'+i,label:String(i),asOf:'2026-11-20',condition:{valid:true,hit:{ratio:60},reference,text:'条件到達'}}));
 const state=conditionOverview(rows);assert.equal(state.reached.length,2);assert.equal(state.references.length,1);assert.equal(state.pending.length,1);
 const html=overviewMarkup(state);assert.match(html,/保存値を含む/);assert.match(html,/data-reference="true"/);assert.match(html,/公表 2026-11-20/);
});
test('market indicator saved hits remain explicit while missing values stay pending',()=>{
 const now=Date.parse('2026-11-23T15:00:00Z'),m={id:'vix',name:'VIX',value:40,status:'error',asOf:'2026-11-20',lastSuccess:'2026-11-23T11:00:00Z'};
 const state=overall([m],now,'2026-11-23T11:00:00Z');assert.equal(state.tone,'alert');assert.deepEqual(state.referenceIds,['vix']);assert.match(state.title,/現在未確認/);
 assert.equal(overall([{...m,value:null}],now,'2026-11-23T11:00:00Z').tone,'');
});
