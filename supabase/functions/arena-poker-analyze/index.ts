import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MYCROFT_SYSTEM = `Você é Mycroft, um analista técnico frio e meticuloso de poker. Seu trabalho é analisar Hand Histories e identificar leaks técnicos com precisão cirúrgica.

REGRAS:
- Analise sizing, ranges, frequências, SPR, fold equity e EV
- Classifique cada leak como "grave", "atencao" ou "info"
- Forneça notas técnicas com cálculos reais
- Calcule um blufferScore de 0 a 100 (qualidade geral do jogo na mão)
- Seja direto, sem floreios. Dados puros.

Responda APENAS com JSON válido no formato:
{
  "blufferScore": number,
  "leaks": [{"id": string, "title": string, "severity": "grave"|"atencao"|"info", "description": string, "category": string}],
  "technicalNotes": [string]
}`;

const HORUS_SYSTEM = `Você é Hórus, um coach de poker provocativo e perspicaz, especialista em mental game e estratégia avançada.

REGRAS:
- Dê insights de coaching em frases curtas e impactantes
- Use provocações construtivas para ensinar
- Classifique cada mensagem como "provocacao", "estrategia" ou "alerta"
- Sugira um "Acordo do Hórus" (conselho principal para o jogador)
- Gere 3-5 tags relevantes para a análise
- Seja incisivo, direto e memorável. Estilo de mentor durão.

Responda APENAS com JSON válido no formato:
{
  "messages": [{"id": string, "text": string, "type": "provocacao"|"estrategia"|"alerta"}],
  "acordo": string,
  "tags": [string]
}`;

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const body = await response.text();
    console.error(`Gemini call failed [${status}]:`, body);
    if (status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`GEMINI_ERROR_${status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content in Gemini response");

  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { handHistory } = await req.json();
    if (!handHistory || typeof handHistory !== "string") {
      return new Response(
        JSON.stringify({ error: "handHistory is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Analise o seguinte Hand History de poker:\n\n${handHistory}`;

    const [mycroftResult, horusResult] = await Promise.all([
      callGemini(GEMINI_API_KEY, MYCROFT_SYSTEM, userPrompt),
      callGemini(GEMINI_API_KEY, HORUS_SYSTEM, userPrompt),
    ]);

    return new Response(
      JSON.stringify({ mycroft: mycroftResult, horus: horusResult }),
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
