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
  "summary": string,
  "recurringLeaks": [
    {
      "title": string,
      "frequency": number,
      "severity": "grave" | "atencao" | "info",
      "description": string,
      "hands": [number]
    }
  ],
  "spotClusters": [
    {
      "type": string,
      "count": number,
      "insight": string
    }
  ],
  "trainingPlan": [
    {
      "day": string,
      "focus": string,
      "exercises": [string]
    }
  ],
  "tags": [string]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${SYSTEM_PROMPT}\n\nAnalise as seguintes ${hands.length} mãos da minha sessão:\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`Gemini session review error [${status}]:`, body);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "RATE_LIMITED" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI_ERROR_${status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No content in response");

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

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
