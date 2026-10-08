const CACHE='market-morning-float-green-20261008';
const SHELL=['./','./index.html','./float-controls.js','./float-controls.css','./value-pair.js','./value-pair.css','./stocks-reference.html','./stocks-reference.js','./style.css','./app.js','./logic.js','./fear-panel.js','./vi-panel.js','./fund-panel.js','./fund-panel.css','./stocks.html','./stocks.css','./stocks.js','./stocks-logic.js','./stocks-research.js','./research-import.js','./research-ui.js','./manifest.webmanifest','./icon.svg','./icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/data/'))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r|| (e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
