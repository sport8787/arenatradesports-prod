// ─────────────────────────────────────────────────────────────────────
// punter-copa-odds-sync
//
// Busca odds de Handicap Asiático da Copa do Mundo 2026 no Futodds
// (Betfair prelive) e persiste em ah_odds_snapshot para consumo do
// mycroft-punter-copa.
//
// Fluxo:
//   1. Lê copa_fixtures (próximas 48h, status não finalizado)
//   2. Busca eventos Futodds upcoming no mesmo intervalo
//   3. Match por nome de equipe (normalizado) → getFutoddsPreliveOdds(eventId, 'asian_handicap')
//   4. Parse runners AH → payload { home: {line: odd}, away: {line: odd} }
//   5. Fallback H2H via The Odds API se Futodds não tiver linhas AH
//   6. Upsert em ah_odds_snapshot
//
// Cron: 10:00 UTC diário + 07:00 UTC (1-4h antes do mycroft-punter-copa às 11:00 UTC)
// ─────────────────────────────────────────────────────────────────────

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getFutoddsUpcoming,
  getFutoddsPreliveOdds,
  isFutoddsDisabled,
} from "../_shared/futoddsProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ODDS_API_KEY = Deno.env.get("THE_ODDS_API_KEY") || Deno.env.get("ODDS_API_KEY") || "";

const HORIZON_HOURS = 48;

// Aliases para variações de nome entre provedores (PT-BR ↔ EN e variantes FIFA)
const TEAM_ALIASES: Record<string, string> = {
  // Inglês ↔ Turco/FIFA
  "turkiye": "turkey",
  "turkey": "turkiye",
  // Irã
  "ir iran": "iran",
  "iran": "ir iran",
  // Coréia
  "korea republic": "south korea",
  "south korea": "korea republic",
  "coreia do sul": "south korea",
  "korea dpr": "north korea",
  // Costa do Marfim
  "ivory coast": "cote d ivoire",
  "cote divoire": "cote d ivoire",
  // República Tcheca
  "czechia": "czech republic",
  "czech republic": "czechia",
  // EUA
  "united states": "usa",
  "usa": "united states",
  "estados unidos": "usa",
  // PT-BR → EN (Copa do Mundo 2026)
  "brasil": "brazil",
  "brazil": "brasil",
  "alemanha": "germany",
  "germany": "alemanha",
  "espanha": "spain",
  "spain": "espanha",
  "franca": "france",
  "france": "franca",
  "holanda": "netherlands",
  "paises baixos": "netherlands",
  "netherlands": "holanda",
  "belgica": "belgium",
  "belgium": "belgica",
  "suica": "switzerland",
  "switzerland": "suica",
  "croacia": "croatia",
  "croatia": "croacia",
  "servia": "serbia",
  "serbia": "servia",
  "marrocos": "morocco",
  "morocco": "marrocos",
  "camaroes": "cameroon",
  "cameroon": "camaroes",
  "gana": "ghana",
  "ghana": "gana",
  "egito": "egypt",
  "egypt": "egito",
  "africa do sul": "south africa",
  "south africa": "africa do sul",
  "nigeria": "nigeria",
  "equador": "ecuador",
  "ecuador": "equador",
  "uruguai": "uruguay",
  "uruguay": "uruguai",
  "paraguai": "paraguay",
  "paraguay": "paraguai",
  "japao": "japan",
  "japan": "japao",
  "arabia saudita": "saudi arabia",
  "saudi arabia": "arabia saudita",
  "nova zelandia": "new zealand",
  "new zealand": "nova zelandia",
  "polonia": "poland",
  "poland": "polonia",
  "hungria": "hungary",
  "hungary": "hungria",
  "suecia": "sweden",
  "sweden": "suecia",
  "noruega": "norway",
  "norway": "noruega",
  "dinamarca": "denmark",
  "denmark": "dinamarca",
  "romenia": "romania",
  "romania": "romenia",
  "turquia": "turkey",
  "eslovaquia": "slovakia",
  "slovakia": "eslovaquia",
};

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

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(" ");
  const tb = nb.split(" ");
  const longerToks = ta.length >= tb.length ? ta : tb;
  const shorterToks = ta.length >= tb.length ? tb : ta;
  const matched = shorterToks.filter((t) => longerToks.some((u) => u.includes(t) || t.includes(u)));
  return matched.length / shorterToks.length >= 0.6;
}

