import {PERIODS,chartPoints,nyDate} from './stocks-logic.js?v=period-high-20261009';
const num=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function chartDomain(points,period){
 const values=points.flatMap(p=>period==='1d'?[p.value]:[p.value,p.ma25,p.ma75]).filter(Number.isFinite);
 if(!values.length)return {lo:0,hi:1,ticks:[0,1],decimals:2};
 const low=Math.min(...values),high=Math.max(...values),pad=Math.max((high-low)*.08,high*(period==='1d'?.0001:.002));
 const lo=Math.max(0,low-pad),hi=high+pad,raw=(hi-lo)/5,power=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(n=>n*power).find(n=>n>=raw)||10*power;
 const ticks=[];for(let v=Math.ceil(lo/step)*step;v<=hi+step*.001;v+=step)ticks.push(Number(v.toPrecision(12)));
 return {lo,hi,ticks,decimals:Math.min(4,Math.max(0,-Math.floor(Math.log10(step)))+(step/power===2.5?1:0))};
}
export function stockGraph(stock,period){
 const pts=chartPoints(stock.price||{},period);
 if(!pts.length)return '<div class="empty">この期間のチャートを取得できていません。</div>';
 const daily=period==='1m',intraday=period==='1d',w=720,h=daily?390:360,left=84,right=704,top=18,bottom=252,volumeTop=274,volumeBottom=324;
 const {lo,hi,ticks,decimals}=chartDomain(pts,period),prices=pts.map(p=>p.value),min=Math.min(...prices),max=Math.max(...prices);
 const x=i=>pts.length===1?(left+right)/2:left+(right-left)*i/(pts.length-1),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
 const path=key=>{let pen=false;return pts.map((p,i)=>{if(!Number.isFinite(p[key])){pen=false;return '';}const cmd=pen?'L':'M';pen=true;return cmd+x(i).toFixed(2)+','+y(p[key]).toFixed(2);}).join(' ');};
 const line=path('value'),last=pts.at(-1);
 const grid=ticks.map(v=>'<line x1="'+left+'" y1="'+y(v)+'" x2="'+right+'" y2="'+y(v)+'" stroke="#e4e9ec"/><text x="'+(left-10)+'" y="'+(y(v)+4)+'" text-anchor="end">'+num(v,decimals)+'</text>').join('');
 const indices=daily?pts.map((p,i)=>i):[...new Set([0,Math.round((pts.length-1)/3),Math.round((pts.length-1)*2/3),pts.length-1])];
 const labels=indices.map(i=>{
 const date=nyDate(pts[i].time),label=intraday?new Intl.DateTimeFormat('ja-JP',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(pts[i].time*1000)):daily?date.slice(5).replace('-','/'):date.slice(2).replaceAll('-','/');
 return '<text '+(daily?'class="daily-date" transform="rotate(-45 '+x(i)+' 350)"':'')+' x="'+x(i)+'" y="'+(daily?350:352)+'" text-anchor="'+(daily?'end':i===0?'start':i===pts.length-1?'end':'middle')+'">'+label+'</text>';
 }).join('');
 const volumes=pts.map(p=>p.volume).filter(v=>Number.isFinite(v)&&v>=0),vmax=Math.max(1,...volumes),barWidth=Math.max(.7,Math.min(9,(right-left)/pts.length*.7));
 const bars=pts.map((p,i)=>Number.isFinite(p.volume)&&p.volume>=0?'<rect x="'+(x(i)-barWidth/2)+'" y="'+(volumeBottom-p.volume/vmax*(volumeBottom-volumeTop))+'" width="'+barWidth+'" height="'+(p.volume/vmax*(volumeBottom-volumeTop))+'" fill="#5797e4"/>':'').join('');
 const id='fill-'+stock.symbol,color='#15536b';
 const legend='<div class="chart-legend"><span class="legend-price">株価 <strong>'+num(last.value)+'</strong></span>'+(intraday?'':'<span class="legend-ma25">25日線 <strong>'+num(last.ma25)+'</strong></span><span class="legend-ma75">75日線 <strong>'+num(last.ma75)+'</strong></span>')+'</div>';
 const area=pts.length>1?'<path d="'+line+' L'+x(pts.length-1)+','+bottom+' L'+x(0)+','+bottom+' Z" fill="url(#'+id+')"/>':'';
 const averages=intraday?'':'<path data-ma="25" d="'+path('ma25')+'" fill="none" stroke="#ee303b" stroke-width="2.6"/><path data-ma="75" d="'+path('ma75')+'" fill="none" stroke="#3168ff" stroke-width="2.6"/>';
 const markers=(daily?pts:[last]).map(p=>{const i=daily?pts.indexOf(p):pts.length-1;return '<circle '+(daily?'data-daily-point="'+nyDate(p.time)+'"':'')+' cx="'+x(i)+'" cy="'+y(p.value)+'" r="'+(daily?3.3:4)+'" fill="'+color+'" stroke="white" stroke-width="1"><title>'+nyDate(p.time)+' '+num(p.value)+' USD</title></circle>';}).join('');
 const note=intraday?'当日の5分足の株価だけで縦軸を調整。値幅が縮まらないよう25・75日線は1日表示では省略。':daily?'各営業日の終値を●で表示し、全営業日の日付を併記。土日・休場日の株価は作成しません。横にスクロールできます。':period==='1w'?'通常取引の5分足。25・75日線は前取引日までの終値で計算。':'25・75日線は25・75取引日の終値の単純平均。日数不足は表示しません。';
 return legend+'<div class="chart-wrap'+(daily?' daily-detail':'')+'"><svg class="stock-chart" data-chart="'+stock.symbol+'" data-period="'+period+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(stock.name)+' '+PERIODS.find(p=>p[0]===period)[1]+'の株価'+(intraday?'':'と移動平均')+'"><title>'+esc(stock.name)+' 最低 '+num(min)+'、最高 '+num(max)+' USD</title><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity=".28"/><stop offset="100%" stop-color="'+color+'" stop-opacity=".02"/></linearGradient></defs>'+grid+area+'<path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="2.4" stroke-linejoin="round"/>'+averages+markers+'<text x="'+(left-10)+'" y="294" text-anchor="end">出来高</text>'+bars+'<line x1="'+left+'" y1="'+volumeBottom+'" x2="'+right+'" y2="'+volumeBottom+'" stroke="#dfe6ec"/>'+labels+'</svg></div><div class="chart-footer"><span>'+nyDate(pts[0].time).replaceAll('-','/')+'〜'+nyDate(last.time).replaceAll('-','/')+' · '+pts.length+(daily?'営業日（日次）':'点')+'</span><span>最低 <strong>'+num(min)+'</strong> ／ 最高 <strong>'+num(max)+'</strong></span></div><p class="chart-hover" aria-live="off">グラフに触れると日付・株価・出来高を表示</p><p class="chart-note">'+note+' '+(volumes.length<pts.length?'出来高の未取得部分は表示しません。':'')+'出典：Yahoo Finance。</p>';
}
