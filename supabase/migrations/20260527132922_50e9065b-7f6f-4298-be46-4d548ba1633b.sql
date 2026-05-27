
-- 1) bets_history: restringir policy ALL ao service_role
DROP POLICY IF EXISTS "Service role can manage all bets history" ON public.bets_history;
CREATE POLICY "Service role can manage all bets history"
ON public.bets_history
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2) cashout_history: INSERT só service_role
DROP POLICY IF EXISTS "Service role inserts cashout history" ON public.cashout_history;
CREATE POLICY "Service role inserts cashout history"
ON public.cashout_history
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3) cashout_signals_log: usuário só insere com user_id próprio; service_role livre
DROP POLICY IF EXISTS "Service can insert signals" ON public.cashout_signals_log;
CREATE POLICY "Users can insert own signals"
ON public.cashout_signals_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages signals"
ON public.cashout_signals_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4) consent_records: WITH CHECK precisa amarrar user_id
DROP POLICY IF EXISTS "Anyone can record consent" ON public.consent_records;
CREATE POLICY "Anyone can record consent"
ON public.consent_records
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 5) mycroft_rules_history: INSERT apenas service_role
DROP POLICY IF EXISTS "System can insert history" ON public.mycroft_rules_history;
CREATE POLICY "Service role inserts rules history"
ON public.mycroft_rules_history
FOR INSERT
TO service_role
WITH CHECK (true);

-- 6) realtime.messages: garantir RLS e exigir autenticação para broadcast/presence
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can send realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);
