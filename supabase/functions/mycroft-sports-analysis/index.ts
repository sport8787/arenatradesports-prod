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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `You are Mycroft, elite forensic sports trading analyst. DECIDE APROVADO or VETADO for every match with stats. Only AGUARDAR if stats are literally all zeros or min < 25. CRITICAL: plan_name MUST be one of the loaded plans or null. NEVER invent plan names.\n\n${prompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                verdict: { type: 'STRING', enum: ['APROVADO', 'VETADO', 'AGUARDAR'] },
                plan_name: { type: 'STRING', nullable: true, enum: planEnumValues },
                market: { type: 'STRING' },
                odd: { type: 'NUMBER' },
                confidence: { type: 'INTEGER' },
                thesis: { type: 'STRING' },
                criterios_atendidos: { type: 'ARRAY', items: { type: 'STRING' } },
                criterios_ausentes: { type: 'ARRAY', items: { type: 'STRING' } },
                fundamentation: { type: 'OBJECT', properties: { source: { type: 'STRING' }, citation: { type: 'STRING' }, pattern: { type: 'STRING' }, historical_wr: { type: 'STRING' } } },
                risk_management: { type: 'OBJECT', properties: { stake_percent: { type: 'NUMBER' }, entry: { type: 'STRING' }, stop: { type: 'STRING' }, target: { type: 'STRING' }, rr: { type: 'STRING' }, ev: { type: 'STRING' } } },
                alerts: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['verdict', 'market', 'odd', 'confidence', 'thesis', 'risk_management', 'alerts'],
            },
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MycroftSports] Gemini error ${response.status}:`, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'Payment required' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
        console.warn(`[MycroftSports] VETO: ${analysis.plan_name} com ${analysis.criterios_ausentes.length} critérios ausentes`);
        await getSupabaseAdmin().from("mycroft_vetoed_log").insert({
          jogo: `${match.home} vs ${match.away}`,
          liga: match.championship,
          mercado: analysis.market,
          odd: analysis.odd,
          confianca_recebida: analysis.confidence,
          verdict_gemini: 'APROVADO_INCONSISTENTE',
          motivo_veto: `Critérios ausentes para ${planCode}: ${analysis.criterios_ausentes.join(', ')}`,
          raw_response: analysis,
        });
        analysis.verdict = 'VETADO';
        analysis.alerts = [...(analysis.alerts || []), `Plano ${planCode} com critérios ausentes: ${analysis.criterios_ausentes.join(', ')}`];
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

    console.log(`[MycroftSports] Final: ${analysis.verdict} | Plan: ${analysis.plan_name || 'DIRETO'} | Conf: ${analysis.confidence}%`);

    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[MycroftSports] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
