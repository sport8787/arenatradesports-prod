// FBref Team Stats Scraper
// Busca estatísticas avançadas hist\u00f3ricas (xG, xGA, PPDA) por time via FBref.
// Cache em ai_response_cache (24h TTL) para evitar bloqueios e respeitar rate limits.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}

async function searchTeam(team: string): Promise<{ url: string; name: string } | null> {
  try {
    const q = encodeURIComponent(team);
    const res = await fetch(`https://fbref.com/en/search/search.fcgi?search=${q}`, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) return null;
    const html = await res.text();

    // Try to find a team URL pattern: /en/squads/{hash}/{Team-Name}-Stats
    const teamMatch = html.match(/\/en\/squads\/([a-f0-9]+)\/([^"'\s]+?)-Stats/i);
    if (teamMatch) {
      return {
        url: `https://fbref.com/en/squads/${teamMatch[1]}/${teamMatch[2]}-Stats`,
        name: teamMatch[2].replace(/-/g, ' '),
      };
    }
    return null;
  } catch (e) {
    console.error('[FBref] searchTeam error:', e);
    return null;
  }
}

function parseTeamStatsHtml(html: string): any {
  const stats: any = {};

  // Extract xG, xGA from "Standard Stats" table - look for data-stat attrs
  const extract = (statName: string): number | null => {
    const re = new RegExp(`data-stat="${statName}"[^>]*>([\\d.\\-]+)<`, 'i');
    const m = html.match(re);
    return m ? parseFloat(m[1]) : null;
  };

  stats.matches_played = extract('games');
  stats.goals = extract('goals');
  stats.goals_against = extract('goals_against');
  stats.xg = extract('xg');
  stats.xga = extract('xg_against');
  stats.xg_diff = extract('xg_diff');
  stats.xg_per_90 = extract('xg_per90');
  stats.xga_per_90 = extract('xg_against_per90');
  stats.npxg = extract('npxg'); // non-penalty xG

  return stats;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { team } = await req.json();
    if (!team) {
      return new Response(JSON.stringify({ error: 'team required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cacheKey = `fbref:team:${normalize(team)}`;

    // Check cache (24h TTL)
    const { data: cached } = await supabase
      .from('ai_response_cache')
      .select('response_json, expires_at')
      .eq('cache_key', cacheKey)
      .eq('function_name', 'fbref-team-stats')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      console.log(`[FBref] 💾 Cache hit for ${team}`);
      return new Response(JSON.stringify({ ...cached.response_json, from_cache: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search and fetch
    const found = await searchTeam(team);
    if (!found) {
      return new Response(JSON.stringify({ found: false, team }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit safety: small delay
    await new Promise(r => setTimeout(r, 800));

    const pageRes = await fetch(found.url, { headers: HEADERS });
    if (!pageRes.ok) {
      return new Response(JSON.stringify({ found: false, error: `HTTP ${pageRes.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await pageRes.text();
    const stats = parseTeamStatsHtml(html);

    const result = {
      source: 'fbref',
      found: true,
      team_normalized: found.name,
      url: found.url,
      stats,
      fetched_at: new Date().toISOString(),
    };

    // Cache for 24h
    await supabase.from('ai_response_cache').upsert({
      cache_key: cacheKey,
      function_name: 'fbref-team-stats',
      response_json: result,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'cache_key' });

    console.log(`[FBref] ✅ ${team}: xG=${stats.xg}, xGA=${stats.xga}, xG/90=${stats.xg_per_90}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[FBref] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
