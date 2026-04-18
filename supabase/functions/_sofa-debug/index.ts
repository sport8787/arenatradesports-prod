import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async () => {
  const date = new Date().toISOString().split('T')[0];
  const url = `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${date}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.sofascore.com/',
      'Origin': 'https://www.sofascore.com',
    },
  });
  const text = await r.text();
  return new Response(JSON.stringify({
    status: r.status,
    contentType: r.headers.get('content-type'),
    bodyPreview: text.substring(0, 500),
    bodyLength: text.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
