// Sportradar Soccer Extended v4 — Team Form (últimos 5 jogos com xG real)
// Substitui FBref/SofaScore como fonte principal de forma recente.
// Cache em ai_response_cache (TTL 6h).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Trial inclui Soccer Base + Soccer Extended Base → rota oficial é /soccer/trial/v4.
// Após contratar produção, trocar para /soccer/production/v4.
const SR_BASE = 'https://api.sportradar.com/soccer/trial/v4/en';
// Trial = 1 req/seg. Helper de throttle abaixo.
const SR_MIN_INTERVAL_MS = 1100;
let lastSrCallAt = 0;
async function srThrottle() {
  const wait = lastSrCallAt + SR_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastSrCallAt = Date.now();
}
const CACHE_TTL_HOURS = 6;
const FN_NAME = 'sportradar-team-form';

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

async function srFetch(path: string, apiKey: string): Promise<any | null> {
  try {
    await srThrottle();
    const url = `${SR_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) {
      console.warn(`[Sportradar] HTTP ${r.status} for ${path}`);
      return null;
    }
    return await r.json();
  } catch (e) {
    console.warn(`[Sportradar] fetch error ${path}:`, e);
    return null;
  }
}

// Cache em memória de schedules para evitar refetch dentro do mesmo request
let scheduleCache: { fetchedAt: number; competitors: Map<string, { id: string; name: string }> } | null = null;
const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000;

// Coleta competitors de schedules (live + próximos dias). Endpoint validado em diag (200).
async function loadSchedulesCompetitors(apiKey: string): Promise<Map<string, { id: string; name: string }>> {
  if (scheduleCache && Date.now() - scheduleCache.fetchedAt < SCHEDULE_CACHE_TTL_MS) {
    return scheduleCache.competitors;
  }
  const map = new Map<string, { id: string; name: string }>();
  const paths = [
    '/schedules/live/summaries.json',
  ];
  // Próximos 3 dias
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    paths.push(`/schedules/${d}/summaries.json`);
  }
  // Últimos 2 dias (para times que jogaram recente)
  for (let i = 1; i <= 2; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    paths.push(`/schedules/${d}/summaries.json`);
  }
  for (const p of paths) {
    const data = await srFetch(p, apiKey);
    const summaries = data?.summaries || [];
    for (const s of summaries) {
      const competitors = s?.sport_event?.competitors || [];
      for (const c of competitors) {
        if (c?.id && c?.name) {
          map.set(normalize(c.name), { id: c.id, name: c.name });
        }
      }
    }
  }
  scheduleCache = { fetchedAt: Date.now(), competitors: map };
  console.log(`[Sportradar] schedule competitors loaded: ${map.size}`);
  return map;
}

async function findCompetitor(name: string, apiKey: string): Promise<{ id: string; name: string } | null> {
  const map = await loadSchedulesCompetitors(apiKey);
  const target = normalize(name);
  if (map.has(target)) return map.get(target)!;
  // fuzzy: contains
  for (const [k, v] of map.entries()) {
    if (k.includes(target) || target.includes(k)) return v;
  }
  return null;
}

// Extrai stat de um time específico no payload de summary
function extractTeamStats(summary: any, competitorId: string): any {
  const stats = summary?.statistics?.totals?.competitors || [];
  const team = stats.find((c: any) => c.id === competitorId);
  if (!team) return null;
  const s = team.statistics || {};
  return {
    possession: s.ball_possession ?? null,
    shots_total: s.shots_total ?? null,
    shots_on_target: s.shots_on_target ?? null,
    shots_off_target: s.shots_off_target ?? null,
    corner_kicks: s.corner_kicks ?? null,
    yellow_cards: s.yellow_cards ?? null,
    red_cards: s.red_cards ?? null,
    fouls: s.fouls ?? null,
    offsides: s.offsides ?? null,
    xg: s.expected_goals ?? null,
  };
}

interface MatchSummary {
  date: string;
  opponent: string;
  venue: 'home' | 'away';
  competition: string;
  score: string;
  result: 'W' | 'L' | 'D';
  goals_for: number;
  goals_against: number;
  stats: any;
}

async function fetchTeamSummaries(competitorId: string, competitorName: string, apiKey: string): Promise<MatchSummary[]> {
  const data = await srFetch(`/competitors/${competitorId}/summaries.json`, apiKey);
  const summaries = data?.summaries || [];
  if (!Array.isArray(summaries)) return [];

  const out: MatchSummary[] = [];
  for (const s of summaries) {
    const sport = s.sport_event;
    const status = s.sport_event_status;
    if (!sport || !status || status.status !== 'closed') continue;

    const competitors = sport.competitors || [];
    const me = competitors.find((c: any) => c.id === competitorId);
    const opp = competitors.find((c: any) => c.id !== competitorId);
    if (!me || !opp) continue;

    const isHome = me.qualifier === 'home';
    const homeScore = status.home_score ?? 0;
    const awayScore = status.away_score ?? 0;
    const myScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    const result: 'W' | 'L' | 'D' = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D';

    out.push({
      date: sport.start_time?.slice(0, 10) || '',
      opponent: opp.name,
      venue: isHome ? 'home' : 'away',
      competition: sport.tournament?.name || '',
      score: `${myScore}-${oppScore}`,
      result,
      goals_for: myScore,
      goals_against: oppScore,
      stats: extractTeamStats(s, competitorId),
    });
  }

  // Mais recentes primeiro → pega 5
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, 5);
}

function buildAggregate(matches: MatchSummary[], teamName: string) {
  if (matches.length === 0) return null;
  const n = matches.length;
  let wins = 0, draws = 0, losses = 0;
  let gf = 0, ga = 0;
  let xgSum = 0, xgN = 0;
  let possSum = 0, possN = 0;
  let shotsSum = 0, shotsN = 0;
  let sotSum = 0, sotN = 0;
  let cornersSum = 0, cornersN = 0;

  for (const m of matches) {
    if (m.result === 'W') wins++; else if (m.result === 'D') draws++; else losses++;
    gf += m.goals_for; ga += m.goals_against;
    const s = m.stats || {};
    if (s.xg != null) { xgSum += s.xg; xgN++; }
    if (s.possession != null) { possSum += s.possession; possN++; }
    if (s.shots_total != null) { shotsSum += s.shots_total; shotsN++; }
    if (s.shots_on_target != null) { sotSum += s.shots_on_target; sotN++; }
    if (s.corner_kicks != null) { cornersSum += s.corner_kicks; cornersN++; }
  }

  return {
    team: teamName,
    sample_size: n,
    record: { wins, draws, losses },
    avg_goals_for: +(gf / n).toFixed(2),
    avg_goals_against: +(ga / n).toFixed(2),
    avg_xg: xgN > 0 ? +(xgSum / xgN).toFixed(2) : null,
    avg_possession: possN > 0 ? +(possSum / possN).toFixed(1) : null,
    avg_shots: shotsN > 0 ? +(shotsSum / shotsN).toFixed(1) : null,
    avg_shots_on_target: sotN > 0 ? +(sotSum / sotN).toFixed(1) : null,
    avg_corners: cornersN > 0 ? +(cornersSum / cornersN).toFixed(1) : null,
    matches: matches.map(m => ({
      date: m.date,
      opponent: m.opponent,
      venue: m.venue,
      competition: m.competition,
      score: m.score,
      result: m.result,
      xg: m.stats?.xg ?? null,
      possession: m.stats?.possession ?? null,
      shots: m.stats?.shots_total ?? null,
      shots_on_target: m.stats?.shots_on_target ?? null,
    })),
  };
}

async function buildTeamForm(teamName: string, apiKey: string) {
  const comp = await findCompetitor(teamName, apiKey);
  if (!comp) {
    console.warn(`[Sportradar] competitor not found: ${teamName}`);
    return null;
  }
  console.log(`[Sportradar] ${teamName} → ${comp.name} (${comp.id})`);
  const summaries = await fetchTeamSummaries(comp.id, comp.name, apiKey);
  if (summaries.length === 0) {
    console.warn(`[Sportradar] no closed summaries for ${teamName}`);
    return null;
  }
  return buildAggregate(summaries, comp.name);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('SPORTRADAR_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'SPORTRADAR_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { home, away } = await req.json();
    if (!home || !away) {
      return new Response(JSON.stringify({ error: 'home and away required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cacheKey = `${FN_NAME}:${normalize(home)}_vs_${normalize(away)}`;
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: cached } = await sb
      .from('ai_response_cache')
      .select('response_json, expires_at, hit_count')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.response_json) {
      sb.from('ai_response_cache').update({ hit_count: (cached.hit_count || 0) + 1 })
        .eq('cache_key', cacheKey).then(() => {}, () => {});
      console.log(`[Sportradar] 🎯 Cache HIT: ${cacheKey}`);
      return new Response(JSON.stringify({ ...cached.response_json, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Sportradar] 🔍 Fetching ${home} vs ${away}`);
    // Serializado: trial = 1 req/seg
    const homeForm = await buildTeamForm(home, apiKey);
    const awayForm = await buildTeamForm(away, apiKey);

    if (!homeForm && !awayForm) {
      return new Response(JSON.stringify({ found: false, message: 'Teams not found on Sportradar' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      found: true,
      source: 'sportradar',
      home: homeForm,
      away: awayForm,
    };

    sb.from('ai_response_cache').upsert({
      function_name: FN_NAME,
      cache_key: cacheKey,
      response_json: payload,
      expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString(),
      hit_count: 0,
    }, { onConflict: 'cache_key' }).then(() => {}, (e) => console.warn('[Sportradar] cache save:', e));

    console.log(`[Sportradar] ✅ ${home}: xG ${homeForm?.avg_xg ?? '?'} | ${away}: xG ${awayForm?.avg_xg ?? '?'}`);
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[Sportradar] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
