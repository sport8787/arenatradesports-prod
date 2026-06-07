import { createClient } from 'npm:@supabase/supabase-js@2';
import { logEdgeError } from "../_shared/logEdgeError.ts";
import { findFixtureByTeamsAndDate } from "../_shared/sportmonks.ts";
import { getOddsSportKeyMap } from "../_shared/leaguesRegistry.ts";
import { canCallOddsApi, recordOddsApiUsage } from "../_shared/oddsApiQuota.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API_FOOTBALL removida em Fase 2 (18/05/2026) — settlement usa Sportmonks via findFixtureByTeamsAndDate.

// Normalize team/match names for comparison
const normalize = (name: string) =>
  name.toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\d{4}-\d{2}-\d{2}t[\d:.+z]+/gi, '')
    .replace(/[^a-záàãâéêíóôõúüç\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

// Extract meaningful words (>2 chars) for matching
const getMatchWords = (name: string) =>
  normalize(name).split(' ').filter((w: string) => w.length > 2);

// Determine if a bet is eligible for settlement based on time
function isEligibleForSettlement(bet: any): boolean {
  const now = Date.now();

  if (bet.commence_time) {
    const matchStart = new Date(bet.commence_time).getTime();
    const minElapsed = 90 * 60 * 1000;
    if (matchStart + minElapsed > now) {
      console.log(`[settle-bets] SKIP: ${bet.match_name || bet.match_id} — match hasn't finished yet`);
      return false;
    }
    return true;
  }

  // Fallback: bet must be at least 4 hours old
  const betTime = new Date(bet.placed_at || bet.created_at).getTime();
  if (betTime) {
    const minAge = 4 * 60 * 60 * 1000;
    if (betTime + minAge > now) {
      console.log(`[settle-bets] SKIP: ${bet.match_name || bet.match_id} — bet too recent`);
      return false;
    }
  }

  return true;
}

// Match a bet with a completed game result
function findResult(
  matchName: string,
  market: string,
  completedGames: any[],
) {
  const normalizedMatch = normalize(matchName);

  for (const game of completedGames) {
    const homeNorm = normalize(game.home_team);
    const awayNorm = normalize(game.away_team);

    // STRICT: both teams must match (words >2 chars)
    const homeWords = getMatchWords(game.home_team);
    const awayWords = getMatchWords(game.away_team);
    const homeMatches = homeWords.length > 0 && homeWords.some((w: string) => normalizedMatch.includes(w));
    const awayMatches = awayWords.length > 0 && awayWords.some((w: string) => normalizedMatch.includes(w));

    if (!homeMatches || !awayMatches) continue;

    const h = game.score_home;
    const a = game.score_away;
    if (h == null || a == null) continue;

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
      if (marketLower.includes('ht') || marketLower.includes('1t')) return null; // can't settle HT markets
      isGreen = totalGoals > line;
    } else if (marketLower.includes('under')) {
      const line = parseFloat(marketLower.replace(/[^0-9.]/g, '')) || 2.5;
      if (marketLower.includes('ht') || marketLower.includes('1t')) return null;
      isGreen = totalGoals < line;
    } else if (marketLower.includes('btts') || marketLower.includes('ambas')) {
      isGreen = h > 0 && a > 0;
    } else if (marketLower.includes('back casa') || homeNorm.includes(marketNorm) || marketNorm.includes(homeNorm) ||
               homeNorm.split(' ').some((w: string) => w.length > 3 && marketNorm.includes(w))) {
      isGreen = h > a;
    } else if (marketLower.includes('back fora') || awayNorm.includes(marketNorm) || marketNorm.includes(awayNorm) ||
               awayNorm.split(' ').some((w: string) => w.length > 3 && marketNorm.includes(w))) {
      isGreen = a > h;
    } else {
      matched = false;
    }

    if (!matched) return null;

    return { isGreen, homeTeam: game.home_team, awayTeam: game.away_team, scoreHome: h, scoreAway: a };
  }

  return null;
}

// Fetch finished fixtures from API-Football for the last N days
async function fetchFinishedFixtures(apiKey: string, daysBack: number = 3): Promise<any[]> {
  const results: any[] = [];
  
  for (let d = 0; d <= daysBack; d++) {
    const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    try {
      console.log(`[settle-bets] Fetching finished fixtures for ${dateStr}...`);
      const res = await fetch(`${API_FOOTBALL_URL}/fixtures?date=${dateStr}&status=FT-AET-PEN`, {
        headers: { 'x-apisports-key': apiKey },
      });
      
      if (!res.ok) {
        console.error(`[settle-bets] API-Football error for ${dateStr}: ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      const fixtures = data.response || [];
      
      for (const fix of fixtures) {
        results.push({
          home_team: fix.teams?.home?.name || '',
          away_team: fix.teams?.away?.name || '',
          score_home: fix.goals?.home ?? null,
          score_away: fix.goals?.away ?? null,
          commence_time: fix.fixture?.date || null,
          league: fix.league?.name || '',
        });
      }
      
      console.log(`[settle-bets] ${dateStr}: ${fixtures.length} finished fixtures`);
    } catch (e) {
      console.error(`[settle-bets] Error fetching ${dateStr}:`, e);
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    // (API-Football descontinuada — variável mantida apenas para compat de logs)
    const apiFootballKey: string | undefined = undefined;
    // [Fase 2 migração] API-Football removida — usamos Sportmonks (primário) + The Odds API (fallback)
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing_authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const userId = user?.id ?? null;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'invalid_session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The Odds API é apenas fallback — Sportmonks é a fonte primária. Não bloquear.

    // 1. Fetch all pending bets
    const betsQuery = supabase.from('virtual_bets').select('*').eq('status', 'pending');
    const punterQuery = supabase.from('virtual_bets_punter').select('*').eq('status', 'pending');
    const manualQuery = supabase.from('virtual_bets_manual').select('*').eq('status', 'pending');
    const signalsQuery = supabase.from('punter_signals').select('*').eq('status', 'pending');

    const [betsRes, punterRes, manualRes, signalsRes] = await Promise.all([
      betsQuery.eq('user_id', userId),
      punterQuery.eq('user_id', userId),
      manualQuery.eq('user_id', userId),
      signalsQuery.eq('user_id', userId),
    ]);

    const allPending = [
      ...(betsRes.data || []).map(b => ({ ...b, table: 'virtual_bets' })),
      ...(punterRes.data || []).map(b => ({ ...b, table: 'virtual_bets_punter' })),
      ...(manualRes.data || []).map(b => ({ ...b, table: 'virtual_bets_manual' })),
    ];

    const pendingSignals = signalsRes.data || [];

    // 2. Filter only bets eligible for settlement (time guards)
    const eligibleBets = allPending.filter(isEligibleForSettlement);

    if (eligibleBets.length === 0 && pendingSignals.length === 0) {
      return new Response(JSON.stringify({
        message: 'Nenhuma aposta elegível para liquidação',
        settled: 0,
        skipped: allPending.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[settle-bets] scope=${userId ? `user:${userId}` : 'global'} ${eligibleBets.length}/${allPending.length} bets eligible, ${pendingSignals.length} signals`);

    // 3. Determine which dates we actually need (only days where pending bets/signals occurred)
    const datesNeeded = new Set<string>();
    const allItems = [...eligibleBets, ...pendingSignals];
    for (const item of allItems) {
      const ref = item.commence_time || item.match_date || item.placed_at || item.created_at;
      if (!ref) continue;
      try {
        const d = new Date(ref);
        if (isNaN(d.getTime())) continue;
        // Add the match date and the day before (covers TZ edge cases)
        datesNeeded.add(d.toISOString().split('T')[0]);
        const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
        datesNeeded.add(prev.toISOString().split('T')[0]);
      } catch (_) { /* ignore */ }
    }

    // Cap to maximum 4 dates to avoid CPU timeout
    const sortedDates = Array.from(datesNeeded).sort().slice(-4);
    console.log(`[settle-bets] Fetching ${sortedDates.length} relevant dates: ${sortedDates.join(', ')}`);

    // 3b. Sportmonks por-aposta (substitui API-Football) — busca fixture finalizada
    let completedGames: any[] = [];

    const smItems = [...eligibleBets, ...pendingSignals];
    const smConcurrency = 4;
    for (let i = 0; i < smItems.length; i += smConcurrency) {
      const chunk = smItems.slice(i, i + smConcurrency);
      const found = await Promise.all(chunk.map(async (it: any) => {
        const home = it.home_team || (it.match_name?.split(' x ')?.[0]) || '';
        const away = it.away_team || (it.match_name?.split(' x ')?.[1]) || '';
        const iso = it.commence_time || it.match_date || it.placed_at || it.created_at;
        if (!home || !away || !iso) return null;
        try {
          const sm = await findFixtureByTeamsAndDate(home, away, iso);
          if (!sm) return null;
          return {
            home_team: sm.homeTeam,
            away_team: sm.awayTeam,
            score_home: sm.goalsHome,
            score_away: sm.goalsAway,
            commence_time: iso,
            league: '',
          };
        } catch { return null; }
      }));
      for (const f of found) if (f) completedGames.push(f);
    }
    console.log(`[settle-bets] ${completedGames.length} jogos encontrados via Sportmonks`);

    // Fallback to The Odds API if Sportmonks unavailable or returned nothing
    if (completedGames.length === 0 && oddsApiKey) {
      // Quota guard global — pula direto se quota crítica.
      const okQuota = await canCallOddsApi(200);
      if (!okQuota) {
        console.warn('[settle-bets] ⚠️ Quota The Odds API < 200 — pulando fallback');
      } else {
        console.log('[settle-bets] Falling back to The Odds API...');

        // Mapeia league_id de cada aposta pendente → 1 único sport_key.
        // Em vez de varrer 13+ esportes, só consulta os realmente necessários.
        const sportKeyMap = await getOddsSportKeyMap();
        const neededKeys = new Set<string>();
        for (const it of allItems) {
          const lid = Number((it as any).league_id);
          if (Number.isFinite(lid) && sportKeyMap[lid]) {
            neededKeys.add(sportKeyMap[lid]);
          }
        }
        if (neededKeys.size === 0) {
          console.log('[settle-bets] Nenhum league_id mapeado — pulando fallback (0 chamadas).');
        } else {
          console.log(`[settle-bets] Odds API: ${neededKeys.size} sport_keys (de ${allItems.length} apostas)`);
          for (const league of neededKeys) {
            // re-check quota a cada iteração (caso outra rota consuma em paralelo)
            if (!(await canCallOddsApi(200))) {
              console.warn(`[settle-bets] ⚠️ Quota caiu < 200 mid-loop — abortando em ${league}`);
              break;
            }
            try {
              const res = await fetch(
                `https://api.the-odds-api.com/v4/sports/${league}/scores/?apiKey=${oddsApiKey}&daysFrom=3&dateFormat=iso`
              );
              await recordOddsApiUsage(res.headers);
              if (res.ok) {
                const data = await res.json();
                for (const g of data) {
                  if (g.completed && g.scores) {
                    const homeScore = g.scores.find((s: any) => s.name === g.home_team)?.score;
                    const awayScore = g.scores.find((s: any) => s.name === g.away_team)?.score;
                    if (homeScore != null && awayScore != null) {
                      completedGames.push({
                        home_team: g.home_team,
                        away_team: g.away_team,
                        score_home: parseInt(homeScore),
                        score_away: parseInt(awayScore),
                        commence_time: g.commence_time,
                        league: '',
                      });
                    }
                  }
                }
              }
            } catch (e) {
              console.error(`Error fetching ${league}:`, e);
            }
          }
          console.log(`[settle-bets] ${completedGames.length} completed games from Odds API (fallback)`);
        }
      }
    }

    // 4. Settle eligible bets
    let settledCount = 0;
    const results: any[] = [];

    for (const bet of eligibleBets) {
      const matchRef = bet.match_name || bet.match_id || '';
      const result = findResult(matchRef, bet.market, completedGames);
      if (!result) continue;

      const profitLoss = result.isGreen
        ? parseFloat((bet.stake * (bet.odd - 1)).toFixed(2))
        : -parseFloat(bet.stake);
      const betResult = result.isGreen ? 'green' : 'red';

      // Build update payload per table
      let updatePayload: any;
      if (bet.table === 'virtual_bets') {
        updatePayload = { status: betResult, profit_loss: profitLoss, settled_at: new Date().toISOString() };
      } else {
        updatePayload = { status: 'settled', result: betResult, profit_loss: profitLoss, updated_at: new Date().toISOString() };
      }

      const { error: updateErr } = await supabase
        .from(bet.table)
        .update(updatePayload)
        .eq('id', bet.id);

      if (updateErr) {
        console.error(`Error updating bet ${bet.id}:`, updateErr);
        continue;
      }

      // Update correct bankroll
      const balanceChange = result.isGreen ? bet.stake * bet.odd : 0;
      const bankrollTable = bet.table === 'virtual_bets' ? 'sports_bankroll' 
        : bet.table === 'virtual_bets_manual' ? 'manual_bankroll' 
        : 'user_bankroll';

      const { data: currentBankroll } = await supabase
        .from(bankrollTable)
        .select('*')
        .eq('user_id', bet.user_id)
        .single();

      if (currentBankroll) {
        const newGreen = (currentBankroll.green_bets || 0) + (result.isGreen ? 1 : 0);
        const newRed = (currentBankroll.red_bets || 0) + (result.isGreen ? 0 : 1);
        await supabase
          .from(bankrollTable)
          .update({
            balance: parseFloat(((currentBankroll.balance || 0) + balanceChange).toFixed(2)),
            total_profit: parseFloat(((currentBankroll.total_profit || 0) + profitLoss).toFixed(2)),
            green_bets: newGreen,
            red_bets: newRed,
            win_rate: (newGreen + newRed) > 0 ? (newGreen / (newGreen + newRed) * 100) : 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', bet.user_id);
      }

      // Recompensa BC: 10 BC por green na banca virtual
      if (result.isGreen) {
        try {
          await supabase.rpc('increment_bc_balance', { p_user_id: bet.user_id, p_amount: 10 });
          console.log(`[settle-bets] +10 BC para ${bet.user_id} (green)`);
        } catch (e) {
          console.warn('[settle-bets] BC reward falhou:', (e as Error).message);
        }
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

    // 5. Settle punter_signals
    let signalsSettled = 0;
    for (const signal of pendingSignals) {
      const matchRef = signal.match_id || '';
      const result = findResult(matchRef, signal.market, completedGames);
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
      skipped: allPending.length - eligibleBets.length,
      results,
      completed_games: completedGames.length,
      source: 'sportmonks+odds-api',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Settle bets error:', error);
    await logEdgeError("settle-bets", error).catch(() => {});
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
