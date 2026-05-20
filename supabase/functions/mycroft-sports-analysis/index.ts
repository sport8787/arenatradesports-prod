import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";
import { startEdgeRun } from "../_shared/edgeRunLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MatchData {
  home: string; away: string; scoreHome: number; scoreAway: number;
  minute: number; period: string; championship: string; match_id?: string;
  stats?: {
    attacks_home?: number; attacks_away?: number;
    dangerous_attacks_home?: number; dangerous_attacks_away?: number;
    xG_home?: number; xG_away?: number;
    possession_home?: number; possession_away?: number;
    shots_home?: number; shots_away?: number;
    shots_total_home?: number; shots_total_away?: number;
    shots_on_target_home?: number; shots_on_target_away?: number;
  };
  bankroll?: number;
  under_odd?: number;
  over_odd?: number;
  odds?: { home?: number; draw?: number; away?: number };
}

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// === Real odds fetcher (busca odds reais no cache populado pela The Odds API) ===
function normalizeTeam(s: string): string {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ec|ac|club|cd|afc|sport club|futebol clube|de|do|da|cidade)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function teamsMatch(a1: string, a2: string, b1: string, b2: string): boolean {
  const n = (s: string) => normalizeTeam(s);
  const [na1, na2, nb1, nb2] = [n(a1), n(a2), n(b1), n(b2)];
  const partial = (x: string, y: string) => {
    if (!x || !y) return false;
    if (x === y) return true;
    const xt = x.split(' ').filter(t => t.length >= 4);
    const yt = y.split(' ').filter(t => t.length >= 4);
    return xt.some(t => y.includes(t)) || yt.some(t => x.includes(t));
  };
  return (partial(na1, nb1) && partial(na2, nb2)) || (partial(na1, nb2) && partial(na2, nb1));
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function enrichMatchWithRealOdds(match: MatchData): Promise<void> {
  try {
    const supa = getSupabaseAdmin();
    const { data } = await supa
      .from('cached_odds_games')
      .select('home_team, away_team, bookmakers, simulated_odds')
      .eq('simulated_odds', false)
      .gt('expires_at', new Date().toISOString())
      .limit(500);
    if (!data?.length) return;

    const game = data.find((g: any) => teamsMatch(match.home, match.away, g.home_team, g.away_team));
    if (!game) return;

    const flipped = !teamsMatch(match.home, match.home, game.home_team, game.home_team);
    const homeOdds: number[] = [], drawOdds: number[] = [], awayOdds: number[] = [];
    const overOdds: number[] = [], underOdds: number[] = [];

    for (const bk of (game.bookmakers || [])) {
      for (const mk of (bk.markets || [])) {
        if (mk.key === 'h2h') {
          for (const o of (mk.outcomes || [])) {
            if (o.name === 'Draw') drawOdds.push(o.price);
            else if (normalizeTeam(o.name) === normalizeTeam(flipped ? game.away_team : game.home_team)) homeOdds.push(o.price);
            else awayOdds.push(o.price);
          }
        } else if (mk.key === 'totals') {
          for (const o of (mk.outcomes || [])) {
            if (o.point === 2.5 && o.name === 'Over') overOdds.push(o.price);
            if (o.point === 2.5 && o.name === 'Under') underOdds.push(o.price);
          }
        }
      }
    }

    const realOdds: any = {};
    if (homeOdds.length) realOdds.home = +median(homeOdds).toFixed(2);
    if (drawOdds.length) realOdds.draw = +median(drawOdds).toFixed(2);
    if (awayOdds.length) realOdds.away = +median(awayOdds).toFixed(2);
    if (Object.keys(realOdds).length) match.odds = realOdds;
    if (overOdds.length) (match as any).over_odd = +median(overOdds).toFixed(2);
    if (underOdds.length) match.under_odd = +median(underOdds).toFixed(2);

    console.log(`[MycroftSports] 💰 Real odds injected for ${match.home} vs ${match.away}: H${realOdds.home || '-'} D${realOdds.draw || '-'} A${realOdds.away || '-'} | Over${(match as any).over_odd || '-'} Under${match.under_odd || '-'}`);
  } catch (e) {
    console.warn('[MycroftSports] enrichMatchWithRealOdds error:', (e as Error).message);
  }
}

function statsAreEmpty(stats: MatchData['stats']): boolean {
  if (!stats) return true;
  return [stats.attacks_home, stats.attacks_away, stats.dangerous_attacks_home, stats.dangerous_attacks_away,
    stats.possession_home, stats.possession_away, stats.shots_home, stats.shots_away,
    stats.shots_total_home, stats.shots_total_away].every(v => !v || v === 0);
}

function findStat(stats: any[], type: string): string | null {
  return stats.find((s: any) => s.type === type)?.value ?? null;
}

async function fetchStatsFromApiFootball(fixtureId: string): Promise<MatchData['stats'] | null> {
  // force_provider (vindo no body da request) tem prioridade absoluta sobre a env LIVE_PROVIDER_PRIMARY.
  // Usado pelo modo SHADOW (analyze-live-shadow-af) para forçar AF e comparar com Sportmonks.
  const forced = (globalThis as any).__forceProvider as string | undefined;
  const primary = (forced || Deno.env.get("LIVE_PROVIDER_PRIMARY") || "api-football").toLowerCase();
  if (primary === "sportmonks") {
    try {
      const { getFixtureStats } = await import("../_shared/liveProvider.ts");
      const r = await getFixtureStats(fixtureId);
      if (r.stats) {
        return {
          attacks_home: r.stats.attacks_home,
          attacks_away: r.stats.attacks_away,
          dangerous_attacks_home: r.stats.attacks_home,
          dangerous_attacks_away: r.stats.attacks_away,
          possession_home: r.stats.possession_home,
          possession_away: r.stats.possession_away,
          shots_home: r.stats.shots_on_target_home,
          shots_away: r.stats.shots_on_target_away,
          shots_total_home: r.stats.shots_total_home,
          shots_total_away: r.stats.shots_total_away,
          shots_on_target_home: r.stats.shots_on_target_home,
          shots_on_target_away: r.stats.shots_on_target_away,
          xG_home: r.stats.xG_home ?? 0,
          xG_away: r.stats.xG_away ?? 0,
        };
      }
    } catch (e) {
      console.warn(`[mycroft-sports] sportmonks stats fail for ${fixtureId}: ${(e as Error).message} — fallback AF`);
    }
  }
  // API-Football removida em Fase 2 (18/05/2026). Stats vêm exclusivamente do Sportmonks acima.
  console.warn(`[mycroft-sports] sportmonks stats indisponíveis para ${fixtureId} — retornando null (AF descontinuada)`);
  return null;
}

async function loadMemoryRules(): Promise<string> {
  try {
    const { data } = await getSupabaseAdmin().from("mycroft_memory")
      .select("rule_text, category, priority").eq("is_active", true)
      .or("context.cs.{sports},context.cs.{analyst}")
      .order("priority", { ascending: false }).limit(20);
    if (!data?.length) return "";
    return `\n═══ MEMÓRIA PERSISTENTE (${data.length} regras) ═══\n${data.map((m: any, i: number) => `${i+1}. [${m.category}|P${m.priority}] ${m.rule_text}`).join("\n")}\n═══════════════════════════════════════\n`;
  } catch { return ""; }
}

async function loadPlanos(): Promise<any[]> {
  const { data, error } = await getSupabaseAdmin().from("mycroft_planos")
    .select("*").eq("ativo", true).order("codigo");
  if (error || !data?.length) { console.error("[MycroftSports] Failed to load planos:", error); return []; }
  console.log(`[MycroftSports] 📋 ${data.length} planos ativos carregados`);
  return data;
}

// Prompt base hardcoded — nunca muda sem deploy
// VERSÃO COMPACTA (11/05/2026): reduzida de ~5k para ~2k chars para cortar custo Gemini.
// Conteúdo verboso (transições, exemplos, dissertações) foi removido — regras essenciais
// permanecem. As regras situacionais S1-S4 viram referência curta; planos vêm da matriz.
const MYCROFT_TRADER_BASE = `
# ORÁCULO MYCROFT — TRADER ESPORTIVO AO VIVO

Analista de trading com win rate de 68%. Aprovar 30-40% dos jogos. Análise contínua, jamais "VETADO".

## REGRAS INVIOLÁVEIS
- Análise SIMÉTRICA casa/fora: dominante = quem performa melhor agora (xG, finalizações, posse, big chances). Mandante é ruído.
- PADRÕES > intuição. Dados > emoção. Assimetria estatística = oportunidade.
- Nomear PLANO só com 100% dos critérios. Senão plan_name: null.
- PROIBIDO inventar plano fora da matriz.

## STATUS PERMITIDOS (escolha 1)
APROVADO | APROVADO_SITUACIONAL | LABAREDA | CUIDADO | JOGO_MORTO | AGUARDAR

Regras de status:
- JOGO_MORTO só após min 20 E (0-0 sem chutes OU diferença ≥3 gols sem reação). Caso contrário use CUIDADO/AGUARDAR.
- LABAREDA: time perdendo por 1 gol após min 65 + xG≥0.8 OU odds≥2.5 OU 3+ escanteios recentes.
- CUIDADO: jogo com potencial mas com fator de risco (expulsão, steam contra, jogo truncado).

## GESTÃO DE RISCO
Stake: ALTO 2-3% | MÉDIO 3-4% | BAIXO 4-5%. R:R mínimo 1:1.5. Exposição máx 15%.

## QUALIDADE SOBRE QUANTIDADE (REGRA CRÍTICA)
Um único sinal forte por jogo é o PADRÃO. ROI cai quando se aprovam vários mercados no mesmo jogo. Só emita mercado adicional se ele for ESTATISTICAMENTE INDEPENDENTE do principal.

### Mercados correlacionados (NUNCA aprovar juntos no mesmo momento)
- Over 1.5 + Over 2.5 (mesmo escalonamento). Over 2.5 só após Over 1.5 já ter batido.
- Over 0.5 HT + Over 1.5 FT (sequenciais — esperar HT bater).
- Back dominante + Over X.5 com mesmo dominante marcando (dupla exposição na mesma tese).
- BTTS + Over 2.5 quando a tese é o mesmo gol esperado.

### Quando PODE haver mais de um sinal
- Mercados verdadeiramente desacoplados (ex.: Under 2.5 FT + escanteios) e o principal já está em GREEN parcial.
- Over 2.5 DIRETO (sem Over 1.5 antes) só com pressão real de AMBOS os times: xG total ≥1.5, ≥6 SOT combinados, big chances criadas, defesas do goleiro, posse equilibrada com finalização.

### Sinais OPOSTOS (alerta de fechamento)
- Se principal foi Under 2.5 e depois você aprova Over 0.5 HT / Over 1.5 FT / BTTS no mesmo jogo, isso indica VIRADA — sinalize em "alerts" que o usuário deve FECHAR o Under 2.5.

## REGRA DE TEMPO (70')
NUNCA aprovar sinal novo após o minuto 70, exceto LABAREDA. Após 70', use CUIDADO ou AGUARDAR.

## PRIORIDADE DE APROVAÇÃO (ordem)
1. Back dominante claro com pressão real (xG, SOT, big chances, posse com finalização).
2. Over 1.5 com jogo 0-0 e critérios fortes de gol iminente.
3. Under 2.5 no 1º tempo com jogo travado.
4. Over 2.5 só com pressão bilateral confirmada.

## LAY AO GOLEADO (regra de inversão)
Se o time dominante LEVA o gol contra a corrida do jogo, prefira LAY ao time que marcou (em vez de insistir no Back dominante) — geralmente o dominante ainda terá chances mas o marcador surpresa raramente sustenta vantagem.

## MÚLTIPLOS MERCADOS POR JOGO
Em "additional_markets" retorne NO MÁXIMO 1 mercado, com conf≥75%, stake máx 2%, NÃO correlacionado ao principal (ver lista acima), nunca oposto, nunca após min 70'. Quando em dúvida, devolva array vazio.

## MÓDULO SITUACIONAL (override quando JOGO_MORTO por dados insuficientes)
S1 PRESSÃO PRÉ-GOL: min 5-35, placar 0-0/1-0, xG dom≥0.4 ou 2+ SOT, posse dom≥58%, adversário sem SOT → Over 0.5 HT / Over 1.5 / Back dom (2%, conf≥75%)
S2 PLACAR EXPRESSIVO ABERTO: min 20-60, placar ≥2-0/≥3-1, xG total≥2.0, perdedor posse≥40% → Over próximo gol / Over 3.5 / Back vencedor (2%, conf≥75%)
S3 MATA-MATA OBRIGAÇÃO: eliminatória, time perdendo agregado, dif 1-2 → Over próximo / Back obrigado / Over 2.5 (3% se dif=1, 2% se dif=2, conf≥75%)
S4 ESCANTEIOS PRESSÃO: min 10-40, ≥4 escanteios e ≤1 gol, xG≥0.6 sem gol → Over X escanteios / Over 0.5 HT (2%, conf≥75%)
Anti-abuso: máx 1 situacional/partida, nunca após min 70.
`;


// Normaliza criterios/vetos vindos do banco (jsonb pode ser array, object {1:"...",2:"..."}, string ou null)
function toStringArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).filter(Boolean);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return toStringArray(parsed);
    } catch {
      return input.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
    }
  }
  if (typeof input === 'object') {
    // Suporta {1: "...", 2: "..."} ou {a: "...", b: "..."}
    return Object.values(input as Record<string, unknown>)
      .map(v => (typeof v === 'string' ? v : JSON.stringify(v)))
      .filter(Boolean);
  }
  return [String(input)];
}

