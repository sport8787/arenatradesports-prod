// Edge Function: mycroft-corners-analyzer
// Analisa mercado de escanteios usando 5 métodos extraídos de estratégias validadas
// Deploy: supabase functions deploy mycroft-corners-analyzer

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

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";

// ════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════
interface TimeStats {
  nome: string;
  media_escanteios_geral: number;
  media_escanteios_casa?: number;
  media_escanteios_fora?: number;
  media_escanteios_sofridos: number;
  media_escanteios_sofridos_casa?: number;
  media_escanteios_sofridos_fora?: number;
  media_escanteios_1t: number;
  media_escanteios_1t_casa?: number;
  ultimos_jogos: number[];          // escanteios nos últimos 5 jogos
  ultimos_jogos_1t: number[];       // escanteios no 1T nos últimos 5 jogos
}

interface AnaliseEscanteios {
  fixture_id: number;
  mandante: string;
  visitante: string;
  liga: string;
  stats_mandante: TimeStats;
  stats_visitante: TimeStats;
  metodos: MetodoResult[];
  recomendacao_final: RecomendacaoFinal;
}

interface MetodoResult {
  metodo: string;
  nome_plano: string;
  mercado: string;
  entrada: string;
  odd_minima: number;
  edge_estimado: number;
  confianca: number;
  aprovado: boolean;
  motivo: string;
  stake_sugerido: number;
}

interface RecomendacaoFinal {
  aprovado: boolean;
  melhor_entrada: MetodoResult | null;
  resumo: string;
  alerta: string;
}

// ════════════════════════════════════════════════════
// MÓDULO 1 — BUSCAR STATS DE ESCANTEIOS (API-Football)
// ════════════════════════════════════════════════════
async function buscarStatsEscanteios(teamId: number, isHome: boolean, season: number = 2025): Promise<TimeStats | null> {
  try {
    // Buscar fixtures recentes do time
    const url = `https://v3.football.api-sports.io/fixtures?team=${teamId}&season=${season}&last=10`;
    const res = await fetch(url, { headers: { "x-apisports-key": API_FOOTBALL_KEY } });
    const data = await res.json();
    const fixtures = data.response || [];

    if (fixtures.length === 0) return null;

    const escanteiosPorJogo: number[] = [];
    const escanteios1T: number[] = [];
    const escanteiosSofridos: number[] = [];

    for (const fixture of fixtures.slice(0, 8)) {
      // Buscar estatísticas do jogo
      const statsUrl = `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixture.fixture.id}`;
      const statsRes = await fetch(statsUrl, { headers: { "x-apisports-key": API_FOOTBALL_KEY } });
      const statsData = await statsRes.json();

      const teamStats = statsData.response?.find((s: any) => s.team.id === teamId);
      const oppStats = statsData.response?.find((s: any) => s.team.id !== teamId);

      if (!teamStats) continue;

      const getVal = (stats: any[], type: string) => {
        const s = stats.find((s: any) => s.type === type);
        return parseInt(s?.value || "0") || 0;
      };

      const cornersFor = getVal(teamStats.statistics, "Corner Kicks");
      const cornersAgainst = getVal(oppStats?.statistics || [], "Corner Kicks");

      escanteiosPorJogo.push(cornersFor);
      escanteiosSofridos.push(cornersAgainst);
      // API-Football não tem corners por tempo via statistics, estimamos 45% no 1T
      escanteios1T.push(Math.round(cornersFor * 0.45));
    }

    const avg = (arr: number[]) => arr.length > 0
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : 0;

    const filtradosCasa = fixtures
      .filter((f: any) => f.teams.home.id === teamId)
      .slice(0, 5);
    const filtradosFora = fixtures
      .filter((f: any) => f.teams.away.id === teamId)
      .slice(0, 5);

    return {
      nome: fixtures[0]?.teams.home.id === teamId
        ? fixtures[0]?.teams.home.name
        : fixtures[0]?.teams.away.name,
      media_escanteios_geral: avg(escanteiosPorJogo),
      media_escanteios_casa: avg(escanteiosPorJogo.slice(0, 5)),
      media_escanteios_fora: avg(escanteiosPorJogo.slice(5)),
      media_escanteios_sofridos: avg(escanteiosSofridos),
      media_escanteios_1t: avg(escanteios1T),
      ultimos_jogos: escanteiosPorJogo.slice(0, 5),
      ultimos_jogos_1t: escanteios1T.slice(0, 5),
    };
  } catch (err) {
    console.error("Erro buscarStatsEscanteios:", err);
    return null;
  }
}

