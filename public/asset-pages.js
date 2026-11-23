export const MARKET_IDS=['usd','vix','fear','vi','brent'];
export const FUND_IDS=['sox','fang','nasdaq','nasdaq_ifree','sp500_slim','allcountry_slim','schd','au_nasdaq_leverage','au_nasdaq_triple'];
export const ETF_IDS=['tqqq','soxl'];
export function metricPage(id){return ETF_IDS.includes(id)?'stocks':FUND_IDS.includes(id)?'funds':'market';}
export function panelHref(id){return (metricPage(id)==='stocks'?'./stocks-reference.html':metricPage(id)==='funds'?'./funds.html':'./')+'#metric-'+id;}
export function legacyPanelDestination(path,hash){
 const id=/^#metric-([a-z0-9_]+)$/.exec(hash||'')?.[1];
 const index=path.endsWith('/')||path.endsWith('/index.html'),funds=path.endsWith('/funds.html');
 if(ETF_IDS.includes(id)&&(index||funds)||FUND_IDS.includes(id)&&index)return panelHref(id);
 return null;
}
