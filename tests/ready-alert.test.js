import test from 'node:test';
import assert from 'node:assert/strict';
import {readiness} from '../public/page-ready-alert.js';
const ready={fresh:true,rendered:true,failed:false};
test('all six pages must be freshly checked and rendered before green',()=>{
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:ready,heatmap:ready,rsi:ready}).kind,'ready');
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:{...ready,rendered:false},heatmap:ready,rsi:ready}).kind,'loading');
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:{...ready,fresh:false},heatmap:ready,rsi:ready}).kind,'loading');
});
test('saved rendered pages never hide a failed update',()=>{
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:{...ready,failed:true},heatmap:ready,rsi:ready}).kind,'partial');
});
test('long loading is reported as incomplete, and can later recover',()=>{
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:{fresh:false,rendered:false},heatmap:ready,rsi:ready},26000).kind,'partial');
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:ready,heatmap:ready,rsi:ready},27000).kind,'ready');
});


test('RSI alone being incomplete prevents a green six-page banner',()=>{
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:ready,heatmap:ready,rsi:{...ready,fresh:false}}).kind,'loading');
 assert.equal(readiness({market:ready,funds:ready,japan:ready,stocks:ready,heatmap:ready,rsi:{...ready,failed:true}}).kind,'partial');
});

test('three real checkpoints per page and eighteen total',()=>{
 const p={market:{fresh:true,charts:false,painted:false}};
 assert.equal(readiness(p).done,1);
 p.market.charts=true;assert.equal(readiness(p).done,2);
 p.market.painted=true;assert.equal(readiness(p).done,3);
 assert.equal(readiness(p).complete,1);
 const all=Object.fromEntries(['market','funds','stocks','japan','heatmap','rsi'].map(k=>[k,p.market]));
 assert.equal(readiness(all).done,18);assert.equal(readiness(all).phase,'complete');
});
test('slow work and failed updates are distinct and never green',()=>{
 assert.equal(readiness({},20000).phase,'stalled');
 assert.equal(readiness({market:{failed:true}},20000).phase,'failed');
 assert.equal(readiness({market:{fresh:true,charts:true,painted:false}},100).phase,'working');
});
