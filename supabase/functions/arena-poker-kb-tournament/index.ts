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
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["txt", "md", "csv"].includes(ext || "")) continue;
        try {
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
    const { data } = await sb.from("ai_response_cache").select("id, response_json")
      .eq("cache_key", cacheKey).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (data) {
      await sb.from("ai_response_cache").update({ hit_count: (data as any).hit_count + 1 }).eq("id", data.id);
      return data.response_json;
    }
  } catch (e) { console.warn("Cache error:", e); }
  return null;
}

async function setCache(cacheKey: string, fn: string, response: any) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("ai_response_cache").upsert({
      cache_key: cacheKey, function_name: fn, response_json: response,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key" });
  } catch (e) { console.warn("Cache write error:", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hands } = await req.json();
    if (!hands || !Array.isArray(hands) || hands.length < 1) {
      return new Response(
        JSON.stringify({ error: "At least 1 hand required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullContent = hands.join("\n\n");
    const cacheKey = await sha256(`kb-tournament:${fullContent.trim()}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ ...cached, _cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } }
      );
    }

    const kb = await loadKnowledgeBase();

    const systemPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE: MYCROFT POKER — ANÁLISE DE TORNEIO COM KB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é Mycroft Poker, perito forense em torneios de poker. Analise o desempenho GLOBAL do Hero neste torneio usando como referência os livros da Base de Conhecimento.

━━━ BASE DE CONHECIMENTO ━━━
${kb || "Nenhum documento carregado."}
━━━ FIM DA KB ━━━

INSTRUÇÃO CRÍTICA:
- FUNDAMENTE cada avaliação nos livros da KB
- CITE autores e conceitos específicos
- COMPARE as decisões do Hero com o que os livros recomendam
- IDENTIFIQUE violações de princípios dos livros

Responda APENAS com JSON válido:
{
  "analise_torneio": "<Análise COMPLETA em markdown (mínimo 2000 chars). Estrutura:

🏆 ANÁLISE DO TORNEIO — MYCROFT POKER (KB)

━━━ 📋 VISÃO GERAL ━━━
[Resumo do torneio, resultado, número de mãos]

━━━ 📖 AVALIAÇÃO BASEADA NOS LIVROS ━━━
[Para cada momento-chave, cite o livro relevante e explique o que deveria ter sido feito]
[Ex: 'Na mão #5, Hero violou o princípio de pot odds descrito por Owen Gaines...']

━━━ 📊 GESTÃO DE STACK ━━━
[Avalie stack management citando conceitos dos livros]

━━━ 🎯 ICM & DECISÕES DE BOLHA ━━━
[Avalie ICM awareness com referências teóricas]

━━━ ⚠️ LEAKS RECORRENTES ━━━
[Padrões de erro que se repetem, com fundamentação dos livros]

━━━ 📏 PLANO DE ESTUDO ━━━
[Capítulos/conceitos específicos dos livros que o jogador deve revisar]

━━━ 🔮 PROGNÓSTICO ━━━
[Se continuar jogando assim, qual o futuro provável]",

  "veredito": "<eliminado_erro_tecnico|eliminado_cooler|eliminado_acumulo_erros|eliminado_tilt|premiado_competencia|premiado_sorte|premiado_misto>",
  "scoreGeral": <0-100>,
  "titulo": "<título impactante>",
  "leaks_principais": ["<leak 1>", "<leak 2>", "<leak 3>"],
  "livros_recomendados": ["<capítulo/seção específica do livro 1>", "<do livro 2>"],
  "conselho_horus": "<frase de impacto do Hórus baseada nos livros>"
}

Responda em português brasileiro.`;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const userPrompt = hands.map((h: string, i: number) => `--- MÃO #${i + 1} ---\n${h}`).join("\n\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nTorneio com ${hands.length} mãos:\n\n${userPrompt}` }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000 },
        }),
      }
    );

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "RATE_LIMITED" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    
    let result: any;
    try {
      result = JSON.parse(cleaned);
    } catch (_parseErr) {
      // Attempt to repair truncated JSON
      let repaired = cleaned;
      // Close any unterminated strings
      const quoteCount = (repaired.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) repaired += '"';
      // Close arrays/objects
      const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < openBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces; i++) repaired += '}';
      try {
        result = JSON.parse(repaired);
      } catch (_e2) {
        // Fallback: extract what we can
        result = {
          analise_torneio: cleaned.substring(0, 4000),
          veredito: "eliminado_erro_tecnico",
          scoreGeral: 50,
          titulo: "Análise parcial",
          leaks_principais: [],
          livros_recomendados: [],
          conselho_horus: "A análise foi parcialmente processada."
        };
      }
    }

    setCache(cacheKey, "arena-poker-kb-tournament", result);

    return new Response(
      JSON.stringify({ ...result, _cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" } }
    );
  } catch (e) {
    console.error("arena-poker-kb-tournament error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }),
      { status: msg === "RATE_LIMITED" ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
