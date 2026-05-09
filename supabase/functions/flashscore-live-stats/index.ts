// Flashscore Live Stats Scraper (3ª fonte — fallback de SofaScore)
// Flashscore NÃO publica xG real publicamente. Esta função extrai
// stats reais (posse, chutes, escanteios, ataques) via Firecrawl e
// ESTIMA xG sintético calibrado contra benchmarks públicos
// (StatsBomb/Understat: ~0.10 xG/chute, ~0.32 xG/SoT, ~30% conv. SoT).
//
// Fórmula calibrada:
//   xG_estimado = (SoT × 0.32) + (off_target × 0.05) + (blocked × 0.03)
//   × fator_contexto_liga (0.92 - 1.08)
//
// Matching de URL: normalização + similaridade Jaccard entre tokens
// + filtro por liga + janela de horário (±3h) para reduzir partida errada.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const FN_NAME = 'flashscore-live-stats';
const CACHE_TTL_SECONDS = 90;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API = 'https://api.firecrawl.dev/v2';

// ═══════════════════════════════════════════════════════════════
// CALIBRAÇÃO xG (baseada em benchmarks públicos)
// ═══════════════════════════════════════════════════════════════
// StatsBomb/Understat médias 2020-2024:
//   - Conversão média de SoT: ~30-32% (xG ~0.32)
//   - xG médio por chute fora: ~0.04-0.06
//   - xG médio por chute bloqueado: ~0.03-0.04
//   - Total xG médio por jogo: 2.6-2.8 (Big5)
const XG_WEIGHTS = {
  on_target: 0.32,   // antes 0.30 — calibrado p/ Big5
  off_target: 0.05,  // antes 0.06
  blocked: 0.03,     // antes 0.04
};

// Fator de ajuste por liga (jogos mais ofensivos/defensivos têm xG/chute diferente)
// Calibrado pela média de gols/jogo conhecida.
const LEAGUE_XG_FACTOR: Record<string, number> = {
  // Mais ofensivas (>2.8 gols/jogo)
  'bundesliga': 1.08,
  'eredivisie': 1.07,
  'major league soccer': 1.05,
  'mls': 1.05,
  // Médias (2.5-2.8)
  'premier league': 1.02,
  'serie a': 1.00,
  'la liga': 1.00,
  'primera division': 1.00,
  'ligue 1': 0.99,
  'championship': 1.01,
  'copa do brasil': 1.00,
  'libertadores': 0.97,
  'sudamericana': 0.98,
  // Defensivas (<2.5)
  'serie b': 0.96,
  'serie c': 0.94,
  'serie d': 0.92,
  'segunda division': 0.95,
  'ligue 2': 0.95,
  'liga profesional argentina': 0.96,
  'primera a': 0.97,
  'friendlies': 1.05, // amistosos costumam ter mais chances claras
};

