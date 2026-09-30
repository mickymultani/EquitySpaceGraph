import {NextRequest,NextResponse,type AppEnv} from "@/lib/http";
import {getOfficialMacroEvents} from "@/lib/macro-calendar";

type CompanyContext={name:string;ticker:string;layer:string;connections:number;price:number|null;changePct:number|null};
type RelationshipContext={source:string;target:string;type:string;product:string;evidence:string;score:number;criticality:string;directness:string;substitutability:string;mechanism:string};
type NewsContext={headline:string;summary:string;source:string;datetime:number;related:string};
type CopilotRequest={question:string;view:string;selected:CompanyContext|null;subject:CompanyContext|null;companies:CompanyContext[];relationships:RelationshipContext[];news:NewsContext[]};
type JevAnswer={type?:string;choice?:string;confidence?:number;noul?:number;score?:number};

const safeText=(value:unknown,max=240)=>typeof value==="string"?value.slice(0,max):"";
const safeNumber=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:null;
const cleanAnswer=(value:string)=>value.replace(/\*\*/g,"").replace(/^#{1,6}\s*/gm,"").replace(/^[*-]\s+/gm,"• ").replace(/\n{3,}/g,"\n\n").trim();

function sanitize(raw:unknown):CopilotRequest{
  const input=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
  const cleanCompany=(value:unknown):CompanyContext|null=>{if(!value||typeof value!=="object")return null;const c=value as Record<string,unknown>;return{name:safeText(c.name,100),ticker:safeText(c.ticker,18),layer:safeText(c.layer,100),connections:safeNumber(c.connections)??0,price:safeNumber(c.price),changePct:safeNumber(c.changePct)}};
  const companies=(Array.isArray(input.companies)?input.companies:[]).slice(0,80).map(cleanCompany).filter(Boolean) as CompanyContext[];
  const relationships=(Array.isArray(input.relationships)?input.relationships:[]).slice(0,120).map(value=>{const r=value&&typeof value==="object"?value as Record<string,unknown>:{};return{source:safeText(r.source,100),target:safeText(r.target,100),type:safeText(r.type,80),product:safeText(r.product,180),evidence:safeText(r.evidence,80),score:safeNumber(r.score)??0,criticality:safeText(r.criticality,40),directness:safeText(r.directness,100),substitutability:safeText(r.substitutability,60),mechanism:safeText(r.mechanism,400)}});
  const news=(Array.isArray(input.news)?input.news:[]).slice(0,18).map(value=>{const n=value&&typeof value==="object"?value as Record<string,unknown>:{};return{headline:safeText(n.headline,220),summary:safeText(n.summary,500),source:safeText(n.source,80),datetime:safeNumber(n.datetime)??0,related:safeText(n.related,18)}});
  return{question:safeText(input.question,800),view:safeText(input.view,24),selected:cleanCompany(input.selected),subject:cleanCompany(input.subject)||cleanCompany(input.selected),companies,relationships,news};
}

function graphAnswer(context:CopilotRequest,intent:string|null){
  if(context.subject){
    const related=context.relationships.filter(r=>r.source===context.subject?.name||r.target===context.subject?.name),verified=related.filter(r=>r.evidence.toUpperCase().startsWith("VERIFIED")),types=Array.from(new Set(related.map(r=>r.type))).slice(0,4),peers=context.companies.filter(c=>c.ticker!==context.subject?.ticker).sort((a,b)=>b.connections-a.connections).slice(0,6).map(c=>`${c.name} (${c.ticker})`).filter(Boolean),paths=related.slice(0,6).map(r=>`${r.source===context.subject?.name?r.target:r.source} — ${r.type}${r.evidence.toUpperCase().startsWith("VERIFIED")?" [verified]":" [mapped]"}`);
    const move=context.subject.changePct==null?"Price action is unavailable.":`${context.subject.ticker} is ${context.subject.changePct>=0?"up":"down"} ${Math.abs(context.subject.changePct).toFixed(2)}% in the latest quote.`;
    return`${context.subject.name} has ${related.length} direct mapped relationships, including ${verified.length} evidence-backed links. ${move}\n\nA price move alone does not operationally affect counterparties; the underlying demand, supply, financing or capex event may. Relationship types: ${types.join(", ")||"not present under the current filters"}.\n\nDirect paths:\n${paths.length?paths.map(p=>`• ${p}`).join("\n"):"• No direct paths under the current filters."}${peers.length?`\n\nFirst- and second-order equities to inspect:\n• ${peers.join("\n• ")}`:""}${intent==="news_impact"&&context.news.length?`\n\n${context.news.length} recent headlines were supplied for catalyst review.`:""}`;
  }
  if(context.news.length&&(intent==="news_impact"||/news|today|story|catalyst|earnings|cpi|inflation|jobs|upcoming/i.test(context.question))){
    const companyByTicker=new Map(context.companies.map(c=>[c.ticker.toUpperCase(),c])),adj=new Map<string,Set<string>>();
    for(const r of context.relationships){adj.set(r.source,new Set([...(adj.get(r.source)||[]),r.target]));adj.set(r.target,new Set([...(adj.get(r.target)||[]),r.source]))}
    const analyses=context.news.slice(0,5).map(item=>{const company=companyByTicker.get(item.related.toUpperCase());if(!company)return{item,names:context.companies.slice(0,8).map(c=>c.name)};const direct=[...(adj.get(company.name)||[])],second=direct.flatMap(name=>[...(adj.get(name)||[])]).filter(name=>name!==company.name);return{item,names:Array.from(new Set([company.name,...direct,...second])).slice(0,12)}});
    return`Current-view catalyst scan (${context.companies.length} companies):\n${analyses.map(({item,names})=>`• ${item.headline} — ${names.length} named companies potentially in path: ${names.join(", ")}.`).join("\n")}\n\nPotential impact means graph reach, not confirmed causation. Validate the underlying event, timing and relationship evidence before acting.`;
  }
  const leaders=[...context.companies].sort((a,b)=>b.connections-a.connections).slice(0,7).map(c=>c.ticker||c.name);
  return`The current ${context.view||"graph"} view contains ${context.companies.length} listed companies and ${context.relationships.length} visible relationships. The most connected visible equities are ${leaders.join(", ")||"not available under the current filters"}. Select a company to narrow the analysis to its direct suppliers, customers, evidence and news.`;
}

async function loadNews(context:CopilotRequest,env:AppEnv){
  const token=env.FINNHUB_API_KEY;if(!token||context.news.length)return context;const symbols=(context.subject?.ticker?[context.subject.ticker]:context.companies.filter(c=>c.ticker).sort((a,b)=>b.connections-a.connections).slice(0,6).map(c=>c.ticker)).filter(Boolean);
  const to=new Date(),from=new Date(to.getTime()-14*86400000),iso=(d:Date)=>d.toISOString().slice(0,10);
  try{const batches=await Promise.all(symbols.map(async symbol=>{const response=await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${iso(from)}&to=${iso(to)}&token=${encodeURIComponent(token)}`,{cache:"no-store"});if(!response.ok)return[];const body=await response.json() as Array<Record<string,unknown>>;return(Array.isArray(body)?body:[]).slice(0,4).map(n=>({headline:safeText(n.headline,220),summary:safeText(n.summary,500),source:safeText(n.source,80),datetime:safeNumber(n.datetime)??0,related:symbol}))}));const seen=new Set<string>(),news=batches.flat().sort((a,b)=>b.datetime-a.datetime).filter(n=>n.headline&&!seen.has(n.headline)&&(seen.add(n.headline),true)).slice(0,14);return{...context,news}}catch{return context}
}

async function loadUpcoming(context:CopilotRequest,env:AppEnv){
  const token=env.FINNHUB_API_KEY,from=new Date(),to=new Date(from.getTime()+45*86400000),iso=(d:Date)=>d.toISOString().slice(0,10),tickers=new Set(context.companies.map(c=>c.ticker.toUpperCase()).filter(Boolean)),events:NewsContext[]=[];
  for(const macro of await getOfficialMacroEvents(from,to))events.push({headline:macro.title,summary:macro.summary,source:macro.source,datetime:macro.datetime,related:"MACRO"});
  if(token)try{const response=await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${iso(from)}&to=${iso(to)}&token=${encodeURIComponent(token)}`,{cache:"no-store"});if(response.ok){const body=await response.json() as{earningsCalendar?:Array<Record<string,unknown>>};for(const event of body.earningsCalendar||[]){const symbol=safeText(event.symbol,18).toUpperCase();if(!tickers.has(symbol))continue;const date=safeText(event.date,24),hour=safeText(event.hour,16);events.push({headline:`${symbol} earnings scheduled ${date}${hour?` (${hour})`:""}`,summary:`Upcoming reported earnings catalyst for ${symbol}. EPS estimate: ${String(event.epsEstimate??"not supplied")}; revenue estimate: ${String(event.revenueEstimate??"not supplied")}.`,source:"Finnhub earnings calendar",datetime:Math.floor(new Date(date).getTime()/1000)||0,related:symbol})}}}catch{/* Official macro calendar remains available. */}
  if(token)try{const response=await fetch(`https://finnhub.io/api/v1/calendar/economic?from=${iso(from)}&to=${iso(to)}&token=${encodeURIComponent(token)}`,{cache:"no-store"});if(response.ok){const body=await response.json() as{economicCalendar?:Array<Record<string,unknown>>};for(const event of(body.economicCalendar||[]).filter(e=>/FOMC|Federal Reserve|CPI|inflation|employment|jobs|payroll|unemployment|JOLTS|interest rate|GDP|PCE|retail sales|PMI/i.test(safeText(e.event,120))).slice(0,12)){const name=safeText(event.event,120),date=safeText(event.time,40)||safeText(event.date,24);events.push({headline:`${name}${date?` · ${date}`:""}`,summary:`Upcoming macro release. Country: ${safeText(event.country,40)||"not supplied"}; prior: ${String(event.prev??"not supplied")}; estimate: ${String(event.estimate??"not supplied")}.`,source:"Finnhub economic calendar",datetime:Math.floor(new Date(date).getTime()/1000)||0,related:"MACRO"})}}}catch{/* Official macro calendar remains available. */}
  return{...context,news:[...events,...context.news].slice(0,18)};
}

async function classifyWithJev(context:CopilotRequest,env:AppEnv){
  const key=env.TYPESAFE_API_KEY;if(!key)return null;
  const response=await fetch("https://api.typesafe.ai/v1/systemone",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:env.TYPESAFE_MODEL||"jev-latest",state:context,questions:{intent:{type:"choice",instructions:"Classify the user's graph-analysis request so application code can route it. Choose the single best intent.",criteria:{dependency_analysis:"Map suppliers, customers, products, materials, or operational dependencies.",price_catalyst:"Explain or inspect price action and possible catalysts.",risk_assessment:"Assess concentration, disruption, substitution, or exposure risk.",news_impact:"Evaluate how supplied current news may affect connected equities.",comparison:"Compare two or more companies, layers, or relationship paths.",navigation:"Find, focus, filter, or explain what is visible in the graph."}},needs_fresh_news:{type:"noul",instructions:"Does a reliable answer require current news beyond the headlines already supplied?",criteria:{true:"The question asks about latest events, causes of today's price move, or information absent from supplied headlines.",false:"The graph state and supplied evidence are sufficient."}},evidence_sufficiency:{type:"score",instructions:"Rate whether the supplied graph, quote and news evidence is sufficient for a responsible answer.",criteria:["Insufficient","Partial","Sufficient","Strong"]},impact_severity:{type:"score",instructions:"Rate the potential financial or operational materiality described by this request and supplied state.",criteria:["Low","Moderate","High","Critical"]}}})});
  if(!response.ok)throw new Error(`JEV ${response.status}`);
  const body=await response.json() as{model?:string;answers?:Record<string,JevAnswer>};return{model:body.model||"jev",answers:body.answers||{}};
}

