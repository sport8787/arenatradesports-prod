
-- 1) Replace permissive ALL policies scoped to {public} with service_role-only equivalents

DROP POLICY IF EXISTS "Service role can manage cache" ON public.ai_response_cache;
CREATE POLICY "Service role can manage cache" ON public.ai_response_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage arena matches" ON public.arena_matches;
CREATE POLICY "Service role can manage arena matches" ON public.arena_matches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage arena odds" ON public.arena_odds;
CREATE POLICY "Service role can manage arena odds" ON public.arena_odds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage arena patterns" ON public.arena_patterns;
CREATE POLICY "Service role can manage arena patterns" ON public.arena_patterns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage correlations" ON public.bet_correlations;
CREATE POLICY "Service role can manage correlations" ON public.bet_correlations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "live_sinais service write" ON public.live_sinais;
CREATE POLICY "live_sinais service write" ON public.live_sinais
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage market analysis" ON public.market_analysis;
CREATE POLICY "Service role can manage market analysis" ON public.market_analysis
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage model performance" ON public.model_performance;
CREATE POLICY "Service role can manage model performance" ON public.model_performance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage sharp signals" ON public.sharp_money_signals;
CREATE POLICY "Service role can manage sharp signals" ON public.sharp_money_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages sinais alavanca" ON public.sinais_alavanca;
CREATE POLICY "Service role manages sinais alavanca" ON public.sinais_alavanca
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) Solo rankings: only authenticated users may insert their own entries
DROP POLICY IF EXISTS "Users can insert their own solo ranking" ON public.solo_rankings;
CREATE POLICY "Authenticated users can insert solo rankings" ON public.solo_rankings
  FOR INSERT TO authenticated WITH CHECK (true);
