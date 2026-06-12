// capture-prelive-odds — Captura snapshots de odds Betfair pré-live em dois momentos:
//   "opening"  → primeira captura quando o jogo é detectado (linha de abertura)
//   "closing"  → ≤60min antes do kickoff (linha de fechamento para CLV real)
// Acionado por cron a cada 30min. Modo "auto" decide qual snapshot capturar.
//
// Mercados capturados: MATCH_ODDS, OVER_UNDER_25, OVER_UNDER_35, BOTH_TEAMS_TO_SCORE
// Fonte: Futodds /matches-betfair-upcoming + /matches-betfair-prelive-odds

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFutoddsUpcoming, getFutoddsPreliveOdds, isFutoddsDisabled } from "../_shared/futoddsProvider.ts";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARKETS_TO_CAPTURE = ["MATCH_ODDS", "OVER_UNDER_25", "OVER_UNDER_35", "BOTH_TEAMS_TO_SCORE"];
// Captura closing quando kickoff está ≤ esta janela (minutos)
const CLOSING_WINDOW_MINUTES = 60;
// Concorrência máxima ao chamar prelive-odds
const BATCH_SIZE = 5;

function sleepMs(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function normTeam(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

/** Extrai mid_odd, fair_prob e total_matched de um runner. */
function extractRunnerQuote(runner: any): { back: number | null; lay: number | null; mid: number | null; fair: number | null; matched: number | null } {
  const back = runner?.back_odds?.[0]?.price ?? null;
  const lay = runner?.lay_odds?.[0]?.price ?? null;
  const mid = (back != null && lay != null) ? (back + lay) / 2 : (back ?? lay);
  const fair = mid ? 1 / mid : null;
  const matched = runner?.total_matched ?? null;
  return {
    back: back != null ? +back : null,
    lay: lay != null ? +lay : null,
    mid: mid != null ? +Number(mid).toFixed(3) : null,
    fair: fair != null ? +Number(fair).toFixed(5) : null,
    matched: matched != null ? +matched : null,
  };
}

/** Salva snapshot de um jogo no banco. Retorna número de runners salvos. */
async function saveSnapshot(
  supabase: any,
  eventId: string,
  homeTeam: string,
  awayTeam: string,
  leagueName: string,
  eventDate: string,
  snapshotType: "opening" | "midpoint" | "closing",
): Promise<number> {
  let data: any;
  try {
    data = await getFutoddsPreliveOdds(eventId);
  } catch (e) {
    console.warn(`[CapturePrelive] prelive-odds falhou event_id=${eventId}: ${(e as Error).message}`);
    return 0;
  }

  if (!data) return 0;

  const markets: any[] = Array.isArray(data.markets) ? data.markets : [];
  const rows: any[] = [];

  for (const market of markets) {
    const marketType = String(market?.market_type ?? "").toUpperCase();
    if (!MARKETS_TO_CAPTURE.includes(marketType)) continue;

    for (const runner of market?.runners ?? []) {
      if (runner?.status !== "ACTIVE") continue;
      const { back, lay, mid, fair, matched } = extractRunnerQuote(runner);
      if (!mid) continue; // sem liquidez — pula
      rows.push({
        event_id: eventId,
        home_team: homeTeam,
        away_team: awayTeam,
        league_name: leagueName,
        event_date: eventDate,
        market_type: marketType,
        selection: String(runner?.runner_name ?? "unknown"),
        back_odd: back,
        lay_odd: lay,
        mid_odd: mid,
        fair_prob: fair,
        total_matched: matched,
        snapshot_type: snapshotType,
        captured_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("betfair_odds_snapshot").upsert(rows, {
    onConflict: "event_id,market_type,selection,snapshot_type",
    ignoreDuplicates: false, // atualiza com valores mais recentes
  });
  if (error) {
    console.error(`[CapturePrelive] upsert error event_id=${eventId}: ${error.message}`);
    return 0;
  }
  return rows.length;
}

/** Verifica se um snapshot do tipo especificado já existe para o evento. */
async function hasSnapshot(supabase: any, eventId: string, snapshotType: string): Promise<boolean> {
  const { data } = await supabase
    .from("betfair_odds_snapshot")
    .select("id")
    .eq("event_id", eventId)
    .eq("snapshot_type", snapshotType)
    .limit(1)
    .maybeSingle();
  return !!data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (isFutoddsDisabled()) {
      return new Response(JSON.stringify({ ok: false, reason: "FUTODDS_DISABLED" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "auto" | "opening" | "closing" | "midpoint" = body?.mode ?? "auto";
    const daysAhead = Math.min(Number(body?.days_ahead ?? 2), 7);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const dateFrom = now.toISOString().slice(0, 10);
    const dateTo = new Date(now.getTime() + daysAhead * 86400_000).toISOString().slice(0, 10);

    console.log(`[CapturePrelive] mode=${mode} dateFrom=${dateFrom} dateTo=${dateTo}`);

    // Busca jogos futuros com mercados Betfair
    let upcoming: any[] = [];
    try {
      upcoming = await getFutoddsUpcoming({
        date_from: dateFrom,
        date_to: dateTo,
        limit: "500",
      });
    } catch (e) {
      throw new Error(`getFutoddsUpcoming falhou: ${(e as Error).message}`);
    }

    if (!upcoming.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0, reason: "no_upcoming" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[CapturePrelive] ${upcoming.length} jogos encontrados no betfair-upcoming`);

    let openingCaptured = 0, closingCaptured = 0, midpointCaptured = 0, skipped = 0;

    // Processa em batches de BATCH_SIZE para respeitar rate limit
    for (let i = 0; i < upcoming.length; i += BATCH_SIZE) {
      const batch = upcoming.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (game: any) => {
        const eventId = String(game?.event_id ?? game?.eventId ?? "");
        if (!eventId) { skipped++; return; }

        const homeTeam = String(game?.home_team_name ?? game?.home_name ?? game?.home ?? "");
        const awayTeam = String(game?.away_team_name ?? game?.away_name ?? game?.away ?? "");
        const leagueName = String(game?.league_name ?? "");
        const eventDate = String(game?.event_date ?? game?.date ?? "");

        if (!homeTeam || !awayTeam) { skipped++; return; }

        // Calcula minutos até kickoff
        const kickoffMs = eventDate ? new Date(eventDate).getTime() : 0;
        const minsToKickoff = kickoffMs > 0 ? (kickoffMs - now.getTime()) / 60_000 : 999;

        // Já começou (>5min atrás) → ignora
        if (minsToKickoff < -5) { skipped++; return; }

        const doOpening = mode === "auto" || mode === "opening";
        const doClosing = mode === "auto" || mode === "closing";
        const doMidpoint = mode === "midpoint";

        if (doOpening) {
          const alreadyHas = await hasSnapshot(supabase, eventId, "opening");
          if (!alreadyHas) {
            const n = await saveSnapshot(supabase, eventId, homeTeam, awayTeam, leagueName, eventDate, "opening");
            openingCaptured += n;
            console.log(`[CapturePrelive] OPENING ${normTeam(homeTeam)} vs ${normTeam(awayTeam)} → ${n} runners`);
          }
        }

        if (doClosing && minsToKickoff >= 0 && minsToKickoff <= CLOSING_WINDOW_MINUTES) {
          const alreadyHas = await hasSnapshot(supabase, eventId, "closing");
          if (!alreadyHas) {
            const n = await saveSnapshot(supabase, eventId, homeTeam, awayTeam, leagueName, eventDate, "closing");
            closingCaptured += n;
            console.log(`[CapturePrelive] CLOSING ${normTeam(homeTeam)} vs ${normTeam(awayTeam)} (${Math.round(minsToKickoff)}min) → ${n} runners`);
          }
        }

        if (doMidpoint) {
          const n = await saveSnapshot(supabase, eventId, homeTeam, awayTeam, leagueName, eventDate, "midpoint");
          midpointCaptured += n;
        }
      }));

      // Pausa entre batches para não estourar rate limit
      if (i + BATCH_SIZE < upcoming.length) await sleepMs(600);
    }

    const summary = {
      ok: true,
      mode,
      games_checked: upcoming.length,
      skipped,
      opening_runners: openingCaptured,
      closing_runners: closingCaptured,
      midpoint_runners: midpointCaptured,
    };
    console.log(`[CapturePrelive] ✅ ${JSON.stringify(summary)}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[CapturePrelive] Error:", e);
    await logEdgeError("capture-prelive-odds", e).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
