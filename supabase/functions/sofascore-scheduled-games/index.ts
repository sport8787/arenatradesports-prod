import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  // Para cada `#id:NUMERO)` encontramos o `](https://www.sofascore.com/football/match/...`
  // imediatamente antes (esse é o REAL fechamento do link da partida) e em seguida o `[` que
  // o abre — identificado pelo padrão `[HH:MM\` retroativamente.
  const idRe = /#id:(\d+)\)/g;
  let im: RegExpExecArray | null;
  while ((im = idRe.exec(md)) !== null) {
    const idEnd = im.index;
    const matchId = im[1];

    const matchUrlIdx = md.lastIndexOf('](https://www.sofascore.com/football/match/', idEnd);
    if (matchUrlIdx === -1) continue;

    // Buscar `[HH:MM` na janela imediatamente anterior ao matchUrlIdx
    const window = md.substring(Math.max(0, matchUrlIdx - 1500), matchUrlIdx);
    const openMatch = window.match(/\[(\d{1,2}:\d{2})[\s\S]*$/);
    if (!openMatch) continue;
    const time = openMatch[1];
    const innerStart = matchUrlIdx - openMatch[0].length + 1; // pula '['
    const inner = md.substring(innerStart, matchUrlIdx);

    let leagueInfo = { league: 'Unknown', country: '' };
    for (let i = leagueMarkers.length - 1; i >= 0; i--) {
      if (leagueMarkers[i].pos < innerStart) {
        leagueInfo = leagueMarkers[i];
        break;
      }
    }

    // Remove backslashes, imagens markdown ![...](...) e links ](http...)
    const cleaned = inner
      .replace(/\\+/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '\n')
      .replace(/\]\(https?:[^)]*\)?/g, '\n')
      .replace(/\[[^\]]*\]/g, '\n');
    const lines = cleaned.split(/\n+/)
      .map(s => s.replace(/^[\s\-\[\]()!]+|[\s\-\[\]()!]+$/g, '').trim())
      .filter(s =>
        s &&
        s !== '-' &&
        !s.startsWith('!') &&
        !/^\d{1,2}:\d{2}/.test(s) &&
        !/^https?:/i.test(s) &&
        !s.startsWith('(') &&
        s.length >= 2
      );
    if (lines.length < 2) continue;

    out.push({
      league: leagueInfo.league,
      country: leagueInfo.country,
      home: lines[0],
      away: lines[1],
      time,
      matchId,
    });
  }

  return out;
}

async function scrapePage(url: string, apiKey: string, maxAge = 0): Promise<string | null> {
  // Retry até 3x com backoff em caso de 5xx ou timeout (Firecrawl falha frequente em /football/{date})
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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
      if (r.ok) {
        const j = await r.json();
        const md = j.data?.markdown || null;
        if (md && md.length > 1000) return md;
        console.warn(`[SofaScheduled] Empty/short markdown for ${url} (attempt ${attempt})`);
      } else {
        console.warn(`[SofaScheduled] Firecrawl ${r.status} for ${url} (attempt ${attempt}/3)`);
        // 4xx não-recuperável (exceto 429): não retry
        if (r.status >= 400 && r.status < 500 && r.status !== 429) return null;
      }
    } catch (e) {
      console.warn(`[SofaScheduled] Fetch exception for ${url} (attempt ${attempt}/3):`, e);
    }
    if (attempt < 3) await new Promise(res => setTimeout(res, 1500 * attempt));
  }
  return null;
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

    // Janela de 72h: hoje + amanhã + depois — garante que cron Punter sempre tem jogos pra analisar
    const today = new Date();
    const dates = [0, 1, 2, 3].map(offset => {
      const d = new Date(today.getTime() + offset * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    });

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
    const max = now + 72 * 3600 * 1000; // 72h à frente — não descartar jogos do dia seguinte/depois
    let inserted = 0;
    let skippedFuture = 0;
    let skippedPast = 0;

    // Build payloads first, then batch upsert with ignoreDuplicates.
    // Antes: cada execução horária reescrevia ~todas as linhas (write amplification gigante).
    // Agora: só insere fixtures novos; transições de status vivem em live_matches.
    const payloads: any[] = [];
    for (const m of allParsed) {
      const matchDate = new Date(m.time);
      const startMs = matchDate.getTime();
      if (!startMs) continue;
      if (startMs < now - 30 * 60000) { skippedPast++; continue; }
      if (startMs > max) { skippedFuture++; continue; }

      const dateStr = matchDate.toISOString().split('T')[0];
      const timeStr = matchDate.toISOString().slice(11, 16);
      const status = startMs <= now ? 'live' : 'scheduled';

      payloads.push({
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
      });
    }

    const CHUNK = 200;
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const slice = payloads.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('scheduled_games')
        .upsert(slice, {
          onConflict: 'match_date,match_time,home_team,away_team',
          ignoreDuplicates: true,
        });
      if (!error) inserted += slice.length;
      else console.warn('[SofaScheduled] batch upsert error:', error.message);
    }

    console.log(`[SofaScheduled] Done: ${allParsed.length} parsed, ${inserted} inserted, ${skippedPast} past, ${skippedFuture} too far`);
    return new Response(
      JSON.stringify({
        ok: true,
        source: 'sofascore-via-firecrawl',
        dates_scanned: dates,
        total_events: allParsed.length,
        inserted,
        skipped_past: skippedPast,
        skipped_too_far: skippedFuture,
      }),
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
