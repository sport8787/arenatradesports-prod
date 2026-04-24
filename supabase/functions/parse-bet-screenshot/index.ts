import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedBet {
  selection: string;
  event_name: string;
  market: string;
  odd: number;
  result: "green" | "red" | "pending" | "void";
  score?: string;
}

interface ParsedBetSlip {
  bookmaker: string;
  stake: number;
  total_odds?: number;
  total_profit?: number;
  bet_date: string;
  bet_id?: string;
  selections: ParsedBet[];
}

const prompt = `Analise esta imagem de um comprovante de aposta esportiva (betting slip) e extraia TODAS as informações em formato JSON estruturado.

A imagem é de um comprovante de apostas da casa de apostas (provavelmente Betano, Bet365, ou similar).

Extraia:
1. **bookmaker**: Nome da casa de apostas (ex: "Betano", "Bet365")
2. **stake**: Valor apostado em reais (número, ex: 50.00)
3. **total_profit**: Ganho/lucro total mostrado (número, pode ser negativo se perdeu)
4. **bet_date**: Data/hora da aposta se visível (formato ISO ou "DD/MM/YYYY - HH:MM")
5. **bet_id**: ID/número do comprovante se visível
6. **selections**: Array com CADA seleção individual da aposta múltipla:
   - **selection**: Nome do time/seleção apostado (ex: "Santos", "Real Madrid", "Over 2.5")
   - **event_name**: Nome completo do jogo (ex: "Santos - Cruzeiro", "Real Madrid - Celta de Vigo")
   - **market**: Tipo de mercado (ex: "Resultado Final", "Over/Under", "1X2")
   - **odd**: Odd/cotação daquela seleção (número decimal, ex: 1.42)
   - **result**: Resultado da seleção:
     - "green" = ganhou (tem ícone verde ✓ ou similar)
     - "red" = perdeu (tem ícone vermelho ✗ ou similar)
     - "pending" = ainda não resultou
     - "void" = anulada
   - **score**: Placar do jogo se mostrado (ex: "3-0", "1-1")

IMPORTANTE:
- Se a aposta for múltipla (várias seleções), extraia TODAS as seleções
- Procure por ícones verdes (✓) e vermelhos (✗) para determinar resultado
- Se mostrar "Pontuação: X-Y", extraia como score
- Mantenha os nomes dos times em português
- Retorne APENAS o JSON válido, sem texto adicional

Formato de resposta (JSON):
{
  "bookmaker": "string",
  "stake": number,
  "total_profit": number,
  "bet_date": "string",
  "bet_id": "string",
  "selections": [
    {
      "selection": "string",
      "event_name": "string", 
      "market": "string",
      "odd": number,
      "result": "green|red|pending|void",
      "score": "string"
    }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType = "image/png" } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ParseBetScreenshot] AI Gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Falha ao processar imagem com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: ParsedBetSlip;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const objectMatch = responseText.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        parsed = JSON.parse(objectMatch[0]);
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    }

    // Validate and clean data
    const cleanedData: ParsedBetSlip = {
      bookmaker: parsed.bookmaker || "Betano",
      stake: typeof parsed.stake === 'number' ? parsed.stake : parseFloat(String(parsed.stake).replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
      total_profit: typeof parsed.total_profit === 'number' ? parsed.total_profit : parseFloat(String(parsed.total_profit || '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
      bet_date: parsed.bet_date || new Date().toISOString(),
      bet_id: parsed.bet_id,
      selections: (parsed.selections || []).map(sel => ({
        selection: sel.selection || "Unknown",
        event_name: sel.event_name || sel.selection || "Unknown",
        market: sel.market || "Resultado Final",
        odd: typeof sel.odd === 'number' ? sel.odd : parseFloat(String(sel.odd).replace(',', '.')) || 1,
        result: ['green', 'red', 'pending', 'void'].includes(sel.result) ? sel.result : 'pending',
        score: sel.score,
      })),
    };

    console.log(`[ParseBetScreenshot] Extracted ${cleanedData.selections.length} selections from ${cleanedData.bookmaker}`);

    return new Response(
      JSON.stringify({ success: true, data: cleanedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ParseBetScreenshot] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) || "Failed to parse screenshot" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
