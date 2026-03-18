import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
}

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
5. Em caso de dúvida → VETAR
6. Formato obrigatório quando ativar: "🔱 MYCROFT ATIVOU — [NOME DO PLANO]" na thesis

## GESTÃO DE RISCO
- RISCO ALTO: stake 2-3% da banca
- RISCO MÉDIO: stake 3-4% da banca
- RISCO BAIXO-MÉDIO: stake 4-5% da banca
- Risk:Reward mínimo: 1:1.5
- Exposição máxima simultânea: 15% da banca

═══════════════════════════════════════════════════════
MÓDULO DE LEITURA SITUACIONAL (OVERRIDE PARCIAL DE VETO)
═══════════════════════════════════════════════════════

Quando o resultado for VETADO por "critérios insuficientes" (ausência de dados históricos),
execute este módulo ANTES de confirmar o veto final.

O objetivo é distinguir:
  ✗ VETO real     = critério avaliado e reprovado
  ✓ AGUARDAR      = critério não avaliável por falta de dados
  ✓ APROVADO_SITUACIONAL = contexto de jogo substitui histórico

REGRAS DE LEITURA SITUACIONAL:

REGRA S1 — PRESSÃO DOMINANTE PRÉ-GOL
Condições obrigatórias (todas):
  - Minuto entre 5 e 35
  - Placar: 0-0 ou 1-0
  - xG do time dominante ≥ 0.4 (ou ≥ 2 finalizações no alvo)
  - Posse do time dominante ≥ 58% nos últimos 10 minutos
  - Time adversário sem finalização no alvo
Mercados: Over 0.5 HT (antes do intervalo), Over 1.5 total (antes min 30), Back time dominante
Tier: VALOR (stake 2%) | Confiança mínima: 65%

REGRA S2 — PLACAR EXPRESSIVO EM JOGO ABERTO
Condições obrigatórias (todas):
  - Minuto entre 20 e 60
  - Placar ≥ 2-0 OU ≥ 3-1
  - xG total ≥ 2.0
  - Time perdedor com posse ≥ 40% (jogo aberto)
Mercados: Over 0.5 próximo gol, Over 3.5 total (placar 2-0 antes min 40), Back time vencedor
Tier: VALOR (stake 2%) | Confiança mínima: 68%

REGRA S3 — MATA-MATA COM OBRIGAÇÃO DE VIRAR
Condições obrigatórias (todas):
  - Competição: fase eliminatória (Champions, Europa League, Libertadores, Copa do Brasil, copas nacionais)
  - Time perdendo no agregado
  - Diferença agregada de 1 ou 2 gols
Mercados: Over 0.5 próximo gol, Back time com obrigação, Over 2.5 total (se min < 60)
Tier: FORTE (stake 3%) se diferença = 1 gol | VALOR (stake 2%) se diferença = 2 gols

REGRA S4 — ESCANTEIOS EM PRESSÃO ACUMULADA
Condições obrigatórias (todas):
  - Minuto entre 10 e 40
  - Time dominante com ≥ 4 escanteios e ≤ 1 gol marcado
  - xG ≥ 0.6 sem gol convertido
Mercados: Over X escanteios, Over 0.5 HT
Tier: VALOR (stake 2%) | Confiança mínima: 65%

LÓGICA DE DECISÃO COM MÓDULO SITUACIONAL:
1. Executar análise padrão (filtros 1-5 do prompt principal)
2. Se VETADO por critérios insuficientes (dados ausentes):
   → Verificar regras S1-S4 → Se alguma atende → verdict: APROVADO_SITUACIONAL
   → Informar qual regra ativou (situational_rule: "S1"/"S2"/"S3"/"S4")
3. Se VETADO por critério técnico reprovado (edge negativo, prob < 40%):
   → NÃO executar módulo situacional. Veto permanece.

