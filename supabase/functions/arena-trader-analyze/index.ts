import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const ANTHROPIC_API_KEY = Deno.env.get("VITE_ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC API KEY not configured");
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

    const systemPrompt = `Você é o Mycroft Trader, o módulo de inteligência forense financeira do ecossistema 'Blefador Milionário'. Você opera como um analista institucional de alta precisão.

🛡️ PROTOCOLO DE AUDITORIA FORENSE — Execute ANTES de qualquer sinal:

1. VALIDAÇÃO DE PROVENIÊNCIA:
Status da API: ${dataProvenance}.
${confiancaModifier}

2. FILTRO DE CONFLUÊNCIA TÉCNICA (OBRIGATÓRIO):
Uma decisão de compra ou venda SÓ É VALIDADA se houver cruzamento de pelo menos 3 indicadores:
- SMA 9/21: Preço acima/abaixo das médias (cruzamento golden cross / death cross).
- Bollinger: Preço nas extremidades com estreitamento ou expansão das bandas.
- RSI: Sobrecompra (>70) ou sobrevenda (<30).
Se menos de 3 indicadores confirmarem, o sinal é HOLD obrigatório. Informe quantos indicadores confirmaram (0-4).

3. AUDITORIA DE LIQUIDEZ:
Verifique se variação de preço é acompanhada por volume. Preço que sobe sem volume = "blefe de exaustão".

4. CÁLCULO DE RISCO DE BANCA (${balance.toLocaleString()} TC de 500.000 TC):
Toda sugestão DEVE vir com Position Sizing rigoroso:
- NUNCA sugerir entrada que comprometa mais de 1% do saldo num único Stop Loss.
- Calcule: Risco máximo = ${Math.floor(balance * 0.01).toLocaleString()} TC por trade.
- Sugira size, SL e TP concretos em valores absolutos.

📈 INTERPRETAÇÃO DE FLUXO INSTITUCIONAL (variação 24h = ${(change24h || 0).toFixed(2)}%):
Classificação atual: ${classeInstitucional}.

${futuresRules}

${techSummary}

RETORNE estritamente um JSON válido:
{
  "status_mercado": "BUY THE DIP" ou "HOLD" ou "SELL" ou "SHORT",
  "analise_forense": "Texto técnico de até 400 caracteres.",
  "script_horus": "Texto provocativo para o Hórus, máximo 2 frases. ${isFutures ? 'FOQUE no Stop Loss e nas zonas de milhar.' : 'DEVE incorporar a leitura institucional.'}",
  "niveis_criticos": {
    "suporte": <número>,
    "resistencia": <número>
  },
  "alerta_de_estresse": "Baixo" ou "Médio" ou "Crítico",
  "blefe_de_mercado": true ou false,
  "volume_real_pct": <número 0-100>,
  "volume_burburinho_pct": <número 0-100>,
  "recomendacao_aporte": "Texto curto com size exato, SL e TP.",
  "confluencia_score": <número 0-4>,
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
Forneça o relatório forense completo em JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1100,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const anthropicData = await response.json();
    const textContent = anthropicData.content?.[0]?.text;

    if (!textContent) {
      throw new Error("No content from Claude");
    }

    console.log("Mycroft Trader Forense raw:", textContent);

    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
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
        verdict: parsed.analise_forense || 'Análise indisponível.',
        riskLevel: stressToRisk[parsed.alerta_de_estresse] || 5,
        statusMercado: parsed.status_mercado,
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
        // Futures-specific
        zonaMilhar: parsed.zona_milhar || null,
        correlacaoIndiceDolar: parsed.correlacao_indice_dolar || null,
        stopMaxPontos: parsed.stop_max_pontos || null,
      },
      horus: parsed.script_horus || 'O mercado está em silêncio... Mas isso nunca dura.',
    };

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
