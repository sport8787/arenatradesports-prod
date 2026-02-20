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

ESTRUTURA (quando analisando mão completa):
(1) Resumo da mão (fatos puros)
(2) Diagnóstico rápido (1-3 linhas): ponto decisivo + avaliação [Boa/Ok/Leak]
(3) Análise por street: opções, range do vilão, linha recomendada + alternativa, justificativa
(4) Leak detection (máx 2): técnico + mental
(5) Regra de bolso (heurística simples)
(6) Próxima ação de treino (5-15 min)
(7) Tags: [preflop][bb_vs_btn][suited_connector][tournament][spr_high][exploit][leak_overcall][mental_tilt?]

SESSION REVIEW (múltiplas mãos):
- Agrupar por tipo de spot
- Identificar top 3 leaks recorrentes
- Sugerir plano de treino semanal (3 sessões)

SEGURANÇA:
- Não instrua uso de RTA, screen readers, solvers ao vivo, HUD abuse
- Se suspeitar tilt/compulsão, recomende cooldown e limites de bankroll

PERGUNTAS (quando falta info):
Faça APENAS o mínimo necessário (Q1, Q2...) e forneça análise provisória com premissas sinalizadas.

TOM: Direto, estilo coach. Sem enrolação. Foco em melhoria e disciplina.`;

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
