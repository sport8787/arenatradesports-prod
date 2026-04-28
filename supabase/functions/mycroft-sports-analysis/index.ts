import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
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
  const apiKey = Deno.env.get('API_FOOTBALL_KEY');
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, { headers: { 'x-apisports-key': apiKey } });
    if (!res.ok) return null;
    const data = await res.json();
    const teams = data.response;
    if (!teams || teams.length < 2) return null;
    const [h, a] = [teams[0].statistics || [], teams[1].statistics || []];
    const p = (v: string | null) => parseInt((v || '0').replace('%', ''), 10) || 0;
    const siH = parseInt(findStat(h, 'Shots insidebox') || '0', 10);
    const siA = parseInt(findStat(a, 'Shots insidebox') || '0', 10);
    return {
      attacks_home: siH + parseInt(findStat(h, 'Shots outsidebox') || '0', 10),
      attacks_away: siA + parseInt(findStat(a, 'Shots outsidebox') || '0', 10),
      dangerous_attacks_home: siH, dangerous_attacks_away: siA,
      possession_home: p(findStat(h, 'Ball Possession')), possession_away: p(findStat(a, 'Ball Possession')),
      shots_home: parseInt(findStat(h, 'Shots on Goal') || '0', 10), shots_away: parseInt(findStat(a, 'Shots on Goal') || '0', 10),
      shots_total_home: parseInt(findStat(h, 'Total Shots') || '0', 10), shots_total_away: parseInt(findStat(a, 'Total Shots') || '0', 10),
      shots_on_target_home: parseInt(findStat(h, 'Shots on Goal') || '0', 10), shots_on_target_away: parseInt(findStat(a, 'Shots on Goal') || '0', 10),
      xG_home: parseFloat(findStat(h, 'expected_goals') || '0'), xG_away: parseFloat(findStat(a, 'expected_goals') || '0'),
    };
  } catch { return null; }
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
const MYCROFT_TRADER_BASE = `
# ORÁCULO MYCROFT — ANALISTA DE TRADING ESPORTIVO

Você é Mycroft, o Oráculo da Bluffer Entertainment. Analista de trading esportivo profissional com 7+ anos de experiência e win rate comprovado de 68%.

## MISSÃO
Analisar jogos de futebol AO VIVO e identificar oportunidades de valor usando os PLANOS ESTRATÉGICOS OFICIAIS carregados da base de dados.
Aprovar 30-40% dos jogos analisados. Menos de 30% = conservador demais. Mais de 50% = frouxo.

## MÚLTIPLAS ENTRADAS POR JOGO
Um mesmo jogo pode ter MÚLTIPLAS oportunidades em mercados diferentes. Quando identificar mais de uma oportunidade com valor, retorne mercados adicionais no campo "additional_markets".
Exemplos de cenários com múltiplas entradas válidas:
- Over 2.5 Total + Back time dominante (mercados independentes)
- Over 0.5 HT + Ambas marcam (se ambos atacam no 1T)
- Back favorito + Over 1.5 Total (jogo aberto com favorito pressionando)
REGRAS para additional_markets:
1. Máximo 2 mercados adicionais (total 3 contando o principal)
2. Cada mercado adicional DEVE ter fundamento independente
3. NÃO incluir mercados opostos (ex: Over 2.5 + Under 2.5)
4. NÃO duplicar o mercado principal
5. Cada mercado adicional precisa de confidence >= 60%
6. Stake dos adicionais NUNCA excede 2% (são complementares)

## PRINCÍPIO CENTRAL
Nenhum jogo ao vivo é descartado até o apito final. A análise é contínua. O que muda é a intensidade e a frequência de reavaliação.
VETADO NÃO EXISTE. Todo jogo tem potencial de oportunidade em algum momento.

## ⚖️ NEUTRALIDADE CASA × VISITANTE (REGRA INVIOLÁVEL)
A análise é ESTRITAMENTE SIMÉTRICA. Quem está dominando AGORA (xG, finalizações no gol, posse efetiva, big chances, ataques perigosos, momentum) é o DOMINANTE — não importa se joga em casa ou fora.
- Se o VISITANTE domina, ele recebe Back, Over a favor, Lay no adversário etc. — exatamente como o mandante receberia em situação inversa.
- PROIBIDO exigir "time da casa favorito" como gatilho. Onde planos legados disserem "casa", leia "FAVORITO DO JOGO AO VIVO" (quem está performando melhor).
- PROIBIDO descontar confiança ou descartar oportunidade pelo simples fato de o lado dominante ser o visitante.
- Fator de mandante NÃO sobrepõe estatísticas ao vivo. O placar/estatística manda; mandante é ruído.

A leitura "+home/-away" do momentum é apenas SINAL MATEMÁTICO (positivo = casa, negativo = visitante), não juízo de valor. Momentum negativo forte = visitante dominando = oportunidade legítima a favor do visitante.

## FILOSOFIA CORE
> "Aposta esportiva é NÚMERO, é jogo de probabilidade e MAIS NADA!"
1. PADRÕES > Intuição — Encontre padrões nos eventos
2. Dados > Emoção — Zero clubismo
3. Assimetria = Lucro — Desequilíbrio estatístico é oportunidade
4. Gestão > Método — Stake variável por risco do plano, stop loss claro

## REGRAS ABSOLUTAS DOS PLANOS
1. Nomear um PLANO apenas quando 100% dos critérios forem atendidos
2. Se nenhum PLANO bater todos os critérios → usar plan_name: null e analisar diretamente
3. Nomear o plano errado é pior que não nomear nenhum
4. PROIBIDO INVENTAR NOMES DE PLANOS — só os da MATRIZ abaixo
5. Em caso de dúvida → JOGO_MORTO (nunca VETADO)
6. Formato obrigatório quando ativar: "🔱 MYCROFT ATIVOU — [NOME DO PLANO]" na thesis

## GESTÃO DE RISCO
- RISCO ALTO: stake 2-3% da banca
- RISCO MÉDIO: stake 3-4% da banca
- RISCO BAIXO-MÉDIO: stake 4-5% da banca
- Risk:Reward mínimo: 1:1.5
- Exposição máxima simultânea: 15% da banca

═══════════════════════════════════════════════════════
SISTEMA DE STATUS DINÂMICOS (6 ESTADOS)
═══════════════════════════════════════════════════════

✅ APROVADO — Sinal ativo com stake definido. Não reanalisar.
✅ APROVADO_SITUACIONAL — Aprovado pelo módulo de leitura situacional. Stake máx 2%.
⚡ LABAREDA — Jogo "morto" na análise padrão mas com potencial de inversão/gol tardio.
   Ativado quando:
   - Time perdendo após min 60 com necessidade de gol
   - Odds de empate ou virada em queda brusca
   - Minuto 70+ com placar de 1 gol de diferença
   Mercados: Back time perdedor, Over próximo gol, Ambas marcam
   Stake: VALOR (2%) — risco elevado, odd alta
⚠️ CUIDADO — Jogo com potencial mas com fatores de risco ativos.
   Exemplos:
   - Time dominante com jogador expulso
   - Odds se movendo contra a análise (steam move)
   - Jogo truncado, muitas interrupções
   Ação: monitorar sem aprovar até fator de risco resolver
💀 JOGO_MORTO — Sem oportunidade técnica viável NESTE MOMENTO.
   NÃO é permanente. Reanalisar periodicamente — jogo pode mudar.
   ⚠️ REGRA OBRIGATÓRIA 1: NUNCA classificar como JOGO_MORTO antes do minuto 20.
   Antes do minuto 20, usar AGUARDAR (contexto insuficiente para determinar jogo morto).
   ⚠️ REGRA OBRIGATÓRIA 2: NUNCA classificar como JOGO_MORTO se:
   - Placar tem gols (1-0, 1-1, 2-1, etc.) E diferença ≤ 2 gols E minuto < 80
   - Total de finalizações ≥ 4 ou finalizações no alvo ≥ 2
   - Um time tem posse ≥ 55% e está atacando
   Nesses casos usar CUIDADO (jogo ativo com potencial) ou AGUARDAR.
   JOGO_MORTO é APENAS para jogos REALMENTE parados: 0-0 sem chutes, ou goleada 3+ gols com time perdedor sem atacar.
   Exemplos válidos de JOGO_MORTO (após min 20):
   - 0-0 minuto 30, 0 finalizações no alvo de ambos os lados
   - 4-0 minuto 80 sem time perdedor atacando
   Exemplos INVÁLIDOS (NÃO usar JOGO_MORTO):
   - Qualquer jogo antes do minuto 20
   - Jogo 1-0 com finalizações ativas (usar CUIDADO)
   - Jogo 1-1 ou 2-1 em qualquer minuto (usar CUIDADO)
   - Jogo com xG total ≥ 0.5 (usar CUIDADO ou AGUARDAR)
🕐 AGUARDAR — Contexto se desenvolvendo. Aguardar antes de decidir.

REGRA CRÍTICA: NUNCA use "VETADO". Use JOGO_MORTO, CUIDADO, LABAREDA ou AGUARDAR.

═══════════════════════════════════════════════════════
TRANSIÇÕES DE STATUS PERMITIDAS
═══════════════════════════════════════════════════════
JOGO_MORTO → LABAREDA: min ≥ 60 E time perdendo por 1 gol
JOGO_MORTO → AGUARDAR: mudança tática ou gol muda dinâmica
AGUARDAR → APROVADO: todos critérios atingidos
AGUARDAR → CUIDADO: critérios quase atingidos + fator de risco
CUIDADO → APROVADO: fator de risco resolvido ou odd compensa
CUIDADO → JOGO_MORTO: fator de risco se agrava
LABAREDA → APROVADO: time perdedor aumenta pressão + odd com valor
LABAREDA → JOGO_MORTO: diferença sobe para 2+ ou time desiste
Qualquer → APROVADO é irreversível (sinal emitido)

═══════════════════════════════════════════════════════
PLANO LABAREDA — OPORTUNIDADE TARDIA
═══════════════════════════════════════════════════════
GATILHOS (mínimo 2 de 4):
1. Time perdendo por exatamente 1 gol após min 65
2. xG acumulado do time perdedor ≥ 0.8 sem conversão
3. Odd do próximo gol do time perdedor ≥ 2.5
4. ≥ 3 escanteios do time perdedor nos últimos 10 min
Mercados: Back time perdedor, Ambas marcam, Over próximo gol, Over X.5 total
Stake: VALOR (2%)

═══════════════════════════════════════════════════════
MÓDULO DE LEITURA SITUACIONAL (OVERRIDE)
═══════════════════════════════════════════════════════

Quando o resultado for JOGO_MORTO por critérios insuficientes (ausência de dados),
execute este módulo ANTES de confirmar.

REGRA S1 — PRESSÃO DOMINANTE PRÉ-GOL
Condições (todas): Min 5-35, Placar 0-0 ou 1-0, xG dominante ≥ 0.4 ou ≥ 2 finalizações no alvo,
Posse dominante ≥ 58%, Adversário sem finalização no alvo
Mercados: Over 0.5 HT, Over 1.5 total, Back dominante | Tier VALOR (2%) | Conf ≥ 65%

REGRA S2 — PLACAR EXPRESSIVO EM JOGO ABERTO
Condições (todas): Min 20-60, Placar ≥ 2-0 ou ≥ 3-1, xG total ≥ 2.0, Perdedor posse ≥ 40%
Mercados: Over 0.5 próximo gol, Over 3.5 total, Back vencedor | Tier VALOR (2%) | Conf ≥ 68%

REGRA S3 — MATA-MATA COM OBRIGAÇÃO
Condições (todas): Fase eliminatória, Time perdendo agregado, Diferença 1-2 gols
Mercados: Over 0.5 próximo gol, Back time obrigado, Over 2.5 total
Tier FORTE (3%) se dif=1, VALOR (2%) se dif=2

REGRA S4 — ESCANTEIOS EM PRESSÃO ACUMULADA
Condições (todas): Min 10-40, ≥ 4 escanteios e ≤ 1 gol, xG ≥ 0.6 sem gol
Mercados: Over X escanteios, Over 0.5 HT | Tier VALOR (2%) | Conf ≥ 65%

ANTI-ABUSO: Máx 2 aprovações situacionais/partida. Não situacional após min 70. Stake máx 2%.
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
    const criterios = criteriosArr.map((c, i) => `  ${i+1}. ${c}`).join('\n') || '  (sem critérios definidos)';
    const vetos = vetosArr.map(v => `  ✗ ${v}`).join('\n') || '  (sem vetos definidos)';
    return `${p.emoji} **${p.nome.toUpperCase()}** [${p.codigo}] — ${p.categoria}
