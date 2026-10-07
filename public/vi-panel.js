import {selectVixHistory} from './logic.js?v=vix-20261006';

export const VI_BANDS=[
 {key:'low',max:20,range:'20未満',label:'比較的穏やか',color:'#16886f',meaning:'予想される値動きが比較的小さい状態。',reading:'値動きへの警戒は比較的低い水準。ただし、急変が起きないことを保証する数値ではありません。'},
 {key:'normal',max:30,range:'20〜30',label:'平時の参考範囲',color:'#2563b8',meaning:'歴史的な平時の参考範囲にある状態。',reading:'市場環境によって普段の水準は変わります。直近の推移や上昇速度も合わせて確認します。'},
 {key:'watch',max:40,range:'30〜40',label:'警戒',color:'#946618',meaning:'大きな値動きへの警戒が強まっている状態。',reading:'追加購入を検討する際は、株価の下落率・業績・資金余力を確認。上昇か下落かの方向は示しません。'},
 {key:'high',max:50,range:'40〜50',label:'強い警戒',color:'#c35d12',meaning:'高い変動リスクが予想されている状態。',reading:'価格が大きく動く可能性に注意。数値が高くても、底値や買い時が確定したわけではありません。'},
 {key:'very-high',max:Infinity,range:'50以上',label:'非常に高い変動',color:'#bc303c',meaning:'非常に高い変動リスクが予想されている状態。',reading:'相場の急変に注意する参考水準。50は独自区分の境界で、公式の危険判定や売買基準ではありません。'}
];
export function viBand(value){
 if(!Number.isFinite(value)||value<0)return null;
 return VI_BANDS.find(b=>value<b.max)||null;
}
export function viHistory(points,months){
 return selectVixHistory((points||[]).filter(p=>viBand(p.value)),months);
}
function viChart(points){
 if(points.length<2)return '<div class="vix-chart-empty">推移データを蓄積中です</div>';
 const low=Math.min(...points.map(p=>p.value)),high=Math.max(...points.map(p=>p.value));
 const start=Date.parse(points[0].date),end=Date.parse(points.at(-1).date);
 const ceiling=Math.max(60,Math.ceil((high+5)/10)*10);
 const x=p=>44+(Date.parse(p.date)-start)/(end-start)*578,y=v=>250-v/ceiling*220;
 const line=points.map(p=>x(p).toFixed(2)+','+y(p.value).toFixed(2)).join(' ');
 const limits=[0,20,30,40,50,ceiling];
 const bands=VI_BANDS.map((b,i)=>'<rect x="44" y="'+y(limits[i+1])+'" width="578" height="'+(y(limits[i])-y(limits[i+1]))+'" fill="'+b.color+'" opacity=".09"/>').join('');
 const grid=Array.from({length:ceiling/10+1},(_,i)=>i*10).map(v=>'<line x1="44" x2="622" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#ccd8dc" stroke-dasharray="3 4"/><text x="34" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>').join('');
 const labels=Array.from({length:4},(_,i)=>{const p=points[Math.round(i*(points.length-1)/3)];return '<text x="'+x(p)+'" y="278" text-anchor="'+(i===0?'start':i===3?'end':'middle')+'">'+p.date.slice(2).replaceAll('-','/')+'</text>';}).join('');
 const last=points.at(-1),color=viBand(last.value).color;
 return '<svg class="vix-chart vi-chart" viewBox="0 0 640 290" role="img" aria-label="日経VIの日次終値の推移。数値が高いほど予想変動幅が大きい">'+bands+grid+'<polyline points="'+line+'" stroke="#193f54" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/><circle cx="'+x(last)+'" cy="'+y(last.value)+'" r="5" fill="'+color+'"><title>'+last.date+'：'+last.value.toFixed(2)+'</title></circle>'+labels+'</svg><div class="vix-chart-caption"><span>'+points[0].date.replaceAll('-','/')+'〜'+last.date.replaceAll('-','/')+' · '+points.length+'回の公表値</span><span>最低 <b>'+low.toFixed(2)+'</b> ／ 最高 <b>'+high.toFixed(2)+'</b></span></div>';
}
export function viCard(m,q,sig,months,{escape,datetime}){
 const band=q.usable?viBand(m.value):null,ps=viHistory(m.history,months);
 const valid=viBand(m.value),score=valid?m.value.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
 const change=Number.isFinite(m.change)?(m.change>0?'↑ +':m.change<0?'↓ −':'→ ')+Math.abs(m.change).toLocaleString('ja-JP',{maximumFractionDigits:2})+' ポイント':'前回比 —';
 const direction=Number.isFinite(m.change)?m.change>0?'予想変動幅が拡大':m.change<0?'予想変動幅が縮小':'前回と同じ水準':'前回比は未取得';
 const label=band?band.label:'判定保留';
 const legend=VI_BANDS.map(b=>'<li class="'+(band?.key===b.key?'active':'')+'" style="--band-color:'+b.color+'"><strong>'+b.range+'</strong><span>'+b.label+'</span>'+(band?.key===b.key?'<small>現在</small>':'')+'</li>').join('');
 const buttons=[3,6,12].map(n=>'<button type="button" data-vi-months="'+n+'" class="'+(n===months?'selected':'')+'" aria-pressed="'+(n===months)+'">'+(n===12?'1年':n+'か月')+'</button>').join('');
 const rows=ps.slice().reverse().map(p=>'<tr><td>'+escape(p.date)+'</td><td style="color:'+viBand(p.value).color+';font-weight:750">'+p.value.toFixed(2)+' · '+viBand(p.value).label+'</td></tr>').join('');
 const url=/^https:\/\//.test(m.sourceUrl)?m.sourceUrl:'#';
 return '<article class="card vix-card vi-card '+(q.usable?sig.tone:'')+'" data-band="'+(band?.key||'unknown')+'" aria-label="日経VI" style="--vix-color:'+(band?.color||'#61757d')+'"><div class="card-head"><h3 class="card-title">日経VI（予想変動幅）</h3><span class="vix-close">日本株市場 · 日次終値</span></div><div class="vix-layout"><div class="vix-reading"><div class="value vix-value">'+score+'</div><div class="change vix-change">'+change+'</div><div class="badge vix-badge">'+label+'</div><ul class="vix-legend vi-legend" aria-label="日経VIの独自参考区分">'+legend+'</ul><p class="vix-guide">独自の参考区分です。20・30・40・50は上の区分に含めます。公式の5段階分類や売買の指示ではありません。</p></div><div class="vix-plot"><div class="vi-interpretation"><strong>'+label+'：'+(band?band.meaning:'公表日時・取得状況を確認してください。')+'</strong><p>'+(band?band.reading:'表示値とグラフは参考値です。古い値や取得失敗の値で現在の変動リスクを判定しません。')+'</p><span>'+(band?'前回比：'+direction:'現在の判定は保留')+'</span></div><div class="vix-plot-head"><strong>日経VIの推移</strong><div class="range vix-range" aria-label="日経VIグラフの期間">'+buttons+'</div></div>'+viChart(ps)+'<p class="vix-series-note">取得済みの公表値のみ表示。選択期間より履歴が短い場合は、取得できた範囲だけを表示します。欠けた日の値は補間しません。</p><details class="history-details"><summary>日経VIの数値の推移を見る</summary><table aria-label="日経VIの日次推移"><tbody>'+(rows||'<tr><td>未取得</td></tr>')+'</tbody></table></details></div></div><div class="vi-explanation"><strong>どう読む？</strong><p>日経平均の今後約1か月の予想変動幅を、年率に換算した指数です。日経平均のオプション価格から算出され、高いほど大きな値動きが予想されています。</p><p>日経の公式解説では、歴史的に平時はおおむね20〜30、30・40が注目される節目とされています。上の名称・色・50の境界は独自の目安です。株価の上昇・下落の方向や底値を示すものではありません。</p><a href="https://indexes.nikkei.co.jp/atoz/2016/07/vi.html" target="_blank" rel="noopener noreferrer">日経の公式解説 ↗</a></div><div class="meta vix-meta"><p class="quality">'+(q.usable?'●':'⚠')+' '+escape(q.label)+'</p><span>'+escape(m.kind||'未取得')+' · 公表 '+datetime(m.asOf)+' · 取得成功 '+datetime(m.lastSuccess)+'</span><a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(m.source)+' ↗</a>'+(m.error?'<details><summary>取得エラー</summary>'+escape(m.error)+'</details>':'')+'</div></article>';
}
