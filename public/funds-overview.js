import {FUND_IDS} from './asset-pages.js?v=brka-20261124-v1';
import {fundAlertState} from './fund-panel.js?v=brka-20261124-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rangeOverviewState(metrics,ranges,quality){
 const items=metrics.map(m=>{const period=ranges.get(m.id)||'6m',q=quality(m),state=fundAlertState(m,period,q);return {m,period,q,state};});
 return {items,reached:items.filter(i=>i.state.selected?.valid&&i.state.selected?.hit),
         pending:items.filter(i=>!i.q.usable||!i.state.selected?.valid),
         references:items.filter(i=>!i.q.usable&&i.state.selected?.hit)};
}
export function fundsOverviewState(metrics,ranges,quality){return rangeOverviewState(metrics.filter(m=>FUND_IDS.includes(m.id)),ranges,quality);}
export function renderFundsOverview(host,model){
 if(!host)return;
 const {reached,pending,references}=model;
 host.className='overview funds-overview'+(reached.length?' alert':'');
 host.innerHTML='<div class="overview-top"><span class="eyebrow">あなたの条件チェック · 投資信託</span><span>確認 '+(model.items.length-pending.length)+'/'+model.items.length+'銘柄</span></div><h2>'+(reached.length?(references.length?'保存値を含む条件到達 · ':'🔴 指定条件に到達 · ')+reached.length+'銘柄':pending.length?'最新値・履歴が未確認 · 判定保留':'選択期間の指定条件への到達なし')+'</h2><p>各銘柄で選択中の期間の最高値に対する80％・70％・60％・50％未満を判定します。期間を切り替えると、この一覧も更新します。上場来・取得履歴全体は含めません。</p><div class="funds-alert-list">'+reached.map(({m,state,q})=>'<a class="funds-alert-link" href="#metric-'+esc(m.id)+'" data-reference="'+!q.usable+'"><strong>'+esc(m.name)+'</strong><span>'+esc(state.selected.text)+' ／ 下落率 '+(state.selected.hit.ratio-100).toFixed(2)+'％</span><small>公表 '+esc(m.asOf||'日時未確認')+(!q.usable?' ／ 保存値・現在未確認：'+esc(q.label||'最新値を確認できません'):'')+'</small></a>').join('')+'</div>'+(pending.length?'<p class="funds-pending">更新・履歴を未確認：'+pending.map(i=>esc(i.m.name)).join(' ／ ')+'。未確認の銘柄を「条件外」には数えていません。</p>':'')+(references.length?'<p class="funds-reference-note">'+references.length+'銘柄は保存値の比較です。表示日時の条件到達を示し、現在の価格を確認できたことは意味しません。</p>':'');
}
