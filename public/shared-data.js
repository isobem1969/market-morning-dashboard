// Shared snapshots allow page navigation without waiting for a new network response.
const definitions={
 market:{key:'market-morning-cache',file:'market.json'},
 drawdowns:{key:'market-morning-drawdowns',file:'fund-drawdowns.json'},
 stocks:{key:'morning-stocks-v1',file:'stocks.json'},
 rsi:{key:'market-morning-rsi-v1',file:'nasdaq-rsi.json'},
 heatmap:{key:'market-morning-heatmap-v1',file:'heatmap.json'}
};
const memory=new Map(),pending=new Map(),cacheName='market-morning-snapshots-v1';
function valid(name,value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(name==='drawdowns')return Object.values(value).some(d=>d?.years&&Number.isInteger(d.currentYear));
 if(value.schemaVersion!==1||!Number.isFinite(Date.parse(value.generatedAt)))return false;
 if(name==='rsi')return Number.isFinite(value.confirmed?.rsi)&&Array.isArray(value.history)&&value.prices?.ndx&&value.prices?.tqqq;
 return name==='market'?Array.isArray(value.metrics)&&value.metrics.length>=8
  :Array.isArray(value.stocks)&&(name==='stocks'?value.stocks.length>=12:value.stocks.length>0);
}
function remember(name,value){
 memory.set(name,value);
 try{localStorage.setItem(definitions[name].key,JSON.stringify(value));}catch{}
 return value;
}
export function readSnapshot(name){
 if(!definitions[name])return null;
 if(memory.has(name))return memory.get(name);
 try{const value=JSON.parse(localStorage.getItem(definitions[name].key));if(valid(name,value))return remember(name,value);}catch{}
 return null;
}
export async function restoreSnapshot(name){
 const value=readSnapshot(name);if(value)return value;
 try{const cache=await caches.open(cacheName),response=await cache.match('./data/'+definitions[name].file);
  if(response){const saved=await response.json();if(valid(name,saved))return readSnapshot(name)||remember(name,saved);}
 }catch{}
 return null;
}
export function updateSnapshot(name){
 if(pending.has(name))return pending.get(name);
 const states=globalThis.__morningPreloadState||(globalThis.__morningPreloadState={});
 states[name]='先読み中';
 const task=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const early=globalThis.__morningPrefetch?.[name];
   if(early)delete globalThis.__morningPrefetch[name];
   let next;
   if(early){try{next=await early;}catch{}}
   if(!next){const response=await fetch('./data/'+definitions[name].file,{cache:'no-cache',signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);next=await response.json();}
   if(!valid(name,next))throw Error('Invalid '+name+' data');
   const previous=readSnapshot(name);
   // A lagging CDN response must not overwrite a newer prefetched snapshot.
   const value=previous&&Date.parse(previous.generatedAt)>Date.parse(next.generatedAt)?previous:next;
   remember(name,value);states[name]='準備完了';
   void (async()=>{try{const cache=await caches.open(cacheName);await cache.put('./data/'+definitions[name].file,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));}catch{}})();
   return value;
  }catch(error){states[name]='再確認が必要';throw error;}finally{clearTimeout(timer);}
 })().finally(()=>pending.delete(name));
 pending.set(name,task);return task;
}
export function prefetchOtherPages(current){
 return Promise.allSettled(Object.keys(definitions).filter(name=>name!==current).map(updateSnapshot));
}


