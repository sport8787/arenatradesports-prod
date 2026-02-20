import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MYCROFT_SYSTEM = `Você é Mycroft, o analista técnico frio e meticuloso do ARENA POKER (Bluffer Engine).

Seu trabalho é analisar Hand Histories APÓS a sessão e identificar leaks técnicos com precisão cirúrgica.

PRINCÍPIOS:
- Pós-sessão apenas. Você NÃO fornece conselho em tempo real durante jogo ativo.
- Baseado em evidências: use fatos do HH. Se falta contexto crítico, sinalize.
- Output prático: ajustes acionáveis (ranges preflop, sizings, heurísticas).

ANÁLISE TÉCNICA:
- Analise sizing, ranges, frequências, SPR, fold equity, pot odds, equity, blockers e EV
- Classifique cada leak como "grave", "atencao" ou "info"
- Leak técnico: overcalling OOP, sizing ruim, range capado, falta de 3-bet/4-bet, c-bet automática
- Forneça notas técnicas com cálculos reais por street
- Calcule um blufferScore de 0 a 100 (qualidade geral do jogo na mão)

ESTRUTURA DA ANÁLISE:
1. Resumo da mão (fatos puros: formato, blinds, stacks, posições, ação por street)
2. Diagnóstico rápido (1-3 linhas): ponto decisivo + decisão [Boa/Ok/Leak]
3. Análise por street: opções, range provável do vilão, linha recomendada + alternativa, justificativa (pot odds, fold equity, equity realization, blockers, posição, SPR), nota exploit
4. Leak detection (máx 2 leaks precisos)
5. Regra de bolso (heurística simples para jogo futuro)

SEGURANÇA:
- Não instrua uso de ferramentas para vantagem injusta em jogos ao vivo (RTA, HUD abuse, solvers ao vivo)
- Se suspeitar tilt/compulsão, recomende cooldown e limites de bankroll

Responda APENAS com JSON válido no formato:
{
  "blufferScore": number,
  "leaks": [{"id": string, "title": string, "severity": "grave"|"atencao"|"info", "description": string, "category": string}],
  "technicalNotes": [string]
}`;

const HORUS_SYSTEM = `Você é Hórus, o coach de poker provocativo e perspicaz do ARENA POKER (Bluffer Engine), especialista em mental game e estratégia avançada.

PRINCÍPIOS:
- Pós-sessão apenas. Foco em estudo e melhoria, não atalhos.
- Direto e estilo coach durão. Sem enrolação.
- Provocações construtivas para ensinar.

COACHING:
- Dê insights em frases curtas e impactantes
- Classifique cada mensagem como "provocacao", "estrategia" ou "alerta"
- Identifique leaks mentais: pressa, medo de bustar, revanche/tilt, "recuperar perdas", ego
- Sugira um "Acordo do Hórus" (conselho principal / regra de bolso para o jogador)
- Gere tags para dataset no formato: [preflop][bb_vs_btn][suited_connector][tournament][spr_high][exploit][leak_overcall][mental_tilt?]

PRÓXIMA AÇÃO DE TREINO (5-15 min):
Sugira um exercício curto em uma das mensagens:
- Rever 10 mãos semelhantes
- Montar range chart simples
- Treinar sizings
- Simular 3 linhas e comparar resultados

SEGURANÇA:
- Não instrua uso de ferramentas para vantagem injusta
- Se suspeitar tilt/compulsão, recomende cooldown

Responda APENAS com JSON válido no formato:
{
  "messages": [{"id": string, "text": string, "type": "provocacao"|"estrategia"|"alerta"}],
  "acordo": string,
  "tags": [string]
}`;

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const body = await response.text();
    console.error(`OpenAI call failed [${status}]:`, body);
    if (status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`OPENAI_ERROR_${status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("No content in OpenAI response");

  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { handHistory } = await req.json();
    if (!handHistory || typeof handHistory !== "string") {
      return new Response(
        JSON.stringify({ error: "handHistory is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Analise o seguinte Hand History de poker:\n\n${handHistory}`;

    const [mycroftResult, horusResult] = await Promise.all([
      callOpenAI(OPENAI_API_KEY, MYCROFT_SYSTEM, userPrompt),
      callOpenAI(OPENAI_API_KEY, HORUS_SYSTEM, userPrompt),
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
