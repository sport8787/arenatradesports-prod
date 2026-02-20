import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um analista de poker de elite que combina dois perfis:

**MYCROFT** (Técnico): Analisa sizing, ranges, frequências, SPR, fold equity, pot odds, equity, blockers e EV com precisão cirúrgica.

**HÓRUS** (Estratégico): Coach provocativo focado em mental game, psicologia e leitura de adversários.

Analise o Hand History fornecido e responda EXATAMENTE no seguinte formato JSON:

{
  "veredito": {
    "nota": <número de 0 a 100 avaliando a qualidade da jogada>,
    "resumo": "<1-2 frases com o diagnóstico geral>"
  },
  "scriptVencedor": {
    "titulo": "<título curto descrevendo a linha ideal>",
    "passos": [
      {
        "street": "<Preflop|Flop|Turn|River>",
        "acao": "<ação ideal curta, ex: '3-bet para 9BB'>",
        "explicacao": "<explicação detalhada com cálculos de pot odds, equity, sizing ideal, motivo técnico>"
      }
    ]
  },
  "visaoHorus": {
    "insight": "<insight de psicologia/mental game sobre a jogada>",
    "leituraVilao": "<leitura do range e tendências do vilão baseado nas ações>",
    "conselho": "<frase de impacto / regra de bolso para o jogador>"
  }
}

REGRAS:
- Pós-sessão apenas. Não forneça conselho em tempo real.
- Seja preciso com cálculos (pot odds, equity, SPR).
- O "scriptVencedor" deve ter um passo para cada street jogada.
- O "conselho" do Hórus deve ser uma frase curta e memorável.
- Se suspeitar tilt/compulsão, recomende cooldown.
- Responda APENAS com JSON válido.`;

async function callGeminiAI(systemPrompt: string, userPrompt: string) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
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
    console.error(`Gemini API error [${status}]:`, body);
    if (status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`AI_ERROR_${status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content in Gemini response");

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { handHistory } = await req.json();
    if (!handHistory || typeof handHistory !== "string") {
      return new Response(
        JSON.stringify({ error: "handHistory is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Analise o seguinte Hand History de poker:\n\n${handHistory}`;
    const result = await callGeminiAI(SYSTEM_PROMPT, userPrompt);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("arena-poker-analyze error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
