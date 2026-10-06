export const SYMBOLS=['AAPL','GOOGL','MSFT','AMZN','META','TSLA','SPCX','NVDA','LLY','KO','JNJ','ABBV'];
export const VERDICTS=['割安','割高','適正','中立','対象外','未公表'];
export const OPINIONS=['買い','売り','中立','強気買い','強気売り','強気の買い','強気の売り','対象外','未公表'];
export const STORAGE_KEY='morning-minkabu-import-v1';
const empty=s=>/^[-—ー－]+$/.test(s)?'未公表':s;
export function parseResearchText(text,symbol){
 if(!SYMBOLS.includes(symbol)||typeof text!=='string'||text.length>100000)throw Error('銘柄または貼り付け内容を確認してください。');
 const t=text.normalize('NFKC').replace(/\s+/g,' ').trim();
 const heading=t.slice(0,t.indexOf('目標株価')<0?300:t.indexOf('目標株価'));
 const found=heading.match(/\b(AAPL|GOOGL|MSFT|AMZN|META|TSLA|SPCX|NVDA|LLY|KO|JNJ|ABBV)\s+(?:NASDAQ|NYSE)\b/i);
 if(found&&found[1].toUpperCase()!==symbol)throw Error(`ページの銘柄は${found[1].toUpperCase()}です。選択した銘柄と一致しません。`);
 const verdict='(割安|割高|適正|中立|対象外|未公表|---|—)';
 const diagnosis=t.match(new RegExp('株価診断\\s*'+verdict))?.[1];
 const analyst=t.match(new RegExp('アナリスト\\s*'+verdict))?.[1];
 const opinions='(強気の買い|強気の売り|強気買い|強気売り|買い|売り|中立|対象外|未公表)';
 const pattern=new RegExp(opinions+'\\s*目標株価\\s*\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?|---|—)');
 const alternate=new RegExp('目標株価\\s*'+opinions+'\\s*\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?|---|—)');
 const match=t.match(pattern)||t.match(alternate);
 if(!match||!diagnosis||!analyst)throw Error('評価欄を読み取れませんでした。「買い／売り・目標株価・株価診断・アナリスト」が含まれる範囲をコピーしてください。下の手入力でも保存できます。');
 return {symbol,opinion:match[1],target:/^[0-9]/.test(match[2])?Number(match[2].replaceAll(',','')):null,diagnosis:empty(diagnosis),analyst:empty(analyst)};
}
export function validateRecord(r,now=Date.now()){
 if(!r||!SYMBOLS.includes(r.symbol)||!OPINIONS.includes(r.opinion)||!VERDICTS.includes(r.diagnosis)||!VERDICTS.includes(r.analyst))throw Error('銘柄または評価の形式が正しくありません。');
 if(r.target!==null&&(!Number.isFinite(r.target)||r.target<=0||r.target>10000000))throw Error('目標株価は正の数値、または未公表を選んでください。');
 const time=Date.parse(r.capturedAt);
 if(!Number.isFinite(time)||time>now+300000)throw Error('保存日時が正しくありません。');
 return {symbol:r.symbol,opinion:r.opinion,target:r.target,diagnosis:r.diagnosis,analyst:r.analyst,capturedAt:new Date(time).toISOString(),source:'user-confirmed-minkabu',sourceUrl:`https://us.minkabu.jp/stocks/${r.symbol}/researches`};
}
export function decodeResearchFile(text){
 if(typeof text!=='string'||text.length>50000)throw Error('ファイルが大きすぎます。');
 const d=JSON.parse(text);
 if(d?.format!=='market-morning-minkabu'||d.version!==1||!Array.isArray(d.records)||!d.records.length||d.records.length>12)throw Error('このアプリから書き出したみんかぶデータを選んでください。');
 const result=d.records.map(r=>validateRecord(r));
 if(new Set(result.map(r=>r.symbol)).size!==result.length)throw Error('銘柄が重複しています。');
 return result;
}
export function mergeResearch(existing,records){
 const next={...existing};let added=0,skipped=0;
 for(const r of records){const row=validateRecord(r);if(next[row.symbol]&&Date.parse(next[row.symbol].capturedAt)>Date.parse(row.capturedAt)){skipped++;continue;}next[row.symbol]=row;added++;}
 return {next,added,skipped};
}
