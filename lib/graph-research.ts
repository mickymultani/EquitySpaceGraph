export type ResearchCompany={id:string;name:string;ticker:string;exchange?:string;listing?:string;region?:string;layerId:string;layer:string;domain?:string;role?:string;products?:string[];evidence?:string;sourceUrl?:string;coverage?:string;notes?:string;type?:string};
export type ResearchEdge={id:string;sourceId:string;source:string;sourceType:string;sourceTicker?:string;type:string;targetId:string;target:string;targetType:string;targetTicker?:string;layerId:string;layer:string;product?:string;evidence:string;score:number;sourceUrl?:string;directness?:string;criticality?:string;substitutability?:string;mechanism?:string;notes?:string;flowClass?:string;amount?:string;status?:string};
export type ResearchLayer={id:string;name:string;sequence:number;scope:string;objects:string;question:string};
export type GraphPayload={companies:ResearchCompany[];edges:ResearchEdge[];layers?:ResearchLayer[];generatedAt?:string};

const companyQuality=(company:ResearchCompany)=>Number(Boolean(company.layerId&&company.layer!=="Unmapped"))*20+Number(Boolean(company.sourceUrl))*5+(company.products?.length||0)+Number(Boolean(company.role))*3;
const entityKey=(company:ResearchCompany)=>company.ticker?`T:${company.ticker.toUpperCase()}`:`I:${company.id}`;

export function mergeGraphPayloads(payloads:GraphPayload[]){
  const selected=new Map<string,ResearchCompany>(),aliases=new Map<string,string>();
  for(const payload of payloads)for(const company of payload.companies||[]){const key=entityKey(company),current=selected.get(key);if(!current||companyQuality(company)>companyQuality(current))selected.set(key,company)}
  for(const payload of payloads)for(const company of payload.companies||[])aliases.set(company.id,selected.get(entityKey(company))?.id||company.id);
  const companies=[...selected.values()],byId=new Map(companies.map(company=>[company.id,company])),edges=new Map<string,ResearchEdge>();
  for(const payload of payloads)for(const edge of payload.edges||[]){const sourceId=aliases.get(edge.sourceId)||edge.sourceId,targetId=aliases.get(edge.targetId)||edge.targetId;if(sourceId===targetId)continue;const source=byId.get(sourceId),target=byId.get(targetId),normalized={...edge,sourceId,targetId,source:source?.name||edge.source,target:target?.name||edge.target,sourceTicker:source?.ticker||edge.sourceTicker,targetTicker:target?.ticker||edge.targetTicker};const key=`${sourceId}|${targetId}|${edge.type}|${edge.product||""}`,current=edges.get(key);if(!current||normalized.score>current.score||(normalized.evidence.startsWith("VERIFIED")&&!current.evidence.startsWith("VERIFIED")))edges.set(key,normalized)}
  const first=payloads[0];return{generatedAt:first?.generatedAt||new Date().toISOString(),companies,edges:[...edges.values()],layers:first?.layers||[]};
}

export function graphCoverage(graph:ReturnType<typeof mergeGraphPayloads>){
  const degree=new Map(graph.companies.map(company=>[company.id,0])),verifiedByLayer=new Map<string,number>(),totalByLayer=new Map<string,number>();
  for(const edge of graph.edges){if(degree.has(edge.sourceId))degree.set(edge.sourceId,(degree.get(edge.sourceId)||0)+1);if(degree.has(edge.targetId))degree.set(edge.targetId,(degree.get(edge.targetId)||0)+1);totalByLayer.set(edge.layerId,(totalByLayer.get(edge.layerId)||0)+1);if(edge.evidence.startsWith("VERIFIED"))verifiedByLayer.set(edge.layerId,(verifiedByLayer.get(edge.layerId)||0)+1)}
  const layers=graph.layers.map(layer=>{const companies=graph.companies.filter(company=>company.layerId===layer.id);return{id:layer.id,name:layer.name,companies:companies.length,relationships:totalByLayer.get(layer.id)||0,verified:verifiedByLayer.get(layer.id)||0,isolated:companies.filter(company=>!(degree.get(company.id)||0)).length}});
  return{companies:graph.companies.length,relationships:graph.edges.length,verified:graph.edges.filter(edge=>edge.evidence.startsWith("VERIFIED")).length,derived:graph.edges.filter(edge=>!edge.evidence.startsWith("VERIFIED")).length,isolated:graph.companies.filter(company=>!(degree.get(company.id)||0)).length,layers,degree};
}