function leagueFactor(league: string | undefined | null): number {
  if (!league) return 1.0;
  const k = league.toLowerCase().trim();
  if (LEAGUE_XG_FACTOR[k] != null) return LEAGUE_XG_FACTOR[k];
  // match parcial
  for (const [name, f] of Object.entries(LEAGUE_XG_FACTOR)) {
    if (k.includes(name) || name.includes(k)) return f;
  }
  return 1.0;
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZAÇÃO E SIMILARIDADE
// ═══════════════════════════════════════════════════════════════
const STOPWORDS = new Set([
  'fc', 'cf', 'ac', 'sc', 'ec', 'sad', 'cd', 'aa', 'ca', 'club', 'clube',
  'de', 'do', 'da', 'dos', 'das', 'el', 'la', 'les', 'os', 'as',
  'united', 'city', 'town', 'athletic', 'sporting', 'real', 'mg', 'rj', 'sp', 'rs', 'pr', 'pe', 'go', 'ce',
]);

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function tokenize(s: string): Set<string> {
  const cleaned = (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tokens = cleaned.split(/[^a-z0-9]+/).filter(t => t.length >= 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function parseNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace('%', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ═══════════════════════════════════════════════════════════════
// MATCH URL no Flashscore (com heurísticas de liga + horário)
// ═══════════════════════════════════════════════════════════════
interface FindUrlOpts {
  home: string;
  away: string;
  league?: string | null;
  matchTimeISO?: string | null; // start time se conhecido
  fcKey: string;
}

async function findFlashscoreUrl(opts: FindUrlOpts): Promise<{ url: string; score: number } | null> {
  const { home, away, league, matchTimeISO, fcKey } = opts;
  try {
    // Inclui liga na query quando disponível para melhorar precisão
    const leaguePart = league ? ` ${league}` : '';
    const q = `${home} ${away}${leaguePart} site:flashscore.com.br`;
    const r = await fetch(`${FIRECRAWL_API}/search`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, limit: 8 }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const results = d?.data || d?.web?.results || [];

    const homeTokens = tokenize(home);
    const awayTokens = tokenize(away);
    const leagueTokens = league ? tokenize(league) : null;
    const matchTime = matchTimeISO ? new Date(matchTimeISO).getTime() : null;
    const now = Date.now();

    let best: { url: string; score: number } | null = null;
    for (const it of results) {
      const url: string = it?.url || '';
      const title: string = (it?.title || '');
      const desc: string = (it?.description || it?.snippet || '');
      if (!url.includes('flashscore.com.br') || !url.includes('/jogo/')) continue;

      const titleTokens = tokenize(title);
      const descTokens = tokenize(desc);
      const allTokens = new Set([...titleTokens, ...descTokens]);

      // Similaridade dos times
      const homeSim = jaccard(homeTokens, titleTokens);
      const awaySim = jaccard(awayTokens, titleTokens);
      const teamScore = (homeSim + awaySim) / 2;

      // Bônus se a liga aparece
      let leagueBonus = 0;
      if (leagueTokens && leagueTokens.size > 0) {
        const lSim = jaccard(leagueTokens, allTokens);
        leagueBonus = lSim * 0.25;
      }

      // Bônus de horário: Flashscore mostra horário no description tipo "20:00" ou "ao vivo"
      let timeBonus = 0;
      if (matchTime) {
        const hoursDiff = Math.abs(now - matchTime) / 3.6e6;
        if (hoursDiff <= 3) timeBonus = 0.15;
        else if (hoursDiff <= 6) timeBonus = 0.05;
      }
      // "ao vivo" ou "min" no description = está rolando agora
      if (/ao vivo|\bmin\b|\b\d{1,3}'/.test(desc.toLowerCase())) timeBonus += 0.10;

      const score = teamScore + leagueBonus + timeBonus;

      // Threshold mínimo: pelo menos 1 dos times deve bater bem
      if (Math.max(homeSim, awaySim) < 0.30) continue;

      if (!best || score > best.score) best = { url, score };
    }

    if (best && best.score >= 0.35) {
      console.log(`[Flashscore] ✅ Match URL score=${best.score.toFixed(2)} url=${best.url}`);
      return best;
    }
    if (best) {
      console.log(`[Flashscore] ⚠️ Best match score=${best.score.toFixed(2)} abaixo do threshold 0.35`);
    }
    return null;
  } catch (e) {
    console.warn('[Flashscore] findUrl error:', e);
    return null;
  }
}

async function scrapeFlashscoreStats(matchUrl: string, fcKey: string): Promise<string | null> {
  try {
    const statsUrl = matchUrl.replace(/\/#.*$/, '') + '/#/resumo-da-partida/estatisticas-da-partida/0';
    const r = await fetch(`${FIRECRAWL_API}/scrape`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: statsUrl, formats: ['markdown'], onlyMainContent: true, waitFor: 2500 }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.data?.markdown || d?.markdown || null;
  } catch (e) {
    console.warn('[Flashscore] scrape error:', e);
    return null;
  }
}

function parseFlashscoreMarkdown(md: string): Record<string, { home: number | null; away: number | null }> {
  const stats: Record<string, { home: number | null; away: number | null }> = {};
  if (!md) return stats;

  const STAT_MAP: Record<string, string> = {
    'posse de bola': 'possession',
    'remates totais': 'shots_total',
    'remates a baliza': 'shots_on_target',
    'remates fora': 'shots_off_target',
    'remates bloqueados': 'blocked_shots',
    'remates ao poste': 'shots_on_post',
    'cantos': 'corners',
    'pontapes de canto': 'corners',
    'foras de jogo': 'offsides',
    'foras-de-jogo': 'offsides',
    'cartoes amarelos': 'yellow_cards',
    'cartoes vermelhos': 'red_cards',
    'faltas': 'fouls',
    'defesas do guarda redes': 'goalkeeper_saves',
    'cruzamentos': 'crosses',
    'ataques': 'attacks',
    'ataques perigosos': 'dangerous_attacks',
    'passes': 'passes',
    'precisao de passe': 'pass_accuracy',
  };

  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    const cleaned = line.replace(/[*_|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!cleaned) continue;
    for (const [term, key] of Object.entries(STAT_MAP)) {
      if (!cleaned.includes(term)) continue;
      const re = new RegExp(`(\\d+(?:[.,]\\d+)?%?)\\s*[^\\d]{0,5}${term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[^\\d]{0,5}(\\d+(?:[.,]\\d+)?%?)`);
      const m = cleaned.match(re);
      if (m) {
        stats[key] = {
          home: parseNumber(m[1]),
          away: parseNumber(m[2]),
        };
        break;
      }
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════
// xG SINTÉTICO CALIBRADO
// ═══════════════════════════════════════════════════════════════
function estimateXG(
  shotsTotal: number | null,
  shotsOnTarget: number | null,
  blocked: number | null,
  leagueFactorVal: number,
): number | null {
  if (shotsTotal == null && shotsOnTarget == null) return null;
  const onT = shotsOnTarget ?? 0;
  const blk = blocked ?? 0;
  const total = shotsTotal ?? (onT + blk);
  const off = Math.max(0, total - onT - blk);
  const xg = (onT * XG_WEIGHTS.on_target) + (off * XG_WEIGHTS.off_target) + (blk * XG_WEIGHTS.blocked);
  const adjusted = xg * leagueFactorVal;
  return Math.round(adjusted * 100) / 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { home, away, league, matchTime } = await req.json();
    if (!home || !away) {
      return new Response(JSON.stringify({ error: 'home and away required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!fcKey) {
      return new Response(JSON.stringify({ found: false, error: 'FIRECRAWL_API_KEY not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cacheKey = `${FN_NAME}:${normalize(home)}_vs_${normalize(away)}`;
    const sbAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    try {
      const { data: cached } = await sbAdmin
        .from('ai_response_cache')
        .select('response_json, expires_at, hit_count')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (cached?.response_json) {
        sbAdmin.from('ai_response_cache').update({ hit_count: (cached.hit_count || 0) + 1 })
          .eq('cache_key', cacheKey).then(() => {}, () => {});
        console.log(`[Flashscore] 🎯 Cache HIT: ${cacheKey}`);
        return new Response(JSON.stringify({ ...cached.response_json, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (e) { console.warn('[Flashscore] cache lookup error:', e); }

    const matchResult = await findFlashscoreUrl({ home, away, league, matchTimeISO: matchTime, fcKey });
    if (!matchResult) {
      console.log(`[Flashscore] ⚠️ URL não encontrada para ${home} vs ${away} (liga=${league || 'n/d'})`);
      return new Response(JSON.stringify({ found: false, message: 'Match URL not found on Flashscore' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { url: matchUrl, score: matchScore } = matchResult;

    const md = await scrapeFlashscoreStats(matchUrl, fcKey);
    if (!md) {
      return new Response(JSON.stringify({ found: false, url: matchUrl, error: 'Stats markdown unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = parseFlashscoreMarkdown(md);
    const get = (k: string, side: 'home' | 'away') => parsed[k]?.[side] ?? null;

    const lf = leagueFactor(league);
    const xg_home = estimateXG(get('shots_total', 'home'), get('shots_on_target', 'home'), get('blocked_shots', 'home'), lf);
    const xg_away = estimateXG(get('shots_total', 'away'), get('shots_on_target', 'away'), get('blocked_shots', 'away'), lf);

    const enrichment = {
      source: 'flashscore',
      url: matchUrl,
      match_score: Math.round(matchScore * 100) / 100,
      league_factor: lf,
      xg_estimated: true,
      xg_home,
      xg_away,
      possession_home: get('possession', 'home'),
      possession_away: get('possession', 'away'),
      shots_total_home: get('shots_total', 'home'),
      shots_total_away: get('shots_total', 'away'),
      shots_on_target_home: get('shots_on_target', 'home'),
      shots_on_target_away: get('shots_on_target', 'away'),
      shots_off_target_home: get('shots_off_target', 'home'),
      shots_off_target_away: get('shots_off_target', 'away'),
      blocked_shots_home: get('blocked_shots', 'home'),
      blocked_shots_away: get('blocked_shots', 'away'),
      corners_home: get('corners', 'home'),
      corners_away: get('corners', 'away'),
      fouls_home: get('fouls', 'home'),
      fouls_away: get('fouls', 'away'),
      yellow_cards_home: get('yellow_cards', 'home'),
      yellow_cards_away: get('yellow_cards', 'away'),
      red_cards_home: get('red_cards', 'home'),
      red_cards_away: get('red_cards', 'away'),
      offsides_home: get('offsides', 'home'),
      offsides_away: get('offsides', 'away'),
      attacks_home: get('attacks', 'home'),
      attacks_away: get('attacks', 'away'),
      dangerous_attacks_home: get('dangerous_attacks', 'home'),
      dangerous_attacks_away: get('dangerous_attacks', 'away'),
    };

    console.log(`[Flashscore] 📊 ${home} vs ${away} [${league || 'n/d'} lf=${lf}]: xG_est ${xg_home}-${xg_away}, shots ${enrichment.shots_total_home}-${enrichment.shots_total_away}, match_score=${enrichment.match_score}`);

    const responsePayload = { found: true, ...enrichment };
    sbAdmin.from('ai_response_cache').upsert({
      function_name: FN_NAME,
      cache_key: cacheKey,
      response_json: responsePayload,
      expires_at: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
      hit_count: 0,
    }, { onConflict: 'cache_key' }).then(() => {}, (e) => console.warn('[Flashscore] cache save:', e));

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[Flashscore] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
