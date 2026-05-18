// Edge Function: mycroft-corners-punter
// Analisa mercado de escanteios PRÉ-JOGO para o Arena Punter
// Busca dados históricos da API-Football e retorna veredicto no formato padrão Punter
// ISOLADO: prompt próprio, lógica própria, sem dependência de IDs externos

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  smSearchTeam,
  getRecentFixturesSM,
  getCornersForFixtureSM,
} from "../_shared/sportmonks-af-adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// API-Football removida em Fase 2 (18/05/2026) — corners vêm exclusivamente do Sportmonks.
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";

// Fonte de dados: Sportmonks
const DATA_SOURCE: 'sportmonks' = 'sportmonks';

// ════════════════════════════════════════════════════
// BUSCAR TEAM ID POR NOME (Sportmonks)
// ════════════════════════════════════════════════════
async function buscarTeamIdPorNome(teamName: string): Promise<{ id: number; name: string } | null> {
  const r = await smSearchTeam(teamName);
  if (r) console.log(`[Corners-SM] Team found: "${teamName}" → SM ID ${r.id} (${r.name})`);
  else console.warn(`[Corners-SM] Team not found: "${teamName}"`);
  return r;
}

// ════════════════════════════════════════════════════
// BUSCAR FIXTURES RECENTES DO TIME
// ════════════════════════════════════════════════════
async function buscarFixturesRecentes(teamId: number, _season: number, limit: number = 8) {
  return await getRecentFixturesSM(teamId, limit);
}

// ════════════════════════════════════════════════════
// BUSCAR ESTATÍSTICAS DE UM FIXTURE (Corner Kicks) — Sportmonks
// ════════════════════════════════════════════════════
async function buscarEstatisticasFixture(fixtureId: number, teamId: number): Promise<number> {
  return await getCornersForFixtureSM(fixtureId, teamId);
}

// ════════════════════════════════════════════════════
// MONTAR PERFIL HISTÓRICO DO TIME
// ════════════════════════════════════════════════════
async function montarPerfilTime(teamId: number, teamName: string, season: number, ehMandante: boolean) {
  const fixtures = await buscarFixturesRecentes(teamId, season, 10);

  if (!fixtures.length) {
    console.warn(`[Corners] No fixtures found for ${teamName} (ID: ${teamId}, season: ${season})`);
    return null;
  }

  const nomeTime = fixtures[0]?.teams?.home?.id === teamId
    ? fixtures[0]?.teams?.home?.name
    : fixtures[0]?.teams?.away?.name;

  const jogosCasa = fixtures.filter((f: any) => f.teams.home.id === teamId);
  const jogosFora = fixtures.filter((f: any) => f.teams.away.id === teamId);

  // Buscar corners limitando chamadas de API (max 6 jogos por time)
  const jogosPrioritarios = ehMandante
    ? [...jogosCasa.slice(0, 4), ...jogosFora.slice(0, 2)]
    : [...jogosFora.slice(0, 4), ...jogosCasa.slice(0, 2)];

  console.log(`[Corners] Fetching stats for ${nomeTime}: ${jogosPrioritarios.length} fixtures`);

  const cornersPromises = jogosPrioritarios.map(async (f: any) => {
    const corners = await buscarEstatisticasFixture(f.fixture.id, teamId);
    const ehCasa = f.teams.home.id === teamId;
    return { corners, ehCasa };
  });

  const resultados = await Promise.all(cornersPromises);

  const todosCanto = resultados.map(r => r.corners);
  const cantoCasa = resultados.filter(r => r.ehCasa).map(r => r.corners);
  const cantoFora = resultados.filter(r => !r.ehCasa).map(r => r.corners);

  const avg = (arr: number[]) => arr.length
    ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10
    : 0;

  const mediaGeral = avg(todosCanto);
  const mediaCasa = avg(cantoCasa);
  const mediaFora = avg(cantoFora);
  const media1T = Math.round(mediaGeral * 0.45 * 10) / 10;
  const mediaCasa1T = Math.round((mediaCasa || mediaGeral) * 0.45 * 10) / 10;

  return {
    nome: nomeTime || teamName,
    team_id: teamId,
    media_geral: mediaGeral,
    media_casa: mediaCasa || mediaGeral,
    media_fora: mediaFora || mediaGeral,
    media_1t_estimada: media1T,
    media_casa_1t_estimada: mediaCasa1T,
    ultimos_jogos: todosCanto.slice(0, 6),
    total_jogos_analisados: resultados.length,
  };
}

