const names={market:'朝の指標',stocks:'朝の米国株',heatmap:'ヒートマップ'};
export function readiness(pages,elapsed=0){
 const items=Object.keys(names).map(key=>({key,label:names[key],...pages[key]}));
 const allReady=items.every(p=>p.fresh&&p.rendered&&!p.failed);
 const partial=items.some(p=>p.failed)||(elapsed>=25000&&!allReady);
 return {kind:allReady?'ready':partial?'partial':'loading',items};
}
export function mountReadyAlert(win=window,doc=document){
 const alert=doc.querySelector('#page-ready-alert');if(!alert)return;
 if(new URL(win.location.href).searchParams.get('ready-alert')==='off'){alert.hidden=true;return;}
 let started=Date.now(),previous='';
 function page(key,target){
  if(!target)return {fresh:false,rendered:false,failed:false};
  try{
   const status=target.__morningPreloadState?.[key],d=target.document;
   const rendered=key==='market'?!!d.querySelector('#cards')?.childElementCount:key==='stocks'?d.querySelectorAll('.stock-tile').length>=12:d.querySelectorAll('.tile').length>0;
   return {fresh:status==='準備完了',failed:status==='再確認が必要',rendered};
  }catch{return {fresh:false,rendered:false,failed:false};}
 }
 function render(){
  const states={market:page('market',win)};
  for(const key of ['stocks','heatmap'])states[key]=page(key,doc.querySelector('iframe[data-morning-page="'+key+'"]')?.contentWindow);
  const {kind,items}=readiness(states,Date.now()-started);
  const signature=JSON.stringify({kind,items});if(signature===previous)return;previous=signature;
  alert.dataset.state=kind;alert.hidden=false;
  const copy={ready:['✓','全3ページの準備ができました','保存データの更新確認と、画面の準備が完了しました。','ボタンを押すと、すぐに切り替えられます。'],loading:['↻','最新情報を更新しています','米国株とヒートマップも、背面で準備しています。','準備が完了すると、緑色の通知に変わります。'],partial:['!','一部のページが未完了です','更新または表示準備を確認できないページがあります。','保存済みの値が表示される場合があります。「更新を確認」で再試行できます。']}[kind];
  for(const [id,text]of [['ready-alert-icon',copy[0]],['ready-alert-title',copy[1]],['ready-alert-detail',copy[2]],['ready-alert-foot',copy[3]]])doc.getElementById(id).textContent=text;
  doc.getElementById('ready-alert-pages').replaceChildren(...items.map(p=>{const el=doc.createElement('span'),ready=p.fresh&&p.rendered&&!p.failed;el.textContent=(ready?'✓ ':p.failed?'! ':'◷ ')+p.label;el.dataset.ready=String(ready);return el;}));
 }
 render();const timer=win.setInterval(render,300);
 win.addEventListener('pagehide',()=>win.clearInterval(timer),{once:true});
 doc.querySelector('#refresh')?.addEventListener('click',()=>{started=Date.now();previous='';});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')mountReadyAlert();
