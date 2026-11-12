import test from 'node:test';
import assert from 'node:assert/strict';
import {readiness} from '../public/page-ready-alert.js';
const ready={fresh:true,rendered:true,failed:false};
test('all four pages must be freshly checked and rendered before green',()=>{
 assert.equal(readiness({market:ready,stocks:ready,heatmap:ready,rsi:ready}).kind,'ready');
 assert.equal(readiness({market:ready,stocks:{...ready,rendered:false},heatmap:ready,rsi:ready}).kind,'loading');
 assert.equal(readiness({market:ready,stocks:{...ready,fresh:false},heatmap:ready,rsi:ready}).kind,'loading');
});
test('saved rendered pages never hide a failed update',()=>{
 assert.equal(readiness({market:ready,stocks:{...ready,failed:true},heatmap:ready,rsi:ready}).kind,'partial');
});
test('long loading is reported as incomplete, and can later recover',()=>{
 assert.equal(readiness({market:ready,stocks:{fresh:false,rendered:false},heatmap:ready,rsi:ready},26000).kind,'partial');
 assert.equal(readiness({market:ready,stocks:ready,heatmap:ready,rsi:ready},27000).kind,'ready');
});


test('RSI alone being incomplete prevents a green four-page banner',()=>{
 assert.equal(readiness({market:ready,stocks:ready,heatmap:ready,rsi:{...ready,fresh:false}}).kind,'loading');
 assert.equal(readiness({market:ready,stocks:ready,heatmap:ready,rsi:{...ready,failed:true}}).kind,'partial');
});
