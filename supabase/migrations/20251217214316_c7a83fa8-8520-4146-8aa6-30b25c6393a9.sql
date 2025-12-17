-- Tabela de histórico de perguntas por usuário
CREATE TABLE public.user_question_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- Enable RLS
ALTER TABLE public.user_question_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own history"
ON public.user_question_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history"
ON public.user_question_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history"
ON public.user_question_history
FOR DELETE
USING (auth.uid() = user_id);

-- Allow anonymous/guest users (session-based) - for guest mode
CREATE POLICY "Anyone can manage session history"
ON public.user_question_history
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_user_question_history_user ON public.user_question_history(user_id);
CREATE INDEX idx_user_question_history_question ON public.user_question_history(question_id);