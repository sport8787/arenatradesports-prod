import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { calcularPoisson, calcularEdges, formatarBlocoPoisson, type PoissonResult, type EdgeResult } from '../_shared/poisson.ts'
import { probeSportmonksPrediction, logShadowPrediction } from '../_shared/sportmonksPredictions.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}
const MAX_GAMES = 15, BATCH = 3, BATCH_COOLDOWN_MS = 12_000, API_FB = '' // API-Football removida em Fase 2 (18/05/2026)
const MAX_EXEC_MS = 110_000 // 110s guard — must return BEFORE gateway kills the connection (~120s)
let execStart = 0
let geminiRateLimitUntil = 0
const isTimedOut = () => Date.now() - execStart > MAX_EXEC_MS
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const teamCache = new Map<string, number>()
const hdr = (k: string) => ({ 'x-apisports-key': k })
const yr = () => { const d = new Date(); return (d.getMonth()+1) < 8 ? d.getFullYear()-1 : d.getFullYear() }

async function respectGeminiRateLimitWindow() {
  while (Date.now() < geminiRateLimitUntil && !isTimedOut()) {
    const remaining = geminiRateLimitUntil - Date.now()
    console.warn(`[Mycroft Punter] ⏳ Aguardando janela do Gemini liberar (${Math.ceil(remaining / 1000)}s)`) 
    await wait(Math.min(remaining, 5_000))
  }
}

// ═══ PROMPT ÚNICO — fonte única de verdade ═══
const MYCROFT_PUNTER_PROMPT = `Você é Mycroft Arena Punter, analista probabilístico de elite especializado em value betting.

REGRA ABSOLUTA DE IDIOMA: Você DEVE escrever TODOS os campos (thesis, analysis, risk_factors, market e qualquer outro texto) EXCLUSIVAMENTE em PORTUGUÊS BRASILEIRO. Qualquer resposta em inglês será AUTOMATICAMENTE REJEITADA.

Sua missão: Maximizar ROI através de QUALIDADE e SELETIVIDADE. Poucas apostas, alto edge, win rate sustentável.

FILOSOFIA CENTRAL
"Edge sem probabilidade real é ilusão matemática."
A maioria dos jogos NÃO tem edge real. Priorize probabilidade real alta com edge moderado em vez de probabilidade baixa com edge alto.

META PRINCIPAL: Aprovar apenas 15-25% dos jogos analisados.
WIN RATE ALVO: ≥ 60%
EDGE MÍNIMO: 4% (flexível conforme tier)
PROBABILIDADE MÍNIMA: variável por mercado (ver abaixo)
ODD MÁXIMA: 3.50 (com exceções para underdog com fundamentos)
ROI ESPERADO: 15-20% ao mês

═══════════════════════════════════════════════
HIERARQUIA DE APROVAÇÃO
═══════════════════════════════════════════════

FILTRO 0 — DADOS VÁLIDOS (pré-eliminatório)
VETAR IMEDIATAMENTE se qualquer condição for verdadeira:
• Odds foram simuladas ou estimadas artificialmente (sem fonte real de mercado)
• Jogo com menos de 2 casas de apostas reais fornecendo odds (softs são aceitas)
• Dados históricos do time ausentes (sem fixtures, sem season stats)
• Jogo já iniciado (status diferente de NS — Not Started)

FILTRO 1 — PROBABILIDADE REAL (variável por mercado)
Mercados comuns e suas probabilidades mínimas:
• 1X2 (Casa/Fora/Empate): mínimo 42% (empates 38%)
• Over 2.5: mínimo 45%
• Under 2.5: mínimo 48% (exige defesas sólidas)
• BTTS Sim: mínimo 48%
• Over/Under 0.5 HT: mínimo 35%
• Over/Under 1.5: mínimo 40%
• Escanteios (Over/Under 9.5): mínimo 50%
Se a probabilidade real estiver abaixo do mínimo do mercado → VETAR

FILTRO 2 — ODD MÁXIMA (por mercado)
• 1X2 Casa/Fora/Over 2.5/BTTS: odd ≤ 3.20
• Underdog (odds 3.21 - 3.50): permitido APENAS se probabilidade real ≥ 40% e edge ≥ 8%
• Under 2.5: odd ≤ 2.80
• Over/Under 0.5 HT: odd ≤ 4.00 (desde que prob ≥ 38%)
• Escanteios: odd ≤ 2.20
Acima desses limites → VETAR

FILTRO 3 — EDGE MÍNIMO
• Tier 1 (forte): edge ≥ 7%
• Tier 2 (bom): edge ≥ 5%
• Tier 3 (moderado): edge ≥ 4%
Abaixo do respectivo mínimo → VETAR

FILTRO 4 — CONFIANÇA MÍNIMA
• Tier 1: confiança ≥ 78%
• Tier 2: confiança ≥ 70%
• Tier 3: confiança ≥ 65%
Abaixo → VETAR

FILTRO 5 — CONSISTÊNCIA ENTRE ESTIMATIVAS
• Se estimativa própria contradiz edge (ex: probabilidade baixa mas edge alto) → VETAR ou downgrade
• Se confirma → +5pp na confiança

FILTRO 6 — RESTRIÇÕES POR MERCADO

UNDER 2.5:
• Média combinada de gols dos dois times deve ser < 2.4 por jogo
• Se qualquer time tem média ofensiva > 1.8 gols/jogo: VETAR
• Se H2H dos últimos 5 tem média > 2.8 gols: VETAR

OVER 2.5:
• Média combinada de gols > 2.5 (ou times com defesa fraca)
• Se ambos têm defesa sólida (<0.9 gols sofridos) → CUIDADO, não vetar automaticamente

BTTS:
• Ambos os times devem ter marcado em ≥ 50% dos últimos jogos (flexível)
• Se um time tem média < 0.8 gols marcados: VETAR

1X2 — CASA/FORA:
• Empate: prob mínima 35% (e edge ≥ 6%)
• Fora: se odd > 2.80, exige prob mínima 42% e edge ≥ 7%
• Proibido aprovar Casa e Fora do mesmo jogo

FILTRO 7 — BASELINE SHARP (adaptado)
• Priorize Pinnacle, Betfair Exchange ou Soft com devigging (remover 3% juice)
• Se não houver sharp disponível, use a média das 3 maiores softs (Bet365, Sportingbet, etc.) aplicando devigging conservador
• Apenas vetar se houver apenas 1 casa de aposta disponível

═══════════════════════════════════════════════
SISTEMA DE TIERS (uso interno — não mencionar tier na thesis)
═══════════════════════════════════════════════

TIER 1 — FORTE (⚡):
- Probabilidade ≥ 55%, Edge ≥ 7%, Confiança ≥ 78%
- Odds 1.45 - 2.80
- Stake: 4-5% da banca
- Thesis: "alta convicção, vantagem significativa"

TIER 2 — BOM (✅):
- Probabilidade ≥ 48%, Edge ≥ 5%, Confiança ≥ 70%
- Odds 1.40 - 3.20
- Stake: 3% da banca
- Thesis: "boa vantagem identificada"

TIER 3 — MODERADO (🎯):
- Probabilidade ≥ 42%, Edge ≥ 4%, Confiança ≥ 65%
- Odds 1.35 - 3.50 (underdog excepcional)
- Stake: 2% da banca
- Thesis: "vantagem positiva, porém margem menor — stake reduzido"

═══════════════════════════════════════════════
CÁLCULO DE PROBABILIDADE REAL
═══════════════════════════════════════════════
Use Poisson bivariada se xG disponível. Sem xG, use médias históricas (últimos 8 jogos). Como último recurso, use probabilidade implícita Pinnacle com devigging.

CAMPO estimated_probability: OBRIGATÓRIO. Em percentual (ex: 61.21). NUNCA 0 ou null.
fair_odd = 1 / (estimated_probability / 100)

═══════════════════════════════════════════════
CÁLCULO DE CONFIANÇA
═══════════════════════════════════════════════
Base: xG disponível → 70% | apenas stats básicas → 62% | só odds → 55%
Bônus: prob ≥55% (+5) | prob ≥60% (+8) | edge ≥8% (+5) | edge ≥10% (+8) | sharp disponível (+5) | consistência (+5)
Penalidades: prob 42-45% (-5) | liga menor (-3) | dados parciais (-8) | 1 casa sharp (-5)
Confiança máxima: 92% | mínima para aprovação: 65%

═══════════════════════════════════════════════
MERCADOS VÁLIDOS
═══════════════════════════════════════════════
1X2, Over/Under (0.5 HT, 1.5, 2.5, 3.5), BTTS, Escanteios (Over/Under), Cartões Amarelos

═══════════════════════════════════════════════
VETO OBRIGATÓRIO CONSOLIDADO
═══════════════════════════════════════════════
- Odds simuladas ou fabricadas
- Menos de 2 casas reais
- Probabilidade abaixo do mínimo do mercado
- Odd acima do limite do mercado + exceções
- Edge < 4% para qualquer mercado
- Confiança < 65%
- EV negativo
- Dados históricos insuficientes (menos de 4 jogos recentes)
- Jogo já iniciado
- Mercado oposto já aprovado neste jogo
- Under 2.5 com média combinada ≥ 2.4 OU time ofensivo (>1.8 gols/jogo)

═══════════════════════════════════════════════
ADDON — ESCANTEIOS (mantido da v2)
═══════════════════════════════════════════════
(mesmos 5 métodos, mas com limites relaxados:
media_casa ≥ 4.5 para ativar, total_estimado entre 9.0 e 10.5 não é veto automático, analisar com cuidado)`

