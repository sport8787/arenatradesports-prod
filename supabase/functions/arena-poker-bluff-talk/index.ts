import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYZE_BLUFF_PROMPT = `Você é Mycroft 2.0, simulando ser o OPONENTE na mesa de poker. Analise a provocação/table talk do jogador como se fosse o vilão tentando ler a fala dele.

Contexto da mão:
- Mão do herói: {heroCards}
- Board: {boardCards}  
- Street: {street}
- Ação do herói: {heroAction}
- Intenção declarada: {intent}
- Vilão: {villainName} ({villainProfile})

Transcrição da fala do jogador:
"{transcript}"

Duração: {duration} segundos

Analise como oponente e responda EXATAMENTE no formato JSON:

{
  "bluffScore": <0-100, qualidade do bluff/provocação>,
  "opponentReaction": "<o que o vilão provavelmente pensaria/faria após ouvir isso, 2-3 frases>",
  "leakDetection": "<leaks identificados: over-explaining, inconsistência com a ação, timing tells, falta de convicção, etc., 1-3 frases>",
  "alignmentCheck": "<a fala é coerente com a ação escolhida e a história que a mão conta? Se não, explique a incoerência, 1-2 frases>",
  "suggestedPhrases": [
    "<frase alternativa mais eficaz #1>",
    "<frase alternativa mais eficaz #2>"
  ],
  "mycroftVerdict": "<veredito geral do Mycroft sobre a qualidade da provocação, 1 frase>",
  "horusComment": "<comentário provocativo do Hórus sobre a performance do jogador, 1 frase>"
}

REGRAS:
- O MAIS IMPORTANTE é o alignmentCheck: se o jogador diz algo que contradiz sua ação, isso é informação grátis para o oponente.
- Ex: Jogador fez Raise mas falou inseguro → leak. Jogador fez Check-raise mas provocou cedo demais → timing tell.
- Over-explaining é o #1 leak de amadores.
- Score alto (80+) = provocação convincente e coerente com a ação.
- Score baixo (30-) = deu informação grátis ou foi incoerente.
- Responda APENAS com JSON válido.`;

async function callGeminiAI(prompt: string) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
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

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, duration, heroCards, boardCards, street, heroAction, intent, villainName, villainProfile } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: "No transcript provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = ANALYZE_BLUFF_PROMPT
      .replace("{heroCards}", heroCards || "??")
      .replace("{boardCards}", boardCards || "N/A")
      .replace("{street}", street || "unknown")
      .replace("{heroAction}", heroAction || "unknown")
      .replace("{intent}", intent || "unknown")
      .replace("{villainName}", villainName || "Vilão")
      .replace("{villainProfile}", villainProfile || "unknown")
      .replace("{transcript}", transcript)
      .replace("{duration}", String(duration || 0));

    const result = await callGeminiAI(prompt);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("arena-poker-bluff-talk error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
