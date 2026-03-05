import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get all pending bets from both tables
    const { data: pendingBets } = await supabase
      .from('virtual_bets')
      .select('*')
      .eq('status', 'pending');

    const { data: pendingPunterBets } = await supabase
      .from('virtual_bets_punter')
      .select('*')
      .eq('status', 'pending');

    // Also get pending punter_signals
    const { data: pendingSignals } = await supabase
      .from('punter_signals')
      .select('*')
      .eq('status', 'pending');

    const allPending = [
      ...(pendingBets || []).map(b => ({ ...b, table: 'virtual_bets' })),
      ...(pendingPunterBets || []).map(b => ({ ...b, table: 'virtual_bets_punter' })),
    ];

    if (allPending.length === 0 && (!pendingSignals || pendingSignals.length === 0)) {
      return new Response(JSON.stringify({ message: 'Nenhuma aposta pendente', settled: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Determine which leagues have pending bets to avoid unnecessary API calls
    const allLeagues = [
      'soccer_brazil_campeonato',
      'soccer_brazil_serie_b',
      'soccer_epl',
      'soccer_spain_la_liga',
      'soccer_germany_bundesliga',
      'soccer_italy_serie_a',
      'soccer_france_ligue_one',
      'soccer_uefa_champs_league',
      'soccer_uefa_europa_league',
      'soccer_uefa_europa_conference_league',
      'soccer_conmebol_libertadores',
      'soccer_south_america_copa_sudamericana',
      'soccer_argentina_primera_division',
    ];

    // Smart league filtering: only fetch leagues where we have pending bets
    const pendingMatchNames = allPending.map(b => (b.match_name || b.match_id || '').toLowerCase());
    const pendingSignalMatches = (pendingSignals || []).map(s => (s.match_id || '').toLowerCase());
    const allPendingNames = [...pendingMatchNames, ...pendingSignalMatches];

    // If we have pending items, fetch all leagues (name matching is fuzzy)
    // But if no pending items at all, skip API calls entirely
    const leagues = allLeagues;

    console.log(`[settle-bets] ${allPending.length} bets + ${(pendingSignals || []).length} signals pending, scanning ${leagues.length} leagues`);

    const allScores: any[] = [];
    for (const league of leagues) {
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${league}/scores/?apiKey=${oddsApiKey}&daysFrom=3&dateFormat=iso`
        );
        if (res.ok) {
          const data = await res.json();
          allScores.push(...data);
        }
      } catch (e) {
        console.error(`Error fetching scores for ${league}:`, e);
      }
    }

    console.log(`Fetched ${allScores.length} scores from ${leagues.length} leagues`);

    // Filter only completed games
    const completedGames = allScores.filter((g: any) => g.completed === true && g.scores);

    console.log(`${completedGames.length} completed games found`);
    // 3. Build a lookup map: normalize team names for matching
    const normalize = (name: string) =>
      name.toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\d{4}-\d{2}-\d{2}t[\d:z]+/gi, '')
        .replace(/[^a-záàãâéêíóôõúüç\s]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Match function: tries to match a bet's match_name/match_id with a completed game
    // STRICT: requires BOTH teams to match to avoid false positives
    const findResult = (matchName: string, market: string, betCreatedAt?: string) => {
      const normalizedMatch = normalize(matchName);

      for (const game of completedGames) {
        const homeNorm = normalize(game.home_team);
        const awayNorm = normalize(game.away_team);

        // STRICT matching: both teams must have significant word matches
        const homeWords = homeNorm.split(' ').filter((w: string) => w.length > 3);
        const awayWords = awayNorm.split(' ').filter((w: string) => w.length > 3);
        
        const homeMatches = homeWords.length > 0 && homeWords.some((w: string) => normalizedMatch.includes(w));
        const awayMatches = awayWords.length > 0 && awayWords.some((w: string) => normalizedMatch.includes(w));
        
        // Require BOTH teams to match (not just one)
        const matchesBet = homeMatches && awayMatches;

        if (!matchesBet) continue;

        // Time guard: if the game completed AFTER the bet was created, 
        // ensure the game's commence_time is in the past (not a future match)
        if (game.commence_time) {
          const gameStart = new Date(game.commence_time).getTime();
          const now = Date.now();
          // Skip if game supposedly starts in the future (data inconsistency)
          if (gameStart > now) {
            console.log(`[settle-bets] Skipping future game: ${game.home_team} vs ${game.away_team} (starts ${game.commence_time})`);
            continue;
          }
        }

        const homeScore = game.scores?.find((s: any) => s.name === game.home_team)?.score;
        const awayScore = game.scores?.find((s: any) => s.name === game.away_team)?.score;

        if (homeScore == null || awayScore == null) continue;

        const h = parseInt(homeScore);
        const a = parseInt(awayScore);
        const totalGoals = h + a;

        const marketLower = market.toLowerCase().trim();
        const marketNorm = normalize(market);
        let isGreen = false;
        let matched = true;

        if (marketLower === 'casa' || marketLower === 'home' || marketLower === '1') {
          isGreen = h > a;
        } else if (marketLower === 'fora' || marketLower === 'away' || marketLower === '2') {
          isGreen = a > h;
        } else if (marketLower === 'empate' || marketLower === 'draw' || marketLower === 'x') {
          isGreen = h === a;
        } else if (marketLower.includes('over')) {
          const line = parseFloat(marketLower.replace(/[^0-9.]/g, '')) || 2.5;
          if (marketLower.includes('ht') || marketLower.includes('1t')) {
            return null; // No HT scores available
          }
          isGreen = totalGoals > line;
        } else if (marketLower.includes('under')) {
          const line = parseFloat(marketLower.replace(/[^0-9.]/g, '')) || 2.5;
          if (marketLower.includes('ht') || marketLower.includes('1t')) {
            return null;
          }
          isGreen = totalGoals < line;
        } else if (marketLower.includes('btts') || marketLower.includes('ambas')) {
          isGreen = h > 0 && a > 0;
        } else if (homeNorm.includes(marketNorm) || marketNorm.includes(homeNorm) ||
                   homeNorm.split(' ').some((w: string) => w.length > 3 && marketNorm.includes(w))) {
          // Market is a team name matching home team
          isGreen = h > a;
        } else if (awayNorm.includes(marketNorm) || marketNorm.includes(awayNorm) ||
                   awayNorm.split(' ').some((w: string) => w.length > 3 && marketNorm.includes(w))) {
          // Market is a team name matching away team
          isGreen = a > h;
        } else {
          matched = false;
        }

        if (!matched) return null;

        return {
          isGreen,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          scoreHome: h,
          scoreAway: a,
        };
      }

      return null;
    };

    // 4. Settle bets
    let settledCount = 0;
    const results: any[] = [];

    for (const bet of allPending) {
      const matchRef = bet.match_name || bet.match_id || '';
      const result = findResult(matchRef, bet.market, bet.created_at);

      const profitLoss = result.isGreen
        ? parseFloat((bet.stake * (bet.odd - 1)).toFixed(2))
        : -parseFloat(bet.stake);

      const betResult = result.isGreen ? 'green' : 'red';

      // Update bet record
      const updatePayload = bet.table === 'virtual_bets'
        ? { status: betResult, profit_loss: profitLoss, settled_at: new Date().toISOString() }
        : { status: 'settled', result: betResult, profit_loss: profitLoss, updated_at: new Date().toISOString() };

      const { error: updateErr } = await supabase
        .from(bet.table)
        .update(updatePayload)
        .eq('id', bet.id);

      if (updateErr) {
        console.error(`Error updating bet ${bet.id}:`, updateErr);
        continue;
      }

      // Update bankroll
      const balanceChange = result.isGreen
        ? bet.stake * bet.odd // Return stake + profit
        : 0; // Stake already deducted

      const { data: currentBankroll } = await supabase
        .from('user_bankroll')
        .select('*')
        .eq('user_id', bet.user_id)
        .single();

      if (currentBankroll) {
        await supabase
          .from('user_bankroll')
          .update({
            balance: parseFloat((currentBankroll.balance + balanceChange).toFixed(2)),
            total_profit: parseFloat((currentBankroll.total_profit + profitLoss).toFixed(2)),
            green_bets: currentBankroll.green_bets + (result.isGreen ? 1 : 0),
            red_bets: currentBankroll.red_bets + (result.isGreen ? 0 : 1),
            win_rate: ((currentBankroll.green_bets + (result.isGreen ? 1 : 0)) /
              (currentBankroll.green_bets + currentBankroll.red_bets + 1) * 100),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', bet.user_id);
      }

      settledCount++;
      results.push({
        betId: bet.id,
        table: bet.table,
        match: matchRef,
        market: bet.market,
        result: betResult,
        profitLoss,
        score: `${result.scoreHome}-${result.scoreAway}`,
      });
    }

    // 5. Also settle punter_signals
    let signalsSettled = 0;
    for (const signal of (pendingSignals || [])) {
      const matchRef = signal.match_id || '';
      const result = findResult(matchRef, signal.market, signal.created_at);

      if (!result) continue;

      const betResult = result.isGreen ? 'green' : 'red';
      const profitLoss = result.isGreen
        ? parseFloat((signal.odd * (signal.stake_percentage || 3)).toFixed(2))
        : -(signal.stake_percentage || 3);

      await supabase
        .from('punter_signals')
        .update({
          result: betResult,
          profit_loss: profitLoss,
          resulted_at: new Date().toISOString(),
          status: 'settled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', signal.id);

      signalsSettled++;
    }

    return new Response(JSON.stringify({
      message: `${settledCount} apostas liquidadas, ${signalsSettled} sinais atualizados`,
      settled: settledCount,
      signals_settled: signalsSettled,
      results,
      completed_games: completedGames.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Settle bets error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