// ════════════════════════════════════════════════════
// MÓDULO 2 — MÉTODO APOSTA COMPARATIVA
// (Fonte: escanteio_1 — Vila Nova vs Operário)
// Mandante tem mais escanteios que visitante no total
// Entrada: Back mandante em total de escanteios comparativo
// ════════════════════════════════════════════════════
function metodoApostaComparativa(m: TimeStats, v: TimeStats): MetodoResult {
  const media_m = m.media_escanteios_casa || m.media_escanteios_geral;
  const media_v = v.media_escanteios_sofridos; // escanteios que visitante cede
  const diferenca = media_m - (v.media_escanteios_geral || 0);

  // Critério principal: diferença de pelo menos 1.5 escanteios por jogo
  const aprovado = diferenca >= 1.5 && media_m >= 5.0;
  const confianca = aprovado
    ? Math.min(85, 60 + (diferenca * 5) + (media_m >= 6 ? 10 : 0))
    : 0;

  // Handcap: se diferença > 2, pode entrar no -1.5 escanteios (handicap asiático)
  const entrada = diferenca >= 2.0
    ? `${m.nome} -1.5 escanteios (handicap)`
    : `${m.nome} vence escanteios total`;

  return {
    metodo: "APOSTA_COMPARATIVA",
    nome_plano: "PLANO DOMINÂNCIA",
    mercado: "Escanteios Comparativo / Handicap Escanteios",
    entrada,
    odd_minima: 1.70,
    edge_estimado: aprovado ? Math.round(diferenca * 3) : 0,
    confianca: Math.round(confianca),
    aprovado,
    motivo: aprovado
      ? `${m.nome} tem média ${media_m} escanteios em casa vs ${v.nome} com ${v.media_escanteios_geral} fora. Diferença de ${diferenca.toFixed(1)} escanteios.`
      : `Diferença insuficiente (${diferenca.toFixed(1)}). Mínimo necessário: 1.5`,
    stake_sugerido: diferenca >= 2.5 ? 3 : 2,
  };
}

// ════════════════════════════════════════════════════
// MÓDULO 3 — MÉTODO TRÊS ELEMENTOS
// (Fonte: escanteio_2 — Chapecoense, Pai Sandu)
// 3 entradas combinadas: primeiros 10min + linha alta cashout + ao vivo 3 cantos
// ════════════════════════════════════════════════════
function metodoTresElementos(m: TimeStats, v: TimeStats): MetodoResult {
  const media_total = (m.media_escanteios_geral + v.media_escanteios_geral) / 2;
  const media_1t_m = m.media_escanteios_1t;

  // Critério: mandante com média alta em casa e jogos com escanteios cedo
  const aprovado = m.media_escanteios_casa
    ? m.media_escanteios_casa >= 5.0 && media_1t_m >= 2.0
    : false;

  const confianca = aprovado
    ? Math.min(80, 55 + (m.media_escanteios_casa || 0) * 3)
    : 0;

  return {
    metodo: "TRES_ELEMENTOS",
    nome_plano: "PLANO AVALANCHE",
    mercado: "Escanteios Primeiros 10min + Over 1T + Over Total",
    entrada: `3 entradas: (1) Ambos marcam escanteio 0-10min, (2) ${m.nome} Over 4.5 1T cashout, (3) Over 2.5 escanteios ao vivo 20-25min`,
    odd_minima: 1.60,
    edge_estimado: aprovado ? 8 : 0,
    confianca: Math.round(confianca),
    aprovado,
    motivo: aprovado
      ? `${m.nome} tem média ${m.media_escanteios_casa} escanteios em casa. Estratégia dos 3 elementos viável.`
      : `Média de escanteios em casa insuficiente para estratégia dos 3 elementos.`,
    stake_sugerido: 2,
  };
}

