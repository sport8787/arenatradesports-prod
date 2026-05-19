// Ad-hoc: busca liga Sportmonks por nome. Uso: ?q=serie+c
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "serie c";
  const r = await fetch(`https://api.sportmonks.com/v3/football/leagues/search/${encodeURIComponent(q)}?api_token=${TOKEN}&include=country`);
  const j = await r.json();
  const rows = (j.data || []).map((l: any) => ({ id: l.id, name: l.name, country: l.country?.name, active: l.active }));
  return new Response(JSON.stringify({ count: rows.length, rows }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
