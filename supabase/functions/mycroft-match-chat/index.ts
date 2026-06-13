// Mycroft Match Chat - debate com Mycroft sobre uma análise de jogo ao vivo específica
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCascade } from "../_shared/chatCascade.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MatchContext {
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  minute: number;
  score_home: number;
  score_away: number;
  stats?: Record<string, unknown>;
  analysis?: {
    verdict?: string;
    market?: string;
    odd?: number;
    confidence?: number;
    thesis?: string;
    plan_name?: string;
    alerts?: string[];
    fundamentation?: unknown;
  };
}

// Normaliza nome de time para matching fuzzy
function normTeam(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
}

// Verifica se dois nomes de time são o mesmo (substring bidirecional por palavra)
function teamsMatch(a: string, b: string): boolean {
  const wa = normTeam(a).split(" ").filter(w => w.length >= 3);
  const wb = normTeam(b).split(" ").filter(w => w.length >= 3);
  return wa.some(w => normTeam(b).includes(w)) || wb.some(w => normTeam(a).includes(w));
}

function injuryStr(list: any[]): string {
  if (!Array.isArray(list) || list.length === 0) return "nenhuma";
  return list.slice(0, 4).map((p: any) => p?.player ?? p?.name ?? "?").join(", ")
    + (list.length > 4 ? ` +${list.length - 4}` : "");
}

const PHASE_LABEL: Record<string, string> = {
  grupos_j1: "Grupos J1", grupos_j2: "Grupos J2", grupos_j3: "Grupos J3",
  oitavas: "Oitavas", quartas: "Quartas", semi: "Semifinal",
  "3lugar": "3º Lugar", final: "Final",
};

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  query: string;
  matchContext: MatchContext;
  history?: ChatMsg[];
}

