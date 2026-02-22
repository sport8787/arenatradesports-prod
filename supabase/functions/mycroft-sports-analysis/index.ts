import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MatchData {
  home: string;
  away: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  period: string;
  championship: string;
  stats?: {
    attacks_home?: number;
    attacks_away?: number;
    xG_home?: number;
    xG_away?: number;
    possession_home?: number;
    possession_away?: number;
    shots_home?: number;
    shots_away?: number;
  };
  bankroll?: number;
}

function buildPrompt(match: MatchData): string {
  const stats = match.stats || {};
  return `
Você é o MYCROFT, um analista forense esportivo de elite para trading esportivo ao vivo.

Analise o jogo abaixo e forneça um veredito completo para o trader.

═══════════════════════════════════════
JOGO AO VIVO:
═══════════════════════════════════════
${match.championship}
${match.home} ${match.scoreHome} x ${match.scoreAway} ${match.away}
Minuto: ${match.minute}' | ${match.period}

═══════════════════════════════════════
ESTATÍSTICAS (últimos 5 min):
═══════════════════════════════════════
Ataques perigosos: ${stats.attacks_home ?? '?'} vs ${stats.attacks_away ?? '?'}
xG: ${stats.xG_home ?? '?'} vs ${stats.xG_away ?? '?'}
Posse: ${stats.possession_home ?? '?'}% vs ${stats.possession_away ?? '?'}%
Chutes ao gol: ${stats.shots_home ?? '?'} vs ${stats.shots_away ?? '?'}

Banca do trader: R$ ${match.bankroll ?? 500}

═══════════════════════════════════════
SUA TAREFA:
═══════════════════════════════════════

Analise o contexto e responda APENAS com um JSON válido (sem markdown, sem explicações fora do JSON):

{
  "verdict": "APROVADO" | "VETADO" | "AGUARDAR",
  "market": "nome do mercado recomendado (ex: Over 0.5 HT, Under 2.5, etc)",
  "odd": 1.50,
  "confidence": 0-100,
  "stats": {
    "attacks_home": ${stats.attacks_home ?? 5},
    "attacks_away": ${stats.attacks_away ?? 3},
    "xG_home": ${stats.xG_home ?? 0.8},
    "xG_away": ${stats.xG_away ?? 0.4},
    "possession_home": ${stats.possession_home ?? 55},
    "possession_away": ${stats.possession_away ?? 45},
    "shots_home": ${stats.shots_home ?? 3},
    "shots_away": ${stats.shots_away ?? 2}
  },
  "thesis": "Explicação detalhada da sua análise (3-5 parágrafos). Inclua: padrão detectado, referência a conceitos de trading esportivo, gestão emocional, e citação de autores como Mark Douglas, Nassim Taleb ou conceitos de probabilidade.",
  "risk": {
    "stake_percent": 1-5,
    "stake_value": valor em reais baseado na banca,
    "entry": "descrição da entrada (ex: Over 0.5 HT @ 1.95)",
    "stop": "critério de stop (ex: Sem gol em 15 min)",
    "target": "alvo (ex: Gol antes do intervalo)",
    "rr": "risk:reward ratio (ex: 1:1.95)",
    "ev": "expected value estimado (ex: +35%)"
  }
}

REGRAS:
- Se o jogo está nos primeiros 10 min, prefira "AGUARDAR"
- Se não há pressão clara de nenhum time, dê "VETADO"
- Confidence deve refletir a qualidade dos dados disponíveis
- Stake nunca deve ser > 5% da banca
- Seja conservador nas odds estimadas
- A thesis deve ser fundamentada e educativa
`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('VITE_ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[MycroftSports] ANTHROPIC_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { match } = await req.json() as { match: MatchData };
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Match data required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MycroftSports] Analyzing: ${match.home} vs ${match.away} (${match.minute}')`);

    const prompt = buildPrompt(match);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MycroftSports] Anthropic API error ${response.status}:`, errorText);
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const rawText = data.content
      ?.filter((block: any) => block.type === 'text')
      ?.map((block: any) => block.text)
      ?.join('\n') || '';

    console.log('[MycroftSports] Raw response:', rawText.substring(0, 200));

    // Parse JSON from response
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    console.log(`[MycroftSports] Verdict: ${analysis.verdict} | Confidence: ${analysis.confidence}%`);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[MycroftSports] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
