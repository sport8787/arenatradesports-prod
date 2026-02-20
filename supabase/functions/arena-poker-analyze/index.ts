import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MYCROFT_SYSTEM = `Você é Mycroft, um analista técnico frio e meticuloso de poker. Seu trabalho é analisar Hand Histories e identificar leaks técnicos com precisão cirúrgica.

REGRAS:
- Analise sizing, ranges, frequências, SPR, fold equity e EV
- Classifique cada leak como "grave", "atencao" ou "info"
- Forneça notas técnicas com cálculos reais
- Calcule um blufferScore de 0 a 100 (qualidade geral do jogo na mão)
- Seja direto, sem floreios. Dados puros.

Você DEVE usar a ferramenta analyze_hand para retornar sua análise.`;

const HORUS_SYSTEM = `Você é Hórus, um coach de poker provocativo e perspicaz, especialista em mental game e estratégia avançada.

REGRAS:
- Dê insights de coaching em frases curtas e impactantes
- Use provocações construtivas para ensinar
- Classifique cada mensagem como "provocacao", "estrategia" ou "alerta"
- Sugira um "Acordo do Hórus" (conselho principal para o jogador)
- Gere 3-5 tags relevantes para a análise
- Seja incisivo, direto e memorável. Estilo de mentor durão.

Você DEVE usar a ferramenta coach_hand para retornar seu coaching.`;

const mycroftTools = [
  {
    type: "function",
    function: {
      name: "analyze_hand",
      description: "Return structured technical analysis of a poker hand.",
      parameters: {
        type: "object",
        properties: {
          blufferScore: {
            type: "number",
            description: "Overall play quality 0-100",
          },
          leaks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                severity: {
                  type: "string",
                  enum: ["grave", "atencao", "info"],
                },
                description: { type: "string" },
                category: { type: "string" },
              },
              required: ["id", "title", "severity", "description", "category"],
              additionalProperties: false,
            },
          },
          technicalNotes: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["blufferScore", "leaks", "technicalNotes"],
        additionalProperties: false,
      },
    },
  },
];

const horusTools = [
  {
    type: "function",
    function: {
      name: "coach_hand",
      description: "Return structured coaching analysis of a poker hand.",
      parameters: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                type: {
                  type: "string",
                  enum: ["provocacao", "estrategia", "alerta"],
                },
              },
              required: ["id", "text", "type"],
              additionalProperties: false,
            },
          },
          acordo: { type: "string", description: "Main strategic advice" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Hashtag tags for the analysis",
          },
        },
        required: ["messages", "acordo", "tags"],
        additionalProperties: false,
      },
    },
  },
];

async function callAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  tools: unknown[],
  toolName: string
) {
  const response = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const body = await response.text();
    console.error(`AI call failed [${status}]:`, body);
    if (status === 429) throw new Error("RATE_LIMITED");
    if (status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI_ERROR_${status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("No tool call in response");
  }

  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { handHistory } = await req.json();
    if (!handHistory || typeof handHistory !== "string") {
      return new Response(
        JSON.stringify({ error: "handHistory is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Analise o seguinte Hand History de poker:\n\n${handHistory}`;

    // Run both AI calls in parallel
    const [mycroftResult, horusResult] = await Promise.all([
      callAI(LOVABLE_API_KEY, MYCROFT_SYSTEM, userPrompt, mycroftTools, "analyze_hand"),
      callAI(LOVABLE_API_KEY, HORUS_SYSTEM, userPrompt, horusTools, "coach_hand"),
    ]);

    return new Response(
      JSON.stringify({
        mycroft: mycroftResult,
        horus: horusResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("arena-poker-analyze error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : msg === "PAYMENT_REQUIRED" ? 402 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
