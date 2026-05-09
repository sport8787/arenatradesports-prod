import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Cache helpers ──────────────────────────────────────────
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
      // Increment hit count (fire-and-forget)
      sb.from("ai_response_cache").update({ hit_count: undefined }).eq("id", data.id)
        .then(() => sb.rpc("increment_cache_hit", { p_id: data.id }).catch(() => {}));
      // Simple increment via raw update
      await sb.from("ai_response_cache").update({ hit_count: (data as any).hit_count + 1 } as any).eq("id", data.id);
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
    console.log(`Cache SET for key ${cacheKey.slice(0, 12)}...`);
  } catch (e) {
    console.warn("Cache write error:", e);
  }
}

// ─── Prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um analista de poker de elite que combina dois perfis:

**MYCROFT** (Técnico): Analisa sizing, ranges, frequências, SPR, fold equity, pot odds, equity, blockers e EV com precisão cirúrgica.

**HÓRUS** (Estratégico): Coach provocativo focado em mental game, psicologia e leitura de adversários.

Analise o Hand History fornecido e responda EXATAMENTE no seguinte formato JSON:

{
  "veredito": {
    "nota": <número de 0 a 100 avaliando a qualidade da jogada>,
    "resumo": "<1-2 frases com o diagnóstico geral>"
  },
  "scriptVencedor": {
    "titulo": "<título curto descrevendo a linha ideal>",
    "passos": [
      {
        "street": "<Preflop|Flop|Turn|River>",
        "acao": "<ação ideal curta, ex: '3-bet para 9BB'>",
        "explicacao": "<explicação detalhada com cálculos de pot odds, equity, sizing ideal, motivo técnico>"
      }
    ]
  },
  "visaoHorus": {
    "insight": "<insight de psicologia/mental game sobre a jogada>",
    "leituraVilao": "<leitura do range e tendências do vilão baseado nas ações>",
    "conselho": "<frase de impacto / regra de bolso para o jogador>"
  }
}

REGRAS:
- Pós-sessão apenas. Não forneça conselho em tempo real.
- Seja preciso com cálculos (pot odds, equity, SPR).
- O "scriptVencedor" deve ter um passo para cada street jogada.
- O "conselho" do Hórus deve ser uma frase curta e memorável.
- Se suspeitar tilt/compulsão, recomende cooldown.
- Responda APENAS com JSON válido.`;

// ─── Gemini with retry ──────────────────────────────────────
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

// ─── Handler ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { handHistory } = await req.json();
    if (!handHistory || typeof handHistory !== "string") {
      return new Response(
        JSON.stringify({ error: "handHistory is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache first
    const cacheKey = await sha256(`analyze:${handHistory.trim()}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ ...cached, _cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } }
      );
    }

    const userPrompt = `Analise o seguinte Hand History de poker:\n\n${handHistory}`;
    const result = await callGeminiAI(SYSTEM_PROMPT, userPrompt);

    // Save to cache (fire-and-forget)
    setCache(cacheKey, "arena-poker-analyze", result);

    return new Response(
      JSON.stringify({ ...result, _cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" } }
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
