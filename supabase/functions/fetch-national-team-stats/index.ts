// fetch-national-team-stats
// Coleta estatísticas das últimas N partidas oficiais de cada seleção Copa 2026.
// Fonte: API-Football (xG quando disponível, estimativa por shots quando não).
// Cron: 03:00 UTC diário.
// Pode ser acionada manualmente: POST body { teams?: string[], last?: number }
//   teams: lista de nomes (ex: ["Brazil","Argentina"]) — se omitido, usa copa_fixtures
//   last: número de jogos por seleção (default 10, máx 15)

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AF_BASE = "https://v3.football.api-sports.io";

// Nomes que a API-Football usa diferente dos nomes em copa_fixtures
const AF_NAME_ALIASES: Record<string, string> = {
  "Türkiye": "Turkiye",
  "Curaçao": "Curacao",
  "Bosnia & Herzegovina": "Bosnia",
  "Congo DR": "DR Congo",
  "Cape Verde Islands": "Cape Verde",
  "Ivory Coast": "Ivory Coast",
};

// Ligas que consideramos "oficiais" para fins de análise punter
const OFFICIAL_LEAGUES = [
  "world cup", "qualif", "nations league", "uefa euro", "copa america",
  "africa cup", "afcon", "gold cup", "asian cup",
];

// ─────────────────────────────────────────────────────────────────────────────

async function afCall(path: string, key: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${AF_BASE}${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!r.ok) throw new Error(`API-Football ${path} → ${r.status}`);
  return r.json();
}

