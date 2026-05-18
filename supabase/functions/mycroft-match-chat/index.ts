// Mycroft Match Chat - debate com Mycroft sobre uma análise de jogo ao vivo específica
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
    const AI_KEY = GROQ_API_KEY;
    const AI_URL = "https://api.groq.com/openai/v1/chat/completions";
    const AI_MODEL = "llama-3.3-70b-versatile";

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

    // Cadeia de modelos: tenta o forte primeiro, depois cai pro lite
    const modelChain = [AI_MODEL, "gemini-2.5-flash-lite", "gemini-2.5-flash"];
    let resp: Response | null = null;
    let data: any = null;
    let answer = "";
    let lastErr = "";
    let lastStatus = 0;

    outer: for (const model of modelChain) {
      for (let attempt = 0; attempt < 3; attempt++) {
        resp = await fetch(AI_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, max_tokens: 2400 }),
        });

        if (resp.ok) {
          // Validar conteúdo: se Gemini estourou tokens e devolveu vazio, NÃO aceita
          try {
            data = await resp.json();
          } catch (e) {
            lastErr = `parse_error: ${e}`;
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          answer = (data?.choices?.[0]?.message?.content ?? "").trim();
          const finish = data?.choices?.[0]?.finish_reason;
          if (answer.length > 0) break outer;

          // Resposta vazia — provável MAX_TOKENS / overload silencioso
          console.warn(`[mycroft-match-chat] ${model} attempt ${attempt + 1} returned EMPTY (finish=${finish})`);
          lastErr = `empty_content (finish=${finish})`;
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }

        lastStatus = resp.status;
        if (resp.status === 429 || resp.status === 402) break outer;

        if ([500, 502, 503, 504].includes(resp.status)) {
          lastErr = await resp.text().catch(() => "");
          console.warn(`[mycroft-match-chat] ${model} attempt ${attempt + 1} failed ${resp.status}`);
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }

        lastErr = await resp.text().catch(() => "");
        break outer;
      }
    }

    if (!answer) {
      if (lastStatus === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (lastStatus === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione saldo em Settings → Cloud & AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("AI gateway error", lastStatus, lastErr);
      return new Response(JSON.stringify({
        error: lastStatus === 503
          ? "Mycroft está sobrecarregado no momento (alta demanda do modelo). Aguarde alguns segundos e tente novamente."
          : "Falha ao consultar o Mycroft. Tente novamente em alguns segundos.",
      }), {
        status: 502,
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
