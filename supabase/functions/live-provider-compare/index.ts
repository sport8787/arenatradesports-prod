// live-provider-compare — Admin only. Compara saídas de Sportmonks vs API-Football lado a lado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getLiveMatches } from "../_shared/liveProvider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AF_BASE = "https://v3.football.api-sports.io";

async function fetchAF() {
  const t0 = Date.now();
  const key = ""; // API-Football removida em Fase 2 (18/05/2026) — comparação AF retorna sempre "deprecated"
  if (!key) return { ok: false, ms: 0, count: 0, error: "no_api_football_key" };
  try {
    const res = await fetch(`${AF_BASE}/fixtures?live=all`, { headers: { "x-apisports-key": key } });
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, ms, count: 0, error: `http_${res.status}` };
    const j = await res.json();
    return { ok: true, ms, count: (j.response || []).length, fixtures: j.response || [] };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, count: 0, error: (e as Error).message };
  }
}

async function fetchSM() {
  const t0 = Date.now();
  try {
    // força sportmonks (sem fallback para AF, queremos ver realmente o que SM retorna)
    const prev = Deno.env.get("SPORTMONKS_API_KEY");
    if (!prev) return { ok: false, ms: 0, count: 0, error: "no_sportmonks_key" };
    const r = await getLiveMatches();
    const ms = Date.now() - t0;
    if (r.source !== "sportmonks") {
      return { ok: false, ms, count: 0, error: `fallback_used:${r.fallback_reason}` };
    }
    return { ok: true, ms, count: r.count, fixtures: r.fixtures };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, count: 0, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await sb.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = data.claims.sub;

    // admin-only
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "admin_only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Comparação em paralelo
    const [sm, af] = await Promise.all([fetchSM(), fetchAF()]);

    // Match (cross-reference) — tenta casar por nome de times
    type MiniFx = { home: string; away: string; minute: number | null; goals: string };
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const toMini = (f: any, src: "sm" | "af"): MiniFx & { id: string } => ({
      id: String(f.fixture?.id ?? f.id ?? "?"),
      home: f.teams?.home?.name || "?",
      away: f.teams?.away?.name || "?",
      minute: f.fixture?.status?.elapsed ?? null,
      goals: `${f.goals?.home ?? "-"}-${f.goals?.away ?? "-"}`,
    });
    const smMini = (sm.fixtures || []).map((f: any) => toMini(f, "sm"));
    const afMini = (af.fixtures || []).map((f: any) => toMini(f, "af"));

    const matched: any[] = [];
    const onlySM: any[] = [];
    const onlyAF: any[] = [];
    const afByKey = new Map<string, MiniFx & { id: string }>();
    afMini.forEach((m) => afByKey.set(norm(m.home) + "|" + norm(m.away), m));

    smMini.forEach((s) => {
      const k = norm(s.home) + "|" + norm(s.away);
      const a = afByKey.get(k);
      if (a) {
        matched.push({ home: s.home, away: s.away, sm_id: s.id, af_id: a.id, sm_min: s.minute, af_min: a.minute, sm_goals: s.goals, af_goals: a.goals, agree: s.goals === a.goals });
        afByKey.delete(k);
      } else {
        onlySM.push(s);
      }
    });
    afByKey.forEach((a) => onlyAF.push(a));

    return new Response(JSON.stringify({
      ok: true,
      sportmonks: { ok: sm.ok, ms: sm.ms, count: sm.count, error: sm.error },
      api_football: { ok: af.ok, ms: af.ms, count: af.count, error: af.error },
      matched_count: matched.length,
      only_sportmonks: onlySM.length,
      only_api_football: onlyAF.length,
      score_agreement: matched.length ? `${matched.filter((m) => m.agree).length}/${matched.length}` : "0/0",
      sample: matched.slice(0, 20),
      only_sm_sample: onlySM.slice(0, 10),
      only_af_sample: onlyAF.slice(0, 10),
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
