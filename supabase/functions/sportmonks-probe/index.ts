// Probe Sportmonks: descobre plano, ligas e includes liberados.
// Uso: GET /functions/v1/sportmonks-probe (admin only via JWT do client).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const BASE = "https://api.sportmonks.com/v3";

async function call(path: string, params: Record<string, string> = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("api_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const t0 = Date.now();
  const res = await fetch(url.toString());
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  return { path, status: res.status, ms: Date.now() - t0, body: json ?? text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "SPORTMONKS_API_KEY ausente" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenInfo = { length: TOKEN.length, head: TOKEN.slice(0, 6), tail: TOKEN.slice(-4) };

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const mappedSm = "8,564,384,82,301,648,649,72,462,208,501,600,779,743,271,932,9,109";

  const probes = await Promise.all([
    call("/football/leagues", { per_page: "5" }),
    call(`/football/fixtures/between/${today}/${in7}`, {
      include: "league",
      per_page: "200",
      filters: `fixtureLeagues:${mappedSm}`,
    }),
  ]);

  return new Response(JSON.stringify({ tokenInfo, probes }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
