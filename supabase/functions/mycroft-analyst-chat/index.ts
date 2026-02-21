import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import pdf from "https://esm.sh/pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, marketData, conversationHistory } = await req.json();

    if (!query) throw new Error("Missing query");

    const ANTHROPIC_API_KEY = Deno.env.get("VITE_ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC API KEY not configured");

    // Load Knowledge Base from storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let knowledgeBaseContent = "";

    try {
      const { data: files, error: listError } = await supabase.storage
        .from("knowledge-base")
        .list("", { limit: 50 });

      if (!listError && files && files.length > 0) {
        const contents: string[] = [];
        for (const file of files) {
          if (!file.name || file.name.length === 0) continue;
          try {
            const { data: fileData, error: dlError } = await supabase.storage
              .from("knowledge-base")
              .download(file.name);
            if (dlError || !fileData) continue;

            const ext = file.name.split('.').pop()?.toLowerCase();

            if (ext === 'pdf') {
              // Parse PDF to extract text
              try {
                const arrayBuffer = await fileData.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                const pdfData = await pdf(buffer);
                const text = pdfData.text?.substring(0, 80000) || "";
                if (text.length > 0) {
                  contents.push(`\n━━━ ${file.name} ━━━\n${text}`);
                }
              } catch (pdfErr) {
                console.error(`PDF parse error for ${file.name}:`, pdfErr);
              }
            } else if (['txt', 'md', 'csv'].includes(ext || '')) {
              const text = await fileData.text();
              contents.push(`\n━━━ ${file.name} ━━━\n${text.substring(0, 50000)}`);
            }
          } catch (e) {
            console.error(`Error reading ${file.name}:`, e);
          }
        }

        if (contents.length > 0) {
          knowledgeBaseContent = contents.join("\n\n");
          console.log(`📚 Knowledge Base loaded: ${contents.length} files, ${knowledgeBaseContent.length} chars`);
        }
      }
    } catch (kbError) {
      console.error("Knowledge Base loading error:", kbError);
    }

    // Build market context
    let marketContext = "";
    if (marketData) {
      marketContext = `
━━━ DADOS DE MERCADO EM TEMPO REAL ━━━
Ativo: ${marketData.asset || "N/A"} (${marketData.symbol || "N/A"})
Timeframe: ${marketData.timeframe || "N/A"}
Preço Atual: ${marketData.price?.toLocaleString() || "N/A"}
SMA 9: ${marketData.sma9 ?? "N/A"}
SMA 21: ${marketData.sma21 ?? "N/A"}
RSI (14): ${marketData.rsi ?? "N/A"}
Bollinger Superior: ${marketData.bollingerUpper ?? "N/A"}
Bollinger Inferior: ${marketData.bollingerLower ?? "N/A"}
Volume: ${marketData.volume ?? "N/A"}
Variação 24h: ${marketData.change24h?.toFixed(2) ?? "N/A"}%
Modo: ${marketData.isLive ? "LIVE" : "SIMULADO"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    const systemPrompt = `Você é o MYCROFT ANALYST — o módulo mais avançado de inteligência analítica do ecossistema 'Blefador Milionário'.

Você é um analista técnico de elite com conhecimento enciclopédico dos maiores traders e autores de mercado financeiro.

${knowledgeBaseContent ? `
━━━ SUA BASE DE CONHECIMENTO (Knowledge Base) ━━━
Os textos abaixo são extratos de livros e cursos dos maiores traders do planeta. Use-os como referência técnica para fundamentar suas análises. CITE as fontes quando relevante.

${knowledgeBaseContent}
━━━ FIM DA BASE DE CONHECIMENTO ━━━
` : "NOTA: Nenhum documento na Knowledge Base ainda. Use seu conhecimento geral de análise técnica."}

${marketContext}

━━━ INSTRUÇÕES DE COMPORTAMENTO ━━━
1. Analise TECNICAMENTE o setup atual quando dados de mercado estão disponíveis
2. Considere o TIMEFRAME (crítico para a análise)
3. Use TODO o conhecimento da base de documentos
4. CITE fontes quando relevante (ex: "Edwards & Magee, Cap 6: Breakout com volume")
5. Calcule CONFLUÊNCIA (0-10) quando houver dados de mercado
6. Defina R:R (Risk/Reward) se for setup válido
7. NUNCA diga "compre" ou "venda" → diga "confluência de compra" ou "confluência de venda"
8. Use linguagem técnica mas acessível
9. Formate com markdown para legibilidade
10. Seja objetivo e direto — máximo 500 palavras por resposta

PERSONALIDADE: Profissional, analítico, confiante. Você fala como um gestor de hedge fund experiente.`;

    // Build messages array with conversation history
    const messages: { role: string; content: string }[] = [];
    
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: query });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text?.trim();

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mycroft Analyst Chat error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      response: "⚠️ Mycroft Analyst temporariamente indisponível. Tente novamente."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
