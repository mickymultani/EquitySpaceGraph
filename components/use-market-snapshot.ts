"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";

export type MarketSnapshot={symbol:string;price:number|null;change:number|null;changePct:number|null;previousClose:number|null;timestamp:number|null;marketCap:number|null;currency:string|null;companyUrl?:string|null;logo?:string|null;source:string;status:string;quoteRefreshedAt?:number|null;profileRefreshedAt?:number|null;ageMinutes?:number|null};
type SnapshotMeta={asOf:number|null;expected:number;resolved:number;complete:boolean;stale:boolean;refreshing:boolean};
type SnapshotResponse={items?:MarketSnapshot[];asOf?:number|null;expected?:number;resolved?:number;complete?:boolean;stale?:boolean;snapshotComplete?:boolean;retryAfterMs?:number};
const EMPTY:SnapshotMeta={asOf:null,expected:0,resolved:0,complete:false,stale:true,refreshing:false};

export function useMarketSnapshot(inputSymbols:string[]){
  const inputKey=inputSymbols.join("|"),symbols=useMemo(()=>Array.from(new Set(inputKey.split("|").filter(Boolean))).sort(),[inputKey]),key=symbols.join(","),[market,setMarket]=useState<Record<string,MarketSnapshot>>({}),[meta,setMeta]=useState<SnapshotMeta>(EMPTY),generation=useRef(0);
  const merge=useCallback((items:MarketSnapshot[])=>{if(!items.length)return;setMarket(old=>{const next={...old};for(const item of items)next[item.symbol]={...old[item.symbol],...item};return next})},[]);
  const read=useCallback(async()=>{if(!key)return null;const response=await fetch(`/api/market?symbols=${encodeURIComponent(key)}`,{cache:"no-store"}),body=await response.json() as SnapshotResponse;merge(body.items||[]);setMeta(old=>({...old,asOf:body.asOf??null,expected:body.expected??symbols.length,resolved:body.resolved??0,complete:Boolean(body.complete),stale:Boolean(body.stale)}));return body},[key,merge,symbols.length]);
  useEffect(()=>{if(!symbols.length)return;const runId=++generation.current;let timer:ReturnType<typeof setTimeout>|undefined,cancelled=false;
    const cycle=async()=>{
      const snapshot=await read().catch(()=>null);if(cancelled||runId!==generation.current)return;
      const bySymbol=new Map<string,MarketSnapshot>((snapshot?.items||[]).map((item:MarketSnapshot)=>[item.symbol,item])),now=Date.now(),queue=symbols.filter(symbol=>{const item=bySymbol.get(symbol);return!item?.quoteRefreshedAt||now-item.quoteRefreshedAt>15*60*1000});
      if(!queue.length){timer=setTimeout(cycle,15*60*1000);return}
      setMeta(old=>({...old,refreshing:true}));
      for(let index=0;index<queue.length&&!cancelled;index+=6){
        const batch=queue.slice(index,index+6),response=await fetch("/api/market",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbols:batch})}).catch(()=>null);
        if(response?.ok){const body=await response.json() as SnapshotResponse;merge(body.items||[]);if(index+6<queue.length)await new Promise(resolve=>{timer=setTimeout(resolve,body.retryAfterMs||15000)})}else if(index+6<queue.length)await new Promise(resolve=>{timer=setTimeout(resolve,15000)});
      }
      if(cancelled)return;setMeta(old=>({...old,refreshing:false}));const final=await read().catch(()=>null);if(!cancelled)timer=setTimeout(cycle,final?.snapshotComplete?15*60*1000:60*1000);
    };
    void cycle();return()=>{cancelled=true;if(timer)clearTimeout(timer)};
  },[key,read,symbols,merge]);
  return{market,meta,read};
}
