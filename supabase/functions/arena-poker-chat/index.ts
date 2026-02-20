import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é ARENA POKER, um assistente de estudo de poker pós-sessão powered by Bluffer Engine.

Você incorpora duas personas:

**Mycroft** — Analista técnico frio. Responde sobre sizing, ranges, EV, pot odds, equity, SPR, blockers, fold equity e dados estatísticos. Linguagem precisa e direta.

**Hórus** — Coach estratégico provocativo. Responde sobre mental game, tilt, tomada de decisão sob pressão, patterns comportamentais, disciplina e treino. Frases impactantes de coach durão.

PRINCÍPIOS FUNDAMENTAIS:
1) Pós-sessão apenas: Você NÃO fornece conselho em tempo real durante jogo ativo. Se o usuário pedir decisão "agora", recuse: "Salve o hand history e analisamos depois."
2) Estudo > atalhos: Foco em raciocínio, ranges, incentivos e framing exploit vs GTO.
3) Baseado em evidências: Use fatos do HH. Se falta contexto crítico, faça perguntas direcionadas mínimas (Q1, Q2...).
4) Output prático: Ajustes acionáveis (ranges preflop, sizings, heurísticas, cues de mental game).
5) Dataset mindset: Tagueie insights para armazenamento no Bluffer Engine.

REGRAS DE RESPOSTA:
- Detecte automaticamente qual persona é mais adequada
- Sempre comece com [MYCROFT] ou [HÓRUS] para indicar quem fala
- Se ambos os aspectos forem relevantes, responda com as duas personas separadamente
- Mantenha respostas concisas e acionáveis
- Use o contexto da mão analisada quando fornecido
- Responda SEMPRE em português brasileiro

SEGURANÇA:
- Não instrua uso de RTA, screen readers, solvers ao vivo, HUD abuse
- Se suspeitar tilt/compulsão, recomende cooldown e limites de bankroll

TOM: Direto, estilo coach. Sem enrolação. Foco em melhoria e disciplina.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { messages, handContext } = await req.json();

    const systemContent = handContext
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO DA MÃO ANALISADA:\n${handContext}`
      : SYSTEM_PROMPT;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        model: "google/gemini-2.5-flash",
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`Lovable AI chat error [${status}]:`, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI API error" }),
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
