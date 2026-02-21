import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SEASON_CONFIG = {
  maxDays: 30,
  initialBankroll: 10000,
  ntCost: 300,
  tiltThreshold: 50,
};

function getSupabaseClient(authHeader: string | null) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
  );
}

function getDifficultyForDay(day: number): string {
  if (day <= 10) return 'easy';
  if (day <= 20) return 'medium';
  return 'hard';
}

function checkHorusOfferTrigger(session: any): { trigger: string; offer: number } | null {
  // Bankroll doubled
  if (session.current_bankroll >= session.initial_bankroll * 2) {
    return { trigger: 'bankroll_doubled', offer: Math.floor(session.current_bankroll * 0.85) };
  }
  // Win streak >= 5
  if (session.win_streak >= 5) {
    return { trigger: 'win_streak', offer: Math.floor(session.current_bankroll * 0.8) };
  }
  // Last round
  if (session.current_day >= SEASON_CONFIG.maxDays) {
    return { trigger: 'last_round', offer: Math.floor(session.current_bankroll * 0.9) };
  }
  // Tilt detected (loss streak >= 3)
  if (session.loss_streak >= 3) {
    return { trigger: 'tilt_detected', offer: Math.floor(session.current_bankroll * 0.75) };
  }
  return null;
}

function calculateTiltScore(session: any, timeToChoose: number): number {
  let score = 0;
  // Loss streak contributes heavily
  score += Math.min(session.loss_streak * 15, 45);
  // Fast decisions = impulsivity
  if (timeToChoose < 5000) score += 20;
  else if (timeToChoose < 10000) score += 10;
  // High ignored warnings
  score += session.ignored_warnings * 10;
  return Math.min(score, 100);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = getSupabaseClient(authHeader);
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'start_season': {
        const { userId } = body;
        if (!userId) throw new Error('userId required');

        // Check active season
        const { data: active } = await supabase
          .from('arena_trader_seasons')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (active) {
          return new Response(JSON.stringify({ error: 'Já existe uma temporada ativa', existingId: active.id }), 
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Count previous seasons
        const { count } = await supabase
          .from('arena_trader_seasons')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Create new season
        const { data: season, error } = await supabase
          .from('arena_trader_seasons')
          .insert({
            user_id: userId,
            season_number: (count || 0) + 1,
            current_bankroll: SEASON_CONFIG.initialBankroll,
            initial_bankroll: SEASON_CONFIG.initialBankroll,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ season, ntCost: SEASON_CONFIG.ntCost }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_scenario': {
        const { sessionId, day } = body;
        if (!sessionId) throw new Error('sessionId required');

        const difficulty = getDifficultyForDay(day || 1);

        // Get already used scenario IDs for this session
        const { data: usedRounds } = await supabase
          .from('arena_trader_rounds')
          .select('scenario_id')
          .eq('session_id', sessionId);

        const usedIds = (usedRounds || []).map(r => r.scenario_id);

        // Fetch random scenario of appropriate difficulty, excluding used ones
        let query = supabase
          .from('arena_trader_scenarios')
          .select('*')
          .eq('difficulty', difficulty);

        if (usedIds.length > 0) {
          query = query.not('id', 'in', `(${usedIds.join(',')})`);
        }

        const { data: scenarios, error } = await query;
        if (error) throw error;

        if (!scenarios || scenarios.length === 0) {
          // Fallback: get any scenario not used yet
          const { data: fallback } = await supabase
            .from('arena_trader_scenarios')
            .select('*')
            .not('id', 'in', usedIds.length > 0 ? `(${usedIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)');

          if (!fallback || fallback.length === 0) {
            return new Response(JSON.stringify({ error: 'Sem cenários disponíveis' }), 
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const scenario = fallback[Math.floor(Math.random() * fallback.length)];
          return new Response(JSON.stringify({ scenario }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        return new Response(JSON.stringify({ scenario }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'submit_answer': {
        const { sessionId, scenarioId, chosenOption, timeToChoose, transcription, juryVotes } = body;
        if (!sessionId || !scenarioId || !chosenOption) throw new Error('Missing required fields');

        // Get session
        const { data: session, error: sessionError } = await supabase
          .from('arena_trader_seasons')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session) throw new Error('Session not found');
        if (session.status !== 'active') throw new Error('Season not active');

        // Get scenario
        const { data: scenario, error: scenarioError } = await supabase
          .from('arena_trader_scenarios')
          .select('*')
          .eq('id', scenarioId)
          .single();

        if (scenarioError || !scenario) throw new Error('Scenario not found');

        const isCorrect = chosenOption === scenario.correct_option;
        const bankrollBefore = session.current_bankroll;
        const multiplier = isCorrect ? scenario.bankroll_multiplier_win : scenario.bankroll_multiplier_loss;
        const bankrollAfter = Math.floor(bankrollBefore * multiplier);

        const juryConvincedCount = juryVotes ? juryVotes.filter((v: any) => v.vote === 'CLARO').length : 0;
        const tiltScore = calculateTiltScore(session, timeToChoose || 30000);
        const tiltDetected = tiltScore >= SEASON_CONFIG.tiltThreshold;

        // Insert round
        const { error: roundError } = await supabase
          .from('arena_trader_rounds')
          .insert({
            session_id: sessionId,
            day: session.current_day,
            scenario_id: scenarioId,
            chosen_option: chosenOption,
            is_correct: isCorrect,
            transcription: transcription || null,
            jury_votes: juryVotes || null,
            jury_convinced_count: juryConvincedCount,
            bankroll_before: bankrollBefore,
            bankroll_after: bankrollAfter,
            tilt_detected: tiltDetected,
            time_to_choose: timeToChoose || null,
          });

        if (roundError) throw roundError;

        // Update session
        const newLossStreak = isCorrect ? 0 : session.loss_streak + 1;
        const newWinStreak = isCorrect ? session.win_streak + 1 : 0;
        const newDay = session.current_day + 1;
        const isBankrupt = bankrollAfter <= 0;
        const isCompleted = newDay > SEASON_CONFIG.maxDays;

        const updateData: any = {
          current_bankroll: Math.max(0, bankrollAfter),
          current_day: newDay,
          total_rounds: session.total_rounds + 1,
          correct_answers: session.correct_answers + (isCorrect ? 1 : 0),
          jury_convinced: session.jury_convinced + juryConvincedCount,
          loss_streak: newLossStreak,
          win_streak: newWinStreak,
          best_win_streak: Math.max(session.best_win_streak, newWinStreak),
          tilt_warnings: session.tilt_warnings + (tiltDetected ? 1 : 0),
        };

        if (isBankrupt) {
          updateData.status = 'bankrupt';
          updateData.ended_at = new Date().toISOString();
        } else if (isCompleted) {
          updateData.status = 'completed';
          updateData.ended_at = new Date().toISOString();
        }

        await supabase
          .from('arena_trader_seasons')
          .update(updateData)
          .eq('id', sessionId);

        // Check Horus offer trigger
        const updatedSession = { ...session, ...updateData };
        let horusOffer = null;
        if (!isBankrupt && !isCompleted) {
          const trigger = checkHorusOfferTrigger(updatedSession);
          if (trigger) {
            // Persist offer to horus_trader_offers table
            const { data: savedOffer } = await supabase
              .from('horus_trader_offers')
              .insert({
                session_id: sessionId,
                trigger_type: trigger.trigger,
                offered_bankroll: trigger.offer,
                current_bankroll_at_offer: bankrollAfter,
                day_offered: session.current_day,
              })
              .select('id')
              .single();

            horusOffer = { ...trigger, offerId: savedOffer?.id };

            // Update offers_received
            await supabase
              .from('arena_trader_seasons')
              .update({ offers_received: (session.offers_received || 0) + 1 })
              .eq('id', sessionId);
          }
        }

        return new Response(JSON.stringify({
          isCorrect,
          bankrollBefore,
          bankrollAfter,
          explanation: scenario.explanation,
          commonMistake: scenario.common_mistake,
          tiltDetected,
          tiltScore,
          horusOffer,
          seasonStatus: updateData.status || 'active',
          day: session.current_day,
          newDay,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'accept_offer': {
        const { sessionId, offerId, accepted } = body;
        
        // Update the offer record
        await supabase
          .from('horus_trader_offers')
          .update({ accepted })
          .eq('id', offerId);

        if (accepted) {
          const { data: offer } = await supabase
            .from('horus_trader_offers')
            .select('offered_bankroll')
            .eq('id', offerId)
            .single();

          // Get current session for offers_accepted count
          const { data: currentSession } = await supabase
            .from('arena_trader_seasons')
            .select('offers_accepted')
            .eq('id', sessionId)
            .single();

          await supabase
            .from('arena_trader_seasons')
            .update({ 
              status: 'completed',
              current_bankroll: offer?.offered_bankroll || 0,
              offers_accepted: (currentSession?.offers_accepted || 0) + 1,
              ended_at: new Date().toISOString(),
            })
            .eq('id', sessionId);
        }

        return new Response(JSON.stringify({ accepted }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_season_analysis': {
        const { sessionId } = body;
        
        // Get season data
        const { data: seasonData } = await supabase
          .from('arena_trader_seasons')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!seasonData) throw new Error('Season not found');

        // Get all rounds for this season
        const { data: rounds } = await supabase
          .from('arena_trader_rounds')
          .select('*, arena_trader_scenarios(*)')
          .eq('session_id', sessionId)
          .order('day', { ascending: true });

        // Get offers
        const { data: offers } = await supabase
          .from('horus_trader_offers')
          .select('*')
          .eq('session_id', sessionId)
          .order('day_offered', { ascending: true });

        // Analyze patterns
        const roundsList = rounds || [];
        const bankrollHistory = roundsList.map(r => ({
          day: r.day,
          bankroll: r.bankroll_after,
          isCorrect: r.is_correct,
          tilt: r.tilt_detected,
          timeToChoose: r.time_to_choose,
        }));

        // Find critical moments
        const criticalMoments: any[] = [];
        
        // Biggest win
        const biggestWin = roundsList.reduce((best, r) => {
          const gain = r.bankroll_after - r.bankroll_before;
          return gain > (best?.gain || 0) ? { ...r, gain } : best;
        }, null as any);
        if (biggestWin) criticalMoments.push({ type: 'biggest_win', day: biggestWin.day, gain: biggestWin.gain });

        // Biggest loss
        const biggestLoss = roundsList.reduce((worst, r) => {
          const loss = r.bankroll_before - r.bankroll_after;
          return loss > (worst?.loss || 0) ? { ...r, loss } : worst;
        }, null as any);
        if (biggestLoss) criticalMoments.push({ type: 'biggest_loss', day: biggestLoss.day, loss: biggestLoss.loss });

        // Tilt moments
        const tiltMoments = roundsList.filter(r => r.tilt_detected);
        tiltMoments.forEach(r => criticalMoments.push({ type: 'tilt', day: r.day }));

        // Declined offers analysis
        const declinedOffers = (offers || []).filter(o => o.accepted === false);
        declinedOffers.forEach(o => {
          const nextRound = roundsList.find(r => r.day === o.day_offered + 1);
          criticalMoments.push({
            type: 'declined_offer',
            day: o.day_offered,
            offeredAmount: o.offered_bankroll,
            actualResult: nextRound?.is_correct ? 'won_next' : 'lost_next',
          });
        });

        // Category performance
        const categoryStats: Record<string, { correct: number; total: number }> = {};
        roundsList.forEach(r => {
          const cat = r.arena_trader_scenarios?.category || 'unknown';
          if (!categoryStats[cat]) categoryStats[cat] = { correct: 0, total: 0 };
          categoryStats[cat].total++;
          if (r.is_correct) categoryStats[cat].correct++;
        });

        // Avg decision time
        const avgTimeToChoose = roundsList.length > 0
          ? Math.floor(roundsList.reduce((sum, r) => sum + (r.time_to_choose || 30000), 0) / roundsList.length)
          : 0;

        // Fastest/slowest decisions
        const fastDecisions = roundsList.filter(r => (r.time_to_choose || 30000) < 5000).length;

        return new Response(JSON.stringify({
          season: seasonData,
          bankrollHistory,
          criticalMoments,
          categoryStats,
          avgTimeToChoose,
          fastDecisions,
          totalOffers: (offers || []).length,
          offersAccepted: (offers || []).filter(o => o.accepted).length,
          offersDeclined: declinedOffers.length,
          tiltMoments: tiltMoments.length,
          roundsDetail: roundsList.map(r => ({
            day: r.day,
            scenario: r.arena_trader_scenarios?.title,
            category: r.arena_trader_scenarios?.category,
            correct: r.is_correct,
            bankrollBefore: r.bankroll_before,
            bankrollAfter: r.bankroll_after,
            juryConvinced: r.jury_convinced_count,
            tilt: r.tilt_detected,
          })),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_active_season': {
        const { userId } = body;
        const { data: season } = await supabase
          .from('arena_trader_seasons')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        return new Response(JSON.stringify({ season }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_season_history': {
        const { userId } = body;
        const { data: seasons } = await supabase
          .from('arena_trader_seasons')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        return new Response(JSON.stringify({ seasons: seasons || [] }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('[SeasonMode] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
