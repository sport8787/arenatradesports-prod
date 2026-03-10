import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_RnKvfx3XmL6ASJSDNrNf8WiVBUEEOM57pzru1KwhX2f';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export const initAnalytics = () => {
  if (initialized || typeof window === 'undefined') return;
  
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
  });
  
  initialized = true;
  console.log('[Analytics] PostHog initialized');
};

export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  if (!initialized) return;
  posthog.identify(userId, properties);
};

export const resetAnalytics = () => {
  if (!initialized) return;
  posthog.reset();
};

export const track = {
  // ── ATIVAÇÃO ──
  signUp: (plan: string, source: string) => {
    posthog.capture('user_signed_up', { plan, source });
  },

  firstBetViewed: (assetScore: number, edge: number) => {
    posthog.capture('first_bet_viewed', { asset_score: assetScore, edge });
  },

  // ── RETENÇÃO ──
  dailyLogin: (streakDays: number, totalBetsViewed?: number) => {
    posthog.capture('daily_login', { streak_days: streakDays, total_bets_viewed: totalBetsViewed });
  },

  // ── MONETIZAÇÃO ──
  subscriptionStarted: (plan: string, price: number, paymentMethod?: string) => {
    posthog.capture('subscription_started', {
      plan,
      price,
      payment_method: paymentMethod,
      $set: { plan },
    });
  },

  // ── ENGAJAMENTO ──
  betApprovedClicked: (match: string, edge: number, stake: number) => {
    posthog.capture('bet_approved_clicked', { match, edge, stake });
  },

  simuladoStarted: (totalQuestions: number) => {
    posthog.capture('simulado_started', { total_questions: totalQuestions });
  },

  // ── PRODUCT METRICS ──
  filterApplied: (filterType: string, value: any) => {
    posthog.capture('filter_applied', { filter_type: filterType, value });
  },

  multiBetOptimizerUsed: (combinations: number) => {
    posthog.capture('multi_bet_optimizer_used', { combinations_generated: combinations });
  },

  telegramNotificationReceived: (totalBets: number) => {
    posthog.capture('telegram_notification_received', { total_bets: totalBets });
  },

  pageView: (page: string) => {
    posthog.capture('$pageview', { page });
  },

  // ── GENERIC ──
  custom: (event: string, properties?: Record<string, any>) => {
    posthog.capture(event, properties);
  },
};
