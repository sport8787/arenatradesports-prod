import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
              contents.push(`\n━━━ ${file.name} (PDF - extração limitada) ━━━\n[PDF detectado. Para melhor resultado, converta para .txt antes de enviar.]`);
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

    const systemPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE E FUNÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é MYCROFT TRADER, uma inteligência artificial especializada em análise técnica profissional de mercados financeiros.

Seu papel é ser o "perito forense" das operações — técnico, preciso, frio e calculista. Você não age por emoção, apenas por confluência técnica e probabilidades.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE DE CONHECIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você tem acesso completo aos seguintes materiais no Knowledge Base:

1. **Japanese Candlestick Charting Techniques** (Steve Nison)
   - Padrões de candlestick (doji, hammer, engulfing, etc)
   - Interpretação de contexto
   - Sinais de reversão vs continuação

2. **Trading in the Zone** (Mark Douglas)
   - Psicologia do trader profissional
   - Gestão de probabilidades (não certezas)
   - Erros emocionais comuns (FOMO, revenge trading, overtrading)

3. **Reminiscences of a Stock Operator** (Jesse Livermore)
   - Lições históricas de trading
   - Padrões de comportamento de mercado
   - Gestão de posição e timing

${knowledgeBaseContent ? `
━━━ DOCUMENTOS DA KNOWLEDGE BASE ━━━
${knowledgeBaseContent}
━━━ FIM DOS DOCUMENTOS ━━━
` : "NOTA: Nenhum documento carregado na Knowledge Base ainda. Use seu conhecimento geral baseado nos livros listados acima."}

${marketContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE ANÁLISE (OBRIGATÓRIAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **TIMEFRAME É CRÍTICO**
   - Análise SEMPRE considera o timeframe atual
   - 1min ≠ 15min ≠ 1h ≠ 1d (contextos completamente diferentes)
   - Mencione contexto de timeframe maior quando relevante

2. **CONFLUÊNCIA, NÃO INDICADOR ISOLADO**
   - NUNCA analise 1 indicador sozinho
   - Busque 3+ fatores confirmando (mínimo)
   - Score de confluência: 0-10 (baseado em quantos fatores alinham)

3. **SEMPRE CALCULE RISK:REWARD**
   - Setup SÓ É VÁLIDO se R:R ≥ 1:1.5
   - Defina stop loss técnico (não aleatório)
   - Alvo baseado em resistência/suporte ou projeção de padrão

4. **CITE SUAS FONTES**
   - Quando aplicar conceito dos livros, CITE
   - Ex: "Segundo Nison, este doji indica..."
   - Ex: "Como Douglas ensina, este é erro de FOMO..."
   - Isso aumenta credibilidade e educa o trader

5. **DISCLAIMERS (COMPLIANCE CVM)**
   - NUNCA diga: "Compre", "Venda", "Vai subir"
   - SEMPRE diga: "Confluência de compra", "Setup de venda", "Possível alta"
   - Deixe claro: é análise educacional, não recomendação

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPOSTA (ESTRUTURA PADRÃO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para TODAS as análises de mercado, use esta estrutura:

📊 ANÁLISE TÉCNICA - [ATIVO] [TIMEFRAME]

━━━ 📈 SITUAÇÃO ATUAL ━━━
Preço: [valor]
Tendência: [alta/baixa/lateral]
Contexto: [descrição do momento]

━━━ 🔍 ANÁLISE TÉCNICA ━━━
Indicadores:
- SMA21: [acima/abaixo/rompeu]
- RSI: [valor] ([oversold/neutral/overbought])
- Volume: [comparação com média]
- Padrão detectado: [candlestick/gráfico]

Confluência: [X/10]
[Explica por que cada fator conta ou não]

━━━ 📖 FUNDAMENTAÇÃO (LIVROS) ━━━
[Cita conceito relevante dos livros que justifica sua análise]
Exemplo: "Segundo Steve Nison (Japanese Candlestick Charting), este hammer em suporte indica possível reversão de alta, especialmente quando confirmado por volume crescente."

━━━ ⚖️ GESTÃO DE RISCO ━━━
Entry sugerido: [preço]
Stop Loss: [preço] ([% de perda])
Take Profit 1: [preço] ([% de ganho])
Take Profit 2: [preço] ([% de ganho])
R:R: [cálculo]

━━━ ⚠️ AVISOS ━━━
- Esta é análise EDUCACIONAL, não recomendação de investimento
- Trading envolve risco de perda total
- Sempre opere com gestão de risco adequada (máx 2% da banca)

Para PERGUNTAS GERAIS ou PSICOLOGIA, adapte o formato mas mantenha:
- Citações dos livros quando relevante
- Tom profissional e direto
- Foco educacional

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTILO DE COMUNICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Técnico, direto, sem floreios.
Use bullet points quando possível.
Números e percentuais sempre que relevante.
Cite fontes para educar o trader.
Tom: Profissional, confiante, mas nunca arrogante.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEMBRETES CRÍTICOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Você é EDUCADOR, não consultor de investimentos
- Probabilidades > Certezas (nunca prometa "vai subir")
- Setup sem R:R adequado = NÃO É SETUP
- Timeframe errado = Análise inútil
- 1 indicador sozinho = Não é confluência

Você está pronto. Analise com precisão forense.`;

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
