// Flashscore Live Stats Scraper (3ª fonte — fallback de SofaScore)
// Flashscore NÃO publica xG real publicamente. Esta função extrai
// stats reais (posse, chutes, escanteios, ataques) via Firecrawl e
// ESTIMA xG sintético usando a qualidade dos chutes (no gol vs total).
// Fórmula: xG_estimado = (chutes_no_gol × 0.30) + (chutes_fora × 0.06)
// — calibrada para média ~0.10 xG/chute total, próxima da realidade.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const FN_NAME = 'flashscore-live-stats';
const CACHE_TTL_SECONDS = 90; // 90s — mais conservador que SofaScore (poupa créditos Firecrawl)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API = 'https://api.firecrawl.dev/v2';

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function parseNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace('%', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Busca a URL da partida no Flashscore via search (Firecrawl /search)
async function findFlashscoreUrl(home: string, away: string, fcKey: string): Promise<string | null> {
  try {
    const q = `${home} ${away} site:flashscore.com.br`;
    const r = await fetch(`${FIRECRAWL_API}/search`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, limit: 5 }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const results = d?.data || d?.web?.results || [];
    const homeN = normalize(home);
    const awayN = normalize(away);
    for (const it of results) {
      const url: string = it?.url || '';
      const title: string = (it?.title || '').toLowerCase();
      if (!url.includes('flashscore.com.br') || !url.includes('/jogo/')) continue;
      // Match heurístico: title precisa conter ambos os times
      if (normalize(title).includes(homeN.slice(0, 6)) && normalize(title).includes(awayN.slice(0, 6))) {
        return url;
      }
    }
    // Fallback: primeiro resultado com /jogo/
    return results.find((r: any) => (r?.url || '').includes('/jogo/'))?.url || null;
  } catch (e) {
    console.warn('[Flashscore] findUrl error:', e);
    return null;
  }
}

// Scrapa a página de stats do jogo via Firecrawl (markdown)
async function scrapeFlashscoreStats(matchUrl: string, fcKey: string): Promise<string | null> {
  try {
    // Append /#/resumo-da-partida/estatisticas-da-partida para ir direto para a aba de stats
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

// Extrai estatísticas do markdown bruto via heurísticas regex.
// Flashscore renderiza no formato: "<valor_home> <NOME_STAT> <valor_away>"
function parseFlashscoreMarkdown(md: string): Record<string, { home: number | null; away: number | null }> {
  const stats: Record<string, { home: number | null; away: number | null }> = {};
  if (!md) return stats;

  // Mapa de termos do Flashscore PT → chave normalizada
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

  // Regex genérico: linha tipo "12  Remates totais  9" ou "12 - Remates totais - 9"
  // Aceita números com %.
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    const cleaned = line.replace(/[*_|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!cleaned) continue;
    for (const [term, key] of Object.entries(STAT_MAP)) {
      if (!cleaned.includes(term)) continue;
      // Captura número antes e depois do termo
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

// Estima xG sintético baseado em chutes
// Heurística: shot_on_target ~0.30 xG médio, shot_off ~0.06, blocked ~0.04
function estimateXG(shotsTotal: number | null, shotsOnTarget: number | null, blocked: number | null): number | null {
  if (shotsTotal == null && shotsOnTarget == null) return null;
  const onT = shotsOnTarget ?? 0;
  const blk = blocked ?? 0;
  const total = shotsTotal ?? (onT + blk);
  const off = Math.max(0, total - onT - blk);
  const xg = (onT * 0.30) + (off * 0.06) + (blk * 0.04);
  return Math.round(xg * 100) / 100;
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

    const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!fcKey) {
      return new Response(JSON.stringify({ found: false, error: 'FIRECRAWL_API_KEY not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cache lookup
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

    // Busca a URL da partida
    const matchUrl = await findFlashscoreUrl(home, away, fcKey);
    if (!matchUrl) {
      console.log(`[Flashscore] ⚠️ URL não encontrada para ${home} vs ${away}`);
      return new Response(JSON.stringify({ found: false, message: 'Match URL not found on Flashscore' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Scrape stats
    const md = await scrapeFlashscoreStats(matchUrl, fcKey);
    if (!md) {
      return new Response(JSON.stringify({ found: false, url: matchUrl, error: 'Stats markdown unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = parseFlashscoreMarkdown(md);
    const get = (k: string, side: 'home' | 'away') => parsed[k]?.[side] ?? null;

    const xg_home = estimateXG(get('shots_total', 'home'), get('shots_on_target', 'home'), get('blocked_shots', 'home'));
    const xg_away = estimateXG(get('shots_total', 'away'), get('shots_on_target', 'away'), get('blocked_shots', 'away'));

    const enrichment = {
      source: 'flashscore',
      url: matchUrl,
      xg_estimated: true, // ⚠️ FLAG — esses xG são sintéticos
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

    console.log(`[Flashscore] 📊 ${home} vs ${away}: xG_est ${xg_home}-${xg_away}, shots ${enrichment.shots_total_home}-${enrichment.shots_total_away}`);

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
