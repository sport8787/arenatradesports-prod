// Single source of truth for the live-match stats shape used across edge functions
// (mycroft-sports-analysis, evaluate-cashout, etc).
//
// All edge functions consuming `match.stats` or `liveMatch.stats` MUST treat the
// object as `MatchStats` (not `any`). Optional fields default to 0 via `getStat()`.
//
// Keep this file in sync with the `MatchData.stats` interface in
// `mycroft-sports-analysis/index.ts`.

export interface MatchStats {
  attacks_home?: number;
  attacks_away?: number;
  dangerous_attacks_home?: number;
  dangerous_attacks_away?: number;
  xG_home?: number;
  xG_away?: number;
  // tolerated lowercase aliases (legacy feeds)
  xg_home?: number;
  xg_away?: number;
  possession_home?: number;
  possession_away?: number;
  shots_home?: number;
  shots_away?: number;
  shots_total_home?: number;
  shots_total_away?: number;
  shots_on_target_home?: number;
  shots_on_target_away?: number;
}

export type StatKey = keyof MatchStats;

/** Safely read a numeric stat, defaulting to 0. */
export function getStat(stats: MatchStats | null | undefined, key: StatKey): number {
  if (!stats) return 0;
  const v = stats[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Sum of dangerous attacks (home + away), tolerating missing fields. */
export function dangerousAttacksTotal(stats: MatchStats | null | undefined): number {
  return (
    getStat(stats, "dangerous_attacks_home") +
    getStat(stats, "dangerous_attacks_away")
  );
}

/** Sum of shots-on-target (home + away). */
export function shotsOnTargetTotal(stats: MatchStats | null | undefined): number {
  return (
    getStat(stats, "shots_on_target_home") +
    getStat(stats, "shots_on_target_away")
  );
}

/** Sum of xG (home + away), tolerating both `xG_*` and lowercase `xg_*`. */
export function xgTotal(stats: MatchStats | null | undefined): number {
  const home = getStat(stats, "xG_home") || getStat(stats, "xg_home");
  const away = getStat(stats, "xG_away") || getStat(stats, "xg_away");
  return home + away;
}
