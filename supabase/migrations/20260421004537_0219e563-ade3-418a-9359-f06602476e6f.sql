CREATE TABLE public.mycroft_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  match_id TEXT,
  home_team TEXT,
  away_team TEXT,
  league TEXT,
  minute INTEGER,
  score_home INTEGER,
  score_away INTEGER,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  tokens_estimated INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mycroft_chat_logs_user_id ON public.mycroft_chat_logs(user_id);
CREATE INDEX idx_mycroft_chat_logs_created_at ON public.mycroft_chat_logs(created_at DESC);
CREATE INDEX idx_mycroft_chat_logs_match_id ON public.mycroft_chat_logs(match_id);

ALTER TABLE public.mycroft_chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat logs"
ON public.mycroft_chat_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all chat logs"
ON public.mycroft_chat_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));