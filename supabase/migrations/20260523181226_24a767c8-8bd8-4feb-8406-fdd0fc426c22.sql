
-- 1) cron_settings: admin-only
DROP POLICY IF EXISTS "Authenticated users can read cron_settings" ON public.cron_settings;
DROP POLICY IF EXISTS "Authenticated users can update cron_settings" ON public.cron_settings;
CREATE POLICY "Admins can read cron_settings"
  ON public.cron_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update cron_settings"
  ON public.cron_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) mycroft_memory
DROP POLICY IF EXISTS "Service role full access" ON public.mycroft_memory;

-- 3) training_labels
DROP POLICY IF EXISTS "System can manage training labels" ON public.training_labels;
DROP POLICY IF EXISTS "Training labels are viewable" ON public.training_labels;
CREATE POLICY "Authenticated can read training labels"
  ON public.training_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage training labels"
  ON public.training_labels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) user_subscriptions
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can insert own trial subscription"
  ON public.user_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND plan = 'trial');

-- 5) user_vocal_profiles
DROP POLICY IF EXISTS "System can manage vocal profiles" ON public.user_vocal_profiles;

-- 6) rooms (host_id is TEXT)
DROP POLICY IF EXISTS "Anyone can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "System can delete old rooms" ON public.rooms;
CREATE POLICY "Host can update own rooms"
  ON public.rooms FOR UPDATE TO authenticated
  USING (host_id = auth.uid()::text)
  WITH CHECK (host_id = auth.uid()::text);
CREATE POLICY "Host can delete own rooms"
  ON public.rooms FOR DELETE TO authenticated
  USING (host_id = auth.uid()::text);

-- 7) matches
DROP POLICY IF EXISTS "Participants can update their matches" ON public.matches;
CREATE POLICY "Player can update own matches"
  ON public.matches FOR UPDATE TO authenticated
  USING (player_user_id = auth.uid())
  WITH CHECK (player_user_id = auth.uid());

-- 8) room_events
DROP POLICY IF EXISTS "System can delete room events" ON public.room_events;

-- 9) solo_rankings / rankings
DROP POLICY IF EXISTS "Users can update their own solo ranking" ON public.solo_rankings;
DROP POLICY IF EXISTS "Anyone can update their ranking" ON public.rankings;

-- 10) Storage: drop public delete/update on game-audio & game-video
DROP POLICY IF EXISTS "Anyone can delete audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete game videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update game videos" ON storage.objects;

-- 11) Knowledge-base buckets
DROP POLICY IF EXISTS "Authenticated users can delete KB files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from poker-knowledge-base" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete sports KB files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update poker-knowledge-base" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update sports KB files" ON storage.objects;
CREATE POLICY "Admins delete shared knowledge-base buckets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('knowledge-base','poker-knowledge-base','sports-knowledge-base')
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Admins update shared knowledge-base buckets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('knowledge-base','poker-knowledge-base','sports-knowledge-base')
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    bucket_id IN ('knowledge-base','poker-knowledge-base','sports-knowledge-base')
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
