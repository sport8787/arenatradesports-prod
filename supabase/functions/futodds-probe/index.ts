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

  // Roda os 7 endpoints documentados em paralelo
  const endpoints = [
    "/matches-live",
    "/matches-live-full",
    "/matches-live-detail",
    "/matches-live-events",
    "/matches-ended",
    "/matches-upcoming",
    "/matches-cs",
  ];

  const probes = await Promise.all(endpoints.map((p) => call(workingBase!, p)));

  return new Response(JSON.stringify({
    ok: true,
    tokenInfo,
    base: workingBase,
    baseProbe,
    probes: Object.fromEntries(endpoints.map((p, i) => [p, probes[i]])),
    notes: [
      "Verifique sample/schema_keys de /matches-live-detail para confirmar xG, posse, chutes, escanteios, ataques perigosos.",
      "Verifique /matches-upcoming para contagem de bookmakers por mercado (substituição de The Odds API).",
      "Verifique /matches-live-events para granularidade de eventos de jogador (gols/assists/cartões).",
    ],
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