// ════════════════════════════════════════════════════
// CALCULAR MÉDIAS COMBINADAS
// ════════════════════════════════════════════════════
function calcularMediasCombinadas(mandante: any, visitante: any) {
  const media_m_casa = mandante.media_casa;
  const media_v_fora = visitante.media_fora;
  const total_estimado = media_m_casa + media_v_fora;
  const diferenca_m_v = media_m_casa - media_v_fora;

  const desvio = (arr: number[]) => {
    if (arr.length < 2) return 5;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.map(x => (x - m) ** 2).reduce((a, b) => a + b) / arr.length);
  };

  const consistencia_m = mandante.ultimos_jogos.length >= 4
    ? Math.max(0, 100 - desvio(mandante.ultimos_jogos) * 15)
    : 50;

  return {
    total_estimado: Math.round(total_estimado * 10) / 10,
    diferenca_m_v: Math.round(diferenca_m_v * 10) / 10,
    media_m_casa,
    media_v_fora,
    consistencia_m: Math.round(consistencia_m),
  };
}

// ════════════════════════════════════════════════════
// 5 MÉTODOS DE ANÁLISE
// ════════════════════════════════════════════════════

function metodoComparativo(m: any, v: any, combinado: any) {
  const { diferenca_m_v, media_m_casa } = combinado;
  const aprovado = diferenca_m_v >= 1.5 && media_m_casa >= 5.0;
  const entrada = diferenca_m_v >= 2.0 ? `${m.nome} -1.5 cantos` : `${m.nome} mais cantos`;
  return {
    metodo: "COMPARATIVO", plano: "PLANO DOMINÂNCIA", entrada,
    mercado: "Escanteios Comparativo / Handicap", aprovado,
    edge: aprovado ? Math.min(15, Math.round(diferenca_m_v * 4)) : 0,
    confianca: aprovado ? Math.min(82, 58 + diferenca_m_v * 5 + (combinado.consistencia_m > 70 ? 5 : 0)) : 0,
    odd_minima: 1.70, stake: diferenca_m_v >= 2.5 ? 3 : 2,
    motivo: aprovado
      ? `${m.nome} faz ${media_m_casa} em casa vs ${v.nome} faz ${v.media_fora} fora. Diferença de ${diferenca_m_v} cantos.`
      : `Diferença insuficiente (${diferenca_m_v}). Mínimo: 1.5`,
  };
}

function metodoOverUnder(m: any, v: any, combinado: any) {
  const { total_estimado } = combinado;
  let linha: number, direcao: "Over" | "Under";
  if (total_estimado <= 7.5) { linha = 8.5; direcao = "Under"; }
  else if (total_estimado <= 9.0) { linha = 9.5; direcao = "Under"; }
  else if (total_estimado >= 12.0) { linha = 10.5; direcao = "Over"; }
  else if (total_estimado >= 11.0) { linha = 10.5; direcao = "Over"; }
  else { linha = 9.5; direcao = total_estimado < 9.5 ? "Under" : "Over"; }
  const margem = Math.abs(total_estimado - linha);
  const aprovado = margem >= 1.0;
  const edge = Math.min(14, Math.round(margem * 4));
  return {
    metodo: "OVER_UNDER", plano: direcao === "Under" ? "PLANO BUNKER" : "PLANO DILÚVIO",
    entrada: `${direcao} ${linha} escanteios`, mercado: `Total Escanteios ${direcao} ${linha}`,
    aprovado, edge: aprovado ? edge : 0,
    confianca: aprovado ? Math.min(80, 55 + edge * 1.5) : 0,
    odd_minima: 1.65, stake: edge >= 8 ? 3 : 2,
    motivo: aprovado
      ? `Total estimado ${total_estimado} escanteios. ${direcao} ${linha} com margem de ${margem.toFixed(1)}.`
      : `Margem insuficiente para ${direcao} ${linha} (estimado: ${total_estimado}).`,
  };
}

function metodoPrelive1T(m: any, _v: any) {
  const media1T = m.media_casa_1t_estimada;
  const aprovado = media1T >= 2.5 && m.media_casa >= 5.0;
  const edge = aprovado ? Math.min(12, Math.round((media1T - 2.5) * 10)) : 0;
  return {
    metodo: "PRELIVE_1T", plano: "PLANO ECLIPSE",
    entrada: `${m.nome} Over 2.5 escanteios no 1T`,
    mercado: "Escanteios 1º Tempo Over 2.5", aprovado, edge,
    confianca: aprovado ? Math.min(78, 55 + edge * 1.8) : 0,
    odd_minima: 1.55, stake: 2,
    motivo: aprovado
      ? `${m.nome} faz ~${media1T} escanteios no 1T em casa (estimado). Favorável.`
      : `Média de escanteios no 1T insuficiente (${media1T}). Mínimo: 2.5`,
  };
}

