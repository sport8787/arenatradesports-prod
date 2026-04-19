import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type JurorProfile = 'conservador' | 'agressivo' | 'neutro';

const JUROR_PROMPTS: Record<JurorProfile, string> = {
  conservador: `Você é **O Prudente**, jurado CONSERVADOR do Arena Trader.
Você valoriza PRESERVAÇÃO DE CAPITAL acima de tudo.
- Decisões arriscadas sem stop loss = BLEFE
- Entrar em FOMO ou revenge trading = BLEFE  
- Esperar, analisar, proteger capital = CLARO
- Você é RIGOROSO: prefere flagrar agressividade imprudente`,

  agressivo: `Você é **O Tubarão**, jurado AGRESSIVO do Arena Trader.
Você valoriza CORAGEM e OPORTUNIDADE.
- Quem vê oportunidade e age com convicção = CLARO
- Ficar parado quando há setup claro = BLEFE (covardia disfarçada)
- Você tolera risco calculado e valoriza decisão rápida
- Só vota BLEFE se houver contradição óbvia ou pânico sem lógica`,

  neutro: `Você é **O Quant**, jurado NEUTRO do Arena Trader.
Você analisa OBJETIVAMENTE com base em dados e lógica.
- Avalia se a justificativa cita indicadores técnicos
- Verifica coerência entre cenário e opção escolhida
- Calcula probabilidade bayesiana de a resposta ser fundamentada
- Voto baseado em lógica pura, sem emoção`,
};

const JUROR_NAMES: Record<JurorProfile, string> = {
  conservador: 'O Prudente',
  agressivo: 'O Tubarão', 
  neutro: 'O Quant',
};

async function getJurorVote(
  scenario: any,
  chosenOption: string,
  isCorrect: boolean,
  transcription: string,
  profile: JurorProfile,
  apiKey: string
): Promise<any> {
  const startTime = Date.now();
  
  const prompt = `${JUROR_PROMPTS[profile]}

═══════════════════════════════════════
CENÁRIO DE MERCADO:
═══════════════════════════════════════
**${scenario.title}**
${scenario.description}

**Opções:**
A) ${scenario.option_a}
B) ${scenario.option_b}
C) ${scenario.option_c}
D) ${scenario.option_d}

**Jogador escolheu:** ${chosenOption}
**Resposta correta:** ${scenario.correct_option}
**Acertou?** ${isCorrect ? 'SIM ✅' : 'NÃO ❌'}

**Justificativa do jogador (áudio transcrito):**
"${transcription || 'Sem justificativa fornecida'}"

═══════════════════════════════════════
VOTE: O jogador demonstrou CONHECIMENTO REAL (CLARO) ou está BLEFANDO/chutando (BLEFE)?

Responda APENAS com JSON válido:
{"voto": "CLARO" ou "BLEFE", "confianca": 0-100, "razao": "Uma frase curta (max 120 chars)"}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 200,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[TraderJury] ${profile} Lovable AI error:`, errText);
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      juror: JUROR_NAMES[profile],
      profile,
      vote: parsed.voto === 'CLARO' ? 'CLARO' : 'BLEFE',
      confidence: Math.min(100, Math.max(0, parsed.confianca || 50)),
      reasoning: String(parsed.razao || '').substring(0, 200),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[TraderJury] ${profile} error:`, error);
    return {
      juror: JUROR_NAMES[profile],
      profile,
      vote: Math.random() > 0.5 ? 'CLARO' : 'BLEFE',
      confidence: 50,
      reasoning: 'Análise indisponível (fallback)',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { scenario, chosenOption, isCorrect, transcription } = await req.json();

    console.log('[TraderJury] Starting deliberation for:', scenario?.title);

    const [vC, vA, vN] = await Promise.all([
      getJurorVote(scenario, chosenOption, isCorrect, transcription, 'conservador', apiKey),
      getJurorVote(scenario, chosenOption, isCorrect, transcription, 'agressivo', apiKey),
      getJurorVote(scenario, chosenOption, isCorrect, transcription, 'neutro', apiKey),
    ]);

    const votes = [vC, vA, vN];
    const claroCount = votes.filter(v => v.vote === 'CLARO').length;

    console.log(`[TraderJury] Result: ${claroCount}/3 CLARO`);

    return new Response(JSON.stringify({
      votes,
      convinced: claroCount >= 2,
      unanimous: claroCount === 0 || claroCount === 3,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[TraderJury] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
