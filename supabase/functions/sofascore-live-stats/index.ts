// SofaScore Live Stats Scraper
// Busca xG ao vivo, momentum e estatísticas avançadas via API interna do SofaScore.
// Endpoint público (não documentado): https://api.sofascore.com/api/v1/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const FN_NAME = 'sofascore-live-stats';
const CACHE_TTL_SECONDS = 60; // dados ao vivo: 60s

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOFA_BASE = 'https://api.sofascore.com/api/v1';
const FIRECRAWL_API = 'https://api.firecrawl.dev/v2';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
};

async function sofaFetch(path: string): Promise<any | null> {
  const url = `${SOFA_BASE}${path}`;
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (r.ok) return await r.json();
    if (r.status !== 403 && r.status !== 429) return null;
  } catch {}
  const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!fcKey) return null;
  try {
    const fr = await fetch(`${FIRECRAWL_API}/scrape`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false, waitFor: 800 }),
    });
    if (!fr.ok) return null;
    const fd = await fr.json();
    const raw: string = fd?.data?.rawHtml || fd?.rawHtml || '';
    const jsonStr = raw.replace(/<[^>]+>/g, '').trim();
    if (!jsonStr.startsWith('{')) return null;
    return JSON.parse(jsonStr);
  } catch { return null; }
}

// Normalize string for fuzzy matching
function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Strip noise commonly added by API-Football: "FC", "CF", "Club", "Atletico", suffixes "de Santiago"
const NOISE_TOKENS = ['fc', 'cf', 'sc', 'ac', 'club', 'clube', 'sporting', 'cd', 'sd', 'ud', 'rcd', 'real', 'deportivo', 'atletico', 'athletic', 'cska', 'fk', 'aa', 'ec', 'ca', 'se', 'cr', 'rb', 'afc', 'cfc', 'mg', 'rj', 'sp', 'rs', 'pr', 'go', 'ba', 'ce', 'pe'];
function simplify(s: string): string {
  const tokens = (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => !NOISE_TOKENS.includes(t));
  return tokens.join('');
}

// Dicionário de aliases para times BR/Sul-Americanos onde API-Football usa nome diferente do SofaScore.
// Chave: nome normalizado (lowercase, sem acento) que API-Football costuma enviar.
// Valor: array de nomes alternativos para buscar no SofaScore.
const TEAM_ALIASES: Record<string, string[]> = {
  // Brasileirão
  'america mineiro': ['America MG', 'America-MG'],
  'america-mg': ['America MG', 'America Mineiro'],
  'atletico mineiro': ['Atletico-MG', 'Atletico MG'],
  'atletico-mg': ['Atletico Mineiro', 'Atletico MG'],
  'atletico goianiense': ['Atletico-GO', 'Atletico GO'],
  'atletico-go': ['Atletico Goianiense'],
  'atletico paranaense': ['Athletico-PR', 'Athletico Paranaense'],
  'athletico paranaense': ['Athletico-PR'],
  'gremio': ['Gremio FBPA', 'Gremio Porto Alegre'],
  'internacional': ['SC Internacional', 'Internacional RS'],
  'corinthians': ['Sport Club Corinthians Paulista', 'Corinthians SP'],
  'palmeiras': ['SE Palmeiras'],
  'sao paulo': ['Sao Paulo FC'],
  'santos': ['Santos FC'],
  'flamengo': ['CR Flamengo', 'Flamengo RJ'],
  'fluminense': ['Fluminense FC', 'Fluminense RJ'],
  'vasco da gama': ['Vasco', 'CR Vasco da Gama'],
  'botafogo': ['Botafogo FR', 'Botafogo RJ'],
  'cruzeiro': ['Cruzeiro EC', 'Cruzeiro MG'],
  'bahia': ['EC Bahia', 'Bahia BA'],
  'ponte preta': ['AA Ponte Preta', 'Ponte Preta SP'],
  'aa ponte preta': ['Ponte Preta'],
  'csa': ['CSA AL', 'Centro Sportivo Alagoano'],
  'crb': ['Clube de Regatas Brasil', 'CRB AL'],
  // Argentina
  'atletico torque': ['Montevideo City Torque', 'City Torque'],
  'central cordoba': ['Central Cordoba SdE', 'Central Cordoba Santiago'],
  'argentinos juniors': ['Argentinos Jrs'],
  'gimnasia la plata': ['Gimnasia LP', 'Gimnasia y Esgrima LP'],
  'gimnasia y esgrima': ['Gimnasia LP'],
  'estudiantes': ['Estudiantes LP', 'Estudiantes La Plata'],
  'newells old boys': ["Newell's Old Boys", 'Newells'],
  'union santa fe': ['Union de Santa Fe', 'Union'],
  'banfield': ['CA Banfield'],
  'tigre': ['CA Tigre'],
  'velez sarsfield': ['Velez', 'Velez Sarsfield'],
  'racing club': ['Racing Club Avellaneda', 'Racing'],
  'independiente': ['CA Independiente', 'Independiente Avellaneda'],
  'lanus': ['CA Lanus'],
  'platense': ['CA Platense', 'Club Atletico Platense'],
  'san lorenzo': ['San Lorenzo de Almagro', 'CA San Lorenzo'],
  'barracas central': ['CA Barracas Central'],
  'huracan': ['CA Huracan'],
  'belgrano': ['CA Belgrano', 'Belgrano Cordoba'],
  'godoy cruz': ['Godoy Cruz Antonio Tomba'],
  'instituto cordoba': ['Instituto'],
  'rosario central': ['CA Rosario Central'],
  // Uruguai/Bolivia/Outros sul-americanos
  'boston river': ['Boston River Montevideo'],
  'montevideo wanderers': ['Wanderers Montevideo'],
  'penarol': ['CA Penarol', 'Penarol Montevideo'],
  'nacional montevideo': ['Club Nacional', 'Nacional'],
  'liverpool montevideo': ['Liverpool FC Montevideo', 'Liverpool'],
};

