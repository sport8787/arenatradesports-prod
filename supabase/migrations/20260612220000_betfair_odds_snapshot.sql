-- betfair_odds_snapshot — Snapshots de odds Betfair pré-live
-- Capturados pela edge function capture-prelive-odds em dois momentos:
--   'opening'  → primeira captura do dia (estabelece linha de abertura)
--   'closing'  → ≤60min antes do kickoff (linha de fechamento para CLV)
-- Também suporta 'midpoint' para análise de steam intra-dia.

CREATE TABLE IF NOT EXISTS public.betfair_odds_snapshot (
  id             bigserial       PRIMARY KEY,
  event_id       text            NOT NULL,
  home_team      text            NOT NULL,
  away_team      text            NOT NULL,
  league_name    text,
  event_date     timestamptz,
  market_type    text            NOT NULL,   -- MATCH_ODDS, OVER_UNDER_25, OVER_UNDER_35, BOTH_TEAMS_TO_SCORE
  selection      text            NOT NULL,   -- runner: "Arsenal", "Over 2.5", etc.
  back_odd       numeric(8,3),
  lay_odd        numeric(8,3),
  mid_odd        numeric(8,3),              -- (back+lay)/2 ou back quando lay nulo
  fair_prob      numeric(7,5),              -- 1/mid_odd
  total_matched  numeric(14,2),
  snapshot_type  text            NOT NULL   CHECK (snapshot_type IN ('opening', 'midpoint', 'closing')),
  captured_at    timestamptz     NOT NULL   DEFAULT now(),
  CONSTRAINT betfair_odds_snapshot_uq
    UNIQUE (event_id, market_type, selection, snapshot_type)
);

CREATE INDEX IF NOT EXISTS betfair_odds_snapshot_event_idx
  ON public.betfair_odds_snapshot (event_id);

CREATE INDEX IF NOT EXISTS betfair_odds_snapshot_teams_date_idx
  ON public.betfair_odds_snapshot (home_team, away_team, event_date);

CREATE INDEX IF NOT EXISTS betfair_odds_snapshot_type_at_idx
  ON public.betfair_odds_snapshot (snapshot_type, captured_at DESC);

-- TTL automático: apaga snapshots com mais de 30 dias (pg_cron já gerencia)
-- RLS: apenas service_role acessa (edge functions)
ALTER TABLE public.betfair_odds_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON public.betfair_odds_snapshot
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.betfair_odds_snapshot IS
  'Snapshots de odds Betfair pré-live para CLV real. Populado por capture-prelive-odds a cada 30min.';
