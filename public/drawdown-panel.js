const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>Number(v).toFixed(2)+'%';
export function drawdownPanel(m){
 if(!['fang','nasdaq','nasdaq_ifree','sp500_slim','allcountry_slim','schd','au_nasdaq_leverage','au_nasdaq_triple','tqqq','soxl'].includes(m.id))return '';
 const d=m.drawdown;
 if(!d)return '<section class="drawdown-panel"><h4>最高値からの下落と回復</h4><p>比較データを読み込めませんでした。「更新を確認」で再取得できます。</p></section>';
 const pairs=[{year:d.currentYear-1,color:'#21617c'},{year:d.currentYear,color:'#ed7a19'}].filter(p=>d.years[p.year]?.length);
 if(!pairs.length)return '';
 const years=pairs.map(p=>p.year),colors=pairs.map(p=>p.color),series=years.map(y=>d.years[y]);
 const min=series.map(a=>a.reduce((a,b)=>b.value<a.value?b:a)),last=series.at(-1).at(-1);
 const floor=Math.min(-10,Math.floor(Math.min(...min.map(p=>p.value))/5)*5),n=years.length===1?Math.max(2,series[0].length):Math.max(245,...series.map(a=>a.length));
 const x=i=>58+i/(n-1)*646,y=v=>28+v/floor*244;
 const grid=Array.from({length:Math.abs(floor)/5+1},(_,i)=>{const v=-i*5;return `<line x1="58" y1="${y(v)}" x2="704" y2="${y(v)}" stroke="${i?'#e1e6eb':'#52616c'}"/><text x="49" y="${y(v)+5}" text-anchor="end">${v}%</text>`;}).join('');
 const ticks=(years.length===1?[...new Set([1,Math.round(n/3),Math.round(n*2/3),n])]:[1,60,120,180,240]).filter(t=>t>0&&t<=n).map(t=>`<text x="${x(t-1)}" y="299" text-anchor="middle">${t}</text>`).join('');
 const lines=series.map((a,j)=>`<polyline points="${a.map((p,i)=>`${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')}" fill="none" stroke="${colors[j]}" stroke-width="2.7"/>`+
 a.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="5" fill="transparent"><title>${p.date}：${pct(p.value)}</title></circle>`).join('')).join('');
 const summary=min.map((p,j)=>`<div style="--dd-color:${colors[j]}"><span>${years[j]}年 最大下落</span><strong>${pct(p.value)}</strong><small>${p.date.replaceAll('-','/')}</small></div>`).join('')+`<div style="--dd-color:#148351"><span>${d.asOf.slice(5).replace('-','/')} 現在</span><strong>${pct(last.value)}</strong><small>${last.value===0?'最高値に回復・更新':'最高値からの下落率'}</small></div>`;
 return `<section class="drawdown-panel" aria-label="${esc(d.name)}の${years.join('・')}年のドローダウン"><h4>最高値からの下落と回復</h4><p class="drawdown-source">${esc(d.name)}・${['tqqq','soxl'].includes(m.id)?'米ドル建て・分割調整済み終値':'円建て基準価額'}${m.id==='nasdaq'?'（比較用：SBIとは別の投資信託）':''}</p><div class="drawdown-summary">${summary}</div>${years.length===1?`<p class="drawdown-source">取得済み期間 ${esc(d.startDate)}〜${esc(d.asOf)}。前年の取得データがないため、${years[0]}年のみ表示します。</p>`:''}<div class="drawdown-legend">${years.map((year,i)=>`<span style="color:${colors[i]}">━ ${year}年${year===d.currentYear?'（'+d.asOf.slice(5).replace('-','/')+'まで）':''}</span>`).join('')}</div><svg class="drawdown-chart" viewBox="0 0 720 330" role="img" aria-label="${min.map((p,i)=>years[i]+'年最大下落'+pct(p.value)).join('、')}。現在${pct(last.value)}">${grid}${lines}${ticks}<text x="380" y="325" text-anchor="middle">${years.length===1?'取得開始からの公表日':'年初からの営業日（公表日順）'}</text></svg><p class="drawdown-guide">0%＝最高値に回復・更新。下に深いほど最高値に対して安い状態です。</p>${d.distributionNote?`<p class="drawdown-source">${esc(d.distributionNote)}</p>`:''}<details><summary>計算方法・データの公表日</summary><p>${['tqqq','soxl'].includes(m.id)?'下落率＝（当日の分割調整済み終値 ÷ その日までの上場来最高終値 − 1）×100。分配金再投資は含みません。':'下落率＝（当日の基準価額 ÷ その日までの設定来最高基準価額 − 1）×100。'}最高値は年初にリセットしません。${esc(d.startDate)}から計算、${esc(d.asOf)}まで。${years.length>1?'両年の同じ営業日番号は同じ月日とは限りません。':''}休業日や未来の値は補間しません。積立運用の利益率ではありません。</p><a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(d.sourceLabel||'大和アセットの公表データ')} ↗</a></details>${d.error?`<p class="drawdown-source">${esc(d.error)}（公表日 ${esc(d.asOf)}）</p>`:''}</section>`;
}


