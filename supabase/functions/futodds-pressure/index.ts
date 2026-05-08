// futodds-pressure — Timeline de pressão a partir de Futodds.
// Constrói minutos 0..N usando: stats acumulados, pressure_indices e janelas
// last5min/last10min/last15min/last20min. Devolve PressureData compatível com
// o frontend (mesmo shape do sportmonks-pressure).
// Cache 30s compartilhado de /matches-betfair-live (ver _shared/futoddsCache.ts).
import { fetchFutoddsList } from "../_shared/futoddsCache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  home?: string;
  away?: string;
  commence_time?: string;
  fixtureId?: number | string;
  event_id?: number | string;
}

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, "X-API-Key": key, Accept: "application/json" };
}

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
}

interface TimelinePoint { minute: number; home: number; away: number; }

/** Pressão por janela: combina dangerous_attacks + on_target * 3 + corners * 2. */
function pressureFromWindow(w: any): { home: number; away: number } {
  if (!w) return { home: 0, away: 0 };
  const fn = (s: any) => (Number(s?.dangerous_attacks) || 0) * 1.5
    + (Number(s?.on_target) || 0) * 3 + (Number(s?.corners) || 0) * 2
    + (Number(s?.attacks) || 0) * 0.3;
  return { home: fn(w.home), away: fn(w.away) };
}

/** Normaliza pressão para escala 0..100. */
function scale(v: number) {
  return Math.max(0, Math.min(100, Math.round(v * 4)));
}

function buildTimeline(match: any): TimelinePoint[] {
  const minute = Math.max(0, Math.min(120, Number(match?.elapsed) || 0));
  if (minute === 0) return [];

  const w5 = pressureFromWindow(match.last5min_stats);
  const w10 = pressureFromWindow(match.last10min_stats);
  const w15 = pressureFromWindow(match.last15min_stats);
  const w20 = pressureFromWindow(match.last20min_stats);

  // Pressure indices oficiais (média do jogo todo)
  const pi = match.pressure_indices || {};
  const baseHome = Number(pi?.home?.pi1) || Number(pi?.home?.appm) * 50 || 0;
  const baseAway = Number(pi?.away?.pi1) || Number(pi?.away?.appm) * 50 || 0;

  const out: TimelinePoint[] = [];
  for (let m = 0; m <= minute; m++) {
    const ago = minute - m;
    let home: number, away: number;
    if (ago <= 5) { home = w5.home; away = w5.away; }
    else if (ago <= 10) { home = w10.home; away = w10.away; }
    else if (ago <= 15) { home = w15.home; away = w15.away; }
    else if (ago <= 20) { home = w20.home; away = w20.away; }
    else { home = baseHome / 4; away = baseAway / 4; }
    // Pequena variação determinística por minuto para visual orgânico
    const jitter = ((m * 37) % 7) - 3;
    out.push({ minute: m, home: scale(home + jitter), away: scale(away + jitter) });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const KEY = Deno.env.get("FUTODDS_API_KEY");
  if (!KEY) {
    return new Response(JSON.stringify({ error: "no_key" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body = {};
  try { body = await req.json(); } catch { /* ok */ }

  try {
    // Cache 30s compartilhado, dedup automático para múltiplas requisições simultâneas.
    const list = await fetchFutoddsList("/matches-betfair-live", { ttlMs: 30_000 });

    let match: any = null;
    if (body.event_id) match = list.find((m) => String(m.eventId ?? m.event_id) === String(body.event_id));
    if (!match && body.fixtureId) match = list.find((m) => String(m.id) === String(body.fixtureId));
    if (!match && body.home && body.away) {
      const h = norm(body.home), a = norm(body.away);
      match = list.find((m) => norm(m.home_name).includes(h) && norm(m.away_name).includes(a))
           || list.find((m) => h.includes(norm(m.home_name)) && a.includes(norm(m.away_name)));
    }

    if (!match) {
      // Devolve payload vazio compatível para o front cair em fallback
      return new Response(JSON.stringify({
        fixtureId: 0, source: "trends",
        header: {
          home: { id: 0, name: body.home || "", logo: "" },
          away: { id: 0, name: body.away || "", logo: "" },
          score: { home: 0, away: 0 }, state: "NS", minute: 0,
        },
        timeline: [], events: [], form: { home: [], away: [] },
        _futodds: { not_found: true, searched: list.length },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const minute = Math.max(0, Math.min(120, Number(match.elapsed) || 0));
    const timeline = buildTimeline(match);

    const payload = {
      fixtureId: Number(match.eventId ?? match.event_id ?? match.id) || 0,
      source: "pressure" as const,
      header: {
        home: { id: Number(match.home_id) || 0, name: match.home_name || "", logo: "" },
        away: { id: Number(match.away_id) || 0, name: match.away_name || "", logo: "" },
        score: { home: Number(match.home_goals) || 0, away: Number(match.away_goals) || 0 },
        state: minute >= 90 ? "FT" : minute >= 46 ? "2H" : minute === 45 ? "HT" : "1H",
        minute,
      },
      timeline,
      events: [], // gols/cartões reais ficam para uma segunda iteração via /matches-live-events
      form: { home: [], away: [] },
      _futodds: {
        pressure_indices: match.pressure_indices,
        last5min: match.last5min_stats,
        last10min: match.last10min_stats,
        last15min: match.last15min_stats,
        last20min: match.last20min_stats,
        stats: match.stats,
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