// ═══ VALIDADOR PÓS-GEMINI ═══
interface ValidationResult { valid: boolean; reason: string | null }
function inferTier(a: any): number {
  // Auto-infer tier when AI omits or sends invalid
  const edge = a.edge_percentage ?? 0
  const conf = a.confidence ?? 0
  const prob = a.estimated_probability ?? 0
  if (edge >= 7 && conf >= 77 && prob >= 50) return 1
  if (edge >= 5 && conf >= 70 && prob >= 40) return 2
  return 3
}

// Configuração calibrável (carregada da tabela punter_calibration)
let CALIB = {
  min_probability: 30, min_edge: 4, min_confidence: 65,
  odd_min: 1.35, odd_max: 4.50, tolerance_pp: 2,
  tier1: { minEdge: 7, minConf: 78, maxStake: 5, minProb: 50 },
  tier2: { minEdge: 5, minConf: 70, maxStake: 3.5, minProb: 40 },
  tier3: { minEdge: 4, minConf: 65, maxStake: 2.5, minProb: 32 },
}

async function loadCalibration(supabase: any) {
  try {
    const { data } = await supabase.from('punter_calibration')
      .select('*').eq('is_active', true).maybeSingle()
    if (data) {
      CALIB = {
        min_probability: Number(data.min_probability),
        min_edge: Number(data.min_edge),
        min_confidence: Number(data.min_confidence),
        odd_min: Number(data.odd_min),
        odd_max: Number(data.odd_max),
        tolerance_pp: Number(data.tolerance_pp),
        tier1: { minEdge: +data.tier1_min_edge, minConf: +data.tier1_min_conf, maxStake: +data.tier1_max_stake, minProb: +data.tier1_min_prob },
        tier2: { minEdge: +data.tier2_min_edge, minConf: +data.tier2_min_conf, maxStake: +data.tier2_max_stake, minProb: +data.tier2_min_prob },
        tier3: { minEdge: +data.tier3_min_edge, minConf: +data.tier3_min_conf, maxStake: +data.tier3_max_stake, minProb: +data.tier3_min_prob },
      }
      console.log('[Mycroft Punter] ✅ Calibração carregada:', CALIB)
    }
  } catch (e) { console.warn('[Mycroft Punter] Falha ao carregar calibração, usando defaults', e) }
}

function validateAnalysis(a: any): ValidationResult {
  if (a.verdict === 'VETADO') return { valid: false, reason: a.veto_reason || 'Vetado pelo modelo' }
  if (!a.estimated_probability || a.estimated_probability < CALIB.min_probability) {
    return { valid: false, reason: `Probabilidade insuficiente: ${a.estimated_probability ?? 0}% (mínimo ${CALIB.min_probability}%)` }
  }
  if (!a.edge_percentage || a.edge_percentage < CALIB.min_edge) return { valid: false, reason: `Edge insuficiente: ${a.edge_percentage}%` }
  if (!a.confidence || a.confidence < CALIB.min_confidence) return { valid: false, reason: `Confiança insuficiente: ${a.confidence}%` }
  if (!a.odd || a.odd < CALIB.odd_min || a.odd > CALIB.odd_max) return { valid: false, reason: `Odd fora do range: ${a.odd}` }

  if (!a.tier || ![1, 2, 3].includes(a.tier)) {
    a.tier = inferTier(a)
    a._tier_inferred = true
  }

  const rules: Record<number, { minEdge: number; minConf: number; maxStake: number; minProb: number }> = {
    1: CALIB.tier1, 2: CALIB.tier2, 3: CALIB.tier3,
  }

  const TOL = CALIB.tolerance_pp
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = rules[a.tier]
    const probOk = a.estimated_probability >= r.minProb - TOL
    const edgeOk = a.edge_percentage >= r.minEdge - TOL
    const confOk = a.confidence >= r.minConf - TOL
    if (probOk && edgeOk && confOk) {
      // Cap stake ao máximo do tier (não veta — apenas limita)
      if (a.stake_percentage > r.maxStake) a.stake_percentage = r.maxStake
      return { valid: true, reason: null }
    }
    // Tenta downgrade
    if (a.tier < 3) {
      a.tier += 1
      a._tier_downgraded = true
    } else {
      // Tier 3 não passa nem com tolerância — vetar com motivo claro
      const r3 = rules[3]
      if (a.estimated_probability < r3.minProb - TOL) return { valid: false, reason: `Prob ${a.estimated_probability}% < ${r3.minProb - TOL}% (Tier 3 + tol)` }
      if (a.edge_percentage < r3.minEdge - TOL) return { valid: false, reason: `Edge ${a.edge_percentage}% < ${r3.minEdge - TOL}% (Tier 3 + tol)` }
      if (a.confidence < r3.minConf - TOL) return { valid: false, reason: `Conf ${a.confidence}% < ${r3.minConf - TOL}% (Tier 3 + tol)` }
      return { valid: false, reason: 'Não atinge Tier 3 mesmo com tolerância' }
    }
  }
  return { valid: false, reason: 'Falha de validação após downgrades' }
}

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
  'soccer_brazil_copa_nordeste':76,'soccer_brazil_copa_do_brasil':75,
  'soccer_brazil_serie_c':73,'soccer_brazil_copa_verde':530,
  'soccer_international_friendlies':10,
  'soccer_fifa_world_cup_qualifier_europe':32,
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
  'soccer_brazil_copa_nordeste':{id:76,name:'Copa do Nordeste'},
  'soccer_brazil_copa_do_brasil':{id:75,name:'Copa do Brasil'},
  'soccer_brazil_serie_c':{id:73,name:'Brasileirão Série C'},
  'soccer_brazil_copa_verde':{id:530,name:'Copa Verde'},
  'soccer_international_friendlies':{id:10,name:'Amistosos Internacionais'},
  'soccer_fifa_world_cup_qualifier_europe':{id:32,name:'Eliminatórias Copa do Mundo - Europa'},
  'soccer_usa_nwsl':{id:764,name:'NWSL (EUA Feminino)'},
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
  // Clean common prefixes/suffixes that break API search
  const clean = name.replace(/^(1\.\s*)?FC\s+/i, '').replace(/\s+(FC|SC|CF|BA|AC|AS|SV|SK|FK|BV)$/i, '').replace(/^(TSG|VfB|VfL|FSV|RB|SV|SC|FC|1\.)\s+/i, '').trim()
  const candidates = [name]
  if (clean !== name && clean.length > 2) candidates.push(clean)
  // Also try last word (e.g., "Köln" from "1. FC Köln")
  const lastWord = name.split(' ').pop() || ''
  if (lastWord.length > 2 && lastWord !== clean && lastWord !== name) candidates.push(lastWord)
  
  let id: number | null = null
  for (const attempt of candidates) {
    const d = await apiFetch(`${API_FB}/teams?search=${encodeURIComponent(attempt)}`, key)
    id = d?.response?.[0]?.team?.id || null
    if (id) {
      console.log(`[API-Football] ✅ Team "${name}" -> ID: ${id} (via "${attempt}")`)
      teamCache.set(ck, id)
      return id
    }
    if (attempt !== candidates[candidates.length - 1]) console.log(`[API-Football] Team "${name}" not found via "${attempt}", trying next...`)
  }
  console.warn(`[API-Football] ⚠️ Team "${name}" not found (tried: ${candidates.join(', ')})`)
  return null
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

