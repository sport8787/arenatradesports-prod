/**
 * Self Learning Betting Engine Configuration
 * 
 * Controls how the Arena learns from its own results
 * to continuously improve the model.
 */
export const LEARNING_CONFIG = {
  // Minimum sample sizes for reliable patterns
  MIN_BETS_FOR_PATTERN: 100,
  MIN_BETS_FOR_LEAGUE: 30,
  MIN_BETS_FOR_MARKET: 50,

  // Recalibration frequency
  RECALIBRATE_DAILY: true,
  RECALIBRATE_WEEKLY: true,
  RECALIBRATE_MONTHLY: true,

  // Performance thresholds
  MIN_ROI_FOR_BOOST: 10,      // 10% ROI = boost pattern weight
  MAX_ROI_FOR_PENALTY: -5,    // -5% ROI = penalize pattern weight

  // Weight adjustment limits (safety)
  MAX_WEIGHT_CHANGE_PER_UPDATE: 0.05, // Max 5% change per recalibration

  // Asset Score component weights (initial)
  INITIAL_WEIGHTS: {
    prob_model: 0.25,
    value_odds: 0.20,
    statistics: 0.15,
    pattern_engine: 0.15,
    market_inefficiency: 0.10,
    sharp_money: 0.10,
    odds_drift: 0.05,
  },

  // Market Inefficiency Score thresholds
  MIS_THRESHOLDS: {
    noise: 0.02,       // < 2% = noise
    light: 0.05,       // 2-5% = light
    strong: 0.10,      // 5-10% = strong
    extreme: 0.10,     // > 10% = extreme distortion
  },

  // Sharp Money detection thresholds
  SHARP_THRESHOLDS: {
    steam_move_pct: 0.08,         // > 8% drop in < 10 min
    steam_move_window_min: 10,
    rlm_score_boost: 15,          // +15 to Asset Score
    consensus_min_bookmakers: 3,  // Need 3+ bookmakers moving same direction
  },

  // Sharp Activity Score ranges
  SHARP_ACTIVITY_LEVELS: {
    normal: { min: 0, max: 10 },
    activity: { min: 10, max: 25 },
    sharp_money: { min: 25, max: 40 },
    steam_professional: { min: 40, max: 100 },
  },

  // Odds Drift Index threshold
  ODI_SUSPICIOUS_THRESHOLD: 0.15, // > 15% movement = suspicious

  // CLV (Closing Line Value)
  CLV_POSITIVE_THRESHOLD: 0.02, // > 2% CLV = good signal
} as const;

export type LearningWeights = typeof LEARNING_CONFIG.INITIAL_WEIGHTS;
