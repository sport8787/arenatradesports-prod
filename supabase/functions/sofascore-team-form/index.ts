// SofaScore Team Form (Pré-jogo)
// Busca os últimos 5 jogos de cada time no SofaScore com xG, posse, finalizações.
// Usado pelo Mycroft Punter para enriquecer análise pré-jogo.
// Cache em ai_response_cache (TTL 6h).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const FIRECRAWL_API = 'https://api.firecrawl.dev/v2';

// Tenta fetch direto primeiro; se Cloudflare bloquear (403), cai pra Firecrawl
async function sofaFetchJson(path: string): Promise<any | null> {
  const url = `${SOFA_BASE}${path}`;
  const directHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Referer': 'https://www.sofascore.com/',
    'Origin': 'https://www.sofascore.com',
  };
  try {
    const r = await fetch(url, { headers: directHeaders });
    if (r.ok) return await r.json();
    if (r.status !== 403 && r.status !== 429) {
      console.warn(`[SofaForm] direct fetch HTTP ${r.status} for ${path}`);
      return null;
    }
    console.log(`[SofaForm] direct blocked (${r.status}), falling back to Firecrawl for ${path}`);
  } catch (e) {
    console.warn(`[SofaForm] direct fetch error for ${path}:`, e);
  }
  // Firecrawl fallback
  const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!fcKey) {
    console.warn('[SofaForm] FIRECRAWL_API_KEY missing — cannot fallback');
    return null;
  }
  try {
    const fr = await fetch(`${FIRECRAWL_API}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fcKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false, waitFor: 800 }),
    });
    if (!fr.ok) {
      console.warn(`[SofaForm] Firecrawl HTTP ${fr.status}`);
      return null;
    }
    const fd = await fr.json();
    const raw: string = fd?.data?.rawHtml || fd?.rawHtml || '';
    // SofaScore JSON endpoints return raw JSON wrapped in <pre>...</pre> by browser; Firecrawl may return as text
    const jsonStr = raw.replace(/<[^>]+>/g, '').trim();
    if (!jsonStr.startsWith('{')) {
      console.warn(`[SofaForm] Firecrawl: response is not JSON for ${path} (got: ${jsonStr.slice(0, 80)})`);
      return null;
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn(`[SofaForm] Firecrawl fallback error for ${path}:`, e);
    return null;
  }
}

const CACHE_TTL_HOURS = 6;
const FN_NAME = 'sofascore-team-form';

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function parseNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace('%', '').trim());
  return isNaN(n) ? null : n;
}

async function searchTeamId(name: string): Promise<number | null> {
  try {
    const q = encodeURIComponent(name);
    const data = await sofaFetchJson(`/search/teams/${q}`);
    if (!data) {
      console.warn(`[SofaForm] searchTeamId no data for "${name}"`);
      return null;
    }
    const teams = data.teams || [];
    console.log(`[SofaForm] searchTeamId "${name}" → ${teams.length} results`);
    const target = normalize(name);
    for (const t of teams) {
      if (t.sport?.slug !== 'football') continue;
      const tn = normalize(t.name || '');
      const ts = normalize(t.shortName || '');
      if (tn === target || ts === target || tn.includes(target) || target.includes(tn)) {
        return t.id;
      }
    }
    // Fallback: first football team
    const firstFootball = teams.find((t: any) => t.sport?.slug === 'football');
    if (firstFootball) console.log(`[SofaForm] fallback team "${firstFootball.name}" (id=${firstFootball.id}) for "${name}"`);
    return firstFootball?.id || null;
  } catch (e) {
    console.error('[SofaForm] searchTeamId error:', e);
    return null;
  }
}

async function fetchLastEvents(teamId: number, limit = 5): Promise<any[]> {
  try {
    const res = await fetch(`${SOFA_BASE}/team/${teamId}/events/last/0`, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const events = (data.events || []).filter((e: any) => e.status?.code === 100); // finished
    return events.slice(-limit).reverse(); // most recent first
  } catch (e) {
    console.error('[SofaForm] fetchLastEvents error:', e);
    return [];
  }
}

async function fetchEventStats(eventId: number): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${SOFA_BASE}/event/${eventId}/statistics`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const allPeriod = (data.statistics || []).find((p: any) => p.period === 'ALL');
    if (!allPeriod) return null;
    const result: Record<string, any> = {};
    for (const group of allPeriod.groups || []) {
      for (const item of group.statisticsItems || []) {
        const key = normalize(item.name);
        result[key] = { home: item.home, away: item.away };
      }
    }
    return result;
  } catch {
    return null;
  }
}