// ════════════════════════════════════════════════════
// MÓDULO 4 — MÉTODO PRÉ-LIVE 1º TEMPO
// (Fonte: escanteio_3 — Botafogo, Tottenham)
// Back mandante favorito ter Over 2.5 escanteios no 1T
// Critério: mandante com maior média 1T + visitante que cede escanteios
// ════════════════════════════════════════════════════
function metodoPrelive1T(m: TimeStats, v: TimeStats): MetodoResult {
  const media_1t_m = m.media_escanteios_1t;
  const sofre_1t_v = v.media_escanteios_sofridos * 0.45; // estimativa 1T

  // Critério: mandante com média de 1T ≥ 2.5 e visitante com déficit defensivo
  const soma_estimada_1t = media_1t_m + sofre_1t_v;
  const aprovado = media_1t_m >= 2.5 && soma_estimada_1t >= 3.5;

  const confianca = aprovado
    ? Math.min(82, 58 + (media_1t_m - 2.5) * 8)
    : 0;

  return {
    metodo: "PRELIVE_1T",
    nome_plano: "PLANO ECLIPSE (Escanteios)",
    mercado: "Escanteios 1º Tempo Over 2.5",
    entrada: `${m.nome} Over 2.5 escanteios no 1º Tempo`,
    odd_minima: 1.50,
    edge_estimado: aprovado ? Math.round((media_1t_m - 2.5) * 10) : 0,
    confianca: Math.round(confianca),
    aprovado,
    motivo: aprovado
      ? `${m.nome} média ${media_1t_m} escanteios no 1T. ${v.nome} cede estimados ${sofre_1t_v.toFixed(1)} no 1T. Total estimado: ${soma_estimada_1t.toFixed(1)}.`
      : `Média de escanteios no 1T insuficiente (${media_1t_m}). Mínimo: 2.5`,
    stake_sugerido: 2,
  };
}

// ════════════════════════════════════════════════════
// MÓDULO 5 — MÉTODO OVER/UNDER TOTAL
// (Fonte: escanteio_4 — Corinthians vs Juventude)
// Analisar últimos 3-5 jogos para encontrar média total e apostar Under/Over
// ════════════════════════════════════════════════════
function metodoOverUnderTotal(m: TimeStats, v: TimeStats): MetodoResult {
  const media_m = m.media_escanteios_geral;
  const media_v = v.media_escanteios_geral;
  const media_total_estimada = media_m + media_v;

  // Média ajustada com fator mandante (+0.5) e sofridos do visitante
  const media_ajustada = (
    (m.media_escanteios_casa || media_m) +
    (v.media_escanteios_fora || media_v)
  ) / 2 * 2;

  // Definir linha ideal baseada na média
  let linha: number;
  let direcao: "Over" | "Under";
  let edge: number;

  if (media_ajustada <= 7.5) {
    linha = 8.5;
    direcao = "Under";
    edge = Math.round((8.5 - media_ajustada) * 3);
  } else if (media_ajustada >= 11.5) {
    linha = 10.5;
    direcao = "Over";
    edge = Math.round((media_ajustada - 10.5) * 3);
  } else if (media_ajustada <= 9.0) {
    linha = 9.5;
    direcao = "Under";
    edge = Math.round((9.5 - media_ajustada) * 3);
  } else {
    linha = 10.5;
    direcao = media_ajustada < 10.5 ? "Under" : "Over";
    edge = Math.round(Math.abs(media_ajustada - 10.5) * 3);
  }

  const aprovado = edge >= 4 && (
    (direcao === "Under" && media_ajustada < linha - 0.5) ||
    (direcao === "Over" && media_ajustada > linha + 0.5)
  );

  const confianca = aprovado
    ? Math.min(80, 55 + edge * 2)
    : 0;

  // Verificar consistência com últimos jogos
  const ultimos = [...m.ultimos_jogos, ...v.ultimos_jogos.slice(0, 3)];
  const consistencia = ultimos.filter(j =>
    direcao === "Under" ? j < linha : j > linha
  ).length / ultimos.length * 100;

  return {
    metodo: "OVER_UNDER_TOTAL",
    nome_plano: "PLANO BUNKER (Under) / PLANO DILÚVIO (Over)",
    mercado: `Total de Escanteios ${direcao} ${linha}`,
    entrada: `${direcao} ${linha} escanteios totais`,
    odd_minima: 1.65,
    edge_estimado: edge,
    confianca: Math.round(Math.min(confianca, consistencia * 0.8)),
    aprovado,
    motivo: aprovado
      ? `Média estimada ${media_ajustada.toFixed(1)} escanteios. ${direcao} ${linha} com edge de ~${edge}%. Consistência últimos jogos: ${consistencia.toFixed(0)}%.`
      : `Edge insuficiente para ${direcao} ${linha}. Média estimada: ${media_ajustada.toFixed(1)}.`,
    stake_sugerido: edge >= 8 ? 3 : 2,
  };
}