function statValue(stats: Array<{ type: string; value: unknown }>, type: string): number | null {
  const entry = stats.find((s) => s.type.toLowerCase().includes(type.toLowerCase()));
  if (!entry || entry.value == null) return null;
  const v = String(entry.value).replace("%", "").trim();
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function isOfficial(leagueName: string): boolean {
  const l = leagueName.toLowerCase();
  return OFFICIAL_LEAGUES.some((k) => l.includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────

async function resolveTeamId(teamName: string, key: string): Promise<number | null> {
  try {
    const j = await afCall(`/teams?name=${encodeURIComponent(teamName)}&type=national`, key);
    const res = (j as any)?.response || [];
    if (res.length === 0) {
      // Tenta busca mais ampla sem type
      const j2 = await afCall(`/teams?name=${encodeURIComponent(teamName)}`, key);
      const res2 = ((j2 as any)?.response || []).filter((t: any) =>
        t?.team?.national === true || t?.team?.type === "National"
      );
      return res2[0]?.team?.id ?? null;
    }
    return res[0]?.team?.id ?? null;
  } catch (e) {
    console.warn(`[nts] resolveTeamId fail "${teamName}":`, (e as Error).message);
    return null;
  }
}

interface MatchStat {
  fixture_id: number;
  date: string;
  league: string;
  opponent: string;
  gf: number;
  ga: number;
  possession: number | null;
  shots_total: number | null;
  shots_on_target: number | null;
  corners: number | null;
  xg_api: number | null; // xG da API-Football se disponível
}

async function fetchMatchStats(
  fixtureId: number,
  teamId: number,
  key: string,
): Promise<Partial<MatchStat>> {
  try {
    const j = await afCall(`/fixtures/statistics?fixture=${fixtureId}`, key);
    const res = ((j as any)?.response || []) as Array<{
      team: { id: number };
      statistics: Array<{ type: string; value: unknown }>;
    }>;
    const mine = res.find((r) => r.team.id === teamId);
    if (!mine) return {};
    const s = mine.statistics;
    return {
      possession: statValue(s, "ball possession"),
      shots_total: statValue(s, "total shots"),
      shots_on_target: statValue(s, "shots on goal"),
      corners: statValue(s, "corner kicks"),
      xg_api: statValue(s, "expected_goals"),
    };
  } catch {
    return {};
  }
}

async function fetchTeamStats(
  teamName: string,
  teamId: number,
  last: number,
  key: string,
): Promise<Record<string, unknown> | null> {
  // 1) Últimas N partidas
  const j = await afCall(`/fixtures?team=${teamId}&last=${Math.min(last + 5, 20)}`, key);
  const allGames = ((j as any)?.response || []) as Array<Record<string, unknown>>;

  // 2) Filtrar apenas oficiais (peso maior) — se não houver suficiente, inclui amistosos
  let games = allGames.filter((g: any) =>
    isOfficial(String(g?.league?.name || ""))
  );
  if (games.length < 3) games = allGames; // fallback: aceita tudo
  games = games.slice(0, last);

  if (games.length === 0) return null;

  const matches: MatchStat[] = [];
  for (const g of games) {
    const gAny = g as any;
    const fixtureId: number = gAny?.fixture?.id;
    const isHome = gAny?.teams?.home?.id === teamId;
    const gf: number = isHome ? (gAny?.goals?.home ?? 0) : (gAny?.goals?.away ?? 0);
    const ga: number = isHome ? (gAny?.goals?.away ?? 0) : (gAny?.goals?.home ?? 0);
    const opponent: string = isHome ? gAny?.teams?.away?.name : gAny?.teams?.home?.name;

    const details = await fetchMatchStats(fixtureId, teamId, key);

    matches.push({
      fixture_id: fixtureId,
      date: String(gAny?.fixture?.date || "").slice(0, 10),
      league: String(gAny?.league?.name || ""),
      opponent,
      gf,
      ga,
      possession: details.possession ?? null,
      shots_total: details.shots_total ?? null,
      shots_on_target: details.shots_on_target ?? null,
      corners: details.corners ?? null,
      xg_api: details.xg_api ?? null,
    });

    // Pequeno delay para não sobrecarregar a API
    await new Promise((r) => setTimeout(r, 300));
  }

  const n = matches.length;
  const wins  = matches.filter((m) => m.gf > m.ga).length;
  const draws = matches.filter((m) => m.gf === m.ga).length;
  const losses = matches.filter((m) => m.gf < m.ga).length;
  const totalGf = matches.reduce((s, m) => s + m.gf, 0);
  const totalGa = matches.reduce((s, m) => s + m.ga, 0);
  const btts    = matches.filter((m) => m.gf > 0 && m.ga > 0).length;
  const over25  = matches.filter((m) => m.gf + m.ga > 2).length;
  const cs      = matches.filter((m) => m.ga === 0).length;
  const fts     = matches.filter((m) => m.gf === 0).length;

  // xG médio: usa API quando disponível, senão estima via shots_on_target × 0.28
  const xgValues = matches.map((m) => {
    if (m.xg_api != null) return m.xg_api;
    if (m.shots_on_target != null) return +(m.shots_on_target * 0.28).toFixed(2);
    return m.gf; // último fallback: gols marcados
  });
  const xgaValues = matches.map((m) => m.ga); // xGA = gols sofridos como proxy
  const avgXg  = +(xgValues.reduce((s, v) => s + v, 0) / n).toFixed(2);
  const avgXga = +(xgaValues.reduce((s, v) => s + v, 0) / n).toFixed(2);

  const withPoss   = matches.filter((m) => m.possession != null);
  const withShots  = matches.filter((m) => m.shots_total != null);
  const withShotsT = matches.filter((m) => m.shots_on_target != null);
  const withCorner = matches.filter((m) => m.corners != null);

  const avg = (arr: number[], key: keyof MatchStat) =>
    arr.length ? +(arr.reduce((s, _m) => s + Number((_m as any)[key] ?? 0), 0) / arr.length).toFixed(2) : null;

  return {
    team_api_id:           teamId,
    matches_analyzed:      n,
    wins, draws, losses,
    goals_scored:          totalGf,
    goals_conceded:        totalGa,
    avg_goals_scored:      +(totalGf / n).toFixed(2),
    avg_goals_conceded:    +(totalGa / n).toFixed(2),
    avg_xg:                avgXg,
    avg_xga:               avgXga,
    avg_possession:        avg(withPoss, "possession"),
    avg_shots_total:       avg(withShots, "shots_total"),
    avg_shots_on_target:   avg(withShotsT, "shots_on_target"),
    avg_corners:           avg(withCorner, "corners"),
    btts_count:            btts,
    btts_percentage:       +(btts / n * 100).toFixed(1),
    over_25_count:         over25,
    under_25_count:        n - over25,
    clean_sheet_count:     cs,
    failed_to_score_count: fts,
    raw_data:              { matches, fetched_at: new Date().toISOString() },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API_FOOTBALL_KEY não configurado" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: { teams?: string[]; last?: number; force?: boolean } = {};
  try { body = await req.json(); } catch { /* cron sem body */ }

  const last = Math.min(Math.max(body.last ?? 10, 3), 15);
  const forceRefresh = body.force === true;

  // Determina lista de seleções
  let teamNames: string[] = body.teams ?? [];
  if (teamNames.length === 0) {
    // Busca todas as seleções cadastradas em copa_fixtures
    const { data: fixtures } = await supabase
      .from("copa_fixtures")
      .select("home, away");
    const all = new Set<string>();
    for (const f of fixtures ?? []) {
      if (f.home) all.add(f.home);
      if (f.away) all.add(f.away);
    }
    teamNames = Array.from(all).sort();
  }

  console.log(`[nts] Processando ${teamNames.length} seleções (last=${last}, force=${forceRefresh})`);

  const results: Record<string, string> = {};
  let processed = 0, skipped = 0, failed = 0;

  for (const teamName of teamNames) {
    // Verifica se já está atualizado (< 20h) e não é força
    if (!forceRefresh) {
      const { data: existing } = await supabase
        .from("national_team_stats")
        .select("last_updated")
        .eq("team_name", teamName)
        .eq("last_matches_count", last)
        .maybeSingle();
      if (existing?.last_updated) {
        const age = Date.now() - new Date(existing.last_updated).getTime();
        if (age < 20 * 60 * 60 * 1000) { // < 20h
          skipped++;
          results[teamName] = "skipped (fresh)";
          continue;
        }
      }
    }

    try {
      // Resolve ID do time
      let teamId: number | null = null;
      const { data: cached } = await supabase
        .from("national_team_stats")
        .select("team_api_id")
        .eq("team_name", teamName)
        .limit(1)
        .maybeSingle();
      teamId = cached?.team_api_id ?? null;

      if (!teamId) {
        const apiName = AF_NAME_ALIASES[teamName] ?? teamName;
        teamId = await resolveTeamId(apiName, apiKey);
        if (!teamId) {
          failed++;
          results[teamName] = "team_id not found";
          continue;
        }
      }

      const stats = await fetchTeamStats(teamName, teamId, last, apiKey);
      if (!stats) {
        failed++;
        results[teamName] = "no data";
        continue;
      }

      const { error } = await supabase
        .from("national_team_stats")
        .upsert({
          team_name: teamName,
          last_matches_count: last,
          last_updated: new Date().toISOString(),
          ...stats,
        }, { onConflict: "team_name,last_matches_count" });

      if (error) throw error;
      processed++;
      results[teamName] = `ok (${stats.matches_analyzed} jogos, xG=${stats.avg_xg})`;
      console.log(`[nts] ✅ ${teamName}: ${results[teamName]}`);

      // Pausa entre times para respeitar rate limit
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      failed++;
      results[teamName] = `error: ${(e as Error).message}`;
      console.error(`[nts] ❌ ${teamName}:`, (e as Error).message);
    }
  }

  console.log(`[nts] Concluído — processed=${processed} skipped=${skipped} failed=${failed}`);
  return new Response(
    JSON.stringify({ ok: true, processed, skipped, failed, teams: results }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
