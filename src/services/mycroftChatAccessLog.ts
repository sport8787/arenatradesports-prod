import { supabase } from '@/integrations/supabase/client';

export type MycroftChatSource = 'analyst' | 'match' | 'sports' | 'other';
export type MycroftChatBlockReason =
  | 'no_login'
  | 'free'
  | 'trial_expired'
  | 'plan_insufficient'
  | 'unknown';

export interface LogMycroftChatAttemptInput {
  source: MycroftChatSource;
  reason: MycroftChatBlockReason;
  plan?: string | null;
  daysLeft?: number | null;
  matchId?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  league?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Throttle local (5min por chave) para evitar floods caso o usuário
 * abra/fecha o modal várias vezes. O backend tem throttle de 30s adicional.
 */
const THROTTLE_MS = 5 * 60 * 1000;
const recentLogs = new Map<string, number>();

export async function logMycroftChatAttempt(input: LogMycroftChatAttemptInput): Promise<void> {
  try {
    const key = `${input.source}|${input.matchId || ''}|${input.reason}`;
    const last = recentLogs.get(key) || 0;
    if (Date.now() - last < THROTTLE_MS) return;
    recentLogs.set(key, Date.now());

    const route =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    await supabase.rpc('log_mycroft_chat_attempt', {
      p_source: input.source,
      p_reason: input.reason,
      p_plan: input.plan ?? null,
      p_days_left: input.daysLeft ?? null,
      p_route: route,
      p_match_id: input.matchId ?? null,
      p_home_team: input.homeTeam ?? null,
      p_away_team: input.awayTeam ?? null,
      p_league: input.league ?? null,
      p_user_agent: userAgent,
      p_metadata: (input.metadata ?? {}) as never,
    });
  } catch {
    // silencioso — log de telemetria não pode atrapalhar UX
  }
}
