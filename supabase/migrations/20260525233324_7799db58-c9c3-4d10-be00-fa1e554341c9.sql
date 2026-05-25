
-- 1) analises_comparativas: bloquear INSERT de authenticated
DROP POLICY IF EXISTS "Service can insert analises_comparativas" ON public.analises_comparativas;
CREATE POLICY "Only admins can insert analises_comparativas"
ON public.analises_comparativas
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) consent_records: restringir leitura/atualização ao próprio usuário autenticado
DROP POLICY IF EXISTS "Users can view their own consent" ON public.consent_records;
DROP POLICY IF EXISTS "Users can revoke their consent" ON public.consent_records;

CREATE POLICY "Users can view their own consent"
ON public.consent_records
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke their own consent"
ON public.consent_records
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) profiles: remover leitura pública anônima; manter leitura para autenticados
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 4) mycroft_vetoed_log: bloquear leitura/escrita públicas
DROP POLICY IF EXISTS "Anyone can read veto logs" ON public.mycroft_vetoed_log;
DROP POLICY IF EXISTS "Anyone can insert veto logs" ON public.mycroft_vetoed_log;

CREATE POLICY "Admins read veto logs"
ON public.mycroft_vetoed_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users insert own veto logs"
ON public.mycroft_vetoed_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5) punter_calibration: trocar email hardcoded por has_role admin
DROP POLICY IF EXISTS "Admin can insert punter calibration" ON public.punter_calibration;
DROP POLICY IF EXISTS "Admin can update punter calibration" ON public.punter_calibration;

CREATE POLICY "Admins insert punter calibration"
ON public.punter_calibration
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update punter calibration"
ON public.punter_calibration
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6) Storage game-audio / game-video: exigir autenticação para upload
DROP POLICY IF EXISTS "Anyone can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload game videos" ON storage.objects;

CREATE POLICY "Authenticated can upload game audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-audio');

CREATE POLICY "Authenticated can upload game video"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-video');

-- 7) Storage knowledge-base buckets: upload só para admins
DROP POLICY IF EXISTS "Authenticated users can upload PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload sports KB files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to poker-knowledge-base" ON storage.objects;

CREATE POLICY "Admins upload shared knowledge-base buckets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('knowledge-base','poker-knowledge-base','sports-knowledge-base')
  AND has_role(auth.uid(), 'admin'::app_role)
);
