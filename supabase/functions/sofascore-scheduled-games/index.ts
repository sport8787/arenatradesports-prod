import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Whitelist de torneios (priority dado ao SofaScore via uniqueTournament.id ou nome)
// Quanto maior priority, mais relevante. Mantemos amplo para garantir oferta.
function relevanceFor(tournamentName: string, categoryName: string): number {
  const t = (tournamentName || '').toLowerCase();
  const c = (categoryName || '').toLowerCase();
  if (t.includes('libertadores') || t.includes('champions league') || t.includes('copa do brasil')) return 5;
  if (t.includes('brasileir') || t.includes('serie a') || t.includes('série a') || t.includes('premier league') || t.includes('laliga') || t.includes('la liga')) return 5;
  if (t.includes('serie b') || t.includes('série b') || t.includes('sul-americana') || t.includes('europa league') || t.includes('bundesliga') || t.includes('serie a') || t.includes('ligue 1')) return 4;
  if (t.includes('copa') || t.includes('cup')) return 4;
  if (t.includes('carioca') || t.includes('paulist') || t.includes('gaúcho') || t.includes('mineiro') || t.includes('serie c')) return 3;
  if (c.includes('brazil') || c.includes('brasil')) return 3;
  return 2;
}

async function fetchSofaScoreDay(dateStr: string) {
  const res = await fetch(`https://api.sofascore.com/api/v1/sport/football/scheduled-events/${dateStr}`, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Referer': 'https://www.sofascore.com/',
    },
  });
  if (!res.ok) {
    console.warn(`[SofaScheduled] ${dateStr} failed: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.events || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar hoje + amanhã (UTC)
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const dates = [
      today.toISOString().split('T')[0],
      tomorrow.toISOString().split('T')[0],
    ];

    const allEvents: any[] = [];
    for (const d of dates) {
      const events = await fetchSofaScoreDay(d);
      allEvents.push(...events);
    }

    console.log(`[SofaScheduled] Total events: ${allEvents.length}`);

    const now = Date.now();
    const max = now + 26 * 3600 * 1000; // janela de 26h
    let inserted = 0;

    for (const ev of allEvents) {
      try {
        const startMs = (ev.startTimestamp ?? 0) * 1000;
        if (!startMs || startMs < now - 30 * 60000 || startMs > max) continue;

        const tournamentName = ev.tournament?.name || ev.tournament?.uniqueTournament?.name || 'Unknown';
        const categoryName = ev.tournament?.category?.name || '';
        const home = ev.homeTeam?.name || 'TBD';
        const away = ev.awayTeam?.name || 'TBD';
        const matchDate = new Date(startMs);
        const status = ev.status?.type === 'inprogress' ? 'live' : 'scheduled';

        const dateStr = matchDate.toISOString().split('T')[0];
        const timeStr = matchDate.toTimeString().slice(0, 5);

        const { error } = await supabase.from('scheduled_games').upsert({
          match_date: dateStr,
          match_time: timeStr,
          match_datetime: matchDate.toISOString(),
          league_name: `${tournamentName}${categoryName ? ` (${categoryName})` : ''}`,
          home_team: home,
          away_team: away,
          event_id: `sofa_${ev.id}`,
          match_id: `sofa_${ev.id}`,
          status,
          check_time: new Date(startMs - 15 * 60000).toISOString(),
          relevance_score: relevanceFor(tournamentName, categoryName),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'match_date,match_time,home_team,away_team' });

        if (!error) inserted++;
      } catch (e) {
        // skip event
      }
    }

    return new Response(
      JSON.stringify({ ok: true, source: 'sofascore', total_events: allEvents.length, inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[SofaScheduled] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