// ════════════════════════════════════════════════════
// MÓDULO 6 — MÉTODO VALUE BETTING ESCANTEIOS
// (Fonte: escanteio_5 — Danilo Pereira — princípio +EV)
// Calcula probabilidade própria e compara com odd de mercado
// ════════════════════════════════════════════════════
function metodoValueBetting(m: TimeStats, v: TimeStats, mercado: string, linhaTotal: number): MetodoResult {
  const media_m = m.media_escanteios_casa || m.media_escanteios_geral;
  const media_v = v.media_escanteios_fora || v.media_escanteios_geral;
  const media_total = media_m + media_v;

  // Probabilidade Poisson simplificada para Over/Under
  const probOver = media_total > linhaTotal
    ? Math.min(0.75, 0.5 + (media_total - linhaTotal) * 0.06)
    : Math.max(0.25, 0.5 - (linhaTotal - media_total) * 0.06);

  const probUnder = 1 - probOver;

  // Odd justa estimada
  const odd_justa_over = Math.round((1 / probOver) * 100) / 100;
  const odd_justa_under = Math.round((1 / probUnder) * 100) / 100;

  // Assumindo odd de mercado típica de 1.80 para Over/Under balanceado
  const odd_mercado_over = 1.85;  // mercado típico
  const odd_mercado_under = 1.85;

  const edge_over = ((odd_mercado_over - odd_justa_over) / odd_justa_over) * 100;
  const edge_under = ((odd_mercado_under - odd_justa_under) / odd_justa_under) * 100;

  const melhor = edge_over > edge_under ? "Over" : "Under";
  const melhor_edge = Math.max(edge_over, edge_under);
  const aprovado = melhor_edge >= 4;

  return {
    metodo: "VALUE_BETTING",
    nome_plano: melhor === "Over" ? "PLANO DILÚVIO" : "PLANO BUNKER",
    mercado: `Escanteios ${melhor} ${linhaTotal}`,
    entrada: `${melhor} ${linhaTotal} — Odd justa estimada: ${melhor === "Over" ? odd_justa_over : odd_justa_under}`,
    odd_minima: melhor === "Over" ? odd_justa_over + 0.05 : odd_justa_under + 0.05,
    edge_estimado: Math.round(melhor_edge),
    confianca: aprovado ? Math.min(78, 55 + Math.round(melhor_edge * 2)) : 0,
    aprovado,
    motivo: aprovado
      ? `Odd justa calculada: ${melhor === "Over" ? odd_justa_over : odd_justa_under}. Edge de ${melhor_edge.toFixed(1)}% em relação ao mercado.`
      : `Edge insuficiente (${melhor_edge.toFixed(1)}%). Necessário ≥ 4%.`,
    stake_sugerido: melhor_edge >= 8 ? 3 : 2,
  };
}

