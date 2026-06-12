// ─────────────────────────────────────────────────────────────────────
// punter-copa-odds-sync
//
// Busca odds de Handicap Asiático da Copa do Mundo 2026 no The Odds API
// e persiste em ah_odds_snapshot para consumo do mycroft-punter-copa.
//
// Fluxo:
//   1. Lê copa_fixtures (próximas 48h, status não finalizado)
//   2. Descobre o sport key WC 2026 via /v4/sports
//   3. Busca eventos + odds AH no The Odds API
//   4. Faz match por nome de equipe (normalizado)
//   5. Upsert em ah_odds_snapshot com payload { home: {line: odd}, away: {line: odd} }
//
// Cron sugerido: 10:00 UTC diário (1h antes do mycroft-punter-copa às 11:00 UTC)
// e opcionalmente 07:00 UTC para captura mais cedo.
//
// Nomeação: "punter-copa-*" = pré-live Copa do Mundo 2026 (Arena Punter)
// ─────────────────────────────────────────────────────────────────────

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ODDS_API_KEY = Deno.env.get("THE_ODDS_API_KEY") || Deno.env.get("ODDS_API_KEY") || "";

// Horizon: busca fixtures Copa nas próximas N horas
const HORIZON_HOURS = 48;

// Aliases para variações de nome entre copa_fixtures e The Odds API
const TEAM_ALIASES: Record<string, string> = {
  "turkiye": "turkey",
  "turkey": "turkiye",
  "ir iran": "iran",
  "iran": "ir iran",
  "korea republic": "south korea",
  "south korea": "korea republic",
  "korea dpr": "north korea",
  "ivory coast": "cote d ivoire",
  "cote divoire": "cote d ivoire",
  "czechia": "czech republic",
  "czech republic": "czechia",
  "united states": "usa",
  "usa": "united states",
};

// ─── Normaliza nome de seleção para matching ───────────────────────────────────
function normalizeName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return TEAM_ALIASES[base] ?? base;
}

// Verifica se dois nomes de equipe são compatíveis (matching fuzzy)
function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  // Um contém o outro (cobre "United States" vs "USA" parcialmente)
  if (na.includes(nb) || nb.includes(na)) return true;
  // Match por tokens: se todas palavras de um estão no outro
  const ta = na.split(" ");
  const tb = nb.split(" ");
  const longerToks = ta.length >= tb.length ? ta : tb;
  const shorterToks = ta.length >= tb.length ? tb : ta;
  // Pelo menos 60% dos tokens do menor presente no maior
  const matched = shorterToks.filter((t) => longerToks.some((u) => u.includes(t) || t.includes(u)));
  return matched.length / shorterToks.length >= 0.6;
}

// ─── Descobre sport key WC 2026 no The Odds API ───────────────────────────────
const COPA_SPORT_KEY_CANDIDATES = [
  "soccer_fifa_world_cup",
  "soccer_world_cup_2026",
  "soccer_fifa_world_cup_2026",
  "soccer_international_friendlies", // fallback
];

async function discoverCopaSportKey(): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${ODDS_API_KEY}&all=true`,
    );
    if (!res.ok) {
      console.warn(`[copa-odds] /sports retornou ${res.status}, usando candidatos padrão`);
      return COPA_SPORT_KEY_CANDIDATES.slice(0, 3);
    }
    const sports: any[] = await res.json();
    const copa = sports.filter((s: any) => {
      const key: string = (s.key || "").toLowerCase();
      const title: string = (s.title || "").toLowerCase();
      return (
        key.includes("world_cup") ||
        title.includes("world cup") ||
        title.includes("copa do mundo") ||
        title.includes("mundial")
      );
    });
    const keys = copa.map((s: any) => s.key as string);
    console.log(`[copa-odds] sport keys Copa encontrados: ${keys.join(", ") || "nenhum"}`);
    // Se não encontrou, tenta os candidatos padrão
    return keys.length > 0 ? keys : COPA_SPORT_KEY_CANDIDATES.slice(0, 2);
  } catch (e) {
    console.warn("[copa-odds] erro ao descobrir sport keys:", (e as Error).message);
    return COPA_SPORT_KEY_CANDIDATES.slice(0, 2);
  }
}

// ─── Busca eventos com odds AH no The Odds API ────────────────────────────────
interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: any[];
}

async function fetchOddsEvents(sportKey: string): Promise<OddsEvent[]> {
  // Tenta primeiro AH (mercado principal para Copa), depois h2h como fallback
  const markets = ["asian_handicap", "h2h"];
  // AH odds para Copa são mais comuns em regiões EU/UK e AU
  const regions = "eu,uk,au,us";

  for (const market of markets) {
    try {
      const url =
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
        `?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${market}&oddsFormat=decimal`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[copa-odds] ${sportKey}/${market} → ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[copa-odds] ${sportKey}/${market}: ${data.length} eventos`);
        return data;
      }
    } catch (e) {
      console.warn(`[copa-odds] fetch ${sportKey}/${market}:`, (e as Error).message);
    }
  }
  return [];
}

