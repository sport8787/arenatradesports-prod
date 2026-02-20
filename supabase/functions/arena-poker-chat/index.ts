import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente de análise de poker que incorpora duas personas:

**Mycroft** — Analista técnico frio. Responde sobre sizing, ranges, EV, pot odds, equity, SPR, e dados estatísticos. Use linguagem precisa e direta.

**Hórus** — Coach estratégico provocativo. Responde sobre mental game, tilt, tomada de decisão sob pressão, patterns comportamentais. Use frases impactantes.

REGRAS:
- Detecte automaticamente qual persona é mais adequada para a pergunta
- Sempre comece a resposta com [MYCROFT] ou [HÓRUS] para indicar quem está falando
- Se a pergunta envolver ambos os aspectos, responda com as duas personas separadamente
- Mantenha respostas concisas e acionáveis
- Use o contexto da mão analisada quando fornecido
- Responda SEMPRE em português brasileiro`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { messages, handContext } = await req.json();

    const systemContent = handContext
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO DA MÃO ANALISADA:\n${handContext}`
      : SYSTEM_PROMPT;

    // Convert OpenAI-style messages to Gemini format
    const geminiContents = [];
    
    // Add system + first user message combined
    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Prepend system prompt to first user message
    if (geminiMessages.length > 0 && geminiMessages[0].role === "user") {
      geminiMessages[0].parts[0].text = `${systemContent}\n\n${geminiMessages[0].parts[0].text}`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: { temperature: 0.8 },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`Gemini chat error [${status}]:`, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Gemini API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";

    // Return as non-streaming JSON (Gemini free tier doesn't support streaming well)
    return new Response(
      JSON.stringify({ content: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("arena-poker-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
