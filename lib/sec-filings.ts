export type SecFiling={form:string;filingDate:string;reportDate:string;accessionNumber:string;primaryDocument:string;items:string;url:string};
export type SecIssuer={cik:string;cikNumber:number;ticker:string;title:string};

async function secFetch(url:string,userAgent:string,timeout=12000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetch(url,{headers:{"User-Agent":userAgent,"Accept-Encoding":"gzip, deflate"},signal:controller.signal})}finally{clearTimeout(timer)}
}

export async function resolveSecIssuer(ticker:string,companyName:string|undefined,userAgent:string){
  const normalized=ticker.trim().toUpperCase(),response=await secFetch("https://www.sec.gov/files/company_tickers.json",userAgent);
  if(!response.ok)throw new Error(`SEC ticker registry ${response.status}`);
  const registry=await response.json() as Record<string,{cik_str:number;ticker:string;title:string}>;
  let record=Object.values(registry).find(item=>item.ticker.toUpperCase()===normalized);
  if(!record&&companyName){
    const key=companyName.toUpperCase().replace(/\b(INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|PLC|SA|NV|CO|COMPANY)\b|[^A-Z0-9]/g,"");
    record=Object.values(registry).find(item=>item.title.toUpperCase().replace(/\b(INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|PLC|SA|NV|CO|COMPANY)\b|[^A-Z0-9]/g,"").includes(key));
  }
  if(!record)return null;
  return{cik:String(record.cik_str).padStart(10,"0"),cikNumber:record.cik_str,ticker:record.ticker,title:record.title} satisfies SecIssuer;
}

export async function fetchSecFilings(issuer:SecIssuer,userAgent:string){
  const response=await secFetch(`https://data.sec.gov/submissions/CIK${issuer.cik}.json`,userAgent);
  if(!response.ok)throw new Error(`SEC submissions ${response.status}`);
  const body=await response.json() as{filings?:{recent?:Record<string,unknown[]>}},recent=body.filings?.recent||{},forms=(recent.form||[]) as string[];
  return forms.map((form,index)=>({
    form,
    filingDate:String(recent.filingDate?.[index]||""),
    reportDate:String(recent.reportDate?.[index]||""),
    accessionNumber:String(recent.accessionNumber?.[index]||""),
    primaryDocument:String(recent.primaryDocument?.[index]||""),
    items:String(recent.items?.[index]||""),
    url:`https://www.sec.gov/Archives/edgar/data/${issuer.cikNumber}/${String(recent.accessionNumber?.[index]||"").replaceAll("-","")}/${String(recent.primaryDocument?.[index]||"")}`,
  })).filter(filing=>filing.accessionNumber&&filing.primaryDocument) satisfies SecFiling[];
}

export function selectResearchFilings(filings:SecFiling[]){
  const groups=[
    new Set(["10-K","10-K/A","20-F","20-F/A","40-F"]),
    new Set(["10-Q","10-Q/A"]),
    new Set(["8-K","8-K/A","6-K"]),
    new Set(["S-1","S-1/A","F-1","F-1/A","DEF 14A"]),
  ];
  const selected:SecFiling[]=[];
  for(const [index,forms] of groups.entries()){
    const limit=index===2?3:1;
    selected.push(...filings.filter(filing=>forms.has(filing.form)).slice(0,limit));
  }
  return selected.filter((filing,index,array)=>array.findIndex(item=>item.accessionNumber===filing.accessionNumber)===index).slice(0,6);
}

const decode=(value:string)=>value.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,code)=>String.fromCharCode(Number(code)));
const keywords=/\b(customer|customers|supplier|suppliers|foundry|manufacturer|manufacturing|purchase commitment|revenue concentration|sole source|capacity|backlog|financing|investor|offtake|power agreement|data cent(?:er|re)|raw material|dependency|strategic agreement|joint venture|wafer|fabrication)\b/gi;

export async function fetchFilingEvidence(filing:SecFiling,userAgent:string){
  const response=await secFetch(filing.url,userAgent,18000);if(!response.ok)throw new Error(`SEC filing ${response.status}`);
  const html=await response.text(),text=decode(html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
  const windows:string[]=[];let match:RegExpExecArray|null;
  keywords.lastIndex=0;
  while((match=keywords.exec(text))&&windows.length<90){const start=Math.max(0,match.index-550),end=Math.min(text.length,match.index+1050),window=text.slice(start,end).trim();if(!windows.some(item=>item.includes(window.slice(300,700))))windows.push(window)}
  const excerpt=(windows.length?windows:[text.slice(0,12000)]).join("\n\n[…document context…]\n\n").slice(0,36000);
  return{text:excerpt,charactersAnalyzed:excerpt.length,documentCharacters:text.length};
}
