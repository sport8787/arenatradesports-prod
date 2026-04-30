// analyze-live-shadow-af
// Roda análise PARALELA usando API-Football como provider de stats (modo shadow),
// para comparar com a aprovação primária (Sportmonks). Grava em mycroft_analyses_shadow_af.
// Apenas leitura para usuários — admin lê via aba "Sinais Aprovados (API-Football)".

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Pega jogos ao vivo com placar/minuto
    const { data: liveMatches, error: lmErr } = await sb
      .from("live_matches")
      .select("match_id, home_team, away_team, championship, score_home, score_away, minute, period, status, stats")
      .in("status", ["live", "halftime"])
      .limit(80);

    if (lmErr) throw lmErr;
    if (!liveMatches || liveMatches.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, msg: "no live matches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let approved = 0;
    let total = 0;
    const errors: string[] = [];

    for (const m of liveMatches) {
      total++;
      try {
        // Evita reanalisar shadow muito recente (< 90s) para o mesmo match
        const { data: recent } = await sb
          .from("mycroft_analyses_shadow_af")
          .select("id, created_at")
          .eq("match_id", m.match_id)
          .gt("created_at", new Date(Date.now() - 90_000).toISOString())
          .limit(1);
        if (recent && recent.length > 0) continue;

        const res = await fetch(`${SUPABASE_URL}/functions/v1/mycroft-sports-analysis`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            force_provider: "api-football",
            match: {
              home: m.home_team,
              away: m.away_team,
              scoreHome: m.score_home ?? 0,
              scoreAway: m.score_away ?? 0,
              minute: m.minute ?? 0,
              period: m.period ?? "",
              championship: m.championship,
              match_id: m.match_id,
              stats: m.stats || {},
              bankroll: 500,
              existingApprovedMarkets: [],
              punterPreliveAnalyses: [],
            },
          }),
        });

        if (!res.ok) {
          errors.push(`${m.match_id}: HTTP ${res.status}`);
          continue;
        }
        const a = await res.json();
        if (!a?.verdict) continue;

        await sb.from("mycroft_analyses_shadow_af").insert({
          match_id: m.match_id,
          verdict: a.verdict,
          plan_name: a.plan_name || null,
          market: a.market || "N/A",
          thesis: a.thesis || null,
          odd: a.odd ?? null,
          confidence: a.confidence ?? 0,
          risk_management: a.risk_management ?? null,
          alerts: Array.isArray(a.alerts) ? a.alerts : [],
          fundamentation: a.fundamentation ?? null,
          provider: "api-football",
          approved_at_minute: m.minute ?? null,
          approved_at_score_home: m.score_home ?? null,
          approved_at_score_away: m.score_away ?? null,
        });

        if (["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"].includes(a.verdict)) {
          approved++;
        }
      } catch (e) {
        errors.push(`${m.match_id}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: total,
        approved,
        errors: errors.slice(0, 10),
        ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
