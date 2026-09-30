import {NextRequest,NextResponse,type AppEnv} from "@/lib/http";
import base from "@/public/graph-data.json";
import capital from "@/public/capital-flows.json";
import expansion from "@/public/universe-expansion.json";
import {mergeGraphPayloads,type GraphPayload} from "@/lib/graph-research";
import {fetchFilingEvidence,fetchSecFilings,resolveSecIssuer,selectResearchFilings,type SecFiling} from "@/lib/sec-filings";
import {claimCompany,failCompany,finishCompany,readBackfillStatus,replaceClaims,saveDocuments,seedBackfill,type StoredClaim,type StoredDocument} from "@/db/backfill";

export const maxDuration=60;

type RawClaim={subject_name?:unknown;predicate?:unknown;object_name?:unknown;object_ticker?:unknown;relationship_class?:unknown;product?:unknown;amount?:unknown;percentage?:unknown;mechanism?:unknown;evidence_excerpt?:unknown;source_url?:unknown;confidence?:unknown};
type GroqBody={choices?:Array<{message?:{content?:string}}>};
type JevAnswer={noul?:number;score?:number;choice?:string;confidence?:number};
type EvidenceDocument={filing:SecFiling;text:string;charactersAnalyzed:number;documentCharacters:number};

const graph=mergeGraphPayloads([base,capital,expansion] as unknown as GraphPayload[]);
const cleanTicker=(value:unknown)=>String(value||"").trim().toUpperCase().replace(/^\$/,"").slice(0,16);
const cleanText=(value:unknown,max=1000)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,max):"";
const nullable=(value:unknown,max=300)=>{const result=cleanText(value,max);return result||null};
const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9%$]+/g," ").replace(/\s+/g," ").trim();
const generic=/^(customers?|suppliers?|partners?|investors?|fabless (firms?|companies)|third parties|manufacturers?|vendors?|distributors?|government|public|private companies|various|several|many|others?)$/i;
const allowedClasses=new Set(["customer_revenue","supplier_dependency","manufacturing","funding_ownership","capacity_capex","energy_infrastructure","partnership","risk_only"]);

async function digest(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(byte=>byte.toString(16).padStart(2,"0")).join("")}

