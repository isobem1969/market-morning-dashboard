const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A saved, calculable hit remains visible; freshness is a separate statement.
export function conditionOverview(items){
 const reached=items.filter(i=>i.condition?.valid&&i.condition.hit);
 return {items,reached,references:reached.filter(i=>i.condition.reference),pending:items.filter(i=>!i.condition?.valid||i.condition.reference)};
}
export function overviewMarkup(model,{title='指定条件に到達',clear='指定条件への到達なし',basis='' }={}){
 const {reached,references,pending}=model;
 return '<h2>'+(reached.length?(references.length?'保存値を含む ':'')+esc(title)+' · '+reached.length+'銘柄':pending.length?'最新値・履歴が未確認 · 判定保留':esc(clear))+'</h2><p>'+esc(basis)+'</p><div class="condition-overview-list">'+reached.map(i=>'<a href="'+esc(i.href)+'" data-overview-item="'+esc(i.key)+'" data-reference="'+!!i.condition.reference+'"><strong>'+esc(i.label)+'</strong><span>'+esc(i.condition.text)+'</span><small>公表 '+esc(i.asOf||'日時未確認')+(i.condition.reference?' ／ 保存値・現在未確認':'')+'</small></a>').join('')+'</div>'+(pending.length?'<p>最新値・履歴を未確認：'+pending.map(i=>esc(i.label)).join(' ／ ')+'。未確認の項目を条件外には数えていません。</p>':'');
}
