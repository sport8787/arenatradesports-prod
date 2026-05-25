// sportmonks-pressure
// Retorna timeline de pressão (Pressure Index oficial OU fallback Trends sintético),
// eventos (gols + cartões vermelhos), forma recente e header (placar/minuto/escudos).
//
// Body JSON: { home: string, away: string, commence_time?: string, fixtureId?: number }
// - Se fixtureId vier, usa direto.
// - Senão, busca por nome dos times + janela de ±36h ao redor de commence_time.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SM_TOKEN = Deno.env.get("SPORTMONKS_API_KEY") || "";
const SM_BASE = "https://api.sportmonks.com/v3";

// ─── Cache em memória (sobrevive enquanto a instância da edge estiver viva) ───
type CacheEntry = { expires: number; payload: any };
const responseCache = new Map<string, CacheEntry>();
const RESPONSE_TTL_MS = 60_000; // 60s por par home|away

// Backoff global quando o Sportmonks devolve 429
let rateLimitedUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60_000; // 5 min sem bater na API

function smUrl(path: string, params: Record<string, string> = {}): string {
  const u = new URL(SM_BASE + path);
  u.searchParams.set("api_token", SM_TOKEN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function smFetch(url: string): Promise<Response | null> {
  if (Date.now() < rateLimitedUntil) return null;
  const r = await fetch(url);
  if (r.status === 429) {
    rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    console.warn(`[sportmonks-pressure] 429 — backoff até ${new Date(rateLimitedUntil).toISOString()}`);
  }
  return r;
}

function normalizeTeamName(name: string): string[] {
  const variants = new Set<string>();
  variants.add(name);
  let v = name.replace(/\s*[-/]\s*(SP|RJ|MG|BA|RS|PR|PE|CE|GO|DF|ES|SC|MT|MS|PA|PB|RN|AL|MA|PI|TO|AM|RO|AC|RR|AP|SE)\b/i, "").trim();
  variants.add(v);
  v = v.replace(/^(CA|SC|FC|CD|CR|EC|AA|SE|AD|RB|CF|SD|UD|CS|AS|US|FK|SK)\s+/i, "").trim();
  variants.add(v);
  return Array.from(variants).filter(Boolean);
}

async function searchTeamId(name: string): Promise<number | null> {
  for (const variant of normalizeTeamName(name)) {
    try {
      const url = smUrl(`/football/teams/search/${encodeURIComponent(variant)}`);
      const r = await smFetch(url); if (!r) { console.warn("[sportmonks-pressure] skipping due to global rate-limit cooldown"); return null; }
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.warn(`[sportmonks-pressure] searchTeam "${variant}" -> HTTP ${r.status}: ${body.slice(0, 200)}`);
        continue;
      }
      const j = await r.json();
      const t = j.data?.[0];
      if (t?.id) {
        console.log(`[sportmonks-pressure] team "${variant}" -> id=${t.id} name="${t.name}"`);
        return t.id;
      }
      console.log(`[sportmonks-pressure] team "${variant}" -> no results`);
    } catch (e) {
      console.warn(`[sportmonks-pressure] searchTeam "${variant}" exception: ${(e as Error).message}`);
    }
  }
  return null;
}

async function findFixture(home: string, away: string, commenceTime?: string): Promise<number | null> {
  const homeId = await searchTeamId(home);
  if (!homeId) {
    console.warn(`[sportmonks-pressure] homeId not found for "${home}"`);
    return null;
  }
  const center = commenceTime ? new Date(commenceTime) : new Date();
  const from = new Date(center.getTime() - 36 * 3600_000).toISOString().slice(0, 10);
  const to = new Date(center.getTime() + 36 * 3600_000).toISOString().slice(0, 10);
  try {
    const url = smUrl(`/football/fixtures/between/${from}/${to}/${homeId}`, {
      include: "participants",
      per_page: "30",
    });
    const r = await smFetch(url); if (!r) { console.warn("[sportmonks-pressure] skipping due to global rate-limit cooldown"); return null; }
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn(`[sportmonks-pressure] fixtures between -> HTTP ${r.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const j = await r.json();
    const awayNorm = away.toLowerCase();
    const list: any[] = j.data || [];
    console.log(`[sportmonks-pressure] fixtures between ${from}..${to} for ${homeId}: ${list.length} hits`);
    const match = list.find((f) => {
      const parts = f.participants || [];
      return parts.some((p: any) => {
        const n = (p.name || "").toLowerCase();
        return n.includes(awayNorm.split(" ")[0]) || awayNorm.includes(n.split(" ")[0]);
      });
    });
    return match?.id ?? list[0]?.id ?? null;
  } catch (e) {
    console.warn(`[sportmonks-pressure] findFixture exception: ${(e as Error).message}`);
    return null;
  }
}

interface TimelinePoint { minute: number; home: number; away: number; }

// ─── Pressure Index oficial (add-on pago) ────────────────────────────
function parsePressureIndex(fixture: any, homeId: number): TimelinePoint[] | null {
  const pressure = fixture?.pressure || fixture?.pressureIndex;
  if (!pressure || !Array.isArray(pressure)) return null;
  // Estrutura típica: [{ minute, participant_id, value }, ...]
  const byMinute = new Map<number, { home: number; away: number }>();
  for (const p of pressure) {
    const m = Number(p.minute ?? p.time);
    if (!Number.isFinite(m)) continue;
    const isHome = Number(p.participant_id) === homeId;
    const v = Number(p.value ?? p.pressure ?? 0);
    if (!byMinute.has(m)) byMinute.set(m, { home: 0, away: 0 });
    const e = byMinute.get(m)!;
    if (isHome) e.home = v; else e.away = v;
  }
  if (byMinute.size === 0) return null;
  return Array.from(byMinute.entries())
    .sort(([a], [b]) => a - b)
    .map(([minute, v]) => ({ minute, home: v.home, away: v.away }));
}

// ─── Fallback: índice sintético a partir de Trends ───────────────────
// Combina dangerous_attacks (peso 0.5) + shots_on_target (1.5) + possession (0.2) + xg (3)
function buildPressureFromTrends(fixture: any, homeId: number): TimelinePoint[] {
  const trends = fixture?.trends || [];
  if (!Array.isArray(trends) || trends.length === 0) return [];

  const WEIGHTS: Record<string, number> = {
    "dangerous-attacks": 0.5, "dangerous_attacks": 0.5,
    "shots-on-target": 1.5, "shots_on_target": 1.5,
    "ball-possession": 0.2, "ball_possession": 0.2, "possession": 0.2,
    "expected-goals": 3, "expected_goals": 3, "xg": 3,
    "attacks": 0.2,
  };

  // trends[i] = { type:{code/developer_name}, participant_id, data:[{minute,value}] }
  const buckets = new Map<number, { home: number; away: number }>();

  for (const t of trends) {
    const code: string = (t.type?.developer_name || t.type?.code || t.code || "").toLowerCase();
    const w = WEIGHTS[code];
    if (!w) continue;
    const isHome = Number(t.participant_id) === homeId;
    const series = t.data || [];
    let prev = 0;
    for (const pt of series) {
      const minute = Number(pt.minute);
      const value = Number(pt.value ?? 0);
      if (!Number.isFinite(minute)) continue;
      // converte cumulativos em incrementos por minuto (suaviza)
      const delta = Math.max(0, value - prev);
      prev = value;
      if (!buckets.has(minute)) buckets.set(minute, { home: 0, away: 0 });
      const b = buckets.get(minute)!;
      if (isHome) b.home += delta * w; else b.away += delta * w;
    }
  }

  if (buckets.size === 0) return [];

  // Suaviza com janela móvel de 3min e normaliza para 0-100
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a - b);
  const minutes = sorted.map(([m]) => m);
  const minM = Math.min(...minutes);
  const maxM = Math.max(...minutes, 90);
  const dense: TimelinePoint[] = [];
  for (let m = Math.max(0, minM); m <= maxM; m++) {
    const b = buckets.get(m) || { home: 0, away: 0 };
    dense.push({ minute: m, home: b.home, away: b.away });
  }
  // média móvel 3'
  const smooth = dense.map((p, i) => {
    const slice = dense.slice(Math.max(0, i - 2), i + 1);
    const home = slice.reduce((s, x) => s + x.home, 0) / slice.length;
    const away = slice.reduce((s, x) => s + x.away, 0) / slice.length;
    return { minute: p.minute, home, away };
  });
  // normaliza para 0-100 com base no pico combinado
  const peak = Math.max(1, ...smooth.map((p) => Math.max(p.home, p.away)));
  return smooth.map((p) => ({
    minute: p.minute,
    home: Math.round((p.home / peak) * 100),
    away: Math.round((p.away / peak) * 100),
  }));
}

// ─── xG acumulado por minuto (a partir de trends) ────────────────────
// Retorna a curva cumulativa de xG home/away para sobrepor no gráfico
// de pressão e explicar divergências entre pressão e placar.
function buildXgTimeline(fixture: any, homeId: number): TimelinePoint[] {
  const trends = fixture?.trends || [];
  if (!Array.isArray(trends) || trends.length === 0) return [];
  const XG_CODES = new Set(["expected-goals", "expected_goals", "xg"]);
  const buckets = new Map<number, { home: number; away: number }>();
  for (const t of trends) {
    const code: string = (t.type?.developer_name || t.type?.code || t.code || "").toLowerCase();
    if (!XG_CODES.has(code)) continue;
    const isHome = Number(t.participant_id) === homeId;
    const series = t.data || [];
    for (const pt of series) {
      const minute = Number(pt.minute);
      const value = Number(pt.value ?? 0);
      if (!Number.isFinite(minute)) continue;
      if (!buckets.has(minute)) buckets.set(minute, { home: 0, away: 0 });
      const b = buckets.get(minute)!;
      // valores do Sportmonks já vêm cumulativos; mantém o maior visto até aqui
      if (isHome) b.home = Math.max(b.home, value); else b.away = Math.max(b.away, value);
    }
  }
  if (buckets.size === 0) return [];
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a - b);
  const maxM = Math.max(90, ...sorted.map(([m]) => m));
  let curH = 0, curA = 0;
  const out: TimelinePoint[] = [];
  for (let m = 0; m <= maxM; m++) {
    const b = buckets.get(m);
    if (b) { curH = Math.max(curH, b.home); curA = Math.max(curA, b.away); }
    out.push({ minute: m, home: +curH.toFixed(2), away: +curA.toFixed(2) });
  }
  return out;
}

// Header / placar / forma / eventos
function extractHeader(fixture: any) {
  const parts = fixture?.participants || [];
  const home = parts.find((p: any) => p.meta?.location === "home") || parts[0];
  const away = parts.find((p: any) => p.meta?.location === "away") || parts[1];
  const scores = fixture?.scores || [];
  const ftHome = scores.find((s: any) => s.description === "CURRENT" && s.score?.participant === "home")?.score?.goals
    ?? scores.find((s: any) => s.description === "CURRENT")?.score?.goals
    ?? 0;
  const ftAway = scores.find((s: any) => s.description === "CURRENT" && s.score?.participant === "away")?.score?.goals
    ?? 0;
  // estado
  const state = fixture?.state?.short_name || fixture?.state?.name || "";
  // minuto: pega periods atual
  const period = (fixture?.periods || []).find((p: any) => p.ticking) || {};
  const minute = Number(period.minutes ?? 0);
  return {
    home: { id: home?.id, name: home?.name, logo: home?.image_path },
    away: { id: away?.id, name: away?.name, logo: away?.image_path },
    score: { home: ftHome, away: ftAway },
    state,
    minute,
  };
}

function extractEvents(fixture: any, homeId: number) {
  const list = fixture?.events || [];
  // Sportmonks v3 type_ids comuns: 14=Goal, 15=Own Goal, 16=Penalty,
  // 17=Missed Penalty, 18=Substitution, 19=Yellow Card, 20=Red Card,
  // 21=Yellowred Card, 26=Goal Cancelled.
  const GOAL_IDS = new Set([14, 15, 16, 26]);
  const RED_IDS = new Set([20, 21]);
  return list
    .map((e: any) => {
      const tName = (e.type?.name || e.type?.code || e.type?.developer_name || "").toLowerCase();
      const tId = Number(e.type_id ?? e.type?.id ?? 0);
      const isGoal = GOAL_IDS.has(tId) || tName.includes("goal");
      const isRed = RED_IDS.has(tId) || tName.includes("redcard") || tName === "red card" || tName.includes("red_card") || tName.includes("yellowred");
      if (!isGoal && !isRed) return null;
      return {
        minute: Number(e.minute ?? 0),
        type: isGoal ? "goal" : "red",
        side: Number(e.participant_id) === homeId ? "home" : "away",
        player: e.player_name || e.player?.name || "",
      };
    })
    .filter((e: any) => e !== null)
    .sort((a: any, b: any) => a.minute - b.minute);
}

async function fetchForm(teamId: number, n = 5): Promise<("W" | "D" | "L")[]> {
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
    const r = await smFetch(smUrl(`/football/fixtures/between/${from}/${to}/${teamId}`, {
      include: "scores;participants;state",
      per_page: "30",
    }));
    if (!r || !r.ok) return [];
    const j = await r.json();
    const finished = (j.data || []).filter((f: any) => {
      const s = (f.state?.short_name || "").toUpperCase();
      return s === "FT" || s === "AET" || s === "PEN";
    });
    return finished.slice(-n).map((f: any) => {
      const home = (f.participants || []).find((p: any) => p.meta?.location === "home");
      const isHome = home?.id === teamId;
      const scores = f.scores || [];
      const cur = scores.find((s: any) => s.description === "CURRENT");
      const hg = cur?.score?.goals && cur?.score?.participant === "home" ? cur.score.goals : 0;
      const ag = cur?.score?.goals && cur?.score?.participant === "away" ? cur.score.goals : 0;
      const my = isHome ? hg : ag;
      const op = isHome ? ag : hg;
      if (my > op) return "W";
      if (my < op) return "L";
      return "D";
    });
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!SM_TOKEN) {
    return new Response(JSON.stringify({ error: "SPORTMONKS_API_KEY ausente" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { home, away, commence_time, fixtureId: providedId } = body || {};

    // ─── Cache hit?
    const cacheKey = providedId
      ? `id:${providedId}`
      : `${(home || "").toLowerCase()}|${(away || "").toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return new Response(JSON.stringify({ ...cached.payload, cached: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper para responder vazio (sem dados) — usado em fixture-not-found e rate-limit
    const emptyPayload = (reason: string) => ({
      fixtureId: null,
      source: "none" as const,
      reason,
      header: {
        home: { id: 0, name: home || "", logo: "" },
        away: { id: 0, name: away || "", logo: "" },
        score: { home: 0, away: 0 },
        state: "",
        minute: 0,
      },
      timeline: [],
      events: [],
      form: { home: [], away: [] },
    });

    // Se a API estiver em cooldown, devolve vazio sem bater nela
    if (Date.now() < rateLimitedUntil) {
      const payload = emptyPayload("rate_limited");
      // cache curtinho pra distribuir o alívio
      responseCache.set(cacheKey, { expires: Date.now() + 30_000, payload });
      return new Response(JSON.stringify(payload), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fixtureId: number | null = providedId ?? null;
    if (!fixtureId) {
      if (!home || !away) {
        // Sem parâmetros suficientes → devolve payload vazio (200) para que o
        // caller caia em fallback (Futodds) sem poluir logs com 400.
        const payload = emptyPayload("missing_params");
        return new Response(JSON.stringify(payload), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fixtureId = await findFixture(home, away, commence_time);
      if (!fixtureId) {
        const payload = emptyPayload("fixture_not_found");
        responseCache.set(cacheKey, { expires: Date.now() + RESPONSE_TTL_MS, payload });
        return new Response(JSON.stringify(payload), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const includesPressure = "participants;scores;state;periods;events.type;pressure";
    const includesTrends = "participants;scores;state;periods;events.type;trends";

    let usedSource: "pressure" | "trends" | "none" = "none";
    let fixture: any = null;

    const r1 = await smFetch(smUrl(`/football/fixtures/${fixtureId}`, { include: includesPressure }));
    if (r1 && r1.ok) {
      const j1 = await r1.json();
      fixture = j1?.data;
      const homeIdProbe = (fixture?.participants || []).find((p: any) => p.meta?.location === "home")?.id;
      const tl = parsePressureIndex(fixture, Number(homeIdProbe));
      if (tl && tl.length > 0) usedSource = "pressure";
    }

    if (usedSource === "none") {
      const r2 = await smFetch(smUrl(`/football/fixtures/${fixtureId}`, { include: includesTrends }));
      if (!r2 || !r2.ok) {
        // Sem fixture detalhado → devolve vazio em vez de 502
        const payload = emptyPayload(r2 ? `fixture_fetch_${r2.status}` : "rate_limited");
        responseCache.set(cacheKey, { expires: Date.now() + 30_000, payload });
        return new Response(JSON.stringify(payload), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j2 = await r2.json();
      fixture = j2?.data;
      usedSource = "trends";
    }

    const header = extractHeader(fixture);
    const homeId = header.home.id;

    let timeline: TimelinePoint[] = [];
    if (usedSource === "pressure") {
      timeline = parsePressureIndex(fixture, homeId) || [];
    }
    if (timeline.length === 0) {
      timeline = buildPressureFromTrends(fixture, homeId);
      usedSource = "trends";
    }

    const events = extractEvents(fixture, homeId);
    const xgTimeline = buildXgTimeline(fixture, homeId);

    const [homeForm, awayForm] = await Promise.all([
      fetchForm(header.home.id),
      fetchForm(header.away.id),
    ]);

    const payload = {
      fixtureId,
      source: usedSource,
      header,
      timeline,
      xgTimeline,
      events,
      form: { home: homeForm, away: awayForm },
    };
    responseCache.set(cacheKey, { expires: Date.now() + RESPONSE_TTL_MS, payload });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
