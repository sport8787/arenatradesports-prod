import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const POSITIONS = ["UTG", "UTG+1", "MP", "MP+1", "CO", "BTN", "SB", "BB"];
const VILLAIN_POSITIONS = ["UTG", "MP", "CO", "BTN", "SB"];

const GENERATE_PROMPT = `Você é Mycroft 2.0, perito forense de poker. Gere um cenário de treino para um jogador de poker.

Responda EXATAMENTE no formato JSON:

{
  "cenario": {
    "heroPosicao": "<posição do herói>",
    "heroStack": <stack em BB, entre 20 e 200>,
    "heroCartas": "<duas cartas, ex: AhKs>",
    "vilaoNome": "<nome fictício do vilão>",
    "vilaoPosicao": "<posição do vilão>",
    "vilaoAcao": "<ação do vilão, ex: 'abriu para 3BB'>",
    "vilaoStack": <stack do vilão em BB>,
    "potAtual": <tamanho do pot em BB>,
    "blinds": "<blinds, ex: 25/50>",
    "contexto": "<contexto narrativo curto e imersivo, ex: 'Mesa final de torneio, 4 jogadores restantes. O vilão tem sido muito agressivo nas últimas órbitas.'>",
    "boardCards": "<cartas do board se houver, ou vazio>",
    "street": "<Preflop|Flop|Turn|River>"
  },
  "acaoCorreta": "<Fold|Call|Raise|All-in>",
  "raiseIdeal": <valor ideal do raise em BB se a ação correta for Raise, senão null>,
  "explicacao": "<explicação técnica detalhada de por que esta é a ação correta, incluindo pot odds, equity, ranges>",
  "dificuldade": <1 a 10>
}

REGRAS:
- Varie as situações: preflop, postflop, multiway, heads-up, torneio, cash game.
- A dificuldade deve escalar progressivamente com o número do cenário.
- Cenários devem ser realistas e educativos.
- Se o cenário for nível ${"{scenarioNumber}"}, aumente a complexidade proporcionalmente.
- Responda APENAS com JSON válido.`;

const EVALUATE_PROMPT = `Você é Mycroft 2.0, perito forense de poker. Avalie a decisão do jogador E forneça uma análise multi-perspectiva.

Cenário:
{scenario}

Ação do jogador: {playerAction}
Valor do raise (se aplicável): {raiseAmount}
Ação correta: {correctAction}

Responda EXATAMENTE no formato JSON:

{
  "correto": <true ou false>,
  "nota": <0 a 100>,
  "feedbackMycroft": "<feedback técnico e analítico do Mycroft, 2-3 frases, tom frio e preciso>",
  "feedbackHorus": "<comentário provocativo e curto do Hórus sobre a decisão, 1 frase>",
  "explicacaoDetalhada": "<explicação completa da jogada ideal com cálculos>",
  "bcGanho": <BC ganhos se correto (50-200), 0 se errado>,
  "bcPerdido": <BC perdidos se errado (100-500), 0 se correto>,
  "evDiferenca": "<diferença de EV entre a jogada feita e a ideal>",
  "perspectivas": {
    "tag": {
      "acao": "<ação recomendada pelo estilo TAG>",
      "raciocinio": "<explicação curta do raciocínio TAG, 1-2 frases>",
      "ev": "<EV estimado em BB, ex: +0.5BB ou -0.2BB>"
    },
    "lag": {
      "acao": "<ação recomendada pelo estilo LAG>",
      "raciocinio": "<explicação curta do raciocínio LAG, 1-2 frases>",
      "ev": "<EV estimado em BB>"
    },
    "gto": {
      "acao": "<ação GTO (pode incluir mixing, ex: 'Fold 85% / Call 15%')>",
      "raciocinio": "<explicação curta do raciocínio GTO/solver, 1-2 frases>",
      "ev": "<EV estimado em BB>"
    },
    "jogadorEv": "<EV da ação do jogador em BB>",
    "melhorEstilo": "<tag|lag|gto - qual estilo se encaixa melhor na jogada ideal para este spot>"
  }
}

REGRAS:
- Se a ação é parcialmente correta (ex: Call ao invés de Raise, mas não Fold), dê crédito parcial.
- O feedback do Mycroft deve ser técnico e usar termos de poker.
- O feedback do Hórus deve ser provocativo mas educativo.
- As 3 perspectivas devem ser GENUINAMENTE diferentes — TAG é conservador, LAG é exploitativo, GTO é equilibrado.
- O EV de cada perspectiva deve ser realista e consistente com o cenário.
- "melhorEstilo" deve indicar qual abordagem é mais lucrativa neste spot específico.
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
    const { action, scenarioNumber, scenario, playerAction, raiseAmount, correctAction, handContext } = await req.json();

    if (action === "generate") {
      const contextHint = handContext
        ? `\nBaseie o cenário nas seguintes características da mão analisada anteriormente:\n${handContext}\n`
        : "";
      const prompt = GENERATE_PROMPT.replace("${scenarioNumber}", String(scenarioNumber || 1)) +
        contextHint +
        `\n\nGere o cenário número ${scenarioNumber || 1} de 10.`;
      const result = await callGeminiAI(prompt);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "evaluate") {
      const prompt = EVALUATE_PROMPT
        .replace("{scenario}", JSON.stringify(scenario))
        .replace("{playerAction}", playerAction)
        .replace("{raiseAmount}", raiseAmount || "N/A")
        .replace("{correctAction}", correctAction);
      const result = await callGeminiAI(prompt);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("arena-poker-training error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