async function extractClaims(company:{ticker:string;name:string;layer:string},documents:EvidenceDocument[],env:AppEnv){
  const key=env.GROQ_API_KEY;if(!key)throw new Error("GROQ_API_KEY is not configured");
  const corpus=documents.map(({filing,text})=>`SOURCE URL: ${filing.url}\nFORM: ${filing.form}\nFILED: ${filing.filingDate}\nTEXT:\n${text}`).join("\n\n========== NEXT SOURCE ==========\n\n").slice(0,90000);
  const prompt=`You are extracting filing-grade relationship claims for an AI-industry equity knowledge graph. Analyze only the supplied primary SEC filing excerpts for ${company.name} (${company.ticker}), value-chain layer ${company.layer}.

Return strict JSON with one top-level key "claims" containing at most 18 objects. Every claim must:
- name a specific legal entity as object_name; never use generic phrases such as customers, suppliers, many fabless firms, partners, or third parties;
- describe a relationship involving ${company.name};
- quote an exact, concise evidence_excerpt from the supplied source text, not a paraphrase;
- copy source_url exactly from its SOURCE URL marker;
- use relationship_class from: customer_revenue, supplier_dependency, manufacturing, funding_ownership, capacity_capex, energy_infrastructure, partnership, risk_only;
- distinguish a disclosed commercial relationship from a risk-factor hypothetical. Do not infer that a named competitor is a supplier or customer;
- omit a claim rather than guess.

Object schema: subject_name, predicate, object_name, object_ticker (null if not explicitly known), relationship_class, product (null allowed), amount (null allowed), percentage (null allowed), mechanism, evidence_excerpt, source_url, confidence (0 to 1).

PRIMARY SOURCES:
${corpus}`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000),model=env.GROQ_MODEL||"llama-3.3-70b-versatile";
  try{
    const request=(strict:boolean,compact=false)=>fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",signal:controller.signal,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:0,max_completion_tokens:6000,...(model.startsWith("openai/gpt-oss")?{reasoning_effort:"low",reasoning_format:"hidden"}:{}),...(strict?{response_format:{type:"json_object"}}:{}),messages:[{role:"system",content:"Extract only directly attributable, named entity relationships. Return one strict JSON object and never invent evidence."},{role:"user",content:`${compact?prompt.slice(0,52000):prompt}${strict?"":"\n\nReturn ONLY the compact JSON object, with no markdown fences or commentary."}`}]})});
    let response=await request(true),failure=response.ok?"":await response.text();
    if(!response.ok&&response.status===400&&failure.includes("json_validate_failed")){response=await request(false,true);failure=response.ok?"":await response.text()}
    if(!response.ok)throw new Error(`Groq extraction ${response.status}: ${failure.slice(0,180)}`);
    let body=await response.json() as GroqBody,content=body.choices?.[0]?.message?.content;
    if(!content){response=await request(false,true);if(!response.ok)throw new Error(`Groq compact retry ${response.status}: ${(await response.text()).slice(0,180)}`);body=await response.json() as GroqBody;content=body.choices?.[0]?.message?.content}
    if(!content)throw new Error("Groq returned no extraction content after compact retry");
    const cleaned=content.replace(/^```(?:json)?\s*|\s*```$/g,"").trim(),start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}"),json=start>=0&&end>start?cleaned.slice(start,end+1):cleaned;
    const parsed=JSON.parse(json) as{claims?:RawClaim[]};return Array.isArray(parsed.claims)?parsed.claims.slice(0,18):[];
  }finally{clearTimeout(timer)}
}

async function validateWithJev(env:AppEnv,claims:Array<{relationshipClass:string;evidenceExcerpt:string;mechanism:string;objectName:string;confidence:number}>){
  const key=env.TYPESAFE_API_KEY;if(!key)return null;
  const questions:Record<string,unknown>={};
  claims.forEach((claim,index)=>{
    questions[`c${index}_valid`]={type:"noul",instructions:"Is this named-entity relationship directly supported by the quoted primary-source excerpt, without relying on inference?",criteria:{true:"The excerpt explicitly supports the direction, named entity, and economic mechanism.",false:"The excerpt is hypothetical, generic, competitive context, ambiguous, or does not support the claim."}};
    questions[`c${index}_materiality`]={type:"score",instructions:"Rate the likely economic materiality of this relationship to the subject company.",criteria:["Incidental","Relevant","Material","Potentially critical"]};
    questions[`c${index}_class`]={type:"choice",instructions:"Classify the economic relationship described by the claim and excerpt.",criteria:{customer_revenue:"Named customer, revenue concentration, demand or sales.",supplier_dependency:"Named supplier, component, material, sole-source or procurement dependency.",manufacturing:"Foundry, fabrication, assembly, test or contract manufacturing.",funding_ownership:"Equity investment, debt, warrant, ownership or financing flow.",capacity_capex:"Capacity reservation, capital spending, facility or construction commitment.",energy_infrastructure:"Power generation, grid, utility, fuel or data-center energy relationship.",partnership:"Strategic or technical collaboration not captured elsewhere.",risk_only:"Risk factor, competitor mention or non-commercial contextual statement."}};
  });
  const response=await fetch("https://api.typesafe.ai/v1/systemone",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:env.TYPESAFE_MODEL||"jev-latest",state:{claims},questions})});
  if(!response.ok)throw new Error(`JEV validation ${response.status}: ${(await response.text()).slice(0,180)}`);
  return(await response.json() as{answers?:Record<string,JevAnswer>}).answers||{};
}

function sourceFor(url:string,documents:EvidenceDocument[]){return documents.find(document=>document.filing.url===url)}

