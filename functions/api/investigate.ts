import {POST} from "@/server/investigate";
import {pageRequest,type AppEnv} from "@/lib/http";
export const onRequestPost:PagesFunction<AppEnv>=context=>POST(pageRequest(context.request),context.env);
