import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";
import { resilientFetch } from "../_shared/resilientFetch.ts";
import { getLiveMatches, getFixtureStats } from "../_shared/liveProvider.ts";
import { getUpcomingFixturesSM } from "../_shared/sportmonks-af-adapter.ts";
import { extractOdds1X2 } from "../_shared/sportmonks.ts";
import { getAllowedLeagueIds } from "../_shared/leaguesRegistry.ts";

// Provedores ao vivo: Futodds (primário) + Sportmonks (fallback). API-Football REMOVIDA em 16/05/2026.
// O env só altera a ordem entre Futodds e Sportmonks; a cadeia é fixa nesses dois.
const LIVE_PROVIDER_PRIMARY = (Deno.env.get("LIVE_PROVIDER_PRIMARY") || "futodds").toLowerCase();

// Hard wall-clock budget for the entire invocation. Anything not started by
// this point gets enqueued to mycroft_analysis_queue for the background worker.
const RUN_BUDGET_MS = 90_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// API_FOOTBALL removida em Fase 2 (18/05/2026) — Futodds + Sportmonks cobrem live scores.
const LIVE_STATUS_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_STATUS_SHORTS = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);
const STALE_FINISH_GRACE_MS = 5 * 60 * 1000;

// === Performance tuning ===
const STATS_CONCURRENCY = 8;          // parallel fixture-stats requests
const ANALYSIS_CONCURRENCY = 4;       // parallel Mycroft analyses

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        // capture but continue
        results[i] = undefined as unknown as R;
        console.warn('[FetchLive] worker item failed:', e);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// Whitelist de ligas: agora vem da tabela public.trader_leagues