// ─── Parse odds AH do payload Futodds prelive ────────────────────────────────
// Betfair AH: cada mercado pode ser um par (home/away) por linha,
// ou runners com handicap embutido no nome ("Brazil -0.5").
// Também suporta campo runner.handicap ou market.handicap.
function parseFutoddsAhPayload(
  preliveData: any,
  homeTeam: string,
  awayTeam: string,
): OddsPayload {
  const home: Record<string, number> = {};
  const away: Record<string, number> = {};
  if (!preliveData) return { home, away };

  const markets: any[] = Array.isArray(preliveData.markets)
    ? preliveData.markets
    : Array.isArray(preliveData)
    ? preliveData
    : [];

  for (const market of markets) {
    const mType = String(market?.market_type ?? market?.type ?? "").toUpperCase();
    const isAh = mType.includes("ASIAN") || mType.includes("HANDICAP") || mType === "AH";
    if (!isAh) continue;

    // Handicap no nível do mercado (e.g., market.handicap = -0.5)
    const marketHcp: number | null = typeof market.handicap === "number" ? market.handicap : null;

    for (const runner of market?.runners ?? []) {
      if (runner?.status === "REMOVED" || runner?.status === "LOSER") continue;

      const rName: string = String(runner?.runner_name ?? runner?.name ?? "");
      const backPrice: number | null =
        runner?.back_odds?.[0]?.price ??
        runner?.back?.[0]?.price ??
        runner?.back_price ??
        null;
      if (!backPrice || backPrice <= 1) continue;

      // Estratégia 1: handicap no próprio runner
      let runnerHcp: number | null = typeof runner.handicap === "number" ? runner.handicap : null;

      // Estratégia 2: extrair do final do runner_name — "Brazil -0.5" → -0.5
      if (runnerHcp === null) {
        const m = rName.match(/([+-]?\d+(?:\.\d+)?)(?:\s*)$/);
        if (m) {
          const candidate = parseFloat(m[1]);
          // Só aceita se for um número AH razoável (0 a 4, positivo ou negativo)
          if (Math.abs(candidate) <= 4) runnerHcp = candidate;
        }
      }

      // Nome do time sem o sufixo de handicap
      const nameOnly = rName.replace(/\s*[+-]?\d+(?:\.\d+)?$/, "").trim();

      const isHome = namesMatch(nameOnly || rName, homeTeam);
      const isAway = namesMatch(nameOnly || rName, awayTeam);
      if (!isHome && !isAway) continue;

      // Determina a chave de linha
      let lineKey: string | null = null;
      if (runnerHcp !== null) {
        lineKey = String(runnerHcp);
      } else if (marketHcp !== null) {
        // Handicap do mercado é para o mandante; visitante recebe o inverso
        lineKey = isHome ? String(marketHcp) : String(-marketHcp);
      }
      if (!lineKey) continue;

      const price = +backPrice.toFixed(4);
      if (isHome && (!home[lineKey] || price > home[lineKey])) {
        home[lineKey] = price;
      } else if (isAway && (!away[lineKey] || price > away[lineKey])) {
        away[lineKey] = price;
      }
    }
  }

  return { home, away };
}

// ─── Fallback H2H + Over/BTTS via The Odds API ───────────────────────────────
// Copa pode não ter AH no Betfair para certos jogos antecipados; usa h2h como
// fallback na linha "0" (equivalente a 1X2) para mycroft-punter-copa usar.
// Também busca totals e btts_goals para aprovação mandatória de jogos do Brasil.
const COPA_SPORT_KEY_CANDIDATES = [
  "soccer_fifa_world_cup",
  "soccer_world_cup_2026",
  "soccer_fifa_world_cup_2026",
  "soccer_world_cup",
];