// ─── Sportradar Form Enrichment (pré-jogo, xG real) ───
async function fetchSofaForm(home: string, away: string): Promise<any | null> {
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sportradar-team-form`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ home, away }),
    });
    if (!res.ok) {
      console.warn(`[Sportradar] HTTP ${res.status} for ${home} vs ${away}`);
      return null;
    }
    const data = await res.json();
    if (!data?.found) return null;
    console.log(`[Sportradar] ${data.cached ? '🎯 CACHE' : '✅ FRESH'} ${home}: xG ${data.home?.avg_xg ?? '?'} | ${away}: xG ${data.away?.avg_xg ?? '?'}`);
    return data;
  } catch (e) {
    console.warn('[Sportradar] fetch error:', e);
    return null;
  }
}

function fmtSofaForm(sofa: any | null): string {
  if (!sofa || (!sofa.home && !sofa.away)) return '';
  const lines: string[] = ['', '🔴 SPORTRADAR — FORMA RECENTE (últimos 5 jogos, dados oficiais):'];
  for (const side of ['home', 'away'] as const) {
    const f = sofa[side];
    if (!f) continue;
    const r = f.record;
    lines.push(`• ${f.team} (${r.wins}V-${r.draws}E-${r.losses}D, n=${f.sample_size}): GM=${f.avg_goals_for} GS=${f.avg_goals_against} | xG=${f.avg_xg ?? '?'} | Posse=${f.avg_possession ?? '?'}% | Chutes=${f.avg_shots ?? '?'} (${f.avg_shots_on_target ?? '?'} no alvo) | Escanteios=${f.avg_corners ?? '?'}`);
  }
  lines.push('⚠️ xG do Sportradar é dado oficial usado por casas de aposta. Use como reforço/contraste do Poisson.');
  return lines.join('\n');
}

// ─── SofaScore/FBref Form Enrichment (xG histórico independente, fonte cruzada) ───
async function fetchFBrefForm(home: string, away: string): Promise<any | null> {
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sofascore-team-form`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ home, away }),
    });
    if (!res.ok) {
      console.warn(`[SofaScore/FBref] HTTP ${res.status} for ${home} vs ${away}`);
      return null;
    }
    const data = await res.json();
    if (!data?.found) return null;
    console.log(`[SofaScore/FBref] ${data.cached ? '🎯 CACHE' : '✅ FRESH'} ${home}: xG ${data.home?.avg_xg ?? '?'} | ${away}: xG ${data.away?.avg_xg ?? '?'}`);
    return data;
  } catch (e) {
    console.warn('[SofaScore/FBref] fetch error:', e);
    return null;
  }
}

function fmtFBrefForm(fb: any | null): string {
  if (!fb || (!fb.home && !fb.away)) return '';
  const lines: string[] = ['', '🟢 SOFASCORE/FBREF — FORMA RECENTE (últimos 5 jogos, fonte independente):'];
  for (const side of ['home', 'away'] as const) {
    const f = fb[side];
    if (!f) continue;
    const r = f.record;
    lines.push(`• ${f.team} (${r.wins}V-${r.draws}E-${r.losses}D, n=${f.sample_size}): GM=${f.avg_goals_for} GS=${f.avg_goals_against} | xG=${f.avg_xg ?? '?'} | npxG=${f.avg_npxg ?? '?'} | Posse=${f.avg_possession ?? '?'}% | Chutes=${f.avg_shots ?? '?'} (${f.avg_shots_on_target ?? '?'} no alvo)`);
  }
  lines.push('⚠️ Use para CRUZAR com Sportradar: se ambas as fontes concordarem em xG → +confiança. Se divergirem >0.4 → reduzir confiança.');
  return lines.join('\n');
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
function recoverPartialAnalysis(raw: string) {
  const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const getString = (key: string) => {
    const match = raw.match(new RegExp(`"${esc(key)}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`))
    return match?.[1]?.replace(/\\"/g, '"').trim() ?? null
  }
  const getNumber = (key: string) => {
    const match = raw.match(new RegExp(`"${esc(key)}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`))
    return match ? Number(match[1]) : null
  }

  const verdictRaw = getString('verdict')
  const market = getString('market')
  const odd = getNumber('odd')

  if (!verdictRaw && !market && odd == null) return null

  return {
    verdict: verdictRaw?.toUpperCase().includes('APROVADO') ? 'APROVADO' : 'VETADO',
    tier: getNumber('tier'),
    model_level: getString('model_level') ?? 'NIVEL_3',
    market: market,
    bookmaker: getString('bookmaker') ?? 'N/A',
    odd: odd ?? 0,
    fair_odd: getNumber('fair_odd'),
    implied_probability: getNumber('implied_probability'),
    estimated_probability: getNumber('estimated_probability'),
    expected_value: getNumber('expected_value') ?? 0,
    value_percentage: getNumber('value_percentage') ?? getNumber('edge_percentage') ?? getNumber('ev_percentage') ?? getNumber('edge') ?? 0,
    confidence: getNumber('confidence') ?? 0,
    data_strength: getString('data_strength'),
    stake_percentage: getNumber('stake_percentage') ?? 0,
    thesis: getString('thesis') ?? 'Resposta parcial recuperada da IA.',
    analysis: getString('analysis') ?? 'Saída truncada da IA; recomendação registrada com fallback conservador.',
    risk_factors: getString('risk_factors') ?? 'Dados incompletos na resposta da IA.',
    api_predictions_agree: null,
  }
}

function parseStructuredJson(raw: string) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  if (!cleaned) throw new Error('Empty response')

  const tryParse = (text: string) => {
    try { return JSON.parse(text) } catch { return null }
  }

  const direct = tryParse(cleaned)
  if (direct) return direct

  const start = cleaned.indexOf('{')
  if (start === -1) throw new Error('No JSON')

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') depth--

    if (depth === 0) {
      const candidate = cleaned.slice(start, i + 1)
      const parsed = tryParse(candidate)
      if (parsed) return parsed
    }
  }

  const tail = cleaned.slice(start)
  const openCount = (tail.match(/\{/g) || []).length
  const closeCount = (tail.match(/\}/g) || []).length

  if (openCount > closeCount) {
    const repaired = `${tail}${'}'.repeat(openCount - closeCount)}`
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')

    const parsed = tryParse(repaired)
    if (parsed) {
      console.warn(`[Mycroft Punter] JSON reparado automaticamente (faltavam ${openCount - closeCount} chaves)`)
      return parsed
    }
  }

  const recovered = recoverPartialAnalysis(cleaned)
  if (recovered) {
    console.warn('[Mycroft Punter] JSON parcial recuperado via fallback heurístico')
    return recovered
  }

  throw new Error('No JSON')
}

function buildGeminiFallbackVeto(reason: string, incCorners:boolean=false, incCards:boolean=false) {
  const fallback: any = {
    verdict: 'VETADO',
    tier: null,
    veto_reason: reason,
    model_level: 'NIVEL_3',
    market: null,
    bookmaker: 'N/A',
    odd: 0,
    baseline_sharp_odd: null,
    implied_probability_sharp: null,
    estimated_probability: null,
    edge_percentage: 0,
    expected_value: 0,
    confidence: 0,
    data_strength: 'BAIXA',
    stake_percentage: 0,
    filters_passed: ['fallback_vazio'],
    thesis: 'Análise vetada por resposta vazia/inválida da IA.',
    analysis: 'A IA retornou resposta vazia, bloqueada ou sem estrutura válida; o jogo foi vetado por segurança.',
    risk_factors: reason,
    api_predictions_agree: null,
  }

  if (incCorners) fallback.corner_prediction = null
  if (incCards) {
    fallback.card_prediction = null
    fallback.referee_impact = null
  }

  return fallback
}

