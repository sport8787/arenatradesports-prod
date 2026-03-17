// Edge Function: mycroft-corners-punter
// Analisa mercado de escanteios PRÉ-JOGO para o Arena Punter
// Busca dados históricos da API-Football e retorna veredicto no formato padrão Punter
// Deploy: supabase functions deploy mycroft-corners-punter

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_KEY = Deno.env.get("API_FOOTBALL_KEY") || "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const BASE_URL = "https://v3.football.api-sports.io";

// ════════════════════════════════════════════════════
// PASSO 1 — BUSCAR FIXTURES RECENTES DO TIME
// Retorna últimos N jogos do time na temporada atual
// ════════════════════════════════════════════════════
async function buscarFixturesRecentes(teamId: number, season: number, limit: number = 8) {
  const url = `${BASE_URL}/fixtures?team=${teamId}&season=${season}&last=${limit}&status=FT`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  const data = await res.json();
  return data.response || [];
}

// ════════════════════════════════════════════════════
// PASSO 2 — BUSCAR ESTATÍSTICAS DE UM FIXTURE
// Retorna corner kicks do time naquele jogo
// ════════════════════════════════════════════════════
async function buscarEstatisticasFixture(fixtureId: number, teamId: number) {
  const url = `${BASE_URL}/fixtures/statistics?fixture=${fixtureId}&team=${teamId}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  const data = await res.json();
  const stats = data.response?.[0]?.statistics || [];
  const corners = stats.find((s: any) => s.type === "Corner Kicks");
  return parseInt(corners?.value || "0") || 0;
}

// ════════════════════════════════════════════════════
// PASSO 3 — MONTAR PERFIL HISTÓRICO DO TIME
// Coleta escanteios nos últimos jogos separando casa/fora
// ════════════════════════════════════════════════════
async function montarPerfilTime(teamId: number, season: number, ehMandante: boolean) {
  const fixtures = await buscarFixturesRecentes(teamId, season, 10);

  if (!fixtures.length) return null;

  const nomeTime = fixtures[0]?.teams?.home?.id === teamId
    ? fixtures[0]?.teams?.home?.name
    : fixtures[0]?.teams?.away?.name;

  // Separar jogos em casa e fora
  const jogosCasa = fixtures.filter((f: any) => f.teams.home.id === teamId);
  const jogosFora = fixtures.filter((f: any) => f.teams.away.id === teamId);

  // Buscar corners de cada jogo (limitado para não estourar API)
  const jogosPrioritarios = ehMandante
    ? [...jogosCasa.slice(0, 5), ...jogosFora.slice(0, 3)]
    : [...jogosFora.slice(0, 5), ...jogosCasa.slice(0, 3)];

  const cornersPromises = jogosPrioritarios.map(async (f: any) => {
    const corners = await buscarEstatisticasFixture(f.fixture.id, teamId);
    const ehCasa = f.teams.home.id === teamId;
    const golsFeitos = ehCasa ? f.goals.home : f.goals.away;
    const resultado = ehCasa
      ? (f.goals.home > f.goals.away ? "V" : f.goals.home < f.goals.away ? "D" : "E")
      : (f.goals.away > f.goals.home ? "V" : f.goals.away < f.goals.home ? "D" : "E");
    return { corners, ehCasa, resultado, golsFeitos };
  });

  const resultados = await Promise.all(cornersPromises);

  // Calcular médias
  const todosCanto = resultados.map(r => r.corners);
  const cantoCasa = resultados.filter(r => r.ehCasa).map(r => r.corners);
  const cantoFora = resultados.filter(r => !r.ehCasa).map(r => r.corners);

  const avg = (arr: number[]) => arr.length
    ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10
    : 0;

  // Estimar 1T como ~45% do total (padrão geral do futebol)
  const mediaGeral = avg(todosCanto);
  const mediaCasa = avg(cantoCasa);
  const mediaFora = avg(cantoFora);
  const media1T = Math.round(mediaGeral * 0.45 * 10) / 10;
  const mediaCasa1T = Math.round(mediaCasa * 0.45 * 10) / 10;

  return {
    nome: nomeTime,
    team_id: teamId,
    media_geral: mediaGeral,
    media_casa: mediaCasa || mediaGeral,
    media_fora: mediaFora || mediaGeral,
    media_1t_estimada: media1T,
    media_casa_1t_estimada: mediaCasa1T,
    ultimos_jogos: todosCanto.slice(0, 6),
    total_jogos_analisados: resultados.length,
    jogos_casa_analisados: cantoCasa.length,
    jogos_fora_analisados: cantoFora.length,
  };
}

// ════════════════════════════════════════════════════
// PASSO 4 — CALCULAR MÉDIAS COMBINADAS
// Base para todos os 5 métodos de análise
// ════════════════════════════════════════════════════
function calcularMediasCombinadas(mandante: any, visitante: any) {
  const media_m_casa = mandante.media_casa;
  const media_v_fora = visitante.media_fora;
  const total_estimado = media_m_casa + media_v_fora;
  const diferenca_m_v = media_m_casa - media_v_fora;

  // Desvio padrão simplificado dos últimos jogos
  const desvio = (arr: number[]) => {
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
// PASSO 5 — RODAR 5 MÉTODOS DE ANÁLISE
// ════════════════════════════════════════════════════

// Método 1 — Aposta Comparativa (mandante domina escanteios)
function metodoComparativo(m: any, v: any, combinado: any) {
  const { diferenca_m_v, media_m_casa } = combinado;
  const aprovado = diferenca_m_v >= 1.5 && media_m_casa >= 5.0;
  const entrada = diferenca_m_v >= 2.0 ? `${m.nome} -1.5 cantos` : `${m.nome} mais cantos`;

  return {
    metodo: "COMPARATIVO",
    plano: "PLANO DOMINÂNCIA",
    entrada,
    mercado: "Escanteios Comparativo / Handicap",
    aprovado,
    edge: aprovado ? Math.min(15, Math.round(diferenca_m_v * 4)) : 0,
    confianca: aprovado ? Math.min(82, 58 + diferenca_m_v * 5 + (combinado.consistencia_m > 70 ? 5 : 0)) : 0,
    odd_minima: 1.70,
    stake: diferenca_m_v >= 2.5 ? 3 : 2,
    motivo: aprovado
      ? `${m.nome} faz ${media_m_casa} em casa vs ${v.nome} faz ${v.media_fora} fora. Diferença de ${diferenca_m_v} cantos.`
      : `Diferença insuficiente (${diferenca_m_v}). Mínimo: 1.5`,
  };
}

// Método 2 — Over/Under Total
function metodoOverUnder(m: any, v: any, combinado: any, linhaOverride?: number) {
  const { total_estimado } = combinado;

  // Definir melhor linha automaticamente
  let linha: number, direcao: "Over" | "Under";
  if (total_estimado <= 7.5) { linha = 8.5; direcao = "Under"; }
  else if (total_estimado <= 9.0) { linha = 9.5; direcao = "Under"; }
  else if (total_estimado >= 12.0) { linha = 10.5; direcao = "Over"; }
  else if (total_estimado >= 11.0) { linha = 10.5; direcao = "Over"; }
  else { linha = linhaOverride || 9.5; direcao = total_estimado < 9.5 ? "Under" : "Over"; }

  const margem = Math.abs(total_estimado - linha);
  const aprovado = margem >= 1.0;
  const edge = Math.min(14, Math.round(margem * 4));

  return {
    metodo: "OVER_UNDER",
    plano: direcao === "Under" ? "PLANO BUNKER" : "PLANO DILÚVIO",
    entrada: `${direcao} ${linha} escanteios`,
    mercado: `Total Escanteios ${direcao} ${linha}`,
    aprovado,
    edge: aprovado ? edge : 0,
    confianca: aprovado ? Math.min(80, 55 + edge * 1.5) : 0,
    odd_minima: 1.65,
    stake: edge >= 8 ? 3 : 2,
    motivo: aprovado
      ? `Total estimado ${total_estimado} escanteios. ${direcao} ${linha} com margem de ${margem.toFixed(1)}.`
      : `Margem insuficiente para ${direcao} ${linha} (estimado: ${total_estimado}).`,
  };
}

// Método 3 — Pré-Live 1T (mandante Over 2.5 no 1T)
function metodoPrelive1T(m: any, v: any) {
  const media1T = m.media_casa_1t_estimada;
  const aprovado = media1T >= 2.5 && m.media_casa >= 5.0;
  const edge = aprovado ? Math.min(12, Math.round((media1T - 2.5) * 10)) : 0;

  return {
    metodo: "PRELIVE_1T",
    plano: "PLANO ECLIPSE",
    entrada: `${m.nome} Over 2.5 escanteios no 1T`,
    mercado: "Escanteios 1º Tempo Over 2.5",
    aprovado,
    edge,
    confianca: aprovado ? Math.min(78, 55 + edge * 1.8) : 0,
    odd_minima: 1.55,
    stake: 2,
    motivo: aprovado
      ? `${m.nome} faz ~${media1T} escanteios no 1T em casa (estimado). Favorável.`
      : `Média de escanteios no 1T insuficiente (${media1T}). Mínimo: 2.5`,
  };
}

// Método 4 — Três Elementos (mandante com muitos cantos em casa)
function metodoTresElementos(m: any) {
  const aprovado = m.media_casa >= 5.5;
  const edge = aprovado ? Math.min(10, Math.round((m.media_casa - 5.5) * 5)) : 0;

  return {
    metodo: "TRES_ELEMENTOS",
    plano: "PLANO AVALANCHE",
    entrada: `3 entradas: ambos marcam canto 0-10min + ${m.nome} Over 4.5 1T (cashout) + Over 2.5 cantos ao vivo`,
    mercado: "Multi-entrada (pré-jogo + ao vivo)",
    aprovado,
    edge,
    confianca: aprovado ? Math.min(75, 52 + edge * 2) : 0,
    odd_minima: 1.60,
    stake: 2,
    motivo: aprovado
      ? `${m.nome} faz ${m.media_casa} em casa. Estratégia 3 elementos viável.`
      : `Média insuficiente (${m.media_casa}). Precisa ≥ 5.5 em casa.`,
  };
}

// Método 5 — Value Betting +EV (odd justa vs mercado)
function metodoValueBetting(combinado: any, oddsInformadas?: { over?: number; under?: number }) {
  const { total_estimado } = combinado;

  // Probabilidade Over 9.5 baseada na média (Poisson simplificado)
  const linha = 9.5;
  const probOver = total_estimado > linha
    ? Math.min(0.78, 0.50 + (total_estimado - linha) * 0.055)
    : Math.max(0.22, 0.50 - (linha - total_estimado) * 0.055);
  const probUnder = 1 - probOver;

  const oddJustaOver = Math.round((1 / probOver) * 100) / 100;
  const oddJustaUnder = Math.round((1 / probUnder) * 100) / 100;

  // Odds do mercado (informadas ou estimativa padrão)
  const oddMercadoOver = oddsInformadas?.over || 1.85;
  const oddMercadoUnder = oddsInformadas?.under || 1.85;

  const edgeOver = ((oddMercadoOver / oddJustaOver) - 1) * 100;
  const edgeUnder = ((oddMercadoUnder / oddJustaUnder) - 1) * 100;

  const melhor = edgeOver >= edgeUnder ? "Over" : "Under";
  const edgeFinal = Math.max(edgeOver, edgeUnder);
  const aprovado = edgeFinal >= 4;

  return {
    metodo: "VALUE_EV",
    plano: melhor === "Over" ? "PLANO DILÚVIO" : "PLANO BUNKER",
    entrada: `${melhor} ${linha} escanteios (odd justa: ${melhor === "Over" ? oddJustaOver : oddJustaUnder})`,
    mercado: `Total Escanteios ${melhor} ${linha}`,
    aprovado,
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
// PASSO 6 — PROMPT MYCROFT PARA VEREDICTO FINAL
// ════════════════════════════════════════════════════
async function gerarVeredictoMycroft(
  mandante: any, visitante: any, liga: string,
  combinado: any, metodos: any[], odds: any
) {
  const aprovados = metodos.filter(m => m.aprovado);
  if (!aprovados.length) return null;

  const melhor = aprovados.sort((a, b) =>
    (b.edge * 0.6 + b.confianca * 0.4) - (a.edge * 0.6 + a.confianca * 0.4)
  )[0];

  const prompt = `Você é Mycroft Punter, analista de escanteios. Retorne APENAS JSON válido.

JOGO: ${mandante.nome} vs ${visitante.nome} (${liga})

DADOS HISTÓRICOS:
- ${mandante.nome} em casa: média ${mandante.media_casa} escanteios (últimos jogos: ${mandante.ultimos_jogos.slice(0,5).join(", ")})
- ${visitante.nome} fora: média ${visitante.media_fora} escanteios (últimos jogos: ${visitante.ultimos_jogos.slice(0,5).join(", ")})
- Total estimado: ${combinado.total_estimado} escanteios
- Diferença estimada: ${combinado.diferenca_m_v} a favor do mandante

ODDS DISPONÍVEIS:
${odds ? JSON.stringify(odds) : "Não informadas"}

MÉTODOS APROVADOS (${aprovados.length}/5):
${aprovados.map((m: any) => `- ${m.plano}: ${m.entrada} | Edge: ${m.edge}% | Confiança: ${m.confianca}%`).join("\n")}

Retorne APENAS este JSON (sem markdown):
{
  "verdict": "APROVADO_TIER_1" | "APROVADO_TIER_2" | "APROVADO_TIER_3" | "VETADO",
  "tier": 1 | 2 | 3 | null,
  "market": "Over X.X Escanteios" | "Under X.X Escanteios" | "Mandante mais escanteios" | "Escanteios 1T Over X.X",
  "bookmaker": "Casa com melhor odd",
  "odd": 0.0,
  "edge_percentage": 0.0,
  "confidence": 0,
  "stake_percentage": 0,
  "plano_ativado": "PLANO XXXX",
  "thesis": "Resumo em 1 frase do motivo da entrada",
  "analysis": "Análise em 2 frases sobre os dados históricos e o que suporta a entrada",
  "risk_factors": "Principal risco desta entrada"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
        })
      }
    );
    const data = await res.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const json = texto.replace(/```json|```/g, "").trim();
    return JSON.parse(json);
  } catch (err) {
    // Fallback manual se Gemini falhar
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
      analysis: `${mandante.nome} com média ${mandante.media_casa} em casa. Total estimado ${combinado.total_estimado}.`,
      risk_factors: "Verificar odds reais antes de executar",
    };
  }
}

