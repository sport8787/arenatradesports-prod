// =============================================================================
// SPORTMONKS PREMATCH CONTEXT
// Busca lineups + formations + injuries/suspensions do fixture e devolve:
//  - lineupRisk: { home/away }  → fração de "titulares habituais" presentes (0..1)
//  - formationProfile: { home/away } → 'ultra_defensiva' | 'defensiva' | 'equilibrada' | 'ofensiva'
//  - missingKey: { home/away } → { striker: bool, goalkeeper: bool, names: string[] }
//  - boostHints / vetoHints  → derivados prontos para o analyze-live / mycroft-sports-analysis
//
// Cacheado em prematch_context_cache (TTL 6h por match_id).
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SM_TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const SM_BASE = "https://api.sportmonks.com/v3";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const FORMATION_PROFILE: Record<string, string> = {
  // Ultra-defensiva
  "5-4-1": "ultra_defensiva", "5-3-2": "ultra_defensiva", "5-2-3": "ultra_defensiva",
  // Defensiva
  "4-5-1": "defensiva", "4-4-2": "defensiva", "3-5-2": "defensiva", "4-1-4-1": "defensiva",
  // Equilibrada
  "4-2-3-1": "equilibrada", "4-3-3": "equilibrada", "3-4-3": "equilibrada",
  // Ofensiva
  "4-3-1-2": "ofensiva", "3-3-4": "ofensiva", "4-2-4": "ofensiva", "3-4-1-2": "ofensiva",
};

interface PrematchContext {
  match_id: string;
  fetched_at: string;
  lineupRisk: { home: number | null; away: number | null };
  formationProfile: { home: string | null; away: string | null };
  formations: { home: string | null; away: string | null };
  missingKey: {
    home: { striker: boolean; goalkeeper: boolean; names: string[] };
    away: { striker: boolean; goalkeeper: boolean; names: string[] };
  };
  hints: {
    underBoost: number;   // -10..+10 pp aplicar em UNDER markets
    overBoost: number;    // -10..+10 pp aplicar em OVER markets
    vetoBack: { home: boolean; away: boolean; reason?: string };
  };
  source: "sportmonks";
}

function classifyFormation(f: string | null): string | null {
  if (!f) return null;
  return FORMATION_PROFILE[f.replace(/\s+/g, "")] ?? "equilibrada";
}

function isStriker(positionId?: number, positionName?: string): boolean {
  // Sportmonks position_id: 27 (Forward), 28 (Attacker). Nome cobre fallback.
  if (positionId === 27 || positionId === 28) return true;
  const n = (positionName || "").toLowerCase();
  return /forward|striker|attacker|atacante|centroavante/.test(n);
}
function isGoalkeeper(positionId?: number, positionName?: string): boolean {
  if (positionId === 24) return true;
  const n = (positionName || "").toLowerCase();
  return /keeper|goalkeeper|goleiro|gk/.test(n);
}

async function fetchSportmonksContext(smFixtureId: number): Promise<any | null> {
  if (!SM_TOKEN) return null;
  const url = new URL(`${SM_BASE}/football/fixtures/${smFixtureId}`);
  url.searchParams.set("api_token", SM_TOKEN);
  url.searchParams.set(
    "include",
    "participants;lineups.player;formations;sidelined.player",
  );
  try {
    const r = await fetch(url.toString());
    if (!r.ok) {
      console.warn(`[prematch-ctx] sportmonks ${smFixtureId} status ${r.status}`);
      return null;
    }
    const j = await r.json();
    return j.data || null;
  } catch (e) {
    console.warn(`[prematch-ctx] fetch error`, (e as Error).message);
    return null;
  }
}

