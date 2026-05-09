import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DynamicScenario {
  id: string;
  difficulty: number;
  match: string;
  competition: string;
  minute: number;
  score: string;
  stats: {
    attacks_home: number;
    attacks_away: number;
    xG_home: number;
    xG_away: number;
    possession_home: number;
  };
  market: string;
  odd: number;
  horusQuote: string;
  correctDecision: 'ENTRO' | 'AGUARDO' | 'NAO_ENTRO';
  outcome: { happened: string; result: string };
  mycroftFeedback: { correct: string; wrong: string };
  rewards: { correct: number; wrong: number; loseLife: boolean };
}

function generateDecisionFromAnalysis(verdict: string, confidence: number | null): 'ENTRO' | 'AGUARDO' | 'NAO_ENTRO' {
  const v = (verdict || '').toUpperCase();
  if (v.includes('APROVADO') || v.includes('ENTRAR') || v.includes('GREEN')) return 'ENTRO';
  if (v.includes('AGUARD') || v.includes('PENDENTE')) return 'AGUARDO';
  return 'NAO_ENTRO';
}

function generateHorusQuote(match: any, analysis: any): string {
  const stats = match.stats as any;
  const xgHome = match.xg_home || 0;
  const xgAway = match.xg_away || 0;
  const possession = match.possession_home || 50;

  const quotes = [
    `${match.home_team} com ${possession}% de posse. xG ${xgHome.toFixed(1)} vs ${xgAway.toFixed(1)}. ${analysis?.thesis || 'O que os números dizem?'}`,
    `Jogo entre ${match.home_team} e ${match.away_team}. Odds se movendo. ${xgHome > xgAway ? 'Casa dominando' : 'Visitante perigoso'}. Vai entrar?`,
    `${match.league} — ${match.home_team} vs ${match.away_team}. ${xgHome + xgAway > 1.5 ? 'Jogo aberto, muitas chances.' : 'Jogo travado até agora.'} Decisão é sua.`,
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function calculateDifficulty(analysis: any): number {
  const conf = analysis?.confidence || 50;
  if (conf >= 80) return 1; // easy - clear signal
  if (conf >= 65) return 2;
  if (conf >= 50) return 3;
  if (conf >= 35) return 4;
  return 5; // hard - ambiguous
}

function generateFeedback(match: any, analysis: any, decision: string): { correct: string; wrong: string } {
  const xgH = match.xg_home || 0;
  const xgA = match.xg_away || 0;
  const thesis = analysis?.thesis || '';
  const explanation = analysis?.fundamentation ? JSON.stringify(analysis.fundamentation) : '';

  return {
    correct: `Leitura correta! ${thesis} xG: ${xgH.toFixed(1)} vs ${xgA.toFixed(1)}. ${match.result || 'Resultado confirmou a análise.'}`,
    wrong: `Erro de leitura. ${thesis} Os dados indicavam ${decision === 'ENTRO' ? 'entrada' : decision === 'AGUARDO' ? 'cautela' : 'ficar fora'}. xG: ${xgH.toFixed(1)} vs ${xgA.toFixed(1)}. Revise o padrão.`,
  };
}

function determineMarket(analysis: any): { market: string; odd: number } {
  if (analysis) {
    return {
      market: analysis.market || 'Over 0.5 HT',
      odd: analysis.odd || 1.80,
    };
  }
  return { market: 'Over 0.5 HT', odd: 1.80 };
}

function generateOutcome(match: any, decision: string): { happened: string; result: string } {
  const scoreH = match.score_home ?? 0;
  const scoreA = match.score_away ?? 0;
  return {
    happened: `Resultado final: ${match.home_team} ${scoreH} x ${scoreA} ${match.away_team}. ${match.result || ''}`,
    result: decision === 'ENTRO' ? `GREEN` : decision === 'NAO_ENTRO' ? 'Ficou fora corretamente' : 'Aguardou corretamente',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { count = 10 } = await req.json().catch(() => ({}));

    // Fetch real matches with analyses
    const { data: matches, error: matchErr } = await supabase
      .from('arena_matches')
      .select('*')
      .not('result', 'is', null)
      .not('xg_home', 'is', null)
      .order('match_date', { ascending: false })
      .limit(100);

    if (matchErr) throw matchErr;

    // Fetch analyses for these matches
    const matchIds = (matches || []).map(m => m.match_id);
    const { data: analyses } = await supabase
      .from('mycroft_analyses')
      .select('*')
      .in('match_id', matchIds.length > 0 ? matchIds : ['none']);

    const analysisMap = new Map((analyses || []).map(a => [a.match_id, a]));

    // Build dynamic scenarios from real data
    const dynamicScenarios: DynamicScenario[] = [];

    for (const match of (matches || [])) {
      const analysis = analysisMap.get(match.match_id);
      const decision = generateDecisionFromAnalysis(analysis?.verdict || '', analysis?.confidence);
      const { market, odd } = determineMarket(analysis);
      const difficulty = calculateDifficulty(analysis);
      const stats = match.stats as any;

      dynamicScenarios.push({
        id: match.id,
        difficulty,
        match: `${match.home_team} vs ${match.away_team}`,
        competition: match.league || 'Liga',
        minute: Math.floor(Math.random() * 70) + 10,
        score: `${match.score_home ?? 0}-${match.score_away ?? 0}`,
        stats: {
          attacks_home: match.dangerous_attacks_home || stats?.dangerous_attacks_home || Math.floor(Math.random() * 10) + 2,
          attacks_away: match.dangerous_attacks_away || stats?.dangerous_attacks_away || Math.floor(Math.random() * 8),
          xG_home: match.xg_home || 0,
          xG_away: match.xg_away || 0,
          possession_home: match.possession_home || 50,
        },
        market,
        odd,
        horusQuote: generateHorusQuote(match, analysis),
        correctDecision: decision,
        outcome: generateOutcome(match, decision),
        mycroftFeedback: generateFeedback(match, analysis, decision),
        rewards: {
          correct: difficulty * 100,
          wrong: -(difficulty * 60),
          loseLife: difficulty >= 3,
        },
      });
    }

    // Shuffle and pick requested count
    const shuffled = dynamicScenarios.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    return new Response(JSON.stringify({
      scenarios: selected,
      total_available: dynamicScenarios.length,
      source: 'database',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error), scenarios: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