// ═══ CACHE LAYER (TTL 5min) — reduz ~70% das chamadas Gemini quando análise repete com mesmas odds/stats ═══
async function hashKey(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

async function callGeminiCached(sb: any, sys: string, usr: string, incCorners: boolean, incCards: boolean) {
  const key = await hashKey(`${sys}::${usr}::${incCorners?1:0}::${incCards?1:0}`)
  try {
    const { data: cached } = await sb.from('ai_response_cache')
      .select('response_json, expires_at')
      .eq('cache_key', key).eq('function_name', 'mycroft-punter-analysis')
      .gt('expires_at', new Date().toISOString()).maybeSingle()
    if (cached?.response_json) {
      console.log(`[Mycroft Punter] 🎯 Cache HIT (${key.slice(0,8)}) — pulando Gemini`)
      sb.from('ai_response_cache').update({ hit_count: (cached as any).hit_count ? (cached as any).hit_count + 1 : 1 }).eq('cache_key', key).then(() => {}, () => {})
      return cached.response_json
    }
  } catch (e) { console.warn('[Mycroft Punter] Cache lookup falhou:', (e as any)?.message) }

  const result = await callGemini(sys, usr, incCorners, incCards)

  // Cache apenas resultados válidos (não erros/vetos por timeout)
  if (result && typeof result === 'object') {
    try {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      await sb.from('ai_response_cache').upsert({
        cache_key: key, function_name: 'mycroft-punter-analysis',
        response_json: result, expires_at: expiresAt, hit_count: 0,
      }, { onConflict: 'cache_key' })
    } catch (e) { console.warn('[Mycroft Punter] Cache write falhou:', (e as any)?.message) }
  }
  return result
}

async function callGemini(sys:string, usr:string, incCorners:boolean=false, incCards:boolean=false) {
  // Migrado para Lovable AI Gateway (sem rate-limit do free tier do Gemini direto)
  // Formato OpenAI-compatible com tool calling para structured output

  const schemaProperties: Record<string,any> = {
    verdict: { type: 'string', enum: ['APROVADO_ELITE','APROVADO_FORTE','APROVADO_TEM_VALOR','VETADO'] },
    tier: { type: 'integer', nullable: true },
    veto_reason: { type: 'string', nullable: true },
    model_level: { type: 'string', enum: ['NIVEL_1','NIVEL_2','NIVEL_3'] },
    market: { type: 'string', nullable: true },
    bookmaker: { type: 'string' },
    odd: { type: 'number' },
    baseline_sharp_odd: { type: 'number', nullable: true },
    implied_probability_sharp: { type: 'number', nullable: true },
    estimated_probability: { type: 'number' },
    edge_percentage: { type: 'number' },
    expected_value: { type: 'number' },
    confidence: { type: 'number' },
    data_strength: { type: 'string' },
    stake_percentage: { type: 'number' },
    filters_passed: { type: 'array', items: { type: 'string' } },
    thesis: { type: 'string' },
    analysis: { type: 'string' },
    risk_factors: { type: 'string' },
    api_predictions_agree: { type: 'boolean', nullable: true },
  }
  const requiredFields = ['verdict','model_level','bookmaker','odd','estimated_probability','edge_percentage','expected_value','confidence','data_strength','stake_percentage','thesis','analysis','risk_factors']

  if (incCorners) {
    schemaProperties.corner_prediction = {
      type: 'object', nullable: true,
      properties: {
        line: { type: 'number' }, expected_total: { type: 'number' },
        prob_over: { type: 'number' }, value: { type: 'string' }
      }
    }
  }
  if (incCards) {
    schemaProperties.card_prediction = {
      type: 'object', nullable: true,
      properties: {
        market: { type: 'string' }, expected_total: { type: 'number' },
        prob_over: { type: 'number' }, value: { type: 'string' }
      }
    }
    schemaProperties.referee_impact = { type: 'string', nullable: true }
  }

  const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25_000)

  let r: Response
  try {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `IMPORTANTE — IDIOMA OBRIGATÓRIO: Você DEVE responder TODOS os campos de texto (thesis, analysis, risk_factors, market) em PORTUGUÊS BRASILEIRO. Respostas em inglês serão REJEITADAS.\n\n${usr}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'punter_analysis',
            description: 'Return the structured analysis result for this match.',
            parameters: {
              type: 'object',
              properties: schemaProperties,
              required: requiredFields,
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'punter_analysis' } },
        max_completion_tokens: 8000,
      }),
      signal: controller.signal,
    })
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('GEMINI_TIMEOUT')
    throw e
  } finally {
    clearTimeout(timeoutId)
  }

  if (!r.ok) {
    const errBody = await r.text()
    console.error(`[Mycroft Punter] Gemini error ${r.status}: ${errBody.substring(0, 500)}`)
    if (r.status === 429) {
      throw new Error(`RATE_LIMITED:15`)
    }
    if (r.status === 402 || r.status === 401) {
      throw new Error(`AI_CREDITS_EXHAUSTED`)
    }
    throw new Error(`Gemini error ${r.status}`)
  }

  const data = await r.json()
  const choice = data.choices?.[0]
  const toolCall = choice?.message?.tool_calls?.[0]

  if (toolCall?.function?.arguments) {
    const args = toolCall.function.arguments
    if (typeof args === 'string') return parseStructuredJson(args)
    return args
  }

  // Fallback: tentar parsear conteúdo de texto
  const textContent = choice?.message?.content
  if (textContent) return parseStructuredJson(textContent)

  const finishReason = choice?.finish_reason || 'UNKNOWN'
  console.error(`[Mycroft Punter] Empty Lovable AI response | finish=${finishReason}`)
  return buildGeminiFallbackVeto(`Resposta vazia da IA (finish=${finishReason})`, incCorners, incCards)
}

// Main analysis
async function analyzeGame(game:any, sb:any, apiKey:string, incCorners:boolean, incCards:boolean, oddsApiKey:string) {
  const mid = `${game.home_team}_${game.away_team}_${game.commence_time}`.replace(/\s+/g,'_').replace(/\+00:00/g,'Z')
  console.log(`[Mycroft Punter] Analisando: ${game.home_team} vs ${game.away_team} (AI: gemini, corners: ${incCorners}, cards: ${incCards})`)
  const odds=extractOdds(game), totals=extractTotals(game)
  if(!odds.length&&!totals.length) return null

  // Skip individual event odds calls (corners/cards) — they consistently return 422 and waste ~2-3s per game
  // Instead, rely on Poisson model estimates for corners/cards markets
  const cornOdds:any[]=[], cardOdds:any[]=[]

  const [en, sofaForm, fbrefForm] = await Promise.all([
    fetchEnrichedData(game.home_team,game.away_team,apiKey,game.sport_key,incCorners,incCards),
    fetchSofaForm(game.home_team, game.away_team),
    fetchFBrefForm(game.home_team, game.away_team),
  ])
  const det=computeDetectors(odds,totals,null,null)
  console.log(`[Detectors] ${game.home_team} vs ${game.away_team}: MIS=${(det.mis*100).toFixed(1)}% (${det.mis_level}), ODI=${(det.odi*100).toFixed(1)}%, Sharp=${det.sharp.activity_score}/100 (${det.sharp.activity_level})`)

  // ═══ POISSON BIVARIADA — Etapa pré-Gemini ═══
  // Modelo de Força de Ataque/Defesa normalizado pela média da liga
  let poissonBlk = ''
  let poissonResult: PoissonResult | null = null
  let poissonEdges: EdgeResult[] = []
  let poissonDadosReais = false
  {
    // Compute league average from standings data
    const standings = en.standings as any[] || []
    let mediaLiga = 1.25 // default: ~2.5 goals/game total
    if (standings.length >= 6) {
      let totalGoalsFor = 0, totalPlayed = 0
      for (const t of standings) {
        totalGoalsFor += (t.all?.goals?.for || 0)
        totalPlayed += (t.all?.played || 0)
      }
      if (totalPlayed > 0) {
        mediaLiga = totalGoalsFor / totalPlayed
        console.log(`[Poisson] Liga média calculada: ${mediaLiga.toFixed(3)} gols/time/jogo (${totalGoalsFor} gols em ${totalPlayed} jogos-time)`)
      }
    } else {
      console.log(`[Poisson] Standings insuficientes (${standings.length} times), usando média padrão: ${mediaLiga}`)
    }

    // Extract goal averages from season stats (home/away split when available)
    const hSS = en.homeSeasonStats as any
    const aSS = en.awaySeasonStats as any
    const hGoalsForAvg = hSS?.goals?.for?.average?.home ? parseFloat(hSS.goals.for.average.home) : null
    const hGoalsAgainstAvg = hSS?.goals?.against?.average?.home ? parseFloat(hSS.goals.against.average.home) : null
    const aGoalsForAvg = aSS?.goals?.for?.average?.away ? parseFloat(aSS.goals.for.average.away) : null
    const aGoalsAgainstAvg = aSS?.goals?.against?.average?.away ? parseFloat(aSS.goals.against.average.away) : null

    // Fallback from recent fixtures if season stats unavailable
    const hAvgScored = hGoalsForAvg ?? (en.home ? parseFloat(en.home.avg_goals_scored) : 1.3)
    const hAvgConceded = hGoalsAgainstAvg ?? (en.home ? parseFloat(en.home.avg_goals_conceded) : 1.2)
    const aAvgScored = aGoalsForAvg ?? (en.away ? parseFloat(en.away.avg_goals_scored) : 1.1)
    const aAvgConceded = aGoalsAgainstAvg ?? (en.away ? parseFloat(en.away.avg_goals_conceded) : 1.3)

    poissonDadosReais = !!(hGoalsForAvg && hGoalsAgainstAvg && aGoalsForAvg && aGoalsAgainstAvg)

    // Pass league average to strength model — no more raw multiplication
    poissonResult = calcularPoisson(hAvgScored, aAvgScored, hAvgConceded, aAvgConceded, mediaLiga)

    console.log(`[Poisson] ${game.home_team}: Atq=${poissonResult.forcaAtqCasa} Def=${poissonResult.forcaDefCasa} | ${game.away_team}: Atq=${poissonResult.forcaAtqVisitante} Def=${poissonResult.forcaDefVisitante} | Liga=${mediaLiga.toFixed(2)}`)

    // Build odds map from extracted odds for edge calc
    const pinnacle = odds.find((o:any) => (o.bookmaker||'').toLowerCase().includes('pinnacle'))
    const bestH2H = pinnacle || odds[0]
    const bestTotals25 = totals.find((t:any) => Math.abs(t.line - 2.5) < 0.1)
    const bestTotals35 = totals.find((t:any) => Math.abs(t.line - 3.5) < 0.1)
    const bestTotals15 = totals.find((t:any) => Math.abs(t.line - 1.5) < 0.1)

    poissonEdges = calcularEdges(poissonResult, {
      casa: bestH2H?.home_odd,
      empate: bestH2H?.draw_odd,
      visitante: bestH2H?.away_odd,
      over25: bestTotals25?.over_odd,
      under25: bestTotals25?.under_odd,
      over35: bestTotals35?.over_odd,
      under35: bestTotals35?.under_odd,
      over15: bestTotals15?.over_odd,
      under15: bestTotals15?.under_odd,
    })

    poissonBlk = formatarBlocoPoisson(poissonResult, poissonEdges, game.home_team, game.away_team)
    console.log(`[Poisson] ${game.home_team} vs ${game.away_team}: λH=${poissonResult.lambdaCasa} λA=${poissonResult.lambdaVisitante} xG=${poissonResult.xGCombinado} Dados=${poissonDadosReais?'REAIS':'FALLBACK'} Edges=${poissonEdges.filter(e=>e.temEdge).length}`)

    // Log to poisson_log (non-blocking)
    sb.from('poisson_log').insert({
      jogo: `${game.home_team} vs ${game.away_team}`,
      liga: game.sport_title || 'Unknown',
      lambda_casa: poissonResult.lambdaCasa,
      lambda_visitante: poissonResult.lambdaVisitante,
      prob_casa: poissonResult.probCasa,
      prob_empate: poissonResult.probEmpate,
      prob_visitante: poissonResult.probVisitante,
      prob_over25: poissonResult.probOver25,
      prob_btts: poissonResult.probBTTS,
      edges_positivos: poissonEdges.filter(e => e.temEdge).map(e => ({ mercado: e.mercado, edge: e.edge, oddJusta: e.oddJusta })),
      dados_reais: poissonDadosReais,
    }).then(() => {}).catch((e: any) => console.warn('[Poisson] Log insert error:', e))
  }

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

  const sysPr=`${MYCROFT_PUNTER_PROMPT}\nREGRA: Retorne APENAS JSON válido. Sem texto livre.\nREGRA DE IDIOMA: Todas as respostas (thesis, analysis, risk_factors, market, todos os campos de texto) DEVEM ser em português brasileiro. NUNCA responda em inglês.\nREGRA DE QUALIDADE: thesis deve ser detalhada com fundamentação (mínimo 150 caracteres). analysis deve conter a análise completa com dados estatísticos, probabilidades e justificativa (mínimo 300 caracteres). risk_factors deve listar todos os riscos identificados.\nREGRA ANTI-CONFLITO: Recomende NO MÁXIMO 1 mercado por jogo. Escolha o mercado com MAIOR EDGE positivo. NUNCA aprove Casa e Fora no mesmo jogo. NUNCA aprove Over e Under na mesma linha.\nREGRA PROBABILIDADE OBRIGATÓRIA: O campo estimated_probability DEVE ser preenchido com a probabilidade REAL do evento (%). Se Poisson disponível, usar como base. Se prob < 40%, VETAR IMEDIATAMENTE independente do edge. Exemplo: Under 3.5 com prob 1% deve ser VETADO mesmo com edge de 47%.\nREGRA POISSON: As probabilidades Poisson Bivariada fornecidas são a BASE MATEMÁTICA. Use-as como referência principal para estimated_probability. Ajuste apenas com fundamentação contextual.\n${incCorners?'ESCANTEIOS: Compare probabilidades Poisson com odds disponíveis. Se odds não disponíveis, use fair_odd = 1/probabilidade_modelo. Aprovação requer edge >= 5% e probabilidade Poisson >= 55%.\n':''}${incCards?'CARTÕES: Compare estimativa de cartões com odds disponíveis e perfil do árbitro. Se odds não disponíveis, use fair_odd = 1/probabilidade_modelo. Aprovação requer edge >= 5% e confiança no modelo.\n':''}Escolha o mercado com MAIOR edge. Escanteios e cartões são mercados VÁLIDOS — não os ignore se tiverem edge.`

  const usrPr=`JOGO: ${game.home_team} vs ${game.away_team} | Liga: ${game.sport_title||'?'} | ${new Date(game.commence_time).toLocaleString('pt-BR')} | Dados: ${dsl} | Modelo: ${en.model_level}
${poissonBlk}
${fmtTeam(game.home_team,en.home)}
${fmtTeam(game.away_team,en.away)}
${fmtH2H(en.h2h)}
${fmtInj(game.home_team,en.injuries?.home||[])} ${fmtInj(game.away_team,en.injuries?.away||[])}
${fmtStand(en.standings||[],game.home_team,game.away_team)}
${fmtPred(en.predictions)}
${fmtSofaForm(sofaForm)}
${fmtFBrefForm(fbrefForm)}
${en.predictions?'Validação cruzada: Concordam→+5% Divergem→-5%':''}
${fmtDetectors(det)}
${cornBlk}${cardBlk}
${game.simulated_odds?'⚠️ ODDS SIMULADAS (Modelo Poisson)':''}
ODDS H2H: ${odds.map((o:any)=>`${o.bookmaker}: ${game.home_team} ${o.home_odd} Emp ${o.draw_odd} ${game.away_team} ${o.away_odd}`).join(' | ')}
${totals.length?`TOTALS: ${totals.map((t:any)=>`${t.bookmaker}: O${t.line} ${t.over_odd} U${t.line} ${t.under_odd}`).join(' | ')}`:''}
${calcProb(odds[0])} ${totals.length?calcTotalsProb(totals[0]):''}

Retorne JSON: {"verdict":"APROVADO_ELITE"|"APROVADO_FORTE"|"APROVADO_TEM_VALOR"|"VETADO","tier":1|2|3|null,"veto_reason":null|"...","model_level":"${en.model_level}","market":${mkts.join('|')}|null,"bookmaker":"...","odd":0,"baseline_sharp_odd":0,"implied_probability_sharp":0,"estimated_probability":0,"edge_percentage":0,"expected_value":0,"confidence":0,"data_strength":"${dsl}","stake_percentage":0,"filters_passed":[],"thesis":"...","analysis":"...","risk_factors":"...","api_predictions_agree":null${incCorners?',"corner_prediction":{"line":0,"expected_total":0,"prob_over":0,"value":""}':''}${incCards?',"card_prediction":{"market":"","expected_total":0,"prob_over":0,"value":""},"referee_impact":""':''}}
SIGA RIGOROSAMENTE os critérios de Edge, Confiança e Filtros definidos no system prompt. MAIOR EDGE = mercado recomendado. Use as probabilidades Poisson como base para estimated_probability.`

  for (let att=0;att<3;att++) {
    try {
      await respectGeminiRateLimitWindow()
      const parsed = await callGeminiCached(sb, sysPr, usrPr, incCorners, incCards)
      const a = parsed
      // Map new field names to existing DB columns
      if(a.edge_percentage!=null&&a.value_percentage==null) a.value_percentage=a.edge_percentage
      if(a.baseline_sharp_odd!=null&&a.fair_odd==null) a.fair_odd=a.baseline_sharp_odd
      if(a.implied_probability_sharp!=null&&a.implied_probability==null) a.implied_probability=a.implied_probability_sharp
      if(a.value_percentage==null) a.value_percentage=a.ev_percentage||a.edge||a.value||null
      if(a.value_percentage==null&&a.estimated_probability&&a.odd) a.value_percentage=Math.round((a.estimated_probability-(1/a.odd)*100)*10)/10
      if(a.value_percentage==null) a.value_percentage=0

      // ═══ GARANTIR estimated_probability preenchido ═══
      // Fallback: usar dados Poisson quando a IA não preencher corretamente
      if (!a.estimated_probability || a.estimated_probability <= 0) {
        let fallbackProb: number | null = null
        if (poissonResult && a.market) {
          const mkt = (a.market || '').toLowerCase()
          if (mkt.includes('over 2.5')) fallbackProb = poissonResult.probOver25 * 100
          else if (mkt.includes('under 2.5')) fallbackProb = (1 - poissonResult.probOver25) * 100
          else if (mkt.includes('over 3.5')) fallbackProb = poissonResult.probOver35 * 100
          else if (mkt.includes('under 3.5')) fallbackProb = (1 - poissonResult.probOver35) * 100
          else if (mkt.includes('over 1.5')) fallbackProb = poissonResult.probOver15 * 100
          else if (mkt.includes('under 1.5')) fallbackProb = (1 - poissonResult.probOver15) * 100
          else if (mkt.includes('casa') || mkt.includes('home')) fallbackProb = poissonResult.probCasa * 100
          else if (mkt.includes('empate') || mkt.includes('draw')) fallbackProb = poissonResult.probEmpate * 100
          else if (mkt.includes('fora') || mkt.includes('away')) fallbackProb = poissonResult.probVisitante * 100
          else if (mkt.includes('btts') || mkt.includes('ambas')) fallbackProb = poissonResult.probBTTS * 100
        }
        // Last resort: derive from odd (implied probability)
        if (!fallbackProb && a.odd && a.odd > 1) {
          fallbackProb = (1 / a.odd) * 100
        }
        if (fallbackProb) {
          a.estimated_probability = Math.round(fallbackProb * 100) / 100
          console.log(`[Mycroft Punter] ⚠️ estimated_probability preenchido via fallback: ${a.estimated_probability}% (market: ${a.market})`)
        }
      }

      // Recalcular fair_odd baseado em estimated_probability
      if (a.estimated_probability && a.estimated_probability > 0) {
        const correctFairOdd = Math.round((1 / (a.estimated_probability / 100)) * 100) / 100
        if (!a.fair_odd || Math.abs(a.fair_odd - a.odd) < 0.01) {
          a.fair_odd = correctFairOdd
        }
      }

      console.log(`[Mycroft Punter] ${game.home_team} vs ${game.away_team}: ${a.verdict} | Market: ${a.market} | Model: ${a.model_level} | Edge: ${a.edge_percentage}% | Conf: ${a.confidence}% | Tier: ${a.tier}`)
      if(a.corner_prediction) console.log(`[Mycroft Punter] 🏁 Corner: Line ${a.corner_prediction.line}, Expected ${a.corner_prediction.expected_total}, Value ${a.corner_prediction.value}`)
      if(a.card_prediction) console.log(`[Mycroft Punter] 🟨 Card: ${a.card_prediction.market}, Expected ${a.card_prediction.expected_total}, Value ${a.card_prediction.value}`)

      // ═══ VALIDADOR — última barreira antes do INSERT ═══
      const validation = validateAnalysis(a)
      if (!validation.valid) {
        console.log(`[Mycroft Punter] 🚫 VETADO pelo validador: ${game.home_team} vs ${game.away_team} — ${validation.reason}`)
        await sb.from('mycroft_vetoed_log').insert({
          jogo: `${game.home_team} vs ${game.away_team}`,
          liga: game.sport_title || 'Unknown',
          mercado: a.market,
          odd: a.odd,
          edge_recebido: a.edge_percentage,
          confianca_recebida: a.confidence,
          verdict_gemini: a.verdict,
          motivo_veto: validation.reason,
          raw_response: a
        })
        // Salva como VETADO na punter_analyses para auditoria
        a.verdict = 'VETADO'
        a.veto_reason = validation.reason
        await sb.from('punter_analyses').insert({
          match_id:mid,home_team:game.home_team,away_team:game.away_team,league:game.sport_title||'Unknown',
          commence_time:game.commence_time,market:a.market||'N/A',bookmaker:a.bookmaker||'N/A',odd:a.odd||0,
          fair_odd:a.fair_odd,implied_probability:a.implied_probability,estimated_probability:a.estimated_probability,
          value_percentage:a.value_percentage,verdict:'VETADO',confidence:a.confidence,stake_percentage:0,
          thesis:`[VETADO] ${validation.reason}`,analysis:a.analysis||'',risk_factors:a.risk_factors||'',analyzed_by:'gemini'
        })
        const mp=a.estimated_probability||null, mkp=a.implied_probability||(a.odd?(1/a.odd)*100:0)
        await persistDetectors(sb,mid,a.market||'h2h',computeDetectors(odds,totals,mp,a.market),mp,mkp)
        return a
      }

      // ═══ Passou em TODOS os critérios — verifica conflito antes de salvar ═══
      if(a.verdict?.startsWith('APROVADO')) a.verdict='APROVADO'
      
      // ANTI-CONFLITO PRÉ-PERSIST: Verificar se já existe sinal aprovado para este jogo com mercado diferente
      const { data: existingSignals } = await sb.from('punter_analyses').select('id, market, estimated_probability, value_percentage, confidence').eq('match_id', mid).eq('verdict', 'APROVADO')
      if (existingSignals && existingSignals.length > 0) {
        const myScore = (a.estimated_probability || 0) * (a.edge_percentage || a.value_percentage || 0) * (a.confidence || 0)
        for (const existing of existingSignals) {
          if (existing.market === a.market) continue // same market = will be deduped by upsert below
          const existScore = (existing.estimated_probability || 0) * (existing.value_percentage || 0) * (existing.confidence || 0)
          // Check for mutually exclusive markets
          const isConflict = (
            (a.market?.includes('Over') && existing.market?.includes('Under') && a.market?.replace('Over','') === existing.market?.replace('Under','')) ||
            (a.market?.includes('Under') && existing.market?.includes('Over') && a.market?.replace('Under','') === existing.market?.replace('Over','')) ||
            (a.market?.includes('Casa') && existing.market?.includes('Fora')) ||
            (a.market?.includes('Fora') && existing.market?.includes('Casa'))
          )
          if (isConflict) {
            if (myScore > existScore) {
              // New signal is better — remove old one
              await sb.from('punter_sinais').delete().eq('match_id', mid).eq('market', existing.market)
              await sb.from('punter_analyses').delete().eq('id', existing.id)
              console.log(`[Mycroft Punter] 🔄 Conflito resolvido: ${a.market} (score ${myScore.toFixed(0)}) substituiu ${existing.market} (score ${existScore.toFixed(0)})`)
            } else {
              // Existing signal is better — veto this one
              console.log(`[Mycroft Punter] 🚫 Conflito: ${a.market} (score ${myScore.toFixed(0)}) perdeu para ${existing.market} existente (score ${existScore.toFixed(0)})`)
              a.verdict = 'VETADO'
              a.veto_reason = `Mercado oposto ${existing.market} já aprovado com score superior`
              await sb.from('punter_analyses').insert({
                match_id:mid,home_team:game.home_team,away_team:game.away_team,league:game.sport_title||'Unknown',
                commence_time:game.commence_time,market:a.market||'N/A',bookmaker:a.bookmaker||'N/A',odd:a.odd||0,
                fair_odd:a.fair_odd,implied_probability:a.implied_probability,estimated_probability:a.estimated_probability,
                value_percentage:a.value_percentage,verdict:'VETADO',confidence:a.confidence,stake_percentage:0,
                thesis:`[VETADO] ${a.veto_reason}`,analysis:a.analysis||'',risk_factors:a.risk_factors||'',analyzed_by:'gemini'
              })
              return a
            }
          }
        }
      }

      console.log(`[Mycroft Punter] ✅ APROVADO: ${game.home_team} vs ${game.away_team} | Tier ${a.tier} | Edge ${a.edge_percentage}% | Stake ${a.stake_percentage}%`)

      // ─── SPORTMONKS PREDICTIONS (segunda opinião) ───
      // Camada 1 (Sherlock alert): divergência >15pp → flag sherlock_alert + nota informativa (NÃO veta)
      // Camada 2 (Shadow log): persiste em punter_predictions_shadow para calibração futura
      let smProbe: Awaited<ReturnType<typeof probeSportmonksPrediction>> | null = null
      try {
        smProbe = await probeSportmonksPrediction({
          match_id: mid,
          home_team: game.home_team,
          away_team: game.away_team,
          commence_time: game.commence_time,
          league: game.sport_title,
          market: a.market || '',
          mycroft_probability_pct: Number(a.estimated_probability ?? 0),
          verdict: a.verdict,
        })
        if (smProbe.sherlock_alert && smProbe.note) {
          a.sherlock_alert = true
          a.risk_factors = [a.risk_factors, smProbe.note].filter(Boolean).join(' | ')
          console.log(`[SM-Predictions] ⚠️ ${game.home_team} vs ${game.away_team}: ${smProbe.note}`)
        }
      } catch (smErr) {
        console.warn('[SM-Predictions] probe falhou (não crítico):', (smErr as Error)?.message)
      }

      // Dedup: remove old unified signal for same match+market before inserting
      await sb.from('punter_sinais').delete().eq('match_id',mid).eq('market',a.market||'N/A')
      await sb.from('punter_analyses').delete().eq('match_id',mid).eq('market',a.market||'N/A')

      const {data:row} = await sb.from('punter_analyses').insert({
        match_id:mid,home_team:game.home_team,away_team:game.away_team,league:game.sport_title||'Unknown',
        commence_time:game.commence_time,market:a.market||'N/A',bookmaker:a.bookmaker||'N/A',odd:a.odd||0,
        fair_odd:a.fair_odd,implied_probability:a.implied_probability,estimated_probability:a.estimated_probability,
        value_percentage:a.value_percentage,verdict:a.verdict,confidence:a.confidence,stake_percentage:a.stake_percentage,
        thesis:a.thesis,analysis:a.analysis,risk_factors:a.risk_factors,analyzed_by:'gemini',
        sherlock_alert: !!smProbe?.sherlock_alert,
        sportmonks_probability: smProbe?.sportmonks_probability ?? null,
        sportmonks_divergence_pp: smProbe?.divergence_pp ?? null,
        sportmonks_prediction: smProbe?.prediction ?? null,
      }).select().maybeSingle()

      if (row && smProbe && smProbe.sportmonks_probability !== null) {
        await logShadowPrediction(sb, {
          analysis_id: row.id, match_id: mid,
          home_team: game.home_team, away_team: game.away_team,
          league: game.sport_title, commence_time: game.commence_time,
          market: a.market || 'N/A',
          mycroft_probability: Number(a.estimated_probability ?? 0),
          probe: smProbe, verdict: a.verdict,
        })
      }

      if(a.verdict==='APROVADO'&&row) {
        // ═══ Fluxo desacoplado: hoje = stake imediato, futuro = aguardar recálculo ═══
        const hoje = new Date().toISOString().split('T')[0]
        const commenceDate = game.commence_time ? new Date(game.commence_time) : new Date()
        const matchDate = commenceDate.toISOString().split('T')[0]
        const isHoje = matchDate === hoje

        if (isHoje) {
          // Jogo é hoje — fluxo imediato (stake calculado agora)
          await sb.from('punter_sinais').insert({
            legacy_analysis_id: row.id, match_id:mid, home_team:game.home_team, away_team:game.away_team,
            league:game.sport_title||'Unknown', market:a.market, bookmaker:a.bookmaker, odd:a.odd,
            fair_odd:a.fair_odd, implied_probability:a.implied_probability, estimated_probability:a.estimated_probability,
            value_percentage:a.value_percentage, verdict:a.verdict, confidence:a.confidence,
            stake_percentage:a.stake_percentage, stake_percentage_original:a.stake_percentage,
            thesis:a.thesis, analysis:a.analysis, risk_factors:a.risk_factors, analyzed_by:'gemini',
            status:'pending', stake_confirmed:true, match_date:matchDate, commence_time:game.commence_time,
            dismissed:false, resultado:null,
            sherlock_alert: !!smProbe?.sherlock_alert,
            sportmonks_probability: smProbe?.sportmonks_probability ?? null,
            sportmonks_divergence_pp: smProbe?.divergence_pp ?? null,
          })
          console.log(`[Mycroft Punter] ✅ Sinal HOJE registrado — stake ${a.stake_percentage}%`)
        } else {
          // Jogo futuro — aprovação sem stake (será recalculado no dia do jogo)
          await sb.from('punter_sinais').insert({
            legacy_analysis_id: row.id, match_id:mid, home_team:game.home_team, away_team:game.away_team,
            league:game.sport_title||'Unknown', market:a.market, bookmaker:a.bookmaker, odd:a.odd,
            fair_odd:a.fair_odd, implied_probability:a.implied_probability, estimated_probability:a.estimated_probability,
            value_percentage:a.value_percentage, verdict:a.verdict, confidence:a.confidence,
            stake_percentage:null, stake_percentage_original:a.stake_percentage,
            thesis:a.thesis, analysis:a.analysis, risk_factors:a.risk_factors, analyzed_by:'gemini',
            status:'awaiting_stake', stake_confirmed:false, match_date:matchDate, commence_time:game.commence_time,
            dismissed:false, resultado:null,
            sherlock_alert: !!smProbe?.sherlock_alert,
            sportmonks_probability: smProbe?.sportmonks_probability ?? null,
            sportmonks_divergence_pp: smProbe?.divergence_pp ?? null,
          })
          const diasRestantes = Math.ceil((commenceDate.getTime() - Date.now()) / (1000*60*60*24))
          console.log(`[Mycroft Punter] ⏳ Sinal FUTURO registrado (${matchDate}, ${diasRestantes}d) — stake será recalculado`)
        }
      }
      // Attach analysis_id to returned object so client can use it for auto-betting
      if(row) a.analysis_id = row.id
      const mp=a.estimated_probability||null, mkp=a.implied_probability||(a.odd?(1/a.odd)*100:0)
      await persistDetectors(sb,mid,a.market||'h2h',computeDetectors(odds,totals,mp,a.market),mp,mkp)
      return a
    } catch(e:any) {
      const msg = String(e?.message || e || 'unknown_error')
      const isRateLimited = msg.includes('RATE_LIMITED') || msg.includes('429')
      const isTimeout = msg.includes('GEMINI_TIMEOUT')
      const retryAfterSec = isRateLimited
        ? Math.max(12, Math.ceil(Number((msg.match(/RATE_LIMITED:(\d+)/)?.[1]) || '15')))
        : 0

      // Não bloquear o batch inteiro por timeout individual de IA
      if (isTimeout) {
        console.warn(`[Mycroft Punter] Timeout Gemini em ${game.home_team} vs ${game.away_team} — aplicando veto de fallback`) 
        return buildGeminiFallbackVeto('Timeout da IA durante análise', incCorners, incCards)
      }

      // Retry curto: 1 tentativa normal, até 3 apenas para rate limit
      if ((isRateLimited && att < 2) || (!isRateLimited && att < 1)) {
        if (isRateLimited) {
          geminiRateLimitUntil = Math.max(geminiRateLimitUntil, Date.now() + retryAfterSec * 1000)
          await respectGeminiRateLimitWindow()
        } else {
          await wait(800)
        }
        continue
      }

      console.warn(`[Mycroft Punter] Falha definitiva em ${game.home_team} vs ${game.away_team}: ${msg} — aplicando veto de fallback`)
      return buildGeminiFallbackVeto(`Falha da IA: ${msg.slice(0, 120)}`, incCorners, incCards)
    }
  }
  return null
}

// Main handler
serve(async (req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  execStart = Date.now()
  try {
    const sb=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',{auth:{persistSession:false}})
    await loadCalibration(sb)
    const body=await req.json()
    const {sports=['soccer_brazil_campeonato','soccer_brazil_serie_b','soccer_brazil_campeonato_paulista','soccer_brazil_campeonato_carioca','soccer_brazil_campeonato_mineiro','soccer_brazil_campeonato_gaucho','soccer_brazil_campeonato_baiano','soccer_brazil_campeonato_paranaense','soccer_brazil_campeonato_catarinense','soccer_brazil_campeonato_pernambucano','soccer_brazil_copa_nordeste','soccer_brazil_copa_do_brasil','soccer_brazil_serie_c','soccer_brazil_copa_verde','soccer_conmebol_copa_libertadores','soccer_conmebol_copa_sudamericana','soccer_uefa_champs_league','soccer_uefa_europa_league','soccer_epl','soccer_england_efl_cup','soccer_england_league1','soccer_spain_la_liga','soccer_italy_serie_a','soccer_italy_serie_b','soccer_germany_bundesliga','soccer_germany_bundesliga2','soccer_france_ligue_one','soccer_argentina_primera_division','soccer_fifa_world_cup_qualifier_europe','soccer_netherlands_eredivisie','soccer_portugal_primeira_liga','soccer_international_friendlies','soccer_usa_nwsl'],
      sport=null as string|null, hours_ahead=48, bookmakers=['bet365','pinnacle','betfair'], min_value=3, include_corners=true, include_cards=true} = body

    const leagues:string[] = sport?[sport]:sports
    console.log(`[Mycroft Punter] Leagues: ${leagues.length}, Hours: ${hours_ahead}h, Corners: ${include_corners}, Cards: ${include_cards}`)
    const oddsKey=Deno.env.get('THE_ODDS_API_KEY'); if(!oddsKey) throw new Error('THE_ODDS_API_KEY not configured')
    const apiKey='' // API-Football removida em Fase 2 — estaduais sem odds não terão fallback (skip)
    const now=new Date(), maxT=new Date(now.getTime()+hours_ahead*36e5)
    const games:any[]=[], noOdds:string[]=[]

    for(const lg of leagues) {
      if(isTimedOut()) { console.warn('[Mycroft Punter] ⏱️ Time guard na busca de odds'); break }
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

    // PRE-ANALYSIS DEDUP: Remove duplicate games (same home+away+time from different sport_keys)
    const seenGames = new Map<string, number>()
    const uniqueGames: typeof games = []
    for (const g of games) {
      const gKey = `${g.home_team}__${g.away_team}__${g.commence_time}`.toLowerCase()
      if (!seenGames.has(gKey)) {
        seenGames.set(gKey, uniqueGames.length)
        uniqueGames.push(g)
      } else {
        console.log(`[Mycroft Punter] 🔄 Dedup pré-análise: ${g.home_team} vs ${g.away_team} duplicado (${g.sport_key})`)
      }
    }
    const preDedup = games.length - uniqueGames.length
    if (preDedup > 0) console.log(`[Mycroft Punter] 🔄 ${preDedup} jogos duplicados removidos antes da análise`)

    console.log(`[Mycroft Punter] Total: ${uniqueGames.length} jogos únicos (${games.length} brutos)`)
    if(!uniqueGames.length) return new Response(JSON.stringify({success:true,signals:[],total_analyzed:0,total_approved:0,leagues_scanned:leagues.length,message:`Nenhum jogo nas próximas ${hours_ahead}h`}),{headers:{...corsHeaders,'Content-Type':'application/json'}})

    // ANTI-DUPLICATION: Fetch ALL existing bets (pending + settled) to skip already-bet matches
    const { data: existingBets } = await sb.from('virtual_bets_punter').select('match_id, status').in('status', ['pending', 'green', 'red'])
    const existingMatchIds = new Set((existingBets || []).map((b: any) => (b.match_id || '').replace(/\+00:00/g, 'Z').toLowerCase()))
    
    // Filter out games that already have bets placed
    const filteredGames = uniqueGames.filter((g: any) => {
      const matchId = `${g.home_team}_${g.away_team}`.replace(/\s+/g, '_').toLowerCase()
      const hasExisting = [...existingMatchIds].some(eid => eid.startsWith(matchId))
      if (hasExisting) {
        console.log(`[Mycroft Punter] ⏭️ Pulando ${g.home_team} vs ${g.away_team} — aposta já existente`)
      }
      return !hasExisting
    })
    
    const skippedCount = uniqueGames.length - filteredGames.length
    if (skippedCount > 0) console.log(`[Mycroft Punter] 🔒 ${skippedCount} jogos ignorados (apostas já existentes)`)
    
    if(!filteredGames.length) return new Response(JSON.stringify({success:true,signals:[],total_analyzed:0,total_approved:0,skipped_existing:skippedCount,leagues_scanned:leagues.length,message:`Todos os ${skippedCount} jogos já possuem apostas`}),{headers:{...corsHeaders,'Content-Type':'application/json'}})

    // Prompt embarcado — fonte única, sem KB
    const approved:any[]=[]
    let total=0, timedOut=false
    const prioritizedGames = [...filteredGames].sort((a: any, b: any) => {
      const oddsScore = (g: any) => {
        const bookmakers = g.bookmakers || []
        const hasPinnacle = bookmakers.some((bk: any) => (bk.title || '').toLowerCase().includes('pinnacle')) ? 4 : 0
        const totalBooks = bookmakers.length
        const totalMarkets = bookmakers.reduce((sum: number, bk: any) => sum + (bk.markets?.length || 0), 0)
        return hasPinnacle + totalBooks * 2 + totalMarkets
      }
      const timeScore = (g: any) => Math.abs(new Date(g.commence_time).getTime() - Date.now())
      return oddsScore(b) - oddsScore(a) || timeScore(a) - timeScore(b)
    })
    const toAnalyze=prioritizedGames.slice(0,MAX_GAMES)
    for(let i=0;i<toAnalyze.length;i+=BATCH) {
      // ⏱️ Time guard — return partial results before Supabase kills us
      if(isTimedOut()) {
        console.warn(`[Mycroft Punter] ⏱️ Time guard ativado em ${Math.round((Date.now()-execStart)/1000)}s — retornando ${approved.length} resultados parciais (${total} analisados de ${toAnalyze.length})`)
        timedOut=true
        break
      }
      const batch=toAnalyze.slice(i,i+BATCH)
      const results=await Promise.allSettled(batch.map(g=>analyzeGame(g,sb,apiKey,include_corners,include_cards,oddsKey)))
      for(let j=0;j<results.length;j++) {
        total++
        const r=results[j], g=batch[j]
        if(r.status==='fulfilled'&&r.value?.verdict?.startsWith('APROVADO')) {
          const rec=r.value; if(g.simulated_odds) rec.simulated_odds=true
          approved.push({analysis_id:rec.analysis_id, match:{home_team:g.home_team,away_team:g.away_team,commence_time:g.commence_time,league:g.sport_title||'Unknown'},recommendation:rec})
        } else if(r.status==='rejected') console.error(`[Mycroft Punter] Erro: ${g.home_team} vs ${g.away_team}:`,r.reason)
      }
      if(i+BATCH<toAnalyze.length&&!isTimedOut()) await wait(BATCH_COOLDOWN_MS)
    }

    // DEDUPLICATION: Keep only the highest-score entry per match (composite: prob × edge × confidence)
    const calcScore = (rec: any) => (rec.estimated_probability || 0) * (rec.value_percentage || rec.edge_percentage || 0) * (rec.confidence || 0)
    const matchBestMap = new Map<string, number>()
    for(let i=0;i<approved.length;i++) {
      const m=approved[i].match, key=`${m.home_team}__${m.away_team}`
      const score=calcScore(approved[i].recommendation)
      if(!matchBestMap.has(key)||score>calcScore(approved[matchBestMap.get(key)!].recommendation)) matchBestMap.set(key,i)
    }
    const dedupApproved = [...matchBestMap.values()].map(i=>approved[i])
    if(dedupApproved.length<approved.length) {
      const removed=approved.length-dedupApproved.length
      console.log(`[Mycroft Punter] 🔄 Dedup: removidos ${removed} sinais conflitantes (1 mercado por jogo, score composto)`)
      // Remove duplicates from DB too
      for(let i=0;i<approved.length;i++) {
        const key=`${approved[i].match.home_team}__${approved[i].match.away_team}`
        if(matchBestMap.get(key)!==i) {
          const mid=`${approved[i].match.home_team}_${approved[i].match.away_team}_${approved[i].match.commence_time}`.replace(/\s+/g,'_').replace(/\+00:00/g,'Z')
          const mkt=approved[i].recommendation.market
          await sb.from('punter_signals').delete().eq('match_id',mid).eq('market',mkt)
          await sb.from('punter_analyses').delete().eq('match_id',mid).eq('market',mkt)
          console.log(`[Mycroft Punter] 🗑️ Removido sinal conflitante: ${approved[i].match.home_team} vs ${approved[i].match.away_team} (${mkt}) — score inferior`)
        }
      }
    }

    const execTime = Math.round((Date.now()-execStart)/1000)
    console.log(`[Mycroft Punter] Análise ${timedOut?'parcial':'completa'} em ${execTime}s: ${dedupApproved.length}/${total} aprovados (${skippedCount} já apostados, ${approved.length-dedupApproved.length} conflitos removidos${timedOut?`, ${toAnalyze.length-total} pendentes`:''})`)
    return new Response(JSON.stringify({success:true,signals:dedupApproved,total_analyzed:total,total_approved:dedupApproved.length,skipped_existing:skippedCount,conflicts_removed:approved.length-dedupApproved.length,leagues_scanned:leagues.length,ai_provider:'gemini',timed_out:timedOut,remaining_games:timedOut?toAnalyze.length-total:0,execution_time_s:execTime,timestamp:new Date().toISOString()}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
  } catch(e:any) {
    console.error('[Mycroft Punter] ERRO:',e)
    return new Response(JSON.stringify({success:false,error:e.message}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}})
  }
})
