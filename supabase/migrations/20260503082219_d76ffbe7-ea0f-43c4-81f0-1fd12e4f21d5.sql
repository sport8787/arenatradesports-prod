
-- Tabela de checklist de ativação para retenção do usuário
CREATE TABLE IF NOT EXISTS public.user_activation_checklist (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saw_first_signal BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_push BOOLEAN NOT NULL DEFAULT FALSE,
  placed_first_virtual_bet BOOLEAN NOT NULL DEFAULT FALSE,
  configured_bankroll BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activation_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activation checklist"
ON public.user_activation_checklist
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activation checklist"
ON public.user_activation_checklist
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activation checklist"
ON public.user_activation_checklist
FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_activation_checklist_updated_at
BEFORE UPDATE ON public.user_activation_checklist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
