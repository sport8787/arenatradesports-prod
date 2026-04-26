// Hórus Auto-Bet — Plano Favorito Pré-Live.
// Para cada sinal aprovado (SINAL_FORTE / SINAL_BOM) na tabela
// `sinais_favorito_prelive` que ainda não começou (match_date no futuro),
// insere uma virtual_bets_punter para CADA usuário com banca, se ainda
// não tiver aposta nesse match. Stake 2% da banca, [R$ 1, R$ 50].
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FavSinal {
  id: string;
  fixture_id: string;
  home_team: string;
  away_team: string;
  favorito: string;
  fav_odd: number;
  match_date: string;
  status_vitoria: string;
  status_over15: string;
  status_over25: string;
  score_vitoria: number;
  score_over15: number;
  score_over25: number;
}

const APROVADOS = new Set(['SINAL_FORTE', 'SINAL_BOM']);

function pickMercados(s: FavSinal): Array<{ market: string; odd: number; score: number }> {
  const out: Array<{ market: string; odd: number; score: number }> = [];
  if (APROVADOS.has(s.status_vitoria)) {
    out.push({ market: `Vitória ${s.favorito}`, odd: Number(s.fav_odd), score: s.score_vitoria });
  }
  if (APROVADOS.has(s.status_over15)) {
    // Odd média conservadora para Over 1.5 quando não persistida
    out.push({ market: 'Over 1.5 FT', odd: 1.45, score: s.score_over15 });
  }
  if (APROVADOS.has(s.status_over25)) {
    out.push({ market: 'Over 2.5 FT', odd: 1.85, score: s.score_over25 });
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startedAt = Date.now();
  let totalSignals = 0, totalUsers = 0, totalInserted = 0, totalSkipped = 0;

  try {
    // 1) Sinais aprovados cuja partida ainda não começou (até 36h à frente)
    const nowIso = new Date().toISOString();
    const in36h = new Date(Date.now() + 36 * 3600 * 1000).toISOString();

    const { data: sinaisRaw, error: sigErr } = await supabase
      .from('sinais_favorito_prelive')
      .select('id, fixture_id, home_team, away_team, favorito, fav_odd, match_date, status_vitoria, status_over15, status_over25, score_vitoria, score_over15, score_over25')
      .gte('match_date', nowIso)
      .lte('match_date', in36h)
      .order('match_date', { ascending: true });

    if (sigErr) throw sigErr;

    const sinais = (sinaisRaw || []).filter((s: any) =>
      APROVADOS.has(s.status_vitoria) || APROVADOS.has(s.status_over15) || APROVADOS.has(s.status_over25),
    ) as FavSinal[];

    totalSignals = sinais.length;

    if (sinais.length === 0) {
      return new Response(JSON.stringify({ ok: true, totalSignals, totalUsers, totalInserted, durationMs: Date.now() - startedAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Usuários com banca > R$ 1
    const { data: bankrolls, error: brErr } = await supabase
      .from('user_bankroll')
      .select('user_id, balance')
      .gt('balance', 1);

    if (brErr) throw brErr;
    totalUsers = bankrolls?.length || 0;

    if (!bankrolls || bankrolls.length === 0) {
      return new Response(JSON.stringify({ ok: true, totalSignals, totalUsers, totalInserted, durationMs: Date.now() - startedAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Para cada sinal × mercado × usuário → criar bet se não existir
    for (const sig of sinais) {
      const matchName = `${sig.home_team} vs ${sig.away_team}`;
      const matchId = String(sig.fixture_id);
      const mercados = pickMercados(sig);

      for (const m of mercados) {
        // Quem já apostou neste match + market?
        const { data: existing } = await supabase
          .from('virtual_bets_punter')
          .select('user_id')
          .eq('match_id', matchId)
          .eq('market', m.market)
          .in('status', ['pending', 'green', 'red']);
        const userIdsWithBet = new Set((existing || []).map((b: any) => b.user_id));

        for (const br of bankrolls) {
          if (userIdsWithBet.has(br.user_id)) { totalSkipped++; continue; }

          const stake = Math.max(1, Math.min(50, +(Number(br.balance) * 0.02).toFixed(2)));
          if (stake > Number(br.balance)) { totalSkipped++; continue; }

          const { error: insErr } = await supabase
            .from('virtual_bets_punter')
            .insert({
              user_id: br.user_id,
              match_id: matchId,
              match_name: matchName,
              market: m.market,
              odd: Number(m.odd),
              stake,
              status: 'pending',
              commence_time: sig.match_date,
              thesis: `Plano Favorito Pré-Live • Score ${m.score}/100`,
            } as any);

          if (insErr) {
            if ((insErr as any).code === '23505') { totalSkipped++; continue; }
            console.warn('[HorusAutoBetFavorito] insert err', br.user_id, insErr.message);
            continue;
          }

          await supabase.rpc('deduct_bankroll', { p_user_id: br.user_id, p_amount: stake });
          totalInserted++;
        }
      }
    }

    const summary = { ok: true, totalSignals, totalUsers, totalInserted, totalSkipped, durationMs: Date.now() - startedAt };
    console.log('[HorusAutoBetFavorito]', JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[HorusAutoBetFavorito] FATAL', e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
