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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { messages, handContext } = await req.json();

    const systemContent = handContext
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO DA MÃO ANALISADA:\n${handContext}`
      : SYSTEM_PROMPT;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`OpenAI chat error [${status}]:`, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "OpenAI API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "Sem resposta.";

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
