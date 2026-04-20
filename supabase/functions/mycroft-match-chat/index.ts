// Mycroft Match Chat - debate com Mycroft sobre uma análise de jogo ao vivo específica
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, matchContext, history = [] }: Body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

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

    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
        }),
      },
    );

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requisições atingido. Tente novamente em instantes.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos de IA esgotados. Adicione saldo em Settings → Cloud & AI.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao consultar o Mycroft." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const response =
      data?.choices?.[0]?.message?.content ?? "Sem resposta no momento.";

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