function metodoTresElementos(m: any) {
  const aprovado = m.media_casa >= 5.5;
  const edge = aprovado ? Math.min(10, Math.round((m.media_casa - 5.5) * 5)) : 0;
  return {
    metodo: "TRES_ELEMENTOS", plano: "PLANO AVALANCHE",
    entrada: `3 entradas: ambos marcam canto 0-10min + ${m.nome} Over 4.5 1T (cashout) + Over 2.5 cantos ao vivo`,
    mercado: "Multi-entrada (pré-jogo + ao vivo)", aprovado, edge,
    confianca: aprovado ? Math.min(75, 52 + edge * 2) : 0,
    odd_minima: 1.60, stake: 2,
    motivo: aprovado
      ? `${m.nome} faz ${m.media_casa} em casa. Estratégia 3 elementos viável.`
      : `Média insuficiente (${m.media_casa}). Precisa ≥ 5.5 em casa.`,
  };
}

function metodoValueBetting(combinado: any) {
  const { total_estimado } = combinado;
  const linha = 9.5;
  const probOver = total_estimado > linha
    ? Math.min(0.78, 0.50 + (total_estimado - linha) * 0.055)
    : Math.max(0.22, 0.50 - (linha - total_estimado) * 0.055);
  const probUnder = 1 - probOver;
  const oddJustaOver = Math.round((1 / probOver) * 100) / 100;
  const oddJustaUnder = Math.round((1 / probUnder) * 100) / 100;
  const oddMercadoOver = 1.85;
  const oddMercadoUnder = 1.85;
  const edgeOver = ((oddMercadoOver / oddJustaOver) - 1) * 100;
  const edgeUnder = ((oddMercadoUnder / oddJustaUnder) - 1) * 100;
  const melhor = edgeOver >= edgeUnder ? "Over" : "Under";
  const edgeFinal = Math.max(edgeOver, edgeUnder);
  const aprovado = edgeFinal >= 4;
  return {
    metodo: "VALUE_EV", plano: melhor === "Over" ? "PLANO DILÚVIO" : "PLANO BUNKER",
    entrada: `${melhor} ${linha} escanteios (odd justa: ${melhor === "Over" ? oddJustaOver : oddJustaUnder})`,
    mercado: `Total Escanteios ${melhor} ${linha}`, aprovado,
    edge: Math.round(edgeFinal),
    confianca: aprovado ? Math.min(78, 52 + Math.round(edgeFinal * 2)) : 0,
    odd_minima: melhor === "Over" ? oddJustaOver + 0.05 : oddJustaUnder + 0.05,
    stake: edgeFinal >= 8 ? 3 : 2,
    motivo: aprovado
      ? `Odd justa Over ${oddJustaOver} / Under ${oddJustaUnder}. Edge de ${edgeFinal.toFixed(1)}% no ${melhor}.`
      : `Edge insuficiente (${edgeFinal.toFixed(1)}%). Mínimo: 4%.`,
  };
}

// ════════════════════════════════════════════════════
// PROMPT ISOLADO — MYCROFT CORNERS PUNTER
// ════════════════════════════════════════════════════
const CORNERS_SYSTEM_PROMPT = `Você é o Mycroft Corners Punter — especialista exclusivo em mercado de ESCANTEIOS.
Sua única função é analisar dados históricos de corners e emitir um veredicto no formato JSON.

REGRAS ABSOLUTAS:
1. Retorne APENAS JSON válido, sem markdown, sem texto adicional
2. Só aprove se os dados históricos justificarem (nunca invente dados)
3. Siga rigorosamente os critérios de Tier abaixo
4. Se dados forem insuficientes (< 4 jogos), VETE automaticamente

CRITÉRIOS DE TIER:
- TIER 1 (Elite): Edge ≥ 7% + Confiança ≥ 78% + ≥3 métodos aprovados + média casa ≥ 6.0
- TIER 2 (Forte): Edge ≥ 5% + Confiança ≥ 70% + ≥2 métodos aprovados + média casa ≥ 5.5
- TIER 3 (Valor): Edge ≥ 4% + Confiança ≥ 65% + ≥1 método aprovado

VETO OBRIGATÓRIO quando:
- total_estimado entre 9.0 e 10.5 sem margem clara
- Últimos jogos com alta variância (ex: 2, 12, 3, 11)
- Jogos analisados < 4
- Copa ou mata-mata

5 MÉTODOS QUE RECEBE:
1. COMPARATIVO (PLANO DOMINÂNCIA) — mandante domina escanteios
2. OVER_UNDER (PLANO BUNKER/DILÚVIO) — total acima/abaixo da linha
3. PRELIVE_1T (PLANO ECLIPSE) — mandante Over 2.5 cantos no 1T
4. TRES_ELEMENTOS (PLANO AVALANCHE) — 3 entradas sequenciais
5. VALUE_EV (PLANO BUNKER/DILÚVIO) — odd justa vs mercado

FORMATO DE RESPOSTA (JSON puro):
{
  "verdict": "APROVADO_TIER_1" | "APROVADO_TIER_2" | "APROVADO_TIER_3" | "VETADO",
  "tier": 1 | 2 | 3 | null,
  "market": "Over X.X Escanteios" | "Under X.X Escanteios" | etc,
  "bookmaker": "Verificar melhor odd",
  "odd": 0.00,
  "edge_percentage": 0.0,
  "confidence": 0,
  "stake_percentage": 0,
  "plano_ativado": "PLANO XXXX",
  "thesis": "Resumo em 1 frase",
  "analysis": "Análise em 2 frases",
  "risk_factors": "Principal risco"
}`;

