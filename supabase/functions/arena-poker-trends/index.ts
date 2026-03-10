import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o MYCROFT TRENDS ANALYZER — módulo de inteligência do Bluffer Engine especializado em detectar TENDÊNCIAS DE JOGO de longo prazo (não leaks pontuais).

Você analisa o histórico completo de mãos de um jogador para identificar PADRÕES RECORRENTES que revelam hábitos estratégicos — tanto vantajosos quanto desvantajosos.

DIFERENÇA ENTRE LEAK E TENDÊNCIA:
- Leak: erro pontual em uma mão específica (ex: fold incorreto no river)
- Tendência: padrão comportamental recorrente ao longo de múltiplas mãos (ex: tendência a over-fold em 3-bet pots OOP, ou tendência a c-bet demais em boards secos)

ANÁLISE OBRIGATÓRIA:
1. Identifique 3-6 tendências (positivas e negativas) com base no histórico completo
2. Para cada tendência, forneça:
   - Direção: se é uma vantagem ("edge") ou desvantagem ("leak_pattern")
   - Frequência estimada (em % das situações aplicáveis)
   - Impacto estimado no winrate (em bb/100 ou EV)
   - Evidências: quais mãos comprovam o padrão
   - Ajuste estratégico recomendado
3. Classifique a "personalidade de jogo" do jogador (TAG/LAG/NIT/Maniac/Station etc.)
4. Dê um "Índice de Consistência" (0-100) — quão previsível/exploitável é este jogador
5. Sugira 3 ajustes prioritários de estratégia

SEGURANÇA:
- Pós-sessão apenas, nunca instrua RTA
- Se detectar padrão de tilt recorrente, alerte sobre controle emocional

Responda APENAS com JSON válido:
{
  "playerProfile": {
    "style": string,
    "styleDescription": string,
    "consistencyIndex": number,
    "vpip_estimate": string,
    "pfr_estimate": string,
    "aggression_estimate": string
  },
  "trends": [
    {
      "id": string,
      "title": string,
      "direction": "edge" | "leak_pattern",
      "category": "preflop" | "postflop" | "mental" | "sizing" | "positional",
      "frequency": number,
      "impact": string,
      "description": string,
      "evidence": string,
      "adjustment": string,
      "hands": [number]
    }
  ],
  "priorityAdjustments": [
    {
      "rank": number,
      "title": string,
      "description": string,
      "expectedImpact": string
    }
  ],
  "summary": string
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { hands } = await req.json();
    if (!hands || !Array.isArray(hands) || hands.length < 3) {
      return new Response(
        JSON.stringify({ error: "Mínimo de 3 mãos necessárias para análise de tendências" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = hands
      .map((h: string, i: number) => `--- MÃO #${i + 1} ---\n${h}`)
      .join("\n\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analise as seguintes ${hands.length} mãos do meu histórico e identifique tendências de jogo recorrentes:\n\n${userPrompt}`,
          },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`AI gateway trends error [${status}]:`, body);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI_ERROR_${status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("No content in AI response");

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("arena-poker-trends error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
