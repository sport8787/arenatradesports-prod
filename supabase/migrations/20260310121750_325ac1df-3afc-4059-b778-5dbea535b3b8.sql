
CREATE TABLE public.mycroft_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mycroft_type text NOT NULL DEFAULT 'sports',
  instruction text NOT NULL,
  category text NOT NULL DEFAULT 'rule',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_mycroft_memory_user_type ON public.mycroft_memory(user_id, mycroft_type, is_active);

ALTER TABLE public.mycroft_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories" ON public.mycroft_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memories" ON public.mycroft_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.mycroft_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.mycroft_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.mycroft_memory FOR ALL USING (true) WITH CHECK (true);
