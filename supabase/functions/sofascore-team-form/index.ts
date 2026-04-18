// Team Form (Pré-jogo) — Fonte: FBref via Firecrawl
// SofaScore api.sofascore.com é hard-blocked pelo Cloudflare; FBref serve HTML público
// com xG, finalizações, posse e resultado por jogo. Mantém o endpoint name p/ compat.
// Cache em ai_response_cache (TTL 6h).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API = 'https://api.firecrawl.dev/v2';
const CACHE_TTL_HOURS = 6;
const FN_NAME = 'sofascore-team-form'; // mantém p/ compat

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function parseNum(v: string | undefined | null): number | null {
  if (v == null) return null;
  const cleaned = String(v).replace(/[,%]/g, '').trim();
  if (cleaned === '' || cleaned === '—' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

async function fcScrape(url: string, waitFor = 1500): Promise<string | null> {
  const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!fcKey) {
    console.warn('[FBref] FIRECRAWL_API_KEY missing');
    return null;
  }
  try {
    const r = await fetch(`${FIRECRAWL_API}/scrape`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, waitFor }),
    });
    if (!r.ok) {
      console.warn(`[FBref] Firecrawl HTTP ${r.status} for ${url}`);
      return null;
    }
    const d = await r.json();
    return d?.data?.markdown || null;
  } catch (e) {
    console.warn(`[FBref] Firecrawl error for ${url}:`, e);
    return null;
  }
}

// Extrai squad id do FBref a partir do nome do time
async function findSquad(name: string): Promise<{ id: string; slug: string; name: string } | null> {
  const md = await fcScrape(`https://fbref.com/en/search/search.fcgi?search=${encodeURIComponent(name)}`, 1200);
  if (!md) return null;

  // Pega blocos: **[Name](https://fbref.com/en/squads/{id}/...)** seguido de "Male" (ignora Female por padrão)
  const re = /\*\*\[([^\]]+)\]\(https:\/\/fbref\.com\/en\/squads\/([a-f0-9]+)\/?[^)]*\)\*\*[\s\S]{0,400}?Gender:\s*([A-Za-z]+)/g;
  const matches: Array<{ name: string; id: string; gender: string }> = [];
  let m;
  while ((m = re.exec(md)) !== null) {
    matches.push({ name: m[1], id: m[2], gender: m[3] });
  }
  if (matches.length === 0) {
    // Fallback simples: primeiro link de squads
    const simple = md.match(/\(https:\/\/fbref\.com\/en\/squads\/([a-f0-9]+)\/?\)/);
    if (simple) return { id: simple[1], slug: name, name };
    return null;
  }
  // Prefere Male, depois primeiro
  const male = matches.find(x => x.gender.toLowerCase() === 'male');
  const pick = male || matches[0];
  return { id: pick.id, slug: pick.name.replace(/\s+/g, '-'), name: pick.name };
}

interface MatchRow {
  date: string;
  comp?: string;
  venue?: 'Home' | 'Away';
  result?: 'W' | 'L' | 'D';
  gf?: number | null;
  ga?: number | null;
  opponent?: string;
  poss?: number | null;
  shots?: number | null;
  sot?: number | null;
  xg?: number | null;
  npxg?: number | null;
}

// Parseia matchlogs/all_comps/shooting — uma linha por jogo, com xG, Sh, SoT
async function fetchShootingLog(squadId: string, slugName: string, season = 2026): Promise<MatchRow[]> {
  const url = `https://fbref.com/en/squads/${squadId}/${season}/matchlogs/all_comps/shooting/${slugName}-Match-Logs-All-Competitions`;
  const md = await fcScrape(url, 1500);
  if (!md) return [];

  // Linhas: | [date](url) | time | [Comp](..) | Round | Day | Venue | Result | GF | GA | Opp | Gls | Sh | SoT | SoT% | xG | npxG | ...
  const lines = md.split('\n').filter(l => l.trim().startsWith('|') && /\d{4}-\d{2}-\d{2}/.test(l));
  const rows: MatchRow[] = [];
  for (const line of lines) {
    const cells = line.split('|').map(c => c.trim());
    // cells[0] is empty (leading |), data starts at 1
    // Ex: cells[1]='[2026-04-12](url)', [2]='18:30(17:30)', [3]='[Série A](..)', [4]='[Matchweek 11](..)',
    //     [5]='Sun', [6]='Home', [7]='D', [8]='0', [9]='0', [10]='[Corinthians](..)', 
    //     [11]='0', [12]='6', [13]='4', [14]='66.7', [15]='0.00', [16]='0.00', ...
    if (cells.length < 17) continue;
    const dateMatch = cells[1].match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const result = cells[7];
    if (!['W', 'L', 'D'].includes(result)) continue; // só jogos disputados

    const oppMatch = cells[10].match(/\[([^\]]+)\]/);
    rows.push({
      date: dateMatch[1],
      comp: cells[3].replace(/\[([^\]]+)\].*/, '$1'),
      venue: cells[6] as 'Home' | 'Away',
      result: result as 'W' | 'L' | 'D',
      gf: parseNum(cells[8]),
      ga: parseNum(cells[9]),
      opponent: oppMatch ? oppMatch[1] : cells[10],
      shots: parseNum(cells[12]),
      sot: parseNum(cells[13]),
      xg: parseNum(cells[15]),
      npxg: parseNum(cells[16]),
    });
  }
  return rows;
}