function getAliases(name: string): string[] {
  const key = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return TEAM_ALIASES[key] || [];
}

// Returns multiple search variants of a team name to try
function teamVariants(name: string): string[] {
  const variants = new Set<string>();
  variants.add(name);
  // Aliases customizados (top priority)
  for (const a of getAliases(name)) variants.add(a);
  // Strip "de Santiago", "del Plata", multi-word suffixes
  variants.add(name.replace(/\s+(de|del|do|da)\s+\w+$/i, '').trim());
  // Strip dots: "Independ. Rivadavia" → "Independiente Rivadavia"
  variants.add(name.replace(/\.\s*/g, 'iente '));
  variants.add(name.replace(/\.\s*/g, ' '));
  // Remove suffix de UF brasileira: "Ponte Preta SP" → "Ponte Preta"
  variants.add(name.replace(/\s*[-/]?\s*(MG|RJ|SP|RS|PR|GO|BA|CE|PE|AL|SC|DF|ES|PB|RN|MA|PA|AM|AC|RO|RR|AP|TO|PI|MS|MT|SE)\s*$/i, '').trim());
  // Remove prefixos comuns: "CA ", "CR ", "EC ", "AA ", "SE ", "SC "
  variants.add(name.replace(/^(CA|CR|EC|AA|SE|SC|CF|FC|RC|AC|CD|SD|UD|RCD)\s+/i, '').trim());
  // First two tokens only
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) variants.add(tokens.slice(0, 2).join(' '));
  // First token only (last resort)
  if (tokens.length >= 1) variants.add(tokens[0]);
  return Array.from(variants).filter(v => v && v.length >= 3);
}

function teamMatches(eventName: string, eventShort: string, target: string): boolean {
  const eN = normalize(eventName);
  const eS = normalize(eventShort);
  const tN = normalize(target);
  const tS = simplify(target);
  const eSimp = simplify(eventName);
  if (!tN) return false;
  // Direct fuzzy
  if (eN.includes(tN) || tN.includes(eN)) return true;
  if (eS && (eS.includes(tN) || tN.includes(eS))) return true;
  // Simplified (strips FC, Club, etc): "crystalpalace" vs "crystalpalace"
  if (tS && eSimp && (eSimp.includes(tS) || tS.includes(eSimp))) return true;
  return false;
}

// Search for fixture by team names — tries multiple variants of home AND away
async function findEvent(homeTeam: string, awayTeam: string): Promise<number | null> {
  try {
    const homeVariants = teamVariants(homeTeam);
    const awayVariants = teamVariants(awayTeam);
    // Try home variants first, then away variants (some matches index by away)
    const searchTerms = [...homeVariants, ...awayVariants];

    for (const term of searchTerms) {
      const q = encodeURIComponent(term);
      const data = await sofaFetch(`/search/events/${q}`);
      const events = data?.events || [];
      if (!events.length) continue;

      for (const ev of events) {
        const eHome = ev.homeTeam?.name || '';
        const eAway = ev.awayTeam?.name || '';
        const eHomeShort = ev.homeTeam?.shortName || '';
        const eAwayShort = ev.awayTeam?.shortName || '';

        const homeMatch = teamMatches(eHome, eHomeShort, homeTeam);
        const awayMatch = teamMatches(eAway, eAwayShort, awayTeam);

        if (homeMatch && awayMatch) {
          if (term !== homeTeam) {
            console.log(`[SofaScore] 🎯 Matched via variant "${term}": ${eHome} vs ${eAway} (event ${ev.id})`);
          }
          return ev.id;
        }
      }
    }
    return null;
  } catch (e) {
    console.error('[SofaScore] findEvent error:', e);
    return null;
  }
}

// Fetch full statistics for an event
async function fetchEventStats(eventId: number): Promise<any> {
  try {
    const data = await sofaFetch(`/event/${eventId}/statistics`);
    if (!data) return null;
    const allPeriod = (data.statistics || []).find((p: any) => p.period === 'ALL');
    if (!allPeriod) return null;

    const result: any = {};
    for (const group of allPeriod.groups || []) {
      for (const item of group.statisticsItems || []) {
        const key = normalize(item.name);
        result[key] = {
          home: item.home,
          away: item.away,
          name: item.name,
        };
      }
    }
    return result;
  } catch (e) {
    console.error('[SofaScore] fetchEventStats error:', e);
    return null;
  }
}

