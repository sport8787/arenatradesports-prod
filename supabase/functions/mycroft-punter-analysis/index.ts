import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}
const MAX_GAMES = 50, BATCH = 5, API_FB = 'https://v3.football.api-sports.io'
const teamCache = new Map<string, number>()
const hdr = (k: string) => ({ 'x-apisports-key': k })
const yr = () => { const d = new Date(); return (d.getMonth()+1) < 8 ? d.getFullYear()-1 : d.getFullYear() }

const leagueMap: Record<string, number> = {
  'soccer_brazil_campeonato':71,'soccer_brazil_serie_b':72,
  'soccer_brazil_campeonato_paulista':475,'soccer_brazil_campeonato_carioca':476,
  'soccer_brazil_campeonato_mineiro':477,'soccer_brazil_campeonato_gaucho':478,
  'soccer_brazil_campeonato_baiano':479,'soccer_brazil_campeonato_paranaense':480,
  'soccer_brazil_campeonato_catarinense':481,'soccer_brazil_campeonato_pernambucano':604,
  'soccer_epl':39,'soccer_spain_la_liga':140,'soccer_germany_bundesliga':78,
  'soccer_italy_serie_a':135,'soccer_france_ligue_one':61,
  'soccer_uefa_champs_league':2,'soccer_uefa_europa_league':3,
  'soccer_conmebol_copa_libertadores':13,'soccer_conmebol_copa_sudamericana':11,
  'soccer_argentina_primera_division':128,
}

const estaduaisMap: Record<string, { id: number; name: string }> = {
  'soccer_brazil_campeonato_paulista':{id:475,name:'Paulistão'},
  'soccer_brazil_campeonato_carioca':{id:476,name:'Carioca'},
  'soccer_brazil_campeonato_mineiro':{id:477,name:'Mineiro'},
  'soccer_brazil_campeonato_gaucho':{id:478,name:'Gaúcho'},
  'soccer_brazil_campeonato_baiano':{id:479,name:'Baiano'},
  'soccer_brazil_campeonato_paranaense':{id:480,name:'Paranaense'},
  'soccer_brazil_campeonato_catarinense':{id:481,name:'Catarinense'},
  'soccer_brazil_campeonato_pernambucano':{id:604,name:'Pernambucano'},
}