// ─── Extrai payload AH de um evento ──────────────────────────────────────────
// Retorna { home: {[line]: best_odd}, away: {[line]: best_odd} }
// Prefere odds mais altas (melhor valor para o apostador).
// Fallback: se não há AH, usa h2h na linha "0" (DNB equivalente).
function extractAhPayload(
  event: OddsEvent,
): { home: Record<string, number>; away: Record<string, number> } {
  const home: Record<string, number> = {};
  const away: Record<string, number> = {};

  for (const bm of event.bookmakers || []) {
    for (const mkt of bm.markets || []) {
      if (mkt.key === "asian_handicap") {
        for (const outcome of mkt.outcomes || []) {
          const point: number = outcome.point;
          const price: number = outcome.price;
          if (typeof point !== "number" || typeof price !== "number") continue;
          const lineKey = String(point);
          const isHome = namesMatch(outcome.name, event.home_team);
          const isAway = namesMatch(outcome.name, event.away_team);
          if (isHome && (!home[lineKey] || price > home[lineKey])) {
            home[lineKey] = +price.toFixed(4);
          } else if (isAway && (!away[lineKey] || price > away[lineKey])) {
            away[lineKey] = +price.toFixed(4);
          }
        }
      } else if (mkt.key === "h2h") {
        // Fallback h2h: usa odd h2h como linha "0" se ainda não há AH
        for (const outcome of mkt.outcomes || []) {
          const price: number = outcome.price;
          if (typeof price !== "number") continue;
          const isHome = namesMatch(outcome.name, event.home_team);
          const isAway = namesMatch(outcome.name, event.away_team);
          if (isHome && !home["0"] && (!home["0"] || price > home["0"])) {
            home["0"] = +price.toFixed(4);
          } else if (isAway && !away["0"] && (!away["0"] || price > away["0"])) {
            away["0"] = +price.toFixed(4);
          }
        }
      }
    }
  }

  return { home, away };
}

