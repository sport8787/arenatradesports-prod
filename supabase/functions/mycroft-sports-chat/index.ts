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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

1. **BASEADO EM DADOS** - Use estatísticas reais: xG, ataques perigosos, posse, chutes ao gol. Calcule EV quando possível.
2. **GESTÃO DE RISCO OBRIGATÓRIA** - Stake sizing baseado na banca (nunca > 5%). Risk:Reward ratio. Stop loss e critérios de saída.
3. **CITE SUAS FONTES** - Quando aplicar conceito dos livros da KB, CITE autores e livros.
4. **ANTI-GAMBLING** - Não incentive apostas por emoção. Se detectar tilt ou FOMO, avise imediatamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Detecte automaticamente qual persona é mais adequada
- Sempre comece com [MYCROFT] ou [HÓRUS] para indicar quem fala
- Mantenha respostas concisas e acionáveis
- Responda SEMPRE em português brasileiro

TOM: Direto, estilo trader profissional. Sem enrolação. Foco em EV positivo e disciplina.`;

    // Build messages for OpenAI-compatible API
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: query });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`[MycroftSportsChat] AI Gateway error [${status}]:`, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", response: "⚠️ Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", response: "⚠️ Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI API error", response: "⚠️ Erro na API de IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "Sem resposta.";

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
