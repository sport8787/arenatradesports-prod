// mycroft-copa-chat — Chat punter Copa 2026
// Recebe query + histórico, injeta contexto de copa_fixtures e sinais existentes,
// chama DeepSeek e retorna análise + aprovação estruturada.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é o Mycroft, analista punter especializado na Copa do Mundo 2026.

Sua missão: analisar dados estatísticos fornecidos pelo trader e decidir se há valor real em alguma entrada. Você é rigoroso e só aprova quando os dados justificam.

## MERCADOS VÁLIDOS
- Handicap Asiático (AH): -0.5, -1, -1.5, +0.5, +1, +1.5
- Over/Under 2.5 FT, Over/Under 1.5 FT
- BTTS Sim / BTTS Não
- 1X2 (resultado final), Dupla Chance
- Resultado HT/FT

## CRITÉRIOS DE APROVAÇÃO
- Confiança mínima: 68%
- Valor Esperado (VE) mínimo: +5%
- Stake por bloco:
  • conf 68–74% → stake 2% (Bloco B)
  • conf 75–84% → stake 3% (Bloco A)
  • conf ≥ 85% → stake 5% (Bloco A Premium)

## VETOS ABSOLUTOS
- Over 0.5 HT: só com placar 0x0 e entre min 5–30 do 1T
- Under 2.5: só no 1T (min 10–30), placar ≤ 1 gol
- VE calculado < +5%: não aprovar
- Amostra insuficiente (< 5 jogos): solicitar mais dados
- Dupla aprovação no mesmo mercado/jogo: vetar

## FORMATO DE RESPOSTA (sempre JSON válido)
{
  "mensagem": "análise completa em markdown com justificativa",
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
    "rationale": "justificativa em 1-2 frases"
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

// Busca times em toda a conversa (histórico + query atual) — permite "o confronto acima"
function extractTeamNamesFromConversation(query: string, history: Message[]): string[] {
  // 1) Tenta a query atual primeiro (tem prioridade)
  const fromQuery = extractTeamNames(query);
  if (fromQuery.length >= 2 && fromQuery[0] !== fromQuery[1]) return fromQuery;

  // 2) Varre o histórico do mais recente para o mais antigo procurando padrão "X vs Y"
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const vsMatch = msg.content.match(/([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú\s]{1,30}?)\s+(?:vs\.?|×|x)\s+([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú\s]{1,30})/i);
    if (vsMatch) return [vsMatch[1].trim(), vsMatch[2].trim()];
  }

  // 3) Fallback: palavras capitalizadas da query
  return fromQuery;
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
  // contextFixture tem prioridade (enviado pela página com o jogo em destaque)
  let matchedFixture: Record<string, unknown> | null = null;

  if (contextFixture?.fixture_id) {
    // Página enviou o fixture diretamente — busca completo pelo ID
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
    // Fallback: extrai times da conversa
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

  // ── 2) Estatísticas da tabela national_team_stats ────────────────────────────
  // Se contextFixture foi usado, garante que temos os nomes dos times para buscar stats
  const statsTeamNames = matchedFixture
    ? [String(matchedFixture.home), String(matchedFixture.away)]
    : extractTeamNamesFromConversation(query, conversationHistory as Message[]);

  interface TeamStats {
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
    last_updated: string;
  }
  const teamStats: Record<string, TeamStats> = {};
  for (const tName of statsTeamNames) {
    const { data: ts } = await supabase
      .from("national_team_stats")
      .select("*")
      .ilike("team_name", `%${tName}%`)
      .order("last_updated", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ts) teamStats[tName] = ts as TeamStats;
  }

  // ── 3) Sinais já existentes para evitar duplicatas ────────────────────────────
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

  // ── 4) Montar contexto para o sistema ────────────────────────────────────────
  let contextExtra = "";

  if (matchedFixture) {
    const xg = matchedFixture.xg_copa as Record<string, unknown> | null;
    contextExtra += `\n\n## FIXTURE ENCONTRADO NO BANCO
${matchedFixture.home} vs ${matchedFixture.away}
Fase: ${matchedFixture.phase} | Grupo: ${matchedFixture.group_letter ?? "—"} | Data: ${String(matchedFixture.commence_time).slice(0, 10)}
FIFA Rank: ${matchedFixture.home} #${matchedFixture.home_fifa_rank ?? "?"} | ${matchedFixture.away} #${matchedFixture.away_fifa_rank ?? "?"}
fixture_id: ${matchedFixture.fixture_id}`;
    if (xg) contextExtra += `\nxG Copa: ${JSON.stringify(xg)}`;
  } else {
    contextExtra += "\n\n## FIXTURE: Não encontrado na base Copa — analise apenas pelos dados fornecidos.";
  }

  // Injetar estatísticas da national_team_stats (dados históricos das seleções)
  if (Object.keys(teamStats).length > 0) {
    contextExtra += "\n\n## ESTATÍSTICAS DAS SELEÇÕES (últimos jogos — API-Football)";
    for (const [name, ts] of Object.entries(teamStats)) {
      const age = ts.last_updated
        ? Math.round((Date.now() - new Date(ts.last_updated).getTime()) / 3_600_000)
        : null;
      contextExtra += `

### ${ts.team_name} (${ts.matches_analyzed} jogos · atualizado há ${age ?? "?"}h)
- Resultado: ${ts.wins}V ${ts.draws}E ${ts.losses}D
- Gols marcados: ${ts.avg_goals_scored}/jogo | Sofridos: ${ts.avg_goals_conceded}/jogo
- xG médio: ${ts.avg_xg ?? "n/d"} | xGA médio: ${ts.avg_xga ?? "n/d"}
- Posse média: ${ts.avg_possession ?? "n/d"}%
- Finalizações: ${ts.avg_shots_total ?? "n/d"} totais / ${ts.avg_shots_on_target ?? "n/d"} no alvo
- Escanteios médios: ${ts.avg_corners ?? "n/d"}
- BTTS: ${ts.btts_percentage ?? "n/d"}% | Over 2.5: ${ts.over_25_count}/${ts.matches_analyzed} jogos
- Clean sheets: ${ts.clean_sheet_count}/${ts.matches_analyzed}`;
    }
  } else {
    // Avisa o Mycroft que os dados automáticos não estão disponíveis
    contextExtra += "\n\n## ESTATÍSTICAS AUTO: não disponíveis (execute fetch-national-team-stats para popular)";
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

  // ── 5) Chamar DeepSeek ───────────────────────────────────────────────────────
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
        temperature: 0.35,
        max_tokens: 2500,
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

  // ── 6) Parsear resposta ───────────────────────────────────────────────────────
  let parsed: { mensagem?: string; aprovacao?: Approval | null } = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { mensagem: rawText, aprovacao: null };
  }

  const aprov = parsed.aprovacao;
  const approval = (aprov && aprov.aprovado) ? {
    ...aprov,
    // Enriquecer com dados do fixture encontrado
    fixture_id: matchedFixture?.fixture_id ?? null,
    phase: matchedFixture?.phase ?? null,
    commence_time: matchedFixture?.commence_time ?? null,
    block: aprov.block ?? (
      (aprov.confidence ?? 0) >= 85 ? "A" :
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
