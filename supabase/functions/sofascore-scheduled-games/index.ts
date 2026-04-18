import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_V2 = 'https://api.firecrawl.dev/v2';

function relevanceFor(tournamentName: string, categoryName: string): number {
  const t = (tournamentName || '').toLowerCase();
  const c = (categoryName || '').toLowerCase();
  if (t.includes('libertadores') || t.includes('champions league') || t.includes('copa do brasil')) return 5;
  if (t.includes('brasileir') || t.includes('premier league') || t.includes('laliga') || t.includes('la liga')) return 5;
  if (t.includes('série a') || t.includes('serie a')) return 5;
  if (t.includes('série b') || t.includes('serie b') || t.includes('sul-americana') || t.includes('europa league') || t.includes('bundesliga') || t.includes('ligue 1')) return 4;
  if (t.includes('copa') || t.includes('cup')) return 4;
  if (t.includes('mls') || t.includes('liga mx')) return 4;
  if (t.includes('carioca') || t.includes('paulist') || t.includes('gaúcho') || t.includes('mineiro') || t.includes('serie c')) return 3;
  if (c.includes('brazil') || c.includes('brasil')) return 3;
  return 2;
}

interface ParsedMatch {
  league: string;
  country: string;
  home: string;
  away: string;
  time: string;       // HH:MM (UTC ou local conforme SofaScore — assumimos UTC)
  matchId: string;
}

/**
 * Parseia o markdown da página /football/{date} do SofaScore.
 * Estrutura (simplificada):
 *   [LIGA](.../tournament/{country}/{slug}/{id}) [PAÍS](.../football/{country})
 *   N (count)
 *   [HH:MM\n-\n![home img]\nHomeName\n![away img]\nAwayName](.../match/{slug}#id:{matchId})
 */
function parseSofaMarkdown(md: string): ParsedMatch[] {
  const out: ParsedMatch[] = [];
  if (!md) return out;

  // Regex para blocos de liga: captura nome da liga e nome do país nos dois primeiros links da linha
  // Ex: [MLS](https://...tournament/usa/mls/242) [USA](https://...football/usa)
  const leagueRe = /\[([^\]]+)\]\(https:\/\/www\.sofascore\.com\/football\/tournament\/([^)\s]+)\)\s*\[([^\]]+)\]\(https:\/\/www\.sofascore\.com\/football\/[^)\s]+\)/g;

  // Regex para partidas: o link contém HH:MM e termina com #id:NUMERO
  // O texto interno tem padrão: HH:MM\\\n\\\n-\\\n\\\n![alt]...\\\nHomeName\\\n\\\n![alt]...\\\nAwayName
  const matchRe = /\[(\d{1,2}:\d{2})[\s\S]*?#id:(\d+)\)/g;

  // Pegamos as posições dos cabeçalhos de liga, e depois das partidas, e atribuímos cada partida
  // à liga cujo cabeçalho está imediatamente antes dela.
  const leagueMarkers: { pos: number; league: string; country: string }[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = leagueRe.exec(md)) !== null) {
    leagueMarkers.push({
      pos: lm.index,
      league: lm[1].trim(),
      country: lm[3].trim(),
    });
  }

  let mm: RegExpExecArray | null;
  while ((mm = matchRe.exec(md)) !== null) {
    const matchPos = mm.index;
    const time = mm[1];
    const matchId = mm[2];

    // Achar a liga mais próxima ANTES desta posição
    let leagueInfo = { league: 'Unknown', country: '' };
    for (let i = leagueMarkers.length - 1; i >= 0; i--) {
      if (leagueMarkers[i].pos < matchPos) {
        leagueInfo = leagueMarkers[i];
        break;
      }
    }

    // Extrair home/away do bloco interno do link
    // Pegamos o conteúdo do link entre [ e ](
    const linkStart = matchPos + 1; // após '['
    const linkEnd = md.indexOf('](', linkStart);
    if (linkEnd === -1) continue;
    const inner = md.substring(linkStart, linkEnd);

    // O bloco interno tem o formato (separadores: \\ + newline, repetidos):
    //   13:00\\
    //   \\
    //   -\\
    //   \\
    //   ![Home Logo](...)\\
    //   \\
    //   HomeName\\
    //   \\
    //   ![Away Logo](...)\\
    //   \\
    //   AwayName
    // Estratégia: remover todos os '\' e quebrar por \n, depois filtrar.
    const cleaned = inner.replace(/\\+/g, '');
    const lines = cleaned.split(/\n+/)
      .map(s => s.trim())
      .filter(s => s && s !== '-' && !s.startsWith('!') && !/^\d{1,2}:\d{2}$/.test(s));

    if (lines.length < 2) continue;
    const home = lines[0];
    const away = lines[1];

    out.push({
      league: leagueInfo.league,
      country: leagueInfo.country,
      home,
      away,
      time,
      matchId,
    });
  }

  return out;
}

async function scrapePage(url: string, apiKey: string, maxAge = 0): Promise<string | null> {
  const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      maxAge,
    }),
  });
  if (!r.ok) {
    console.warn(`[SofaScheduled] Firecrawl ${r.status} for ${url}`);
    return null;
  }
  const j = await r.json();
  return j.data?.markdown || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const dates = [
      today.toISOString().split('T')[0],
      tomorrow.toISOString().split('T')[0],
    ];

    const allParsed: ParsedMatch[] = [];
    for (const d of dates) {
      const md = await scrapePage(`https://www.sofascore.com/football/${d}`, FIRECRAWL_API_KEY);
      if (md) {
        const parsed = parseSofaMarkdown(md);
        console.log(`[SofaScheduled] ${d}: parsed ${parsed.length} matches (md ${md.length} chars)`);
        // Anexar a data nos objetos
        parsed.forEach(p => allParsed.push({ ...p, time: `${d}T${p.time}:00Z` as any }));
      } else {
        console.warn(`[SofaScheduled] ${d}: no markdown`);
      }
    }

    const now = Date.now();
    const max = now + 26 * 3600 * 1000;
    let inserted = 0;

    for (const m of allParsed) {
      try {
        const matchDate = new Date(m.time);
        const startMs = matchDate.getTime();
        if (!startMs || startMs < now - 30 * 60000 || startMs > max) continue;

        const dateStr = matchDate.toISOString().split('T')[0];
        const timeStr = matchDate.toISOString().slice(11, 16);
        const status = startMs <= now ? 'live' : 'scheduled';

        const { error } = await supabase.from('scheduled_games').upsert({
          match_date: dateStr,
          match_time: timeStr,
          match_datetime: matchDate.toISOString(),
          league_name: `${m.league}${m.country ? ` (${m.country})` : ''}`,
          home_team: m.home,
          away_team: m.away,
          event_id: `sofa_${m.matchId}`,
          match_id: `sofa_${m.matchId}`,
          status,
          check_time: new Date(startMs - 15 * 60000).toISOString(),
          relevance_score: relevanceFor(m.league, m.country),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'match_date,match_time,home_team,away_team' });

        if (!error) inserted++;
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({ ok: true, source: 'sofascore-via-firecrawl', total_events: allParsed.length, inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[SofaScheduled] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
