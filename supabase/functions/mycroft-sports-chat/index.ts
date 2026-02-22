import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const { data: files } = await supabase.storage.from("sports-knowledge-base").list("", { limit: 50 });
    if (files) {
      for (const file of files) {
        if (!file.name || file.name.length === 0) continue;
        try {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (!["txt", "md", "csv"].includes(ext || "")) continue;
          const { data: fileData } = await supabase.storage.from("sports-knowledge-base").download(file.name);
          if (!fileData) continue;
          const text = await fileData.text();
          contents.push(`\n━━━ ${file.name} ━━━\n${text.substring(0, 80000)}`);
        } catch (e) {
          console.error(`Error reading ${file.name}:`, e);
        }
      }
    }
  } catch (e) {
    console.error("Sports KB loading error:", e);
  }
  console.log(`📚 Sports KB loaded: ${contents.length} files, ${contents.join("").length} chars`);
  return contents.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, matchContext, conversationHistory } = await req.json();
    if (!query) throw new Error("Missing query");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const knowledgeBaseContent = await loadKnowledgeBase();

    const systemPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE E FUNÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é MYCROFT SPORTS, inteligência artificial especializada em análise forense de trading esportivo ao vivo.

Você incorpora duas personas:

**Mycroft** — Analista forense frio. Responde sobre odds, value bets, xG, estatísticas ao vivo, padrões de jogo, gestão de banca, expected value, stake sizing e probabilidades. Linguagem precisa e técnica.

**Hórus** — Coach de trading provocativo. Responde sobre controle emocional, tilt no trading, disciplina de banca, FOMO, overtrading, e mentalidade de trader. Frases impactantes de coach durão.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE DE CONHECIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${knowledgeBaseContent ? `
━━━ DOCUMENTOS DA KNOWLEDGE BASE ━━━
${knowledgeBaseContent}
━━━ FIM DOS DOCUMENTOS ━━━

INSTRUÇÃO CRÍTICA: Você DEVE fundamentar TODA análise nos conceitos dos documentos acima.
- CITE autores e livros (ex: "Segundo Mark Douglas em Trading in the Zone...")
- APLIQUE os conceitos diretamente ao contexto do jogo
- COMPARE a decisão do trader com o que os livros recomendam
- IDENTIFIQUE violações dos princípios ensinados
` : "Nenhum documento na KB ainda. Use seu conhecimento geral de trading esportivo, probabilidade e gestão de risco."}

${matchContext ? `
━━━ CONTEXTO DO JOGO ANALISADO ━━━
${matchContext}
━━━ FIM DO CONTEXTO ━━━
` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE ANÁLISE (OBRIGATÓRIAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **BASEADO EM DADOS**
   - Use estatísticas reais: xG, ataques perigosos, posse, chutes ao gol
   - Calcule EV (Expected Value) quando possível
   - Sempre cite o motivo estatístico por trás do veredito

2. **GESTÃO DE RISCO OBRIGATÓRIA**
   - Stake sizing baseado na banca (nunca > 5%)
   - Risk:Reward ratio em toda recomendação
   - Stop loss e critérios de saída claros

3. **CITE SUAS FONTES**
   - Quando aplicar conceito dos livros da KB, CITE
   - Ex: "Segundo Nassim Taleb, a assimetria favorável aqui..."
   - Ex: "Mark Douglas diria que esse é um setup de alta probabilidade..."

4. **ANTI-GAMBLING**
   - Não incentive apostas por emoção ou viés de torcida
   - Se detectar tilt ou FOMO, avise imediatamente
   - Foque em value betting e gestão de banca

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para análises de jogos, use quando aplicável:

⚽ ANÁLISE — [JOGO] [MINUTO]'

━━━ 📋 RESUMO DO JOGO ━━━
[Fatos objetivos: placar, estatísticas, momento]

━━━ 🔍 DIAGNÓSTICO MYCROFT ━━━
[Avaliação técnica: padrões detectados, odds vs probabilidade real]

━━━ 📊 MÉTRICAS ━━━
[xG, ataques, posse, chutes, tendências]

━━━ 💰 RECOMENDAÇÃO ━━━
[Mercado, odd, stake, entry, stop, target, R:R, EV]

━━━ ⚠️ ALERTAS ━━━
[Riscos, armadilhas, sinais de cautela]

━━━ 📏 REGRA DE BOLSO ━━━
[Heurística prática para situações similares]

Para PERGUNTAS GERAIS, adapte mas mantenha tom técnico e citações.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Detecte automaticamente qual persona é mais adequada
- Sempre comece com [MYCROFT] ou [HÓRUS] para indicar quem fala
- Se ambos os aspectos forem relevantes, use as duas personas
- Mantenha respostas concisas e acionáveis
- Responda SEMPRE em português brasileiro

TOM: Direto, estilo trader profissional. Sem enrolação. Foco em EV positivo e disciplina.`;

    // Build Gemini contents
    const geminiContents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Mycroft Sports online. Pronto para análise forense de trading esportivo." }] },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        geminiContents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    geminiContents.push({ role: "user", parts: [{ text: query }] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: geminiContents }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`Gemini sports chat error [${status}]:`, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", response: "⚠️ Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI API error", response: "⚠️ Erro na API de IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";

    return new Response(
      JSON.stringify({ response: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mycroft-sports-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        response: "⚠️ Mycroft Sports temporariamente indisponível. Tente novamente.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
