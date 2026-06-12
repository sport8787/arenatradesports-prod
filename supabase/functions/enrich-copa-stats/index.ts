// enrich-copa-stats
// Para cada time de copa_fixtures:
//  1) Lê national_team_stats.raw_data.matches → form + scorelines + reformata matches_data
//  2) Tenta fbref-team-stats para xG agregado melhor
//  3) Faz upsert em copa_2026_stats
// Pode ser chamado por time ou em lote (batch = true processa todos)

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RawMatch {
  gf: number;
  ga: number;
  date: string;
  opponent: string;
  league?: string;
  fixture_id?: number;
  xg_api?: number | null;
  corners?: number | null;
  possession?: number | null;
  shots_total?: number | null;
  shots_on_target?: number | null;
}

interface NatStats {
  team_name: string;
  matches_analyzed: number;
  wins: number;
  draws: number;
  losses: number;
  avg_goals_scored: number;
  avg_goals_conceded: number;
  avg_xg: number | null;
  avg_xga: number | null;
  avg_possession: number | null;
  avg_corners: number | null;
  avg_shots_on_target: number | null;
  btts_percentage: number | null;
  over_25_count: number;
  clean_sheet_count: number;
  raw_data: { matches?: RawMatch[]; fetched_at?: string } | null;
  last_updated: string;
}

function computeForm(matches: RawMatch[]): {
  form: string;
  scorelines: string[];
  matchesNormalized: Array<Record<string, unknown>>;
} {
  const normalized: Array<Record<string, unknown>> = [];
  for (const m of matches) {
    if (typeof m.gf !== "number" || typeof m.ga !== "number") continue;
    const result = m.gf > m.ga ? "W" : m.gf < m.ga ? "L" : "D";
    normalized.push({
      date: m.date ?? "",
      opponent: m.opponent ?? "",
      venue: "N",  // API-Football doesn't provide venue for international, default neutral
      result,
      goals_for: m.gf,
      goals_against: m.ga,
      xg: m.xg_api ?? null,
      xga: null,
      shots_on_target: m.shots_on_target ?? null,
      possession: m.possession ?? null,
      corners: m.corners ?? null,
      league: m.league ?? "",
      fixture_id: m.fixture_id ?? null,
    });
  }

  const form5 = normalized.slice(0, 5).map((m) => m.result as string).join("");
  const scorelines = normalized.slice(0, 3).map(
    (m) => `${m.goals_for}-${m.goals_against} vs ${m.opponent} (${m.result})`
  );

  return { form: form5, scorelines, matchesNormalized: normalized };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  let body: { team?: string; batch?: boolean } = {};
  try {
    body = await req.json();
  } catch { /* GET sem body */ }

  const { team: singleTeam, batch } = body;

  // ── Determina lista de times a processar ──────────────────────────────────
  let teams: string[] = [];
  if (singleTeam) {
    teams = [singleTeam];
  } else if (batch) {
    // Todos os times em copa_fixtures (únicos)
    const { data: fixtures } = await supabase
      .from("copa_fixtures")
      .select("home, away");
    const names = new Set<string>();
    for (const f of fixtures ?? []) {
      if (f.home) names.add(f.home);
      if (f.away) names.add(f.away);
    }
    teams = [...names].sort();
  } else {
    return new Response(
      JSON.stringify({ error: 'Envie {"team":"Brazil"} ou {"batch":true}' }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ team: string; status: string; form?: string; xg?: number | null; source?: string }> = [];

  for (const teamName of teams) {
    try {
      // ── 1) Lê national_team_stats ────────────────────────────────────────
      const { data: natData } = await supabase
        .from("national_team_stats")
        .select("*")
        .ilike("team_name", `%${teamName}%`)
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nat = natData as NatStats | null;
      if (!nat) {
        results.push({ team: teamName, status: "no_nat_stats" });
        continue;
      }

      const rawMatches: RawMatch[] = nat.raw_data?.matches ?? [];
      const { form, matchesNormalized } = computeForm(rawMatches);
      const n = nat.matches_analyzed || 1;

      // Estatísticas do national_team_stats como base
      const statsBase = {
        last_matches: nat.matches_analyzed,
        avg_goals_scored: nat.avg_goals_scored,
        avg_goals_conceded: nat.avg_goals_conceded,
        avg_xg: nat.avg_xg,
        avg_xga: nat.avg_xga,
        avg_possession: nat.avg_possession,
        avg_corners: nat.avg_corners,
        avg_shots_on_target: nat.avg_shots_on_target,
        btts_pct: nat.btts_percentage,
        over_25_pct: nat.matches_analyzed > 0
          ? Math.round((nat.over_25_count / n) * 100 * 10) / 10
          : null,
        clean_sheet_pct: nat.matches_analyzed > 0
          ? Math.round((nat.clean_sheet_count / n) * 100 * 10) / 10
          : null,
        form_last5: form,
        matches_data: matchesNormalized,
        source: "api-football",
        last_updated: new Date().toISOString(),
      };

      // ── 2) Tenta fbref-team-stats para xG melhor ─────────────────────────
      let fbrefXg: number | null = null;
      let fbrefXga: number | null = null;
      let usedSource = "api-football";

      try {
        const fbrefResp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/fbref-team-stats`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ team: teamName }),
            signal: AbortSignal.timeout(8000),
          }
        );
        if (fbrefResp.ok) {
          const fbrefData = await fbrefResp.json();
          if (fbrefData.found && fbrefData.stats) {
            const xgPer90 = fbrefData.stats.xg_per_90;
            const xgaPer90 = fbrefData.stats.xga_per_90;
            if (xgPer90 && xgPer90 > 0) {
              fbrefXg = Math.round(xgPer90 * 100) / 100;
              usedSource = "fbref";
            }
            if (xgaPer90 && xgaPer90 > 0) {
              fbrefXga = Math.round(xgaPer90 * 100) / 100;
            }
          }
        }
      } catch { /* FBref indisponível — usa api-football */ }

      const finalStats = {
        ...statsBase,
        avg_xg: fbrefXg ?? statsBase.avg_xg,
        avg_xga: fbrefXga ?? statsBase.avg_xga,
        source: usedSource,
      };

      // ── 3) Upsert copa_2026_stats ─────────────────────────────────────────
      const { error: upsertErr } = await supabase
        .from("copa_2026_stats")
        .upsert({ team_name: nat.team_name, ...finalStats }, { onConflict: "team_name" });

      if (upsertErr) {
        results.push({ team: teamName, status: "error", source: upsertErr.message });
      } else {
        results.push({
          team: teamName,
          status: "ok",
          form: form,
          xg: finalStats.avg_xg,
          source: usedSource,
        });
      }
    } catch (e) {
      results.push({ team: teamName, status: "error", source: String(e) });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status !== "ok").length;

  return new Response(
    JSON.stringify({ processed: results.length, ok, skipped, results }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
