import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OptimizationParams { num_selections:number; min_asset_score:number; max_correlation:number; top_k:number; min_odd:number; max_odd:number }
interface Bet { id:string; match_id:string; home_team:string; away_team:string; league:string; market:string; bookmaker:string; odd:number; value_percentage:number; expected_value:number; confidence:number; stake_percentage:number; asset_score:number; estimated_probability:number; commence_time:string; teams:string[] }
interface ScoredParlay { id:string; bets:Bet[]; score:number; totalOdd:number; avgEdge:number; avgCorrelation:number; combinedProbability:number; expectedROI:number; kellyStake:number; riskLevel:"LOW"|"MEDIUM"|"HIGH"|"EXTREME"; breakdown:{edgeScore:number;independenceScore:number;probabilityScore:number;sharpeScore:number}; warnings:string[] }

function validateParams(body:any): OptimizationParams {
  const p:OptimizationParams = {num_selections:body.num_selections??4, min_asset_score:body.min_asset_score??70, max_correlation:body.max_correlation??0.3, top_k:body.top_k??5, min_odd:body.min_odd??1.3, max_odd:body.max_odd??100}
  if(p.num_selections<3||p.num_selections>8) throw new Error("num_selections deve estar entre 3 e 8")
  if(p.min_asset_score<50||p.min_asset_score>100) throw new Error("min_asset_score deve estar entre 50 e 100")
  if(p.max_correlation<0||p.max_correlation>1) throw new Error("max_correlation deve estar entre 0 e 1")
  if(p.top_k<1||p.top_k>20) throw new Error("top_k deve estar entre 1 e 20")
  if(p.min_odd<1.01) throw new Error("min_odd deve ser >= 1.01")
  if(p.max_odd<p.min_odd) throw new Error("max_odd deve ser >= min_odd")
  return p
}

async function fetchEligibleBets(supabase:any, params:OptimizationParams): Promise<Bet[]> {
  const now = new Date().toISOString()
  const {data,error} = await supabase.from("punter_analyses").select("*")
    .eq("verdict","APROVADO").gte("confidence",params.min_asset_score)
    .gte("odd",params.min_odd).lte("odd",params.max_odd)
    .gt("commence_time",now).order("value_percentage",{ascending:false}).limit(200)
  if(error) throw new Error(`Erro ao buscar análises: ${error.message}`)
  if(!data?.length) return []
  return data.filter((a:any)=>(a.value_percentage||0)>=3).map((a:any)=>{
    const ip=a.implied_probability||(1/a.odd)*100
    const ep=a.estimated_probability||ip+(a.value_percentage||0)
    return {id:a.id,match_id:a.match_id,home_team:a.home_team,away_team:a.away_team,league:a.league,market:a.market,bookmaker:a.bookmaker,odd:a.odd,
      value_percentage:a.value_percentage||0,expected_value:(a.value_percentage||0)/100,confidence:a.confidence||70,stake_percentage:a.stake_percentage||2,
      asset_score:a.confidence||70,estimated_probability:Math.min(99,Math.max(1,ep)),commence_time:a.commence_time,teams:[a.home_team,a.away_team]}
  })
}

function calcCorr(a:Bet, b:Bet): number {
  if(a.match_id===b.match_id) {
    const am=a.market.toLowerCase(),bm=b.market.toLowerCase()
    if((am.includes('casa')&&bm.includes('fora'))||(am.includes('fora')&&bm.includes('casa'))||(am.includes('empate')&&(bm.includes('casa')||bm.includes('fora')))) return -1
    return 0.85
  }
  let c=0
  const common=a.teams.filter(t=>b.teams.includes(t))
  if(common.length) { c+=0.7; const t=common[0],sA=a.home_team===t?'h':a.away_team===t?'a':null,sB=b.home_team===t?'h':b.away_team===t?'a':null; if(sA&&sB&&sA!==sB) c+=0.1 }
  if(a.league===b.league) c+=0.12
  if(a.market===b.market) c+=0.08
  if(a.bookmaker===b.bookmaker) c+=0.03
  return Math.min(c,1)
}

