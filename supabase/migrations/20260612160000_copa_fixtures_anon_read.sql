-- Permite leitura pública (anon) em copa_fixtures
-- Os dados são schedules públicos da Copa 2026, sem informação sensível
CREATE POLICY IF NOT EXISTS "copa_fixtures_read_anon"
  ON public.copa_fixtures FOR SELECT
  TO anon USING (true);