async function processCompany(row:{ticker:string;name:string;layer:string},env:AppEnv){
  const issuer=await resolveSecIssuer(row.ticker,row.name,env.SEC_USER_AGENT||"EquitySpaceGraph/1.0 configure-SEC_USER_AGENT");
  if(!issuer){await finishCompany(env.DB,row.ticker,{status:"review",cik:null,filingsFound:0,filingsProcessed:0,claimsExtracted:0,claimsVerified:0,claimsReview:0,message:"No SEC issuer match; issuer IR or home-market filings required."});return{ticker:row.ticker,status:"review",reason:"No SEC issuer match"}}
  const allFilings=await fetchSecFilings(issuer,env.SEC_USER_AGENT||"EquitySpaceGraph/1.0 configure-SEC_USER_AGENT"),selected=selectResearchFilings(allFilings),now=Date.now(),documents:EvidenceDocument[]=[],storedDocuments:StoredDocument[]=[];
  for(const filing of selected){
    try{const evidence=await fetchFilingEvidence(filing,env.SEC_USER_AGENT||"EquitySpaceGraph/1.0 configure-SEC_USER_AGENT");documents.push({filing,...evidence});storedDocuments.push({id:filing.accessionNumber,ticker:row.ticker,cik:issuer.cik,form:filing.form,filingDate:filing.filingDate,reportDate:filing.reportDate,sourceUrl:filing.url,status:"processed",charactersAnalyzed:evidence.charactersAnalyzed,error:null,processedAt:now})}
    catch(error){storedDocuments.push({id:filing.accessionNumber,ticker:row.ticker,cik:issuer.cik,form:filing.form,filingDate:filing.filingDate,reportDate:filing.reportDate,sourceUrl:filing.url,status:"failed",charactersAnalyzed:0,error:error instanceof Error?error.message:"Filing fetch failed",processedAt:now})}
  }
  await saveDocuments(env.DB,storedDocuments);
  if(!documents.length){await finishCompany(env.DB,row.ticker,{status:"review",cik:issuer.cik,filingsFound:selected.length,filingsProcessed:0,claimsExtracted:0,claimsVerified:0,claimsReview:0,message:"SEC issuer resolved, but selected filings could not be analyzed."});return{ticker:row.ticker,status:"review",reason:"No filing text available"}}
  const raw=await extractClaims(row,documents,env),candidates=raw.map(claim=>{
    const sourceUrl=cleanText(claim.source_url,900),document=sourceFor(sourceUrl,documents),excerpt=cleanText(claim.evidence_excerpt,1800),objectName=cleanText(claim.object_name,240),relationshipClass=cleanText(claim.relationship_class,80),confidence=Math.max(0,Math.min(1,Number(claim.confidence)||0));
    const supported=Boolean(document&&excerpt&&normalized(document.text).includes(normalized(excerpt)));
    return{subjectName:cleanText(claim.subject_name,240)||row.name,predicate:cleanText(claim.predicate,180),objectName,objectTicker:nullable(claim.object_ticker,24)?.toUpperCase()||null,relationshipClass:allowedClasses.has(relationshipClass)?relationshipClass:"risk_only",product:nullable(claim.product),amount:nullable(claim.amount),percentage:nullable(claim.percentage),mechanism:cleanText(claim.mechanism,900),evidenceExcerpt:excerpt,sourceUrl,sourceForm:document?.filing.form||"unknown",filingDate:document?.filing.filingDate||"",confidence,supported,valid:Boolean(objectName&&!generic.test(objectName)&&document&&excerpt&&cleanText(claim.predicate,180))};
  }).filter(claim=>claim.valid);
  let jev:Record<string,JevAnswer>|null=null,jevError:string|null=null;try{jev=await validateWithJev(env,candidates.map(claim=>({relationshipClass:claim.relationshipClass,evidenceExcerpt:claim.evidenceExcerpt,mechanism:claim.mechanism,objectName:claim.objectName,confidence:claim.confidence})))}catch(error){jevError=error instanceof Error?error.message:"JEV validation unavailable"}
  const claims:StoredClaim[]=[];
  for(const [index,claim] of candidates.entries()){
    const decision=jev?.[`c${index}_valid`],probability=decision?.noul??null,materiality=jev?.[`c${index}_materiality`]?.score??null,jevClass=jev?.[`c${index}_class`]?.choice,relationshipClass=jevClass&&allowedClasses.has(jevClass)?jevClass:claim.relationshipClass;
    const status=claim.supported&&claim.confidence>=.65&&probability!=null&&probability>=.7&&relationshipClass!=="risk_only"?"verified":claim.supported&&claim.confidence>=.45?"review":"rejected";
    claims.push({id:await digest(`${row.ticker}|${claim.sourceUrl}|${claim.predicate}|${claim.objectName}|${claim.evidenceExcerpt}`),ticker:row.ticker,subjectName:claim.subjectName,predicate:claim.predicate,objectName:claim.objectName,objectTicker:claim.objectTicker,relationshipClass,product:claim.product,amount:claim.amount,percentage:claim.percentage,mechanism:claim.mechanism,evidenceExcerpt:claim.evidenceExcerpt,sourceUrl:claim.sourceUrl,sourceForm:claim.sourceForm,filingDate:claim.filingDate,groqConfidence:claim.confidence,jevProbability:probability,jevMateriality:materiality,evidenceStatus:status,createdAt:now});
  }
  const uniqueClaims=[...new Map(claims.map(claim=>[claim.id,claim])).values()];
  await replaceClaims(env.DB,row.ticker,uniqueClaims);
  const verified=uniqueClaims.filter(claim=>claim.evidenceStatus==="verified").length,review=uniqueClaims.filter(claim=>claim.evidenceStatus==="review").length,status=jevError||review?"review":"complete";
  await finishCompany(env.DB,row.ticker,{status,cik:issuer.cik,filingsFound:selected.length,filingsProcessed:documents.length,claimsExtracted:uniqueClaims.length,claimsVerified:verified,claimsReview:review,message:jevError||undefined});
  return{ticker:row.ticker,status,cik:issuer.cik,filingsFound:selected.length,filingsProcessed:documents.length,claimsExtracted:uniqueClaims.length,claimsVerified:verified,claimsReview:review,claimsRejected:uniqueClaims.filter(claim=>claim.evidenceStatus==="rejected").length};
}

