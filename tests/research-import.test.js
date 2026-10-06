import test from 'node:test';
import assert from 'node:assert/strict';
import {parseResearchText,validateRecord,decodeResearchFile,mergeResearch} from '../public/research-import.js';
const text='アップル AAPL NASDAQ $100.00 買い 目標株価 $ 123.45 株価診断 割高 アナリスト 割安';
const stamp=()=>new Date().toISOString();
test('extracts the target rather than current price and normalizes full-width input',()=>{
 const r=parseResearchText(text,'AAPL');assert.equal(r.target,123.45);assert.equal(r.diagnosis,'割高');assert.equal(r.analyst,'割安');
 assert.equal(parseResearchText(text.replace('123.45','１,２３４.５６'),'AAPL').target,1234.56);
});
test('wrong ticker or missing fields cannot silently replace panel values',()=>{
 assert.throws(()=>parseResearchText(text,'MSFT'),/一致/);
 assert.throws(()=>parseResearchText('AAPL 株価診断 割安','AAPL'),/読み取れません/);
});
test('unpublished target is preserved as null, never zero',()=>{
 const r=parseResearchText('対象外 目標株価 $ --- 株価診断 --- アナリスト ---','SPCX');
 assert.equal(r.target,null);assert.equal(r.diagnosis,'未公表');
 assert.throws(()=>validateRecord({...parseResearchText(text,'AAPL'),target:0,capturedAt:stamp()}));
});
test('import only accepts allowed fields, ratings, symbols and dates',()=>{
 const r={...parseResearchText(text,'AAPL'),capturedAt:stamp(),sourceUrl:'https://evil.example',evil:'x'};
 const v=validateRecord(r);assert.equal(v.evil,undefined);assert.equal(v.sourceUrl,'https://us.minkabu.jp/stocks/AAPL/researches');
 assert.throws(()=>validateRecord({...r,diagnosis:'<script>'}));assert.throws(()=>validateRecord({...r,capturedAt:'2999-01-01'}));
 const file=JSON.stringify({format:'market-morning-minkabu',version:1,records:[r]});assert.equal(decodeResearchFile(file).length,1);
 assert.throws(()=>decodeResearchFile(JSON.stringify({format:'market-morning-minkabu',version:1,records:[r,r]})));
});
test('older shared file does not overwrite newer data',()=>{
 const r={...parseResearchText(text,'AAPL'),capturedAt:stamp()};
 const old={...r,target:99,capturedAt:'2020-01-01T00:00:00Z'};
 const m=mergeResearch({AAPL:r},[old]);assert.equal(m.skipped,1);assert.equal(m.next.AAPL.target,123.45);
});
