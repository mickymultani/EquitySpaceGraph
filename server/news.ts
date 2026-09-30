import {NextRequest,NextResponse,type AppEnv} from "@/lib/http";
const iso=(d:Date)=>d.toISOString().slice(0,10);
export async function GET(request:NextRequest,env:AppEnv){
  const symbol=(request.nextUrl.searchParams.get("symbol")||"").trim().toUpperCase();
  if(!/^[A-Z0-9.-]{1,16}$/.test(symbol))return NextResponse.json({items:[]});
  const token=env.FINNHUB_API_KEY;
  if(!token)return NextResponse.json({items:[],error:"Finnhub is not configured"},{status:503});
  const to=new Date(),from=new Date(to.getTime()-14*86400000);
  try{const res=await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${iso(from)}&to=${iso(to)}&token=${encodeURIComponent(token)}`,{cache:"no-store"});if(!res.ok)throw new Error("Provider error");const items=await res.json();return NextResponse.json({items:Array.isArray(items)?items.slice(0,12):[]},{headers:{"Cache-Control":"private, max-age=120"}})}catch{return NextResponse.json({items:[],error:"News unavailable"},{status:502})}
}