// Estimativa simples de tokens (~4 chars/token)
const estimateTokens = (text: string) => Math.ceil((text?.length || 0) / 4);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const { query, matchContext, history = [] }: Body = await req.json();
    // DeepSeek-first cascade (DeepSeek → Groq 70B → Groq 8B)
    const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!DEEPSEEK_KEY && !GROQ_API_KEY) throw new Error("Nenhum provider IA configurado (DEEPSEEK_API_KEY/GROQ_API_KEY)");

    // Identificar usuário a partir do JWT (não bloqueia chamada se faltar)
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const sb = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data } = await sb.auth.getUser();
        userId = data.user?.id ?? null;
      }
    } catch (e) {
      console.warn("auth resolve failed", e);
    }

    // ── Enriquecimento pré-jogo: copa_fixtures ─────────────────────────────────
    let preliveBlock = "";
    try {
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sbAdmin = createClient(sbUrl, sbKey);

      const now = new Date();
      const from = new Date(now.getTime() - 14 * 3600_000).toISOString();
      const to   = new Date(now.getTime() + 14 * 3600_000).toISOString();

      const { data: copaRows } = await sbAdmin
        .from("copa_fixtures")
        .select("home, away, phase, group_letter, home_fifa_rank, away_fifa_rank, home_fifa_pts, away_fifa_pts, xg_last5, injuries")
        .gte("commence_time", from)
        .lte("commence_time", to);

      const fx = (copaRows ?? []).find((row: any) =>
        teamsMatch(row.home, matchContext.home_team) &&
        teamsMatch(row.away, matchContext.away_team)
      );

      if (fx) {
        const xgH = fx.xg_last5?.home;
        const xgA = fx.xg_last5?.away;
        const ptsDiff = (fx.home_fifa_pts ?? 0) - (fx.away_fifa_pts ?? 0);
        const favStr = ptsDiff > 50
          ? `favorito: ${fx.home} (+${ptsDiff} pts FIFA)`
          : ptsDiff < -50
          ? `favorito: ${fx.away} (+${Math.abs(ptsDiff)} pts FIFA)`
          : "equilíbrio FIFA";

        const lambdaLine = (team: string, xg: any) => {
          if (!xg?.xg) return `${team}: sem projeção`;
          const src = xg.source === "futodds_cs" ? "Futodds CS 🔵" : xg.source === "footystats" ? "FootyStats 🟡" : "API-Football";
          const form = xg.form ? ` | Forma: ${xg.form}` : "";
          return `${team} (${src}): λ=${xg.xg} gols esperados | xGA=${xg.xga}${form}`;
        };

        // Assimetria detectada: quanto o xG ao vivo desvia do λ pré-jogo por minuto
        const liveXgH = Number((matchContext.stats as any)?.xG_home ?? (matchContext.stats as any)?.xg_home ?? 0);
        const liveXgA = Number((matchContext.stats as any)?.xG_away ?? (matchContext.stats as any)?.xg_away ?? 0);
        const min = Math.max(1, matchContext.minute);
        const expectedH = xgH?.xg ? (xgH.xg * min) / 90 : null;
        const expectedA = xgA?.xg ? (xgA.xg * min) / 90 : null;
        const asymLines: string[] = [];
        if (expectedH !== null && liveXgH > 0) {
          const diff = liveXgH - expectedH;
          if (diff > 0.3) asymLines.push(`${fx.home} ACIMA do λ esperado (real ${liveXgH.toFixed(2)} vs esp. ${expectedH.toFixed(2)}) → dominância real`);
          else if (diff < -0.3) asymLines.push(`${fx.home} ABAIXO do λ esperado (real ${liveXgH.toFixed(2)} vs esp. ${expectedH.toFixed(2)}) → subperformance / regressão possível`);
        }
        if (expectedA !== null && liveXgA > 0) {
          const diff = liveXgA - expectedA;
          if (diff > 0.3) asymLines.push(`${fx.away} ACIMA do λ esperado (real ${liveXgA.toFixed(2)} vs esp. ${expectedA.toFixed(2)}) → dominância real`);
          else if (diff < -0.3) asymLines.push(`${fx.away} ABAIXO do λ esperado (real ${liveXgA.toFixed(2)} vs esp. ${expectedA.toFixed(2)}) → subperformance / regressão possível`);
        }

        preliveBlock = `
━━━ PRÉ-JOGO COPA 2026 ━━━
Fase: ${PHASE_LABEL[fx.phase] ?? fx.phase}${fx.group_letter ? ` | Grupo ${fx.group_letter}` : ""}
FIFA: ${fx.home} #${fx.home_fifa_rank ?? "?"} (${fx.home_fifa_pts ?? "?"} pts) × ${fx.away} #${fx.away_fifa_rank ?? "?"} (${fx.away_fifa_pts ?? "?"} pts) — ${favStr}
${lambdaLine(fx.home, xgH)}
${lambdaLine(fx.away, xgA)}
Lesões ${fx.home}: ${injuryStr(fx.injuries?.home)}
Lesões ${fx.away}: ${injuryStr(fx.injuries?.away)}${asymLines.length > 0 ? `

⚠️ ASSIMETRIA DETECTADA (min ${min}'):
${asymLines.map(l => `• ${l}`).join("\n")}` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━

Ao debater, usa o λ pré-jogo como baseline. Se o placar não reflete o domínio esperado (ex: time favorito perdendo apesar de xG superior), sinaliza explicitamente como assimetria de valor. Em fase mata-mata, considera que times eliminados empurram mais no 2T.`;
        console.log(`[mycroft-match-chat] copa_fixtures match: ${fx.home} × ${fx.away} | asym=${asymLines.length}`);
      }
    } catch (e) {
      console.warn("[mycroft-match-chat] copa_fixtures lookup failed:", (e as Error).message);
    }

    const sys = `Você é o **Mycroft Sports**, analista frio e dedutivo de trading esportivo ao vivo.
Sua missão: debater com o usuário sobre a análise da partida abaixo, defender sua tese,
considerar contrapontos e apontar riscos. Responda SEMPRE em português do Brasil,
de forma direta, sem rodeios, com no máximo 3 parágrafos curtos. Use markdown leve
(negrito, listas) quando ajudar.

Se o usuário propuser uma entrada que viole sua análise, contraponha com dados.
Se concordar, confirme com 1 frase e aponte o gatilho de execução.

CONTEXTO DA PARTIDA:
${matchContext.home_team} ${matchContext.score_home} x ${matchContext.score_away} ${matchContext.away_team}
Liga: ${matchContext.league} • Minuto: ${matchContext.minute}'
${preliveBlock}
ANÁLISE ATUAL DO MYCROFT:
- Veredito: ${matchContext.analysis?.verdict ?? "—"}
- Mercado: ${matchContext.analysis?.market ?? "—"}
- Odd: ${matchContext.analysis?.odd ?? "—"}
- Confiança: ${matchContext.analysis?.confidence ?? "—"}%
- Plano: ${matchContext.analysis?.plan_name ?? "—"}
- Tese: ${matchContext.analysis?.thesis ?? "—"}
- Alertas: ${(matchContext.analysis?.alerts ?? []).join("; ") || "nenhum"}

ESTATÍSTICAS AO VIVO:
${JSON.stringify(matchContext.stats ?? {}, null, 2).slice(0, 1500)}`;

    const messages = [
      { role: "system", content: sys },
      ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: query },
    ];

    let answer = "";
    let providerUsed = "";
    try {
      const result = await chatCascade({
        messages: messages as any,
        temperature: 0.6,
        max_tokens: 2400,
        timeoutMs: 60_000,
      });
      answer = result.text;
      providerUsed = `${result.provider}/${result.model}`;
      console.log(`[mycroft-match-chat] ok via ${providerUsed} in ${result.ms}ms`);
    } catch (e) {
      const msg = (e as Error).message;
      console.error("[mycroft-match-chat] cascade failed:", msg);
      const status = /429/.test(msg) ? 429 : /402/.test(msg) ? 402 : 502;
      const userMsg = status === 429
        ? "Limite de requisições atingido. Tente novamente em instantes."
        : status === 402
        ? "Créditos de IA esgotados."
        : "Mycroft está temporariamente indisponível. Tente novamente em alguns segundos.";
      return new Response(JSON.stringify({ error: userMsg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const response = answer;



    const elapsed = Date.now() - startedAt;

    // Persistir log (best-effort, não bloqueia resposta em caso de falha)
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(supabaseUrl, serviceKey);
        const baseRow = {
          user_id: userId,
          match_id: matchContext.match_id,
          home_team: matchContext.home_team,
          away_team: matchContext.away_team,
          league: matchContext.league,
          minute: matchContext.minute,
          score_home: matchContext.score_home,
          score_away: matchContext.score_away,
        };
        await admin.from("mycroft_chat_logs").insert([
          {
            ...baseRow,
            role: "user",
            content: query,
            tokens_estimated: estimateTokens(query),
            response_time_ms: null,
          },
          {
            ...baseRow,
            role: "assistant",
            content: response,
            tokens_estimated: estimateTokens(response),
            response_time_ms: elapsed,
          },
        ]);
      } catch (logErr) {
        console.warn("chat log insert failed", logErr);
      }
    }

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mycroft-match-chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
