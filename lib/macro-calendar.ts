export type MacroImportance="critical"|"high"|"medium";
export type MacroEvent={
  id:string;
  title:string;
  summary:string;
  source:string;
  sourceUrl:string;
  datetime:number;
  category:"fed"|"inflation"|"labor"|"growth"|"trade";
  importance:MacroImportance;
};

const FED_URL="https://www.federalreserve.gov/monetarypolicy.htm";
const BLS_URL="https://www.bls.gov/schedule/2026/";
const BEA_URL="https://www.bea.gov/news/schedule/full";
const at=(value:string)=>Math.floor(new Date(value).getTime()/1000);
const event=(id:string,title:string,when:string,category:MacroEvent["category"],importance:MacroImportance,source:string,sourceUrl:string,summary:string):MacroEvent=>({id,title,summary,source,sourceUrl,datetime:at(when),category,importance});

// BLS blocks automated calendar retrieval from some edge networks. These dates are
// mirrored from its published 2026 release calendar so the product never silently
// falls back to earnings-only. The live Finnhub and BEA adapters are merged on top.
const OFFICIAL_2026:MacroEvent[]=[
  event("bls-empl-2026-10-02","U.S. Employment Situation · September 2026","2026-10-02T08:30:00-04:00","labor","critical","U.S. Bureau of Labor Statistics",BLS_URL,"Nonfarm payrolls, unemployment, wages and labor-force participation. A primary rate, growth and risk-appetite catalyst."),
  event("fed-minutes-2026-10-07","FOMC minutes · September meeting","2026-10-07T14:00:00-04:00","fed","critical","Federal Reserve",FED_URL,"Minutes can reprice the expected policy path by revealing the balance of risks, dissent and the Committee's reaction function."),
  event("bls-cpi-2026-10-14","U.S. Consumer Price Index · September 2026","2026-10-14T08:30:00-04:00","inflation","critical","U.S. Bureau of Labor Statistics",BLS_URL,"Headline and core CPI are major inputs to rate expectations and equity discount rates."),
  event("bls-ppi-2026-10-15","U.S. Producer Price Index · September 2026","2026-10-15T08:30:00-04:00","inflation","high","U.S. Bureau of Labor Statistics",BLS_URL,"Producer-price inflation can change margin expectations and the market's read-through to consumer inflation."),
  event("bls-import-2026-10-16","U.S. Import and Export Price Indexes · September 2026","2026-10-16T08:30:00-04:00","inflation","medium","U.S. Bureau of Labor Statistics",BLS_URL,"Cross-border price pressure is a signal for goods inflation, currencies and internationally exposed supply chains."),
  event("fed-fomc-2026-10-28","FOMC rate decision and press conference","2026-10-28T14:00:00-04:00","fed","critical","Federal Reserve",FED_URL,"Policy decision, statement and Chair press conference. This is a system-wide catalyst for rates, valuation multiples, financing and capital spending."),
  event("bls-eci-2026-10-30","U.S. Employment Cost Index · Q3 2026","2026-10-30T08:30:00-04:00","labor","high","U.S. Bureau of Labor Statistics",BLS_URL,"The ECI is a broad wage-cost measure watched for persistent services inflation and labor-margin pressure."),
  event("bls-jolts-2026-11-03","U.S. Job Openings and Labor Turnover · September 2026","2026-11-03T10:00:00-05:00","labor","high","U.S. Bureau of Labor Statistics",BLS_URL,"Job openings, quits and hiring provide a forward view of labor demand and wage pressure."),
  event("bls-productivity-2026-11-05","U.S. Productivity and Costs · Q3 2026 preliminary","2026-11-05T08:30:00-05:00","growth","high","U.S. Bureau of Labor Statistics",BLS_URL,"Productivity and unit labor costs connect output growth to margin and inflation expectations."),
  event("bls-empl-2026-11-06","U.S. Employment Situation · October 2026","2026-11-06T08:30:00-05:00","labor","critical","U.S. Bureau of Labor Statistics",BLS_URL,"Nonfarm payrolls, unemployment, wages and participation can materially change the expected policy path."),
  event("bls-cpi-2026-11-10","U.S. Consumer Price Index · October 2026","2026-11-10T08:30:00-05:00","inflation","critical","U.S. Bureau of Labor Statistics",BLS_URL,"Headline and core CPI are major inputs to rate expectations and equity discount rates."),
  event("bls-ppi-2026-11-13","U.S. Producer Price Index · October 2026","2026-11-13T08:30:00-05:00","inflation","high","U.S. Bureau of Labor Statistics",BLS_URL,"Producer-price inflation can change margin expectations and the market's read-through to consumer inflation."),
  event("bls-import-2026-11-17","U.S. Import and Export Price Indexes · October 2026","2026-11-17T08:30:00-05:00","inflation","medium","U.S. Bureau of Labor Statistics",BLS_URL,"Cross-border price pressure is a signal for goods inflation, currencies and internationally exposed supply chains."),
  event("fed-minutes-2026-11-18","FOMC minutes · October meeting","2026-11-18T14:00:00-05:00","fed","critical","Federal Reserve",FED_URL,"Minutes can reprice the expected policy path by revealing the balance of risks, dissent and the Committee's reaction function."),
  event("bls-jolts-2026-12-01","U.S. Job Openings and Labor Turnover · October 2026","2026-12-01T10:00:00-05:00","labor","high","U.S. Bureau of Labor Statistics",BLS_URL,"Job openings, quits and hiring provide a forward view of labor demand and wage pressure."),
  event("bls-empl-2026-12-04","U.S. Employment Situation · November 2026","2026-12-04T08:30:00-05:00","labor","critical","U.S. Bureau of Labor Statistics",BLS_URL,"Nonfarm payrolls, unemployment, wages and participation can materially change the expected policy path."),
  event("bls-productivity-2026-12-08","U.S. Productivity and Costs · Q3 2026 revised","2026-12-08T08:30:00-05:00","growth","medium","U.S. Bureau of Labor Statistics",BLS_URL,"Revised productivity and unit labor costs update the relationship between output, margins and inflation."),
  event("fed-fomc-2026-12-09","FOMC rate decision, projections and press conference","2026-12-09T14:00:00-05:00","fed","critical","Federal Reserve",FED_URL,"Policy decision, updated economic projections and Chair press conference. A system-wide rates and valuation catalyst."),
  event("bls-cpi-2026-12-10","U.S. Consumer Price Index · November 2026","2026-12-10T08:30:00-05:00","inflation","critical","U.S. Bureau of Labor Statistics",BLS_URL,"Headline and core CPI are major inputs to rate expectations and equity discount rates."),
  event("bls-ppi-2026-12-15","U.S. Producer Price Index · November 2026","2026-12-15T08:30:00-05:00","inflation","high","U.S. Bureau of Labor Statistics",BLS_URL,"Producer-price inflation can change margin expectations and the market's read-through to consumer inflation."),
];

