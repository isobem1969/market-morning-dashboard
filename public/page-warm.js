// Prepare snapshots and page structure off screen. Open links as real documents.
// A hidden, fixed iframe must never become the visible page or intercept its scroll.
const base=new URL('./',import.meta.url);
const paths={stocks:new URL('stocks-reference.html',base),heatmap:new URL('heatmap.html',base),rsi:new URL('nasdaq-rsi.html',base)};
const isRoot=location.pathname===base.pathname||location.pathname===new URL('index.html',base).pathname;
if(window.parent===window&&isRoot){
 const frames=new Map();
 for(const [key,url]of Object.entries(paths)){
  const frame=document.createElement('iframe');frame.dataset.morningPage=key;
  frame.title=key==='stocks'?'米国株の準備':key==='heatmap'?'ヒートマップの準備':'NASDAQ100・RSIの準備';
  frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.inert=true;
  const source=new URL(url);source.searchParams.set('prewarmed','1');frame.src=source;
  frame.style.cssText='position:fixed;top:0;left:-200vw;width:100vw;height:100vh;border:0;visibility:hidden;pointer-events:none';
  document.body.append(frame);frames.set(key,frame);
 }
 function label(){
  const el=document.getElementById('page-preload-status');if(!el)return;
  el.textContent=[...frames].map(([key,frame])=>{
   let complete=false;
   try{const state=frame.contentWindow;complete=state.__morningPreloadState?.[key]==='準備完了'&&!!state.__morningRenderState?.[key];}catch{}
   return (key==='stocks'?'米国株':key==='heatmap'?'ヒートマップ':'NASDAQ100・RSI')+'：'+(complete?'準備完了':'画面を先読み中');
  }).join(' ／ ');
 }
 document.getElementById('refresh')?.addEventListener('click',()=>{
  for(const frame of frames.values()){
   try{const target=frame.contentWindow;if(target.__morningRefreshReady)target.dispatchEvent(new target.Event('morning-refresh'));else frame.contentDocument?.querySelector('#refresh,#refresh-heatmap')?.click();}catch{}
  }
 });
 label();let timer=setInterval(label,300);
 window.addEventListener('pagehide',()=>clearInterval(timer));
 window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(timer);label();timer=setInterval(label,300);}});
}
