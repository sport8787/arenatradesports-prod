
-- 1) Rankings: remove anonymous SELECT (require authenticated) to avoid exposing user_id publicly
DROP POLICY IF EXISTS "Arena trader rankings are publicly readable" ON public.arena_trader_rankings;
CREATE POLICY "Arena trader rankings readable by authenticated"
  ON public.arena_trader_rankings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Punter rankings are publicly readable" ON public.punter_rankings;
CREATE POLICY "Punter rankings readable by authenticated"
  ON public.punter_rankings FOR SELECT TO authenticated USING (true);

-- 2) purchase_events: add explicit service_role policy for automated webhook inserts
DROP POLICY IF EXISTS "Service role manages purchase events" ON public.purchase_events;
CREATE POLICY "Service role manages purchase events"
  ON public.purchase_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) solo_rankings: tighten via validation trigger (nickname/session length, anti-spam)
CREATE OR REPLACE FUNCTION public.validate_solo_ranking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.nickname IS NULL OR length(btrim(NEW.nickname)) < 1 OR length(NEW.nickname) > 30 THEN
    RAISE EXCEPTION 'invalid nickname';
  END IF;
  IF NEW.session_id IS NULL OR length(NEW.session_id) < 4 OR length(NEW.session_id) > 80 THEN
    RAISE EXCEPTION 'invalid session_id';
  END IF;
  IF NEW.total_games < 0 OR NEW.total_wins < 0 OR NEW.total_points < 0 THEN
    RAISE EXCEPTION 'invalid counters';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_solo_ranking ON public.solo_rankings;
CREATE TRIGGER trg_validate_solo_ranking
  BEFORE INSERT OR UPDATE ON public.solo_rankings
  FOR EACH ROW EXECUTE FUNCTION public.validate_solo_ranking();

-- 4) Storage audio-cache: restrict INSERT/DELETE to service_role only
DROP POLICY IF EXISTS "Service role can upload to audio cache" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete from audio cache" ON storage.objects;
CREATE POLICY "audio-cache insert service_role only"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'audio-cache');
CREATE POLICY "audio-cache delete service_role only"
  ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'audio-cache');

-- 5) game-audio / game-video: restrict INSERT to admins (has_role)
DROP POLICY IF EXISTS "Authenticated can upload game audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload game video" ON storage.objects;
CREATE POLICY "game-audio insert admin only"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-audio' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "game-video insert admin only"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-video' AND public.has_role(auth.uid(), 'admin'::public.app_role));
