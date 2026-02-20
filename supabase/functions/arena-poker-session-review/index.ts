import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é ARENA POKER Session Review, um sistema de análise em lote de sessões de poker powered by Bluffer Engine.

Você recebe MÚLTIPLAS hand histories de uma sessão e deve produzir uma análise consolidada.

REGRAS:
1. Agrupe as mãos por tipo de spot (ex: BB defense, BTN opens, 3-bet pots, squeeze spots, c-bet situations)
2. Identifique os TOP 3 leaks recorrentes (técnicos e mentais) que aparecem em múltiplas mãos
3. Calcule um score geral da sessão (0-100)
4. Gere um plano de treino semanal com 3 sessões focadas nos leaks encontrados
5. Produza tags para dataset

Para cada leak recorrente, indique:
- Em quais mãos ele aparece (por número)
- Frequência (quantas vezes ocorreu)
- Severidade (grave/atencao/info)

SEGURANÇA:
- Pós-sessão apenas
- Não instrua uso de RTA, HUD abuse, solvers ao vivo
- Se suspeitar tilt/compulsão, recomende cooldown

Responda APENAS com JSON válido no formato:
{
  "totalHands": number,
  "overallScore": number,
  "summary": string (resumo de 2-3 frases da sessão),
  "recurringLeaks": [
    {
      "title": string,
      "frequency": number,
      "severity": "grave" | "atencao" | "info",
      "description": string,
      "hands": [number] (números das mãos onde o leak aparece, 1-indexed)
    }
  ],
  "spotClusters": [
    {
      "type": string (nome do cluster, ex: "BB Defense vs BTN"),
      "count": number,
      "insight": string (insight principal sobre esse cluster)
    }
  ],
  "trainingPlan": [
    {
      "day": string (ex: "Sessão 1 - Segunda"),
      "focus": string (foco principal),
      "exercises": [string] (2-3 exercícios práticos de 5-15 min)
    }
  ],
  "tags": [string]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { hands } = await req.json();
    if (!hands || !Array.isArray(hands) || hands.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 hand histories are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = hands
      .map((h: string, i: number) => `--- MÃO #${i + 1} ---\n${h}`)
      .join("\n\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analise as seguintes ${hands.length} mãos da minha sessão:\n\n${userPrompt}` },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`OpenAI session review error [${status}]:`, body);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "RATE_LIMITED" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`OPENAI_ERROR_${status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("No content in response");

    const result = JSON.parse(text);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("arena-poker-session-review error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