// ════════════════════════════════════════════════════
// MÓDULO 7 — ANÁLISE GEMINI (SÍNTESE INTELIGENTE)
// ════════════════════════════════════════════════════
async function analisarComGemini(
  mandante: string,
  visitante: string,
  liga: string,
  stats_m: TimeStats,
  stats_v: TimeStats,
  metodos: MetodoResult[]
): Promise<string> {
  const metodosAprovados = metodos.filter(m => m.aprovado);

  const prompt = `Você é Mycroft, analista especialista em mercado de escanteios.

JOGO: ${mandante} vs ${visitante} (${liga})

ESTATÍSTICAS ${mandante.toUpperCase()}:
- Média escanteios geral: ${stats_m.media_escanteios_geral}
- Média em casa: ${stats_m.media_escanteios_casa || "N/A"}
- Média 1T: ${stats_m.media_escanteios_1t}
- Últimos 5 jogos: ${stats_m.ultimos_jogos.join(", ")}

ESTATÍSTICAS ${visitante.toUpperCase()}:
- Média escanteios geral: ${stats_v.media_escanteios_geral}
- Média fora: ${stats_v.media_escanteios_fora || "N/A"}
- Sofre escanteios: ${stats_v.media_escanteios_sofridos}
- Últimos 5 jogos: ${stats_v.ultimos_jogos.join(", ")}

MÉTODOS APROVADOS (${metodosAprovados.length}/${metodos.length}):
${metodosAprovados.map(m => `- ${m.nome_plano}: ${m.entrada} | Edge: ${m.edge_estimado}% | Confiança: ${m.confianca}%`).join("\n")}

Analise os dados e forneça:
1. Qual é a entrada mais forte e por quê
2. Algum risco que os números não mostram
3. Sua confiança geral no mercado de escanteios desse jogo

Responda em 3 parágrafos curtos e objetivos. Não repita os números já informados.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
        })
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Análise indisponível.";
  } catch {
    return "Análise Gemini indisponível no momento.";
  }
}

// ════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      fixture_id,
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name,
      liga,
      linha_total = 9.5,        // linha padrão para Over/Under total
      modo = "completo"          // "completo" | "rapido"
    } = await req.json();

    if (!home_team_id || !away_team_id) {
      return new Response(
        JSON.stringify({ error: "home_team_id e away_team_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar stats de ambos os times em paralelo
    const [stats_m, stats_v] = await Promise.all([
      buscarStatsEscanteios(home_team_id, true),
      buscarStatsEscanteios(away_team_id, false)
    ]);

    // Fallback se API não retornar dados
    const statsM: TimeStats = stats_m || {
      nome: home_team_name || "Mandante",
      media_escanteios_geral: 5.5,
      media_escanteios_casa: 5.5,
      media_escanteios_sofridos: 4.5,
      media_escanteios_1t: 2.5,
      ultimos_jogos: [5, 6, 4, 7, 5],
      ultimos_jogos_1t: [2, 3, 2, 3, 2]
    };

    const statsV: TimeStats = stats_v || {
      nome: away_team_name || "Visitante",
      media_escanteios_geral: 4.0,
      media_escanteios_fora: 4.0,
      media_escanteios_sofridos: 5.0,
      media_escanteios_1t: 1.8,
      ultimos_jogos: [4, 3, 5, 4, 4],
      ultimos_jogos_1t: [2, 1, 2, 2, 2]
    };

    // Rodar todos os métodos
    const metodos: MetodoResult[] = [
      metodoApostaComparativa(statsM, statsV),
      metodoTresElementos(statsM, statsV),
      metodoPrelive1T(statsM, statsV),
      metodoOverUnderTotal(statsM, statsV),
      metodoValueBetting(statsM, statsV, "total", linha_total)
    ];

    // Identificar melhor entrada
    const aprovados = metodos.filter(m => m.aprovado);
    const melhor = aprovados.sort((a, b) =>
      (b.edge_estimado * 0.6 + b.confianca * 0.4) - (a.edge_estimado * 0.6 + a.confianca * 0.4)
    )[0] || null;

    // Análise Gemini (apenas modo completo)
    let analise_gemini = "";
    if (modo === "completo" && aprovados.length > 0) {
      analise_gemini = await analisarComGemini(
        statsM.nome, statsV.nome, liga || "Liga",
        statsM, statsV, metodos
      );
    }

    // Recomendação final
    const recomendacao: RecomendacaoFinal = {
      aprovado: aprovados.length > 0,
      melhor_entrada: melhor,
      resumo: aprovados.length > 0
        ? `${aprovados.length} de 5 métodos aprovados. Melhor entrada: ${melhor?.nome_plano} — ${melhor?.entrada}`
        : "Nenhum método aprovado. Jogo sem edge claro em escanteios.",
      alerta: aprovados.length >= 3
        ? "🔥 Alta convergência — múltiplos métodos apontam o mesmo mercado"
        : aprovados.length === 2
        ? "⚡ Convergência moderada — 2 métodos alinhados"
        : aprovados.length === 1
        ? "✅ Entrada única identificada — seguir com stake conservador"
        : "❌ Sem entrada recomendada neste jogo"
    };

    return new Response(
      JSON.stringify({
        success: true,
        fixture_id,
        mandante: statsM.nome,
        visitante: statsV.nome,
        liga: liga || "N/A",
        stats: {
          mandante: statsM,
          visitante: statsV,
          media_total_estimada: (
            ((statsM.media_escanteios_casa || statsM.media_escanteios_geral) +
            (statsV.media_escanteios_fora || statsV.media_escanteios_geral))
          ).toFixed(1)
        },
        metodos,
        aprovados_count: aprovados.length,
        recomendacao,
        analise_gemini,
        planos_ativados: aprovados.map(m => m.nome_plano)
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", detail: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
