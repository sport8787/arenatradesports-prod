import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";
import { getLiveMatches, getFixtureStats } from "../_shared/liveProvider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// API-Football removida em Fase 2 (18/05/2026). Provedores: Futodds (primário) + Sportmonks (fallback).
const LIVE_PROVIDER_PRIMARY = (Deno.env.get("LIVE_PROVIDER_PRIMARY") || "futodds").toLowerCase();

// Whitelist de ligas permitidas (mesma do fetch-live-matches)
const LIGAS_PERMITIDAS: Record<number, string> = {
  // Europa — Top 5 + segundas divisões
  39:  "Premier League",
  40:  "Championship (Inglaterra — 2ª divisão)",
  140: "La Liga",
  135: "Serie A",
  136: "Serie B (Itália)",
  78:  "Bundesliga",
  79:  "2. Bundesliga",
  61:  "Ligue 1",
  // Europa — Primeiras divisões relevantes
  94:  "Primeira Liga (Portugal)",
  88:  "Eredivisie",
  144: "Pro League (Bélgica)",
  197: "Super League (Grécia)",
  203: "Süper Lig (Turquia)",
  // UEFA Competições
  2:   "Champions League",
  3:   "Europa League",
  848: "Conference League",
  // América do Sul
  13:  "Libertadores",
  11:  "Sul-Americana",
  71:  "Brasileirão Série A",
  72:  "Brasileirão Série B",
  73:  "Brasileirão Série C",
  75:  "Copa Do Brasil",
  76:  "Copa do Nordeste",
  529: "Copa do Norte",
  530: "Copa Verde",
  531: "Copa Paulista",
  532: "Copa Espírito Santo",
  533: "Copa Rio",
  128: "Liga Profesional Argentina",
  238: "Argentine Primera División",
  253: "MLS",
  10:  "Amistosos Internacionais (Seleções)",
  32:  "Eliminatórias Copa do Mundo - Europa",
  // Feminino — Principais ligas
  746: "UEFA Women's Champions League",
  766: "WSL (Inglaterra Feminino)",
  770: "Frauen-Bundesliga (Alemanha Feminino)",
  764: "NWSL (EUA Feminino)",
  1382: "Brasileirão Feminino",
};

