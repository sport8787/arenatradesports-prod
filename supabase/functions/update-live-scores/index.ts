import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io';

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API_FOOTBALL_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch all live fixtures (1 API call = ~1 credit)
    console.log('[LiveScores] Fetching live fixtures...');
    const res = await fetch(`${API_FOOTBALL_URL}/fixtures?live=all`, {
      headers: { 'x-apisports-key': apiKey },
    });

    if (!res.ok) {
      console.error(`[LiveScores] API error: ${res.status}`);
      return new Response(
        JSON.stringify({ error: `API error: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    const fixtures = data.response || [];
    console.log(`[LiveScores] ${fixtures.length} live fixtures found`);

    if (fixtures.length === 0) {
      // Mark stale live matches as finished
      const { data: staleLive } = await supabase
        .from('live_matches')
        .select('match_id')
        .eq('status', 'live');

      if (staleLive && staleLive.length > 0) {
        const { error: finishErr } = await supabase
          .from('live_matches')
          .update({ status: 'finished', updated_at: new Date().toISOString() })
          .eq('status', 'live');

        if (finishErr) console.error('[LiveScores] Error finishing stale:', finishErr);
        else console.log(`[LiveScores] Marked ${staleLive.length} stale matches as finished`);
      }

      return new Response(
        JSON.stringify({ updated: 0, finished: staleLive?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Build a set of live fixture IDs for stale detection
    const liveFixtureIds = new Set(fixtures.map((f: any) => String(f.fixture.id)));

    // 3. Update scores/minutes for each live fixture
    let updated = 0;
    for (const fixture of fixtures) {
      const fixtureId = String(fixture.fixture.id);
      const minute = fixture.fixture.status?.elapsed ?? 0;
      const period = fixture.fixture.status?.long ?? 'Unknown';
      const scoreHome = fixture.goals.home ?? 0;
      const scoreAway = fixture.goals.away ?? 0;
      const statusShort = fixture.fixture.status?.short ?? '';

      // Map API status to our status
      let matchStatus = 'live';
      if (['FT', 'AET', 'PEN'].includes(statusShort)) {
        matchStatus = 'finished';
      } else if (['HT'].includes(statusShort)) {
        matchStatus = 'halftime';
      }

      const { error } = await supabase
        .from('live_matches')
        .update({
          score_home: scoreHome,
          score_away: scoreAway,
          minute,
          period,
          status: matchStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('match_id', fixtureId);

      if (!error) updated++;
    }

    // 4. Mark matches no longer live as finished
    const { data: currentLive } = await supabase
      .from('live_matches')
      .select('match_id')
      .eq('status', 'live');

    let finished = 0;
    if (currentLive) {
      const staleIds = currentLive
        .filter(m => !liveFixtureIds.has(m.match_id))
        .map(m => m.match_id);

      if (staleIds.length > 0) {
        const { error: finishErr } = await supabase
          .from('live_matches')
          .update({ status: 'finished', updated_at: new Date().toISOString() })
          .in('match_id', staleIds);

        if (!finishErr) finished = staleIds.length;
      }
    }

    console.log(`[LiveScores] Updated ${updated} scores, finished ${finished} stale`);

    return new Response(
      JSON.stringify({ updated, finished, total_live: fixtures.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[LiveScores] Error:', e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
