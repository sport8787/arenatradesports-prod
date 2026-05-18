// =============================================================================
// SHARED: Sportmonks Predictions probe (segunda opinião do Mycroft).
// Resolve a probabilidade Sportmonks correspondente ao mercado do sinal Mycroft
// e calcula a divergência em pp. Se > 15pp → sherlock_alert (não veta).
// Persiste log shadow em punter_predictions_shadow para calibração futura.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const SHERLOCK_DIVERGENCE_THRESHOLD_PP = 15;

export interface SportmonksProbe {
  sportmonks_probability: number | null;  // 0..100 da Sportmonks p/ o mesmo mercado
  divergence_pp: number | null;
  sherlock_alert: boolean;
  prediction: Record<string, number | null> | null;
  note: string | null;
}

// Map de market (texto do Mycroft) para chave normalizada da Sportmonks
function mapMarketKey(market: string): keyof SportmonksProbe["prediction"] & string | null {
  const m = (market || "").toLowerCase().trim();
  // 1X2
  if (m === "casa" || m === "home" || m.includes("1x2 - casa") || m === "1") return "home_win";
  if (m === "fora" || m === "away" || m.includes("1x2 - fora") || m === "2") return "away_win";
  if (m === "empate" || m === "draw" || m === "x") return "draw";
  // Over/Under (FT)
  if (/over\s*0?\.?5/.test(m)) return null; // sem chave dedicada
  if (/over\s*1\.5/.test(m)) return "over_15";
  if (/under\s*1\.5/.test(m)) return "under_15";
  if (/over\s*2\.5/.test(m)) return "over_25";
  if (/under\s*2\.5/.test(m)) return "under_25";
  if (/over\s*3\.5/.test(m)) return "over_35";
  if (/under\s*3\.5/.test(m)) return "under_35";
  // BTTS
  if (/btts.*(sim|yes)|ambas.*(sim|yes|marcam)/.test(m)) return "btts_yes";
  if (/btts.*(n[aã]o|no)|ambas.*(n[aã]o|no)/.test(m)) return "btts_no";
  return null;
}

interface ProbeInput {
  match_id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  league?: string;
  market: string;
  mycroft_probability_pct: number; // 0..100
  verdict: string;
  analysis_id?: string | null;
}

export async function probeSportmonksPrediction(input: ProbeInput): Promise<SportmonksProbe> {
  const empty: SportmonksProbe = {
    sportmonks_probability: null,
    divergence_pp: null,
    sherlock_alert: false,
    prediction: null,
    note: null,
  };
  try {
    const key = mapMarketKey(input.market);
    if (!key) return empty; // mercado não coberto pela Sportmonks (ex.: cartões, player props)

    const url = `${SUPABASE_URL}/functions/v1/sportmonks-predictions-fetch`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        match_id: input.match_id,
        home_team: input.home_team,
        away_team: input.away_team,
        commence_time: input.commence_time,
      }),
    });
    if (!res.ok) return empty;
    const j = await res.json();
    const predictions = j?.predictions || null;
    if (!predictions) return empty;

    const smProb = Number(predictions[key]);
    if (!Number.isFinite(smProb)) return { ...empty, prediction: predictions };

    const myProb = Number(input.mycroft_probability_pct);
    if (!Number.isFinite(myProb) || myProb <= 0) {
      return { sportmonks_probability: smProb, divergence_pp: null, sherlock_alert: false, prediction: predictions, note: null };
    }
    const divergence = Math.abs(myProb - smProb);
    const alert = divergence > SHERLOCK_DIVERGENCE_THRESHOLD_PP;
    const note = alert
      ? `⚠️ Divergência de modelos: Mycroft ${myProb.toFixed(0)}% vs Sportmonks ${smProb.toFixed(0)}% (${divergence.toFixed(0)}pp). Operar com cautela.`
      : null;
    return {
      sportmonks_probability: Number(smProb.toFixed(2)),
      divergence_pp: Number(divergence.toFixed(2)),
      sherlock_alert: alert,
      prediction: predictions,
      note,
    };
  } catch (e) {
    console.warn("[sm-predictions probe] falhou:", (e as Error).message);
    return empty;
  }
}

// Persiste log shadow (silencioso) — chamado APÓS insert em punter_analyses
// quando temos analysis_id válido.
export async function logShadowPrediction(
  sb: any,
  args: {
    analysis_id: string;
    match_id: string;
    home_team: string;
    away_team: string;
    league?: string;
    commence_time: string;
    market: string;
    mycroft_probability: number;
    probe: SportmonksProbe;
    verdict: string;
  },
) {
  try {
    await sb.from("punter_predictions_shadow").insert({
      analysis_id: args.analysis_id,
      match_id: args.match_id,
      home_team: args.home_team,
      away_team: args.away_team,
      league: args.league ?? null,
      commence_time: args.commence_time,
      market: args.market,
      mycroft_probability: args.mycroft_probability,
      sportmonks_probability: args.probe.sportmonks_probability,
      divergence_pp: args.probe.divergence_pp,
      sherlock_alert: args.probe.sherlock_alert,
      verdict: args.verdict,
    });
  } catch (e) {
    console.warn("[shadow predictions] insert falhou:", (e as Error).message);
  }
}
