import {GET,POST} from "@/server/market";
import {pageRequest,type AppEnv} from "@/lib/http";
export const onRequestGet:PagesFunction<AppEnv>=context=>GET(pageRequest(context.request),context.env);
export const onRequestPost:PagesFunction<AppEnv>=context=>POST(pageRequest(context.request),context.env);