function buildMatrix(bets:Bet[]): number[][] {
  const n=bets.length, m:number[][]=Array.from({length:n},()=>Array(n).fill(0))
  for(let i=0;i<n;i++){for(let j=i+1;j<n;j++){const c=calcCorr(bets[i],bets[j]);m[i][j]=c;m[j][i]=c};m[i][i]=1}
  return m
}

function kelly(totalOdd:number, prob:number, corr:number, n:number): number {
  const p=prob/100,b=totalOdd-1,q=1-p
  let k=(p*b-q)/b; if(k<=0) return 0
  let s=k*0.25; s*=Math.pow(1-corr,1.5)
  if(n>4) s*=Math.pow(0.9,n-4)
  if(totalOdd>10) s*=Math.sqrt(10/totalOdd)
  return Math.max(0.5,Math.min(5,s*100))
}

function scoreParlay(bets:Bet[], cm:number[][], idx:number[], maxCorr:number): ScoredParlay {
  const n=idx.length, sel=idx.map(i=>bets[i])
  const tOdd=sel.reduce((a,b)=>a*b.odd,1), avgE=sel.reduce((a,b)=>a+b.value_percentage,0)/n
  const cProb=sel.reduce((a,b)=>a*(b.estimated_probability/100),1)*100
  let sC=0,pc=0
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){sC+=cm[idx[i]][idx[j]];pc++}
  const avgC=pc?sC/pc:0, eROI=tOdd*(cProb/100)-1
  const eS=Math.min(avgE/10,1)*0.4, iS=(1-avgC)*0.3
  let pS=0; if(cProb<5) pS=(cProb/100)*2*0.2; else if(cProb>50) pS=Math.max(0,1-(cProb-50)/50)*0.2; else pS=Math.min(cProb/30,1)*0.2
  let shS=0; if(cProb>0){const v=sel.reduce((a,b)=>{const p=b.estimated_probability/100;return a+b.odd*b.odd*p*(1-p)},0);shS=Math.min(Math.max(eROI/(Math.sqrt(v)+1e-6),0)/2,1)*0.1}
  const score=eS+iS+pS+shS, ks=kelly(tOdd,cProb,avgC,n)
  let rl:"LOW"|"MEDIUM"|"HIGH"|"EXTREME"
  if(avgC<0.25&&cProb>=20) rl='LOW'; else if(avgC<0.4&&cProb>=10) rl='MEDIUM'; else if(avgC<0.6&&cProb>=5) rl='HIGH'; else rl='EXTREME'
  const w:string[]=[]; if(eROI<0) w.push('⚠️ ROI negativo'); if(avgC>maxCorr) w.push('⚠️ Correlação alta'); if(ks<0.5) w.push('ℹ️ Kelly baixo'); if(cProb<5) w.push('🔴 Prob<5%'); if(cProb>50) w.push('🟡 Prob alta')
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(cm[idx[i]][idx[j]]>0.7) w.push(`⚠️ Par ${i+1}-${j+1} corr ${cm[idx[i]][idx[j]].toFixed(2)}`)
  return {id:idx.join('-'),bets:sel,score:Math.round(score*100)/100,totalOdd:Math.round(tOdd*100)/100,avgEdge:Math.round(avgE*100)/100,avgCorrelation:Math.round(avgC*100)/100,
    combinedProbability:Math.round(cProb*100)/100,expectedROI:Math.round(eROI*10000)/100,kellyStake:Math.round(ks*100)/100,riskLevel:rl,
    breakdown:{edgeScore:Math.round(eS*100)/100,independenceScore:Math.round(iS*100)/100,probabilityScore:Math.round(pS*100)/100,sharpeScore:Math.round(shS*100)/100},warnings:w}
}

function comb(n:number,k:number):number{if(k<0||k>n)return 0;if(k===0||k===n)return 1;k=Math.min(k,n-k);let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}