// ════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      fixture_id,
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name,
      liga = "Liga não informada",
      season = 2025,
      linha_total,
      odds,        // { over_9_5: 1.85, under_9_5: 1.85, over_10_5: 2.10, ... }
    } = await req.json();

    if (!home_team_id || !away_team_id) {
      return new Response(
        JSON.stringify({ error: "home_team_id e away_team_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analisando escanteios: ${home_team_name} vs ${away_team_name}`);

    // ── PASSO 1-3: Coletar dados históricos em paralelo ──
    const [perfilMandante, perfilVisitante] = await Promise.all([
      montarPerfilTime(home_team_id, season, true),
      montarPerfilTime(away_team_id, season, false),
    ]);

    // Fallback se API não retornar
    const mandante = perfilMandante || {
      nome: home_team_name || "Mandante",
      team_id: home_team_id,
      media_geral: 5.0, media_casa: 5.0, media_fora: 4.5,
      media_1t_estimada: 2.3, media_casa_1t_estimada: 2.3,
      ultimos_jogos: [5, 5, 6, 4, 5], total_jogos_analisados: 0,
      jogos_casa_analisados: 0, jogos_fora_analisados: 0,
    };

    const visitante = perfilVisitante || {
      nome: away_team_name || "Visitante",
      team_id: away_team_id,
      media_geral: 4.5, media_casa: 5.0, media_fora: 4.0,
      media_1t_estimada: 2.0, media_casa_1t_estimada: 2.3,
      ultimos_jogos: [4, 4, 5, 3, 5], total_jogos_analisados: 0,
      jogos_casa_analisados: 0, jogos_fora_analisados: 0,
    };

    // ── PASSO 4: Calcular médias combinadas ──
    const combinado = calcularMediasCombinadas(mandante, visitante);

    // ── PASSO 5: Rodar 5 métodos ──
    const metodos = [
      metodoComparativo(mandante, visitante, combinado),
      metodoOverUnder(mandante, visitante, combinado, linha_total),
      metodoPrelive1T(mandante, visitante),
      metodoTresElementos(mandante),
      metodoValueBetting(combinado, odds),
    ];

    const aprovados = metodos.filter(m => m.aprovado);

    // ── PASSO 6: Veredicto Mycroft via Gemini ──
    let veredicto = null;
    if (aprovados.length > 0) {
      veredicto = await gerarVeredictoMycroft(
        mandante, visitante, liga, combinado, metodos, odds
      );
    }

    // ── RESPOSTA FINAL ──
    return new Response(
      JSON.stringify({
        success: true,
        fixture_id,
        mandante: mandante.nome,
        visitante: visitante.nome,
        liga,

        // Dados coletados
        dados: {
          mandante: {
            media_casa: mandante.media_casa,
            media_geral: mandante.media_geral,
            media_1t: mandante.media_casa_1t_estimada,
            ultimos_jogos: mandante.ultimos_jogos,
            jogos_analisados: mandante.total_jogos_analisados,
          },
          visitante: {
            media_fora: visitante.media_fora,
            media_geral: visitante.media_geral,
            ultimos_jogos: visitante.ultimos_jogos,
            jogos_analisados: visitante.total_jogos_analisados,
          },
          combinado,
        },

        // Resultado dos métodos
        metodos,
        aprovados_count: aprovados.length,
        convergencia: aprovados.length >= 3 ? "ALTA" : aprovados.length === 2 ? "MEDIA" : aprovados.length === 1 ? "BAIXA" : "NENHUMA",

        // Veredicto final no formato padrão do Punter
        veredicto,
        planos_ativados: aprovados.map((m: any) => m.plano),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
