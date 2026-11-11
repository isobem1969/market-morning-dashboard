const CACHE='market-morning-ready-alert-20261111';
const SHELL=['./','./page-ready-alert.js','./page-ready-alert.css','./page-warm.js','./shared-data.js','./change-format.js','./market-panel.js','./heatmap.js','./heatmap-universe.json','./stock-chart.js','./analyst-panel.js','./heatmap.html','./page-tabs.css','./index.html','./float-controls.js','./float-controls.css','./value-pair.js','./value-pair.css','./stocks-reference.html','./stocks-reference.js','./stock-alerts.js','./style.css','./app.js','./logic.js','./fear-panel.js','./vi-panel.js','./fund-panel.js','./drawdown-panel.js','./fund-panel.css','./stocks.html','./stocks.css','./stocks.js','./stocks-logic.js','./stocks-research.js','./research-import.js','./research-ui.js','./manifest.webmanifest','./icon.svg','./icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!=='market-morning-snapshots-v1').map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/data/'))return;
 // The cache namespace changes with each app release; URL versions share its assets.
 const key=new Request(url.origin+url.pathname);
 const network=fetch(e.request,{cache:'no-cache'}).then(async r=>{if(r.ok){try{const c=await caches.open(CACHE);await c.put(key,r.clone());}catch{}}return r;});
 e.waitUntil(network.catch(()=>{}));
 e.respondWith(caches.open(CACHE).then(async c=>{
  const saved=await c.match(key);if(saved)return saved;
  return network.catch(()=>e.request.mode==='navigate'?c.match('./index.html'):Response.error());
 }));
});

