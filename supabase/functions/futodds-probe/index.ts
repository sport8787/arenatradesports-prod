// futodds-probe — Discovery: chama todos os endpoints da Futodds API e devolve schema bruto + amostras.
// Admin only. Usado na Fase 0 do plano de adoção da Futodds.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN = Deno.env.get("FUTODDS_API_KEY") ?? "";
// Base URL conhecida (ajustar se Futodds publicar outra). A doc do site cita endpoints relativos.
// Base URL oficial confirmada na documentação (PDFs Futodds_3/4/5).
const BASE_CANDIDATES = [
  "https://csv.futodds.com/functions/v1",
  "https://api.futodds.com/v1",
  "https://futodds.com/api",
];

async function call(base: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const t0 = Date.now();
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "X-API-Key": TOKEN,
        "Accept": "application/json",
      },
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return {
      url: url.toString(),
      status: res.status,
      ms: Date.now() - t0,
      headers: {
        "x-ratelimit-remaining": res.headers.get("x-ratelimit-remaining"),
        "x-ratelimit-limit": res.headers.get("x-ratelimit-limit"),
        "content-type": res.headers.get("content-type"),
      },
      sample: json
        ? (Array.isArray(json) ? json.slice(0, 2) : (json?.data?.slice?.(0, 2) ?? json))
        : text.slice(0, 500),
      schema_keys: json
        ? (Array.isArray(json) ? Object.keys(json[0] ?? {}) : Object.keys(json?.data?.[0] ?? json ?? {}))
        : [],
      total_count: json
        ? (Array.isArray(json) ? json.length : (json?.data?.length ?? json?.total ?? null))
        : null,
    };
  } catch (e) {
    return { url: url.toString(), status: 0, ms: Date.now() - t0, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "FUTODDS_API_KEY ausente" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin gate
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
  } catch (e) {
    return new Response(JSON.stringify({ error: "auth_failed: " + (e as Error).message }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenInfo = { length: TOKEN.length, head: TOKEN.slice(0, 10), tail: TOKEN.slice(-4) };

  // Detecta a base correta tentando /matches-live em cada candidata
  let workingBase: string | null = null;
  let baseProbe: any[] = [];
  for (const base of BASE_CANDIDATES) {
    const r = await call(base, "/matches-live");
    baseProbe.push({ base, status: r.status, ms: r.ms, error: (r as any).error });
    if (r.status === 200) { workingBase = base; break; }
  }

  if (!workingBase) {
    return new Response(JSON.stringify({
      ok: false,
      tokenInfo,
      baseProbe,
      hint: "Nenhuma base aceitou a API key. Confirme a URL base no painel Futodds (futodds.com/api-keys) e atualize BASE_CANDIDATES.",
    }, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Bulk endpoints (sem parâmetro). Os endpoints de detalhe ficam em detail_probes.
  const endpoints = [
    "/matches-live",
    "/matches-live-full",
    "/matches-ended",
    "/matches-upcoming",
    "/matches-cs",
    "/matches-betfair-upcoming",
    "/matches-betfair-live",
    "/matches-betfair-live-compact",
  ];

  const probes = await Promise.all(endpoints.map((p) => call(workingBase!, p)));

  // Detail endpoints: precisam game_id / event_id. Buscamos IDs em VÁRIAS fontes
  // (live, live-full, betfair-live, betfair-live-compact, betfair-upcoming) e só
  // chamamos os detalhes quando temos um ID concreto. Caso contrário, devolvemos
  // entry "skipped" com o motivo — evita 400 desnecessário.
  const liveProbe = probes[endpoints.indexOf("/matches-live")] as any;
  const liveFull = probes[endpoints.indexOf("/matches-live-full")] as any;
  const betfairLive = probes[endpoints.indexOf("/matches-betfair-live")] as any;
  const compact = probes[endpoints.indexOf("/matches-betfair-live-compact")] as any;
  const upcoming = probes[endpoints.indexOf("/matches-betfair-upcoming")] as any;

  const firstOf = (...samples: any[]): any => {
    for (const s of samples) {
      if (Array.isArray(s) && s.length) return s[0];
      if (s && typeof s === "object" && !Array.isArray(s)) return s;
    }
    return null;
  };
  const liveSample = firstOf(liveProbe?.sample, liveFull?.sample);
  const sampleGameId =
    liveSample?.id ?? liveSample?.game_id ?? liveSample?.fixture_id ?? null;
  const compactSample = firstOf(compact?.sample, betfairLive?.sample);
  const sampleEvent =
    compactSample?.event_id ?? compactSample?.eventId ?? compactSample?.id_betfair ??
    liveSample?.id_betfair ?? liveSample?.event_id ?? null;
  const upcomingSample = firstOf(upcoming?.sample);
  const upcomingEvent =
    upcomingSample?.event_id ?? upcomingSample?.eventId ?? upcomingSample?.id_betfair ?? null;

  const detailProbes: Record<string, any> = {};
  const skip = (reason: string) => ({ status: 0, ms: 0, skipped: true, reason });

  detailProbes["/matches-live-detail?game_id"] = sampleGameId
    ? await call(workingBase!, "/matches-live-detail", { game_id: String(sampleGameId) })
    : skip("no_game_id_available_in_live_or_live_full");
  detailProbes["/matches-live-events?game_id"] = sampleGameId
    ? await call(workingBase!, "/matches-live-events", { game_id: String(sampleGameId) })
    : skip("no_game_id_available_in_live_or_live_full");
  detailProbes["/matches-betfair-live-odds?event_id"] = sampleEvent
    ? await call(workingBase!, "/matches-betfair-live-odds", { event_id: String(sampleEvent) })
    : skip("no_event_id_in_betfair_compact_or_betfair_live");
  detailProbes["/matches-betfair-live-markets?event_id"] = sampleEvent
    ? await call(workingBase!, "/matches-betfair-live-markets", { event_id: String(sampleEvent) })
    : skip("no_event_id_in_betfair_compact_or_betfair_live");
  detailProbes["/matches-upcoming-detail?event_id"] = upcomingEvent
    ? await call(workingBase!, "/matches-upcoming-detail", { event_id: String(upcomingEvent) })
    : skip("no_event_id_in_betfair_upcoming");

  detailProbes["_resolved_ids"] = { sampleGameId, sampleEvent, upcomingEvent };

  // Cobertura por liga (a partir de /matches-betfair-live — `betfairLive` já declarado acima)
  const liveLeagues = new Set<number>();
  if (Array.isArray(betfairLive?.sample)) {
    for (const m of betfairLive.sample) {
      if (m?.league_id) liveLeagues.add(m.league_id);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    tokenInfo,
    base: workingBase,
    baseProbe,
    probes: Object.fromEntries(endpoints.map((p, i) => [p, probes[i]])),
    detail_probes: detailProbes,
    coverage: {
      betfair_live_count: betfairLive?.total_count ?? null,
      betfair_live_leagues_in_sample: Array.from(liveLeagues),
    },
    notes: [
      "Confirme em /matches-betfair-live: pressure_indices, last5min_stats e stats (attacks/dangerous_attacks/on_target/corners/possession).",
      "Confirme em /matches-betfair-live-odds: arrays back_odds e lay_odds com price+size, last_price_traded, total_matched.",
      "Cobertura ideal Brasileirão (71/72/75/76) + Top 5 europeias (39/140/135/78/61) deve aparecer em /matches-betfair-live durante horário de jogos.",
    ],
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
