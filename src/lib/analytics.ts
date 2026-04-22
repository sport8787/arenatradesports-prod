import posthog from 'posthog-js';
import { getAttributionProps } from './utm';

// PostHog is now initialized via PostHogProvider in main.tsx
// These helpers use the singleton instance from posthog-js

export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  // Anexa first/last touch como user properties (set once = imutável depois)
  const attribution = getAttributionProps();
  const firstAttr: Record<string, string> = {};
  const allAttr: Record<string, string> = {};
  Object.entries(attribution).forEach(([k, v]) => {
    if (k.startsWith('first_')) firstAttr[k] = v;
    allAttr[k] = v;
  });
  posthog.identify(userId, {
    ...properties,
    ...allAttr,
    $set_once: firstAttr,
  });
};

export const resetAnalytics = () => {
  posthog.reset();
};

export const track = {
  // ── ATIVAÇÃO ──
  signUp: (plan: string, source: string, method: 'email' | 'google' | 'apple' = 'email') => {
    posthog.capture('user_signed_up', {
      plan,
      source,
      signup_method: method,
      ...getAttributionProps(),
    });
  },

  landingViewed: (page: string) => {
    posthog.capture('landing_viewed', { page, ...getAttributionProps() });
  },

  ctaClicked: (location: string, label: string) => {
    posthog.capture('cta_clicked', { location, label, ...getAttributionProps() });
  },

  paywallViewed: (origin: string) => {
    posthog.capture('paywall_viewed', { origin, ...getAttributionProps() });
  },

  checkoutInitiated: (plan: string, price: number, origin: 'paywall' | 'oferta_especial') => {
    posthog.capture('checkout_initiated', {
      plan,
      price,
      origin,
      ...getAttributionProps(),
    });
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

  // ── LANDING FUNNEL ──
  /**
   * Disparado quando uma seção da landing entra no viewport (>=50% visível).
   * Use `stage` para agrupar etapas do funil: hero | video | prova_brutal | pricing | cta_final etc.
   */
  sectionViewed: (stage: string, sectionId?: string) => {
    posthog.capture('landing_section_viewed', {
      stage,
      section_id: sectionId ?? stage,
      ...getAttributionProps(),
    });
  },

  /**
   * Eventos do player de vídeo (VSL).
   * event: play | progress_25 | progress_50 | progress_75 | complete | pause
   */
  videoEvent: (event: string, properties?: Record<string, any>) => {
    posthog.capture('landing_video_event', {
      video_event: event,
      ...properties,
      ...getAttributionProps(),
    });
  },

  /**
   * CTA da landing com etapa do funil para análise de conversão por seção.
   */
  funnelCtaClicked: (stage: string, label: string, location?: string) => {
    posthog.capture('landing_cta_clicked', {
      stage,
      label,
      location: location ?? stage,
      ...getAttributionProps(),
    });
    // Mantém compatibilidade com cta_clicked existente
    posthog.capture('cta_clicked', { location: location ?? stage, label, ...getAttributionProps() });
  },

  // ── GENERIC ──
  custom: (event: string, properties?: Record<string, any>) => {
    posthog.capture(event, properties);
  },
};
