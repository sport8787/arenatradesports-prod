// update-live-odds — Job dedicado de odds ao vivo.
// Para CADA live_match ativo, popula `odds_live` (1X2 + Over/Under 2.5) usando:
//   1) Futodds /matches-live-full (preferido, ao vivo, atualiza ~1min)
//   2) cached_odds_games (Pinnacle pré-jogo) como fallback para principais ligas
// Roda independente de análise/pressure → garante que o card mostre odds mesmo
// quando o Futodds não conseguir parear o time ou a análise não rodar.
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchFutoddsList } from "../_shared/futoddsCache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normTeam(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|sc|ac|afc|cfc|sk|bk|if|fk|aff|club|cd|ud|ca|cs|gc|do|de|el|la|os|kfum)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pairMatch(a: string, b: string): boolean {
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.includes(shorter)) {
    return shorter.length / longer.length >= 0.55;
  }
  // tolerância: comparar primeira palavra significativa
  const aw = a.split(" ")[0];
  const bw = b.split(" ")[0];
  if (aw && bw && aw === bw && aw.length >= 5) return true;
  return false;
}

function extractFromCachedOdds(bookmakers: any[]):
  | { home: number | null; draw: number | null; away: number | null; over25: number | null; under25: number | null }
  | null {
  if (!Array.isArray(bookmakers) || bookmakers.length === 0) return null;
  // Preferir Pinnacle se houver
  const sorted = [...bookmakers].sort((a, b) => {
    const pa = a?.key === "pinnacle" ? 0 : 1;
    const pb = b?.key === "pinnacle" ? 0 : 1;
    return pa - pb;
  });
  for (const bk of sorted) {
    const markets = bk?.markets || [];
    const h2h = markets.find((m: any) => m?.key === "h2h");
    const totals = markets.find((m: any) => m?.key === "totals");
    if (!h2h && !totals) continue;
    let home: number | null = null, draw: number | null = null, away: number | null = null;
    if (h2h?.outcomes) {
      // outcomes name === home team name (we don't know it here) — caller will infer by mapping
      // Returns raw outcomes; resolution happens outside.
    }
    let over25: number | null = null, under25: number | null = null;
    if (totals?.outcomes) {
      const o = totals.outcomes.find((x: any) => x?.name === "Over" && Number(x?.point) === 2.5);
      const u = totals.outcomes.find((x: any) => x?.name === "Under" && Number(x?.point) === 2.5);
      if (o?.price) over25 = Number(o.price);
      if (u?.price) under25 = Number(u.price);
    }
    return { home, draw, away, over25, under25 } as any;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = performance.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Lista live matches ativos
    const { data: matches, error } = await supabase
      .from("live_matches")
      .select("match_id, home_team, away_team, status, minute, odds_live")
      .eq("status", "live")
      .gt("minute", 0);

    if (error) throw error;
    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, updated: 0, source_breakdown: {}, ms: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Carrega Futodds list (TTL 25s)
    let futoddsList: any[] = [];
    try {
      futoddsList = await fetchFutoddsList("/matches-live-full", { ttlMs: 25_000 });
    } catch (e) {
      console.warn("[UpdateLiveOdds] Futodds fail:", (e as Error).message);
    }

    // 3) Pré-carrega cached_odds_games (Pinnacle) para fallback
    const { data: cachedOdds } = await supabase
      .from("cached_odds_games")
      .select("home_team, away_team, bookmakers")
      .gt("expires_at", new Date().toISOString());

    const cachedList = cachedOdds || [];

    let updated = 0;
    const breakdown: Record<string, number> = { futodds: 0, cached_pre: 0, miss: 0, skipped_fresh: 0 };
    const updates: Array<{ match_id: string; payload: any }> = [];

    for (const m of matches) {
      // Se já tem odds_live e foi atualizado há <50s, pula (poupa quota)
      const existing: any = m.odds_live;
      if (existing?.updated_at) {
        const age = Date.now() - new Date(existing.updated_at).getTime();
        if (age < 50_000) {
          breakdown.skipped_fresh++;
          continue;
        }
      }

      const homeN = normTeam(m.home_team || "");
      const awayN = normTeam(m.away_team || "");

      // 3a) Tenta Futodds
      let payload: any = null;
      if (futoddsList.length > 0) {
        const fd = futoddsList.find((x: any) => {
          const fh = normTeam(x?.home_name || "");
          const fa = normTeam(x?.away_name || "");
          return pairMatch(fh, homeN) && pairMatch(fa, awayN);
        });
        if (fd?.odds_live) {
          const ol = fd.odds_live;
          const flat = {
            home: Number(ol?.home) || null,
            draw: Number(ol?.draw) || null,
            away: Number(ol?.away) || null,
            over25: Number(ol?.over_25) || null,
            under25: Number(ol?.under_25) || null,
            bookmaker: "Futodds",
            updated_at: new Date().toISOString(),
          };
          if (flat.home || flat.draw || flat.away || flat.over25) {
            payload = flat;
            breakdown.futodds++;
          }
        }
      }

      // 3b) Fallback: cached_odds_games (Pinnacle pré-jogo)
      if (!payload && cachedList.length > 0) {
        const cd = cachedList.find((x: any) => {
          const ch = normTeam(x?.home_team || "");
          const ca = normTeam(x?.away_team || "");
          return pairMatch(ch, homeN) && pairMatch(ca, awayN);
        });
        if (cd?.bookmakers) {
          const sorted = [...cd.bookmakers].sort((a: any, b: any) =>
            (a?.key === "pinnacle" ? 0 : 1) - (b?.key === "pinnacle" ? 0 : 1)
          );
          for (const bk of sorted) {
            const markets = bk?.markets || [];
            const h2h = markets.find((mm: any) => mm?.key === "h2h");
            const totals = markets.find((mm: any) => mm?.key === "totals");
            let home: number | null = null, draw: number | null = null, away: number | null = null;
            if (h2h?.outcomes) {
              for (const o of h2h.outcomes) {
                const nm = String(o?.name || "");
                const nn = normTeam(nm);
                if (nm.toLowerCase() === "draw" || nm.toLowerCase() === "empate") draw = Number(o.price) || null;
                else if (pairMatch(nn, homeN)) home = Number(o.price) || null;
                else if (pairMatch(nn, awayN)) away = Number(o.price) || null;
              }
            }
            let over25: number | null = null, under25: number | null = null;
            if (totals?.outcomes) {
              const ov = totals.outcomes.find((x: any) => x?.name === "Over" && Number(x?.point) === 2.5);
              const un = totals.outcomes.find((x: any) => x?.name === "Under" && Number(x?.point) === 2.5);
              if (ov?.price) over25 = Number(ov.price);
              if (un?.price) under25 = Number(un.price);
            }
            if (home || draw || away || over25) {
              payload = {
                home, draw, away, over25, under25,
                bookmaker: `${bk?.title || bk?.key || "Pinnacle"} (pré)`,
                updated_at: new Date().toISOString(),
              };
              breakdown.cached_pre++;
              break;
            }
          }
        }
      }

      if (!payload) {
        breakdown.miss++;
        continue;
      }

      updates.push({ match_id: m.match_id, payload });
    }

    // 4) UPDATE batch (1 por match — RLS via service role)
    for (const u of updates) {
      const { error: upErr } = await supabase
        .from("live_matches")
        .update({ odds_live: u.payload, updated_at: new Date().toISOString() })
        .eq("match_id", u.match_id);
      if (!upErr) updated++;
      else console.warn(`[UpdateLiveOdds] update fail ${u.match_id}: ${upErr.message}`);
    }

    const ms = Math.round(performance.now() - t0);
    console.log(
      `[UpdateLiveOdds] ✅ processed=${matches.length} updated=${updated} ` +
      `futodds=${breakdown.futodds} cached_pre=${breakdown.cached_pre} ` +
      `miss=${breakdown.miss} skipped_fresh=${breakdown.skipped_fresh} ms=${ms}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        processed: matches.length,
        updated,
        source_breakdown: breakdown,
        ms,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error("[UpdateLiveOdds] FATAL:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
