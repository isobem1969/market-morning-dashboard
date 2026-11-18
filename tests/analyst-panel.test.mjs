import test from 'node:test';
import assert from 'node:assert/strict';
import {analystPanel} from '../public/analyst-panel.js';
const stock={symbol:'9984.T',currency:'JPY',price:{value:4000},research:{status:'ok',lastSuccess:new Date().toISOString(),target:8023,recommendationLabel:'やや強気',analysts:11,analystCountBasis:'rating',sourceUrl:'https://kabuyoho.jp/reportTarget?bcode=9984'}};
test('IFIS displays its exact rating, mean target, source and rating coverage',()=>{
 const text=analystPanel(stock,s=>s);
 assert.match(text,/8,023.00円/);assert.match(text,/やや強気/);assert.match(text,/IFIS 株予報Pro/);assert.match(text,/レーティングの集計 11人/);assert.match(text,/href="https:\/\/kabuyoho.jp\/reportTarget\?bcode=9984"/);assert.doesNotMatch(text,/Yahoo Finance|目標株価の集計/);
});
test('failed refresh keeps prior values visibly dated and marked',()=>{
 const text=analystPanel({...stock,research:{...stock.research,status:'error'}},s=>s);
 assert.match(text,/8,023.00円/);assert.match(text,/前回保存値・取得確認が必要/);
});
test('source URL must match issuer and approved publisher',()=>{
 const text=analystPanel({...stock,research:{...stock.research,sourceUrl:'javascript:alert(1)'}},s=>s);
 assert.doesNotMatch(text,/javascript:|IFIS/);assert.match(text,/Yahoo Finance/);
});
