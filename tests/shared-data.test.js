import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
let sequence=0;
async function setup(){
 const storage=new Map(),responses=new Map();
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 globalThis.caches={open:async()=>({match:async k=>responses.get(k)?.clone(),put:async(k,r)=>responses.set(k,r.clone())})};
 const module=await import(pathToFileURL(new URL('../public/shared-data.js',import.meta.url).pathname).href+'?case='+sequence++);
 return {module,storage,responses};
}
const snapshot=(date='2026-11-09T01:00:00Z')=>({schemaVersion:1,generatedAt:date,stocks:Array.from({length:13},(_,i)=>({symbol:'S'+i}))});
test('prefetch saves other pages and deduplicates in-flight requests',async()=>{
 const {module:m,storage}=await setup();let calls=0,release;
 globalThis.fetch=()=>{calls++;return new Promise(r=>{release=()=>r(new Response(JSON.stringify(snapshot())));});};
 const a=m.updateSnapshot('stocks'),b=m.updateSnapshot('stocks');
 assert.equal(a,b);assert.equal(calls,1);release();await a;
 assert.equal(m.readSnapshot('stocks').stocks.length,13);
 assert.ok(storage.has('morning-stocks-v1'));
});
test('a newly opened page reads preloaded data without a network request',async()=>{
 const {module:m,storage}=await setup();storage.set('morning-stocks-v1',JSON.stringify(snapshot()));
 globalThis.fetch=()=>{throw Error('network must not be needed to render');};
 assert.equal(m.readSnapshot('stocks').stocks.length,13);
});
test('failed or malformed refresh preserves the previous snapshot',async()=>{
 const {module:m,storage}=await setup();storage.set('morning-stocks-v1',JSON.stringify(snapshot()));
 for(const fetcher of [async()=>{throw Error('offline');},async()=>new Response('{}')]){
  globalThis.fetch=fetcher;await assert.rejects(m.updateSnapshot('stocks'));
  assert.equal(m.readSnapshot('stocks').generatedAt,snapshot().generatedAt);
 }
});
test('lagging CDN snapshot cannot replace a newer prefetch',async()=>{
 const {module:m,storage}=await setup();storage.set('morning-stocks-v1',JSON.stringify(snapshot()));
 globalThis.fetch=async()=>new Response(JSON.stringify(snapshot('2026-11-08T01:00:00Z')));
 assert.equal((await m.updateSnapshot('stocks')).generatedAt,snapshot().generatedAt);
});
test('Cache Storage restores data when localStorage cannot hold it',async()=>{
 const {module:m,responses}=await setup();
 localStorage.setItem=()=>{throw Error('quota');};
 globalThis.fetch=async()=>new Response(JSON.stringify(snapshot()));await m.updateSnapshot('stocks');
 assert.ok(responses.has('./data/stocks.json'));
 const next=await import(new URL('../public/shared-data.js?fallback',import.meta.url));
 assert.equal((await next.restoreSnapshot('stocks')).stocks.length,13);
});
test('all background fetches run concurrently and tolerate one failure',async()=>{
 const {module:m}=await setup();const requests=[];
 globalThis.fetch=async u=>{requests.push(u);if(u.includes('stocks.json'))throw Error('offline');return new Response(JSON.stringify(u.includes('nasdaq-rsi')?{schemaVersion:1,generatedAt:snapshot().generatedAt,confirmed:{rsi:39},history:[],prices:{ndx:{},tqqq:{}}}:u.includes('drawdowns')?{fang:{years:{},currentYear:2026}}:snapshot()));};
 const results=await m.prefetchOtherPages('market');
 assert.equal(requests.length,4);assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
});
test('an early HTML request is reused instead of downloading stocks twice',async()=>{
 const {module:m}=await setup();let calls=0;
 globalThis.__morningPrefetch={stocks:Promise.resolve(snapshot())};
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(snapshot()));};
 assert.equal((await m.updateSnapshot('stocks')).stocks.length,13);assert.equal(calls,0);
 delete globalThis.__morningPrefetch;
});
test('HTML starts stock and heatmap requests before DOM/module initialization',async()=>{
 const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const code=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];const requests=[];
 const sandbox={window:{},document:{querySelector:()=>null,getElementById:()=>null,addEventListener:()=>{}},AbortController,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem:()=>{}},fetch:async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('nasdaq-rsi')?{schemaVersion:1,generatedAt:snapshot().generatedAt,confirmed:{rsi:39},history:[],prices:{ndx:{},tqqq:{}}}:url.includes('market.json')?{schemaVersion:1,generatedAt:snapshot().generatedAt,metrics:[]} :snapshot()};}};
 vm.runInNewContext(code,sandbox);
 assert.equal(requests.length,4);assert.ok(requests.some(u=>u.includes('stocks.json')));assert.ok(requests.some(u=>u.includes('heatmap.json')));
 await Promise.all(Object.values(sandbox.window.__morningPrefetch));
 assert.equal(sandbox.window.__morningPreloadState.stocks,'準備完了');
});