async function buildTeamForm(teamId: number, teamName: string) {
  const events = await fetchLastEvents(teamId, 5);
  if (events.length === 0) return null;

  const matches: any[] = [];
  let totalXg = 0, totalXgA = 0, totalPoss = 0, totalShots = 0, totalShotsA = 0;
  let totalSot = 0, totalGoals = 0, totalGoalsA = 0;
  let xgCount = 0, possCount = 0;
  let wins = 0, draws = 0, losses = 0;

  // Process up to 5 in parallel
  const statsArr = await Promise.all(events.map(ev => fetchEventStats(ev.id)));

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const stats = statsArr[i];
    const isHome = ev.homeTeam?.id === teamId;
    const opp = isHome ? ev.awayTeam?.name : ev.homeTeam?.name;
    const myScore = isHome ? ev.homeScore?.current ?? 0 : ev.awayScore?.current ?? 0;
    const oppScore = isHome ? ev.awayScore?.current ?? 0 : ev.homeScore?.current ?? 0;

    if (myScore > oppScore) wins++;
    else if (myScore === oppScore) draws++;
    else losses++;
    totalGoals += myScore;
    totalGoalsA += oppScore;

    const m: any = {
      opponent: opp,
      venue: isHome ? 'home' : 'away',
      score: `${myScore}-${oppScore}`,
      result: myScore > oppScore ? 'W' : myScore === oppScore ? 'D' : 'L',
    };

    if (stats) {
      const xg = parseNumber(isHome ? stats['expectedgoals']?.home : stats['expectedgoals']?.away);
      const xgA = parseNumber(isHome ? stats['expectedgoals']?.away : stats['expectedgoals']?.home);
      const poss = parseNumber(isHome ? stats['ballpossession']?.home : stats['ballpossession']?.away);
      const shots = parseNumber(isHome ? stats['totalshots']?.home : stats['totalshots']?.away);
      const shotsA = parseNumber(isHome ? stats['totalshots']?.away : stats['totalshots']?.home);
      const sot = parseNumber(isHome ? stats['shotsongoal']?.home : stats['shotsongoal']?.away);

      if (xg != null) { totalXg += xg; xgCount++; m.xg = xg; }
      if (xgA != null) { totalXgA += xgA; m.xg_against = xgA; }
      if (poss != null) { totalPoss += poss; possCount++; m.possession = poss; }
      if (shots != null) { totalShots += shots; m.shots = shots; }
      if (shotsA != null) { totalShotsA += shotsA; m.shots_against = shotsA; }
      if (sot != null) { totalSot += sot; m.shots_on_target = sot; }
    }
    matches.push(m);
  }

  const n = events.length;
  return {
    team: teamName,
    sample_size: n,
    record: { wins, draws, losses },
    avg_goals_for: +(totalGoals / n).toFixed(2),
    avg_goals_against: +(totalGoalsA / n).toFixed(2),
    avg_xg: xgCount > 0 ? +(totalXg / xgCount).toFixed(2) : null,
    avg_xg_against: xgCount > 0 ? +(totalXgA / xgCount).toFixed(2) : null,
    avg_possession: possCount > 0 ? +(totalPoss / possCount).toFixed(1) : null,
    avg_shots: +(totalShots / n).toFixed(1),
    avg_shots_against: +(totalShotsA / n).toFixed(1),
    avg_shots_on_target: +(totalSot / n).toFixed(1),
    matches,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { home, away } = await req.json();
    if (!home || !away) {
      return new Response(JSON.stringify({ error: 'home and away required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cacheKey = `${FN_NAME}:${normalize(home)}_vs_${normalize(away)}`;
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Try cache
    const { data: cached } = await sb
      .from('ai_response_cache')
      .select('response_json, expires_at, hit_count')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.response_json) {
      sb.from('ai_response_cache').update({ hit_count: (cached.hit_count || 0) + 1 })
        .eq('cache_key', cacheKey).then(() => {}, () => {});
      console.log(`[SofaForm] 🎯 Cache HIT: ${cacheKey}`);
      return new Response(JSON.stringify({ ...cached.response_json, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SofaForm] 🔍 Fetching form for ${home} vs ${away}`);
    const [hId, aId] = await Promise.all([searchTeamId(home), searchTeamId(away)]);
    if (!hId && !aId) {
      return new Response(JSON.stringify({ found: false, message: 'Teams not found on SofaScore' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [homeForm, awayForm] = await Promise.all([
      hId ? buildTeamForm(hId, home) : Promise.resolve(null),
      aId ? buildTeamForm(aId, away) : Promise.resolve(null),
    ]);

    const payload = {
      found: true,
      source: 'sofascore',
      home_team_id: hId,
      away_team_id: aId,
      home: homeForm,
      away: awayForm,
    };

    // Save cache
    sb.from('ai_response_cache').upsert({
      function_name: FN_NAME,
      cache_key: cacheKey,
      response_json: payload,
      expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString(),
      hit_count: 0,
    }, { onConflict: 'cache_key' }).then(() => {}, (e) => console.warn('[SofaForm] cache save:', e));

    console.log(`[SofaForm] ✅ ${home}: xG ${homeForm?.avg_xg ?? '?'} | ${away}: xG ${awayForm?.avg_xg ?? '?'}`);
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[SofaForm] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