async function synthesizeWithGroq(context:CopilotRequest,decisions:Record<string,JevAnswer>,env:AppEnv){
  const key=env.GROQ_API_KEY,model=env.GROQ_MODEL;if(!key||!model)return null;
  const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:.08,reasoning_effort:"low",max_completion_tokens:1400,messages:[{role:"system",content:"You are the analyst for an AI equity dependency graph. Use only the supplied graph_context, quotes, headlines, and JEV decisions. Every organization you name must appear verbatim in graph_context.companies or in a relationship endpoint. Never replace missing names with phrases such as many firms, various customers, industry players, GPU makers, or similar groups; enumerate the supplied names or explicitly say the graph has no named entity for that claim. Never introduce external industry facts. Distinguish verified links, derived value-chain paths, shared capabilities, and sector peers. A shared capability or sector peer is not a supplier contract. For impact questions, separate direct mapped exposure, second-order exposure, and what to monitor. Include the named relationship path for each entity. A stock-price decline alone does not operationally affect counterparties; distinguish the price signal from an underlying demand, supply, financing, capex, or company-specific event. Write clean plain text with short paragraphs or Unicode bullets; no Markdown syntax, headings, tables, asterisks, or hashtags. End with a complete sentence and stay under 240 words."},{role:"user",content:JSON.stringify({question:context.question,graph_context:context,jev_decisions:decisions})}]})});
  if(!response.ok)throw new Error(`Groq ${response.status}`);
  const body=await response.json() as{choices?:Array<{finish_reason?:string;message?:{content?:string}}>},choice=body.choices?.[0],content=safeText(choice?.message?.content,4200),cleaned=content?cleanAnswer(content):"";
  if(!cleaned||choice?.finish_reason==="length"||/[,:;]$/.test(cleaned))return null;
  return cleaned;
}