const LIGAS_BLOQUEADAS: number[] = [667, 668];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Extract statistics from the API response for a fixture
async function fetchFixtureStats(fixtureId: string, apiKey: string): Promise<any> {
  try {
    const res = await fetch(`${API_FOOTBALL_URL}/fixtures/statistics?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const teams = data.response || [];
    if (teams.length < 2) return null;

    const home = teams[0]?.statistics || [];
    const away = teams[1]?.statistics || [];

    const getStat = (arr: any[], type: string) => {
      const found = arr.find((s: any) => s.type === type);
      return found?.value ?? null;
    };

    const parsePossession = (val: any) => {
      if (val == null) return 0;
      return parseInt(String(val).replace('%', '')) || 0;
    };

    return {
      possession_home: parsePossession(getStat(home, 'Ball Possession')),
      possession_away: parsePossession(getStat(away, 'Ball Possession')),
      shots_total_home: getStat(home, 'Total Shots') ?? 0,
      shots_total_away: getStat(away, 'Total Shots') ?? 0,
      shots_on_target_home: getStat(home, 'Shots on Goal') ?? 0,
      shots_on_target_away: getStat(away, 'Shots on Goal') ?? 0,
      attacks_home: getStat(home, 'Dangerous Attacks') ?? getStat(home, 'Shots insidebox') ?? 0,
      attacks_away: getStat(away, 'Dangerous Attacks') ?? getStat(away, 'Shots insidebox') ?? 0,
      corners_home: getStat(home, 'Corner Kicks') ?? 0,
      corners_away: getStat(away, 'Corner Kicks') ?? 0,
      fouls_home: getStat(home, 'Fouls') ?? 0,
      fouls_away: getStat(away, 'Fouls') ?? 0,
      cards_home: (getStat(home, 'Yellow Cards') ?? 0) + (getStat(home, 'Red Cards') ?? 0),
      cards_away: (getStat(away, 'Yellow Cards') ?? 0) + (getStat(away, 'Red Cards') ?? 0),
      passes_home: getStat(home, 'Total passes') ?? 0,
      passes_away: getStat(away, 'Total passes') ?? 0,
      passes_accurate_home: getStat(home, 'Passes accurate') ?? 0,
      passes_accurate_away: getStat(away, 'Passes accurate') ?? 0,
      xG_home: parseFloat(getStat(home, 'expected_goals') || '0') || null,
      xG_away: parseFloat(getStat(away, 'expected_goals') || '0') || null,
    };
  } catch (e) {
    console.error(`[LiveScores] Stats fetch error for ${fixtureId}:`, e);
    return null;
  }
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

    // 1. Fetch all live fixtures — provedor controlado por env
    let allFixtures: any[] = [];
    let providerUsed = "api-football";
    if (LIVE_PROVIDER_PRIMARY === "sportmonks" || LIVE_PROVIDER_PRIMARY === "futodds") {
      const lr = await getLiveMatches();
      allFixtures = lr.fixtures;
      providerUsed = lr.source;
      console.log(`[LiveScores] provider=${providerUsed} count=${allFixtures.length}${lr.fallback_reason ? ` fallback=${lr.fallback_reason}` : ''}`);
    } else {
      console.log('[LiveScores] Fetching live fixtures (legacy mode)...');
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
      allFixtures = data.response || [];
    }
    
    // Filtrar apenas ligas permitidas
    // ⚠️ Futodds usa league_id do BetsAPI (espaço diferente da API-Football).
    // Quando o provider for futodds, filtramos por NOME da liga (whitelist).
    const isFutodds = providerUsed === "futodds";
    const allowedNames = Object.values(LIGAS_PERMITIDAS).map((n) => n.toLowerCase());
    const matchesWhitelistByName = (name?: string) => {
      if (!name) return false;
      const lc = name.toLowerCase();
      return allowedNames.some((n) => {
        const base = n.split("(")[0].trim().split("—")[0].trim();
        return base.length >= 4 && (lc.includes(base) || base.includes(lc));
      });
    };

    const fixtures = allFixtures.filter((f: any) => {
      const leagueId = f.league?.id;
      const leagueName = f.league?.name;
      if (isFutodds) {
        // Para futodds: aceita por nome OU se houver match_id já vivo no DB (deixa o downstream decidir).
        return matchesWhitelistByName(leagueName);
      }
      return leagueId in LIGAS_PERMITIDAS && !LIGAS_BLOQUEADAS.includes(leagueId);
    });
    console.log(`[LiveScores] ✅ ${fixtures.length}/${allFixtures.length} jogos após filtro de ligas (provider=${providerUsed})`);

    if (fixtures.length === 0) {
      // 🛡️ Guarda anti-wipe: só marca como finished se o provider REALMENTE retornou 0 jogos ao vivo.
      // Se allFixtures > 0, é só mismatch de filtro (ex: futodds com IDs diferentes) — não apagar dashboard.
      if (allFixtures.length === 0) {
        const { data: staleLive } = await supabase
          .from('live_matches')
          .select('match_id')
          .eq('status', 'live');

        if (staleLive && staleLive.length > 0) {
          await supabase
            .from('live_matches')
            .update({ status: 'finished', updated_at: new Date().toISOString() })
            .eq('status', 'live');
          console.log(`[LiveScores] Marked ${staleLive.length} stale matches as finished`);
        }

        return new Response(
          JSON.stringify({ updated: 0, finished: staleLive?.length || 0, stats_fetched: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[LiveScores] ⚠️ filtro vazio mas provider retornou ${allFixtures.length} jogos — preservando dashboard.`);
      return new Response(
        JSON.stringify({ updated: 0, finished: 0, stats_fetched: 0, note: "filter-empty-preserved" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const liveFixtureIds = new Set(fixtures.map((f: any) => String(f.fixture.id)));

    // 2. Get matches in DB that need stats refresh
    //    - Sem análise ainda (>=15 min) → primeira coleta
    //    - Com análise (>=15 min) → refresh para manter xG/momentum atualizados
    //      (a SofaScore preenche xG quando a API-Football retorna null)
    const { data: liveInDb } = await supabase
      .from('live_matches')
      .select('match_id, mycroft_analysis_id, stats, updated_at')
      .eq('status', 'live')
      .gte('minute', 15);

    const needsStatsSet = new Set<string>();
    const needsEnrichSet = new Set<string>();
    const now = Date.now();
    for (const m of liveInDb || []) {
      // Stats completas API-Football: só se ainda não tem análise (economia)
      if (!m.mycroft_analysis_id) needsStatsSet.add(m.match_id);
      // Enrichment SofaScore: sempre que xG ainda for null/0 OU faz mais de 90s desde último update
      const xg = (m.stats as any)?.xG_home;
      const lastUpdate = m.updated_at ? new Date(m.updated_at).getTime() : 0;
      const stale = now - lastUpdate > 90_000;
      if (xg == null || xg === 0 || stale) needsEnrichSet.add(m.match_id);
    }

    // 3. Update scores + fetch stats in parallel batches
    let updated = 0;
    let statsFetched = 0;

    // Process in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < fixtures.length; i += batchSize) {
      const batch = fixtures.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (fixture: any) => {
        const fixtureId = String(fixture.fixture.id);
        const minute = fixture.fixture.status?.elapsed ?? 0;
        const period = fixture.fixture.status?.long ?? 'Unknown';
        const scoreHome = fixture.goals.home ?? 0;
        const scoreAway = fixture.goals.away ?? 0;
        const statusShort = fixture.fixture.status?.short ?? '';

        let matchStatus = 'live';
        if (['FT', 'AET', 'PEN'].includes(statusShort)) {
          matchStatus = 'finished';
        } else if (['HT'].includes(statusShort)) {
          matchStatus = 'halftime';
        }

        const updatePayload: any = {
          score_home: scoreHome,
          score_away: scoreAway,
          minute,
          period,
          status: matchStatus,
          updated_at: new Date().toISOString(),
        };

        // Fetch full stats — Futodds (_futodds_stats inline) → Sportmonks (_raw) → API-Football
        if (needsStatsSet.has(fixtureId) && minute >= 15) {
          let stats: any = null;
          if (fixture._source === 'futodds' && fixture._futodds_stats) {
            stats = {
              ...fixture._futodds_stats,
              source: 'futodds',
            };
          } else if (fixture._source === 'sportmonks') {
            const r = await getFixtureStats({ sm_id: fixture.fixture.sm_id, raw: fixture._raw, af_id: fixtureId });
            stats = r.stats ? { ...r.stats } : null;
          }
          if (!stats) {
            stats = await fetchFixtureStats(fixtureId, apiKey);
          }
          if (stats) {
            updatePayload.stats = stats;
            statsFetched++;
            console.log(`[LiveScores] Stats ${fixtureId} (src=${stats.source || 'api-football'}): Poss ${stats.possession_home}-${stats.possession_away}, Pressure ${stats.pressure_home ?? '-'}/${stats.pressure_away ?? '-'}`);
          }
        }

        // SofaScore enrichment — runs INDEPENDENTLY of stats fetch.
        // Critical for xG: API-Football returns null in ~95% of matches; SofaScore is the fallback.
        if (needsEnrichSet.has(fixtureId) && minute >= 15) {
          try {
            const homeName = fixture.teams?.home?.name;
            const awayName = fixture.teams?.away?.name;
            if (homeName && awayName) {
              const sofaRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sofascore-live-stats`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({ home: homeName, away: awayName }),
              });
              if (sofaRes.ok) {
                const sofa = await sofaRes.json();
                if (sofa.found) {
                  // Merge into existing stats (or fetch current row if no new stats this cycle)
                  let baseStats = updatePayload.stats;
                  if (!baseStats) {
                    const { data: row } = await supabase
                      .from('live_matches')
                      .select('stats')
                      .eq('match_id', fixtureId)
                      .maybeSingle();
                    baseStats = (row?.stats as any) || {};
                  }
                  if (sofa.xg_home != null) baseStats.xG_home = sofa.xg_home;
                  if (sofa.xg_away != null) baseStats.xG_away = sofa.xg_away;
                  if (sofa.big_chances_home != null) baseStats.big_chances_home = sofa.big_chances_home;
                  if (sofa.big_chances_away != null) baseStats.big_chances_away = sofa.big_chances_away;
                  if (sofa.shots_inside_box_home != null) baseStats.shots_inside_box_home = sofa.shots_inside_box_home;
                  if (sofa.shots_inside_box_away != null) baseStats.shots_inside_box_away = sofa.shots_inside_box_away;
                  if (sofa.momentum) baseStats.momentum = sofa.momentum;
                  baseStats.sofascore_event_id = sofa.event_id;
                  updatePayload.stats = baseStats;
                  console.log(`[LiveScores] 🔥 SofaScore enriched ${fixtureId}: xG ${sofa.xg_home}-${sofa.xg_away}, BigChances ${sofa.big_chances_home}-${sofa.big_chances_away}`);
                } else {
                  console.log(`[LiveScores] ⚠️ SofaScore não encontrou ${homeName} vs ${awayName}`);
                }
              } else {
                console.warn(`[LiveScores] SofaScore HTTP ${sofaRes.status} para ${fixtureId}`);
              }
            }
          } catch (sofaErr) {
            console.warn(`[LiveScores] SofaScore enrichment failed for ${fixtureId}:`, sofaErr);
          }
        }

        const { error } = await supabase
          .from('live_matches')
          .update(updatePayload)
          .eq('match_id', fixtureId);

        if (!error) updated++;
      }));
    }

    // 4. Mark finished — duas condições:
    //    (a) AGGRESSIVO: jogo sumiu da lista live atual da API E último minute conhecido ≥ 88
    //        → foi para FT mesmo sem capturarmos o status FT explicitamente. Sem esperar 10 min,
    //        evitando o bug "AO VIVO 90' há +5 min" no dashboard.
    //    (b) SAFETY NET: jogo sumiu da API e está sem update há >10 min (cobertura geral).
    const { data: currentLive } = await supabase
      .from('live_matches')
      .select('match_id, updated_at, minute')
      .eq('status', 'live');

    let finished = 0;
    if (currentLive && currentLive.length > 0) {
      const TEN_MIN_AGO_MS = Date.now() - 10 * 60 * 1000;
      const TWO_MIN_MS = 2 * 60 * 1000;
      const TEN_MIN_MS = 10 * 60 * 1000;
      const toFinish: string[] = [];

      for (const m of currentLive as any[]) {
        if (liveFixtureIds.has(m.match_id)) continue; // ainda na lista live → mantém
        const ageMs = m.updated_at ? Date.now() - new Date(m.updated_at).getTime() : Infinity;
        const minute = Number(m.minute ?? 0);

        // (a) Jogo claramente acabou: minute ≥ 88 e sumiu da API há ≥ 2 min
        if (minute >= 88 && ageMs >= TWO_MIN_MS) {
          toFinish.push(m.match_id);
          continue;
        }
        // (b) Safety: parado há >10 min
        if (ageMs >= TEN_MIN_MS) {
          toFinish.push(m.match_id);
        }
      }

      if (toFinish.length > 0) {
        const { error: finishErr } = await supabase
          .from('live_matches')
          .update({ status: 'finished', updated_at: new Date().toISOString() })
          .in('match_id', toFinish);

        if (!finishErr) {
          finished = toFinish.length;
          console.log(`[LiveScores] 🏁 Finalizados ${finished}: ${toFinish.join(', ')}`);
        }
      }
    }

    console.log(`[LiveScores] Updated ${updated} scores, ${statsFetched} stats fetched, ${finished} stale finished`);

    return new Response(
      JSON.stringify({ updated, finished, stats_fetched: statsFetched, total_live: fixtures.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[LiveScores] Error:', e);
    await logEdgeError("update-live-scores", e).catch(() => {});
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
