import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_V2 = 'https://api.firecrawl.dev/v2';

function relevanceFor(tournamentName: string, categoryName: string): number {
  const t = (tournamentName || '').toLowerCase();
  const c = (categoryName || '').toLowerCase();
  if (t.includes('libertadores') || t.includes('champions league') || t.includes('copa do brasil')) return 5;
  if (t.includes('brasileir') || t.includes('premier league') || t.includes('laliga') || t.includes('la liga')) return 5;
  if (t.includes('série a') || t.includes('serie a')) return 5;
  if (t.includes('série b') || t.includes('serie b') || t.includes('sul-americana') || t.includes('europa league') || t.includes('bundesliga') || t.includes('ligue 1')) return 4;
  if (t.includes('copa') || t.includes('cup')) return 4;
  if (t.includes('carioca') || t.includes('paulist') || t.includes('gaúcho') || t.includes('mineiro') || t.includes('serie c')) return 3;
  if (c.includes('brazil') || c.includes('brasil')) return 3;
  return 2;
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<any | null> {
  try {
    const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['rawHtml'],
        onlyMainContent: false,
        waitFor: 0,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.warn(`[Firecrawl] ${r.status}: ${t.substring(0, 200)}`);
      return null;
    }
    const j = await r.json();
    // tenta extrair JSON: o endpoint /api/v1/... do SofaScore retorna JSON puro envolto em <pre> ou direto.
    const raw = j.data?.rawHtml || j.rawHtml || '';
    // Procurar primeira { ... } grande
    const start = raw.indexOf('{"events"');
    if (start === -1) {
      // Talvez Firecrawl já tenha decodificado como JSON puro
      try { return JSON.parse(raw); } catch { return null; }
    }
    // Extrair até o último '}' balanceado é complexo — pegar texto após start e tentar parse incremental
    const candidate = raw.substring(start);
    // Tenta parsing direto
    try { return JSON.parse(candidate); } catch {}
    // Tenta limpar até último '}'
    const lastBrace = candidate.lastIndexOf('}');
    if (lastBrace > 0) {
      try { return JSON.parse(candidate.substring(0, lastBrace + 1)); } catch {}
    }
    return null;
  } catch (e) {
    console.error('[Firecrawl] error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const dates = [
      today.toISOString().split('T')[0],
      tomorrow.toISOString().split('T')[0],
    ];

    const allEvents: any[] = [];
    for (const d of dates) {
      const data = await scrapeWithFirecrawl(
        `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${d}`,
        FIRECRAWL_API_KEY,
      );
      if (data?.events) {
        allEvents.push(...data.events);
        console.log(`[SofaScheduled] ${d}: ${data.events.length} events`);
      } else {
        console.warn(`[SofaScheduled] ${d}: no events parsed`);
      }
    }

    const now = Date.now();
    const max = now + 26 * 3600 * 1000;
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
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({ ok: true, source: 'sofascore-via-firecrawl', total_events: allEvents.length, inserted }),
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