function buildPrompt(match: MatchData, planos: any[], memoryRules: string): string {
  const s: any = match.stats || {};

  // Montar matriz de planos dinamicamente da tabela
  const validPlanNames = planos.map(p => `PLANO ${p.nome.replace('Plano ', '').toUpperCase()}`);

  // Matriz COMPACTA (11/05/2026): 1 linha de cabeçalho + critérios e vetos em linha única
  // Reduz ~70% do tamanho da matriz vs formato verboso anterior.
  const matrizPlanos = planos.map(p => {
    const criteriosArr = toStringArray(p.criterios);
    const vetosArr = toStringArray(p.vetos);
    if ((p.criterios && criteriosArr.length === 0) || (p.vetos && vetosArr.length === 0)) {
      console.warn('[buildPrompt] Plano com criterios/vetos não normalizáveis:', {
        plano_codigo: p.codigo ?? null,
        plano_nome: p.nome ?? null,
        criterios_type: Array.isArray(p.criterios) ? 'array' : typeof p.criterios,
        vetos_type: Array.isArray(p.vetos) ? 'array' : typeof p.vetos,
      });
    }
    const criterios = criteriosArr.join(' | ') || '(sem critérios)';
    const vetos = vetosArr.join(' | ') || '(sem vetos)';
    return `[${p.codigo}] ${p.nome.toUpperCase()} — ${p.mercado} | ${p.janela} | risco ${p.risco}
  CRITÉRIOS (todos): ${criterios}
  VETOS (qualquer): ${vetos}`;
  }).join('\n\n');

  // Guia de diagnóstico rápido
  const guia = `
GUIA DE DIAGNÓSTICO RÁPIDO:
→ Placar 0x0 + minuto >= 82 + 1 time dominando = LABAREDA
→ Placar 0x0 + minuto 40-75 + pressão crescente sem gol = AVALANCHE
→ Placar 0x0 no intervalo + dominante não converteu = ECLIPSE
→ Favorito levou gol em 1-35min = RESSURREIÇÃO
→ Time competitivo levou gol em 50-75min + reagiu = TSUNAMI
→ Time que dominava parou de atacar após marcar = FANTASMA
→ xG combinado alto + ambos atacando = DILÚVIO
→ Nenhum critério bate 100% = ANÁLISE DIRETA (plan_name: null)`;

  return `${MYCROFT_TRADER_BASE}

${memoryRules}

═══════════════════════════════════════
MATRIZ DE PLANOS ESTRATÉGICOS ATIVOS
(${planos.length} planos carregados — fonte: tabela mycroft_planos)
═══════════════════════════════════════

${matrizPlanos}

${guia}

═══════════════════════════════════════
JOGO AO VIVO:
═══════════════════════════════════════
${match.championship}
${match.home} ${match.scoreHome} x ${match.scoreAway} ${match.away}
Minuto: ${match.minute}' | ${match.period}

Posse: ${s.possession_home ?? '?'}% vs ${s.possession_away ?? '?'}%
Ataques Totais: ${s.attacks_home ?? '?'} vs ${s.attacks_away ?? '?'}
Ataques Perigosos: ${s.dangerous_attacks_home ?? s.attacks_home ?? '?'} vs ${s.dangerous_attacks_away ?? s.attacks_away ?? '?'}
Chutes (Total): ${s.shots_total_home ?? s.shots_home ?? '?'} vs ${s.shots_total_away ?? s.shots_away ?? '?'}
Chutes no Gol: ${s.shots_on_target_home ?? s.shots_home ?? '?'} vs ${s.shots_on_target_away ?? s.shots_away ?? '?'}
xG: ${s.xG_home ?? '?'} vs ${s.xG_away ?? '?'}${s.xg_unavailable ? ' ⚠️ INDISPONÍVEL (NÃO É ZERO REAL — fonte de dados não retornou xG desta partida)' : (s.xg_estimated ? ' 🌐 ESTIMADO via Flashscore (sintético — use com peso reduzido)' : '')}
Big Chances (SofaScore): ${s.big_chances_home ?? '?'} vs ${s.big_chances_away ?? '?'}
Chutes na Área: ${s.shots_inside_box_home ?? '?'} vs ${s.shots_inside_box_away ?? '?'}
Momentum (últimos 10min, +home/-away): ${s.momentum?.avg_last_10min != null ? `${s.momentum.avg_last_10min.toFixed(1)} (tendência: ${s.momentum.trend})` : '?'}
${s.xg_unavailable ? '🚨 ATENÇÃO: xG INDISPONÍVEL nesta partida (não significa que é zero — significa que a fonte falhou). NÃO use o critério de xG na análise. Baseie-se em: ataques perigosos, chutes (totais e no gol), posse, big chances e momentum. NÃO mencione "xG zerado" na tese — em vez disso diga "xG não disponível, análise baseada em outros indicadores".' : (s.xg_estimated ? '🌐 xG ESTIMADO via Flashscore (sintético, baseado em chutes). Use como referência, mas reduza confiança em ~10pp e priorize chutes/ataques/posse na tese.' : (s.sofascore_event_id || s.source_enriched === 'sofascore' ? '✅ Dados enriquecidos via SofaScore (xG e Big Chances confiáveis — use-os com peso máximo)' : '⚠️ Apenas API-Football (sem xG SofaScore — seja mais conservador)'))}

Banca do trader: R$ ${match.bankroll ?? 500}
${Array.isArray((match as any).punterPreliveAnalyses) && (match as any).punterPreliveAnalyses.length > 0 ? `
═══════════════════════════════════════
📊 ANÁLISE PRÉ-LIVE DO MYCROFT PUNTER (mesmo jogo, contexto informativo)
═══════════════════════════════════════
${(match as any).punterPreliveAnalyses.map((p: any, i: number) => {
  const prob = p.estimated_probability != null ? ` | prob=${(Number(p.estimated_probability) <= 1 ? Number(p.estimated_probability) * 100 : Number(p.estimated_probability)).toFixed(0)}%` : '';
  const conf = p.confidence != null ? ` | conf=${p.confidence}%` : '';
  const odd = p.odd != null ? ` @ ${Number(p.odd).toFixed(2)}` : '';
  const tese = p.thesis ? `\n   Tese: "${String(p.thesis).slice(0, 280)}"` : '';
  return `${i + 1}. [${p.verdict}] ${p.market}${odd}${conf}${prob}${tese}`;
}).join('\n')}

📌 COMO USAR: Esta é a leitura PRÉ-jogo do Mycroft Punter. Use como CONTEXTO INFORMATIVO:
• Se o Punter aprovou um mercado coerente com sua leitura live → reforça confiança.
• Se o Punter explicitamente AGUARDOU/REPROVOU um mercado que você está prestes a aprovar (ex: Punter disse "ataque pouco produtivo, poucos gols" e você quer Over 2.5) → seja MAIS RIGOROSO. Exija evidência live forte (xG combinado ≥1.2, 3+ chutes no gol, dilúvio claro). Em dúvida, AGUARDAR.
• A leitura ao vivo SEMPRE tem prioridade sobre o pré-live, mas usar o contexto evita Reds previsíveis.
• NÃO mencione "Punter disse X" na tese final ao usuário — apenas use internamente para calibrar.
` : ''}
${Array.isArray((match as any).existingApprovedMarkets) && (match as any).existingApprovedMarkets.length > 0 ? `
═══════════════════════════════════════
🎯 MERCADOS JÁ APROVADOS NESTE JOGO (NÃO REPETIR)
═══════════════════════════════════════
${(match as any).existingApprovedMarkets.map((e: any, i: number) => `${i + 1}. ${e.market} (${e.verdict}${e.minute != null ? ` @ min ${e.minute}` : ''})`).join('\n')}

REGRA OBRIGATÓRIA — MÚLTIPLAS ENTRADAS NO MESMO JOGO:
• NÃO repita nenhum dos mercados acima — eles já foram entregues ao usuário.
• Você PODE e DEVE buscar mercados COMPLEMENTARES se o jogo continua com valor.
  Exemplos:
   - Já tem "Over 0.5 HT" → pode aprovar "Over 1.5 FT", "Over 2.5 FT", "BTTS Sim", "Over 8.5 escanteios FT".
   - Já tem "Over 2.5 FT" → pode aprovar "Over 3.5 FT", "Over 5.5 FT" se houver dilúvio.
   - Já tem "BTTS Sim" → pode aprovar "Over X.5 FT" se a goleada se desenhou.
• NUNCA aprove um mercado CONFLITANTE com algo já aprovado (ex: Under 2.5 se já tem Over 2.5).
• Para aprovar mercado complementar, exija critérios PLENOS (não relaxe). Se não houver, retorne AGUARDAR.
` : ''}
`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const run = startEdgeRun("mycroft-sports-analysis");
  try {
    // === ENGINE DETERMINÍSTICA (sem IA) ===
    // Removida dependência da Gemini API. Toda a análise é feita por regras estatísticas
    // (Under 2.5 Early, Back ao Dominante, Lay ao Vencedor, Situacional S1–S4, LABAREDA).

    const body = await req.json() as { match: MatchData & Record<string, unknown>; force_provider?: string };
    const match = body?.match;
    // Modo SHADOW: força um provider específico de stats (ignora env LIVE_PROVIDER_PRIMARY)
    if (body?.force_provider) {
      (globalThis as any).__forceProvider = String(body.force_provider).toLowerCase();
      console.log(`[MycroftSports] 🔬 SHADOW mode — force_provider=${(globalThis as any).__forceProvider}`);
    } else {
      (globalThis as any).__forceProvider = undefined;
    }
    if (!match) return new Response(JSON.stringify({ error: 'Match data required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Validação estrita: aceitar apenas scoreHome/scoreAway (camelCase). Rejeita score_home/score_away.
    const rawMatch = match as Record<string, unknown>;
    if ('score_home' in rawMatch || 'score_away' in rawMatch) {
      const msg = "Campos inválidos: use 'scoreHome'/'scoreAway' (camelCase). Recebido 'score_home'/'score_away' (snake_case) — formato não suportado.";
      console.error('[MycroftSports] ❌', msg);
      return new Response(JSON.stringify({ error: msg, code: 'INVALID_SCORE_FIELDS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (typeof match.scoreHome !== 'number' || typeof match.scoreAway !== 'number') {
      const msg = "Campos obrigatórios ausentes ou em tipo errado: 'scoreHome' e 'scoreAway' devem ser números.";
      console.error('[MycroftSports] ❌', msg, { scoreHome: match.scoreHome, scoreAway: match.scoreAway });
      return new Response(JSON.stringify({ error: msg, code: 'MISSING_SCORE_FIELDS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[MycroftSports] Analyzing: ${match.home} vs ${match.away} (${match.minute}')`);

    // === CACHE LOOKUP (reduz consumo do Lovable AI Gateway) ===
    // Chave determinística: match_id + minuto + placar + stats principais
    // TTL padrão da tabela. Em jogos parados (mesmas stats), retorna análise cacheada.
    const s0: any = match.stats || {};
    const cacheKey = 'mycroft-sports:' + [
      match.match_id || `${match.home}-${match.away}`,
      `m${match.minute ?? 0}`,
      `s${match.scoreHome ?? 0}-${match.scoreAway ?? 0}`,
      `p${s0.possession_home ?? 0}-${s0.possession_away ?? 0}`,
      `sh${s0.shots_total_home ?? s0.shots_home ?? 0}-${s0.shots_total_away ?? s0.shots_away ?? 0}`,
      `sg${s0.shots_on_target_home ?? 0}-${s0.shots_on_target_away ?? 0}`,
      `da${s0.dangerous_attacks_home ?? 0}-${s0.dangerous_attacks_away ?? 0}`,
    ].join('|');

    const supabaseAdminCache = getSupabaseAdmin();
    try {
      const { data: cached } = await supabaseAdminCache
        .from('ai_response_cache')
        .select('response_json, hit_count')
        .eq('function_name', 'mycroft-sports-analysis')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached?.response_json) {
        await supabaseAdminCache
          .from('ai_response_cache')
          .update({ hit_count: (cached.hit_count || 0) + 1 })
          .eq('function_name', 'mycroft-sports-analysis')
          .eq('cache_key', cacheKey);
        console.log(`[MycroftSports] 💾 Cache HIT (key=${cacheKey.substring(0, 60)}...)`);
        return new Response(JSON.stringify(cached.response_json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.warn('[MycroftSports] Cache lookup failed:', (e as Error).message);
    }

    // If stats empty, try API-Football
    if (statsAreEmpty(match.stats) && match.match_id) {
      const liveStats = await fetchStatsFromApiFootball(match.match_id);
      if (liveStats && !statsAreEmpty(liveStats)) {
        match.stats = liveStats;
        try { await getSupabaseAdmin().from('live_matches').update({ stats: liveStats, updated_at: new Date().toISOString() }).eq('match_id', match.match_id); } catch {}
      }
    }

    // Inject real market odds (h2h + over/under 2.5) from cached_odds_games
    if (!match.odds || !match.odds.home) {
      await enrichMatchWithRealOdds(match);
    }

    // ====================================================================
    // BASELINE DETERMINÍSTICA (sem IA)
    // ====================================================================
    // Calcula um veredito inicial a partir de regras estatísticas puras.
    // Os blocos override mais abaixo (UNDER 2.5 EARLY, BACK AO DOMINANTE,
    // LAY AO VENCEDOR, SITUACIONAL S1–S4) podem promover esta baseline
    // para APROVADO / APROVADO_SITUACIONAL / LABAREDA conforme critérios.
    // ====================================================================
    const _bs: any = match.stats || {};
    const _bMin = match.minute ?? 0;
    const _bScoreH = match.scoreHome ?? 0;
    const _bScoreA = match.scoreAway ?? 0;
    const _bTotalGoals = _bScoreH + _bScoreA;
    const _bDiff = Math.abs(_bScoreH - _bScoreA);
    const _bPossH = _bs.possession_home ?? 0;
    const _bPossA = _bs.possession_away ?? 0;
    const _bShotsTH = _bs.shots_total_home ?? _bs.shots_home ?? 0;
    const _bShotsTA = _bs.shots_total_away ?? _bs.shots_away ?? 0;
    const _bSotH = _bs.shots_on_target_home ?? 0;
    const _bSotA = _bs.shots_on_target_away ?? 0;
    const _bDangH = _bs.dangerous_attacks_home ?? _bs.attacks_home ?? 0;
    const _bDangA = _bs.dangerous_attacks_away ?? _bs.attacks_away ?? 0;
    const _bXgH = _bs.xG_home ?? _bs.xg_home ?? 0;
    const _bXgA = _bs.xG_away ?? _bs.xg_away ?? 0;
    const _bXgTotal = _bXgH + _bXgA;
    const _bSotTotal = _bSotH + _bSotA;
    const _bDangTotal = _bDangH + _bDangA;
    const _bShotsTotal = _bShotsTH + _bShotsTA;

    const statsEmpty = statsAreEmpty(match.stats);

    // Detecção de LABAREDA determinística (potencial de gol tardio / virada)
    let baselineVerdict: string = 'CUIDADO';
    let baselineThesis = '';
    let baselineMarket = 'N/A';
    let baselineConfidence = 55;
    let baselinePlanName: string | null = null;

    if (statsEmpty) {
      baselineVerdict = 'AGUARDAR';
      baselineThesis = 'Estatísticas indisponíveis no momento — aguardando próximo ciclo de dados.';
      baselineMarket = 'N/A';
      baselineConfidence = 50;
    } else if (_bMin >= 20 && _bTotalGoals === 0 && _bShotsTotal <= 2 && _bDangTotal <= 4 && _bXgTotal <= 0.3) {
      // Jogo morto clássico: 20'+ sem gol, sem volume ofensivo
      baselineVerdict = 'JOGO_MORTO';
      baselineThesis = `Jogo travado (min ${_bMin}, ${_bShotsTotal} finalizações totais, xG ${_bXgTotal.toFixed(2)}). Sem oportunidade clara agora.`;
      baselineConfidence = 60;
    } else if (_bMin >= 60 && _bDiff === 1 && _bXgTotal >= 0.8) {
      // LABAREDA: jogo apertado em fase final com xG vivo
      const perdedor = _bScoreH < _bScoreA ? match.home : match.away;
      baselineVerdict = 'LABAREDA';
      baselineMarket = 'Over 0.5 Próximo Gol';
      baselineConfidence = 68;
      baselineThesis = `🔥 LABAREDA: min ${_bMin}, ${perdedor} perdendo por 1, xG total ${_bXgTotal.toFixed(2)}. Potencial de gol tardio.`;
    } else if (_bMin >= 25 && _bDiff >= 3) {
      // Jogo decidido sem reação
      baselineVerdict = 'JOGO_MORTO';
      baselineThesis = `Placar ${_bScoreH}x${_bScoreA} com diferença ≥3 — jogo decidido, sem mercado claro.`;
      baselineConfidence = 60;
    } else {
      // Caso geral: marca como CUIDADO; será promovido pelos overrides se critérios baterem
      baselineVerdict = 'CUIDADO';
      baselineThesis = `Análise determinística: ${match.home} ${_bScoreH}x${_bScoreA} ${match.away} (min ${_bMin}). Posse ${_bPossH}%/${_bPossA}%, finalizações ${_bShotsTH}/${_bShotsTA}, xG ${_bXgH.toFixed(2)}/${_bXgA.toFixed(2)}. Sem padrão dominante claro.`;
      baselineConfidence = 55;
    }

    const analysis: any = {
      verdict: baselineVerdict,
      plan_name: baselinePlanName,
      market: baselineMarket,
      odd: 0,
      confidence: baselineConfidence,
      thesis: baselineThesis,
      criterios_atendidos: [],
      criterios_ausentes: [],
      fundamentation: { source: 'engine-deterministica', pattern: baselineVerdict, historical_wr: 'n/a' },
      risk_management: { stake_percent: 0, entry: 'N/A', stop: 'N/A', target: 'N/A', rr: 'N/A', ev: 'N/A' },
      alerts: ['Análise 100% determinística (sem IA).'],
      ai_engine: 'deterministic-v1',
    };

    console.log(`[MycroftSports] 🧮 Baseline determinística: ${analysis.verdict} (${match.home} vs ${match.away}, min ${_bMin})`);

    // === GUARD TEMPORAL UNDER 2.5 ===
    // Janela válida: 1º tempo, do minuto 10 até o minuto 20.
    // Antes dos 10 min: jogo ainda está se acomodando (viés confirmatório).
    // Depois dos 20 min ou no 2º tempo: o EV do Under 2.5 cai e a odd não compensa.
    {
      const _uMin = match.minute ?? 0;
      const _uPeriod = String((match as any).period || '').toUpperCase();
      const _isSecondHalfOrLater =
        _uMin > 45 ||
        _uPeriod.includes('SECOND') || _uPeriod.includes('2H') || _uPeriod === 'HT' ||
        _uPeriod.includes('HALF_TIME') || _uPeriod.includes('HALFTIME') ||
        _uPeriod.includes('EXTRA') || _uPeriod === 'FT' || _uPeriod.includes('FULL_TIME');
      const _outOfWindow = _uMin < 10 || _uMin > 20 || _isSecondHalfOrLater;
      if (
        analysis.verdict === 'APROVADO' &&
        typeof analysis.market === 'string' &&
        /under\s*2\.?5/i.test(analysis.market) &&
        _outOfWindow
      ) {
      const motivoVeto = `Under 2.5 fora da janela permitida (min ${_uMin}, period=${_uPeriod || 'n/d'}). Só é aprovado entre minuto 10 e 20 do 1º tempo.`;
      console.warn(`[MycroftSports] 🛑 VETO TEMPORAL: ${motivoVeto}`);
      try {
        await getSupabaseAdmin().from("mycroft_vetoed_log").insert({
          jogo: `${match.home} vs ${match.away}`,
          liga: match.championship,
          mercado: analysis.market,
          odd: analysis.odd,
          confianca_recebida: analysis.confidence,
          verdict_gemini: 'APROVADO_PREMATURO',
          motivo_veto: motivoVeto,
          raw_response: analysis,
        });
      } catch (e) { console.warn('[MycroftSports] Falha log veto temporal:', e); }
      analysis.verdict = 'AGUARDAR';
      analysis.plan_name = null;
      analysis.alerts = [...(analysis.alerts || []), `⏱️ Under 2.5 só pode ser aprovado entre o minuto 10 e o minuto 20 do 1º tempo.`];
      }
    }

    // === VETO GLOBAL: BACK FAVORITO COM VALOR ===
    // Bloqueia entradas back-favorito quando:
    //  (a) Odd do favorito caiu abaixo de 1.40 após gol do favorito (snapshot prévio)
    //  (b) Placar incompatível com a odd implícita (ex.: odd <1.40 mas favorito não está vencendo / time errado vencendo)
    try {
      const isBackFavMarket =
        analysis?.verdict &&
        ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'].includes(analysis.verdict) &&
        typeof analysis.market === 'string' &&
        /(back\s*favorit|match\s*odds.*back|favorit.*back)/i.test(analysis.market);

      if (isBackFavMarket) {
        const oddNow = Number(analysis.odd) || 0;
        const homeOdd = Number(match.odds?.home) || null;
        const awayOdd = Number(match.odds?.away) || null;
        const sh = Number(match.scoreHome ?? 0);
        const sa = Number(match.scoreAway ?? 0);

        // Identifica favorito atual pela menor odd disponível (h2h)
        let favSide: 'home' | 'away' | null = null;
        if (homeOdd && awayOdd) favSide = homeOdd <= awayOdd ? 'home' : 'away';
        else if (/back\s+([^@]+)/i.test(analysis.market)) {
          const m = analysis.market.match(/back\s+([^@—\-|]+)/i);
          const target = (m?.[1] || '').trim().toLowerCase();
          if (target && match.home && target.includes(match.home.toLowerCase().slice(0, 4))) favSide = 'home';
          else if (target && match.away && target.includes(match.away.toLowerCase().slice(0, 4))) favSide = 'away';
        }

        const favScore = favSide === 'home' ? sh : favSide === 'away' ? sa : null;
        const advScore = favSide === 'home' ? sa : favSide === 'away' ? sh : null;

        // (a) Snapshot: pegar última análise do mesmo match_id para detectar gol do favorito desde então
        const { data: prevAnalyses } = await getSupabaseAdmin()
          .from('mycroft_analyses')
          .select('final_score_home, final_score_away, fundamentation, created_at')
          .eq('match_id', match.match_id)
          .order('created_at', { ascending: false })
          .limit(1);

        const prev = prevAnalyses?.[0] as any;
        const prevSh = Number(prev?.fundamentation?.snapshot_score_home ?? prev?.final_score_home ?? sh);
        const prevSa = Number(prev?.fundamentation?.snapshot_score_away ?? prev?.final_score_away ?? sa);
        const favGoalSinceLast =
          favSide === 'home'
            ? sh > prevSh
            : favSide === 'away'
              ? sa > prevSa
              : false;

         let vetoReason: string | null = null;

        // (c) VETO TEMPORAL: Back favorito só é válido durante o 1º tempo (até min 45).
        // Após o intervalo / 2º tempo / minuto 45+, a tese de "favorito ainda tem tempo para resolver"
        // perde força e a entrada vira armadilha de odd baixa.
        const curMin = Number(match.minute ?? 0);
        const curPeriod = String(match.period || '').toLowerCase();
        const isSecondHalfOrLater =
          curPeriod.includes('second') ||
          curPeriod.includes('2nd') ||
          curPeriod.includes('2t') ||
          curPeriod.includes('ht') ||
          curPeriod.includes('intervalo') ||
          curPeriod.includes('half') && curPeriod.includes('time'); // halftime
        if (curMin >= 45 || isSecondHalfOrLater) {
          vetoReason = `Back favorito vetado: janela temporal expirada (min ${curMin}, período "${match.period || 'n/a'}"). Entrada só é válida no 1º tempo até o minuto 45.`;
        }

        if (!vetoReason && favGoalSinceLast && oddNow > 0 && oddNow < 1.40) {
          vetoReason = `Back favorito vetado: favorito marcou (snapshot ${prevSh}-${prevSa} → ${sh}-${sa}) e odd caiu para ${oddNow} (<1.40).`;
        } else if (!vetoReason && oddNow > 0 && oddNow < 1.40) {
          // (b) Sanity: odd <1.40 só faz sentido se favorito está vencendo claramente
          if (favScore !== null && advScore !== null && favScore <= advScore) {
            vetoReason = `Back favorito vetado: odd ${oddNow} (<1.40) incompatível com placar (favorito ${favScore} x ${advScore} adversário).`;
          }
        }

        if (vetoReason) {
          console.warn(`[MycroftSports] 🛑 ${vetoReason}`);
          try {
            await getSupabaseAdmin().from('mycroft_vetoed_log').insert({
              jogo: `${match.home} vs ${match.away}`,
              liga: match.championship,
              mercado: analysis.market,
              odd: analysis.odd,
              confianca_recebida: analysis.confidence,
              verdict_gemini: 'BACK_FAV_VETO',
              motivo_veto: vetoReason,
              raw_response: analysis,
            });
          } catch (_) { /* best-effort */ }
          analysis.verdict = 'AGUARDAR';
          analysis.plan_name = null;
          analysis.alerts = [...(analysis.alerts || []), `🚫 ${vetoReason}`];
        }
      }
    } catch (e) {
      console.warn('[MycroftSports] Falha no validador Back Favorito:', e);
    }

    // === VALIDADOR PÓS-IA ===
    // Se aprovou com plano, verificar consistência com a tabela
    if (analysis.verdict === 'APROVADO' && analysis.plan_name) {
      const planCode = analysis.plan_name.replace('PLANO ', '').toUpperCase();
      const plano = planos.find(p => p.codigo === planCode || p.nome.toUpperCase().includes(planCode));

      if (!plano) {
        console.warn(`[MycroftSports] VETO: plano ${analysis.plan_name} não existe na tabela`);
        await getSupabaseAdmin().from("mycroft_vetoed_log").insert({
          jogo: `${match.home} vs ${match.away}`,
          liga: match.championship,
          mercado: analysis.market,
          odd: analysis.odd,
          confianca_recebida: analysis.confidence,
          verdict_gemini: analysis.verdict,
          motivo_veto: `Plano inválido: ${analysis.plan_name}`,
          raw_response: analysis,
        });
        analysis.verdict = 'JOGO_MORTO';
        analysis.alerts = [...(analysis.alerts || []), `Plano ${analysis.plan_name} não encontrado na base`];
        analysis.plan_name = null;
      } else if (analysis.criterios_ausentes?.length > 0) {
        // Classificar critérios ausentes:
        // - "dado não fornecido", "não disponível", "sem dados", "não informado" = falta de dados históricos (recuperável)
        // - "jogos insuficientes", "sem jogos", "temporada insuficiente", "amostra insuficiente" = estruturalmente inexistente (veto)
        const STRUCTURAL_KEYWORDS = ['jogos insuficientes', 'sem jogos', 'temporada insuficiente', 'amostra insuficiente', 'sem histórico na temporada', 'menos de', 'poucos jogos'];
        const DATA_GAP_KEYWORDS = ['dado não fornecido', 'não disponível', 'sem dados', 'não informado', 'dado não', 'não fornecid', 'indisponível'];

        const structuralMissing: string[] = [];
        const dataGapMissing: string[] = [];

        for (const criterio of analysis.criterios_ausentes) {
          const lower = criterio.toLowerCase();
          if (STRUCTURAL_KEYWORDS.some(kw => lower.includes(kw))) {
            structuralMissing.push(criterio);
          } else {
            dataGapMissing.push(criterio);
          }
        }

        if (structuralMissing.length > 0) {
          // Caso 2: Dados estruturalmente inexistentes → VETO firme
          console.warn(`[MycroftSports] VETO: ${analysis.plan_name} com critérios estruturalmente ausentes: ${structuralMissing.join(', ')}`);
          await getSupabaseAdmin().from("mycroft_vetoed_log").insert({
            jogo: `${match.home} vs ${match.away}`,
            liga: match.championship,
            mercado: analysis.market,
            odd: analysis.odd,
            confianca_recebida: analysis.confidence,
            verdict_gemini: 'APROVADO_INCONSISTENTE',
            motivo_veto: `Critérios estruturalmente ausentes para ${planCode}: ${structuralMissing.join(', ')}`,
            raw_response: analysis,
          });
          analysis.verdict = 'JOGO_MORTO';
          analysis.alerts = [...(analysis.alerts || []), `Plano ${planCode}: dados históricos insuficientes — ${structuralMissing.join(', ')}`];
        } else if (dataGapMissing.length > 0) {
          // Caso 1: Falta de dados históricos (API não forneceu) → Penalizar confiança, não vetar automaticamente
          // Penalidade calibrada: 8pp por critério ausente, máximo 24pp. Evita derrubar sinais sólidos por gaps menores da API.
          const originalConfidence = analysis.confidence;
          const penalty = Math.min(24, 8 * dataGapMissing.length);
          analysis.confidence = Math.max(0, analysis.confidence - penalty);

          console.log(`[MycroftSports] ⚠️ ${analysis.plan_name}: ${dataGapMissing.length} critério(s) com dados não fornecidos. Confiança ${originalConfidence}% → ${analysis.confidence}% (-${penalty}pp)`);

          // Limiar pós-penalidade: 60% (antes 65%). Plano com fundamento mantém validade mesmo com leve incerteza histórica.
          if (analysis.confidence >= 60) {
            analysis.alerts = [...(analysis.alerts || []),
              `Plano ${planCode}: ${dataGapMissing.length} critério(s) sem dados da API — confiança reduzida de ${originalConfidence}% para ${analysis.confidence}%`,
              ...dataGapMissing.map(c => `⚠️ Critério sem dado: ${c}`),
            ];
            console.log(`[MycroftSports] ✅ ${analysis.plan_name} APROVADO com penalidade (conf ${analysis.confidence}% ≥ 60%)`);
          } else {
            console.warn(`[MycroftSports] VETO: ${analysis.plan_name} — confiança pós-penalidade ${analysis.confidence}% < 60%`);
            await getSupabaseAdmin().from("mycroft_vetoed_log").insert({
              jogo: `${match.home} vs ${match.away}`,
              liga: match.championship,
              mercado: analysis.market,
              odd: analysis.odd,
              confianca_recebida: originalConfidence,
              edge_recebido: analysis.confidence,
              verdict_gemini: 'APROVADO_PENALIZADO',
              motivo_veto: `Confiança pós-penalidade ${analysis.confidence}% < 60% (original: ${originalConfidence}%, -${penalty}pp por dados ausentes)`,
              raw_response: analysis,
            });
            analysis.verdict = 'JOGO_MORTO';
            analysis.alerts = [...(analysis.alerts || []),
              `Plano ${planCode}: confiança ${originalConfidence}% → ${analysis.confidence}% após penalidade por dados ausentes (limiar 60%)`,
            ];
          }
        }
      }
    }

    // === PROMOÇÃO CUIDADO → APROVADO_SITUACIONAL ===
    // CUIDADO com fundamento sólido (confiança ≥ 75% e mercado definido) vira sinal ativo
    // com stake conservador (2%). Limiar elevado de 65% → 75% para reduzir volume e elevar ROI.
    if (
      analysis.verdict === 'CUIDADO' &&
      typeof analysis.confidence === 'number' &&
      analysis.confidence >= 75 &&
      typeof analysis.market === 'string' &&
      analysis.market.length > 0 &&
      analysis.market !== 'N/A'
    ) {
      console.log(`[MycroftSports] 🔼 Promovendo CUIDADO → APROVADO_SITUACIONAL: ${match.home} vs ${match.away} (${analysis.market} @ ${analysis.odd}, conf ${analysis.confidence}%)`);
      analysis.verdict = 'APROVADO_SITUACIONAL';
      if (analysis.risk_management) {
        analysis.risk_management.stake_percent = Math.min(2, analysis.risk_management.stake_percent ?? 2);
      }
      analysis.alerts = [...(analysis.alerts || []),
        `🔼 Promovido de CUIDADO para APROVADO_SITUACIONAL — stake reduzido a 2% (limiar 75%).`,
      ];
    }

    // === PLANO UNDER 2.5 EARLY (override server-side) ===
    // Aprova/cancela Under 2.5 quando jogo está parado nos primeiros minutos.
    {
      const u_s: any = match.stats || {};
      const u_min = match.minute ?? 0;
      const u_scoreH = match.scoreHome ?? 0;
      const u_scoreA = match.scoreAway ?? 0;
      const u_totalGoals = u_scoreH + u_scoreA;
      const u_dangerousTotal = (u_s.dangerous_attacks_home ?? u_s.attacks_home ?? 0) + (u_s.dangerous_attacks_away ?? u_s.attacks_away ?? 0);
      const u_sotTotal = (u_s.shots_on_target_home ?? 0) + (u_s.shots_on_target_away ?? 0);
      const u_xgTotal = (u_s.xG_home ?? u_s.xg_home ?? 0) + (u_s.xG_away ?? u_s.xg_away ?? 0);
      const u_underOdd = match.under_odd ?? 1.85;

      const u_period = String((match as any).period || '').toUpperCase();
      const u_isFirstHalf = !(
        u_min > 45 ||
        u_period.includes('SECOND') || u_period.includes('2H') || u_period === 'HT' ||
        u_period.includes('HALF_TIME') || u_period.includes('HALFTIME') ||
        u_period.includes('EXTRA') || u_period === 'FT' || u_period.includes('FULL_TIME')
      );
      const u_isEarly = u_min >= 10 && u_min <= 20 && u_isFirstHalf;
      const u_isScoreless = u_totalGoals === 0;
      const u_isDeadGame = u_dangerousTotal <= 4 && u_sotTotal <= 1 && u_xgTotal <= 0.3;
      // Evidência mínima: garante que stats não estão simplesmente zeradas por falha da API.
      // Em jogos reais com 10+ minutos, espera-se pelo menos algum movimento (≥3 ataques perigosos somados).
      const u_hasMinimumEvidence = u_dangerousTotal >= 3 || u_sotTotal >= 1 || u_xgTotal >= 0.1;

      // Verifica se já existe sinal Under 2.5 ativo (APROVADO) anterior para este jogo
      let u_priorActiveSignal: any = null;
      if (match.match_id) {
        try {
          const { data: priorRows } = await getSupabaseAdmin()
            .from('mycroft_analyses')
            .select('id, verdict, market, plan_name, created_at')
            .eq('match_id', match.match_id)
            .eq('plan_name', 'PLANO UNDER 2.5 EARLY')
            .order('created_at', { ascending: false })
            .limit(1);
          if (priorRows && priorRows[0] && priorRows[0].verdict === 'APROVADO') {
            u_priorActiveSignal = priorRows[0];
          }
        } catch (e) { console.warn('[MycroftSports] Falha ao checar sinal prévio Under 2.5:', e); }
      }

      // CANCELAMENTO: já tinha sinal aprovado, mas condições mudaram → emitir aviso de SAÍDA
      if (u_priorActiveSignal && analysis.verdict !== 'APROVADO' && analysis.verdict !== 'APROVADO_SITUACIONAL') {
        const u_hasGoal = u_totalGoals > 0;
        const u_increasedActivity = u_dangerousTotal > 6 || u_sotTotal > 2 || u_xgTotal > 0.6;
        if (u_hasGoal || u_increasedActivity) {
          const motivo = u_hasGoal
            ? `gol marcado (${u_scoreH}x${u_scoreA})`
            : `aumento de pressão ofensiva (${u_dangerousTotal} ataques perigosos, ${u_sotTotal} SOT, xG ${u_xgTotal.toFixed(2)})`;
          console.log(`[MycroftSports] 🚪 CANCELAMENTO Under 2.5: ${match.home} vs ${match.away} (${u_min}') — ${motivo}`);
          analysis.verdict = 'CUIDADO';
          analysis.plan_name = 'CANCELAMENTO UNDER 2.5 EARLY';
          analysis.market = 'Under 2.5 — SAIR';
          analysis.confidence = 90;
          analysis.thesis = `🚨 SAIR DA OPERAÇÃO — UNDER 2.5 EARLY. Condições do sinal mudaram: ${motivo}. Recomenda-se ENCERRAR a posição imediatamente (cashout ou contra-aposta) para proteger banca.`;
          analysis.risk_management = {
            ...(analysis.risk_management || {}),
            entry: 'N/A — sinal cancelado',
            stop: 'EXECUTAR SAÍDA AGORA (cashout/hedge)',
            target: 'Proteger capital exposto',
            rr: 'N/A',
            ev: 'N/A',
          };
          analysis.alerts = [
            `🚨 SAIR DA OPERAÇÃO IMEDIATAMENTE — sinal Under 2.5 Early revogado.`,
            `Motivo: ${motivo}.`,
            `Ação recomendada: cashout ou hedge para limitar perda.`,
          ];
          analysis.fundamentation = {
            ...(analysis.fundamentation || {}),
            override: 'server_side_under_25_cancellation',
            prior_signal_id: u_priorActiveSignal.id,
            stats_snapshot: { dangerousTotal: u_dangerousTotal, sotTotal: u_sotTotal, xgTotal: u_xgTotal, minute: u_min, score: `${u_scoreH}x${u_scoreA}` },
          };
        }
      }
      // APROVAÇÃO: só se ainda não há outro APROVADO da IA e condições batem
      else if (
        analysis.verdict !== 'APROVADO' &&
        analysis.verdict !== 'APROVADO_SITUACIONAL' &&
        !u_priorActiveSignal &&
        u_isEarly && u_isScoreless && u_isDeadGame && u_hasMinimumEvidence && u_underOdd >= 1.85
      ) {
        console.log(`[MycroftSports] 📉 OVERRIDE APROVADO: Under 2.5 Early — ${match.home} vs ${match.away} (${u_min}') odd ${u_underOdd} | dang=${u_dangerousTotal} sot=${u_sotTotal} xg=${u_xgTotal.toFixed(2)}`);
        analysis.verdict = 'APROVADO';
        analysis.plan_name = 'PLANO UNDER 2.5 EARLY';
        analysis.market = 'Under 2.5';
        analysis.odd = u_underOdd;
        analysis.confidence = 75;
        analysis.thesis = `🔱 MYCROFT ATIVOU — PLANO UNDER 2.5 EARLY. Jogo sem ações ofensivas (${u_dangerousTotal} ataques perigosos, ${u_sotTotal} finalizações no alvo, xG ${u_xgTotal.toFixed(2)}) nos primeiros ${u_min} minutos. Odd Under 2.5 em ${u_underOdd} com valor.`;
        analysis.risk_management = {
          stake_percent: 4,
          stake_value: Number(((match.bankroll ?? 500) * 0.04).toFixed(2)),
          entry: `Under 2.5 @ ${u_underOdd}`,
          stop: 'Cancelar se ocorrer gol antes dos 35 min ou ≥ 3 ataques perigosos em 5 min',
          target: 'Manter placar ≤ 2 gols ao fim do jogo',
          rr: `1:${(u_underOdd - 1).toFixed(2)}`,
          ev: `+${Math.round((0.75 * u_underOdd - 1) * 100)}%`,
        };
        analysis.alerts = [
          `✅ Sinal ativo enquanto: 0x0, dangerous ≤ 6, SOT ≤ 2, xG ≤ 0.6.`,
          `⚠️ Reavaliar imediatamente se gol ou pressão ofensiva aumentar.`,
        ];
        analysis.fundamentation = {
          ...(analysis.fundamentation || {}),
          override: 'server_side_under_25_early',
          stats_snapshot: { dangerousTotal: u_dangerousTotal, sotTotal: u_sotTotal, xgTotal: u_xgTotal, minute: u_min },
        };
      }
    }

    // === PLANO BACK AO TIME DOMINANTE (override server-side) ===
    // Aprova Back no time com domínio estatístico claro (≥4 de 5 critérios) e odd 1.40-2.20.
    // Cancela se sofrer gol ou perder dominância.
    {
      const ds = match.stats || {};
      const d_min = match.minute ?? 0;
      const d_scoreH = match.scoreHome ?? 0;
      const d_scoreA = match.scoreAway ?? 0;

      const possH = ds.possession_home ?? 0;
      const possA = ds.possession_away ?? 0;
      const shotsTotalH = ds.shots_total_home ?? ds.shots_home ?? 0;
      const shotsTotalA = ds.shots_total_away ?? ds.shots_away ?? 0;
      const shotsOnH = ds.shots_on_target_home ?? 0;
      const shotsOnA = ds.shots_on_target_away ?? 0;
      const shotsInsideH = ds.dangerous_attacks_home ?? 0;
      const shotsInsideA = ds.dangerous_attacks_away ?? 0;
      const xgHd = ds.xG_home ?? 0;
      const xgAd = ds.xG_away ?? 0;

      function isDominant(team: 'home' | 'away'): { ok: boolean; criteriaMet: number } {
        const poss = team === 'home' ? possH : possA;
        const oppPoss = team === 'home' ? possA : possH;
        const shotsTotal = team === 'home' ? shotsTotalH : shotsTotalA;
        const shotsOn = team === 'home' ? shotsOnH : shotsOnA;
        const shotsInside = team === 'home' ? shotsInsideH : shotsInsideA;
        const xg = team === 'home' ? xgHd : xgAd;
        const oppShotsTotal = team === 'home' ? shotsTotalA : shotsTotalH;
        const oppShotsOn = team === 'home' ? shotsOnA : shotsOnH;
        const oppXg = team === 'home' ? xgAd : xgHd;
        const score = team === 'home' ? d_scoreH : d_scoreA;
        const oppScore = team === 'home' ? d_scoreA : d_scoreH;

        const possOk = poss >= 58 && poss > oppPoss + 10;
        const volumeOk = shotsTotal >= 8 && shotsOn >= 3;
        const insideBoxOk = shotsInside >= 4;
        const defenseOk = oppShotsTotal <= 2 && oppShotsOn <= 1 && oppXg <= 0.2;
        const xgOk = xg >= 0.8 && xg > oppXg + 0.5;
        // scoreOk removido — dominância estatística não depende mais do placar atual.
        // O placar é tratado a jusante para escolher entre BACK ao dominante (empate)
        // ou LAY ao vencedor (dominante perdendo).

        let criteriaMet = 0;
        if (possOk) criteriaMet++;
        if (volumeOk) criteriaMet++;
        if (insideBoxOk) criteriaMet++;
        if (defenseOk) criteriaMet++;
        if (xgOk) criteriaMet++;

        return { ok: criteriaMet >= 4 && d_min >= 15, criteriaMet };
      }

      const homeDom = isDominant('home');
      const awayDom = isDominant('away');
      const dominantTeam: 'home' | 'away' | null = homeDom.ok ? 'home' : (awayDom.ok ? 'away' : null);

      // Verifica sinal Dominante prévio
      let d_priorActiveSignal: any = null;
      if (match.match_id) {
        try {
          const { data: priorRows } = await getSupabaseAdmin()
            .from('mycroft_analyses')
            .select('id, verdict, market, plan_name, created_at')
            .eq('match_id', match.match_id)
            .eq('plan_name', 'PLANO BACK AO DOMINANTE')
            .order('created_at', { ascending: false })
            .limit(1);
          if (priorRows && priorRows[0] && priorRows[0].verdict === 'APROVADO') {
            d_priorActiveSignal = priorRows[0];
          }
        } catch (e) { console.warn('[MycroftSports] Falha ao checar sinal prévio Dominante:', e); }
      }

      // CANCELAMENTO: já tinha aprovado mas perdeu dominância OU sofreu gol contra
      if (d_priorActiveSignal && analysis.verdict !== 'APROVADO' && analysis.verdict !== 'APROVADO_SITUACIONAL') {
        // Detecta time previamente aprovado pelo market
        const priorMarket = (d_priorActiveSignal.market || '');
        const wasHome = priorMarket.includes(match.home);
        const wasAway = priorMarket.includes(match.away);
        const lostDominance = wasHome ? !homeDom.ok : (wasAway ? !awayDom.ok : (dominantTeam === null));
        const concededGoal = wasHome ? d_scoreA > d_scoreH : (wasAway ? d_scoreH > d_scoreA : false);

        if (lostDominance || concededGoal) {
          const motivo = concededGoal ? 'sofreu gol contra' : 'perdeu supremacia estatística';
          console.log(`[MycroftSports] 🚪 CANCELAMENTO Back Dominante: ${match.home} vs ${match.away} (${d_min}') — ${motivo}`);
          analysis.verdict = 'CUIDADO';
          analysis.plan_name = 'CANCELAMENTO BACK AO DOMINANTE';
          analysis.market = `${priorMarket} — SAIR`;
          analysis.confidence = 88;
          analysis.thesis = `🚨 SAIR DA OPERAÇÃO — BACK AO DOMINANTE. ${motivo}. Recomenda-se ENCERRAR a posição imediatamente (cashout ou hedge) para proteger banca.`;
          analysis.risk_management = {
            ...(analysis.risk_management || {}),
            stake_percent: 0,
            entry: 'SAIR DA OPERAÇÃO',
            stop: 'Encerrar agora',
            target: 'Limitar perda',
          };
          analysis.alerts = [
            `🚨 SAIR DA OPERAÇÃO IMEDIATAMENTE — sinal Back ao Dominante revogado.`,
            `Motivo: ${motivo}.`,
            `Ação recomendada: cashout ou hedge.`,
          ];
          analysis.fundamentation = {
            ...(analysis.fundamentation || {}),
            override: 'server_side_dominante_cancellation',
            prior_signal_id: d_priorActiveSignal.id,
            stats_snapshot: { possH, possA, shotsTotalH, shotsTotalA, xgH: xgHd, xgA: xgAd, score: `${d_scoreH}x${d_scoreA}`, minute: d_min },
          };
        }
      }

      // APROVAÇÃO server-side (rotas baseadas no placar):
      //  - Empate (placar igual)         → BACK ao dominante (plano clássico)
      //  - Dominante perdendo            → LAY ao time que está vencendo (PLANO LAY AO VENCEDOR)
      //  - Dominante já vencendo          → NÃO aprovar (sem valor; odd já caiu)
      if (
        dominantTeam &&
        !d_priorActiveSignal &&
        analysis.verdict !== 'APROVADO' &&
        analysis.verdict !== 'APROVADO_SITUACIONAL' &&
        analysis.plan_name !== 'CANCELAMENTO BACK AO DOMINANTE'
      ) {
        const teamName = dominantTeam === 'home' ? match.home : match.away;
        const oppName = dominantTeam === 'home' ? match.away : match.home;
        const dPoss = dominantTeam === 'home' ? possH : possA;
        const dShotsTotal = dominantTeam === 'home' ? shotsTotalH : shotsTotalA;
        const dShotsOn = dominantTeam === 'home' ? shotsOnH : shotsOnA;
        const dShotsInside = dominantTeam === 'home' ? shotsInsideH : shotsInsideA;
        const dXg = dominantTeam === 'home' ? xgHd : xgAd;
        const dScore = dominantTeam === 'home' ? d_scoreH : d_scoreA;
        const oppScore = dominantTeam === 'home' ? d_scoreA : d_scoreH;

        const isDraw = dScore === oppScore;
        const dominantLosing = dScore < oppScore;
        const dominantWinning = dScore > oppScore;

        if (dominantWinning) {
          analysis.alerts = [
            ...(analysis.alerts || []),
            `ℹ️ ${teamName} domina E já vence (${d_scoreH}x${d_scoreA}). Sem valor para BACK ao dominante — odd já caiu.`,
          ];
        } else if (isDraw) {
          // ── ROTA 1: BACK AO DOMINANTE (apenas em empate)
          const odd = dominantTeam === 'home' ? (match.odds?.home ?? 0) : (match.odds?.away ?? 0);
          if (odd >= 1.40 && odd <= 2.20) {
            console.log(`[MycroftSports] 👑 OVERRIDE APROVADO: Back Dominante ${teamName} (odd ${odd}, placar ${d_scoreH}x${d_scoreA}) — ${match.home} vs ${match.away} (${d_min}')`);
            analysis.verdict = 'APROVADO';
            analysis.plan_name = 'PLANO BACK AO DOMINANTE';
            analysis.market = `Back ${teamName}`;
            analysis.odd = odd;
            analysis.confidence = 78;
            analysis.thesis = `🔱 MYCROFT ATIVOU — PLANO BACK AO DOMINANTE. Placar ${d_scoreH}x${d_scoreA} aos ${d_min}'. ${teamName} dominando: posse ${dPoss}%, ${dShotsTotal} finalizações (${dShotsOn} no alvo), ${dShotsInside} ataques perigosos, xG ${dXg.toFixed(2)}. Adversário sem reação. Odd ${odd} com valor.`;
            analysis.risk_management = {
              stake_percent: 4,
              stake_value: (match.bankroll ?? 500) * 0.04,
              entry: `${teamName} @ ${odd}`,
              stop: 'Gol sofrido ou perda de dominância por 5 minutos',
              target: `Vitória de ${teamName}`,
              rr: `1:${(odd - 1).toFixed(1)}`,
              ev: `+${Math.round((0.78 * odd - 1) * 100)}%`,
            };
            analysis.alerts = [
              `✅ Time dominante: ${teamName} (placar ${d_scoreH}x${d_scoreA}). Monitorar se mantém supremacia.`,
              `⚠️ Se sofrer gol ou estatísticas se igualarem por 5 min, cancelar sinal.`,
            ];
            analysis.fundamentation = {
              ...(analysis.fundamentation || {}),
              override: 'server_side_back_dominante',
              score_state: 'draw',
              criteria_met: dominantTeam === 'home' ? homeDom.criteriaMet : awayDom.criteriaMet,
              stats_snapshot: { possH, possA, shotsTotalH, shotsTotalA, shotsOnH, shotsOnA, shotsInsideH, shotsInsideA, xgH: xgHd, xgA: xgAd, minute: d_min, score: `${d_scoreH}x${d_scoreA}` },
            };
          } else if (odd > 0 && odd < 1.40) {
            analysis.alerts = [...(analysis.alerts || []), `⚠️ ${teamName} (dominante, empate ${d_scoreH}x${d_scoreA}) com odd ${odd} muito baixa (<1.40). Sem valor.`];
          } else if (odd > 2.20) {
            analysis.alerts = [...(analysis.alerts || []), `⚠️ ${teamName} (dominante, empate ${d_scoreH}x${d_scoreA}) com odd ${odd} acima de 2.20. Aguardar.`];
          } else if (odd === 0) {
            analysis.alerts = [...(analysis.alerts || []), `ℹ️ Dominância detectada (${teamName}, empate) mas odd Match Odds não disponível.`];
          }
        } else if (dominantLosing) {
          // ── ROTA 2: LAY AO VENCEDOR (dominante perdendo paradoxalmente)
          // O time que está VENCENDO é o oponente do dominante. Apostamos contra ele (LAY).
          const oppOdd = dominantTeam === 'home' ? (match.odds?.away ?? 0) : (match.odds?.home ?? 0);
          // LAY tem valor quando a odd do vencedor não está absurdamente alta
          // (oppOdd pequena = mercado já precificou vitória do "errado", prêmio bom no LAY).
          if (oppOdd >= 1.50 && oppOdd <= 4.50) {
            const layLiability = +(oppOdd - 1).toFixed(2);
            console.log(`[MycroftSports] 🛡️ OVERRIDE APROVADO: LAY ao Vencedor ${oppName} (odd ${oppOdd}, placar ${d_scoreH}x${d_scoreA}, dominante=${teamName} perdendo) — ${match.home} vs ${match.away} (${d_min}')`);
            analysis.verdict = 'APROVADO';
            analysis.plan_name = 'PLANO LAY AO VENCEDOR';
            analysis.market = `Lay ${oppName}`;
            analysis.odd = oppOdd;
            analysis.confidence = 74;
            analysis.thesis = `🛡️ MYCROFT ATIVOU — PLANO LAY AO VENCEDOR. Paradoxo estatístico: ${teamName} domina (posse ${dPoss}%, ${dShotsTotal} finalizações, ${dShotsInside} ataques perigosos, xG ${dXg.toFixed(2)}) mas PERDE por ${d_scoreH}x${d_scoreA} aos ${d_min}'. Apostamos LAY em ${oppName} — mercado superprecificou a vantagem do placar e a regressão à média favorece reação do dominante.`;
            analysis.risk_management = {
              stake_percent: 3,
              stake_value: (match.bankroll ?? 500) * 0.03,
              entry: `LAY ${oppName} @ ${oppOdd} (liability ${layLiability}x stake)`,
              stop: 'Segundo gol do time vencedor ou perda da pressão dominante por 5 min',
              target: `Empate ou vitória de ${teamName}`,
              rr: `1:${(1 / Math.max(0.01, oppOdd - 1)).toFixed(2)}`,
              ev: `+${Math.round((0.74 - (1 / oppOdd)) * 100)}%`,
            };
            analysis.alerts = [
              `🛡️ LAY em ${oppName} (placar ${d_scoreH}x${d_scoreA}, dominante=${teamName} reagindo).`,
              `⚠️ Liability = ${layLiability}× stake. Sair se ${oppName} marcar segundo gol.`,
              `⚠️ Sair também se ${teamName} perder a pressão por 5 minutos seguidos.`,
            ];
            analysis.fundamentation = {
              ...(analysis.fundamentation || {}),
              override: 'server_side_lay_ao_vencedor',
              score_state: 'dominant_losing',
              dominant_team: teamName,
              losing_team_to_lay: oppName,
              criteria_met: dominantTeam === 'home' ? homeDom.criteriaMet : awayDom.criteriaMet,
              stats_snapshot: { possH, possA, shotsTotalH, shotsTotalA, shotsOnH, shotsOnA, shotsInsideH, shotsInsideA, xgH: xgHd, xgA: xgAd, minute: d_min, score: `${d_scoreH}x${d_scoreA}` },
            };
          } else if (oppOdd > 0 && oppOdd < 1.50) {
            analysis.alerts = [...(analysis.alerts || []), `⚠️ ${oppName} vence ${d_scoreH}x${d_scoreA} mas odd ${oppOdd} < 1.50: liability muito baixo, sem valor para LAY.`];
          } else if (oppOdd > 4.50) {
            analysis.alerts = [...(analysis.alerts || []), `⚠️ ${oppName} vence mas odd ${oppOdd} > 4.50: liability alto demais. Aguardar.`];
          } else if (oppOdd === 0) {
            analysis.alerts = [...(analysis.alerts || []), `ℹ️ ${teamName} domina e perde, mas odd de ${oppName} indisponível para LAY.`];
          }
        }
      }
    }

    // === MÓDULO DE LEITURA SITUACIONAL (server-side override) ===
    // Roda quando JOGO_MORTO por dados insuficientes, APROVADO_SITUACIONAL ou CUIDADO
    // (baseline neutra) — assim regras S1-S4 podem promover jogos com pressão clara
    // mesmo quando o motor inicial não identificou padrão dominante.
    if (analysis.verdict === 'JOGO_MORTO' || analysis.verdict === 'APROVADO_SITUACIONAL' || analysis.verdict === 'CUIDADO') {
      const isDataGapDead = analysis.verdict === 'JOGO_MORTO' && (
        (analysis.alerts || []).some((a: string) => /dados ausentes|dados insuficientes|sem dados|confiança.*penalidade|critérios.*ausentes/i.test(a)) ||
        (analysis.criterios_ausentes?.length > 0)
      );
      const isAISituational = analysis.verdict === 'APROVADO_SITUACIONAL';
      const isBaselineCuidado = analysis.verdict === 'CUIDADO';

      if (isDataGapDead || isAISituational || isBaselineCuidado) {
        const s = match.stats || {};
        const min = match.minute ?? 0;
        const scoreH = match.scoreHome ?? 0;
        const scoreA = match.scoreAway ?? 0;
        const xgH = s.xG_home ?? 0;
        const xgA = s.xG_away ?? 0;
        const possH = s.possession_home ?? 0;
        const possA = s.possession_away ?? 0;
        const sotH = s.shots_on_target_home ?? s.shots_home ?? 0;
        const sotA = s.shots_on_target_away ?? s.shots_away ?? 0;
        const champ = (match.championship || '').toLowerCase();
        const isKnockout = /copa|cup|eliminat|playoff|mata-mata|knockout|libertadores|champions|europa league|sul-americana/i.test(champ);

        let situationalRule: string | null = null;
        let situationalMarket = '';
        let situationalConf = 65;
        let situationalStake = 2;
        let situationalContext = '';

        const homeDominant = possH > possA && (sotH > sotA || xgH > xgA);
        const awayDominant = possA > possH && (sotA > sotH || xgA > xgH);
        // Dominância de xG esmagadora (≥3x e dom ≥0.3) override: ignora exigência de posse
        const xgCrushHome = xgH >= 0.3 && xgH >= 3 * Math.max(xgA, 0.05);
        const xgCrushAway = xgA >= 0.3 && xgA >= 3 * Math.max(xgH, 0.05);
        const xgCrushSide: 'home' | 'away' | null = xgCrushHome ? 'home' : (xgCrushAway ? 'away' : null);
        const effHomeDominant = homeDominant || xgCrushHome;
        const effAwayDominant = awayDominant || xgCrushAway;
        const domXg = effHomeDominant ? xgH : xgA;
        const domPoss = effHomeDominant ? possH : possA;
        const domSot = effHomeDominant ? sotH : sotA;
        const oppSot = effHomeDominant ? sotA : sotH;
        const domGoals = effHomeDominant ? scoreH : scoreA;
        const domName = effHomeDominant ? match.home : match.away;

        // REGRA S1
        if (!situationalRule && min >= 5 && min <= 35) {
          const placarOk = (scoreH + scoreA) <= 1;
          const xgOk = domXg >= 0.4 || domSot >= 2;
          // posse ≥58% OU dominância de xG esmagadora do mesmo lado dominante
          const possOk = domPoss >= 58 || (xgCrushSide !== null &&
            ((xgCrushSide === 'home' && effHomeDominant) || (xgCrushSide === 'away' && effAwayDominant)));
          const oppClean = oppSot === 0;
          if ((effHomeDominant || effAwayDominant) && placarOk && xgOk && possOk && oppClean) {
            situationalRule = 'S1';
            situationalMarket = min < 45 ? 'Over 0.5 HT' : 'Over 1.5 Total';
            situationalConf = 65;
            situationalContext = `${domName} com xG ${domXg}, posse ${domPoss}%, ${domSot} finalizações no alvo. Adversário sem finalização.`;
          }
        }
        // REGRA S2
        if (!situationalRule && min >= 20 && min <= 60) {
          const diff = Math.abs(scoreH - scoreA);
          const totalGoals = scoreH + scoreA;
          const placarExpressivo = (diff >= 2 && totalGoals >= 2) || (totalGoals >= 4 && diff >= 2);
          const xgTotalOk = (xgH + xgA) >= 2.0;
          const loserPoss = scoreH > scoreA ? possA : possH;
          if (placarExpressivo && xgTotalOk && loserPoss >= 40) {
            situationalRule = 'S2';
            situationalMarket = totalGoals < 4 && min < 40 ? 'Over 3.5 Total' : 'Over 0.5 Próximo Gol';
            situationalConf = 68;
            situationalContext = `Placar ${scoreH}-${scoreA}, xG total ${(xgH + xgA).toFixed(1)}, perdedor com ${loserPoss}% posse.`;
          }
        }
        // REGRA S3
        if (!situationalRule && isKnockout) {
          const diff = Math.abs(scoreH - scoreA);
          if (diff >= 1 && diff <= 2 && scoreH !== scoreA) {
            const teamBehind = scoreH < scoreA ? match.home : match.away;
            situationalRule = 'S3';
            situationalMarket = min < 60 ? 'Over 2.5 Total' : 'Over 0.5 Próximo Gol';
            situationalConf = diff === 1 ? 72 : 66;
            situationalStake = diff === 1 ? 3 : 2;
            situationalContext = `Fase eliminatória, ${teamBehind} perdendo por ${diff} gol(s) — obrigação de virar.`;
          }
        }
        // REGRA S4
        if (!situationalRule && min >= 10 && min <= 40 && (effHomeDominant || effAwayDominant)) {
          if (domXg >= 0.6 && domGoals <= 1 && domSot >= 3 && domGoals === 0) {
            situationalRule = 'S4';
            situationalMarket = 'Over 0.5 HT';
            situationalConf = 65;
            situationalContext = `${domName} com xG ${domXg}, ${domSot} finalizações, pressão acumulada sem conversão.`;
          }
        }

        if (situationalRule && min <= 70) {
          console.log(`[MycroftSports] 🔄 SITUACIONAL: Regra ${situationalRule} ativada para ${match.home} vs ${match.away}`);
          analysis.verdict = 'APROVADO_SITUACIONAL';
          analysis.situational_rule = situationalRule;
          analysis.market = analysis.market === 'N/A' || !analysis.market ? situationalMarket : analysis.market;
          analysis.confidence = Math.max(analysis.confidence || 0, situationalConf);
          analysis.plan_name = null;
          analysis.alerts = [
            ...(analysis.alerts || []),
            `✅ Aprovação situacional via Regra ${situationalRule}: ${situationalContext}`,
            `⚠️ Aprovação baseada em leitura situacional.`,
          ];
          analysis.thesis = `📍 APROVADO SITUACIONAL (Regra ${situationalRule}) — ${situationalContext}`;
          const bankroll = match.bankroll ?? 500;
          const stakePercent = Math.min(situationalStake, 3);
          analysis.risk_management = {
            stake_percent: stakePercent, stake_value: bankroll * stakePercent / 100,
            entry: `${analysis.market} @ ${analysis.odd || 1.50}`, stop: 'Condição adversa ou gol contra',
            target: 'Realização do mercado', rr: `1:${(analysis.odd || 1.50).toFixed(1)}`,
            ev: `+${Math.round(((analysis.confidence / 100) * (analysis.odd || 1.50) - 1) * 100)}%`,
          };
        }
      }
    }

    // === ANTI-JOGO_MORTO FALSO (server-side safety net) ===
    // A game with goals, active shots, and reasonable possession should NEVER be JOGO_MORTO
    // unless it's a blowout in the final minutes
    if (analysis.verdict === 'JOGO_MORTO') {
      const s = match.stats || {};
      const min = match.minute ?? 0;
      const scoreH = match.scoreHome ?? 0;
      const scoreA = match.scoreAway ?? 0;
      const totalGoals = scoreH + scoreA;
      const diff = Math.abs(scoreH - scoreA);
      const totalShots = (s.shots_total_home ?? s.shots_home ?? 0) + (s.shots_total_away ?? s.shots_away ?? 0);
      const totalSot = (s.shots_on_target_home ?? s.shots_home ?? 0) + (s.shots_on_target_away ?? s.shots_away ?? 0);
      const xgTotal = (s.xG_home ?? 0) + (s.xG_away ?? 0);

      // Rule 1: Game with goals and not a blowout → CUIDADO (never dead)
      // A 1-0, 1-1, 2-1 game is NEVER dead unless it's 85'+ with 3+ goal lead
      const isBlowout = diff >= 3 && min >= 75;
      if (totalGoals > 0 && !isBlowout) {
        // Check if there's real activity (shots, xG)
        const hasActivity = totalShots >= 4 || totalSot >= 2 || xgTotal >= 0.5;
        if (hasActivity || diff <= 1) {
          console.log(`[MycroftSports] 🛡️ OVERRIDE: ${match.home} vs ${match.away} (${scoreH}-${scoreA}, ${min}') — JOGO_MORTO → CUIDADO (jogo com gols e atividade não pode ser morto)`);
          analysis.verdict = 'CUIDADO';
          analysis.confidence = Math.max(analysis.confidence || 0, 50);
          analysis.alerts = [
            ...(analysis.alerts || []),
            `🛡️ Override: Jogo com placar ${scoreH}-${scoreA} e ${totalShots} chutes reclassificado de JOGO_MORTO para CUIDADO`,
          ];
          if (!analysis.market || analysis.market === 'N/A') {
            if (diff <= 1 && min < 70) {
              analysis.market = totalGoals >= 2 ? `Over ${totalGoals + 0.5} Total` : 'Over 1.5 Total';
            } else {
              analysis.market = 'Over 0.5 Próximo Gol';
            }
          }
        }
      }

      // Rule 2: First half game (< 45') with any shots on target → AGUARDAR at minimum
      if (analysis.verdict === 'JOGO_MORTO' && min < 45 && totalSot >= 2) {
        console.log(`[MycroftSports] 🛡️ OVERRIDE: ${match.home} vs ${match.away} (${min}') — JOGO_MORTO → AGUARDAR (1º tempo com atividade)`);
        analysis.verdict = 'AGUARDAR';
        analysis.confidence = Math.max(analysis.confidence || 0, 40);
        analysis.alerts = [
          ...(analysis.alerts || []),
          `🛡️ Override: Jogo no 1º tempo com ${totalSot} finalizações no alvo não pode ser JOGO_MORTO`,
        ];
      }
    }

    // === LABAREDA DETECTION (server-side) ===
    // If JOGO_MORTO but late-game with losing team pressing, upgrade to LABAREDA
    if (analysis.verdict === 'JOGO_MORTO') {
      const s = match.stats || {};
      const min = match.minute ?? 0;
      const scoreH = match.scoreHome ?? 0;
      const scoreA = match.scoreAway ?? 0;
      const diff = Math.abs(scoreH - scoreA);
      const xgLoser = scoreH < scoreA ? (s.xG_home ?? 0) : (s.xG_away ?? 0);
      const sotLoser = scoreH < scoreA ? (s.shots_on_target_home ?? s.shots_home ?? 0) : (s.shots_on_target_away ?? s.shots_away ?? 0);

      if (min >= 60 && diff === 1 && scoreH !== scoreA) {
        let triggers = 0;
        if (min >= 65) triggers++;
        if (xgLoser >= 0.8) triggers++;
        if (sotLoser >= 3) triggers++;

        if (triggers >= 2) {
          const loserName = scoreH < scoreA ? match.home : match.away;
          console.log(`[MycroftSports] ⚡ LABAREDA ativado para ${match.home} vs ${match.away} (${triggers} gatilhos)`);
          analysis.verdict = 'LABAREDA';
          analysis.thesis = `⚡ LABAREDA — ${loserName} perdendo por 1 gol no min ${min}', com xG ${xgLoser} e ${sotLoser} finalizações. Potencial de gol tardio.`;
          analysis.market = analysis.market === 'N/A' ? 'Over 0.5 Próximo Gol' : analysis.market;
          analysis.alerts = [...(analysis.alerts || []), `⚡ LABAREDA: ${triggers} gatilhos ativados — oportunidade tardia detectada`];
          analysis.risk_management = {
            stake_percent: 2, stake_value: (match.bankroll ?? 500) * 0.02,
            entry: `${analysis.market} @ ${analysis.odd || 2.50}`, stop: 'Gol contra ou perda de pressão',
            target: 'Gol do time perdedor', rr: `1:${(analysis.odd || 2.50).toFixed(1)}`,
            ev: `+${Math.round(((analysis.confidence / 100) * (analysis.odd || 2.50) - 1) * 100)}%`,
          };
        }
      }
    }

    // === RESOLUÇÃO DE ODD REAL ===
    // Princípio: só exibir odd quando ela vier de fonte de mercado confiável.
    // Se o mercado escolhido pela IA não tem cotação real disponível (ex.: Over 0.5 HT,
    // Ambas Marcam, Próximo Gol, escanteios, 1T...), zeramos a odd e sinalizamos que
    // está indisponível — o frontend já oculta o badge nesse caso.
    if (analysis.market && (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL' || analysis.verdict === 'LABAREDA' || analysis.verdict === 'CUIDADO')) {
      const m = String(analysis.market).toLowerCase();
      const homeName = (match.home || '').toLowerCase();
      const awayName = (match.away || '').toLowerCase();
      let realOdd: number | undefined;

      // Mercados cobertos pelo cache de odds reais (h2h pré-jogo + Over/Under 2.5 FT)
      if (m.includes('over 2.5') || m.includes('mais 2.5')) realOdd = (match as any).over_odd;
      else if (m.includes('under 2.5') || m.includes('menos 2.5')) realOdd = match.under_odd;
      else if (m.includes('empate') || m === 'draw' || m.includes('match odds — draw')) realOdd = match.odds?.draw;
      else if (homeName && (m.includes(homeName) || m.includes('vitória mandante') || m.includes('back mandante') || m.includes('back home'))) realOdd = match.odds?.home;
      else if (awayName && (m.includes(awayName) || m.includes('vitória visitante') || m.includes('back visitante') || m.includes('back away'))) realOdd = match.odds?.away;

      const guessedOdd = typeof analysis.odd === 'number' ? analysis.odd : null;
      if (realOdd && realOdd > 1.01) {
        // Temos odd real: substituir e marcar a fonte
        if (!guessedOdd || Math.abs(guessedOdd - realOdd) > 0.05) {
          console.log(`[MycroftSports] 🎯 Odd substituída: chutada ${guessedOdd ?? '—'} → real ${realOdd} (${analysis.market})`);
        }
        analysis.odd = realOdd;
        analysis.odd_source = 'real';
        if (analysis.risk_management) {
          analysis.risk_management.entry = `${analysis.market} @ ${realOdd}`;
          analysis.risk_management.rr = `1:${(realOdd - 1).toFixed(2)}`;
          analysis.risk_management.ev = `${Math.round(((analysis.confidence / 100) * realOdd - 1) * 100)}%`;
        }
      } else {
        // Sem odd real para este mercado → não exibir odd inventada
        if (guessedOdd != null) {
          console.log(`[MycroftSports] ⚠️ Odd indisponível para "${analysis.market}" (chutada ${guessedOdd} descartada — sem cotação real)`);
        }
        analysis.odd = null;
        analysis.odd_source = 'unavailable';
        analysis.alerts = [
          ...(analysis.alerts || []),
          'Odd não disponível para este mercado ao vivo — confira na sua casa antes de entrar.',
        ];
        if (analysis.risk_management) {
          analysis.risk_management.entry = `${analysis.market} @ —`;
          analysis.risk_management.rr = '—';
          analysis.risk_management.ev = '—';
        }
      }
    }

    // Garante stake_value mesmo sem odd (stake_percent independe da cotação)
    if (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL') {
      if (!analysis.risk_management || typeof analysis.risk_management !== 'object' || !Object.keys(analysis.risk_management).length) {
        const bankroll = match.bankroll ?? 500;
        const oddLabel = analysis.odd != null ? analysis.odd : '—';
        analysis.risk_management = {
          stake_percent: 5,
          stake_value: bankroll * 0.05,
          entry: `${analysis.market} @ ${oddLabel}`,
          stop: 'Condição adversa',
          target: 'Realização do mercado',
          rr: analysis.odd != null ? `1:${(analysis.odd - 1).toFixed(2)}` : '—',
          ev: analysis.odd != null ? `+${Math.round((analysis.confidence / 100 * analysis.odd - 1) * 100)}%` : '—',
        };
      }
    }
    if (analysis.risk_management && !analysis.risk_management.stake_value && analysis.risk_management.stake_percent) {
      analysis.risk_management.stake_value = (match.bankroll ?? 500) * analysis.risk_management.stake_percent / 100;
    }

    // === GUARD HT/1T: nunca aprovar mercado de 1º tempo após o intervalo ===
    // Após min >= 45 o HT já está encerrado/encerrando. Qualquer "Over X HT", "1T",
    // "Primeiro Tempo", "First Half" deixa de ser válido e precisa ser convertido
    // para o equivalente de jogo inteiro ou descartado.
    {
      const min = match.minute ?? 0;
      const isHtMarket = (m: unknown): boolean => {
        if (!m || typeof m !== 'string') return false;
        const s = m.toLowerCase();
        return /\b(ht|1t|1º\s*tempo|primeiro\s*tempo|first\s*half|halftime|half\s*time|intervalo)\b/i.test(s);
      };
      const convertHtToFt = (m: string): string => {
        // Tenta converter "Over X HT" → "Over (X+1) Total"; senão devolve "Over 0.5 Próximo Gol"
        const overMatch = m.match(/over\s*(\d+(?:\.\d+)?)/i);
        if (overMatch) {
          const line = parseFloat(overMatch[1]);
          const ftLine = line + 1; // 0.5 HT ~ 1.5 FT como aproximação conservadora
          return `Over ${ftLine.toFixed(1)} Total`;
        }
        return 'Over 0.5 Próximo Gol';
      };

      if (min >= 45 && isHtMarket(analysis.market)) {
        const original = analysis.market;
        if (min <= 70) {
          const converted = convertHtToFt(String(analysis.market));
          console.log(`[MycroftSports] 🛡️ HT GUARD: "${original}" inválido no min ${min}' → convertido para "${converted}"`);
          analysis.market = converted;
          analysis.alerts = [
            ...(analysis.alerts || []),
            `🛡️ Mercado "${original}" inválido após o intervalo (min ${min}'). Substituído por "${converted}".`,
          ];
          if (analysis.risk_management) {
            const oddLabel = analysis.odd != null ? analysis.odd : '—';
            analysis.risk_management.entry = `${converted} @ ${oddLabel}`;
          }
        } else {
          // Após min 70 não há mais como salvar uma entrada de 1T — vetar
          console.log(`[MycroftSports] 🚫 HT GUARD: "${original}" no min ${min}' → VETADO (impossível entrar em mercado de 1T após o HT)`);
          analysis.verdict = 'VETADO';
          analysis.market = 'N/A';
          analysis.confidence = 0;
          analysis.thesis = `🚫 Mercado "${original}" inválido: o 1º tempo já terminou (min ${min}').`;
          analysis.alerts = [
            ...(analysis.alerts || []),
            `🚫 Veto automático: mercado de 1º tempo ("${original}") solicitado no min ${min}'.`,
          ];
          analysis.risk_management = null;
        }
      }

      // Limpa additional_markets de qualquer mercado HT inválido
      if (Array.isArray(analysis.additional_markets) && min >= 45) {
        const before = analysis.additional_markets.length;
        analysis.additional_markets = analysis.additional_markets.filter((am: any) => !isHtMarket(am?.market));
        const removed = before - analysis.additional_markets.length;
        if (removed > 0) {
          console.log(`[MycroftSports] 🛡️ HT GUARD: ${removed} additional_market(s) HT removido(s) no min ${min}'`);
        }
      }
    }

    // === VALIDAR ADDITIONAL_MARKETS ===
    // Regra dura: máx 1 mercado adicional, conf≥75%, não correlacionado, não oposto,
    // não após min 70'. Qualidade > quantidade (reduz volume e eleva ROI).
    if (analysis.additional_markets?.length > 0 && (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL' || analysis.verdict === 'LABAREDA')) {
      const bankroll = match.bankroll ?? 500;
      const primaryMarket = String(analysis.market || '');
      const minNow = match.minute ?? 0;

      // Helpers de correlação/oposição (mercados de gols escalonados são correlacionados)
      const normMarket = (s: string) => String(s || '').toLowerCase().trim();
      const isOver = (s: string) => /over\s*\d/.test(normMarket(s)) || /mais\s*\d/.test(normMarket(s));
      const isUnder = (s: string) => /under\s*\d/.test(normMarket(s)) || /menos\s*\d/.test(normMarket(s));
      const overLine = (s: string): number | null => {
        const m = normMarket(s).match(/(?:over|mais|under|menos)\s*(\d+(?:\.\d+)?)/);
        return m ? parseFloat(m[1]) : null;
      };
      const isBTTS = (s: string) => /ambas\s*marcam|btts|both\s*teams\s*to\s*score/i.test(s || '');
      const isBackTeam = (s: string) => /back\s+(mandante|visitante|casa|fora|home|away)|vit[óo]ria\s+(mandante|visitante|casa|fora)/i.test(s || '');

      const correlated = (primary: string, extra: string): boolean => {
        // Mesmo mercado
        if (normMarket(primary) === normMarket(extra)) return true;
        // Overs/Unders escalonados (Over 1.5 vs Over 2.5 etc) — correlacionados
        const lp = overLine(primary); const le = overLine(extra);
        if (lp != null && le != null && ((isOver(primary) && isOver(extra)) || (isUnder(primary) && isUnder(extra)))) return true;
        // Over linha alta + BTTS (mesma tese de gols)
        if ((isOver(primary) && isBTTS(extra)) || (isBTTS(primary) && isOver(extra))) {
          const line = lp ?? le ?? 0;
          if (line >= 2.5) return true;
        }
        // Back time + Over (geralmente mesma tese: dominante marca)
        if ((isBackTeam(primary) && isOver(extra)) || (isOver(primary) && isBackTeam(extra))) return true;
        return false;
      };

      analysis.additional_markets = analysis.additional_markets
        .filter((am: any) => {
          if (!am?.market || !am?.confidence) return false;
          if (am.confidence < 75) return false; // novo limiar (era 60)
          if (am.market === primaryMarket) return false;
          // Bloqueia mercados opostos (Over X.5 vs Under X.5 da mesma linha)
          const opposites: Record<string, string> = {
            'Over 0.5 Total': 'Under 0.5 Total', 'Over 1.5 Total': 'Under 1.5 Total',
            'Over 2.5 Total': 'Under 2.5 Total', 'Over 3.5 Total': 'Under 3.5 Total',
          };
          if (opposites[am.market] === primaryMarket || opposites[primaryMarket] === am.market) return false;
          // Bloqueia correlacionados
          if (correlated(primaryMarket, am.market)) {
            console.log(`[MycroftSports] 🚫 Additional bloqueado (correlacionado): "${am.market}" vs principal "${primaryMarket}"`);
            return false;
          }
          // Bloqueia novos sinais após min 70 (exceto se já é LABAREDA, mas additional não é LABAREDA)
          if (minNow >= 70) {
            console.log(`[MycroftSports] 🚫 Additional bloqueado (min ${minNow}' ≥ 70'): "${am.market}"`);
            return false;
          }
          return true;
        })
        .slice(0, 1) // máx 1 adicional (era 2)
        .map((am: any) => ({
          ...am,
          stake_percent: Math.min(am.stake_percent || 2, 2),
          stake_value: bankroll * Math.min(am.stake_percent || 2, 2) / 100,
        }));
      if (analysis.additional_markets.length > 0) {
        console.log(`[MycroftSports] 📊 1 mercado adicional aprovado: ${analysis.additional_markets.map((m: any) => m.market).join(', ')}`);
      }
    } else {
      analysis.additional_markets = [];
    }

    // === GUARDA DE TEMPO: nenhum sinal novo após min 70' (exceto LABAREDA) ===
    {
      const minNow = match.minute ?? 0;
      if (
        minNow >= 70 &&
        (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL') &&
        analysis.verdict !== 'LABAREDA'
      ) {
        console.log(`[MycroftSports] ⏱️ Veto 70': ${match.home} vs ${match.away} no min ${minNow}' — ${analysis.verdict} → CUIDADO (apenas LABAREDA permitido após 70')`);
        analysis.verdict = 'CUIDADO';
        analysis.alerts = [
          ...(analysis.alerts || []),
          `⏱️ Sinal vetado por tempo: aprovações novas só até min 70' (exceto LABAREDA).`,
        ];
        // additional_markets já foram limpos acima quando min ≥ 70
        analysis.additional_markets = [];
      }
    }


    // === BAS (Bluffer Asset Score) — composite quality score ===
    {
      let bas = 0;
      bas += Math.min(40, Math.round((analysis.confidence || 0) * 0.4));
      const odd = analysis.odd || 0;
      if (odd >= 1.40 && odd <= 3.00) bas += 20;
      else if (odd > 3.00 && odd <= 5.00) bas += 10;
      else if (odd > 1.10 && odd < 1.40) bas += 5;
      if (analysis.plan_name) bas += 20;
      // Situational approval gets a small plan-like bonus
      if (analysis.situational_rule) bas += 10;
      const met = analysis.criterios_atendidos?.length || 0;
      const missing = analysis.criterios_ausentes?.length || 0;
      if (met > 0 && missing === 0) bas += 20;
      else if (met > missing) bas += Math.min(15, Math.round((met / (met + missing)) * 15));

      analysis.asset_score = Math.min(100, bas);
      analysis.asset_classification =
        bas >= 80 ? 'ELITE' :
        bas >= 65 ? 'PREMIUM' :
        bas >= 50 ? 'FORTE' : 'ESPECULATIVO';
    }

    console.log(`[MycroftSports] Final: ${analysis.verdict} | Plan: ${analysis.plan_name || analysis.situational_rule || 'DIRETO'} | Conf: ${analysis.confidence}% | BAS: ${analysis.asset_score} (${analysis.asset_classification})`);

    // === CACHE WRITE === Salva análise para reaproveitar enquanto stats não mudarem
    try {
      // JOGO_MORTO/CUIDADO podem virar a qualquer momento → cache curto (30s)
      // Outros verdicts podem cachear normalmente (90s)
      const isVolatile = analysis.verdict === 'JOGO_MORTO' || analysis.verdict === 'CUIDADO';
      const expiresAt = new Date(Date.now() + (isVolatile ? 30 : 90) * 1000).toISOString();
      await supabaseAdminCache
        .from('ai_response_cache')
        .upsert({
          function_name: 'mycroft-sports-analysis',
          cache_key: cacheKey,
          response_json: analysis,
          expires_at: expiresAt,
          hit_count: 0,
        }, { onConflict: 'cache_key' });
      console.log(`[MycroftSports] 💾 Cache SAVED (TTL ${isVolatile ? 30 : 90}s, verdict=${analysis.verdict})`);
    } catch (e) {
      console.warn('[MycroftSports] Cache write failed:', (e as Error).message);
    }

    await run.success({
      statusCode: 200,
      context: { match_id: match?.match_id, minute: match?.minute, verdict: analysis?.verdict },
    });
    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[MycroftSports] Error:', error);
    await logEdgeError("mycroft-sports-analysis", error).catch(() => {});
    await run.error(error, { statusCode: 500 });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