function generate(bets:Bet[], cm:number[][], params:OptimizationParams): ScoredParlay[] {
  const n=bets.length,k=params.num_selections; if(n<k) return []
  const sorted=bets.map((_,i)=>i).sort((a,b)=>bets[b].value_percentage-bets[a].value_percentage)
  const bw=Math.min(50,n), cands=sorted.slice(0,bw)
  const combos:number[][]=[], total=comb(bw,k), max=100000
  if(total>max) {
    const used=new Set<string>()
    while(combos.length<max){const sh=[...cands].sort(()=>Math.random()-0.5),c=sh.slice(0,k).sort((a,b)=>a-b),key=c.join(',');if(!used.has(key)){used.add(key);combos.push(c)}}
  } else {
    const gen=(s:number,ch:number[])=>{if(ch.length===k){combos.push([...ch]);return};for(let i=s;i<cands.length;i++){ch.push(cands[i]);gen(i+1,ch);ch.pop()}}
    gen(0,[])
  }
  const scored:ScoredParlay[]=[]
  for(const c of combos) {
    let bad=false; for(let i=0;i<k&&!bad;i++) for(let j=i+1;j<k&&!bad;j++) if(cm[c[i]][c[j]]<0) bad=true
    if(bad) continue
    const p=scoreParlay(bets,cm,c,params.max_correlation); if(p.avgCorrelation<=params.max_correlation) scored.push(p)
  }
  scored.sort((a,b)=>b.score-a.score); return scored
}

function diversify(parlays:ScoredParlay[], topK:number): ScoredParlay[] {
  if(!parlays.length) return []
  const sel:ScoredParlay[]=[]
  for(const p of parlays) {
    let sim=false; for(const s of sel){const c=s.bets.filter(sb=>p.bets.some(pb=>pb.id===sb.id)).length;if(c/Math.max(s.bets.length,p.bets.length)>0.6){sim=true;break}}
    if(!sim) sel.push(p); if(sel.length>=topK) break
  }
  if(sel.length<topK) for(const p of parlays){if(!sel.includes(p)) sel.push(p);if(sel.length>=topK) break}
  return sel.slice(0,topK)
}

serve(async (req) => {
  const st=Date.now()
  if(req.method==='OPTIONS') return new Response(null,{headers:corsHeaders})
  try {
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const body=await req.json(), params=validateParams(body)
    console.log(`[MultiBet] Params: ${JSON.stringify(params)}`)
    const bets=await fetchEligibleBets(sb,params)
    console.log(`[MultiBet] ${bets.length} apostas elegíveis`)
    if(bets.length<params.num_selections) return new Response(JSON.stringify({success:true,eligible_count:bets.length,total_available:bets.length,total_combinations_scored:0,parlays:[],execution_time_ms:Date.now()-st,
      message:!bets.length?'Nenhuma aposta aprovada. Execute o Scanner primeiro.':`Apenas ${bets.length} apostas. Mínimo ${params.num_selections} necessário.`,
      metadata:{params_used:params,avg_correlation_threshold:params.max_correlation,timestamp:new Date().toISOString()}}),{headers:{...corsHeaders,"Content-Type":"application/json"}})
    console.log("[MultiBet] Construindo matriz...")
    const cm=buildMatrix(bets)
    console.log("[MultiBet] Gerando combinações...")
    const scored=generate(bets,cm,params)
    console.log(`[MultiBet] ${scored.length} parlays gerados`)
    const top=diversify(scored,params.top_k)
    return new Response(JSON.stringify({success:true,eligible_count:bets.length,total_available:bets.length,total_combinations_scored:scored.length,parlays:top,execution_time_ms:Date.now()-st,
      metadata:{params_used:params,avg_correlation_threshold:params.max_correlation,timestamp:new Date().toISOString()}}),{headers:{...corsHeaders,"Content-Type":"application/json"}})
  } catch(e:any) {
    console.error("[MultiBet] Erro:",e)
    return new Response(JSON.stringify({success:false,error:e?.message||"Unknown error",execution_time_ms:Date.now()-st}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}})
  }
})
