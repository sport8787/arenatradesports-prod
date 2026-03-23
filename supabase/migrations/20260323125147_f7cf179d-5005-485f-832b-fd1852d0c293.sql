
-- Drop old dedup index
DROP INDEX IF EXISTS idx_virtual_bets_punter_dedup;

-- Create new unique index with normalized match_id + market
CREATE UNIQUE INDEX idx_virtual_bets_punter_dedup 
ON public.virtual_bets_punter (user_id, public.normalize_match_id(match_id), market) 
WHERE status != 'dismissed';