// Posse é só no schedule "all_comps" — opcional, pode ser pulado se for muito lento
async function fetchScheduleLog(squadId: string, slugName: string, season = 2026): Promise<Map<string, number | null>> {
  const url = `https://fbref.com/en/squads/${squadId}/${season}/matchlogs/all_comps/schedule/${slugName}-Scores-and-Fixtures-All-Competitions`;
  const md = await fcScrape(url, 1500);
  const map = new Map<string, number | null>();
  if (!md) return map;

  const lines = md.split('\n').filter(l => l.trim().startsWith('|') && /\d{4}-\d{2}-\d{2}/.test(l));
  for (const line of lines) {
    const cells = line.split('|').map(c => c.trim());
    if (cells.length < 12) continue;
    const dateMatch = cells[1].match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    if (!['W', 'L', 'D'].includes(cells[7])) continue;
    // Possession is at cells[11] in schedule
    map.set(dateMatch[1], parseNum(cells[11]));
  }
  return map;
}

function buildAggregate(rows: MatchRow[], possMap: Map<string, number | null>, teamName: string) {
  if (rows.length === 0) return null;
  const last5 = rows.slice(-5);

  let wins = 0, draws = 0, losses = 0;
  let totalGf = 0, totalGa = 0;
  let totalXg = 0, totalNpxg = 0, xgCount = 0;
  let totalShots = 0, totalSot = 0, shotsCount = 0;
  let totalPoss = 0, possCount = 0;

  const matches = last5.map(r => {
    if (r.result === 'W') wins++; else if (r.result === 'D') draws++; else losses++;
    if (r.gf != null) totalGf += r.gf;
    if (r.ga != null) totalGa += r.ga;
    if (r.xg != null) { totalXg += r.xg; xgCount++; }
    if (r.npxg != null) totalNpxg += r.npxg;
    if (r.shots != null) { totalShots += r.shots; shotsCount++; }
    if (r.sot != null) totalSot += r.sot;
    const poss = possMap.get(r.date) ?? null;
    if (poss != null) { totalPoss += poss; possCount++; }
    return {
      date: r.date,
      opponent: r.opponent,
      venue: r.venue?.toLowerCase(),
      comp: r.comp,
      score: `${r.gf ?? '?'}-${r.ga ?? '?'}`,
      result: r.result,
      xg: r.xg,
      shots: r.shots,
      shots_on_target: r.sot,
      possession: poss,
    };
  });

  const n = last5.length;
  return {
    team: teamName,
    sample_size: n,
    record: { wins, draws, losses },
    avg_goals_for: +(totalGf / n).toFixed(2),
    avg_goals_against: +(totalGa / n).toFixed(2),
    avg_xg: xgCount > 0 ? +(totalXg / xgCount).toFixed(2) : null,
    avg_npxg: xgCount > 0 ? +(totalNpxg / xgCount).toFixed(2) : null,
    avg_shots: shotsCount > 0 ? +(totalShots / shotsCount).toFixed(1) : null,
    avg_shots_on_target: shotsCount > 0 ? +(totalSot / shotsCount).toFixed(1) : null,
    avg_possession: possCount > 0 ? +(totalPoss / possCount).toFixed(1) : null,
    matches,
  };
}

async function buildTeamForm(teamName: string) {
  const squad = await findSquad(teamName);
  if (!squad) {
    console.warn(`[FBref] squad not found for "${teamName}"`);
    return null;
  }
  console.log(`[FBref] ${teamName} → squad ${squad.name} (${squad.id})`);
  // Paraleliza shooting + schedule
  const [shooting, possMap] = await Promise.all([
    fetchShootingLog(squad.id, squad.slug),
    fetchScheduleLog(squad.id, squad.slug),
  ]);
  if (shooting.length === 0) {
    console.warn(`[FBref] no played matches found for ${teamName}`);
    return null;
  }
  return buildAggregate(shooting, possMap, squad.name);
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

    // Cache lookup
    const { data: cached } = await sb
      .from('ai_response_cache')
      .select('response_json, expires_at, hit_count')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.response_json) {
      sb.from('ai_response_cache').update({ hit_count: (cached.hit_count || 0) + 1 })
        .eq('cache_key', cacheKey).then(() => {}, () => {});
      console.log(`[FBref] 🎯 Cache HIT: ${cacheKey}`);
      return new Response(JSON.stringify({ ...cached.response_json, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[FBref] 🔍 Fetching form for ${home} vs ${away}`);
    const [homeForm, awayForm] = await Promise.all([
      buildTeamForm(home),
      buildTeamForm(away),
    ]);

    if (!homeForm && !awayForm) {
      return new Response(JSON.stringify({ found: false, message: 'Teams not found on FBref' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      found: true,
      source: 'fbref',
      home: homeForm,
      away: awayForm,
    };

    // Save cache (fire-and-forget)
    sb.from('ai_response_cache').upsert({
      function_name: FN_NAME,
      cache_key: cacheKey,
      response_json: payload,
      expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString(),
      hit_count: 0,
    }, { onConflict: 'cache_key' }).then(() => {}, (e) => console.warn('[FBref] cache save:', e));

    console.log(`[FBref] ✅ ${home}: xG ${homeForm?.avg_xg ?? '?'} | ${away}: xG ${awayForm?.avg_xg ?? '?'}`);
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[FBref] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