Mercado: ${p.mercado} | Janela: ${p.janela} | Risco: ${p.risco}
Conceito: ${p.conceito}
Execução: ${p.execucao}
${p.observacao ? `Obs: ${p.observacao}` : ''}
CRITÉRIOS (TODOS obrigatórios):
${criterios}
VETOS (qualquer um invalida):
${vetos}`;
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
`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const run = startEdgeRun("mycroft-sports-analysis");
  try {
    // Migrado para Gemini direto (v1beta OpenAI-compatible). Plano pago configurado.
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const AI_KEY = GEMINI_API_KEY;
    const AI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    const AI_MODEL = 'gemini-2.5-flash';
    if (!AI_KEY) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json() as { match: MatchData & Record<string, unknown> };
    const match = body?.match;
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

    // Load planos from table + memory rules in parallel (NO MORE KB)
    const [planos, memoryRules] = await Promise.all([loadPlanos(), loadMemoryRules()]);

    if (!planos.length) {
      return new Response(JSON.stringify({ error: 'Nenhum plano estratégico ativo encontrado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = buildPrompt(match, planos, memoryRules);

    // Build valid plan_name enum from loaded plans
    const planEnumValues = planos.map(p => `PLANO ${p.nome.replace('Plano ', '').toUpperCase()}`);

    const response = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: 'Você é Mycroft, analista forense de trading esportivo de elite. Use os status: APROVADO, APROVADO_SITUACIONAL, LABAREDA, CUIDADO, JOGO_MORTO ou AGUARDAR. NUNCA use VETADO — ele não existe mais. JOGO_MORTO = sem oportunidade agora (temporário). LABAREDA = potencial de gol tardio/inversão (min 60+). CUIDADO = potencial com fatores de risco. Só use AGUARDAR se stats forem LITERALMENTE todas zero. Se tem posse, chutes ou ataques, OBRIGATÓRIO decidir APROVADO, LABAREDA, CUIDADO ou JOGO_MORTO. CRÍTICO: plan_name DEVE ser um dos planos carregados ou null. NUNCA invente nomes. IDIOMA: tudo em português brasileiro.' },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'sports_analysis',
            description: 'Return the structured sports trading analysis. Include additional_markets when multiple independent opportunities exist.',
            parameters: {
              type: 'object',
              properties: {
                verdict: { type: 'string', enum: ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA', 'CUIDADO', 'JOGO_MORTO', 'AGUARDAR'] },
                plan_name: { type: 'string', nullable: true, enum: planEnumValues },
                market: { type: 'string' },
                odd: { type: 'number' },
                confidence: { type: 'integer' },
                thesis: { type: 'string' },
                criterios_atendidos: { type: 'array', items: { type: 'string' } },
                criterios_ausentes: { type: 'array', items: { type: 'string' } },
                fundamentation: { type: 'object', properties: { source: { type: 'string' }, citation: { type: 'string' }, pattern: { type: 'string' }, historical_wr: { type: 'string' } } },
                risk_management: { type: 'object', properties: { stake_percent: { type: 'number' }, entry: { type: 'string' }, stop: { type: 'string' }, target: { type: 'string' }, rr: { type: 'string' }, ev: { type: 'string' } } },
                alerts: { type: 'array', items: { type: 'string' } },
                additional_markets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      market: { type: 'string' },
                      odd: { type: 'number' },
                      confidence: { type: 'integer' },
                      thesis: { type: 'string' },
                      stake_percent: { type: 'number' },
                    },
                    required: ['market', 'odd', 'confidence', 'thesis', 'stake_percent'],
                  },
                },
              },
              required: ['verdict', 'market', 'odd', 'confidence', 'thesis', 'risk_management', 'alerts'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'sports_analysis' } },
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MycroftSports] AI error ${response.status} (${LOVABLE_API_KEY ? 'lovable' : 'openai'}):`, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'Payment required' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();

    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let rawText = '';
    if (toolCall?.function?.arguments) {
      rawText = toolCall.function.arguments;
    } else {
      rawText = data.choices?.[0]?.message?.content || '';
    }
    console.log('[MycroftSports] Raw:', rawText.substring(0, 300));

    let analysis;
    try {
      analysis = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch (parseErr) {
      // Fallback repair
      const vm = rawText.match(/"verdict"\s*:\s*"(APROVADO|JOGO_MORTO|LABAREDA|CUIDADO|AGUARDAR)"/);
      if (!vm) throw parseErr;
      const mm = rawText.match(/"market"\s*:\s*"([^"]+)"/);
      const om = rawText.match(/"odd"\s*:\s*([\d.]+)/);
      analysis = {
        verdict: vm[1], market: mm?.[1] || 'N/A', odd: om ? parseFloat(om[1]) : 1.50,
        confidence: parseInt(rawText.match(/"confidence"\s*:\s*(\d+)/)?.[1] || '50'),
        thesis: rawText.match(/"thesis"\s*:\s*"([^"]*)/)?.[1] || 'Análise parcial',
        alerts: [], fundamentation: {}, risk_management: { stake_percent: 5, entry: 'N/A', stop: 'N/A', target: 'N/A', rr: '1:1.5', ev: '+10%' },
      };
    }

    // === GUARD TEMPORAL UNDER 2.5 ===
    // Veta qualquer aprovação de Under 2.5 antes do minuto 10 — jogos só "esquentam" depois disso.
    // Antes do min 10, ausência de ações ofensivas é o estado padrão (não viés confirmatório).
    if (
      analysis.verdict === 'APROVADO' &&
      typeof analysis.market === 'string' &&
      /under\s*2\.?5/i.test(analysis.market) &&
      (match.minute ?? 0) < 10
    ) {
      const motivoVeto = `Under 2.5 aprovado prematuramente (min ${match.minute ?? 0} < 10). Jogo precisa de janela de confirmação até o min 10 antes de validar baixa atividade.`;
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
      analysis.alerts = [...(analysis.alerts || []), `⏱️ Under 2.5 só pode ser aprovado a partir do minuto 10 — aguardar janela de confirmação.`];
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
    // CUIDADO com fundamento sólido (confiança ≥ 65% e mercado definido) vira sinal ativo
    // com stake conservador (2%). Evita acumular jogos com tese clara sem nunca emitir sinal.
    if (
      analysis.verdict === 'CUIDADO' &&
      typeof analysis.confidence === 'number' &&
      analysis.confidence >= 65 &&
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
        `🔼 Promovido de CUIDADO para APROVADO_SITUACIONAL — stake reduzido a 2% por fatores de risco residuais.`,
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

      const u_isEarly = u_min >= 10 && u_min <= 30;
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
        const scoreOk = score >= oppScore;

        let criteriaMet = 0;
        if (possOk) criteriaMet++;
        if (volumeOk) criteriaMet++;
        if (insideBoxOk) criteriaMet++;
        if (defenseOk) criteriaMet++;
        if (xgOk) criteriaMet++;

        return { ok: criteriaMet >= 4 && scoreOk && d_min >= 15, criteriaMet };
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

      // APROVAÇÃO server-side
      if (
        dominantTeam &&
        !d_priorActiveSignal &&
        analysis.verdict !== 'APROVADO' &&
        analysis.verdict !== 'APROVADO_SITUACIONAL' &&
        analysis.plan_name !== 'CANCELAMENTO BACK AO DOMINANTE'
      ) {
        const odd = dominantTeam === 'home' ? (match.odds?.home ?? 0) : (match.odds?.away ?? 0);
        const teamName = dominantTeam === 'home' ? match.home : match.away;
        const dPoss = dominantTeam === 'home' ? possH : possA;
        const dShotsTotal = dominantTeam === 'home' ? shotsTotalH : shotsTotalA;
        const dShotsOn = dominantTeam === 'home' ? shotsOnH : shotsOnA;
        const dShotsInside = dominantTeam === 'home' ? shotsInsideH : shotsInsideA;
        const dXg = dominantTeam === 'home' ? xgHd : xgAd;

        if (odd >= 1.40 && odd <= 2.20) {
          console.log(`[MycroftSports] 👑 OVERRIDE APROVADO: Back Dominante ${teamName} (odd ${odd}) — ${match.home} vs ${match.away} (${d_min}')`);
          analysis.verdict = 'APROVADO';
          analysis.plan_name = 'PLANO BACK AO DOMINANTE';
          analysis.market = `Back ${teamName}`;
          analysis.odd = odd;
          analysis.confidence = 78;
          analysis.thesis = `🔱 MYCROFT ATIVOU — PLANO BACK AO DOMINANTE. ${teamName} dominando: posse ${dPoss}%, ${dShotsTotal} finalizações (${dShotsOn} no alvo), ${dShotsInside} ataques perigosos, xG ${dXg.toFixed(2)}. Adversário sem reação. Odd ${odd} com valor.`;
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
            `✅ Time dominante: ${teamName}. Monitorar se mantém supremacia.`,
            `⚠️ Se sofrer gol ou estatísticas se igualarem por 5 min, cancelar sinal.`,
          ];
          analysis.fundamentation = {
            ...(analysis.fundamentation || {}),
            override: 'server_side_back_dominante',
            criteria_met: dominantTeam === 'home' ? homeDom.criteriaMet : awayDom.criteriaMet,
            stats_snapshot: { possH, possA, shotsTotalH, shotsTotalA, shotsOnH, shotsOnA, shotsInsideH, shotsInsideA, xgH: xgHd, xgA: xgAd, minute: d_min },
          };
        } else if (odd > 0 && odd < 1.40) {
          analysis.alerts = [...(analysis.alerts || []), `⚠️ Time dominante ${teamName} com odd ${odd} muito baixa (<1.40). Sem valor.`];
        } else if (odd > 2.20) {
          analysis.alerts = [...(analysis.alerts || []), `⚠️ Time dominante ${teamName} com odd ${odd} acima de 2.20. Aguardar.`];
        } else if (odd === 0) {
          analysis.alerts = [...(analysis.alerts || []), `ℹ️ Dominância detectada (${teamName}) mas odd Match Odds não disponível para validação.`];
        }
      }
    }

    // === MÓDULO DE LEITURA SITUACIONAL (server-side override) ===
    // Se JOGO_MORTO por dados insuficientes, tentar regras S1-S4
    if (analysis.verdict === 'JOGO_MORTO' || analysis.verdict === 'APROVADO_SITUACIONAL') {
      const isDataGapDead = analysis.verdict === 'JOGO_MORTO' && (
        (analysis.alerts || []).some((a: string) => /dados ausentes|dados insuficientes|sem dados|confiança.*penalidade|critérios.*ausentes/i.test(a)) ||
        (analysis.criterios_ausentes?.length > 0)
      );
      const isAISituational = analysis.verdict === 'APROVADO_SITUACIONAL';

      if (isDataGapDead || isAISituational) {
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
        const domXg = homeDominant ? xgH : xgA;
        const domPoss = homeDominant ? possH : possA;
        const domSot = homeDominant ? sotH : sotA;
        const oppSot = homeDominant ? sotA : sotH;
        const domGoals = homeDominant ? scoreH : scoreA;
        const domName = homeDominant ? match.home : match.away;

        // REGRA S1
        if (!situationalRule && min >= 5 && min <= 35) {
          const placarOk = (scoreH + scoreA) <= 1;
          const xgOk = domXg >= 0.4 || domSot >= 2;
          const possOk = domPoss >= 58;
          const oppClean = oppSot === 0;
          if ((homeDominant || awayDominant) && placarOk && xgOk && possOk && oppClean) {
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
        if (!situationalRule && min >= 10 && min <= 40 && (homeDominant || awayDominant)) {
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
    if (analysis.additional_markets?.length > 0 && (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL' || analysis.verdict === 'LABAREDA')) {
      const bankroll = match.bankroll ?? 500;
      const primaryMarket = analysis.market;
      analysis.additional_markets = analysis.additional_markets
        .filter((am: any) => {
          if (!am.market || !am.odd || !am.confidence) return false;
          if (am.confidence < 60) return false;
          if (am.market === primaryMarket) return false;
          // Block opposite markets
          const opposites: Record<string, string> = {
            'Over 0.5 Total': 'Under 0.5 Total', 'Over 1.5 Total': 'Under 1.5 Total',
            'Over 2.5 Total': 'Under 2.5 Total', 'Over 3.5 Total': 'Under 3.5 Total',
          };
          if (opposites[am.market] === primaryMarket || opposites[primaryMarket] === am.market) return false;
          return true;
        })
        .slice(0, 2)
        .map((am: any) => ({
          ...am,
          stake_percent: Math.min(am.stake_percent || 2, 2),
          stake_value: bankroll * Math.min(am.stake_percent || 2, 2) / 100,
        }));
      if (analysis.additional_markets.length > 0) {
        console.log(`[MycroftSports] 📊 ${analysis.additional_markets.length} mercado(s) adicional(is): ${analysis.additional_markets.map((m: any) => m.market).join(', ')}`);
      }
    } else {
      analysis.additional_markets = [];
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
