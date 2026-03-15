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
    const { asset, candles, currentPrice, balance, position, technicalData, isLive, change24h, crossAssetData } = await req.json();

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
            if (['txt', 'md', 'csv'].includes(ext || '')) {
              const text = await fileData.text();
              contents.push(`\n━━━ ${file.name} ━━━\n${text.substring(0, 50000)}`);
            }
          } catch (e) {
            console.error(`Error reading ${file.name}:`, e);
          }
        }
        if (contents.length > 0) {
          knowledgeBaseContent = contents.join("\n\n");
          console.log(`📚 KB loaded: ${contents.length} files, ${knowledgeBaseContent.length} chars`);
        }
      }
    } catch (kbError) {
      console.error("KB loading error:", kbError);
    }

    const candleSummary = candles.slice(-10).map((c: any) =>
      `O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
    ).join(' | ');

    const recentCandles = candles.slice(-5);
    const avgClose = recentCandles.reduce((s: number, c: any) => s + c.close, 0) / recentCandles.length;
    const sentimento = currentPrice > avgClose * 1.01 ? 'Euforia Compradora' :
                       currentPrice < avgClose * 0.99 ? 'Pânico Vendedor' : 'Lateralização Neutra';

    const dataProvenance = isLive === true ? 'LIVE' : 'SIMULADO';
    const confiancaModifier = dataProvenance === 'SIMULADO' ? 'ATENÇÃO: Dados SIMULADOS. Reduza o peso da confiança em 40%. Trate como cenário de treino.' : 'Dados LIVE confirmados. Análise com confiança total.';

    const absChange = Math.abs(change24h || 0);
    const isCrypto = asset.category === 'crypto';
    const isFutures = asset.category === 'futures';
    let classeInstitucional = '';
    if (isCrypto ? absChange > 5 : isFutures ? absChange > 1.5 : absChange > 3) {
      classeInstitucional = 'FORÇA INSTITUCIONAL';
    } else if (absChange >= 0.5) {
      classeInstitucional = 'MOVIMENTO DE VAREJO/CONSOLIDAÇÃO';
    } else {
      classeInstitucional = 'ARMADILHA DE LIQUIDEZ';
    }

    const techSummary = technicalData ? `
Indicadores Técnicos Pré-Calculados:
- SMA 9: ${technicalData.sma9 ?? 'N/A'}
- SMA 21: ${technicalData.sma21 ?? 'N/A'}
- Bollinger Upper: ${technicalData.bollingerUpper ?? 'N/A'}
- Bollinger Lower: ${technicalData.bollingerLower ?? 'N/A'}
- RSI (14): ${technicalData.rsi ?? 'N/A'}
` : '';

    // Futures-specific rules
    const futuresRules = isFutures ? `
📊 REGRAS ESPECIAIS PARA MINI CONTRATOS (${asset.symbol}):

REGRA DA MILHAR:
- Identifique a milhar mais próxima (múltiplos de ${asset.symbol === 'WIN' ? '1.000' : '50'} pontos).
- 50 pontos ANTES e DEPOIS da milhar = "ZONA DE GUERRA". O mercado testa essas zonas psicológicas.
- Se o preço está na Zona de Guerra, indique no campo "zona_milhar".

STOP CURTO OBRIGATÓRIO:
- Mini Índice (WIN): NUNCA sugira stop > 150 pontos. Se o risco for maior, descarte a operação por "Falta de RRR".
- Mini Dólar (WDO): NUNCA sugira stop > 5 pontos. Se o risco for maior, descarte a operação por "Falta de RRR".
- O Valor do Ponto: WIN = R$0,20 | WDO = R$10,00.

CORRELAÇÃO FORENSE ÍNDICE vs DÓLAR:
${crossAssetData ? `
- WIN (Mini Índice): Preço ${crossAssetData.winPrice ?? 'N/A'} | Variação 24h: ${crossAssetData.winChange?.toFixed(2) ?? 'N/A'}%
- WDO (Mini Dólar): Preço ${crossAssetData.wdoPrice ?? 'N/A'} | Variação 24h: ${crossAssetData.wdoChange?.toFixed(2) ?? 'N/A'}%
- Se ambos sobem juntos (correlação positiva atípica): Classifique como "ZONA DE ARMADILHA — Divergência Atípica".
- Se o Dólar BR sobe contra o movimento global (DXY estável ou caindo): Avise sobre "INTERVENÇÃO ou PÂNICO LOCAL".
` : 'Dados de correlação indisponíveis.'}

SCRIPT DO HÓRUS PARA FUTUROS:
- Foque no Stop Loss. Exemplo: "Israel, o Mycroft posicionou o seu Stop na máxima do candle anterior. Se o Índice falhar na milhar, o elevador vai descer sem nós. Está pronto?"
- Se entrar em Zona de Guerra da Milhar: "Atenção! Zona de Guerra nos ${currentPrice.toLocaleString()}. Liquidez armadilhada. O Mycroft está de olho."
` : '';

    const kbSection = knowledgeBaseContent ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE DE CONHECIMENTO (KNOWLEDGE BASE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você tem acesso aos seguintes materiais de referência. USE-OS como base para suas análises, citando conceitos quando aplicável:

${knowledgeBaseContent}

━━━ FIM DA KNOWLEDGE BASE ━━━
` : '';

    const systemPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE E FUNÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é MYCROFT TRADER, inteligência artificial de análise técnica profissional do ecossistema "Blefador Milionário". Perito forense financeiro — técnico, preciso, frio e calculista.

${kbSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE ANÁLISE (OBRIGATÓRIAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **TIMEFRAME É CRÍTICO** - Análise SEMPRE considera o timeframe atual.
2. **CONFLUÊNCIA** - NUNCA analise 1 indicador sozinho. Busque 3+ fatores. Score: 0-10.
3. **RISK:REWARD** - Setup SÓ É VÁLIDO se R:R ≥ 1:1.5. Stop loss técnico.
4. **CITE FONTES DA KB** - "Segundo Nison...", "Como Douglas ensina..."
5. **COMPLIANCE CVM** - Diga "Confluência de compra/venda", nunca "Compre"/"Venda".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOLO FORENSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROVENIÊNCIA: ${dataProvenance}. ${confiancaModifier}
2. CONFLUÊNCIA: SMA 9/21 + Bollinger + RSI + Volume. Menos de 3 = HOLD.
3. LIQUIDEZ: Preço sem volume = "blefe de exaustão".
4. BANCA (${balance.toLocaleString()} TC): Risco máx 1% = ${Math.floor(balance * 0.01).toLocaleString()} TC/trade.

📈 FLUXO INSTITUCIONAL (${(change24h || 0).toFixed(2)}%): ${classeInstitucional}.

${futuresRules}

${techSummary}

REGRA MAIS IMPORTANTE — VEREDITO DE ENTRADA:
Você DEVE responder CLARAMENTE se o usuário deve ou não entrar AGORA. O campo "veredito_entrada" é OBRIGATÓRIO e deve conter uma das seguintes opções:
- "ENTRADA COMPRA AGORA" — se há confluência suficiente para comprar
- "ENTRADA VENDA AGORA" — se há confluência suficiente para vender/shortar  
- "NÃO ENTRAR — AGUARDAR" — se não há setup válido, explicando o que aguardar
O campo "analise_detalhada" DEVE terminar com uma seção "━━━ 🏁 VEREDITO FINAL ━━━" que repita o veredito e justifique em 2-3 frases.

RETORNE estritamente um JSON válido (sem markdown, sem backticks):
{
  "status_mercado": "BUY THE DIP" ou "HOLD" ou "SELL" ou "SHORT",
  "veredito_entrada": "ENTRADA COMPRA AGORA" ou "ENTRADA VENDA AGORA" ou "NÃO ENTRAR — AGUARDAR",
  "analise_detalhada": "Análise COMPLETA em markdown incluindo: 📈 SITUAÇÃO ATUAL, 🔍 ANÁLISE TÉCNICA (cada indicador), 📖 FUNDAMENTAÇÃO citando livros da KB, ⚖️ GESTÃO DE RISCO (entry/SL/TP/RR), ⚠️ AVISOS, e OBRIGATORIAMENTE ━━━ 🏁 VEREDITO FINAL ━━━ com a decisão clara de entrar ou não. Mínimo 800 chars.",
  "analise_forense": "Resumo técnico de até 200 chars.",
  "script_horus": "Texto provocativo para o Hórus, máximo 2 frases. ${isFutures ? 'FOQUE no Stop Loss e nas zonas de milhar.' : 'DEVE incorporar a leitura institucional.'}",
  "niveis_criticos": { "suporte": <número>, "resistencia": <número> },
  "alerta_de_estresse": "Baixo" ou "Médio" ou "Crítico",
  "blefe_de_mercado": true ou false,
  "volume_real_pct": <número 0-100>,
  "volume_burburinho_pct": <número 0-100>,
  "recomendacao_aporte": "Texto curto com size, SL e TP.",
  "confluencia_score": <número 0-10>,
  "indicadores_confirmados": ["lista dos indicadores que confirmam"],
  "status_institucional": "ACUMULAÇÃO" ou "DISTRIBUIÇÃO" ou "NEUTRO",
  "classe_fluxo": "${classeInstitucional}",
  "position_sizing": {
    "risco_maximo_tc": ${Math.floor(balance * 0.01)},
    "size_sugerido_tc": <número>,
    "sl_preco": <número>,
    "tp_preco": <número>,
    "rr_ratio": <número>
  },
  "proveniencia": "${dataProvenance}",
  "confianca_analise": <número 0-100>
  ${isFutures ? `,"zona_milhar": { "milhar_proxima": <número>, "distancia_pontos": <número>, "status": "ZONA DE GUERRA" ou "FORA DA ZONA" }, "correlacao_indice_dolar": "NORMAL" ou "DIVERGÊNCIA ATÍPICA" ou "INTERVENÇÃO LOCAL", "stop_max_pontos": ${asset.symbol === 'WIN' ? 150 : 5}` : ''}
}`;

    const userMessage = `Analise o ativo ${asset.symbol} (${asset.name}) no valor de ${currentPrice}.
Categoria: ${isCrypto ? 'Criptomoeda' : isFutures ? 'Mini Contrato Futuro B3' : 'Ação BR'}.
${isFutures ? `Valor do ponto: R$${asset.pointValue?.toFixed(2) || '0.20'}.` : ''}
Sentimento atual: ${sentimento}.
Variação 24h: ${(change24h || 0).toFixed(2)}%.
Proveniência dos dados: ${dataProvenance}.
Últimas 10 velas: ${candleSummary}
${position ? `Posição aberta: ${position.type.toUpperCase()} a ${position.entryPrice}, alavancagem ${position.leverage || 1}x` : 'Sem posição aberta.'}
Banca atual: ${balance.toLocaleString()} TC.
${techSummary}

PERGUNTA PRINCIPAL DO USUÁRIO: Posso entrar agora? Devo fazer uma entrada de COMPRA ou de VENDA neste momento? Se sim, em qual direção e com quais parâmetros? Se NÃO, explique claramente por que não e o que o usuário deve aguardar antes de entrar.

Forneça o relatório forense completo em JSON puro (sem markdown code blocks).`;

    // Use Google Gemini API
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log(`🧠 Calling Gemini for ${asset.symbol}...`);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    const textContent = aiData.choices?.[0]?.message?.content;

    if (!textContent) {
      throw new Error("No content from AI Gateway");
    }

    console.log("Mycroft Trader Forense raw length:", textContent.length);

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to extract JSON object if there's extra text
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) {
      jsonStr = jsonObjMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    const stressToRisk: Record<string, number> = {
      'Baixo': 3, 'Médio': 6, 'Crítico': 9,
    };
    const statusToTrend: Record<string, string> = {
      'BUY THE DIP': 'bullish', 'HOLD': 'bearish', 'SELL': 'bearish', 'SHORT': 'bearish',
    };

    const result = {
      mycroft: {
        support: parsed.niveis_criticos?.suporte || 0,
        resistance: parsed.niveis_criticos?.resistencia || 0,
        trend: statusToTrend[parsed.status_mercado] || 'bearish',
        verdict: parsed.analise_detalhada || parsed.analise_forense || 'Análise indisponível.',
        verdictShort: parsed.analise_forense || 'Análise indisponível.',
        riskLevel: stressToRisk[parsed.alerta_de_estresse] || 5,
        statusMercado: parsed.status_mercado,
        vereditoEntrada: parsed.veredito_entrada || 'NÃO ENTRAR — AGUARDAR',
        alertaEstresse: parsed.alerta_de_estresse,
        blefeDeMercado: parsed.blefe_de_mercado ?? false,
        volumeReal: parsed.volume_real_pct ?? 50,
        volumeBurburinho: parsed.volume_burburinho_pct ?? 50,
        recomendacaoAporte: parsed.recomendacao_aporte || null,
        confluenciaScore: parsed.confluencia_score ?? 0,
        indicadoresConfirmados: parsed.indicadores_confirmados || [],
        statusInstitucional: parsed.status_institucional || 'NEUTRO',
        classeFluxo: parsed.classe_fluxo || 'NEUTRO',
        positionSizing: parsed.position_sizing || null,
        proveniencia: parsed.proveniencia || dataProvenance,
        confiancaAnalise: parsed.confianca_analise ?? 50,
        zonaMilhar: parsed.zona_milhar || null,
        correlacaoIndiceDolar: parsed.correlacao_indice_dolar || null,
        stopMaxPontos: parsed.stop_max_pontos || null,
      },
      horus: parsed.script_horus || 'O mercado está em silêncio... Mas isso nunca dura.',
    };

    // Dispatch Telegram alert (fire-and-forget)
    try {
      const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
      if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
        const tgMsg = `
🏛️ *ARENA TRADER — ALERTA MYCROFT*

📈 *ATIVO:* ${asset.symbol}
💰 *PREÇO:* ${currentPrice}
🎯 *SINAL:* ${parsed.status_mercado}
📊 *Confluência:* ${parsed.confluencia_score ?? 0}/10
⚠️ *Estresse:* ${parsed.alerta_de_estresse ?? 'N/A'}
🐋 *Institucional:* ${parsed.status_institucional ?? 'NEUTRO'}

🔬 *ANÁLISE FORENSE:*
${parsed.analise_forense ?? 'N/A'}

🎙️ *VEREDITO DE HÓRUS:*
"${parsed.script_horus ?? ''}"
        `.trim();

        fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: tgMsg,
            parse_mode: "Markdown",
          }),
        }).catch(e => console.error("Telegram dispatch failed:", e));
      }
    } catch (tgErr) {
      console.error("Telegram integration error:", tgErr);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Arena Trader analyze error:", error);

    return new Response(JSON.stringify({
      mycroft: {
        support: 0, resistance: 0, trend: "bearish",
        verdict: "Análise temporariamente indisponível. Opere com cautela.",
        riskLevel: 5, statusMercado: "HOLD", alertaEstresse: "Médio",
        confluenciaScore: 0, indicadoresConfirmados: [],
        statusInstitucional: "NEUTRO", classeFluxo: "NEUTRO",
        positionSizing: null, proveniencia: "SIMULADO", confiancaAnalise: 30,
        zonaMilhar: null, correlacaoIndiceDolar: null, stopMaxPontos: null,
      },
      horus: "O sistema está sobrecarregado... Mas um trader de verdade não depende de análises para agir.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