export async function POST(request:NextRequest,env:AppEnv){
  let context=sanitize(await request.json().catch(()=>({})));
  if(!context.question)return NextResponse.json({error:"Question is required"},{status:400});
  let jev:Awaited<ReturnType<typeof classifyWithJev>>=null,jevError=false;
  try{jev=await classifyWithJev(context,env)}catch{jevError=true}
  const intentAnswer=jev?.answers.intent,intent=intentAnswer?.choice||null,confidence=typeof intentAnswer?.confidence==="number"?intentAnswer.confidence:null;
  const heuristicNews=/news|today|story|press release|catalyst|earnings|cpi|inflation|jobs|central.bank|upcoming/i.test(context.question),needsNews=(jev?.answers.needs_fresh_news?.noul??0)>.55||heuristicNews;if(needsNews)context=await loadNews(context,env);if(/upcoming|calendar|earnings|cpi|inflation|jobs|central.bank/i.test(context.question))context=await loadUpcoming(context,env);
  let answer=graphAnswer(context,intent),groqUsed=false;
  if(jev){try{const synthesis=await synthesizeWithGroq(context,jev.answers,env);if(synthesis){answer=synthesis;groqUsed=true}}catch{/* Deterministic graph answer remains available. */}}
  return NextResponse.json({answer,engine:groqUsed?"JEV → Groq":jev?"JEV → Graph":"Graph",confidence,intent,decisions:jev?.answers||null,newsFetched:needsNews&&context.news.length>0,configured:{jev:Boolean(env.TYPESAFE_API_KEY),groq:Boolean(env.GROQ_API_KEY&&env.GROQ_MODEL)},status:jevError?"jev_unavailable":"ok"},{headers:{"Cache-Control":"no-store"}});
}
