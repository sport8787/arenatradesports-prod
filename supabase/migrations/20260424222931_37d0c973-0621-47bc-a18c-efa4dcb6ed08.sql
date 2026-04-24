
CREATE TABLE IF NOT EXISTS public.edge_function_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  context jsonb DEFAULT '{}'::jsonb,
  status_code integer,
  severity text NOT NULL DEFAULT 'error',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efe_created_at ON public.edge_function_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_efe_function_name ON public.edge_function_errors(function_name);

ALTER TABLE public.edge_function_errors ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with admin role can view (reuse existing has_role pattern)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE $p$
      CREATE POLICY "Admins can view edge function errors"
      ON public.edge_function_errors FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
  ELSE
    EXECUTE $p$
      CREATE POLICY "Authenticated can view edge function errors"
      ON public.edge_function_errors FOR SELECT
      TO authenticated
      USING (true)
    $p$;
  END IF;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.edge_function_errors;

-- Auto cleanup (keep last 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_edge_function_errors()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.edge_function_errors
  WHERE created_at < now() - interval '7 days';
$$;
