import {GET} from "@/server/news";
import {pageRequest,type AppEnv} from "@/lib/http";
export const onRequestGet:PagesFunction<AppEnv>=context=>GET(pageRequest(context.request),context.env);
