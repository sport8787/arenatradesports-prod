import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getCache(cacheKey: string) {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("ai_response_cache")
      .select("id, response_json")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) {
      sb.from("ai_response_cache").update({ hit_count: (data as any).hit_count + 1 }).eq("id", data.id).then(() => {});
      console.log(`Cache HIT for key ${cacheKey.slice(0, 12)}...`);
      return data.response_json;
    }
  } catch (e) {
    console.warn("Cache read error:", e);
  }
  return null;
}

async function setCache(cacheKey: string, functionName: string, response: any) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("ai_response_cache").upsert({
      cache_key: cacheKey,
      function_name: functionName,
      response_json: response,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key" });
  } catch (e) {
    console.warn("Cache write error:", e);
  }
}

const SYSTEM_PROMPT = `Você é um analista de torneios de poker de elite. Você recebe TODAS as mãos jogadas por um jogador (Hero) em um torneio completo.

Sua missão é avaliar o DESEMPENHO GERAL DO TORNEIO do jogador, NÃO mão a mão.

ANÁLISE OBRIGATÓRIA:
1. Identifique se o jogador foi ELIMINADO ou TERMINOU EM POSIÇÃO PREMIADA (ITM)
2. Se eliminado: explique EXATAMENTE o que causou a eliminação (mão final, decisões anteriores que comprometeram o stack, erros acumulados)
3. Se premiado: avalie se o resultado foi principalmente COMPETÊNCIA, SORTE ou ACASO, com argumentos claros
4. Avalie a gestão de stack (stack management) ao longo do torneio
5. Identifique momentos-chave de decisão que definiram o destino do jogador
6. Avalie ICM awareness (decisões de bolha, final table, etc.)

CATEGORIAS DE VEREDICTO:
- "eliminado_erro_tecnico" - Eliminado por erro técnico claro (call ruim, sizing errado)
- "eliminado_cooler" - Eliminado por cooler/bad beat (KK vs AA, set over set)
- "eliminado_acumulo_erros" - Eliminado por acúmulo de erros ao longo do torneio
- "eliminado_tilt" - Eliminado após sinais de tilt (aumentos erráticos, calls desesperados)
- "premiado_competencia" - ITM por decisões consistentemente boas
- "premiado_sorte" - ITM com muitas situações de sorte (suckouts, walks)
- "premiado_misto" - ITM com mix de decisões boas e sorte

Responda APENAS com JSON válido no formato:
{
  "veredito": "eliminado_erro_tecnico" | "eliminado_cooler" | "eliminado_acumulo_erros" | "eliminado_tilt" | "premiado_competencia" | "premiado_sorte" | "premiado_misto",
  "titulo": "<título impactante de 1 linha sobre o desempenho>",
  "resumo": "<resumo de 2-3 frases do desempenho geral>",
  "scoreGeral": <0-100>,
  "momentosChave": [
    {
      "maoNumero": <número da mão>,
      "descricao": "<o que aconteceu e por que importa>",
      "impacto": "positivo" | "negativo" | "neutro"
    }
  ],
  "stackManagement": {
    "nota": <0-100>,
    "comentario": "<avaliação da gestão de stack>"
  },
  "icmAwareness": {
    "nota": <0-100>,
    "comentario": "<avaliação de ICM awareness>"
  },
  "causaEliminacao": "<se eliminado, explicação detalhada da causa. Se premiado, null>",
  "fatoresSorte": "<momentos onde sorte/azar influenciou significativamente>",
  "conselhoFinal": "<conselho direto e memorável para o próximo torneio>",
  "tags": [<tags para categorização>]
}`;

async function callGeminiAI(systemPrompt: string, userPrompt: string) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      if (response.status === 429) { lastError = new Error("RATE_LIMITED"); continue; }
      if (!response.ok) {
        const body = await response.text();
        console.error(`Gemini API error [${response.status}]:`, body);
        throw new Error(`AI_ERROR_${response.status}`);
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No content in Gemini response");
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      if (e instanceof Error && e.message === "RATE_LIMITED") { lastError = e; continue; }
      throw e;
    }
  }
  throw lastError || new Error("RATE_LIMITED");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hands } = await req.json();
    if (!hands || !Array.isArray(hands) || hands.length < 1) {
      return new Response(
        JSON.stringify({ error: "At least 1 hand history is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullContent = hands.join("\n\n");
    const cacheKey = await sha256(`tournament-review:${fullContent.trim()}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ ...cached, _cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } }
      );
    }

    const userPrompt = hands
      .map((h: string, i: number) => `--- MÃO #${i + 1} ---\n${h}`)
      .join("\n\n");

    const result = await callGeminiAI(
      SYSTEM_PROMPT,
      `Analise o desempenho do Hero neste torneio com ${hands.length} mãos:\n\n${userPrompt}`
    );

    setCache(cacheKey, "arena-poker-tournament-review", result);

    return new Response(
      JSON.stringify({ ...result, _cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" } }
    );
  } catch (e) {
    console.error("arena-poker-tournament-review error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
