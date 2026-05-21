const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const BASE = "https://api.sportmonks.com/v3";
const TARGET_MARKETS = "1,12,14,28";
const TTL_MS = 15 * 60 * 1000;

const oddsCache = new Map<number, { ts: number; odds: Record<string, number> }>();

const ALLOWED_AH_LINES = new Set([-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function fmtAHLabel(side: "Casa" | "Fora", line: number): string {
  const lineStr = line === 0 ? "0" : line > 0 ? `+${line}` : `${line}`;
  return `AH ${side} ${lineStr}`;
}

function parseSportmonksOdds(rawOdds: any[]): Record<string, number> {
  const buckets: Record<string, number[]> = {};

  const push = (label: string, val: unknown) => {
    const num = parseFloat(String(val));
    if (!Number.isFinite(num) || num < 1.01 || num > 50) return;
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(num);
  };

  for (const odd of rawOdds || []) {
    const marketId = Number(odd.market_id ?? odd.marketId);
    const label = String(odd.label ?? odd.name ?? "").toLowerCase().trim();
    const value = odd.value ?? odd.dp3 ?? odd.price;

    if (marketId === 1) {
      if (label === "home" || label === "1") push("Casa", value);
      else if (label === "draw" || label === "x") push("Empate", value);
      else if (label === "away" || label === "2") push("Fora", value);
      continue;
    }

    if (marketId === 12) {
      const total = String(odd.total ?? "").trim();
      if (total === "1.5" || total === "1.50") {
        if (label === "over") push("Over 1.5", value);
        else if (label === "under") push("Under 1.5", value);
      } else if (total === "2.5" || total === "2.50") {
        if (label === "over") push("Over 2.5", value);
        else if (label === "under") push("Under 2.5", value);
      } else if (total === "3.5" || total === "3.50") {
        if (label === "over") push("Over 3.5", value);
        else if (label === "under") push("Under 3.5", value);
      }
      continue;
    }

    if (marketId === 14) {
      if (label === "yes") push("BTTS Sim", value);
      else if (label === "no") push("BTTS Não", value);
      continue;
    }

    if (marketId === 28) {
      const handicapRaw = String(odd.handicap ?? odd.total ?? "").trim().replace(/^\+/, "");
      const handicap = parseFloat(handicapRaw);
      if (!Number.isFinite(handicap) || !ALLOWED_AH_LINES.has(handicap)) continue;
      if (label === "home" || label === "1") push(fmtAHLabel("Casa", handicap), value);
      else if (label === "away" || label === "2") push(fmtAHLabel("Fora", handicap), value);
    }
  }

  const aggregated: Record<string, number> = {};
  for (const [label, values] of Object.entries(buckets)) {
    aggregated[label] = round2(median(values));
  }
  return aggregated;
}

export async function fetchSportmonksPrematchOdds(fixtureId: number): Promise<Record<string, number>> {
  if (!TOKEN || !fixtureId) return {};

  const cached = oddsCache.get(fixtureId);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.odds;

  const url = `${BASE}/football/odds/pre-match/fixtures/${fixtureId}?api_token=${TOKEN}&filters=markets:${TARGET_MARKETS}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[SM-PrematchOdds] HTTP ${res.status} fixture=${fixtureId}`);
      oddsCache.set(fixtureId, { ts: Date.now(), odds: {} });
      return {};
    }
    const json = await res.json();
    const parsed = parseSportmonksOdds(json.data || []);
    oddsCache.set(fixtureId, { ts: Date.now(), odds: parsed });
    return parsed;
  } catch (e) {
    console.warn(`[SM-PrematchOdds] erro fixture=${fixtureId}:`, (e as Error).message);
    oddsCache.set(fixtureId, { ts: Date.now(), odds: {} });
    return {};
  }
}

export function normalizePrematchMarketLabel(market: string): string | null {
  const m = (market || "").toLowerCase().trim();
  if (!m) return null;
  if (m === "casa" || m === "home" || m === "1" || m.includes("1x2 - casa")) return "Casa";
  if (m === "empate" || m === "draw" || m === "x" || m.includes("1x2 - empate")) return "Empate";
  if (m === "fora" || m === "away" || m === "2" || m.includes("1x2 - fora")) return "Fora";
  if (/over\s*1\.5/.test(m)) return "Over 1.5";
  if (/under\s*1\.5/.test(m)) return "Under 1.5";
  if (/over\s*2\.5/.test(m)) return "Over 2.5";
  if (/under\s*2\.5/.test(m)) return "Under 2.5";
  if (/over\s*3\.5/.test(m)) return "Over 3.5";
  if (/under\s*3\.5/.test(m)) return "Under 3.5";
  if (/btts.*(sim|yes)|ambas.*(sim|yes|marcam)/.test(m)) return "BTTS Sim";
  if (/btts.*(n[aã]o|no)|ambas.*(n[aã]o|no)/.test(m)) return "BTTS Não";
  return null;
}

export function listPrematchMarkets(odds: Record<string, number>): Array<{ market: string; odd: number }> {
  return Object.entries(odds)
    .filter(([market, odd]) => !market.startsWith("AH ") && Number.isFinite(odd))
    .map(([market, odd]) => ({ market, odd }))
    .sort((a, b) => a.market.localeCompare(b.market));
}