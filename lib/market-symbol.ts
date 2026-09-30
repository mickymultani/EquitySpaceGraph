export type ListedCompany={ticker:string;exchange?:string};

export function feedSymbol(company?:ListedCompany){
  if(!company?.ticker)return"";
  const ticker=company.ticker.toUpperCase(),exchange=(company.exchange||"").toUpperCase();
  if(ticker.includes("."))return ticker;
  if(exchange.includes("TWSE"))return`${ticker}.TW`;
  if(exchange==="TSE"||exchange.includes("TOKYO"))return`${ticker}.T`;
  if(exchange.includes("HKEX"))return`${ticker.padStart(4,"0")}.HK`;
  if(exchange.includes("XETRA"))return`${ticker}.DE`;
  if(exchange.includes("EURONEXT PARIS"))return`${ticker}.PA`;
  if(exchange.includes("STOCKHOLM"))return`${ticker}.ST`;
  if(exchange.includes("LSE"))return`${ticker}.L`;
  if(exchange.includes("KRX"))return`${ticker}.KS`;
  return ticker;
}
