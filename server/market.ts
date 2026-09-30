import {NextRequest,NextResponse,type AppEnv} from "@/lib/http";
import {readMarketSnapshot,upsertMarketSnapshots} from "@/db/market";
import type {SnapshotRow} from "@/db/market";

const FIFTEEN_MINUTES=15*60*1000,PROFILE_TTL=7*24*60*60*1000;
const cleanSymbols=(value:unknown,limit=500)=>Array.from(new Set((Array.isArray(value)?value:String(value||"").split(",")).map(x=>String(x).trim().toUpperCase()).filter(x=>/^[A-Z0-9.-]{1,16}$/.test(x)))).slice(0,limit);
const num=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:null;
async function provider(url:string){const response=await fetch(url,{cache:"no-store"});if(!response.ok){const error=new Error(`Provider returned ${response.status}`) as Error&{status?:number};error.status=response.status;throw error}return response.json() as Promise<Record<string,unknown>>}
const publicRow=(row:SnapshotRow)=>({...row,source:"Finnhub snapshot",ageMinutes:row.quoteRefreshedAt==null?null:Math.max(0,Math.floor((Date.now()-row.quoteRefreshedAt)/60000))});

export async function GET(request:NextRequest,env:AppEnv){
  const symbols=cleanSymbols(request.nextUrl.searchParams.get("symbols"));
  if(!symbols.length)return NextResponse.json({items:[],asOf:null,expected:0,resolved:0,stale:true,delayMinutes:15});
  try{
    const rows=await readMarketSnapshot(env.DB,symbols),bySymbol=new Map(rows.map(row=>[row.symbol,row])),items=symbols.map(symbol=>bySymbol.get(symbol)).filter((row):row is SnapshotRow=>Boolean(row)).map(publicRow),asOf=items.reduce((oldest,item)=>Math.min(oldest,item.quoteRefreshedAt||Infinity),Infinity),resolved=items.filter(item=>item.price!=null&&item.marketCap!=null).length;
    return NextResponse.json({items,asOf:Number.isFinite(asOf)?asOf:null,expected:symbols.length,resolved,complete:resolved===symbols.length,snapshotComplete:items.length===symbols.length,stale:!Number.isFinite(asOf)||Date.now()-asOf>FIFTEEN_MINUTES,delayMinutes:15},{headers:{"Cache-Control":"private, max-age=30"}});
  }catch{return NextResponse.json({items:[],asOf:null,expected:symbols.length,resolved:0,complete:false,stale:true,delayMinutes:15,error:"Market snapshot is initializing"},{status:200})}
}

export async function POST(request:NextRequest,env:AppEnv){
  const token=env.FINNHUB_API_KEY;
  if(!token)return NextResponse.json({items:[],error:"Market data is not configured"},{status:503});
  const body=await request.json().catch(()=>({})) as{symbols?:unknown},symbols=cleanSymbols(body.symbols,6);
  if(!symbols.length)return NextResponse.json({items:[],error:"No valid symbols"},{status:400});
  const existing=await readMarketSnapshot(env.DB,symbols).catch(()=>[]),old=new Map(existing.map(row=>[row.symbol,row])),rateLimited:string[]=[];
  const fetched=await Promise.all(symbols.map(async symbol=>{
    const previous=old.get(symbol),now=Date.now(),needsProfile=!previous?.profileRefreshedAt||now-previous.profileRefreshedAt>PROFILE_TTL;
    try{
      const emptyProfile:Record<string,unknown>={};
      const [quote,profile]=await Promise.all([
        provider(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`),
        needsProfile?provider(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`).catch(error=>{if((error as {status?:number}).status===429)rateLimited.push(symbol);return emptyProfile}):Promise.resolve(emptyProfile),
      ]);
      const price=(num(quote.c)||0)>0?num(quote.c):null,shares=num(profile.shareOutstanding)??previous?.sharesOutstanding??null,providerCap=num(profile.marketCapitalization),derivedCap=price!=null&&shares!=null?price*shares:null;
      const row:SnapshotRow={symbol,price,change:num(quote.d),changePct:num(quote.dp),previousClose:num(quote.pc),marketCap:derivedCap??providerCap??previous?.marketCap??null,sharesOutstanding:shares,currency:typeof profile.currency==="string"?profile.currency:previous?.currency||"USD",companyUrl:typeof profile.weburl==="string"?profile.weburl:previous?.companyUrl||null,logo:typeof profile.logo==="string"?profile.logo:previous?.logo||null,timestamp:num(quote.t),quoteRefreshedAt:now,profileRefreshedAt:needsProfile&&Object.keys(profile).length?now:previous?.profileRefreshedAt??null,status:price!=null?"snapshot":"no_quote"};
      return row;
    }catch(error){if((error as {status?:number}).status===429)rateLimited.push(symbol);return previous||null}
  }));
  const rows=fetched.filter((row):row is SnapshotRow=>Boolean(row));await upsertMarketSnapshots(env.DB,rows);
  return NextResponse.json({items:rows.map(publicRow),asOf:Date.now(),requested:symbols.length,rateLimited:Array.from(new Set(rateLimited)),retryAfterMs:15000},{headers:{"Cache-Control":"no-store"}});
}
