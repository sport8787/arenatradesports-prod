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
  // Testa cada URL com 2 métodos de auth: query param e header x-api-key
  for (const url of tests) {
    for (const mode of ['query', 'header'] as const) {
      try {
        const fetchUrl = mode === 'query'
          ? `${url}${url.includes('?') ? '&' : '?'}api_key=${key}`
          : url;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (mode === 'header') headers['x-api-key'] = key;
        const r = await fetch(fetchUrl, { headers });
        const text = await r.text();
        results.push({
          url: url.replace(/api_key=[^&]+/, 'api_key=***'),
          auth_mode: mode,
          status: r.status,
          body_preview: text.slice(0, 150),
        });
      } catch (e) {
        results.push({ url, auth_mode: mode, error: String(e) });
      }
      await new Promise(r => setTimeout(r, 1100));
    }
  }
  // Adiciona key length/preview pra confirmar que não tem espaços
  const keyInfo = { length: key.length, first4: key.slice(0, 4), last4: key.slice(-4), trimmed_equal: key === key.trim() };

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
