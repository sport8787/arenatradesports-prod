// Edge: busca odd ao vivo na Sportmonks (Premium /odds/fixtures/{id}/live).
// Fallback graceful: se plano não permitir ou mercado não existir, retorna { odd: null }.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  fixture_id?: number | string;
  market?: string; // ex: "Over 2.5 Total"
}

function mapMarketToSportmonks(market: string): { name: string; line: string } | null {
  const m = market.toLowerCase();
  const lineMatch = m.match(/(\d+\.?\d*)/);
  if (!lineMatch) return null;
  const line = lineMatch[1];
  if (m.includes('over') || m.includes('under')) {
    return { name: 'over/under', line };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { fixture_id, market } = (await req.json()) as Body;
    const KEY = Deno.env.get('SPORTMONKS_API_KEY');
    if (!KEY) {
      return new Response(
        JSON.stringify({ odd: null, source: 'no_key' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!fixture_id || !market) {
      return new Response(
        JSON.stringify({ error: 'fixture_id and market required', odd: null }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const mapped = mapMarketToSportmonks(market);
    if (!mapped) {
      return new Response(
        JSON.stringify({ odd: null, source: 'market_not_supported' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const url = `https://api.sportmonks.com/v3/football/odds/fixtures/${fixture_id}/live?api_token=${KEY}&include=market`;
    const r = await fetch(url);
    if (r.status === 403 || r.status === 401) {
      return new Response(
        JSON.stringify({ odd: null, source: 'plan_not_allowed', status: r.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!r.ok) {
      return new Response(
        JSON.stringify({ odd: null, source: 'api_error', status: r.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const data = await r.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];

    // Procura por mercado over/under com a linha correta.
    let odd: number | null = null;
    for (const item of items) {
      const mName = (item?.market?.name || '').toLowerCase();
      const mLabel = (item?.label || item?.name || '').toLowerCase();
      const mTotal = String(item?.total ?? item?.handicap ?? '').toLowerCase();
      const matchesMarket = mName.includes('over/under') || mName.includes('goals over/under');
      const matchesLine = mTotal.includes(mapped.line) || mLabel.includes(mapped.line);
      const matchesSide = market.toLowerCase().includes('over')
        ? mLabel.includes('over')
        : mLabel.includes('under');
      if (matchesMarket && matchesLine && matchesSide) {
        const price = Number(item?.value ?? item?.price);
        if (price && price > 1.01) {
          odd = price;
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({ odd, source: odd ? 'sportmonks_live' : 'not_found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ odd: null, source: 'exception', error: String(e) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
