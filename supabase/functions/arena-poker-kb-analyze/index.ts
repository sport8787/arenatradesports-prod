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

async function loadKnowledgeBase(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const contents: string[] = [];
  try {
    const { data: files } = await supabase.storage.from("poker-knowledge-base").list("", { limit: 50 });
    if (files) {
      for (const file of files) {
        if (!file.name || file.name.length === 0) continue;
        try {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (!["txt", "md", "csv"].includes(ext || "")) continue;
          const { data: fileData } = await supabase.storage.from("poker-knowledge-base").download(file.name);
          if (!fileData) continue;
          const text = await fileData.text();
          contents.push(`\n━━━ ${file.name} ━━━\n${text.substring(0, 80000)}`);
        } catch (e) {
          console.error(`Error reading ${file.name}:`, e);
        }
      }
    }
  } catch (e) {
    console.error("KB loading error:", e);
  }
  console.log(`📚 Poker KB loaded: ${contents.length} files, ${contents.join("").length} chars`);
  return contents.join("\n\n");
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
      await sb.from("ai_response_cache").update({ hit_count: (data as any).hit_count + 1 }).eq("id", data.id);
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

    const cacheKey = await sha256(`kb-analyze:${handHistory.trim()}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ ...cached, _cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } }
      );
    }

    const kb = await loadKnowledgeBase();

    const systemPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é MYCROFT POKER, inteligência artificial especializada em análise forense de poker.
Você combina duas personas:

**Mycroft** — Perito forense técnico. Frio, calculista. Foco em ranges, equity, sizing, pot odds, SPR, blockers, fold equity, EV.
**Hórus** — Coach provocativo. Foco em mental game, tilt, disciplina, patterns comportamentais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE DE CONHECIMENTO (OBRIGATÓRIA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${kb ? `DOCUMENTOS CARREGADOS:
${kb}

INSTRUÇÃO CRÍTICA: Você DEVE fundamentar TODA a sua análise nos conceitos dos documentos acima.
- CITE os autores e livros (ex: "Segundo Owen Gaines em Poker Math That Matters...")
- APLIQUE as fórmulas e conceitos diretamente ao hand history
- COMPARE a jogada do Hero com o que os livros recomendam
- IDENTIFIQUE violações dos princípios ensinados nos documentos
` : "Nenhum documento na KB. Use conhecimento geral de poker."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPOSTA (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "analise_completa": "<Análise COMPLETA em markdown (mínimo 1500 chars). Estrutura obrigatória:

🃏 ANÁLISE FORENSE MYCROFT — [POSIÇÃO] [CARTAS]

━━━ 📋 RESUMO DA MÃO ━━━
[Fatos objetivos]

━━━ 🔍 DIAGNÓSTICO POR STREET ━━━
[Para cada street: opções, ranges, sizing correto, cálculos de pot odds/equity]

━━━ 📖 FUNDAMENTAÇÃO (LIVROS) ━━━
[CITE os livros da KB, aplique conceitos ESPECÍFICOS à mão analisada]
[Ex: 'Segundo Owen Gaines (Poker Math That Matters, Cap. X), a equity necessária para call aqui é Y%, e Hero tem apenas Z%']

━━━ ⚠️ LEAKS DETECTADOS ━━━
[Erros técnicos e mentais, com referência aos livros]

━━━ 📏 REGRA DE BOLSO ━━━
[Heurística prática extraída dos livros]

━━━ 🎯 PLANO DE TREINO ━━━
[Exercício específico baseado no leak identificado]",
  
  "nota": <0-100>,
  "resumo_curto": "<1 frase diagnóstico>",
  "leaks": ["<leak 1>", "<leak 2>"],
  "citacoes": ["<citação relevante do livro 1>", "<citação do livro 2>"],
  "conselho_horus": "<frase de impacto do Hórus>"
}

REGRAS:
- CITE SEMPRE os livros da KB
- Cálculos de pot odds, equity, SPR são OBRIGATÓRIOS
- Responda APENAS com JSON válido
- Responda em português brasileiro`;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nAnalise o seguinte Hand History:\n\n${handHistory}` }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000 },
        }),
      }
    );

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "RATE_LIMITED" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const body = await response.text();
      console.error(`Gemini error [${response.status}]:`, body);
      throw new Error(`AI_ERROR_${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No content");

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    setCache(cacheKey, "arena-poker-kb-analyze", result);

    return new Response(
      JSON.stringify({ ...result, _cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" } }
    );
  } catch (e) {
    console.error("arena-poker-kb-analyze error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: msg === "RATE_LIMITED" ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