// ─── Lista todos sports soccer do The Odds API (diagnóstico) ─────────────────
async function listSoccerSports(): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${ODDS_API_KEY}&all=true`,
    );
    if (!res.ok) return [];
    const sports: any[] = await res.json();
    return sports.filter((s: any) => String(s.group || "").toLowerCase().includes("soccer"));
  } catch {
    return [];
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ODDS_API_KEY) {
    return new Response(
      JSON.stringify({ error: "THE_ODDS_API_KEY ou ODDS_API_KEY não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPA_URL, SUPA_SR);
  const start = Date.now();

  // Modo diagnóstico: lista todos sports soccer para descobrir o key correto da Copa
  let body: any = {};
  try { body = await req.json(); } catch { /* sem body */ }
  if (body?.debug_sports) {
    const sports = await listSoccerSports();
    return new Response(
      JSON.stringify({ sports_count: sports.length, soccer_sports: sports }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // 1. Lê fixtures Copa das próximas HORIZON_HOURS
    const horizon = new Date(Date.now() + HORIZON_HOURS * 3600_000).toISOString();
    const now = new Date().toISOString();

    const { data: copaFixtures, error: fxErr } = await supabase
      .from("copa_fixtures")
      .select("fixture_id, home, away, commence_time, phase")
      .gte("commence_time", now)
      .lte("commence_time", horizon)
      .order("commence_time", { ascending: true });

    if (fxErr) throw new Error(`copa_fixtures query: ${fxErr.message}`);

    const fixtures = (copaFixtures || []) as {
      fixture_id: string;
      home: string;
      away: string;
      commence_time: string;
      phase: string;
    }[];

    console.log(`[copa-odds] ${fixtures.length} fixtures Copa nas próximas ${HORIZON_HOURS}h`);

    if (fixtures.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: `Nenhuma fixture Copa nas próximas ${HORIZON_HOURS}h`,
          snapshots_salvos: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Descobre sport keys Copa no The Odds API
    const sportKeys = await discoverCopaSportKey();

    // 3. Busca todos os eventos Copa com odds AH
    const allEvents: OddsEvent[] = [];
    for (const key of sportKeys) {
      const events = await fetchOddsEvents(key);
      allEvents.push(...events);
      console.log(`[copa-odds] ${key}: ${events.length} eventos`);
    }

    // Deduplica eventos pelo ID
    const uniqueEvents = Array.from(
      new Map(allEvents.map((e) => [e.id, e])).values(),
    );
    console.log(`[copa-odds] ${uniqueEvents.length} eventos únicos no The Odds API`);

    // 4. Match fixture × evento e salva snapshot
    let salvos = 0;
    let semMatch = 0;
    const log: any[] = [];

    for (const fx of fixtures) {
      // Encontra evento correspondente no The Odds API
      const matched = uniqueEvents.find((ev) => {
        const homeOk = namesMatch(ev.home_team, fx.home);
        const awayOk = namesMatch(ev.away_team, fx.away);
        // Permite inversão de mandante/visitante (edge case em alguns provedores)
        return (homeOk && awayOk) ||
          (namesMatch(ev.home_team, fx.away) && namesMatch(ev.away_team, fx.home));
      });

      if (!matched) {
        console.warn(`[copa-odds] SEM MATCH: ${fx.home} x ${fx.away} (${fx.fixture_id})`);
        semMatch++;
        log.push({ fixture_id: fx.fixture_id, home: fx.home, away: fx.away, status: "sem_match" });
        continue;
      }

      // Detecta se o evento está invertido em relação à fixture
      const isInverted = namesMatch(matched.home_team, fx.away);

      let payload = extractAhPayload(matched);

      // Se invertido, troca home/away no payload
      if (isInverted) {
        payload = { home: payload.away, away: payload.home };
      }

      const allKeys = [...Object.keys(payload.home), ...Object.keys(payload.away)];
      const hasRealAhLines = allKeys.some((k) => k !== "0");
      if (!hasRealAhLines) {
        // Sem linhas AH: verifica se já existe snapshot AH recente para preservar
        const { data: ahCheck } = await supabase
          .from("ah_odds_snapshot")
          .select("payload")
          .eq("fixture_id", fx.fixture_id)
          .gte("captured_at", new Date(Date.now() - 12 * 3600_000).toISOString())
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const hasRecentAh = ahCheck?.payload &&
          [...Object.keys(ahCheck.payload?.home || {}), ...Object.keys(ahCheck.payload?.away || {})]
            .some((k) => k !== "0");
        if (hasRecentAh) {
          // Existe AH recente: preserva, não sobrescreve com h2h
          log.push({ fixture_id: fx.fixture_id, home: fx.home, away: fx.away, status: "h2h_only_skip", odds_event_id: matched.id });
          continue;
        }
        // Sem AH disponível: salva h2h como fallback para o pipeline 1X2
        console.log(`[copa-odds] ${fx.home} x ${fx.away}: sem AH, salvando h2h para fallback 1X2`);
      }
      const hasOdds = allKeys.length > 0;
      if (!hasOdds) {
        console.warn(`[copa-odds] Evento encontrado mas sem odds AH: ${fx.home} x ${fx.away}`);
        log.push({
          fixture_id: fx.fixture_id, home: fx.home, away: fx.away,
          status: "sem_odds_ah", odds_event_id: matched.id,
        });
        continue;
      }

      // 5. Insere snapshot em ah_odds_snapshot
      // A tabela mantém histórico por fixture_id + captured_at.
      // mycroft-punter-copa lê o registro mais recente via ORDER BY captured_at DESC.
      const { error: insertErr } = await supabase
        .from("ah_odds_snapshot")
        .insert({
          fixture_id: fx.fixture_id,
          captured_at: new Date().toISOString(),
          payload,
          // home_odd / away_odd preenchidos com a melhor odd AH disponível como fallback
          home_odd: payload.home ? Number(Object.values(payload.home)[0] ?? null) : null,
          away_odd: payload.away ? Number(Object.values(payload.away)[0] ?? null) : null,
        });

      if (insertErr) {
        console.error(`[copa-odds] insert ${fx.fixture_id}:`, insertErr.message);
        log.push({ fixture_id: fx.fixture_id, home: fx.home, away: fx.away, status: "erro_insert", error: insertErr.message });
      } else {
        salvos++;
        log.push({
          fixture_id: fx.fixture_id,
          home: fx.home,
          away: fx.away,
          status: "ok",
          lines_home: Object.keys(payload.home),
          lines_away: Object.keys(payload.away),
        });
        console.log(
          `[copa-odds] ✅ ${fx.home} x ${fx.away} → home lines: ${Object.keys(payload.home).join(",")} | away: ${Object.keys(payload.away).join(",")}`,
        );
      }
    }

    await supabase.from("cron_logs").insert({
      tipo: "punter_copa_odds_sync",
      total_recebidos: fixtures.length,
      total_filtrados: salvos,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        fixtures_copa: fixtures.length,
        eventos_odds_api: uniqueEvents.length,
        snapshots_salvos: salvos,
        sem_match: semMatch,
        duracao_ms: Date.now() - start,
        log,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[copa-odds] erro:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
