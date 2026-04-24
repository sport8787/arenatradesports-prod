
CREATE TABLE IF NOT EXISTS public.edge_function_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  duration_ms integer,
  status_code integer,
  error_message text,
  context jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efr_started_at ON public.edge_function_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_efr_function_name ON public.edge_function_runs(function_name);
CREATE INDEX IF NOT EXISTS idx_efr_status ON public.edge_function_runs(status);

ALTER TABLE public.edge_function_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE $p$
      CREATE POLICY "Admins can view edge function runs"
      ON public.edge_function_runs FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
  ELSE
    EXECUTE $p$
      CREATE POLICY "Authenticated can view edge function runs"
      ON public.edge_function_runs FOR SELECT
      TO authenticated
      USING (true)
    $p$;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.edge_function_runs;

CREATE OR REPLACE FUNCTION public.cleanup_old_edge_function_runs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.edge_function_runs WHERE started_at < now() - interval '7 days';
$$;