const decode=(value:string)=>value.replace(/&amp;/g,"&").replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
const strip=(value:string)=>decode(value.replace(/<[^>]*>/g," "));
const categoryFor=(title:string):MacroEvent["category"]=>/Personal Income and Outlays|PCE/i.test(title)?"inflation":/trade|international/i.test(title)?"trade":"growth";
const importanceFor=(title:string):MacroImportance=>/GDP|Personal Income and Outlays/i.test(title)?"critical":/trade/i.test(title)?"high":"medium";

async function fetchBeaEvents(year:number):Promise<MacroEvent[]>{
  try{
    const response=await fetch(BEA_URL,{headers:{"User-Agent":"ESG catalyst calendar/1.0"}});
    if(!response.ok)return[];
    const html=await response.text(),rows=html.match(/<tr class="scheduled-releases[^>]*>[\s\S]*?<\/tr>/g)||[],events:MacroEvent[]=[];
    for(const row of rows){
      const date=strip(row.match(/<div class="release-date">([\s\S]*?)<\/div>/)?.[1]||"");
      const time=strip(row.match(/<small class="text-muted">([\s\S]*?)<\/small>/)?.[1]||"");
      const title=strip(row.match(/<td class="release-title[^>]*>([\s\S]*?)<\/td>/)?.[1]||"");
      if(!date||!title||!/^GDP \(|^Gross Domestic Product,|Personal Income and Outlays|U\.S\. International Trade in Goods and Services/i.test(title))continue;
      const offset=/November|December|January|February/i.test(date)?"-0500":"-0400";
      const parsed=new Date(`${date}, ${year} ${time||"8:30 AM"} GMT${offset}`);
      const datetime=Math.floor(parsed.getTime()/1000);
      if(!datetime)continue;
      const href=row.match(/href="([^"]+)"/)?.[1],sourceUrl=href?new URL(href,BEA_URL).toString():BEA_URL;
      events.push({id:`bea-${year}-${date}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,110),title,summary:/Personal Income and Outlays/i.test(title)?"Includes the Federal Reserve's preferred PCE inflation measures together with income and consumer-spending data.":/GDP/i.test(title)?"Updates real growth, corporate profits and the economy-wide demand backdrop.":"Trade flows can move currencies and change the demand and cost picture for globally connected supply chains.",source:"U.S. Bureau of Economic Analysis",sourceUrl,datetime,category:categoryFor(title),importance:importanceFor(title)});
    }
    return events;
  }catch{return[]}
}

async function fetchFedCalendarEvents(from:Date,to:Date):Promise<MacroEvent[]>{
  const cursor=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),1)),months:string[]=[];
  while(cursor<=to){months.push(`${cursor.getUTCFullYear()}-${cursor.toLocaleString("en-US",{month:"long",timeZone:"UTC"}).toLowerCase()}`);cursor.setUTCMonth(cursor.getUTCMonth()+1)}
  const pages=await Promise.all(months.map(async slug=>{try{const url=`https://www.federalreserve.gov/newsevents/${slug}.htm`,response=await fetch(url);return response.ok?{url,html:await response.text()}:null}catch{return null}}));
  const events:MacroEvent[]=[];
  for(const page of pages){
    if(!page)continue;
    const heading=strip(page.html.match(/<div class="row-title[^>]*><h4[^>]*>([\s\S]*?)<\/h4>/)?.[1]||""),parts=heading.split(" "),month=parts[0],year=Number(parts[1]);
    if(!month||!year)continue;
    const panels=page.html.match(/<div class="panel-body">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g)||[];
    for(const panel of panels){
      const columns=panel.match(/<div class="col-xs[^>]*>[\s\S]*?<\/div>/g)||[];
      if(columns.length<3)continue;
      const timeColumn=columns[0]!,detailColumn=columns[1]!,dateColumn=columns.at(-1)!;
      const clock=strip(timeColumn),detail=strip(detailColumn),day=Number(strip(dateColumn).match(/\d{1,2}/)?.[0]);
      if(!day||!/\b(Speech|Discussion|Testimony)\b/i.test(detail))continue;
      const topic=strip(detailColumn.match(/<p class=['"]calendar__title['"]>[\s\S]*?<em>([\s\S]*?)<\/em>/)?.[1]||""),speaker=strip(detailColumn.match(/<p>([\s\S]*?)<\/p>/)?.[1]||"");
      const offset=/November|December|January|February/i.test(month)?"-0500":"-0400",when=new Date(`${month} ${day}, ${year} ${clock||"12:00 PM"} GMT${offset}`),datetime=Math.floor(when.getTime()/1000);
      if(!datetime||datetime<Math.floor(from.getTime()/1000)||datetime>Math.floor(to.getTime()/1000))continue;
      const title=topic?`${speaker} · ${topic}`:speaker,importance:MacroImportance=/monetary policy|economic outlook|inflation|interest rate|financial stability|labor market/i.test(topic)?"high":"medium";
      events.push({id:`fed-${year}-${month}-${day}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,110),title,summary:"Scheduled Federal Reserve communication. Policy language can change rate expectations, liquidity assumptions and valuation multiples before the next formal decision.",source:"Federal Reserve calendar",sourceUrl:page.url,datetime,category:"fed",importance});
    }
  }
  return events;
}

export async function getOfficialMacroEvents(from:Date,to:Date){
  const start=Math.floor(from.getTime()/1000),end=Math.floor(to.getTime()/1000),years=Array.from(new Set([from.getFullYear(),to.getFullYear()]));
  const live=(await Promise.all([...years.map(fetchBeaEvents),fetchFedCalendarEvents(from,to)])).flat();
  return [...OFFICIAL_2026,...live].filter(item=>item.datetime>=start&&item.datetime<=end);
}
