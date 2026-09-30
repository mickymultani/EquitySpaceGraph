import {POST} from "@/server/copilot";
import {pageRequest,type AppEnv} from "@/lib/http";
export const onRequestPost:PagesFunction<AppEnv>=context=>POST(pageRequest(context.request),context.env);
