const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>Number(v).toFixed(2)+'%';
export function drawdownPanel(m){
 if(!['fang','nasdaq'].includes(m.id))return '';
 const d=m.drawdown;
 if(!d)return '<section class="drawdown-panel"><h4>最高値からの下落と回復</h4><p>比較データを読み込めませんでした。「更新を確認」で再取得できます。</p></section>';
 const years=[d.currentYear-1,d.currentYear],colors=['#21617c','#ed7a19'],series=years.map(y=>d.years[y]||[]);
 if(series.some(a=>!a.length))return '';
 const min=series.map(a=>a.reduce((a,b)=>b.value<a.value?b:a)),last=series[1].at(-1);
 const floor=Math.min(-10,Math.floor(Math.min(...min.map(p=>p.value))/5)*5),n=Math.max(245,...series.map(a=>a.length));
 const x=i=>58+i/(n-1)*646,y=v=>28+v/floor*244;
 const grid=Array.from({length:Math.abs(floor)/5+1},(_,i)=>{const v=-i*5;return `<line x1="58" y1="${y(v)}" x2="704" y2="${y(v)}" stroke="${i?'#e1e6eb':'#52616c'}"/><text x="49" y="${y(v)+5}" text-anchor="end">${v}%</text>`;}).join('');
 const ticks=[1,60,120,180,240].filter(t=>t<=n).map(t=>`<text x="${x(t-1)}" y="299" text-anchor="middle">${t}</text>`).join('');
 const lines=series.map((a,j)=>`<polyline points="${a.map((p,i)=>`${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')}" fill="none" stroke="${colors[j]}" stroke-width="2.7"/>`+
 a.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="5" fill="transparent"><title>${p.date}：${pct(p.value)}</title></circle>`).join('')).join('');
 const summary=min.map((p,j)=>`<div style="--dd-color:${colors[j]}"><span>${years[j]}年 最大下落</span><strong>${pct(p.value)}</strong><small>${p.date.replaceAll('-','/')}</small></div>`).join('')+`<div style="--dd-color:#148351"><span>${d.asOf.slice(5).replace('-','/')} 現在</span><strong>${pct(last.value)}</strong><small>${last.value===0?'最高値に回復・更新':'最高値からの下落率'}</small></div>`;
 return `<section class="drawdown-panel" aria-label="${esc(d.name)}の昨年と今年のドローダウン比較"><h4>最高値からの下落と回復</h4><p class="drawdown-source">${esc(d.name)}・円建て基準価額${m.id==='nasdaq'?'（比較用：SBIとは別の投資信託）':''}</p><div class="drawdown-summary">${summary}</div><div class="drawdown-legend"><span style="color:${colors[0]}">━ ${years[0]}年</span><span style="color:${colors[1]}">━ ${years[1]}年（${d.asOf.slice(5).replace('-','/')}まで）</span></div><svg class="drawdown-chart" viewBox="0 0 720 330" role="img" aria-label="${years[0]}年最大下落${pct(min[0].value)}、${years[1]}年最大下落${pct(min[1].value)}。現在${pct(last.value)}">${grid}${lines}${ticks}<text x="380" y="325" text-anchor="middle">年初からの営業日（公表日順）</text></svg><p class="drawdown-guide">0%＝最高値に回復・更新。下に深いほど最高値に対して安い状態です。</p><details><summary>計算方法・データの公表日</summary><p>下落率＝（当日の基準価額 ÷ その日までの設定来最高基準価額 − 1）×100。最高値は年初にリセットしません。${esc(d.startDate)}から計算、${esc(d.asOf)}まで。両年の同じ営業日番号は同じ月日とは限りません。休業日や未来の値は補間しません。積立運用の利益率ではありません。</p><a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">大和アセットの公表データ ↗</a></details>${d.error?`<p class="drawdown-source">${esc(d.error)}（公表日 ${esc(d.asOf)}）</p>`:''}</section>`;
}
