
-- Background job queue for Mycroft live analyses.
-- Used as overflow when fetch-live-matches runs over its time budget,
-- and processed by a dedicated worker function with concurrency control.
CREATE TABLE IF NOT EXISTS public.mycroft_analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Avoid enqueueing the same match twice while a job is still pending/processing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mycroft_analysis_queue_match_pending
  ON public.mycroft_analysis_queue (match_id)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS idx_mycroft_analysis_queue_status_created
  ON public.mycroft_analysis_queue (status, created_at);

ALTER TABLE public.mycroft_analysis_queue ENABLE ROW LEVEL SECURITY;
-- No public policies — only service role (bypasses RLS) can read/write.

-- Atomic claim of N pending jobs (SKIP LOCKED) used by the worker.
CREATE OR REPLACE FUNCTION public.claim_mycroft_analysis_jobs(p_limit INT, p_worker TEXT)
RETURNS SETOF public.mycroft_analysis_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.mycroft_analysis_queue
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.mycroft_analysis_queue q
  SET status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker,
      updated_at = now()
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;

-- Cleanup helper: remove old completed/failed jobs.
CREATE OR REPLACE FUNCTION public.cleanup_mycroft_analysis_queue()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.mycroft_analysis_queue
  WHERE status IN ('done','failed') AND updated_at < now() - interval '2 days';
$$;

-- Re-queue stuck 'processing' rows older than 5 min (worker died mid-flight).
CREATE OR REPLACE FUNCTION public.requeue_stuck_mycroft_jobs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  UPDATE public.mycroft_analysis_queue
  SET status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE status = 'processing'
    AND locked_at < now() - interval '5 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