// (gerenciada via /admin/trader-leagues). Mantemos apenas IDs sempre bloqueados.
const LIGAS_BLOQUEADAS: number[] = [
  667, // Amistosos clubes
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getFixtureLifecycleStatus(shortStatus: string | null | undefined): 'live' | 'finished' | 'scheduled' {
  const normalized = String(shortStatus || '').toUpperCase();
  if (LIVE_STATUS_SHORTS.has(normalized)) return 'live';
  if (FINISHED_STATUS_SHORTS.has(normalized)) return 'finished';
  return 'scheduled';
}

function isRecentlyUpdated(updatedAt: string | null | undefined, graceMs = STALE_FINISH_GRACE_MS): boolean {
  if (!updatedAt) return false;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < graceMs;
}

interface FixtureStats {
  attacks_home: number;
  attacks_away: number;
  dangerous_attacks_home: number;
  dangerous_attacks_away: number;
  possession_home: number;
  possession_away: number;
  shots_home: number;
  shots_away: number;
  shots_total_home: number;
  shots_total_away: number;
  shots_on_target_home: number;
  shots_on_target_away: number;
  xG_home: number;
  xG_away: number;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // API-Football REMOVIDA. Apenas Futodds + Sportmonks via liveProvider.
    const supabase = getSupabaseAdmin();

    const tStartRun = performance.now();
    const isOverBudget = () => performance.now() - tStartRun > RUN_BUDGET_MS;

    // 1. Fetch all live matches — cadeia Futodds → Sportmonks (sem API-Football)
    let allFixtures: any[] = [];
    let providerUsed: string = "futodds";
    let providerFallbackReason: string | undefined;
    try {
      const lr = await getLiveMatches();
      allFixtures = lr.fixtures;
      providerUsed = lr.source;
      providerFallbackReason = lr.fallback_reason;
      console.log(`[FetchLive] provider=${providerUsed} count=${allFixtures.length}${providerFallbackReason ? ` fallback=${providerFallbackReason}` : ''}`);
    } catch (e) {
      console.error('[FetchLive] liveProvider falhou:', (e as Error).message);
      return new Response(
        JSON.stringify({ error: `live providers failed: ${(e as Error).message}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[FetchLive] Found ${allFixtures.length} total live matches via ${providerUsed}`);

    // 1b. Filtrar apenas ligas permitidas (registry dinâmico)
    // Futodds usa league_id BetsAPI (não compatível com API-Football),
    // então fazemos fallback por nome contra trader_leagues quando id não bate.
    const allowedIds = await getAllowedLeagueIds();
    const { getLeagues } = await import("../_shared/leaguesRegistry.ts");
    const allowedRows = await getLeagues();
    const normName = (s: string) => String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const allowedNameSet = new Set(allowedRows.map(r => normName(r.name)));
    const fixtures = allFixtures.filter((f: any) => {
      const leagueId = f.league?.id;
      if (typeof leagueId === "number" && allowedIds.has(leagueId) && !LIGAS_BLOQUEADAS.includes(leagueId)) {
        return true;
      }
      // Fallback Futodds: match por nome de liga
      const ln = normName(f.league?.name || "");
      if (!ln) return false;
      if (allowedNameSet.has(ln)) return true;
      // Match parcial (inclusão) para variações como "Brazilian Serie A" vs "Serie A"
      for (const allowed of allowedNameSet) {
        if (allowed.length >= 6 && (ln.includes(allowed) || allowed.includes(ln))) return true;
      }
      return false;
    });

    console.log(`[FetchLive] ✅ ${fixtures.length}/${allFixtures.length} jogos passaram no filtro de ligas`);

    // Log de auditoria do filtro
    try {
      await supabase.from('cron_logs').insert({
        tipo: 'filtro_ligas',
        total_recebidos: allFixtures.length,
        total_filtrados: fixtures.length,
        ligas_encontradas: [...new Set(fixtures.map((f: any) => `${f.league.id}: ${f.league.name}`))],
      });
    } catch (logErr) {
      console.warn('[FetchLive] Falha ao gravar log de filtro:', logErr);
    }

    const tStart = performance.now();

    // 2a. BATCH preload existing rows in a single query (avoid N selects)
    const allFixtureIds = fixtures.map((f: any) => String(f.fixture.id));
    const existingMap = new Map<string, { mycroft_status: string | null; mycroft_analysis_id: string | null }>();
    if (allFixtureIds.length > 0) {
      const { data: existingRows } = await supabase
        .from('live_matches')
        .select('match_id, mycroft_status, mycroft_analysis_id')
        .in('match_id', allFixtureIds);
      for (const r of existingRows || []) {
        existingMap.set(r.match_id, {
          mycroft_status: r.mycroft_status,
          mycroft_analysis_id: r.mycroft_analysis_id,
        });
      }
    }

    // 2b. PARALLEL fetch of fixture stats (cached + concurrency-limited)
    const liveFixtures = fixtures.filter((f: any) =>
      getFixtureLifecycleStatus(f.fixture.status?.short ?? 'LIVE') === 'live'
    );
    const statsResults = await runWithConcurrency(
      liveFixtures,
      STATS_CONCURRENCY,
      async (f: any) => {
        const r = await getFixtureStats({ sm_id: f.fixture.sm_id, raw: f._raw, _source: f._source });
        if (!r.stats) return null;
        const s: any = r.stats;
        return {
          attacks_home: s.attacks_home,
          attacks_away: s.attacks_away,
          // Usar dangerous_attacks reais do adapter; só cair em attacks se realmente faltar
          dangerous_attacks_home: (s.dangerous_attacks_home ?? 0) > 0 ? s.dangerous_attacks_home : (s.attacks_home ?? 0),
          dangerous_attacks_away: (s.dangerous_attacks_away ?? 0) > 0 ? s.dangerous_attacks_away : (s.attacks_away ?? 0),
          possession_home: s.possession_home,
          possession_away: s.possession_away,
          shots_home: s.shots_on_target_home,
          shots_away: s.shots_on_target_away,
          shots_total_home: s.shots_total_home,
          shots_total_away: s.shots_total_away,
          shots_on_target_home: s.shots_on_target_home,
          shots_on_target_away: s.shots_on_target_away,
          xG_home: s.xG_home ?? 0,
          xG_away: s.xG_away ?? 0,
          _source: r.source,
        } as any;
      },
    );
    const statsMap = new Map<string, FixtureStats | null>();
    liveFixtures.forEach((f: any, i: number) => {
      statsMap.set(String(f.fixture.id), statsResults[i] ?? null);
    });
    console.log(`[FetchLive] ⏱️ stats batch: ${liveFixtures.length} fixtures in ${Math.round(performance.now() - tStart)}ms`);

    // 2c. Build payloads + BATCH upsert in chunks (much faster than N upserts)
    const upsertPayloads: any[] = [];
    type FixtureCtx = {
      fixtureId: string;
      matchData: any;
      stats: FixtureStats | null;
      lifecycleStatus: 'live' | 'finished' | 'scheduled';
      minute: number;
      period: string;
      championship: string;
    };
    const ctxList: FixtureCtx[] = [];

    for (const fixture of fixtures) {
      const fixtureId = String(fixture.fixture.id);
      const minute = fixture.fixture.status?.elapsed ?? 0;
      const period = fixture.fixture.status?.long ?? 'Unknown';
      const championship = fixture.league?.name ?? 'Unknown';
      const apiShortStatus = fixture.fixture.status?.short ?? 'LIVE';
      const lifecycleStatus = getFixtureLifecycleStatus(apiShortStatus);

      const matchData = {
        match_id: fixtureId,
        home_team: fixture.teams.home.name,
        away_team: fixture.teams.away.name,
        home_logo: fixture.teams.home.logo || null,
        away_logo: fixture.teams.away.logo || null,
        score_home: fixture.goals.home ?? 0,
        score_away: fixture.goals.away ?? 0,
        minute,
        period,
        championship,
        status: lifecycleStatus,
        updated_at: new Date().toISOString(),
      };

      // Odds 1X2 ao vivo (Sportmonks)
      let oddsLive: any = null;
      if (fixture._source === 'sportmonks' && fixture._raw && lifecycleStatus === 'live') {
        try {
          oddsLive = extractOdds1X2(fixture._raw);
        } catch (e) {
          console.warn(`[FetchLive] odds extract fail ${fixtureId}: ${(e as Error)?.message}`);
        }
      }

      const stats = lifecycleStatus === 'live' ? statsMap.get(fixtureId) ?? null : null;
      const existing = existingMap.get(fixtureId);

      const upsertData: any = {
        ...matchData,
        stats: stats || { attacks_home: 0, attacks_away: 0, possession_home: 0, possession_away: 0, shots_home: 0, shots_away: 0 },
      };
      if (oddsLive) upsertData.odds_live = oddsLive;
      if (existing) {
        upsertData.mycroft_status = existing.mycroft_status;
        upsertData.mycroft_analysis_id = existing.mycroft_analysis_id;
      }
      upsertPayloads.push(upsertData);
      ctxList.push({ fixtureId, matchData, stats, lifecycleStatus, minute, period, championship });
    }

    // Batched upsert (chunks of 100)
    const CHUNK = 100;
    for (let i = 0; i < upsertPayloads.length; i += CHUNK) {
      const slice = upsertPayloads.slice(i, i + CHUNK);
      const { error: upErr } = await supabase
        .from('live_matches')
        .upsert(slice, { onConflict: 'match_id' });
      if (upErr) console.warn('[FetchLive] batch upsert error:', upErr.message);
    }
    console.log(`[FetchLive] ⏱️ upsert batch done at ${Math.round(performance.now() - tStart)}ms`);

    // 2d. PARALLEL Mycroft analyses (concurrency-limited) — with hard time budget.
    // If we're over RUN_BUDGET_MS, we stop processing inline and ENQUEUE the rest
    // into mycroft_analysis_queue so the background worker picks them up.
    const reanalyzableStatuses = ['aguardar', 'jogo_morto', 'cuidado'];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const analysisCandidates = ctxList.filter((c) => {
      const existing = existingMap.get(c.fixtureId);
      return c.lifecycleStatus === 'live' && c.minute >= 20 && c.stats &&
        (!existing?.mycroft_analysis_id || reanalyzableStatuses.includes(existing?.mycroft_status as string));
    });

    let analyzedCount = 0;
    let enqueuedCount = 0;
    const results: any[] = ctxList.map((c) => ({
      match_id: c.fixtureId,
      teams: `${c.matchData.home_team} vs ${c.matchData.away_team}`,
      minute: c.minute,
      has_stats: !!c.stats,
      analyzed: false,
      verdict: undefined as string | undefined,
      status: c.lifecycleStatus,
    }));
    const indexById = new Map(ctxList.map((c, i) => [c.fixtureId, i]));

    const buildPayload = (c: FixtureCtx) => ({
      match: {
        home: c.matchData.home_team,
        away: c.matchData.away_team,
        scoreHome: c.matchData.score_home,
        scoreAway: c.matchData.score_away,
        minute: c.minute,
        period: c.period,
        championship: c.championship,
        match_id: c.fixtureId,
        stats: c.stats,
        bankroll: 500,
      },
    });

    const enqueueOverflow = async (items: FixtureCtx[]) => {
      if (!items.length) return;
      // ON CONFLICT DO NOTHING via partial unique index — silently dedupes.
      const rows = items.map((c) => ({
        match_id: c.fixtureId,
        payload: buildPayload(c),
      }));
      const { error } = await supabase.from('mycroft_analysis_queue').insert(rows);
      if (error && !/duplicate|unique/i.test(error.message)) {
        console.warn('[FetchLive] enqueue error:', error.message);
      } else {
        enqueuedCount += rows.length;
        console.log(`[FetchLive] 📥 enqueued ${rows.length} analyses (over budget)`);
      }
    };

    await runWithConcurrency(analysisCandidates, ANALYSIS_CONCURRENCY, async (c, idx) => {
      // Hard budget: enqueue this one and skip inline processing.
      if (isOverBudget()) {
        await enqueueOverflow([c]);
        return;
      }
      try {
        const analysisRes = await resilientFetch(`${supabaseUrl}/functions/v1/mycroft-sports-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
          body: JSON.stringify(buildPayload(c)),
          retries: 2,
          timeoutMs: 25_000,
          breakerKey: 'mycroft-sports-analysis',
        });
        if (!analysisRes.ok) {
          console.warn(`[FetchLive] Mycroft fail ${c.fixtureId}: ${analysisRes.status} — enqueueing`);
          await enqueueOverflow([c]);
          return;
        }
        const analysis = await analysisRes.json();
        const { data: analysisRow } = await supabase.from('mycroft_analyses').insert({
          match_id: c.fixtureId,
          verdict: analysis.verdict || 'AGUARDAR',
          market: analysis.market || 'N/A',
          thesis: analysis.thesis || '',
          odd: analysis.odd ?? null,
          confidence: analysis.confidence ?? 0,
          risk_management: analysis.risk_management ?? null,
          alerts: analysis.alerts ?? [],
          fundamentation: analysis.fundamentation ?? { stats: c.stats },
        }).select('id').single();
        if (analysisRow) {
          const statusToSet =
            analysis.verdict === 'AGUARDAR' ? 'aguardar' :
            analysis.verdict === 'JOGO_MORTO' ? 'jogo_morto' :
            analysis.verdict === 'CUIDADO' ? 'cuidado' : 'done';
          await supabase.from('live_matches').update({
            mycroft_analysis_id: analysisRow.id,
            mycroft_status: statusToSet,
            updated_at: new Date().toISOString(),
          }).eq('match_id', c.fixtureId);
          if (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL') {
            await supabase.from('signals_sent').insert({
              match_id: c.fixtureId,
              analysis_id: analysisRow.id,
            });
          }
        }
        analyzedCount++;
        const idxR = indexById.get(c.fixtureId);
        if (idxR !== undefined) {
          results[idxR].analyzed = true;
          results[idxR].verdict = analysis.verdict;
        }
      } catch (e) {
        const isCircuit = (e as any)?.code === 'CIRCUIT_OPEN';
        console.error(`[FetchLive] Mycroft error ${c.fixtureId}${isCircuit ? ' (circuit open)' : ''}:`, (e as Error)?.message);
        // Fall back to queue so the worker retries later.
        await enqueueOverflow([c]);
      }
    });
    console.log(`[FetchLive] ⏱️ analyses done at ${Math.round(performance.now() - tStart)}ms (inline=${analyzedCount}, enqueued=${enqueuedCount}/${analysisCandidates.length})`);

    // 6. Mark matches no longer live as 'finished' only after grace period to avoid API snapshot flicker
    const liveMatchIds = fixtures.map((f: any) => String(f.fixture.id));
    const { data: currentLive } = await supabase
      .from('live_matches')
      .select('match_id, updated_at, minute, status')
      .eq('status', 'live');

    const staleRows = (currentLive || []).filter((match: any) => {
      if (liveMatchIds.includes(match.match_id)) return false;
      return !isRecentlyUpdated(match.updated_at);
    });

    const staleIds = staleRows.map((m: any) => m.match_id);
    const skippedRecentIds = (currentLive || [])
      .filter((match: any) => !liveMatchIds.includes(match.match_id) && isRecentlyUpdated(match.updated_at))
      .map((m: any) => m.match_id);

    if (skippedRecentIds.length > 0) {
      console.log(`[FetchLive] Grace period active, keeping ${skippedRecentIds.length} jogos ao vivo temporariamente: ${skippedRecentIds.join(', ')}`);
    }

    if (staleIds.length > 0) {
      await supabase
        .from('live_matches')
        .update({ status: 'finished', updated_at: new Date().toISOString() })
        .in('match_id', staleIds);
      console.log(`[FetchLive] Marked ${staleIds.length} matches as finished after grace period`);
    }

    // 7. Fetch today's scheduled fixtures — gated to wall-clock minute % 15 === 0.
    // Antes: throttle in-memory `lastScheduledFetchAt` não funcionava (cron = isolate novo a cada execução).
    // Agora: o fetch só roda 4x por hora (00, 15, 30, 45) — corta ~93% do IO de scheduled_games.
    let scheduledCount = 0;
    const nowMin = new Date().getUTCMinutes();
    const schedShouldRun = !isOverBudget() && (nowMin % 15 === 0);
    if (!schedShouldRun) {
      console.log(`[FetchLive] ⏭️ Scheduled fetch skipped (${isOverBudget() ? 'over budget' : `gate: minute=${nowMin}`})`);
    }
    if (schedShouldRun) try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`[FetchLive] Fetching scheduled fixtures for ${today}...`);
      const allowedLeagueIds = Array.from(allowedIds).filter((id) => !LIGAS_BLOQUEADAS.includes(id));
      const schedFixtures = await getUpcomingFixturesSM(allowedLeagueIds, 36);
      console.log(`[FetchLive] Found ${schedFixtures.length} scheduled fixtures via Sportmonks`);

      const schedPayloads: any[] = [];
      for (const fix of schedFixtures) {
        const fixtureDate = new Date(fix.fixture.date);
        const matchDate = fixtureDate.toISOString().split('T')[0];
        const matchTime = fixtureDate.toTimeString().slice(0, 5);
        const checkTime = new Date(fixtureDate.getTime() - 15 * 60000).toISOString();

        const leagueName = fix.league?.name || 'Unknown';
        const homeTeam = fix.teams?.home?.name || 'TBD';
        const awayTeam = fix.teams?.away?.name || 'TBD';
        const eventId = String(fix.fixture.id);
        const fixtureStatus = fix.fixture.status?.short || 'NS';

        const leagueLower = leagueName.toLowerCase();
        let relevance = 1;
        if (leagueLower.includes('brasileir') || leagueLower.includes('premier') || leagueLower.includes('champions')) relevance = 5;
        else if (leagueLower.includes('la liga') || leagueLower.includes('bundesliga') || leagueLower.includes('serie a') || leagueLower.includes('ligue 1')) relevance = 4;
        else if (leagueLower.includes('copa') || leagueLower.includes('libertadores')) relevance = 4;
        else if (leagueLower.includes('serie b') || leagueLower.includes('championship')) relevance = 3;
        else relevance = 2;

        let gameStatus = 'scheduled';
        if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(fixtureStatus)) gameStatus = 'live';
        else if (['FT', 'AET', 'PEN'].includes(fixtureStatus)) gameStatus = 'finished';

        schedPayloads.push({
          match_date: matchDate,
          match_time: matchTime,
          match_datetime: fixtureDate.toISOString(),
          league_name: leagueName,
          home_team: homeTeam,
          away_team: awayTeam,
          event_id: eventId,
          match_id: eventId,
          status: gameStatus,
          check_time: checkTime,
          relevance_score: relevance,
          updated_at: new Date().toISOString(),
        });
      }

      const SCHED_CHUNK = 200;
      for (let i = 0; i < schedPayloads.length; i += SCHED_CHUNK) {
        const slice = schedPayloads.slice(i, i + SCHED_CHUNK);
        const { error: upsertErr } = await supabase
          .from('scheduled_games')
          .upsert(slice, {
            onConflict: 'match_date,match_time,home_team,away_team',
            ignoreDuplicates: true,
          });
        if (!upsertErr) scheduledCount += slice.length;
        else console.warn('[FetchLive] sched batch insert error:', upsertErr.message);
      }
      console.log(`[FetchLive] Saved ${scheduledCount} scheduled games (batched)`);
    } catch (schedErr) {
      console.error('[FetchLive] Scheduled games fetch error:', schedErr);
    }

    console.log(`[FetchLive] Done: ${fixtures.length} matches synced, ${staleIds.length} finished, ${scheduledCount} scheduled, ${enqueuedCount} enqueued (run=${Math.round(performance.now() - tStartRun)}ms)`);

    return new Response(
      JSON.stringify({
        ok: true,
        total_matches: fixtures.length,
        analyzed: analyzedCount,
        enqueued: enqueuedCount,
        finished: staleIds.length,
        scheduled: scheduledCount,
        run_ms: Math.round(performance.now() - tStartRun),
        matches: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[FetchLive] Error:', error);
    await logEdgeError("fetch-live-matches", error).catch(() => {});
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
