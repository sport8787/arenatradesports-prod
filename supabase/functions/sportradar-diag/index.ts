// Diagnóstico Sportradar — testa qual base URL / produto a chave tem acesso
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('SPORTRADAR_API_KEY');
  if (!key) {
    return new Response(JSON.stringify({ error: 'no key' }), { status: 500, headers: corsHeaders });
  }

  // Trial confirmado: Soccer Base + Soccer Extended Base.
  // Testa rotas e variantes de path para descobrir o endpoint correto de search/competitor.
  const tests = [
    // Schedules (rota leve, valida acesso ao produto)
    'https://api.sportradar.com/soccer/trial/v4/en/schedules/live/summaries.json',
    'https://api.sportradar.com/soccer-extended/trial/v4/en/schedules/live/summaries.json',
    // Competitor profile direto (Palmeiras = sr:competitor:6293) — não precisa de search
    'https://api.sportradar.com/soccer/trial/v4/en/competitors/sr:competitor:6293/profile.json',
    'https://api.sportradar.com/soccer-extended/trial/v4/en/competitors/sr:competitor:6293/profile.json',
    // Summaries de competitor (forma recente)
    'https://api.sportradar.com/soccer/trial/v4/en/competitors/sr:competitor:6293/summaries.json',
    'https://api.sportradar.com/soccer-extended/trial/v4/en/competitors/sr:competitor:6293/summaries.json',
    // Lista de competições (descoberta)
    'https://api.sportradar.com/soccer/trial/v4/en/competitions.json',
  ];

  const results: any[] = [];
  for (const url of tests) {
    try {
      const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}api_key=${key}`, {
        headers: { 'Accept': 'application/json' },
      });
      const text = await r.text();
      results.push({
        url: url.replace(/api_key=[^&]+/, 'api_key=***'),
        status: r.status,
        body_preview: text.slice(0, 200),
      });
    } catch (e) {
      results.push({ url, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