async function apiFetch(url: string, key: string) {
  try {
    const r = await fetch(url, { headers: hdr(key) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function searchTeamId(name: string, key: string): Promise<number|null> {
  if (!key) return null
  const ck = name.toLowerCase().trim()
  if (teamCache.has(ck)) return teamCache.get(ck)!
  let d = await apiFetch(`${API_FB}/teams?search=${encodeURIComponent(name)}`, key)
  let id = d?.response?.[0]?.team?.id || null
  if (!id && name.split(' ').length > 1) {
    const parts = name.split(' ')
    const short = parts.length > 2 ? parts.slice(0,2).join(' ') : parts[parts.length-1]
    console.log(`[API-Football] Team "${name}" not found, trying "${short}"...`)
    d = await apiFetch(`${API_FB}/teams?search=${encodeURIComponent(short)}`, key)
    id = d?.response?.[0]?.team?.id || null
    if (id) console.log(`[API-Football] ✅ Found team "${name}" as "${d.response[0].team.name}" (ID: ${id})`)
  }
  if (!id) console.warn(`[API-Football] ⚠️ Team "${name}" not found`)
  else { console.log(`[API-Football] ✅ Team "${name}" -> ID: ${id}`); teamCache.set(ck, id) }
  return id
}

async function fetchFixtures(teamId: number, key: string, last=5) {
  if (!key||!teamId) return []
  return (await apiFetch(`${API_FB}/fixtures?team=${teamId}&last=${last}&status=FT`, key))?.response || []
}
async function fetchFixtureStats(fid: number, key: string) {
  if (!key||!fid) return []
  return (await apiFetch(`${API_FB}/fixtures/statistics?fixture=${fid}`, key))?.response || []
}
async function fetchSeasonStats(tid: number, lid: number|null, key: string) {
  if (!key||!tid) return null
  const q = lid ? `team=${tid}&season=${yr()}&league=${lid}` : `team=${tid}&season=${yr()}`
  return (await apiFetch(`${API_FB}/teams/statistics?${q}`, key))?.response || null
}
async function fetchH2H(hid: number, aid: number, key: string) {
  if (!key||!hid||!aid) return []
  return (await apiFetch(`${API_FB}/fixtures/headtohead?h2h=${hid}-${aid}&last=10`, key))?.response || []
}
async function fetchInjuries(tid: number, key: string) {
  if (!key||!tid) return []
  return ((await apiFetch(`${API_FB}/injuries?team=${tid}&season=${yr()}`, key))?.response || []).slice(0,10)
}
async function fetchStandings(lid: number|null, key: string) {
  if (!key||!lid) return []
  return (await apiFetch(`${API_FB}/standings?league=${lid}&season=${yr()}`, key))?.response?.[0]?.league?.standings?.[0] || []
}
async function fetchPredictions(fid: number, key: string) {
  if (!key||!fid) return null
  return (await apiFetch(`${API_FB}/predictions?fixture=${fid}`, key))?.response?.[0] || null
}
async function findFixtureId(hid: number, aid: number, key: string) {
  if (!key||!hid||!aid) return null
  const t = new Date().toISOString().split('T')[0]
  const nw = new Date(Date.now()+7*864e5).toISOString().split('T')[0]
  const d = await apiFetch(`${API_FB}/fixtures?team=${hid}&from=${t}&to=${nw}&status=NS`, key)
  return (d?.response||[]).find((f:any)=>(f.teams?.home?.id===hid&&f.teams?.away?.id===aid)||(f.teams?.home?.id===aid&&f.teams?.away?.id===hid))?.fixture?.id || null
}

// Corners & Cards stats from fixture history
async function fetchStatsByType(tid: number, key: string, types: string[]) {
  if (!key||!tid) return null
  const fixtures = await fetchFixtures(tid, key, 10)
  if (!fixtures.length) return null
  const totals: Record<string, {for:number,against:number}> = {}
  types.forEach(t => totals[t] = {for:0,against:0})
  let games = 0
  for (const fix of fixtures) {
    const fid = fix.fixture?.id; if (!fid) continue
    const stats = await fetchFixtureStats(fid, key)
    for (const ts of stats) {
      for (const type of types) {
        const v = ts.statistics?.find((s:any)=>s.type===type)?.value
        if (ts.team?.id === tid) totals[type].for += parseInt(v)||0
        else totals[type].against += parseInt(v)||0
      }
    }
    games++
  }
  if (!games) return null
  const r: any = { sample_size: games }
  for (const type of types) {
    const k = type.toLowerCase().replace(/\s+/g,'_')
    r[`avg_${k}_for`] = totals[type].for/games
    r[`avg_${k}_against`] = totals[type].against/games
  }
  return r
}

async function fetchRefereeProfile(name: string, key: string) {
  if (!key||!name) return null
  const d = await apiFetch(`${API_FB}/fixtures?referee=${encodeURIComponent(name)}&last=20`, key)
  const fixtures = d?.response || []; if (!fixtures.length) return null
  let ty=0, tr=0, g=0
  for (const fix of fixtures) {
    const fid = fix.fixture?.id; if (!fid) continue
    const stats = await fetchFixtureStats(fid, key)
    let gy=0, gr=0
    for (const ts of stats) {
      gy += parseInt(ts.statistics?.find((s:any)=>s.type==='Yellow Cards')?.value)||0
      gr += parseInt(ts.statistics?.find((s:any)=>s.type==='Red Cards')?.value)||0
    }
    ty+=gy; tr+=gr; g++
  }
  if (!g) return null
  const avgY = ty/g
  return { avg_yellow_per_game:avgY, avg_red_per_game:tr/g, avg_total_cards:(ty+tr)/g,
    strictness: avgY>4?'ALTA':avgY>3?'MEDIA':'BAIXA', sample_size:g }
}

// Poisson helpers
function poissonCDF(k:number, l:number) {
  let s=0, f=1
  for (let i=0;i<=k;i++) { if(i>0) f*=i; s+=Math.exp(-l)*Math.pow(l,i)/f }
  return s
}
function estimateCorners(hAvg:number, aAvg:number) {
  const lH=hAvg, lA=aAvg, t=lH+lA
  return { expected_total:t, lambda_home:lH, lambda_away:lA,
    probabilities: { over_8_5:1-poissonCDF(8,t), over_9_5:1-poissonCDF(9,t), over_10_5:1-poissonCDF(10,t),
      under_8_5:poissonCDF(8,t), under_9_5:poissonCDF(9,t), under_10_5:poissonCDF(10,t) }}
}
function estimateCards(hAvg:number, aAvg:number, ref:any, rivalry=1.0) {
  let e = (hAvg+aAvg)/2
  if (ref) e = (e+ref.avg_total_cards)/2
  e *= rivalry
  return { expected_total:e, probabilities: {
    over_3_5:e>3.5?0.65:0.35, over_4_5:e>4.5?0.55:0.25, over_5_5:e>5.5?0.45:0.15,
    under_3_5:e<3.5?0.70:0.40, under_4_5:e<4.5?0.60:0.30 }}
}

// Data enrichment
async function fetchEnrichedData(home:string, away:string, key:string, sportKey?:string, incCorners=true, incCards=true) {
  const empty = {home:null,away:null,h2h:null,injuries:{home:[],away:[]},standings:[],predictions:null,model_level:'NIVEL_3',corners:{home:null,away:null},cards:{home:null,away:null},referee:null,homeSeasonStats:null,awaySeasonStats:null}
  if (!key) return empty
  const [hId,aId] = await Promise.all([searchTeamId(home,key),searchTeamId(away,key)])
  if (!hId&&!aId) { console.log(`[API-Football] Nenhum time encontrado: ${home}, ${away}`); return empty }
  const lid = sportKey ? (leagueMap[sportKey]||null) : null
  const [hFix,aFix,hSS,aSS,h2hD,hInj,aInj,stand,fixId,hCorn,aCorn,hCard,aCard] = await Promise.all([
    hId?fetchFixtures(hId,key,5):[], aId?fetchFixtures(aId,key,5):[],
    hId?fetchSeasonStats(hId,lid,key):null, aId?fetchSeasonStats(aId,lid,key):null,
    (hId&&aId)?fetchH2H(hId,aId,key):[], hId?fetchInjuries(hId,key):[], aId?fetchInjuries(aId,key):[],
    fetchStandings(lid,key), (hId&&aId)?findFixtureId(hId,aId,key):null,
    (incCorners&&hId)?fetchStatsByType(hId,key,['Corner Kicks']):null,
    (incCorners&&aId)?fetchStatsByType(aId,key,['Corner Kicks']):null,
    (incCards&&hId)?fetchStatsByType(hId,key,['Yellow Cards','Red Cards']):null,
    (incCards&&aId)?fetchStatsByType(aId,key,['Yellow Cards','Red Cards']):null,
  ])
  let pred = null
  if (fixId) { pred = await fetchPredictions(fixId, key); if(pred) console.log(`[API-Football] ✅ Predictions loaded for fixture ${fixId}`) }
  let referee = null
  if (incCards && fixId) {
    try {
      const fd = await apiFetch(`${API_FB}/fixtures?id=${fixId}`, key)
      const rn = fd?.response?.[0]?.fixture?.referee
      if (rn) { const cn = rn.replace(/\s*\(.*\)/,'').trim(); referee = await fetchRefereeProfile(cn,key)
        if(referee) console.log(`[API-Football] ✅ Referee profile loaded: ${cn} (${referee.strictness})`) }
    } catch {}
  }
  const hStats = processTeamStats(hId,hFix,hSS)
  const aStats = processTeamStats(aId,aFix,aSS)
  // Detailed stats for last fixture
  for (const [stats,fixes,tid] of [[hStats,hFix,hId],[aStats,aFix,aId]] as any[]) {
    if (stats && fixes.length>0) {
      const lid2 = fixes[0]?.fixture?.id
      if (lid2) { const s = await fetchFixtureStats(lid2,key); const ds=s.find((x:any)=>x.team?.id===tid)
        if(ds?.statistics) { stats.last_match_stats={}; for(const st of ds.statistics) stats.last_match_stats[st.type]=st.value; stats.has_detailed_stats=true } }
    }
  }
  const hasSS=hSS||aSS, hasH2H=h2hD.length>0, hasDet=hStats?.has_detailed_stats||aStats?.has_detailed_stats
  let ml='NIVEL_3'; if(hasDet&&hasSS&&hasH2H) ml='NIVEL_1'; else if(hasSS||hasDet) ml='NIVEL_2'
  // Transform corner stats
  const cornHome = hCorn ? {avg_corners_for:hCorn.avg_corner_kicks_for,avg_corners_against:hCorn.avg_corner_kicks_against,sample_size:hCorn.sample_size} : null
  const cornAway = aCorn ? {avg_corners_for:aCorn.avg_corner_kicks_for,avg_corners_against:aCorn.avg_corner_kicks_against,sample_size:aCorn.sample_size} : null
  // Transform card stats
  const cardHome = hCard ? {avg_yellow_for:hCard.avg_yellow_cards_for,avg_yellow_against:hCard.avg_yellow_cards_against,avg_red_for:hCard.avg_red_cards_for,avg_red_against:hCard.avg_red_cards_against,avg_total_cards:(hCard.avg_yellow_cards_for+hCard.avg_yellow_cards_against+hCard.avg_red_cards_for+hCard.avg_red_cards_against),sample_size:hCard.sample_size} : null
  const cardAway = aCard ? {avg_yellow_for:aCard.avg_yellow_cards_for,avg_yellow_against:aCard.avg_yellow_cards_against,avg_red_for:aCard.avg_red_cards_for,avg_red_against:aCard.avg_red_cards_against,avg_total_cards:(aCard.avg_yellow_cards_for+aCard.avg_yellow_cards_against+aCard.avg_red_cards_for+aCard.avg_red_cards_against),sample_size:aCard.sample_size} : null
  return {home:hStats,away:aStats,h2h:processH2H(h2hD,hId,aId),injuries:{home:hInj,away:aInj},standings:stand,homeSeasonStats:hSS,awaySeasonStats:aSS,predictions:pred,model_level:ml,corners:{home:cornHome,away:cornAway},cards:{home:cardHome,away:cardAway},referee}
}

function processTeamStats(tid:number|null, fixes:any[], ss:any) {
  if (!tid||!fixes.length) return null
  let gs=0,gc=0,w=0,d=0,l=0
  for (const f of fixes) {
    const ih=f.teams?.home?.id===tid, hg=f.goals?.home??0, ag=f.goals?.away??0
    gs+=ih?hg:ag; gc+=ih?ag:hg
    if(ih?f.teams?.home?.winner:f.teams?.away?.winner) w++; else if(hg===ag) d++; else l++
  }
  const mp=fixes.length||1
  const s:any = {team_id:tid,matches_played:mp,wins:w,draws:d,losses:l,goals_scored:gs,goals_conceded:gc,
    avg_goals_scored:(gs/mp).toFixed(2),avg_goals_conceded:(gc/mp).toFixed(2),
    form:fixes.map((f:any)=>{const ih=f.teams?.home?.id===tid,hg=f.goals?.home??0,ag=f.goals?.away??0;return ih?(hg>ag?'W':hg===ag?'D':'L'):(ag>hg?'W':ag===hg?'D':'L')}).join(''),
    has_detailed_stats:false}
  if (ss) {
    s.season = {played:ss.fixtures?.played?.total,wins_total:ss.fixtures?.wins?.total,draws_total:ss.fixtures?.draws?.total,losses_total:ss.fixtures?.loses?.total,
      goals_for_total:ss.goals?.for?.total?.total,goals_for_avg:ss.goals?.for?.average?.total,goals_against_total:ss.goals?.against?.total?.total,goals_against_avg:ss.goals?.against?.average?.total,
      clean_sheets:ss.clean_sheet?.total,failed_to_score:ss.failed_to_score?.total,preferred_formation:ss.lineups?.[0]?.formation||null,
      biggest_win_home:ss.biggest?.wins?.home,biggest_win_away:ss.biggest?.wins?.away,biggest_loss_home:ss.biggest?.loses?.home,biggest_loss_away:ss.biggest?.loses?.away,
      goals_for_by_minute:ss.goals?.for?.minute,goals_against_by_minute:ss.goals?.against?.minute,
      penalty_scored:ss.penalty?.scored?.total??null,penalty_missed:ss.penalty?.missed?.total??null,penalty_scored_pct:ss.penalty?.scored?.percentage??null,
      biggest_streak_wins:ss.biggest?.streak?.wins??null,biggest_streak_draws:ss.biggest?.streak?.draws??null,biggest_streak_loses:ss.biggest?.streak?.loses??null,
      cards_yellow_total:Object.values(ss.cards?.yellow||{}).reduce((s:number,v:any)=>s+(v?.total||0),0),
      cards_red_total:Object.values(ss.cards?.red||{}).reduce((s:number,v:any)=>s+(v?.total||0),0)}
  }
  return s
}

function processH2H(data:any[], hId:number|null, aId:number|null) {
  if (!data.length||!hId||!aId) return null
  let hw=0,aw=0,dr=0,tg=0
  const m = data.map((f:any)=>{
    const hg=f.goals?.home??0,ag=f.goals?.away??0; tg+=hg+ag
    const ih=f.teams?.home?.id===hId
    if(ih){if(hg>ag)hw++;else if(ag>hg)aw++;else dr++} else {if(ag>hg)hw++;else if(hg>ag)aw++;else dr++}
    return {date:f.fixture?.date,home:f.teams?.home?.name,away:f.teams?.away?.name,score:`${hg}-${ag}`,league:f.league?.name}
  })
  return {total:data.length,home_wins:hw,away_wins:aw,draws:dr,avg_goals:(tg/data.length).toFixed(2),matches:m.slice(0,5)}
}

// Format blocks
function fmtTeam(name:string, s:any): string {
  if (!s) return `${name}: Dados não disponíveis`
  let b = `${name} (últimos ${s.matches_played} jogos):\n  Forma: ${s.form||'N/A'}\n  Resultados: ${s.wins}V ${s.draws}E ${s.losses}D\n  Gols: ${s.goals_scored} marcados (${s.avg_goals_scored}/j) / ${s.goals_conceded} sofridos (${s.avg_goals_conceded}/j)`
  if (s.has_detailed_stats && s.last_match_stats) {
    const l=s.last_match_stats
    b+=`\n  [Último jogo]: Fin: ${l['Total Shots']||'?'} (gol: ${l['Shots on Goal']||'?'}) Posse: ${l['Ball Possession']||'?'} Escanteios: ${l['Corner Kicks']||'?'} Faltas: ${l['Fouls']||'?'} Amarelos: ${l['Yellow Cards']||'?'} Vermelhos: ${l['Red Cards']||'?'} xG: ${l['expected_goals']||'?'}`
  }
  if (s.season) {
    const ss=s.season
    b+=`\n  [Temporada]: ${ss.played||'?'}J (${ss.wins_total}V ${ss.draws_total}E ${ss.losses_total}D) GF:${ss.goals_for_total}(${ss.goals_for_avg}/j) GC:${ss.goals_against_total}(${ss.goals_against_avg}/j) CS:${ss.clean_sheets||0} FS:${ss.failed_to_score||0} Form:${ss.preferred_formation||'?'}`
    if(ss.cards_yellow_total>0) b+=` Cart:${ss.cards_yellow_total}A/${ss.cards_red_total}V`
    if(ss.goals_for_by_minute) {
      const periods=['0-15','16-30','31-45','46-60','61-75','76-90']
      const hot=periods.filter(p=>(ss.goals_for_by_minute[p]?.total||0)>=3).map(p=>`${p}'`)
      if(hot.length) b+=`\n  🔥 Pressão: ${hot.join(', ')}`
    }
  }
  return b
}
function fmtH2H(h:any) { return h ? `H2H (${h.total}j): Casa ${h.home_wins}V Emp ${h.draws} Fora ${h.away_wins}V Média ${h.avg_goals}gols\n  ${h.matches.map((m:any)=>`${m.date?.substring(0,10)} ${m.home} ${m.score} ${m.away}`).join('\n  ')}` : 'H2H: N/A' }
function fmtInj(name:string, inj:any[]) { return inj?.length ? `${name} Lesões:\n  ${inj.slice(0,5).map((i:any)=>`- ${i.player?.name||'?'} (${i.player?.reason||'?'})`).join('\n  ')}` : `${name}: Sem lesões` }
function fmtStand(st:any[], h:string, a:string) {
  if(!st?.length) return 'Classificação: N/A'
  const rel=st.filter((s:any)=>{const n=(s.team?.name||'').toLowerCase();return h.toLowerCase().includes(n)||n.includes(h.toLowerCase().split(' ')[0])||a.toLowerCase().includes(n)||n.includes(a.toLowerCase().split(' ')[0])})
  const show=rel.length?rel:st.slice(0,5)
  return `Classificação:\n  ${show.map((s:any)=>`${s.rank}º ${s.team?.name} ${s.points}pts (${s.all?.win}V ${s.all?.draw}E ${s.all?.lose}D) GD:${s.goalsDiff}`).join('\n  ')}`
}
function fmtPred(p:any) {
  if(!p) return 'Previsões: N/A'
  let b=`Previsões: ${p.predictions?.winner?.name||'?'} (${p.predictions?.winner?.comment||''}) Conselho: ${p.predictions?.advice||'?'} U/O: ${p.predictions?.under_over||'?'}`
  if(p.predictions?.percent) b+=` Prob: H${p.predictions.percent.home} D${p.predictions.percent.draw} A${p.predictions.percent.away}`
  if(p.comparison) b+=` Atk:${p.comparison.att?.home||'?'}/${p.comparison.att?.away||'?'} Def:${p.comparison.def?.home||'?'}/${p.comparison.def?.away||'?'}`
  return b
}
function fmtCorner(name:string, s:any) { return s ? `${name} (${s.sample_size}j): ${s.avg_corners_for?.toFixed(1)} a favor / ${s.avg_corners_against?.toFixed(1)} contra` : `${name}: Escanteios N/A` }
function fmtCard(name:string, s:any) { return s ? `${name} (${s.sample_size}j): ${s.avg_yellow_for?.toFixed(1)}A/${s.avg_yellow_against?.toFixed(1)}A contra ${s.avg_red_for?.toFixed(1)}V/${s.avg_red_against?.toFixed(1)}V Total: ${s.avg_total_cards?.toFixed(1)}/j` : `${name}: Cartões N/A` }
function fmtRef(r:any) { return r ? `Árbitro (${r.sample_size}j): ${r.avg_total_cards?.toFixed(1)} cartões/j (${r.avg_yellow_per_game?.toFixed(1)}A ${r.avg_red_per_game?.toFixed(1)}V) Rigor: ${r.strictness}` : 'Árbitro: N/A' }

// Market detectors
interface DetResult { mis:number;mis_level:string;odi:number;odi_suspicious:boolean;sharp:{has_rlm:boolean;has_steam:boolean;has_consensus:boolean;activity_score:number;activity_level:string};odd_open:number|null;odd_current:number|null }

function computeDetectors(odds:any[], totals:any[], modelProb:number|null, market:string|null): DetResult {
  const r:DetResult = {mis:0,mis_level:'noise',odi:0,odi_suspicious:false,sharp:{has_rlm:false,has_steam:false,has_consensus:false,activity_score:0,activity_level:'normal'},odd_open:null,odd_current:null}
  if(!odds.length) return r
  const isT=market?.toLowerCase().includes('over')||market?.toLowerCase().includes('under')
  let tOdds:number[]=[], tBooks:any[]=[]
  if(isT&&totals.length) {
    const ln=parseFloat(market?.match(/[\d.]+/)?.[0]||'2.5')
    const tfl=totals.filter((t:any)=>Math.abs(t.line-ln)<0.1)
    tOdds=tfl.map((t:any)=>market?.toLowerCase().includes('over')?t.over_odd:t.under_odd); tBooks=tfl
  } else {
    if(market?.toLowerCase().includes('fora')) tOdds=odds.map((o:any)=>o.away_odd).filter(Boolean)
    else if(market?.toLowerCase().includes('empate')) tOdds=odds.map((o:any)=>o.draw_odd).filter(Boolean)
    else tOdds=odds.map((o:any)=>o.home_odd).filter(Boolean)
    tBooks=odds
  }
  if(tOdds.length<2) return r
  const mx=Math.max(...tOdds),mn=Math.min(...tOdds)
  r.odi=(mx-mn)/mn; r.odi_suspicious=r.odi>0.15; r.odd_open=mx; r.odd_current=mn
  if(modelProb&&modelProb>0) {
    const avgMP=(tOdds.reduce((s,o)=>s+1/o,0)/tOdds.length)*100
    r.mis=Math.abs(modelProb-avgMP)/100
    r.mis_level=r.mis<0.02?'noise':r.mis<0.05?'light':r.mis<0.10?'strong':'extreme'
  }
  let ss=0
  const pinn=tBooks.find((b:any)=>(b.bookmaker||'').toLowerCase().includes('pinnacle'))
  const b365=tBooks.find((b:any)=>(b.bookmaker||'').toLowerCase().includes('bet365'))
  if(pinn&&b365) {
    const getO=(bk:any)=>isT?(market?.includes('Over')?bk.over_odd:bk.under_odd):(market?.includes('Casa')?bk.home_odd:market?.includes('Fora')?bk.away_odd:bk.draw_odd)
    const op=getO(pinn),o3=getO(b365)
    if(op&&o3&&Math.abs(op-o3)/o3>0.05) { r.sharp.has_rlm=true; ss+=25 }
  }
  if(r.odi>0.08) { r.sharp.has_steam=true; ss+=20 }
  const sorted=[...tOdds].sort((a,b)=>a-b), med=sorted[Math.floor(sorted.length/2)]
  if(tOdds.filter(o=>Math.abs(o-med)/med<0.02).length>=3) { r.sharp.has_consensus=true; ss+=15 }
  if(pinn) ss+=10; if(tBooks.some((b:any)=>(b.bookmaker||'').toLowerCase().includes('betfair'))) ss+=5
  if(r.odi_suspicious) ss+=15
  r.sharp.activity_score=Math.min(100,ss)
  r.sharp.activity_level=ss>=40?'steam_professional':ss>=25?'sharp_money':ss>=10?'activity':'normal'
  return r
}

function fmtDetectors(d:DetResult) {
  let b=`MIS: ${(d.mis*100).toFixed(1)}% (${d.mis_level}) | ODI: ${(d.odi*100).toFixed(1)}%${d.odi_suspicious?' ⚠️':''}\nSharp: ${d.sharp.activity_score}/100 (${d.sharp.activity_level}) RLM:${d.sharp.has_rlm?'✅':'❌'} Steam:${d.sharp.has_steam?'✅':'❌'} Consenso:${d.sharp.has_consensus?'✅':'❌'}`
  if(d.sharp.activity_score>=25) b+='\n⚡ Atividade sharp detectada.'
  if(d.mis_level==='strong'||d.mis_level==='extreme') b+='\n🎯 Ineficiência de mercado detectada.'
  return b
}

async function persistDetectors(sb:any, mid:string, mkt:string, d:DetResult, mp:number|null, mkp:number) {
  try {
    await sb.from('market_analysis').upsert({match_id:mid,market:mkt||'h2h',prob_model:mp||0,prob_market:mkp,
      market_inefficiency_score:Math.round(d.mis*10000)/100,inefficiency_level:d.mis_level,
      odds_drift_index:Math.round(d.odi*10000)/100,odd_open:d.odd_open,odd_current:d.odd_current},{onConflict:'match_id,market'})
    if(d.sharp.activity_score>=10) await sb.from('sharp_money_signals').upsert({match_id:mid,market:mkt||'h2h',
      has_rlm:d.sharp.has_rlm,has_steam:d.sharp.has_steam,has_consensus:d.sharp.has_consensus,
      sharp_activity_score:d.sharp.activity_score,odd_open:d.odd_open,odd_current:d.odd_current,
      odd_movement_pct:Math.round(d.odi*10000)/100},{onConflict:'match_id,market'})
  } catch(e) { console.warn('[Detectors] Persist error:', e) }
}

// Odds extraction
function extractOdds(g:any) {
  const r:any[]=[]; for(const bk of g.bookmakers||[]) {
    const m=bk.markets?.find((m:any)=>m.key==='h2h'); if(!m?.outcomes) continue
    const h=m.outcomes.find((o:any)=>o.name===g.home_team)?.price, a=m.outcomes.find((o:any)=>o.name===g.away_team)?.price, d=m.outcomes.find((o:any)=>o.name==='Draw')?.price
    if(h&&a) r.push({bookmaker:bk.title,home_odd:h,draw_odd:d||0,away_odd:a})
  }; return r
}
function extractTotals(g:any) {
  const r:any[]=[]; for(const bk of g.bookmakers||[]) {
    const m=bk.markets?.find((m:any)=>m.key==='totals'); if(!m?.outcomes) continue
    const ov=m.outcomes.find((o:any)=>o.name==='Over'), un=m.outcomes.find((o:any)=>o.name==='Under')
    if(ov&&un&&ov.point!==undefined) r.push({bookmaker:bk.title,line:ov.point,over_odd:ov.price,under_odd:un.price})
  }; return r
}
function extractCornersOdds(g:any) {
  const r:any[]=[]; for(const bk of g.bookmakers||[]) {
    for(const m of bk.markets||[]) {
      if(!m.key?.includes('corner')) continue
      if(!m.outcomes?.length) continue
      const parsed:any = {bookmaker:bk.title||bk.key,market_key:m.key,outcomes:[]}
      for(const o of m.outcomes) {
        parsed.outcomes.push({name:o.name,price:o.price,point:o.point})
      }
      r.push(parsed)
    }
  }; return r
}
function extractCardsOdds(g:any) {
  const r:any[]=[]; for(const bk of g.bookmakers||[]) {
    for(const m of bk.markets||[]) {
      if(!m.key?.includes('card')&&!m.key?.includes('booking')) continue
      if(!m.outcomes?.length) continue
      const parsed:any = {bookmaker:bk.title||bk.key,market_key:m.key,outcomes:[]}
      for(const o of m.outcomes) {
        parsed.outcomes.push({name:o.name,price:o.price,point:o.point})
      }
      r.push(parsed)
    }
  }; return r
}
function calcProb(o:any) {
  if(!o) return 'Sem dados'
  const hp=(1/o.home_odd*100).toFixed(2),dp=o.draw_odd>0?(1/o.draw_odd*100).toFixed(2):'0',ap=(1/o.away_odd*100).toFixed(2)
  const t=parseFloat(hp)+parseFloat(dp)+parseFloat(ap)
  return `Prob H2H (${o.bookmaker}): Casa ${hp}% Emp ${dp}% Fora ${ap}% Total ${t.toFixed(1)}% Margem ${(t-100).toFixed(2)}%`
}
function calcTotalsProb(t:any) {
  if(!t) return ''
  const op=(1/t.over_odd*100).toFixed(2),up=(1/t.under_odd*100).toFixed(2)
  return `Over/Under ${t.line} (${t.bookmaker}): Over ${op}% Under ${up}%`
}

// AI call
async function callGemini(sys:string, usr:string) {
  const key = Deno.env.get('LOVABLE_API_KEY')
  if(!key) throw new Error('LOVABLE_API_KEY not configured')
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method:'POST', headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
    body: JSON.stringify({model:'google/gemini-2.5-flash',messages:[{role:'system',content:sys},{role:'user',content:usr}],temperature:0.3,max_tokens:2000})
  })
  if(!r.ok) throw new Error(`Gemini error ${r.status}: ${await r.text()}`)
  return (await r.json()).choices?.[0]?.message?.content || ''
}

// Main analysis
async function analyzeGame(game:any, prompt:string, method:string, vGuide:string, minVal:number, sb:any, apiKey:string, incCorners:boolean, incCards:boolean, oddsApiKey:string) {
  const mid = `${game.home_team}_${game.away_team}_${game.commence_time}`.replace(/\s+/g,'_')
  console.log(`[Mycroft Punter] Analisando: ${game.home_team} vs ${game.away_team} (AI: gemini, corners: ${incCorners}, cards: ${incCards})`)
  const odds=extractOdds(game), totals=extractTotals(game)
  if(!odds.length&&!totals.length) return null

  // Fetch event-specific corner/card odds from The Odds API additional markets
  let cornOdds:any[]=[], cardOdds:any[]=[]
  if((incCorners||incCards)&&game.id&&!game.simulated_odds&&oddsApiKey) {
    try {
      const addMkts:string[]=[]
      if(incCorners) addMkts.push('alternate_totals_corners')
      if(incCards) addMkts.push('alternate_spreads_cards','alternate_totals_cards')
      const evUrl=`https://api.the-odds-api.com/v4/sports/${game.sport_key}/events/${game.id}/odds?apiKey=${oddsApiKey}&regions=br,eu&markets=${addMkts.join(',')}&oddsFormat=decimal`
      const evResp=await fetch(evUrl)
      if(evResp.ok) {
        const evData=await evResp.json()
        cornOdds=incCorners?extractCornersOdds(evData):[]
        cardOdds=incCards?extractCardsOdds(evData):[]
        if(cornOdds.length) console.log(`[Mycroft Punter] 🏁 ${game.home_team} vs ${game.away_team}: ${cornOdds.length} bookmakers com odds de escanteios`)
        if(cardOdds.length) console.log(`[Mycroft Punter] 🟨 ${game.home_team} vs ${game.away_team}: ${cardOdds.length} bookmakers com odds de cartões`)
        if(!cornOdds.length&&incCorners) console.log(`[Mycroft Punter] ⚠️ ${game.home_team} vs ${game.away_team}: Nenhuma odd de escanteios disponível nesta liga/bookmaker`)
        if(!cardOdds.length&&incCards) console.log(`[Mycroft Punter] ⚠️ ${game.home_team} vs ${game.away_team}: Nenhuma odd de cartões disponível nesta liga/bookmaker`)
      } else {
        console.log(`[Mycroft Punter] ⚠️ Event odds ${evResp.status} for ${game.id} - corners/cards odds unavailable`)
      }
    } catch(e) { console.error(`[Mycroft Punter] Event odds fetch error:`, e) }
  }

  const en = await fetchEnrichedData(game.home_team,game.away_team,apiKey,game.sport_key,incCorners,incCards)
  const det=computeDetectors(odds,totals,null,null)
  console.log(`[Detectors] ${game.home_team} vs ${game.away_team}: MIS=${(det.mis*100).toFixed(1)}% (${det.mis_level}), ODI=${(det.odi*100).toFixed(1)}%, Sharp=${det.sharp.activity_score}/100 (${det.sharp.activity_level})`)

  let cornBlk='', cardBlk='', cornEst:any=null, cardEst:any=null
  if(incCorners) {
    cornBlk=`\nESCANTEIOS:\n${fmtCorner(game.home_team,en.corners?.home)}\n${fmtCorner(game.away_team,en.corners?.away)}`
    if(en.corners?.home&&en.corners?.away) {
      cornEst=estimateCorners(en.corners.home.avg_corners_for,en.corners.away.avg_corners_for)
      cornBlk+=`\nPoisson: Total ${cornEst.expected_total.toFixed(1)} P(O8.5):${(cornEst.probabilities.over_8_5*100).toFixed(1)}% P(O9.5):${(cornEst.probabilities.over_9_5*100).toFixed(1)}% P(O10.5):${(cornEst.probabilities.over_10_5*100).toFixed(1)}%`
    }
    if(cornOdds.length) {
      cornBlk+=`\nOdds Escanteios (The Odds API): ${cornOdds.map(c=>`${c.bookmaker}: ${c.outcomes.map((o:any)=>`${o.name} ${o.point??''} @${o.price}`).join(' | ')}`).join(' || ')}`
    } else if(cornEst) {
      cornBlk+=`\n⚠️ Odds de escanteios indisponíveis via bookmakers. Use as probabilidades do modelo Poisson acima para avaliar value.`
    }
  }
  if(incCards) {
    cardBlk=`\nCARTÕES:\n${fmtCard(game.home_team,en.cards?.home)}\n${fmtCard(game.away_team,en.cards?.away)}\n${fmtRef(en.referee)}`
    if(en.cards?.home&&en.cards?.away) {
      cardEst=estimateCards(en.cards.home.avg_total_cards,en.cards.away.avg_total_cards,en.referee)
      cardBlk+=`\nEstimativa: Total ${cardEst.expected_total.toFixed(1)} P(O3.5):${(cardEst.probabilities.over_3_5*100).toFixed(1)}% P(O4.5):${(cardEst.probabilities.over_4_5*100).toFixed(1)}%`
    }
    if(cardOdds.length) {
      cardBlk+=`\nOdds Cartões (The Odds API): ${cardOdds.map(c=>`${c.bookmaker}: ${c.outcomes.map((o:any)=>`${o.name} ${o.point??''} @${o.price}`).join(' | ')}`).join(' || ')}`
    } else if(cardEst) {
      cardBlk+=`\n⚠️ Odds de cartões indisponíveis via bookmakers. Use as probabilidades estimadas acima para avaliar value.`
    }
  }

  const dsl = en.model_level==='NIVEL_1'?'ALTA':en.model_level==='NIVEL_2'?'MEDIA':'BAIXA'
  const mkts=['"Casa"','"Empate"','"Fora"','"Over 1.5"','"Under 1.5"','"Over 2.5"','"Under 2.5"','"Over 3.5"','"Under 3.5"']
  if(incCorners) mkts.push('"Over 8.5 Escanteios"','"Under 8.5 Escanteios"','"Over 9.5 Escanteios"','"Under 9.5 Escanteios"','"Over 10.5 Escanteios"','"Under 10.5 Escanteios"')
  if(incCards) mkts.push('"Over 3.5 Cartões"','"Under 3.5 Cartões"','"Over 4.5 Cartões"','"Under 4.5 Cartões"','"Over 5.5 Cartões"','"Under 5.5 Cartões"')

  const sysPr=`${prompt}\nREGRA: Retorne APENAS JSON válido. Sem texto livre.\nREGRA ANTI-CONFLITO: Recomende NO MÁXIMO 1 mercado por jogo. Escolha o mercado com MAIOR EDGE positivo. NUNCA aprove Casa e Fora no mesmo jogo. NUNCA aprove Over e Under na mesma linha.\n${incCorners?'Analise escanteios com Poisson.\n':''}${incCards?'Analise cartões com perfil do árbitro.\n':''}Escolha o mercado com MAIOR edge.`

  const usrPr=`JOGO: ${game.home_team} vs ${game.away_team} | Liga: ${game.sport_title||'?'} | ${new Date(game.commence_time).toLocaleString('pt-BR')} | Dados: ${dsl} | Modelo: ${en.model_level}
${fmtTeam(game.home_team,en.home)}
${fmtTeam(game.away_team,en.away)}
${fmtH2H(en.h2h)}
${fmtInj(game.home_team,en.injuries?.home||[])} ${fmtInj(game.away_team,en.injuries?.away||[])}
${fmtStand(en.standings||[],game.home_team,game.away_team)}
${fmtPred(en.predictions)}
${en.predictions?'Validação cruzada: Concordam→+5% Divergem→-5%':''}
${fmtDetectors(det)}
${cornBlk}${cardBlk}
${game.simulated_odds?'⚠️ ODDS SIMULADAS (Modelo Poisson)':''}
ODDS H2H: ${odds.map((o:any)=>`${o.bookmaker}: ${game.home_team} ${o.home_odd} Emp ${o.draw_odd} ${game.away_team} ${o.away_odd}`).join(' | ')}
${totals.length?`TOTALS: ${totals.map((t:any)=>`${t.bookmaker}: O${t.line} ${t.over_odd} U${t.line} ${t.under_odd}`).join(' | ')}`:''}
${calcProb(odds[0])} ${totals.length?calcTotalsProb(totals[0]):''}
${method?`KB: ${method.substring(0,500)}`:''}${vGuide?`\nGuia: ${vGuide.substring(0,500)}`:''}

Retorne JSON: {"verdict":"APROVADO"|"VETADO","tier":1|2|3|null,"model_level":"${en.model_level}","market":${mkts.join('|')}|null,"bookmaker":"...","odd":0,"fair_odd":0,"implied_probability":0,"estimated_probability":0,"expected_value":0,"value_percentage":0,"confidence":0,"data_strength":"${dsl}","stake_percentage":0,"thesis":"...","analysis":"...","risk_factors":"...","api_predictions_agree":null${incCorners?',"corner_prediction":{"line":0,"expected_total":0,"prob_over":0,"value":""}':''}${incCards?',"card_prediction":{"market":"","expected_total":0,"prob_over":0,"value":""},"referee_impact":""':''}}
Edge≥2% + Confiança≥58% = APROVAR. META: 50-70%. MAIOR EDGE = mercado recomendado.`

  for (let att=0;att<3;att++) {
    try {
      const txt = await callGemini(sysPr, usrPr)
      if(!txt) throw new Error('Empty response')
      const clean=txt.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
      const jm=clean.match(/\{[\s\S]*\}/)
      if(!jm) { console.error(`[Mycroft Punter] No JSON (attempt ${att+1})`); if(att<2) continue; throw new Error('No JSON') }
      const a=JSON.parse(jm[0])
      if(a.verdict?.startsWith('APROVADO')) a.verdict='APROVADO'
      if(a.value_percentage==null) a.value_percentage=a.edge_percentage||a.ev_percentage||a.edge||a.value||null
      if(a.value_percentage==null&&a.estimated_probability&&a.odd) a.value_percentage=Math.round((a.estimated_probability-(1/a.odd)*100)*10)/10
      if(a.value_percentage==null) a.value_percentage=0

      console.log(`[Mycroft Punter] ${game.home_team} vs ${game.away_team}: ${a.verdict} | Market: ${a.market} | Model: ${a.model_level} | Value: ${a.value_percentage}% | EV: ${a.expected_value} | AI: gemini`)
      if(a.corner_prediction) console.log(`[Mycroft Punter] 🏁 Corner prediction: Line ${a.corner_prediction.line}, Expected ${a.corner_prediction.expected_total}, Value ${a.corner_prediction.value}`)
      if(a.card_prediction) console.log(`[Mycroft Punter] 🟨 Card prediction: ${a.card_prediction.market}, Expected ${a.card_prediction.expected_total}, Value ${a.card_prediction.value}`)

      const {data:row} = await sb.from('punter_analyses').insert({
        match_id:mid,home_team:game.home_team,away_team:game.away_team,league:game.sport_title||'Unknown',
        commence_time:game.commence_time,market:a.market||'N/A',bookmaker:a.bookmaker||'N/A',odd:a.odd||0,
        fair_odd:a.fair_odd,implied_probability:a.implied_probability,estimated_probability:a.estimated_probability,
        value_percentage:a.value_percentage,verdict:a.verdict,confidence:a.confidence,stake_percentage:a.stake_percentage,
        thesis:a.thesis,analysis:a.analysis,risk_factors:a.risk_factors,analyzed_by:'gemini'
      }).select().maybeSingle()

      if(a.verdict==='APROVADO'&&row) {
        await sb.from('punter_signals').insert({analysis_id:row.id,match_id:mid,market:a.market,bookmaker:a.bookmaker,odd:a.odd,value_percentage:a.value_percentage,stake_percentage:a.stake_percentage,status:'pending'})
        console.log('[Mycroft Punter] ✅ Sinal aprovado registrado')
      }
      const mp=a.estimated_probability||null, mkp=a.implied_probability||(a.odd?(1/a.odd)*100:0)
      await persistDetectors(sb,mid,a.market||'h2h',computeDetectors(odds,totals,mp,a.market),mp,mkp)
      return a
    } catch(e:any) {
      if(att<2) { const rl=e?.message?.includes('429'); await new Promise(r=>setTimeout(r,rl?(att+1)*5000:1000)); continue }
      throw e
    }
  }
  return null
}

// Main handler
serve(async (req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try {
    const sb=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',{auth:{persistSession:false}})
    const body=await req.json()
    const {sports=['soccer_brazil_campeonato','soccer_brazil_serie_b','soccer_brazil_campeonato_paulista','soccer_brazil_campeonato_carioca','soccer_brazil_campeonato_mineiro','soccer_brazil_campeonato_gaucho','soccer_brazil_campeonato_baiano','soccer_brazil_campeonato_paranaense','soccer_brazil_campeonato_catarinense','soccer_brazil_campeonato_pernambucano','soccer_conmebol_copa_libertadores','soccer_conmebol_copa_sudamericana','soccer_uefa_champs_league','soccer_uefa_europa_league','soccer_epl','soccer_spain_la_liga','soccer_italy_serie_a','soccer_germany_bundesliga','soccer_france_ligue_one','soccer_argentina_primera_division'],
      sport=null as string|null, hours_ahead=48, bookmakers=['bet365','pinnacle','betfair'], min_value=3, include_corners=true, include_cards=true} = body

    const leagues:string[] = sport?[sport]:sports
    console.log(`[Mycroft Punter] Leagues: ${leagues.length}, Hours: ${hours_ahead}h, Corners: ${include_corners}, Cards: ${include_cards}`)
    const oddsKey=Deno.env.get('THE_ODDS_API_KEY'); if(!oddsKey) throw new Error('THE_ODDS_API_KEY not configured')
    const apiKey=Deno.env.get('API_FOOTBALL_KEY')||''
    const now=new Date(), maxT=new Date(now.getTime()+hours_ahead*36e5)
    const games:any[]=[], noOdds:string[]=[]

    for(const lg of leagues) {
      try {
        const r=await fetch(`https://api.the-odds-api.com/v4/sports/${lg}/odds?apiKey=${oddsKey}&regions=br,eu&markets=h2h,spreads,totals&bookmakers=${bookmakers.join(',')}&oddsFormat=decimal`)
        if(!r.ok) { if(estaduaisMap[lg]) noOdds.push(lg); continue }
        const gm=await r.json()
        const lw=new Date(now.getTime()-3*36e5)
        const up=gm.filter((g:any)=>{const ct=new Date(g.commence_time);return ct>=lw&&ct<=maxT})
        if(up.length) { console.log(`[Mycroft Punter] ${lg}: ${up.length} jogos`); games.push(...up) }
        else if(estaduaisMap[lg]) noOdds.push(lg)
      } catch { if(estaduaisMap[lg]) noOdds.push(lg) }
    }

    // Fallback estaduais
    if(noOdds.length&&apiKey) {
      for(const lk of noOdds) {
        const li=estaduaisMap[lk]; if(!li) continue
        try {
          const t=now.toISOString().split('T')[0], mx=maxT.toISOString().split('T')[0]
          const d=await apiFetch(`${API_FB}/fixtures?league=${li.id}&season=${yr()}&from=${t}&to=${mx}&status=NS`,apiKey)
          for(const fix of d?.response||[]) {
            games.push({id:`sim_${fix.fixture?.id}`,sport_key:lk,sport_title:li.name,commence_time:fix.fixture?.date||now.toISOString(),
              home_team:fix.teams?.home?.name||'Home',away_team:fix.teams?.away?.name||'Away',simulated_odds:true,
              bookmakers:[{key:'poisson_model',title:'Modelo Poisson (Simulado)',markets:[
                {key:'h2h',outcomes:[{name:fix.teams?.home?.name||'Home',price:2.20},{name:'Draw',price:3.30},{name:fix.teams?.away?.name||'Away',price:3.10}]},
                {key:'totals',outcomes:[{name:'Over',point:2.5,price:1.90},{name:'Under',point:2.5,price:1.95}]}
              ]}]})
          }
          if((d?.response||[]).length) console.log(`[Mycroft Punter] ${li.name}: ${d.response.length} jogos (SIMULADAS)`)
        } catch {}
      }
    }

    console.log(`[Mycroft Punter] Total: ${games.length} jogos`)
    if(!games.length) return new Response(JSON.stringify({success:true,signals:[],total_analyzed:0,total_approved:0,leagues_scanned:leagues.length,message:`Nenhum jogo nas próximas ${hours_ahead}h`}),{headers:{...corsHeaders,'Content-Type':'application/json'}})

    // KB
    let meth='',vg='',cp=''
    try{const{data:d}=await sb.storage.from('sports-knowledge-base').download('punter-methodology.md');if(d)meth=await d.text()}catch{}
    try{const{data:d}=await sb.storage.from('sports-knowledge-base').download('value-betting-guide.md');if(d)vg=await d.text()}catch{}
    try{const{data:d}=await sb.storage.from('sports-knowledge-base').download('prompt_mycroft_punter.txt');if(d)cp=await d.text()}catch{}
    if(!cp) cp='Você é Mycroft Arena Quant Adaptive, analista probabilístico da Arena Punter. Missão: identificar apostas com value positivo. FOCO: ROI positivo consistente.'

    const approved:any[]=[]
    let total=0
    const toAnalyze=games.slice(0,MAX_GAMES)
    for(let i=0;i<toAnalyze.length;i+=BATCH) {
      const batch=toAnalyze.slice(i,i+BATCH)
      const results=await Promise.allSettled(batch.map(g=>analyzeGame(g,cp,meth,vg,min_value,sb,apiKey,include_corners,include_cards,oddsKey)))
      for(let j=0;j<results.length;j++) {
        total++
        const r=results[j], g=batch[j]
        if(r.status==='fulfilled'&&r.value?.verdict?.startsWith('APROVADO')) {
          const rec=r.value; if(g.simulated_odds) rec.simulated_odds=true
          approved.push({match:{home_team:g.home_team,away_team:g.away_team,commence_time:g.commence_time,league:g.sport_title||'Unknown'},recommendation:rec})
        } else if(r.status==='rejected') console.error(`[Mycroft Punter] Erro: ${g.home_team} vs ${g.away_team}:`,r.reason)
      }
      if(i+BATCH<toAnalyze.length) await new Promise(r=>setTimeout(r,300))
    }

    // DEDUPLICATION: Keep only the highest-edge entry per match
    const matchBestMap = new Map<string, number>()
    for(let i=0;i<approved.length;i++) {
      const m=approved[i].match, key=`${m.home_team}__${m.away_team}`
      const edge=approved[i].recommendation.value_percentage||0
      if(!matchBestMap.has(key)||edge>(approved[matchBestMap.get(key)!].recommendation.value_percentage||0)) matchBestMap.set(key,i)
    }
    const dedupApproved = [...matchBestMap.values()].map(i=>approved[i])
    if(dedupApproved.length<approved.length) {
      const removed=approved.length-dedupApproved.length
      console.log(`[Mycroft Punter] 🔄 Dedup: removidos ${removed} sinais conflitantes (1 mercado por jogo)`)
      // Remove duplicates from DB too
      for(let i=0;i<approved.length;i++) {
        if(!matchBestMap.has(`${approved[i].match.home_team}__${approved[i].match.away_team}`)||matchBestMap.get(`${approved[i].match.home_team}__${approved[i].match.away_team}`)!==i) {
          const mid=`${approved[i].match.home_team}_${approved[i].match.away_team}_${approved[i].match.commence_time}`.replace(/\s+/g,'_')
          const mkt=approved[i].recommendation.market
          await sb.from('punter_signals').delete().eq('match_id',mid).eq('market',mkt)
          await sb.from('punter_analyses').delete().eq('match_id',mid).eq('market',mkt)
          console.log(`[Mycroft Punter] 🗑️ Removido sinal conflitante: ${approved[i].match.home_team} vs ${approved[i].match.away_team} (${mkt})`)
        }
      }
    }

    console.log(`[Mycroft Punter] Análise completa: ${dedupApproved.length}/${total} aprovados (${approved.length-dedupApproved.length} conflitos removidos)`)
    return new Response(JSON.stringify({success:true,signals:dedupApproved,total_analyzed:total,total_approved:dedupApproved.length,conflicts_removed:approved.length-dedupApproved.length,leagues_scanned:leagues.length,ai_provider:'gemini',timestamp:new Date().toISOString()}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
  } catch(e:any) {
    console.error('[Mycroft Punter] ERRO:',e)
    return new Response(JSON.stringify({success:false,error:e.message}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}})
  }
})