// Fetch graph (momentum) for an event
async function fetchMomentum(eventId: number): Promise<any> {
  try {
    const data = await sofaFetch(`/event/${eventId}/graph`);
    if (!data) return null;
    const points = data.graphPoints || [];
    if (points.length === 0) return null;

    // Last 10 minutes momentum (positive = home pressure, negative = away pressure)
    const recent = points.slice(-10);
    const avgMomentum = recent.reduce((s: number, p: any) => s + (p.value || 0), 0) / recent.length;
    const lastValue = points[points.length - 1]?.value ?? 0;

    return {
      avg_last_10min: avgMomentum,
      current: lastValue,
      trend: lastValue > avgMomentum ? 'rising' : 'falling',
      points: points.length,
    };
  } catch (e) {
    console.error('[SofaScore] fetchMomentum error:', e);
    return null;
  }
}

function parseNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace('%', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { home, away, eventId: providedId } = await req.json();
    if (!home || !away) {
      return new Response(JSON.stringify({ error: 'home and away required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Cache lookup ───
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
        console.log(`[SofaScore] 🎯 Cache HIT: ${cacheKey}`);
        return new Response(JSON.stringify({ ...cached.response_json, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (e) { console.warn('[SofaScore] cache lookup error:', e); }

    let eventId = providedId as number | null;
    if (!eventId) {
      eventId = await findEvent(home, away);
    }

    if (!eventId) {
      console.log(`[SofaScore] ⚠️ No event found for ${home} vs ${away}`);
      return new Response(JSON.stringify({ found: false, message: 'Event not found on SofaScore' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SofaScore] ✅ Found event ${eventId} for ${home} vs ${away}`);

    const [stats, momentum] = await Promise.all([
      fetchEventStats(eventId),
      fetchMomentum(eventId),
    ]);

    if (!stats) {
      return new Response(JSON.stringify({ found: true, eventId, error: 'Stats unavailable yet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map to standard schema
    const enrichment = {
      source: 'sofascore',
      event_id: eventId,
      xg_home: parseNumber(stats['expectedgoals']?.home),
      xg_away: parseNumber(stats['expectedgoals']?.away),
      possession_home: parseNumber(stats['ballpossession']?.home),
      possession_away: parseNumber(stats['ballpossession']?.away),
      shots_total_home: parseNumber(stats['totalshots']?.home),
      shots_total_away: parseNumber(stats['totalshots']?.away),
      shots_on_target_home: parseNumber(stats['shotsongoal']?.home),
      shots_on_target_away: parseNumber(stats['shotsongoal']?.away),
      shots_off_target_home: parseNumber(stats['shotsofftarget']?.home),
      shots_off_target_away: parseNumber(stats['shotsofftarget']?.away),
      blocked_shots_home: parseNumber(stats['blockedshots']?.home),
      blocked_shots_away: parseNumber(stats['blockedshots']?.away),
      shots_inside_box_home: parseNumber(stats['shotsinsidebox']?.home),
      shots_inside_box_away: parseNumber(stats['shotsinsidebox']?.away),
      big_chances_home: parseNumber(stats['bigchances']?.home),
      big_chances_away: parseNumber(stats['bigchances']?.away),
      big_chances_missed_home: parseNumber(stats['bigchancesmissed']?.home),
      big_chances_missed_away: parseNumber(stats['bigchancesmissed']?.away),
      corners_home: parseNumber(stats['cornerkicks']?.home),
      corners_away: parseNumber(stats['cornerkicks']?.away),
      fouls_home: parseNumber(stats['fouls']?.home),
      fouls_away: parseNumber(stats['fouls']?.away),
      yellow_cards_home: parseNumber(stats['yellowcards']?.home),
      yellow_cards_away: parseNumber(stats['yellowcards']?.away),
      red_cards_home: parseNumber(stats['redcards']?.home),
      red_cards_away: parseNumber(stats['redcards']?.away),
      passes_home: parseNumber(stats['passes']?.home),
      passes_away: parseNumber(stats['passes']?.away),
      pass_accuracy_home: parseNumber(stats['accuratepasses']?.home),
      pass_accuracy_away: parseNumber(stats['accuratepasses']?.away),
      tackles_home: parseNumber(stats['tackles']?.home),
      tackles_away: parseNumber(stats['tackles']?.away),
      momentum,
    };

    console.log(`[SofaScore] 📊 ${home} vs ${away}: xG ${enrichment.xg_home}-${enrichment.xg_away}, BigChances ${enrichment.big_chances_home}-${enrichment.big_chances_away}`);

    const responsePayload = { found: true, ...enrichment };
    // ─── Save to cache ───
    sbAdmin.from('ai_response_cache').upsert({
      function_name: FN_NAME,
      cache_key: cacheKey,
      response_json: responsePayload,
      expires_at: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
      hit_count: 0,
    }, { onConflict: 'cache_key' }).then(() => {}, (e) => console.warn('[SofaScore] cache save:', e));

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[SofaScore] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
