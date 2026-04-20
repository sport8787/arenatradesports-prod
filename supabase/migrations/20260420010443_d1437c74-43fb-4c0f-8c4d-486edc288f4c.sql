CREATE TABLE IF NOT EXISTS public.trader_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  market text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('APROVADO', 'CANCELADO')),
  home_team text,
  away_team text,
  odd numeric,
  confidence numeric,
  sent_date date NOT NULL DEFAULT CURRENT_DATE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  telegram_sent boolean NOT NULL DEFAULT false,
  push_sent boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trader_notif_unique_daily
  ON public.trader_notifications_sent (match_id, market, event_type, sent_date);

CREATE INDEX IF NOT EXISTS idx_trader_notif_sent_at
  ON public.trader_notifications_sent (sent_at DESC);

ALTER TABLE public.trader_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.trader_notifications_sent
  FOR ALL
  USING (false);
