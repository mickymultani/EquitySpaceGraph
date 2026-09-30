import type {ResearchCompany} from "@/lib/graph-research";

export type BackfillStatus="pending"|"running"|"complete"|"review"|"failed";
export type BackfillCompanyRow={ticker:string;companyId:string;name:string;layerId:string;layer:string;status:BackfillStatus;cik:string|null;filingsFound:number;filingsProcessed:number;claimsExtracted:number;claimsVerified:number;claimsReview:number;attempts:number;lastError:string|null;startedAt:number|null;completedAt:number|null;updatedAt:number};
export type StoredDocument={id:string;ticker:string;cik:string|null;form:string;filingDate:string;reportDate:string;sourceUrl:string;status:string;charactersAnalyzed:number;error:string|null;processedAt:number};
export type StoredClaim={id:string;ticker:string;subjectName:string;predicate:string;objectName:string;objectTicker:string|null;relationshipClass:string;product:string|null;amount:string|null;percentage:string|null;mechanism:string|null;evidenceExcerpt:string;sourceUrl:string;sourceForm:string;filingDate:string;groqConfidence:number;jevProbability:number|null;jevMateriality:number|null;evidenceStatus:string;createdAt:number};

export async function seedBackfill(db:D1Database,companies:ResearchCompany[]){
  const now=Date.now(),sql="INSERT INTO backfill_company (ticker,company_id,name,layer_id,layer,status,updated_at) VALUES (?,?,?,?,?,'pending',?) ON CONFLICT(ticker) DO UPDATE SET company_id=excluded.company_id,name=excluded.name,layer_id=excluded.layer_id,layer=excluded.layer";
  await db.prepare("DELETE FROM backfill_company WHERE ticker='' ").run();
  for(let index=0;index<companies.length;index+=60)await db.batch(companies.slice(index,index+60).map(company=>db.prepare(sql).bind(company.ticker?.trim().toUpperCase()||company.id,company.id,company.name,company.layerId||"unmapped",company.layer||"Unmapped",now)));
  await db.prepare("UPDATE backfill_company SET status='pending', last_error='Recovered stale worker', updated_at=? WHERE status='running' AND updated_at<?").bind(now,now-30*60*1000).run();
}

const selectColumns="ticker,company_id AS companyId,name,layer_id AS layerId,layer,status,cik,filings_found AS filingsFound,filings_processed AS filingsProcessed,claims_extracted AS claimsExtracted,claims_verified AS claimsVerified,claims_review AS claimsReview,attempts,last_error AS lastError,started_at AS startedAt,completed_at AS completedAt,updated_at AS updatedAt";

export async function claimCompany(db:D1Database,ticker?:string){
  const now=Date.now();let row:BackfillCompanyRow|null=null;
  if(ticker)row=await db.prepare(`SELECT ${selectColumns} FROM backfill_company WHERE ticker=?`).bind(ticker).first<BackfillCompanyRow>();
  else row=await db.prepare(`SELECT ${selectColumns} FROM backfill_company WHERE status IN ('pending','failed') AND attempts<4 ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, layer_id, ticker LIMIT 1`).first<BackfillCompanyRow>();
  if(!row)return null;
  const result=await db.prepare("UPDATE backfill_company SET status='running',attempts=attempts+1,started_at=COALESCE(started_at,?),completed_at=NULL,last_error=NULL,updated_at=? WHERE ticker=? AND (status!='running' OR updated_at<?)").bind(now,now,row.ticker,now-30*60*1000).run();
  if(!result.meta.changes)return null;
  return{...row,status:"running" as const,attempts:row.attempts+1,updatedAt:now};
}

export async function saveDocuments(db:D1Database,rows:StoredDocument[]){
  if(!rows.length)return;const sql="INSERT INTO source_document (id,ticker,cik,form,filing_date,report_date,source_url,status,characters_analyzed,error,processed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,characters_analyzed=excluded.characters_analyzed,error=excluded.error,processed_at=excluded.processed_at";
  await db.batch(rows.map(row=>db.prepare(sql).bind(row.id,row.ticker,row.cik,row.form,row.filingDate,row.reportDate,row.sourceUrl,row.status,row.charactersAnalyzed,row.error,row.processedAt)));
}

export async function replaceClaims(db:D1Database,ticker:string,rows:StoredClaim[]){
  await db.prepare("DELETE FROM extracted_claim WHERE ticker=?").bind(ticker).run();if(!rows.length)return;
  const sql="INSERT INTO extracted_claim (id,ticker,subject_name,predicate,object_name,object_ticker,relationship_class,product,amount,percentage,mechanism,evidence_excerpt,source_url,source_form,filing_date,groq_confidence,jev_probability,jev_materiality,evidence_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
  for(let index=0;index<rows.length;index+=35)await db.batch(rows.slice(index,index+35).map(row=>db.prepare(sql).bind(row.id,row.ticker,row.subjectName,row.predicate,row.objectName,row.objectTicker,row.relationshipClass,row.product,row.amount,row.percentage,row.mechanism,row.evidenceExcerpt,row.sourceUrl,row.sourceForm,row.filingDate,row.groqConfidence,row.jevProbability,row.jevMateriality,row.evidenceStatus,row.createdAt)));
}

export async function finishCompany(db:D1Database,ticker:string,input:{status:"complete"|"review";cik:string|null;filingsFound:number;filingsProcessed:number;claimsExtracted:number;claimsVerified:number;claimsReview:number;message?:string}){
  const now=Date.now();await db.prepare("UPDATE backfill_company SET status=?,cik=?,filings_found=?,filings_processed=?,claims_extracted=?,claims_verified=?,claims_review=?,last_error=?,completed_at=?,updated_at=? WHERE ticker=?").bind(input.status,input.cik,input.filingsFound,input.filingsProcessed,input.claimsExtracted,input.claimsVerified,input.claimsReview,input.message||null,now,now,ticker).run();
}

export async function failCompany(db:D1Database,ticker:string,error:string){const now=Date.now();await db.prepare("UPDATE backfill_company SET status='failed',last_error=?,completed_at=?,updated_at=? WHERE ticker=?").bind(error.slice(0,900),now,now,ticker).run()}

export async function readBackfillStatus(db:D1Database,limit=60){
  const summary=await db.prepare("SELECT status,COUNT(*) AS count,SUM(claims_extracted) AS claimsExtracted,SUM(claims_verified) AS claimsVerified,SUM(claims_review) AS claimsReview,SUM(filings_processed) AS filingsProcessed FROM backfill_company GROUP BY status").all(),companies=await db.prepare(`SELECT ${selectColumns} FROM backfill_company ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'failed' THEN 1 WHEN 'review' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END, updated_at DESC LIMIT ?`).bind(limit).all<BackfillCompanyRow>(),recentClaims=await db.prepare("SELECT ticker,subject_name AS subjectName,predicate,object_name AS objectName,object_ticker AS objectTicker,relationship_class AS relationshipClass,evidence_status AS evidenceStatus,source_url AS sourceUrl,filing_date AS filingDate,jev_probability AS jevProbability FROM extracted_claim ORDER BY created_at DESC LIMIT 30").all();
  return{summary:summary.results,companies:companies.results,recentClaims:recentClaims.results};
}
