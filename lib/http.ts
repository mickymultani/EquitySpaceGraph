export type AppEnv={
  DB:D1Database;
  FINNHUB_API_KEY?:string;
  GROQ_API_KEY?:string;
  GROQ_MODEL?:string;
  TYPESAFE_API_KEY?:string;
  TYPESAFE_MODEL?:string;
  SEC_USER_AGENT?:string;
};

export type NextRequest=Request&{readonly nextUrl:URL};
export const NextResponse={
  json(body:unknown,init?:ResponseInit){return Response.json(body,init)},
};

export function pageRequest(request:Request){
  return Object.assign(request,{nextUrl:new URL(request.url)}) as NextRequest;
}
