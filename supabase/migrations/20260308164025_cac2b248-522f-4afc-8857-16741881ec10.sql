
-- Add unique constraints for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS market_analysis_match_market_idx ON public.market_analysis (match_id, market);
CREATE UNIQUE INDEX IF NOT EXISTS sharp_money_signals_match_market_idx ON public.sharp_money_signals (match_id, market);
