// mycroft-copa-chat — Chat punter Copa 2026
// Contexto rico: copa_2026_stats (priority) + national_team_stats (fallback)
// Análise Poisson com xG + form string + últimos placares

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é o Mycroft, analista punter especializado na Copa do Mundo 2026.

Sua missão: analisar os dados estatísticos fornecidos e identificar entradas com valor real. Você tem acesso a stats completas e DEVE usá-las para uma análise quantitativa rigorosa.

## MODELO POISSON — USE SEMPRE QUE xG ESTIVER DISPONÍVEL
Quando avg_xg e avg_xga estiverem disponíveis:
  λ_ataque = (avg_xg_time + avg_xga_adversário) / 2
  P(k gols) = e^(−λ) × λ^k / k!  (para k = 0, 1, 2, 3...)
  P(Over 2.5) = 1 − P(0) − P(1) − P(2 gols totais)
  P(BTTS) ≈ (1 − P(0 gols time A)) × (1 − P(0 gols time B))
  P(Under 2.5) = P(0) + P(1) + P(2 gols totais)

Calcule λ para cada time separadamente, some para o total esperado e derive todas as probabilidades.
Se xG não estiver disponível, use avg_goals_scored/conceded como proxy para λ.

## REGRA FUNDAMENTAL: NUNCA RECUSE ANÁLISE COM DADOS DISPONÍVEIS
Se o contexto contiver stats (mesmo que parciais), produza a análise. Não diga "dados insuficientes" quando há stats no contexto. Diga "dados insuficientes" apenas se NÃO HÁ estatísticas.

## COPA 2026 — FATORES CONTEXTUAIS
- Sede: EUA/Canadá/México → neutralidade relativa, altitude pode afetar em alguns locais
- Grupos: equipes jogam 3 vezes nos grupos → preserve energia
- Jogos eliminatórios: pressão máxima, tendência a menos gols, UOs têm valor
- Ranking FIFA: diferença > 15 posições favorece handicap ao time melhor rankeado

## MERCADOS VÁLIDOS
- Handicap Asiático (AH): -0.5, -1, -1.5, +0.5, +1, +1.5
- Over/Under 2.5 FT, Over/Under 1.5 FT
- BTTS Sim / BTTS Não
- 1X2 (resultado final), Dupla Chance
- Resultado HT/FT

## CRITÉRIOS DE APROVAÇÃO
- Confiança mínima: 68%
- Valor Esperado (VE) mínimo: +5%  →  VE = (prob_real × odd − 1)
- Stake por bloco:
  • conf 68–74% → stake 2% (Bloco B)
  • conf 75–84% → stake 3% (Bloco A)
  • conf ≥ 85% → stake 5% (Bloco A Premium)

## VETOS ABSOLUTOS
- Over 0.5 HT: só com placar 0x0 e entre min 5–30 do 1T
- Under 2.5: só no 1T (min 10–30), placar ≤ 1 gol
- VE calculado < +5%: não aprovar
- Dupla aprovação no mesmo mercado/jogo: vetar

## FORMATO DE RESPOSTA (sempre JSON válido)
{
  "mensagem": "análise completa em markdown — mostre os cálculos Poisson, probabilidades derivadas e justificativa do VE",
  "aprovacao": {
    "aprovado": true,
    "home": "nome exato do time da casa",
    "away": "nome exato do time visitante",
    "market": "nome do mercado",
    "selection": "seleção específica",
    "ah_line": null,
    "odd": 2.10,
    "prob": 0.62,
    "ve_pct": 12.5,
    "confidence": 78,
    "stake_pct": 3,
    "block": "A",
    "rationale": "justificativa em 1-2 frases com λ calculado"
  }
}
Se não houver valor, retorne "aprovacao": null.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Approval {
  aprovado: boolean;
  home?: string;
  away?: string;
  market?: string;
  selection?: string;
  ah_line?: number | null;
  odd?: number;
  prob?: number;
  ve_pct?: number;
  confidence?: number;
  stake_pct?: number;
  block?: string;
  rationale?: string;
}

