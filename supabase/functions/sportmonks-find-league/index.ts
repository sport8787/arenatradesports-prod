// Probe ligas Sportmonks: tenta múltiplos endpoints para descobrir cobertura real do plano
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";

async function get(path: string) {
  const r = await fetch(`https://api.sportmonks.com/v3/football${path}${path.includes('?') ? '&' : '?'}api_token=${TOKEN}`);
  const txt = await r.text();
  try { return { status: r.status, body: JSON.parse(txt) }; } catch { return { status: r.status, body: txt }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "all";

  if (action === "all_leagues") {
    // pagina todas ligas (varias paginas)
    const results: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const r = await get(`/leagues?per_page=100&page=${page}`);
      const data = (r.body as any)?.data || [];
      results.push(...data.map((l: any) => ({ id: l.id, name: l.name, country_id: l.country_id, sub_type: l.sub_type, active: l.active })));
      if (data.length < 100) break;
    }
    const br = results.filter((l) => l.country_id === 5);
    return new Response(JSON.stringify({ total: results.length, brazil: br }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // default: tenta vários endpoints em paralelo
  const [country5, search1, search2, search3, byId1372, byId636] = await Promise.all([
    get(`/leagues/countries/5?per_page=100`),
    get(`/leagues/search/brasileir%C3%A3o`),
    get(`/leagues/search/serie%20c`),
    get(`/leagues/search/serie%20d`),
    get(`/leagues/1372`),
    get(`/leagues/636`),
  ]);
  return new Response(JSON.stringify({
    country5: (country5.body as any)?.data?.map((l: any) => ({ id: l.id, name: l.name, active: l.active })) ?? country5,
    search_brasileirao: (search1.body as any)?.data?.map((l: any) => ({ id: l.id, name: l.name, country_id: l.country_id })) ?? search1,
    search_serie_c: (search2.body as any)?.data?.map((l: any) => ({ id: l.id, name: l.name, country_id: l.country_id })) ?? search2,
    search_serie_d: (search3.body as any)?.data?.map((l: any) => ({ id: l.id, name: l.name, country_id: l.country_id })) ?? search3,
    by_id_1372: byId1372,
    by_id_636: byId636,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