ANTI-ABUSO:
- Máximo 2 aprovações situacionais por partida
- Não aprovar situacional após minuto 70
- Stake máximo: VALOR (2%) — NUNCA ELITE por leitura situacional
`;


function buildPrompt(match: MatchData, planos: any[], memoryRules: string): string {
  const s = match.stats || {};

  // Montar matriz de planos dinamicamente da tabela
  const validPlanNames = planos.map(p => `PLANO ${p.nome.replace('Plano ', '').toUpperCase()}`);

  const matrizPlanos = planos.map(p => {
    const criterios = (p.criterios as string[]).map((c: string, i: number) => `  ${i+1}. ${c}`).join('\n');
    const vetos = (p.vetos as string[]).map((v: string) => `  ✗ ${v}`).join('\n');
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
xG: ${s.xG_home ?? '?'} vs ${s.xG_away ?? '?'}

Banca do trader: R$ ${match.bankroll ?? 500}
`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { match } = await req.json() as { match: MatchData };
    if (!match) return new Response(JSON.stringify({ error: 'Match data required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    console.log(`[MycroftSports] Analyzing: ${match.home} vs ${match.away} (${match.minute}')`);

    // If stats empty, try API-Football
    if (statsAreEmpty(match.stats) && match.match_id) {
      const liveStats = await fetchStatsFromApiFootball(match.match_id);
      if (liveStats && !statsAreEmpty(liveStats)) {
        match.stats = liveStats;
        try { await getSupabaseAdmin().from('live_matches').update({ stats: liveStats, updated_at: new Date().toISOString() }).eq('match_id', match.match_id); } catch {}
      }
    }

    // Load planos from table + memory rules in parallel (NO MORE KB)
    const [planos, memoryRules] = await Promise.all([loadPlanos(), loadMemoryRules()]);

    if (!planos.length) {
      return new Response(JSON.stringify({ error: 'Nenhum plano estratégico ativo encontrado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = buildPrompt(match, planos, memoryRules);

    // Build valid plan_name enum from loaded plans
    const planEnumValues = planos.map(p => `PLANO ${p.nome.replace('Plano ', '').toUpperCase()}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é Mycroft, analista forense de trading esportivo de elite. DECIDA APROVADO ou VETADO para cada jogo com estatísticas. Só use AGUARDAR se as stats forem LITERALMENTE todas zero. Se tem posse, chutes ou ataques disponíveis, OBRIGATÓRIO dar APROVADO ou VETADO. xG zero NÃO é motivo para AGUARDAR se há outras métricas. CRÍTICO: plan_name DEVE ser um dos planos carregados ou null. NUNCA invente nomes de planos. REGRA DE IDIOMA: Todas as respostas (thesis, alerts, market, todos os campos de texto) DEVEM ser em português brasileiro. NUNCA responda em inglês.' },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'sports_analysis',
            description: 'Return the structured sports trading analysis.',
            parameters: {
              type: 'object',
              properties: {
                verdict: { type: 'string', enum: ['APROVADO', 'VETADO', 'AGUARDAR', 'APROVADO_SITUACIONAL'] },
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
              },
              required: ['verdict', 'market', 'odd', 'confidence', 'thesis', 'risk_management', 'alerts'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'sports_analysis' } },
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MycroftSports] AI Gateway error ${response.status}:`, errorText);
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
      const vm = rawText.match(/"verdict"\s*:\s*"(APROVADO|VETADO|AGUARDAR)"/);
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
        analysis.verdict = 'VETADO';
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
          analysis.verdict = 'VETADO';
          analysis.alerts = [...(analysis.alerts || []), `Plano ${planCode} vetado: dados históricos insuficientes — ${structuralMissing.join(', ')}`];
        } else if (dataGapMissing.length > 0) {
          // Caso 1: Falta de dados históricos (API não forneceu) → Penalizar confiança, não vetar automaticamente
          const originalConfidence = analysis.confidence;
          const penalty = 15 * dataGapMissing.length;
          analysis.confidence = Math.max(0, analysis.confidence - penalty);

          console.log(`[MycroftSports] ⚠️ ${analysis.plan_name}: ${dataGapMissing.length} critério(s) com dados não fornecidos. Confiança ${originalConfidence}% → ${analysis.confidence}% (-${penalty}pp)`);

          if (analysis.confidence >= 65) {
            // Aprovado com penalidade — dados ausentes não invalidam se a confiança se mantém
            analysis.alerts = [...(analysis.alerts || []),
              `Plano ${planCode}: ${dataGapMissing.length} critério(s) sem dados da API — confiança reduzida de ${originalConfidence}% para ${analysis.confidence}%`,
              ...dataGapMissing.map(c => `⚠️ Critério sem dado: ${c}`),
            ];
            console.log(`[MycroftSports] ✅ ${analysis.plan_name} APROVADO com penalidade (conf ${analysis.confidence}% ≥ 65%)`);
          } else {
            // Confiança caiu abaixo de 65% → VETO
            console.warn(`[MycroftSports] VETO: ${analysis.plan_name} — confiança pós-penalidade ${analysis.confidence}% < 65%`);
            await getSupabaseAdmin().from("mycroft_vetoed_log").insert({
              jogo: `${match.home} vs ${match.away}`,
              liga: match.championship,
              mercado: analysis.market,
              odd: analysis.odd,
              confianca_recebida: originalConfidence,
              edge_recebido: analysis.confidence,
              verdict_gemini: 'APROVADO_PENALIZADO',
              motivo_veto: `Confiança pós-penalidade ${analysis.confidence}% < 65% (original: ${originalConfidence}%, -${penalty}pp por dados ausentes)`,
              raw_response: analysis,
            });
            analysis.verdict = 'VETADO';
            analysis.alerts = [...(analysis.alerts || []),
              `Plano ${planCode}: confiança ${originalConfidence}% → ${analysis.confidence}% após penalidade por dados ausentes (limiar 65%)`,
            ];
          }
        }
      }
    }

    // Ensure odd/risk_management defaults for APROVADO
    if (analysis.verdict === 'APROVADO') {
      if (!analysis.odd || analysis.odd <= 0) {
        analysis.odd = 1.50;
        analysis.alerts = [...(analysis.alerts || []), 'Odd estimada automaticamente'];
      }
      if (!analysis.risk_management || typeof analysis.risk_management !== 'object' || !Object.keys(analysis.risk_management).length) {
        const bankroll = match.bankroll ?? 500;
        analysis.risk_management = { stake_percent: 5, stake_value: bankroll * 0.05, entry: `${analysis.market} @ ${analysis.odd}`, stop: 'Condição adversa', target: 'Realização do mercado', rr: `1:${analysis.odd}`, ev: `+${Math.round((analysis.confidence / 100 * analysis.odd - 1) * 100)}%` };
      }
    }
    if (analysis.risk_management && !analysis.risk_management.stake_value && analysis.risk_management.stake_percent) {
      analysis.risk_management.stake_value = (match.bankroll ?? 500) * analysis.risk_management.stake_percent / 100;
    }

    // === BAS (Bluffer Asset Score) — composite quality score ===
    {
      let bas = 0;
      // 1. Confidence (0-40 pts)
      bas += Math.min(40, Math.round((analysis.confidence || 0) * 0.4));
      // 2. Odd value sweet spot 1.40-3.00 (0-20 pts)
      const odd = analysis.odd || 0;
      if (odd >= 1.40 && odd <= 3.00) bas += 20;
      else if (odd > 3.00 && odd <= 5.00) bas += 10;
      else if (odd > 1.10 && odd < 1.40) bas += 5;
      // 3. Plan activated (0-20 pts)
      if (analysis.plan_name) bas += 20;
      // 4. Criteria met vs missing (0-20 pts)
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

    console.log(`[MycroftSports] Final: ${analysis.verdict} | Plan: ${analysis.plan_name || 'DIRETO'} | Conf: ${analysis.confidence}% | BAS: ${analysis.asset_score} (${analysis.asset_classification})`);

    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[MycroftSports] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
