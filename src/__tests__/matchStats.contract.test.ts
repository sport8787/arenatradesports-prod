/**
 * Type-pinning tests for the shared `MatchStats` shape used by edge functions
 * (mycroft-sports-analysis, evaluate-cashout, etc).
 *
 * These tests exist to catch regressions where callers accidentally:
 *   - cast `match.stats` to `any` and start reading non-existent fields
 *   - rename a stat key without updating the shared interface
 *   - return `undefined` instead of `0` for a missing numeric stat
 *
 * If you add a new field to `MatchStats`, also add an assertion below.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import {
  type MatchStats,
  type StatKey,
  getStat,
  dangerousAttacksTotal,
  shotsOnTargetTotal,
  xgTotal,
} from "../../supabase/functions/_shared/matchStats";

describe("MatchStats contract", () => {
  it("getStat returns 0 for null/undefined/missing fields", () => {
    expect(getStat(null, "attacks_home")).toBe(0);
    expect(getStat(undefined, "shots_home")).toBe(0);
    expect(getStat({}, "dangerous_attacks_home")).toBe(0);
    expect(getStat({ attacks_home: undefined }, "attacks_home")).toBe(0);
    expect(getStat({ attacks_home: NaN }, "attacks_home")).toBe(0);
  });

  it("getStat returns numeric values verbatim", () => {
    const s: MatchStats = { dangerous_attacks_home: 12, dangerous_attacks_away: 8 };
    expect(getStat(s, "dangerous_attacks_home")).toBe(12);
    expect(dangerousAttacksTotal(s)).toBe(20);
  });

  it("xgTotal tolerates both xG_* and xg_* aliases", () => {
    expect(xgTotal({ xG_home: 1.2, xG_away: 0.8 })).toBeCloseTo(2.0);
    expect(xgTotal({ xg_home: 1.2, xg_away: 0.8 })).toBeCloseTo(2.0);
    expect(xgTotal({})).toBe(0);
  });

  it("shotsOnTargetTotal sums correctly", () => {
    expect(shotsOnTargetTotal({ shots_on_target_home: 4, shots_on_target_away: 2 })).toBe(6);
  });

  // ============================================================
  // Compile-time guards (these fail the BUILD if types regress)
  // ============================================================

  it("StatKey union includes all required fields", () => {
    // If any of these keys is removed from MatchStats, this fails to compile.
    const keys: StatKey[] = [
      "attacks_home",
      "attacks_away",
      "dangerous_attacks_home",
      "dangerous_attacks_away",
      "xG_home",
      "xG_away",
      "xg_home",
      "xg_away",
      "possession_home",
      "possession_away",
      "shots_home",
      "shots_away",
      "shots_total_home",
      "shots_total_away",
      "shots_on_target_home",
      "shots_on_target_away",
    ];
    expect(keys.length).toBeGreaterThan(0);
  });

  it("getStat signature accepts MatchStats | null | undefined and returns number", () => {
    expectTypeOf(getStat).parameters.toEqualTypeOf<[MatchStats | null | undefined, StatKey]>();
    expectTypeOf(getStat).returns.toEqualTypeOf<number>();
  });

  it("aggregator helpers return number (never undefined)", () => {
    expectTypeOf(dangerousAttacksTotal).returns.toEqualTypeOf<number>();
    expectTypeOf(shotsOnTargetTotal).returns.toEqualTypeOf<number>();
    expectTypeOf(xgTotal).returns.toEqualTypeOf<number>();
  });

  it("rejects unknown stat keys at compile time", () => {
    // @ts-expect-error — "fake_field" is not a valid StatKey
    getStat({}, "fake_field");
    // @ts-expect-error — "u_s" was a legacy `any` alias and must NOT exist on the typed surface
    const _bad: MatchStats = { u_s: 1 };
    void _bad;
  });
});