function buildContext(matchId: string, fix: any): PrematchContext {
  const participants = fix?.participants || [];
  const home = participants.find((p: any) => p.meta?.location === "home") || participants[0];
  const away = participants.find((p: any) => p.meta?.location === "away") || participants[1];
  const homeId = home?.id;
  const awayId = away?.id;

  // Formations: array com { fixture_id, participant_id, formation } por fixture
  const formations = fix?.formations || [];
  const formHomeRaw: string | null =
    formations.find((f: any) => f.participant_id === homeId)?.formation ?? null;
  const formAwayRaw: string | null =
    formations.find((f: any) => f.participant_id === awayId)?.formation ?? null;
  const formHome = classifyFormation(formHomeRaw);
  const formAway = classifyFormation(formAwayRaw);

  // Lineups: type_id 11 (starting) / 12 (bench). Marca jogadores titulares.
  const lineups = fix?.lineups || [];
  const startHome = lineups.filter((l: any) => l.participant_id === homeId && (l.type_id === 11 || l.type?.developer_name === "STARTING_LINEUP"));
  const startAway = lineups.filter((l: any) => l.participant_id === awayId && (l.type_id === 11 || l.type?.developer_name === "STARTING_LINEUP"));

  // Sem heurística de "titular habitual" sem histórico → usamos %titulares com player resolvido
  // como proxy de confiabilidade do lineup (0 se vazio, 1 se todos resolvidos).
  const lineupRiskHome = startHome.length > 0
    ? startHome.filter((p: any) => p.player?.id).length / startHome.length
    : null;
  const lineupRiskAway = startAway.length > 0
    ? startAway.filter((p: any) => p.player?.id).length / startAway.length
    : null;

  // Sidelined = lesionados/suspensos atuais por participante.
  const sidelined = fix?.sidelined || [];
  const missingHome = sidelined.filter((s: any) => s.participant_id === homeId);
  const missingAway = sidelined.filter((s: any) => s.participant_id === awayId);

  const evalMissing = (list: any[]) => {
    let striker = false, goalkeeper = false;
    const names: string[] = [];
    for (const m of list) {
      const pos = m.player?.position?.developer_name || m.player?.position_id || m.player?.detailed_position?.name;
      const pid = m.player?.position_id ?? m.player?.detailed_position_id;
      if (isStriker(pid, String(pos))) striker = true;
      if (isGoalkeeper(pid, String(pos))) goalkeeper = true;
      if (m.player?.display_name) names.push(m.player.display_name);
    }
    return { striker, goalkeeper, names: names.slice(0, 6) };
  };

  const missingKey = {
    home: evalMissing(missingHome),
    away: evalMissing(missingAway),
  };

  // ── Hints ─────────────────────────────────────────────────────
  let underBoost = 0;
  let overBoost = 0;
  const vetoBack = { home: false, away: false, reason: undefined as string | undefined };

  // Item 4: atacante chave fora → boost Under
  if (missingKey.home.striker) underBoost += 4;
  if (missingKey.away.striker) underBoost += 4;
  // Goleiro titular fora → VETO Under (defesa quebra)
  if (missingKey.home.goalkeeper || missingKey.away.goalkeeper) {
    underBoost -= 8;
    overBoost += 5;
  }

  // Item 3: formação ultra-defensiva em casa → boost Under 2.5
  if (formHome === "ultra_defensiva" || formAway === "ultra_defensiva") underBoost += 3;
  if (formHome === "ofensiva" && formAway === "ofensiva") overBoost += 4;

  // Item 3 (veto BACK quando lineup baixo). Sem histórico real, usamos
  // lineupRisk como sinal de "lineup ainda não publicado". Só veta se há
  // missing chave do mesmo lado.
  if (missingKey.home.striker && missingKey.home.goalkeeper) {
    vetoBack.home = true;
    vetoBack.reason = "Casa sem atacante chave + goleiro titular";
  }
  if (missingKey.away.striker && missingKey.away.goalkeeper) {
    vetoBack.away = true;
    vetoBack.reason = "Fora sem atacante chave + goleiro titular";
  }

  return {
    match_id: matchId,
    fetched_at: new Date().toISOString(),
    lineupRisk: { home: lineupRiskHome, away: lineupRiskAway },
    formationProfile: { home: formHome, away: formAway },
    formations: { home: formHomeRaw, away: formAwayRaw },
    missingKey,
    hints: { underBoost, overBoost, vetoBack },
    source: "sportmonks",
  };
}

async function loadCache(matchId: string): Promise<PrematchContext | null> {
  const { data } = await sb
    .from("prematch_context_cache")
    .select("payload, fetched_at")
    .eq("match_id", matchId)
    .maybeSingle();
  if (!data?.payload) return null;
  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > 6 * 60 * 60 * 1000) return null; // TTL 6h
  return data.payload as PrematchContext;
}

async function saveCache(ctx: PrematchContext) {
  await sb.from("prematch_context_cache").upsert({
    match_id: ctx.match_id,
    payload: ctx,
    fetched_at: ctx.fetched_at,
  }, { onConflict: "match_id" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { match_id, sm_fixture_id, force } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force) {
      const cached = await loadCache(String(match_id));
      if (cached) {
        return new Response(JSON.stringify({ success: true, cached: true, context: cached }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!sm_fixture_id) {
      // sem sm_id não há como buscar — devolve hint neutro
      const empty: PrematchContext = {
        match_id: String(match_id),
        fetched_at: new Date().toISOString(),
        lineupRisk: { home: null, away: null },
        formationProfile: { home: null, away: null },
        formations: { home: null, away: null },
        missingKey: { home: { striker: false, goalkeeper: false, names: [] }, away: { striker: false, goalkeeper: false, names: [] } },
        hints: { underBoost: 0, overBoost: 0, vetoBack: { home: false, away: false } },
        source: "sportmonks",
      };
      return new Response(JSON.stringify({ success: true, cached: false, context: empty }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fix = await fetchSportmonksContext(Number(sm_fixture_id));
    if (!fix) {
      return new Response(JSON.stringify({ success: false, error: "fixture não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = buildContext(String(match_id), fix);
    await saveCache(ctx);
    return new Response(JSON.stringify({ success: true, cached: false, context: ctx }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[prematch-ctx]", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
