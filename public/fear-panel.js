import {changePercent,percentLine} from './change-format.js?v=twoline-20261007';
import {selectVixHistory} from './logic.js?v=vix-20261006';

export const FEAR_BANDS=[
 {key:'extreme-fear',max:25,range:'0〜24',label:'極度の恐怖',color:'#bc303c',meaning:'市場全体の不安が非常に強い状態。',reading:'売られ過ぎの可能性を調べる目安。ただし、底値とは限らず、さらに下がることもあります。'},
 {key:'fear',max:45,range:'25〜44',label:'恐怖',color:'#c35d12',meaning:'投資家が慎重で、不安が強い状態。',reading:'購入候補の業績と、最高値からの下落率を確認。同じ数値でも下落中か回復中かを見ます。'},
 {key:'neutral',max:55,range:'45〜55',label:'中立',color:'#946618',meaning:'恐怖と利益への期待が拮抗している状態。',reading:'この数値だけでは買い・売りを判断できません。価格と業績を合わせて確認します。'},
 {key:'greed',max:75,range:'56〜75',label:'強欲',color:'#16886f',meaning:'利益への期待が強く、投資家が強気な状態。',reading:'上昇が続くこともあります。期待だけで高値を追わず、割高でないかを確認します。'},
 {key:'extreme-greed',max:100,range:'76〜100',label:'極度の強欲',color:'#2563b8',meaning:'市場全体が非常に強気な状態。',reading:'過熱に注意する目安。ただし、天井や売り時を確定するものではありません。'}
];
export function fearBand(value){
 if(!Number.isFinite(value)||value<0||value>100)return null;
 return FEAR_BANDS.find((b,i)=>i<2?value<b.max:value<=b.max)||null;
}
export function fearHistory(points,months){
 return selectVixHistory((points||[]).filter(p=>fearBand(p.value)),months);
}
function fearChart(points){
 if(points.length<2)return '<div class="vix-chart-empty">推移データを蓄積中です</div>';
 const low=Math.min(...points.map(p=>p.value)),high=Math.max(...points.map(p=>p.value));
 const start=Date.parse(points[0].date),end=Date.parse(points.at(-1).date);
 const x=p=>44+(Date.parse(p.date)-start)/(end-start)*578,y=v=>250-v*2.2;
 const line=points.map(p=>x(p).toFixed(2)+','+y(p.value).toFixed(2)).join(' ');
 const limits=[0,25,45,55,75,100];
 const bands=FEAR_BANDS.map((b,i)=>'<rect x="44" y="'+y(limits[i+1])+'" width="578" height="'+(y(limits[i])-y(limits[i+1]))+'" fill="'+b.color+'" opacity=".09"/>').join('');
 const grid=[0,25,45,55,75,100].map(v=>'<line x1="44" x2="622" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#ccd8dc" stroke-dasharray="3 4"/><text x="34" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>').join('');
 const labels=Array.from({length:4},(_,i)=>{const p=points[Math.round(i*(points.length-1)/3)];return '<text x="'+x(p)+'" y="278" text-anchor="'+(i===0?'start':i===3?'end':'middle')+'">'+p.date.slice(2).replaceAll('-','/')+'</text>';}).join('');
 const last=points.at(-1),color=fearBand(last.value).color;
 return '<svg class="vix-chart fear-chart" viewBox="0 0 640 290" role="img" aria-label="Fear &amp; Greedの推移。0が強い恐怖、100が強い強欲">'+bands+grid+'<polyline points="'+line+'" stroke="#193f54" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/><circle cx="'+x(last)+'" cy="'+y(last.value)+'" r="5" fill="'+color+'"><title>'+last.date+'：'+last.value.toFixed(1)+'</title></circle>'+labels+'</svg><div class="vix-chart-caption"><span>'+points[0].date.replaceAll('-','/')+'〜'+last.date.replaceAll('-','/')+' · '+points.length+'回の公表値</span><span>最低 <b>'+low.toFixed(1)+'</b> ／ 最高 <b>'+high.toFixed(1)+'</b></span></div>';
}
export function fearCard(m,q,sig,months,{escape,datetime}){
 const band=q.usable?fearBand(m.value):null,ps=fearHistory(m.history,months);
 const valid=fearBand(m.value),score=valid?m.value.toLocaleString('ja-JP',{maximumFractionDigits:1}):'—';
 const change=Number.isFinite(m.change)?(m.change>0?'↑ +':m.change<0?'↓ −':'→ ')+Math.abs(m.change).toLocaleString('ja-JP',{maximumFractionDigits:2})+' ポイント':'前回比 —';
 const direction=Number.isFinite(m.change)?m.change>0?'強気の方向へ':m.change<0?'恐怖の方向へ':'前回と同じ水準':'前回比は未取得';
 const label=band?band.label:'判定保留';
 const legend=FEAR_BANDS.map(b=>'<li class="'+(band?.key===b.key?'active':'')+'" style="--band-color:'+b.color+'"><strong>'+b.range+'</strong><span>'+b.label+'</span>'+(band?.key===b.key?'<small>現在</small>':'')+'</li>').join('');
 const buttons=[3,6,12].map(n=>'<button type="button" data-fear-months="'+n+'" class="'+(n===months?'selected':'')+'" aria-pressed="'+(n===months)+'">'+(n===12?'1年':n+'か月')+'</button>').join('');
 const rows=ps.slice().reverse().map(p=>'<tr><td>'+escape(p.date)+'</td><td style="color:'+fearBand(p.value).color+';font-weight:750">'+p.value.toFixed(1)+' · '+fearBand(p.value).label+'</td></tr>').join('');
 const url=/^https:\/\//.test(m.sourceUrl)?m.sourceUrl:'#';
 return '<article class="card vix-card fear-card '+(q.usable?sig.tone:'')+'" data-band="'+(band?.key||'unknown')+'" aria-label="Fear &amp; Greed" style="--vix-color:'+(band?.color||'#61757d')+'"><div class="card-head"><h3 class="card-title">Fear &amp; Greed（市場心理）</h3><span class="vix-close">米国株市場 · 0〜100</span></div><div class="vix-layout"><div class="vix-reading"><div class="value vix-value">'+score+'<small> / 100</small></div><div class="change vix-change">'+ '<span class="change-amount">'+change+'</span>'+percentLine(changePercent(m))+'</div><div class="badge vix-badge">'+label+'</div><ul class="vix-legend fear-legend" aria-label="市場心理の5段階の色分け">'+legend+'</ul><p class="vix-guide">一覧は整数表示の区分。小数値は25未満／45未満／55以下／75以下／75超で判定します。色は市場心理を示し、売買の指示ではありません。</p></div><div class="vix-plot"><div class="fear-interpretation"><strong>'+label+'：'+(band?band.meaning:'公表日時・取得状況を確認してください。')+'</strong><p>'+(band?band.reading:'表示値とグラフは参考値です。古い値や取得失敗の値で現在の市場心理を判定しません。')+'</p><span>'+(band?'前回比：'+direction:'現在の判定は保留')+'</span></div><div class="vix-plot-head"><strong>Fear &amp; Greedの推移</strong><div class="range vix-range" aria-label="Fear &amp; Greedグラフの期間">'+buttons+'</div></div>'+fearChart(ps)+'<p class="vix-series-note">取得済みの公表値のみ表示。選択期間より履歴が短い場合は、取得できた範囲だけを表示します。欠けた日の値は補間しません。</p><details class="history-details"><summary>Fear &amp; Greedの数値の推移を見る</summary><table aria-label="Fear &amp; Greedの日次推移"><tbody>'+(rows||'<tr><td>未取得</td></tr>')+'</tbody></table></details></div></div><div class="fear-explanation"><strong>どう読む？</strong><p>低いほど恐怖、高いほど強欲。株価の勢い・上昇銘柄の広がり・VIXなど7つの市場指標を同じ重みでまとめた指標です。投資家へのアンケートではありません。</p><p>購入タイミングは、最高値からの下落率・企業業績・割高か割安かと合わせて検討。低い値でも下落は続き、高い値でも上昇は続くことがあります。</p><a href="https://www.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer">CNNの指標・算出方法 ↗</a></div><div class="meta vix-meta"><p class="quality">'+(q.usable?'●':'⚠')+' '+escape(q.label)+'</p><span>'+escape(m.kind||'未取得')+' · 公表 '+datetime(m.asOf)+' · 取得成功 '+datetime(m.lastSuccess)+'</span><a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(m.source)+' ↗</a>'+(m.error?'<details><summary>取得エラー</summary>'+escape(m.error)+'</details>':'')+'</div></article>';
}
