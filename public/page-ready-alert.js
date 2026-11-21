import {redirectingFundPanel} from './common-header.js?v=six-pages-20261119-v1';
import {PAGES} from './page-registry.js?v=six-pages-20261119-v1';
const names=Object.fromEntries(PAGES.map(p=>[p.key,p.label])),links=Object.fromEntries(PAGES.map(p=>[p.key,p.url]));
export function readiness(pages,elapsed=0){
 const items=Object.keys(names).map(key=>{
  const p=pages[key]||{},data=!!p.fresh&&!p.failed,charts=data&&!!(p.charts??p.rendered),painted=charts&&!!(p.painted??p.rendered);
  return {...p,key,label:names[key],steps:[data,charts,painted],done:Number(data)+Number(charts)+Number(painted),complete:painted,failed:!!p.failed};
 });
 const complete=items.filter(p=>p.complete).length,done=items.reduce((n,p)=>n+p.done,0),failed=items.some(p=>p.failed),stalled=!failed&&complete<PAGES.length&&elapsed>=20000;
 return {kind:complete===PAGES.length?'ready':failed||stalled?'partial':'loading',phase:complete===PAGES.length?'complete':failed?'failed':stalled?'stalled':done===0?'starting':'working',items,complete,done,total:PAGES.length*3,failed,stalled};
}
export function mountReadyAlert(win=window,doc=document){
 const alert=doc.querySelector('#page-ready-alert');if(!alert||redirectingFundPanel)return;
 if(new URL(win.location.href).searchParams.get('ready-alert')==='off'){alert.hidden=true;return;}
 let started=Date.now(),lastAdvance=started,completedAt=null,previousProgress='',previousModel='',wasReady=false;
 const painted=new Map(),scheduled=new Map(),nodes=new Map();
 alert.setAttribute('role','region');alert.setAttribute('aria-label','6ページの準備状況');alert.removeAttribute('aria-live');alert.removeAttribute('aria-atomic');
 alert.innerHTML='<div class="ready-alert-top"><div class="ready-alert-heading"><span id="ready-alert-icon" aria-hidden="true">↻</span><strong id="ready-alert-title">6ページの確認を開始しました</strong></div><div class="ready-alert-summary"><strong id="ready-alert-count">0 / 6 ページ完了</strong><span id="ready-alert-elapsed">経過 0秒</span></div></div><p id="ready-alert-detail" role="status" aria-live="polite">最新の保存データを確認しています。</p><div class="ready-progress-row"><strong id="ready-alert-progress-label">確認済み 0 / 18項目</strong><div id="ready-alert-progress" class="ready-progress" role="progressbar" aria-label="準備の確認項目" aria-valuemin="0" aria-valuemax="18" aria-valuenow="0">'+Array.from({length:PAGES.length*3},()=>'<span aria-hidden="true"></span>').join('')+'</div></div><details class="ready-alert-details"><summary>ページ別の確認状況を開く</summary><div id="ready-alert-pages" class="ready-alert-pages"></div><div class="ready-alert-bottom"><p id="ready-alert-foot" class="ready-alert-foot">進捗は完了した確認項目の数です。</p><button id="ready-alert-retry" type="button" hidden>未完了のページを再確認</button></div></details>';
 const cards=doc.getElementById('ready-alert-pages');
 for(const [key,label]of Object.entries(names)){
  const card=doc.createElement('section');card.className='ready-page';card.dataset.page=key;card.setAttribute('aria-label',label+'の準備状況');
  card.innerHTML='<div class="ready-page-head"><h3></h3><span class="ready-page-status"></span></div><ol class="ready-page-steps">'+['データ確認','グラフ準備','画面構成確認'].map(text=>'<li><span aria-hidden="true">○</span><span>'+text+'</span></li>').join('')+'</ol><p class="ready-page-note"></p><div class="ready-page-actions"><a href="'+links[key]+'" aria-label="'+label+'を開く">ページを開く →</a><button type="button" data-ready-retry="'+key+'" hidden>再確認</button></div>';
  cards.append(card);nodes.set(key,{card,title:card.querySelector('h3'),status:card.querySelector('.ready-page-status'),steps:[...card.querySelectorAll('li')],note:card.querySelector('.ready-page-note'),open:card.querySelector('a'),retry:card.querySelector('button')});
 }
 function target(key){return key==='market'?win:doc.querySelector('iframe[data-morning-page="'+key+'"]')?.contentWindow;}
 function sample(key){
  const t=target(key);if(!t)return {fresh:false,charts:false,painted:false,rendered:false,failed:false,token:''};
  try{
   const dataKey=PAGES.find(p=>p.key===key).dataKey;
   const status=t.__morningPreloadState?.[dataKey],checked=t.__morningDataState?.[dataKey],render=t.__morningRenderState?.[key],d=t.document;
   const rendered=['market','funds'].includes(key)?!!d.querySelector('#cards')?.childElementCount:['stocks','japan'].includes(key)?d.querySelectorAll('.stock-tile').length>=(key==='japan'?4:12):key==='rsi'?!!d.querySelector('#rsi-chart svg'):d.querySelectorAll('.tile').length>0;
   const fresh=status==='準備完了',token=checked&&render?String(checked.checkedAt)+':'+render.generatedAt:'';
   const charts=fresh&&rendered&&!!render&&!!checked&&render.generatedAt===checked.generatedAt;
   return {fresh,charts,painted:charts&&painted.get(key)===token,rendered,failed:status==='再確認が必要',saved:rendered,savedAt:render?.generatedAt,token};
  }catch{return {fresh:false,charts:false,painted:false,rendered:false,failed:false,token:''};}
 }
 function render(){
  const states=Object.fromEntries(Object.keys(names).map(key=>[key,sample(key)]));
  for(const [key,p]of Object.entries(states)){
   if(p.charts&&!p.painted&&scheduled.get(key)!==p.token){
    const token=p.token;scheduled.set(key,token);
    win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>{if(sample(key).token===token)painted.set(key,token);if(scheduled.get(key)===token)scheduled.delete(key);}));
   }
  }
  const now=Date.now(),fingerprint=JSON.stringify(Object.entries(states).map(([key,p])=>[key,p.fresh,p.charts,p.painted,p.failed,p.token]));
  if(fingerprint!==previousProgress){lastAdvance=now;previousProgress=fingerprint;}
  const model=readiness(states,now-lastAdvance);
  if(wasReady&&model.kind!=='ready'){started=now;completedAt=null;lastAdvance=now;}
  if(model.kind==='ready'&&!completedAt)completedAt=now;
  wasReady=model.kind==='ready';
  const phase=model.phase==='starting'&&now-started>1200?'working':model.phase;
  const elapsed=Math.max(0,Math.floor(((completedAt||now)-started)/1000));
  doc.getElementById('ready-alert-elapsed').textContent=(completedAt?'完了まで ':'経過 ')+elapsed+'秒';
  const signature=JSON.stringify({model,phase});if(signature===previousModel)return;previousModel=signature;
  alert.dataset.state=model.kind;alert.dataset.phase=phase;alert.hidden=false;
  if(model.kind==='partial')alert.querySelector('.ready-alert-details').open=true;
  const titles={starting:'6ページの確認を開始しました',working:'6ページの準備を進めています',complete:'全6ページの準備ができました',stalled:'準備に時間がかかっています',failed:'一部の更新を確認できません'};
  doc.getElementById('ready-alert-title').textContent=titles[phase];
  doc.getElementById('ready-alert-icon').textContent=model.kind==='ready'?'✓':model.kind==='partial'?'!':'↻';
  doc.getElementById('ready-alert-count').textContent=model.complete+' / 6 ページ完了';
  doc.getElementById('ready-alert-progress-label').textContent='確認済み '+model.done+' / 18項目';
  const bar=doc.getElementById('ready-alert-progress');bar.setAttribute('aria-valuenow',String(model.done));bar.setAttribute('aria-valuetext',model.done+' / 18項目、'+model.complete+' / 6ページ完了');
  [...bar.children].forEach((el,i)=>el.classList.toggle('done',i<model.done));
  const waiting=model.items.filter(p=>!p.complete).map(p=>p.label).join('・');
  const detail=model.kind==='ready'?'6ページのデータと画面構成を確認しました。各ページを開くと表示します。':model.failed?'更新を確認できないページがあります。保存済みの表示は日時を確認してください。':model.stalled?'20秒以上、確認項目の完了に変化がありません。処理を待つか、未完了のページを再確認できます。':waiting+'を準備しています。完了したページは開けます。';
  doc.getElementById('ready-alert-detail').textContent=detail;
  doc.getElementById('ready-alert-foot').textContent=model.kind==='ready'?'保存済みデータを利用して各ページを開けます。数値の公表日時は各パネルで確認できます。':'進捗は完了した確認項目の数です。通信量の割合ではありません。';
  doc.getElementById('ready-alert-retry').hidden=model.kind!=='partial';
  for(const p of model.items){
   const n=nodes.get(p.key),active=p.failed?'failed':p.complete?'complete':p.done===0?'fetching':p.done===1?'charts':'painting';
   n.card.dataset.stage=active;n.card.dataset.ready=String(p.complete);
   n.title.textContent=(p.complete?'✓ ':p.failed?'! ':'')+p.label;
   n.status.textContent=p.failed?'再確認が必要':p.complete?'完了':model.stalled?'確認を継続中':p.done===0?'データ確認中':p.done===1?'グラフ準備中':'表示準備中';
   n.steps.forEach((li,i)=>{li.dataset.state=p.steps[i]?'done':!p.failed&&i===p.done?'active':'waiting';li.firstElementChild.textContent=p.steps[i]?'✓':!p.failed&&i===p.done?'↻':'○';});
   n.note.textContent=p.failed?(p.saved?'保存済みデータを表示中':'表示できるデータを確認できません'):!p.fresh&&p.saved?'保存済みの表示を残して更新確認中':p.complete?'データ・画面構成の準備完了':'';
   n.open.hidden=!p.complete&&!p.saved;n.open.textContent=p.complete?'ページを開く →':'保存済みの表示を開く →';
   n.retry.hidden=!(p.failed||model.stalled&&!p.complete);
  }
 }
 function retry(key){
  const t=target(key);started=Date.now();lastAdvance=started;completedAt=null;previousModel='';
  painted.delete(key);scheduled.delete(key);
  if(t?.__morningRefreshReady)t.dispatchEvent(new t.Event('morning-refresh'));
  else if(key==='market')doc.getElementById('refresh')?.click();
  else{const frame=doc.querySelector('iframe[data-morning-page="'+key+'"]');if(frame)frame.src=frame.src;}
  render();
 }
 alert.addEventListener('click',e=>{
  const button=e.target.closest('[data-ready-retry]');if(button){retry(button.dataset.readyRetry);return;}
  if(e.target.closest('#ready-alert-retry'))for(const key of Object.keys(names)){const p=sample(key);if(!p.fresh||!p.charts||!p.painted||p.failed)retry(key);}
 });
 doc.querySelector('#refresh')?.addEventListener('click',()=>{started=Date.now();lastAdvance=started;completedAt=null;previousModel='';painted.clear();scheduled.clear();});
 render();let timer=win.setInterval(render,300);
 win.addEventListener('pagehide',()=>win.clearInterval(timer));
 win.addEventListener('pageshow',event=>{if(event.persisted){win.clearInterval(timer);render();timer=win.setInterval(render,300);}});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')mountReadyAlert();