// Extrai nomes de times de um texto — prioriza padrão "X vs Y"
function extractTeamNames(text: string): string[] {
  const vsMatch = text.match(/([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú\s]{1,30}?)\s+(?:vs\.?|×|x)\s+([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú\s]{1,30})/i);
  if (vsMatch) return [vsMatch[1].trim(), vsMatch[2].trim()];
  const words = text.match(/\b[A-ZÁÉÍÓÚÀÂÊÔÃÕÜ][a-záéíóúàâêôãõü]+(?:\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÜ][a-záéíóúàâêôãõü]+)*/g) || [];
  return words.slice(0, 4);
}

// Busca times em toda a conversa (histórico + query atual)
function extractTeamNamesFromConversation(query: string, history: Message[]): string[] {
  const fromQuery = extractTeamNames(query);
  if (fromQuery.length >= 2 && fromQuery[0] !== fromQuery[1]) return fromQuery;
  for (let i = history.length - 1; i >= 0; i--) {
    const vsMatch = history[i].content.match(/([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú\s]{1,30}?)\s+(?:vs\.?|×|x)\s+([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú\s]{1,30})/i);
    if (vsMatch) return [vsMatch[1].trim(), vsMatch[2].trim()];
  }
  return fromQuery;
}

// Deriva form string e últimos placares a partir do matches_data (JSON da API-Football)
function parseMatchesData(matchesData: unknown, teamName: string): { form: string; scorelines: string[] } {
  if (!Array.isArray(matchesData) || matchesData.length === 0) return { form: "", scorelines: [] };

  const results: Array<{ result: "W" | "D" | "L"; score: string }> = [];
  const nameLower = teamName.toLowerCase();

  for (const match of matchesData.slice(0, 10)) {
    try {
      const home = match?.teams?.home?.name ?? "";
      const away = match?.teams?.away?.name ?? "";
      const goalsHome = match?.goals?.home ?? match?.score?.fulltime?.home ?? null;
      const goalsAway = match?.goals?.away ?? match?.score?.fulltime?.away ?? null;
      if (goalsHome === null || goalsAway === null) continue;

      const isHome = home.toLowerCase().includes(nameLower) || nameLower.includes(home.toLowerCase());
      const isAway = away.toLowerCase().includes(nameLower) || nameLower.includes(away.toLowerCase());
      if (!isHome && !isAway) continue;

      const teamGoals = isHome ? goalsHome : goalsAway;
      const oppGoals = isHome ? goalsAway : goalsHome;
      const oppName = isHome ? away : home;
      const result = teamGoals > oppGoals ? "W" : teamGoals < oppGoals ? "L" : "D";

      results.push({
        result,
        score: `${teamGoals}-${oppGoals} vs ${oppName} (${result})`,
      });
    } catch { /* skip malformed */ }
  }

  return {
    form: results.map(r => r.result).join(""),
    scorelines: results.slice(0, 3).map(r => r.score),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_KEY) {
    return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY não configurado" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { query, conversationHistory = [], userId, contextFixture } = await req.json();
  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: "query vazia" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 1) Buscar fixture correspondente ─────────────────────────────────────────
  let matchedFixture: Record<string, unknown> | null = null;

  if (contextFixture?.fixture_id) {
    const { data: fx } = await supabase
      .from("copa_fixtures")
      .select("fixture_id, home, away, phase, group_letter, commence_time, home_fifa_rank, away_fifa_rank, xg_last5, xg_copa")
      .eq("fixture_id", contextFixture.fixture_id)
      .maybeSingle();
    matchedFixture = fx ?? {
      fixture_id: contextFixture.fixture_id,
      home: contextFixture.home,
      away: contextFixture.away,
      phase: contextFixture.phase,
      commence_time: contextFixture.commence_time,
    };
  } else {
    const teamNames = extractTeamNamesFromConversation(query, conversationHistory as Message[]);
    if (teamNames.length >= 2) {
      const [t1, t2] = teamNames;
      const { data: fixtures } = await supabase
        .from("copa_fixtures")
        .select("fixture_id, home, away, phase, group_letter, commence_time, home_fifa_rank, away_fifa_rank, xg_last5, xg_copa")
        .or(`and(home.ilike.%${t1}%,away.ilike.%${t2}%),and(home.ilike.%${t2}%,away.ilike.%${t1}%)`)
        .order("commence_time", { ascending: true })
        .limit(3);
      if (fixtures && fixtures.length > 0) matchedFixture = fixtures[0] as Record<string, unknown>;
    }
  }

  // ── 2) Estatísticas — copa_2026_stats (priority) + national_team_stats (fallback) ──
  const statsTeamNames = matchedFixture
    ? [String(matchedFixture.home), String(matchedFixture.away)]
    : extractTeamNamesFromConversation(query, conversationHistory as Message[]);

  interface CopaStat {
    team_name: string;
    last_matches: number;
    avg_goals_scored: number | null;
    avg_goals_conceded: number | null;
    avg_xg: number | null;
    avg_xga: number | null;
    avg_possession: number | null;
    over_25_pct: number | null;
    btts_pct: number | null;
    clean_sheet_pct: number | null;
    avg_corners: number | null;
    avg_shots_on_target: number | null;
    form_last5: string | null;
    matches_data: unknown;
    source: string | null;
    last_updated: string;
  }

  interface NatStat {
    team_name: string;
    matches_analyzed: number;
    wins: number; draws: number; losses: number;
    avg_goals_scored: number; avg_goals_conceded: number;
    avg_xg: number; avg_xga: number;
    avg_possession: number;
    avg_shots_total: number; avg_shots_on_target: number;
    avg_corners: number;
    btts_percentage: number;
    clean_sheet_count: number;
    over_25_count: number; under_25_count: number;
    raw_data: unknown;
    last_updated: string;
  }

  interface EnrichedStat {
    team_name: string;
    n: number;
    avg_goals_scored: number | null;
    avg_goals_conceded: number | null;
    avg_xg: number | null;
    avg_xga: number | null;
    avg_possession: number | null;
    over_25_pct: number | null;
    btts_pct: number | null;
    clean_sheet_pct: number | null;
    avg_corners: number | null;
    avg_shots_on_target: number | null;
    form: string;
    scorelines: string[];
    source: string;
    last_updated: string;
  }

  const teamStats: Record<string, EnrichedStat> = {};

  for (const tName of statsTeamNames) {
    // Tenta copa_2026_stats primeiro
    const { data: cs } = await supabase
      .from("copa_2026_stats")
      .select("*")
      .ilike("team_name", `%${tName}%`)
      .order("last_updated", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cs) {
      const copa = cs as CopaStat;
      // Deriva form/scorelines do matches_data se form_last5 não estiver preenchido
      const parsed = parseMatchesData(copa.matches_data, copa.team_name);
      const form = copa.form_last5 ?? parsed.form;
      teamStats[tName] = {
        team_name: copa.team_name,
        n: copa.last_matches ?? 10,
        avg_goals_scored: copa.avg_goals_scored,
        avg_goals_conceded: copa.avg_goals_conceded,
        avg_xg: copa.avg_xg,
        avg_xga: copa.avg_xga,
        avg_possession: copa.avg_possession,
        over_25_pct: copa.over_25_pct,
        btts_pct: copa.btts_pct,
        clean_sheet_pct: copa.clean_sheet_pct,
        avg_corners: copa.avg_corners,
        avg_shots_on_target: copa.avg_shots_on_target,
        form,
        scorelines: parsed.scorelines,
        source: copa.source ?? "copa_2026_stats",
        last_updated: copa.last_updated,
      };
      continue;
    }

    // Fallback: national_team_stats
    const { data: ns } = await supabase
      .from("national_team_stats")
      .select("*")
      .ilike("team_name", `%${tName}%`)
      .order("last_updated", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ns) {
      const nat = ns as NatStat;
      const n = nat.matches_analyzed || 1;
      const parsed = parseMatchesData(nat.raw_data, nat.team_name);
      teamStats[tName] = {
        team_name: nat.team_name,
        n: nat.matches_analyzed,
        avg_goals_scored: nat.avg_goals_scored,
        avg_goals_conceded: nat.avg_goals_conceded,
        avg_xg: nat.avg_xg,
        avg_xga: nat.avg_xga,
        avg_possession: nat.avg_possession,
        over_25_pct: n > 0 ? Math.round((nat.over_25_count / n) * 100 * 10) / 10 : null,
        btts_pct: nat.btts_percentage,
        clean_sheet_pct: n > 0 ? Math.round((nat.clean_sheet_count / n) * 100 * 10) / 10 : null,
        avg_corners: nat.avg_corners,
        avg_shots_on_target: nat.avg_shots_on_target,
        form: parsed.form,
        scorelines: parsed.scorelines,
        source: "api-football",
        last_updated: nat.last_updated,
      };
    }
  }

  // ── 3) Sinais já existentes ───────────────────────────────────────────────────
  let existingSignals: string[] = [];
  if (matchedFixture?.fixture_id) {
    const { data: sigs } = await supabase
      .from("punter_copa_signals")
      .select("market, selection, resultado")
      .eq("fixture_id", matchedFixture.fixture_id);
    existingSignals = (sigs ?? []).map((s: Record<string, string>) =>
      `${s.market} ${s.selection} → ${s.resultado ?? "pendente"}`
    );
  }

  // ── 4) Montar contexto ────────────────────────────────────────────────────────
  let contextExtra = "";

  if (matchedFixture) {
    const xg = matchedFixture.xg_copa as Record<string, unknown> | null;
    contextExtra += `\n\n## FIXTURE
${matchedFixture.home} vs ${matchedFixture.away}
Fase: ${matchedFixture.phase} | Grupo: ${matchedFixture.group_letter ?? "—"} | Data: ${String(matchedFixture.commence_time).slice(0, 10)}
FIFA Rank: ${matchedFixture.home} #${matchedFixture.home_fifa_rank ?? "?"} | ${matchedFixture.away} #${matchedFixture.away_fifa_rank ?? "?"}
fixture_id: ${matchedFixture.fixture_id}`;
    if (xg) contextExtra += `\nxG Copa (modelo pré-jogo): ${JSON.stringify(xg)}`;
  } else {
    contextExtra += "\n\n## FIXTURE: Não encontrado na base Copa — analise pelos dados fornecidos.";
  }

  if (Object.keys(teamStats).length > 0) {
    contextExtra += "\n\n## ESTATÍSTICAS DAS SELEÇÕES";
    for (const [, ts] of Object.entries(teamStats)) {
      const ageH = ts.last_updated
        ? Math.round((Date.now() - new Date(ts.last_updated).getTime()) / 3_600_000)
        : null;
      const formStr = ts.form ? ` | Forma: ${ts.form.slice(0, 5)}` : "";
      contextExtra += `

### ${ts.team_name} (${ts.n} jogos · fonte: ${ts.source} · ${ageH ?? "?"}h atrás${formStr})
- Gols marcados: ${ts.avg_goals_scored ?? "n/d"}/jogo | Sofridos: ${ts.avg_goals_conceded ?? "n/d"}/jogo
- xG médio: ${ts.avg_xg ?? "n/d"} | xGA médio: ${ts.avg_xga ?? "n/d"}
- Posse média: ${ts.avg_possession ?? "n/d"}%
- Finalizações no alvo: ${ts.avg_shots_on_target ?? "n/d"}/jogo | Escanteios: ${ts.avg_corners ?? "n/d"}/jogo
- Over 2.5: ${ts.over_25_pct ?? "n/d"}% | BTTS: ${ts.btts_pct ?? "n/d"}% | Clean sheet: ${ts.clean_sheet_pct ?? "n/d"}%`;
      if (ts.scorelines.length > 0) {
        contextExtra += `\n- Últimos resultados: ${ts.scorelines.join(" · ")}`;
      }
    }

    // Calcula λ Poisson se tivermos xG dos dois times
    const entries = Object.values(teamStats);
    if (entries.length === 2) {
      const [t1, t2] = entries;
      const xg1 = t1.avg_xg ?? t1.avg_goals_scored;
      const xga1 = t1.avg_xga ?? t1.avg_goals_conceded;
      const xg2 = t2.avg_xg ?? t2.avg_goals_scored;
      const xga2 = t2.avg_xga ?? t2.avg_goals_conceded;

      if (xg1 && xga2 && xg2 && xga1) {
        const lam1 = Math.round(((xg1 + xga2) / 2) * 100) / 100;
        const lam2 = Math.round(((xg2 + xga1) / 2) * 100) / 100;

        // P(k) = e^(-λ) * λ^k / k!  para k = 0..4
        const poisson = (lam: number, k: number): number =>
          Math.exp(-lam) * Math.pow(lam, k) / [1, 1, 2, 6, 24][k];

        const p0_1 = poisson(lam1, 0); const p1_1 = poisson(lam1, 1);
        const p2_1 = poisson(lam1, 2); const p3_1 = poisson(lam1, 3);
        const p0_2 = poisson(lam2, 0); const p1_2 = poisson(lam2, 1);
        const p2_2 = poisson(lam2, 2); const p3_2 = poisson(lam2, 3);

        // Probabilidades de placares exatos (produto cruzado)
        const scores: Array<{ s: string; p: number }> = [];
        for (let i = 0; i <= 3; i++) {
          for (let j = 0; j <= 3; j++) {
            const pi = [p0_1, p1_1, p2_1, p3_1][i];
            const pj = [p0_2, p1_2, p2_2, p3_2][j];
            scores.push({ s: `${i}-${j}`, p: Math.round(pi * pj * 1000) / 10 });
          }
        }
        scores.sort((a, b) => b.p - a.p);
        const top5 = scores.slice(0, 5).map(s => `${s.s} (${s.p}%)`).join(", ");

        const pBtts = Math.round((1 - p0_1) * (1 - p0_2) * 100 * 10) / 10;
        const pOver25 = Math.round((1 - p0_1 * p0_2 - p0_1 * p1_2 - p1_1 * p0_2 - p1_1 * p1_2 - p2_1 * p0_2 - p0_1 * p2_2) * 100 * 10) / 10;
        const pUnder25 = Math.round(100 - pOver25);

        contextExtra += `

## ANÁLISE POISSON PRÉ-CALCULADA (use como base)
λ ${t1.team_name}: ${lam1} | λ ${t2.team_name}: ${lam2}
Placares mais prováveis: ${top5}
P(BTTS Sim): ${pBtts}% | P(Over 2.5): ${pOver25}% | P(Under 2.5): ${pUnder25}%`;
      }
    }
  } else {
    contextExtra += "\n\n## ESTATÍSTICAS AUTO: não disponíveis — solicite dados ao usuário ou execute fetch-national-team-stats.";
  }

  if (existingSignals.length > 0) {
    contextExtra += `\n\n## SINAIS JÁ APROVADOS PARA ESTE JOGO\n${existingSignals.join("\n")}`;
  }

  const systemWithContext = SYSTEM + contextExtra;

  // ── 5) Montar messages multi-turn ────────────────────────────────────────────
  const messages = [
    { role: "system", content: systemWithContext },
    ...(conversationHistory as Message[]).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: query },
  ];

  // ── 6) Chamar DeepSeek ───────────────────────────────────────────────────────
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  let rawText = "";

  try {
    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`DeepSeek ${r.status}: ${errText}`);
    }
    const data = await r.json();
    rawText = data.choices?.[0]?.message?.content ?? "{}";
  } catch (e) {
    clearTimeout(timer);
    console.error("[copa-chat] DeepSeek error:", e);
    return new Response(
      JSON.stringify({ error: "Erro ao consultar Mycroft. Tente novamente." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // ── 7) Parsear resposta ───────────────────────────────────────────────────────
  let parsed: { mensagem?: string; aprovacao?: Approval | null } = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { mensagem: rawText, aprovacao: null };
  }

  const aprov = parsed.aprovacao;
  const approval = (aprov && aprov.aprovado) ? {
    ...aprov,
    fixture_id: matchedFixture?.fixture_id ?? null,
    phase: matchedFixture?.phase ?? null,
    commence_time: matchedFixture?.commence_time ?? null,
    block: aprov.block ?? (
      (aprov.confidence ?? 0) >= 75 ? "A" : "B"
    ),
    prob: aprov.prob ?? (aprov.odd ? Math.round((1 / aprov.odd) * 100) / 100 : null),
  } : null;

  return new Response(
    JSON.stringify({
      response: parsed.mensagem ?? rawText,
      approval,
      fixture_found: !!matchedFixture,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
