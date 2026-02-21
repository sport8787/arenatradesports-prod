import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { asset, candles, currentPrice, balance, position } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const candleSummary = candles.slice(-10).map((c: any) => 
      `O:${c.open} H:${c.high} L:${c.low} C:${c.close}`
    ).join(' | ');

    const prompt = `Você é o Mycroft Trader, um analista técnico forense frio e preciso para o jogo Blefador Milionário.

Analise o ativo ${asset.symbol} (${asset.name}) com os seguintes dados:
- Preço atual: ${currentPrice}
- Últimas 10 velas: ${candleSummary}
- Banca do jogador: ${balance.toLocaleString()} BC
${position ? `- Posição aberta: ${position.type.toUpperCase()} a ${position.entryPrice}` : '- Sem posição aberta'}

Retorne um JSON com:
{
  "mycroft": {
    "support": <número - nível de suporte>,
    "resistance": <número - nível de resistência>,
    "trend": "bullish" ou "bearish",
    "verdict": "<análise forense em 2-3 frases, técnica e fria>",
    "riskLevel": <1-10>
  },
  "horus": "<provocação teatral do Hórus sobre a operação em 1-2 frases, sarcástico e desafiador, em português>"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const geminiData = await response.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      throw new Error("No content from Gemini");
    }

    const parsed = JSON.parse(textContent);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Arena Trader analyze error:", error);

    // Fallback response
    return new Response(JSON.stringify({
      mycroft: {
        support: 0,
        resistance: 0,
        trend: "bearish",
        verdict: "Análise temporariamente indisponível. Opere com cautela.",
        riskLevel: 5,
      },
      horus: "O sistema está sobrecarregado... Mas um trader de verdade não depende de análises para agir.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
