declare namespace Cloudflare {
  interface Env {
    DB:D1Database;
    FINNHUB_API_KEY?:string;
    GROQ_API_KEY?:string;
    GROQ_MODEL?:string;
    TYPESAFE_API_KEY?:string;
    TYPESAFE_MODEL?:string;
    SEC_USER_AGENT?:string;
  }
}