export async function GET(request:NextRequest,env:AppEnv){
  await seedBackfill(env.DB,graph.companies);const limit=Math.min(200,Math.max(1,Number(request.nextUrl.searchParams.get("limit"))||60));return NextResponse.json({total:graph.companies.length,...await readBackfillStatus(env.DB,limit)},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest,env:AppEnv){
  await seedBackfill(env.DB,graph.companies);const body=await request.json().catch(()=>({})) as{ticker?:unknown},ticker=body.ticker?cleanTicker(body.ticker):undefined;if(ticker&&!/^[A-Z0-9.-]{1,16}$/.test(ticker))return NextResponse.json({error:"Invalid ticker"},{status:400});
  const row=await claimCompany(env.DB,ticker);if(!row)return NextResponse.json({total:graph.companies.length,done:true,message:ticker?"Company is already running or not found.":"No pending companies remain.",...await readBackfillStatus(env.DB,12)});
  try{return NextResponse.json({total:graph.companies.length,done:false,result:await processCompany(row,env),...await readBackfillStatus(env.DB,12)},{headers:{"Cache-Control":"no-store"}})}catch(error){const message=error instanceof Error?error.message:"Backfill failed";await failCompany(env.DB,row.ticker,message);return NextResponse.json({total:graph.companies.length,done:false,result:{ticker:row.ticker,status:"failed",error:message},...await readBackfillStatus(env.DB,12)},{status:502})}
}
