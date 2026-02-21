
-- Storage bucket for hand history files
INSERT INTO storage.buckets (id, name, public) VALUES ('hand-history-files', 'hand-history-files', false);

-- RLS for hand history files storage
CREATE POLICY "Users can upload their own hand files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hand-history-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own hand files"
ON storage.objects FOR SELECT
USING (bucket_id = 'hand-history-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own hand files"
ON storage.objects FOR DELETE
USING (bucket_id = 'hand-history-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Table: uploaded hand history files
CREATE TABLE public.uploaded_hand_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  storage_path TEXT,
  raw_content TEXT NOT NULL,
  hands_count INTEGER NOT NULL DEFAULT 0,
  players_extracted TEXT[] DEFAULT '{}',
  file_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.uploaded_hand_files ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_uploaded_files_hash ON public.uploaded_hand_files(user_id, file_hash);

CREATE POLICY "Users can insert their own files"
ON public.uploaded_hand_files FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own files"
ON public.uploaded_hand_files FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
ON public.uploaded_hand_files FOR DELETE
USING (auth.uid() = user_id);

-- Table: villain profiles (recurring players)
CREATE TABLE public.villain_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  times_seen INTEGER NOT NULL DEFAULT 1,
  total_hands_against INTEGER NOT NULL DEFAULT 0,
  estimated_vpip NUMERIC,
  estimated_pfr NUMERIC,
  estimated_aggression NUMERIC,
  estimated_3bet NUMERIC,
  estimated_fold_to_3bet NUMERIC,
  showdown_frequency NUMERIC,
  ai_style_summary TEXT,
  ai_exploitable_tendencies TEXT,
  ai_danger_level TEXT,
  ai_evolution_notes TEXT,
  tags TEXT[] DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.villain_profiles ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_villain_unique ON public.villain_profiles(user_id, player_name, platform);

CREATE POLICY "Users can manage their own villain profiles"
ON public.villain_profiles FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Table: per-session stats for villains (evolution tracking)
CREATE TABLE public.villain_session_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  villain_profile_id UUID NOT NULL REFERENCES public.villain_profiles(id) ON DELETE CASCADE,
  uploaded_file_id UUID NOT NULL REFERENCES public.uploaded_hand_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  hands_played INTEGER NOT NULL DEFAULT 0,
  hands_won INTEGER NOT NULL DEFAULT 0,
  vpip_session NUMERIC,
  pfr_session NUMERIC,
  aggression_session NUMERIC,
  showdowns INTEGER NOT NULL DEFAULT 0,
  all_ins INTEGER NOT NULL DEFAULT 0,
  biggest_pot_bb NUMERIC,
  notable_plays TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.villain_session_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own villain session stats"
ON public.villain_session_stats FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
