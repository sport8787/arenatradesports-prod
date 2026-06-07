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

ANÁLISE ATUAL DO MYCROFT:
- Veredito: ${matchContext.analysis?.verdict ?? "—"}
- Mercado: ${matchContext.analysis?.market ?? "—"}
- Odd: ${matchContext.analysis?.odd ?? "—"}
- Confiança: ${matchContext.analysis?.confidence ?? "—"}%
- Plano: ${matchContext.analysis?.plan_name ?? "—"}
- Tese: ${matchContext.analysis?.thesis ?? "—"}
- Alertas: ${(matchContext.analysis?.alerts ?? []).join("; ") || "nenhum"}

ESTATÍSTICAS:
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
