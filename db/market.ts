export type SnapshotRow={symbol:string;price:number|null;change:number|null;changePct:number|null;previousClose:number|null;marketCap:number|null;sharesOutstanding:number|null;currency:string;companyUrl:string|null;logo:string|null;timestamp:number|null;quoteRefreshedAt:number|null;profileRefreshedAt:number|null;status:string};

const placeholders=(count:number)=>Array.from({length:count},()=>"?").join(",");

export async function readMarketSnapshot(db:D1Database,symbols:string[]){
  if(!symbols.length)return[] as SnapshotRow[];
  const chunks:Array<string[]>=[];for(let index=0;index<symbols.length;index+=75)chunks.push(symbols.slice(index,index+75));
  const results=await db.batch<SnapshotRow>(chunks.map(chunk=>db.prepare(`SELECT symbol, price, change, change_pct AS changePct, previous_close AS previousClose, market_cap AS marketCap, shares_outstanding AS sharesOutstanding, currency, company_url AS companyUrl, logo, quote_timestamp AS timestamp, quote_refreshed_at AS quoteRefreshedAt, profile_refreshed_at AS profileRefreshedAt, status FROM market_snapshot WHERE symbol IN (${placeholders(chunk.length)})`).bind(...chunk)));
  return results.flatMap(result=>result.results||[]);
}

export async function upsertMarketSnapshots(db:D1Database,rows:SnapshotRow[]){
  if(!rows.length)return;
  const sql=`INSERT INTO market_snapshot (symbol,price,change,change_pct,previous_close,market_cap,shares_outstanding,currency,company_url,logo,quote_timestamp,quote_refreshed_at,profile_refreshed_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET price=excluded.price,change=excluded.change,change_pct=excluded.change_pct,previous_close=excluded.previous_close,market_cap=COALESCE(excluded.market_cap,market_snapshot.market_cap),shares_outstanding=COALESCE(excluded.shares_outstanding,market_snapshot.shares_outstanding),currency=COALESCE(excluded.currency,market_snapshot.currency),company_url=COALESCE(excluded.company_url,market_snapshot.company_url),logo=COALESCE(excluded.logo,market_snapshot.logo),quote_timestamp=excluded.quote_timestamp,quote_refreshed_at=excluded.quote_refreshed_at,profile_refreshed_at=COALESCE(excluded.profile_refreshed_at,market_snapshot.profile_refreshed_at),status=excluded.status`;
  await db.batch(rows.map(row=>db.prepare(sql).bind(row.symbol,row.price,row.change,row.changePct,row.previousClose,row.marketCap,row.sharesOutstanding,row.currency,row.companyUrl,row.logo,row.timestamp,row.quoteRefreshedAt,row.profileRefreshedAt,row.status)));
}
