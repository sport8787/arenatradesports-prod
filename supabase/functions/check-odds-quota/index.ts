import { createClient } from 'npm:@supabase/supabase-js@2';
import { recordOddsApiUsage } from "../_shared/oddsApiQuota.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY');
    if (!oddsApiKey) {
      return new Response(JSON.stringify({ error: 'THE_ODDS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${oddsApiKey}`
    );

    const remainingRequests = res.headers.get('x-requests-remaining');
    const usedRequests = res.headers.get('x-requests-used');

    // Persiste no DB + dispara alerta Telegram se < 500.
    await recordOddsApiUsage(res.headers);

    return new Response(JSON.stringify({
      requests_remaining: remainingRequests,
      requests_used: usedRequests,
      status: res.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
