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
    const { asset, candles, currentPrice, balance, position } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("VITE_ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC API KEY not configured");
    }

    const candleSummary = candles.slice(-10).map((c: any) =>
      `O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
    ).join(' | ');

    // Determine market sentiment from recent candles
    const recentCandles = candles.slice(-5);
    const avgClose = recentCandles.reduce((s: number, c: any) => s + c.close, 0) / recentCandles.length;
    const sentimento = currentPrice > avgClose * 1.01 ? 'Euforia Compradora' :
                       currentPrice < avgClose * 0.99 ? 'Pânico Vendedor' : 'Lateralização Neutra';

    const systemPrompt = `Você é o Mycroft Trader, o módulo de inteligência forense financeira do ecossistema 'Blefador Milionário'. Sua especialidade é análise técnica de alta precisão e detecção de padrões de manipulação em ativos como BTC, PETR4, VALE3 e ITUB4.

LÓGICA DE ANÁLISE (O SCRIPT DO VENCEDOR):

1. Mapeamento de Suporte e Resistência: Identifique as zonas onde o preço 'trava' (suporte) e onde encontra pressão de venda (resistência) baseado nos dados de velas fornecidos.

2. Detecção de Blefe de Mercado: Analise se o volume atual indica uma capitulação real ou apenas um 'burburinho' para liquidação de sardinhas.

3. Gestão de Banca (${balance.toLocaleString()} BC de 500.000 BC iniciais): Recomende aportes fracionados. Nunca sugira All-in; foque em Preço Médio e proteção de capital.

IMPORTANTE: Retorne estritamente um JSON válido com estes campos:
{
  "status_mercado": "BUY THE DIP" ou "HOLD" ou "SELL" ou "SHORT",
  "analise_forense": "Texto técnico e frio de até 300 caracteres sobre suportes e volumes.",
  "script_horus": "Texto provocativo para o Hórus ler, começando com 'Israel, o Mycroft detectou...', analisando o risco da banca de ${balance.toLocaleString()} BC. Máximo 2 frases.",
  "niveis_criticos": {
    "suporte": <número>,
    "resistencia": <número>
  },
  "alerta_de_estresse": "Baixo" ou "Médio" ou "Crítico",
  "blefe_de_mercado": true ou false,
  "volume_real_pct": <número 0-100>,
  "volume_burburinho_pct": <número 0-100>,
  "recomendacao_aporte": "Texto curto sugerindo % ideal da banca para próxima operação. Ex: '3-5% da banca (15K-25K BC)'"
}`;

    const userMessage = `Analise o ativo ${asset.symbol} (${asset.name}) no valor de ${currentPrice}.
Sentimento atual: ${sentimento}.
Últimas 10 velas: ${candleSummary}
${position ? `Posição aberta: ${position.type.toUpperCase()} a ${position.entryPrice}` : 'Sem posição aberta.'}
Banca atual: ${balance.toLocaleString()} BC.
Forneça o relatório em JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
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

    console.log("Mycroft Trader (Claude Sonnet) raw:", textContent);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Map to the format expected by the frontend
    const stressToRisk: Record<string, number> = {
      'Baixo': 3,
      'Médio': 6,
      'Crítico': 9,
    };

    const statusToTrend: Record<string, string> = {
      'BUY THE DIP': 'bullish',
      'HOLD': 'bearish',
      'SELL': 'bearish',
      'SHORT': 'bearish',
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
        support: 0,
        resistance: 0,
        trend: "bearish",
        verdict: "Análise temporariamente indisponível. Opere com cautela.",
        riskLevel: 5,
        statusMercado: "HOLD",
        alertaEstresse: "Médio",
      },
      horus: "O sistema está sobrecarregado... Mas um trader de verdade não depende de análises para agir.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
