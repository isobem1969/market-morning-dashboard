const CACHE='market-morning-aligned-navigation-20261114';
const SHELL=['./','./nasdaq-rsi.html','./nasdaq-rsi.js','./nasdaq-rsi.css','./page-ready-alert.js','./page-ready-alert.css','./page-warm.js','./shared-data.js','./change-format.js','./market-panel.js','./heatmap.js','./heatmap-universe.json','./stock-chart.js','./analyst-panel.js','./heatmap.html','./page-tabs.css','./index.html','./float-controls.js','./float-controls.css','./value-pair.js','./value-pair.css','./stocks-reference.html','./stocks-reference.js','./stock-alerts.js','./style.css','./app.js','./logic.js','./fear-panel.js','./vi-panel.js','./fund-panel.js','./drawdown-panel.js','./fund-panel.css','./stocks.html','./stocks.css','./stocks.js','./stocks-logic.js','./stocks-research.js','./research-import.js','./research-ui.js','./manifest.webmanifest','./icon.svg','./icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
 const old=(await caches.keys()).filter(k=>k!==CACHE&&k!=='market-morning-snapshots-v1');
 await Promise.all(old.map(k=>caches.delete(k)));
 await self.clients.claim();
 // A release must also replace documents that still have old modules in memory.
 if(old.length){
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(windows.filter(c=>c.frameType==='top-level'&&c.url.startsWith(self.registration.scope)).map(c=>c.navigate(c.url).catch(()=>{})));
 }
})());});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/data/'))return;
 // The cache namespace changes with each app release; URL versions share its assets.
 const key=new Request(url.origin+url.pathname);
 const network=fetch(e.request,{cache:'no-cache'}).then(async r=>{if(r.ok){try{const c=await caches.open(CACHE);await c.put(key,r.clone());}catch{}}return r;});
 e.waitUntil(network.catch(()=>{}));
 // Online: use fresh HTML, scripts and styles. Saved files are an offline fallback.
 e.respondWith(network.catch(async()=>{
  const c=await caches.open(CACHE),saved=await c.match(key);
  return saved||(e.request.mode==='navigate'?await c.match('./index.html'):null)||Response.error();
 }));
});