type OddsPayload = { home: Record<string, number>; away: Record<string, number>; [key: string]: any };

async function fetchH2hFallback(
  homeTeam: string,
  awayTeam: string,
): Promise<OddsPayload | null> {
  if (!ODDS_API_KEY) return null;
  for (const sportKey of COPA_SPORT_KEY_CANDIDATES) {
    try {
      const url =
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
        `?apiKey=${ODDS_API_KEY}&regions=eu,uk,au,us&markets=h2h,totals,btts_goals&oddsFormat=decimal`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;
      const ev = data.find((e: any) =>
        (namesMatch(e.home_team, homeTeam) && namesMatch(e.away_team, awayTeam)) ||
        (namesMatch(e.home_team, awayTeam) && namesMatch(e.away_team, homeTeam))
      );
      if (!ev) continue;
      const isInverted = namesMatch(ev.home_team, awayTeam);
      const h2hHome: Record<string, number> = {};
      const h2hAway: Record<string, number> = {};
      const overOdds: Record<string, number> = {};
      const underOdds: Record<string, number> = {};
      let bttsYes: number | null = null;

      for (const bm of ev.bookmakers || []) {
        for (const mkt of bm.markets || []) {
          if (mkt.key === "h2h") {
            for (const out of mkt.outcomes || []) {
              const price: number = out.price;
              if (typeof price !== "number") continue;
              const isH = namesMatch(out.name, ev.home_team);
              const isA = namesMatch(out.name, ev.away_team);
              if (isH && !h2hHome["0"]) h2hHome["0"] = +price.toFixed(4);
              else if (isA && !h2hAway["0"]) h2hAway["0"] = +price.toFixed(4);
            }
          } else if (mkt.key === "totals") {
            for (const out of mkt.outcomes || []) {
              const price: number = out.price;
              const point: number = out.point;
              if (typeof price !== "number" || typeof point !== "number") continue;
              const lk = String(point);
              if (out.name === "Over" && !overOdds[lk]) overOdds[lk] = +price.toFixed(4);
              else if (out.name === "Under" && !underOdds[lk]) underOdds[lk] = +price.toFixed(4);
            }
          } else if (mkt.key === "btts_goals") {
            for (const out of mkt.outcomes || []) {
              if (out.name === "Yes" && !bttsYes && typeof out.price === "number") {
                bttsYes = +out.price.toFixed(4);
              }
            }
          }
        }
      }

      if (!h2hHome["0"] && !h2hAway["0"]) continue;

      const homePayload = isInverted ? h2hAway : h2hHome;
      const awayPayload = isInverted ? h2hHome : h2hAway;

      const result: OddsPayload = { home: homePayload, away: awayPayload };
      if (overOdds["0.5"]) result.over_05 = overOdds["0.5"];
      if (overOdds["1.5"]) result.over_15 = overOdds["1.5"];
      if (overOdds["2.5"]) result.over_25 = overOdds["2.5"];
      if (overOdds["3.5"]) result.over_35 = overOdds["3.5"];
      if (underOdds["2.5"]) result.under_25 = underOdds["2.5"];
      if (bttsYes) result.btts_yes = bttsYes;

      console.log(`[copa-odds] H2H extra: over_15=${result.over_15 ?? "N/A"} over_25=${result.over_25 ?? "N/A"} btts=${result.btts_yes ?? "N/A"}`);
      return result;
    } catch { /* tenta próximo */ }
  }
  return null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPA_URL, SUPA_SR);
  const start = Date.now();

  try {
    // 1. Lê fixtures Copa nas próximas HORIZON_HOURS
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
        JSON.stringify({ ok: true, message: `Nenhuma fixture Copa nas próximas ${HORIZON_HOURS}h`, snapshots_salvos: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Busca eventos Futodds upcoming para o mesmo horizonte (geral + Copa por league_name)
    let futoddsUpcoming: any[] = [];
    let copaBetfairEvents: any[] = []; // eventos Copa na Betfair buscados por league_name
    if (!isFutoddsDisabled()) {
      try {
        const dateFrom = now.slice(0, 10);
        const dateTo = horizon.slice(0, 10);
        futoddsUpcoming = await getFutoddsUpcoming({ date_from: dateFrom, date_to: dateTo, limit: "500" });
        console.log(`[copa-odds] Futodds upcoming: ${futoddsUpcoming.length} eventos`);
      } catch (e) {
        console.warn("[copa-odds] Futodds upcoming falhou:", (e as Error).message);
      }
      // Busca Copa especificamente por league_name (Betfair costuma listar sob "World Cup")
      for (const leagueName of ["World Cup", "FIFA World Cup", "FIFA World Cup 2026"]) {
        try {
          const copaEvts = await getFutoddsUpcoming({ league_name: leagueName, limit: "100" });
          if (copaEvts.length > 0) {
            copaBetfairEvents = copaEvts;
            console.log(`[copa-odds] Copa Betfair (${leagueName}): ${copaEvts.length} eventos`);
            break;
          }
        } catch { /* tenta próximo nome */ }
      }
    } else {
      console.log("[copa-odds] FUTODDS_DISABLED=true — usando apenas The Odds API como fallback");
    }

    // 3. Para cada fixture, busca AH Futodds ou fallback H2H
    let salvos = 0;
    const log: any[] = [];

    for (const fx of fixtures) {
      // Tenta match no Futodds upcoming
      const futEv = futoddsUpcoming.find((u: any) => {
        const uh = String(u.home_team_name ?? u.home_name ?? u.home ?? "");
        const ua = String(u.away_team_name ?? u.away_name ?? u.away ?? "");
        return (namesMatch(uh, fx.home) && namesMatch(ua, fx.away)) ||
               (namesMatch(uh, fx.away) && namesMatch(ua, fx.home));
      });

      let payload: OddsPayload | null = null;
      let source = "none";

      if (futEv) {
        const eventId = String(futEv.event_id ?? futEv.eventId ?? "");
        const isInverted =
          namesMatch(String(futEv.home_team_name ?? futEv.home_name ?? futEv.home ?? ""), fx.away);
        try {
          const preliveData = await getFutoddsPreliveOdds(eventId, "asian_handicap");
          if (preliveData) {
            const parsed = parseFutoddsAhPayload(preliveData, fx.home, fx.away);
            const allKeys = [...Object.keys(parsed.home), ...Object.keys(parsed.away)];
            const hasAh = allKeys.some((k) => k !== "0" && k !== "0.0");
            if (hasAh) {
              payload = isInverted ? { home: parsed.away, away: parsed.home } : parsed;
              source = "futodds_ah";
              console.log(
                `[copa-odds] ✅ Futodds AH ${fx.home} x ${fx.away} → home: ${Object.keys(payload.home).join(",")} | away: ${Object.keys(payload.away).join(",")}`,
              );
            } else {
              // Futodds encontrou o evento mas sem linhas AH — pode ser só 1X2
              console.log(`[copa-odds] Futodds sem AH para ${fx.home} x ${fx.away} (event_id=${eventId})`);
            }
          }
        } catch (e) {
          console.warn(`[copa-odds] getFutoddsPreliveOdds(${eventId}) falhou:`, (e as Error).message);
        }
      } else {
        console.log(`[copa-odds] ${fx.home} x ${fx.away} não encontrado no Futodds upcoming`);
      }

      // Estratégia 2: busca direta por betsapi_id (copa_fixtures.fixture_id = betsapi_id)
      if (!payload && !isFutoddsDisabled()) {
        try {
          const bfFound = await getFutoddsUpcoming({ betsapi_id: fx.fixture_id, limit: "3" });
          if (bfFound.length > 0) {
            const bfEventId = String(bfFound[0].event_id ?? "");
            if (bfEventId) {
              const preliveData = await getFutoddsPreliveOdds(bfEventId, "asian_handicap");
              if (preliveData) {
                const isInverted = namesMatch(String(bfFound[0].home_team_name ?? ""), fx.away);
                const parsed = parseFutoddsAhPayload(preliveData, fx.home, fx.away);
                const allKeys = [...Object.keys(parsed.home), ...Object.keys(parsed.away)];
                if (allKeys.some((k) => k !== "0" && k !== "0.0")) {
                  payload = isInverted ? { home: parsed.away, away: parsed.home } : parsed;
                  source = "futodds_ah_betsapi_id";
                  console.log(`[copa-odds] ✅ betsapi_id AH ${fx.home} x ${fx.away} (event_id=${bfEventId})`);
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[copa-odds] betsapi_id lookup ${fx.fixture_id} falhou:`, (e as Error).message);
        }
      }

      // Estratégia 3: buscar no copaBetfairEvents pré-carregado por league_name
      if (!payload && copaBetfairEvents.length > 0) {
        const copaEv = copaBetfairEvents.find((u: any) => {
          const uh = String(u.home_team_name ?? u.home_name ?? "");
          const ua = String(u.away_team_name ?? u.away_name ?? "");
          return (namesMatch(uh, fx.home) && namesMatch(ua, fx.away)) ||
                 (namesMatch(uh, fx.away) && namesMatch(ua, fx.home));
        });
        if (copaEv) {
          const copaEventId = String(copaEv.event_id ?? "");
          try {
            const preliveData = await getFutoddsPreliveOdds(copaEventId, "asian_handicap");
            if (preliveData) {
              const isInverted = namesMatch(String(copaEv.home_team_name ?? ""), fx.away);
              const parsed = parseFutoddsAhPayload(preliveData, fx.home, fx.away);
              const allKeys = [...Object.keys(parsed.home), ...Object.keys(parsed.away)];
              if (allKeys.some((k) => k !== "0" && k !== "0.0")) {
                payload = isInverted ? { home: parsed.away, away: parsed.home } : parsed;
                source = "futodds_ah_league_name";
                console.log(`[copa-odds] ✅ league_name AH ${fx.home} x ${fx.away} (event_id=${copaEventId})`);
              }
            }
          } catch (e) {
            console.warn(`[copa-odds] prelive odds copa_ev ${copaEventId} falhou:`, (e as Error).message);
          }
        }
      }

      // Fallback: H2H via The Odds API se não há AH do Futodds
      if (!payload) {
        const h2h = await fetchH2hFallback(fx.home, fx.away);
        if (h2h && (h2h.home["0"] || h2h.away["0"])) {
          // Verifica se já existe snapshot AH recente para não sobrescrever com h2h
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
              .some((k) => k !== "0" && k !== "0.0");
          if (hasRecentAh) {
            log.push({ fixture_id: fx.fixture_id, home: fx.home, away: fx.away, status: "h2h_skip_recente_ah" });
            continue;
          }
          payload = h2h;
          source = "odds_api_h2h";
          console.log(`[copa-odds] H2H fallback ${fx.home} x ${fx.away}: home=${h2h.home["0"]} away=${h2h.away["0"]}`);
        }
      }

      if (!payload || (Object.keys(payload.home).length === 0 && Object.keys(payload.away).length === 0)) {
        console.warn(`[copa-odds] SEM ODDS: ${fx.home} x ${fx.away}`);
        log.push({ fixture_id: fx.fixture_id, home: fx.home, away: fx.away, status: "sem_odds" });
        continue;
      }

      // 4. Upsert em ah_odds_snapshot
      const { error: insertErr } = await supabase
        .from("ah_odds_snapshot")
        .insert({
          fixture_id: fx.fixture_id,
          captured_at: new Date().toISOString(),
          payload,
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
          source,
          lines_home: Object.keys(payload.home),
          lines_away: Object.keys(payload.away),
        });
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
        futodds_upcoming: futoddsUpcoming.length,
        snapshots_salvos: salvos,
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