async function gerarVeredictoMycroft(
  mandante: any, visitante: any, liga: string,
  combinado: any, metodos: any[]
) {
  const aprovados = metodos.filter(m => m.aprovado);
  if (!aprovados.length) return null;

  const melhor = aprovados.sort((a, b) =>
    (b.edge * 0.6 + b.confianca * 0.4) - (a.edge * 0.6 + a.confianca * 0.4)
  )[0];

  const userPrompt = `JOGO: ${mandante.nome} vs ${visitante.nome} (${liga})

DADOS HISTÓRICOS COLETADOS DA API-FOOTBALL:
- ${mandante.nome} em casa: média ${mandante.media_casa} escanteios (últimos: ${mandante.ultimos_jogos.slice(0, 5).join(", ")}) [${mandante.total_jogos_analisados} jogos]
- ${visitante.nome} fora: média ${visitante.media_fora} escanteios (últimos: ${visitante.ultimos_jogos.slice(0, 5).join(", ")}) [${visitante.total_jogos_analisados} jogos]
- Total estimado: ${combinado.total_estimado}
- Diferença mandante-visitante: ${combinado.diferenca_m_v}
- Consistência mandante: ${combinado.consistencia_m}%

MÉTODOS APROVADOS (${aprovados.length}/5):
${aprovados.map((m: any) => `- ${m.plano} (${m.metodo}): ${m.entrada} | Edge: ${m.edge}% | Confiança: ${m.confianca}%`).join("\n")}

MÉTODOS VETADOS:
${metodos.filter(m => !m.aprovado).map((m: any) => `- ${m.metodo}: ${m.motivo}`).join("\n")}

Emita o veredicto JSON:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: CORNERS_SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Entendido. Aguardando dados do jogo para análise de escanteios." }] },
            { role: "user", parts: [{ text: userPrompt }] },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
        })
      }
    );
    const data = await res.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const json = texto.replace(/```json|```/g, "").trim();
    console.log(`[Corners] Gemini response for ${mandante.nome} vs ${visitante.nome}: ${json.substring(0, 200)}`);
    return JSON.parse(json);
  } catch (err) {
    console.error(`[Corners] Gemini parse error:`, err);
    // Fallback manual
    return {
      verdict: melhor.edge >= 7 ? "APROVADO_TIER_1" : melhor.edge >= 5 ? "APROVADO_TIER_2" : "APROVADO_TIER_3",
      tier: melhor.edge >= 7 ? 1 : melhor.edge >= 5 ? 2 : 3,
      market: melhor.entrada,
      bookmaker: "Verificar",
      odd: melhor.odd_minima,
      edge_percentage: melhor.edge,
      confidence: melhor.confianca,
      stake_percentage: melhor.stake,
      plano_ativado: melhor.plano,
      thesis: melhor.motivo,
      analysis: `${mandante.nome} média ${mandante.media_casa} casa. Total estimado ${combinado.total_estimado}.`,
      risk_factors: "Verificar odds reais antes de executar",
    };
  }
}

// ════════════════════════════════════════════════════
// MAIN — ENTRY POINT
// ════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name,
      liga = "Liga não informada",
      season = 2025,
    } = body;
    // data_source ignorado — Sportmonks fixo (Fase 2)
    console.log(`[Corners] data_source=${DATA_SOURCE} (forçado)`);

    if (!home_team_name || !away_team_name) {
      return new Response(
        JSON.stringify({ error: "home_team_name e away_team_name são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Corners] ═══ Iniciando análise: ${home_team_name} vs ${away_team_name} (${liga}) ═══`);

    // ── PASSO 1: Resolver team IDs (buscar por nome se não informados) ──
    let resolvedHomeId = home_team_id && home_team_id > 0 ? home_team_id : 0;
    let resolvedAwayId = away_team_id && away_team_id > 0 ? away_team_id : 0;

    if (!resolvedHomeId || !resolvedAwayId) {
      console.log(`[Corners] Buscando team IDs por nome...`);
      const [homeSearch, awaySearch] = await Promise.all([
        !resolvedHomeId ? buscarTeamIdPorNome(home_team_name) : Promise.resolve(null),
        !resolvedAwayId ? buscarTeamIdPorNome(away_team_name) : Promise.resolve(null),
      ]);

      if (homeSearch) resolvedHomeId = homeSearch.id;
      if (awaySearch) resolvedAwayId = awaySearch.id;
    }

    if (!resolvedHomeId || !resolvedAwayId) {
      console.warn(`[Corners] Could not resolve team IDs: home=${resolvedHomeId}, away=${resolvedAwayId}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Times não encontrados na API-Football",
          mandante: home_team_name,
          visitante: away_team_name,
          aprovados_count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Corners] Team IDs resolved: ${home_team_name}=${resolvedHomeId}, ${away_team_name}=${resolvedAwayId}`);

    // ── PASSO 2-3: Coletar dados históricos em paralelo ──
    const [perfilMandante, perfilVisitante] = await Promise.all([
      montarPerfilTime(resolvedHomeId, home_team_name, season, true),
      montarPerfilTime(resolvedAwayId, away_team_name, season, false),
    ]);

    if (!perfilMandante && !perfilVisitante) {
      console.warn(`[Corners] No historical data for either team`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Sem dados históricos suficientes",
          mandante: home_team_name,
          visitante: away_team_name,
          aprovados_count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mandante = perfilMandante || {
      nome: home_team_name, team_id: resolvedHomeId,
      media_geral: 5.0, media_casa: 5.0, media_fora: 4.5,
      media_1t_estimada: 2.3, media_casa_1t_estimada: 2.3,
      ultimos_jogos: [5, 5, 6, 4, 5], total_jogos_analisados: 0,
    };

    const visitante = perfilVisitante || {
      nome: away_team_name, team_id: resolvedAwayId,
      media_geral: 4.5, media_casa: 5.0, media_fora: 4.0,
      media_1t_estimada: 2.0, media_casa_1t_estimada: 2.3,
      ultimos_jogos: [4, 4, 5, 3, 5], total_jogos_analisados: 0,
    };

    // ── PASSO 4: Calcular médias ──
    const combinado = calcularMediasCombinadas(mandante, visitante);

    console.log(`[Corners] Combinado: total=${combinado.total_estimado}, diff=${combinado.diferenca_m_v}, consist=${combinado.consistencia_m}%`);

    // ── PASSO 5: Rodar 5 métodos ──
    const metodos = [
      metodoComparativo(mandante, visitante, combinado),
      metodoOverUnder(mandante, visitante, combinado),
      metodoPrelive1T(mandante, visitante),
      metodoTresElementos(mandante),
      metodoValueBetting(combinado),
    ];

    const aprovadosCount = metodos.filter(m => m.aprovado).length;

    console.log(`[Corners] Métodos aprovados: ${aprovadosCount}/5 → ${metodos.filter(m => m.aprovado).map(m => m.metodo).join(", ") || "nenhum"}`);

    // ── PASSO 6: Gerar veredicto via Gemini (se há aprovados) ──
    let veredicto = null;
    if (aprovadosCount > 0) {
      veredicto = await gerarVeredictoMycroft(mandante, visitante, liga, combinado, metodos);
    }

    const response = {
      success: true,
      mandante: mandante.nome,
      visitante: visitante.nome,
      liga,
      perfil_mandante: mandante,
      perfil_visitante: visitante,
      combinado,
      metodos,
      aprovados_count: aprovadosCount,
      veredicto,
      planos_ativados: metodos.filter(m => m.aprovado).map(m => m.plano),
    };

    console.log(`[Corners] ═══ Resultado: ${mandante.nome} vs ${visitante.nome} → ${aprovadosCount} aprovados, verdict: ${veredicto?.verdict || "N/A"} ═══`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Corners] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno", success: false, aprovados_count: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
