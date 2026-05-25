
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS horus_mode TEXT NOT NULL DEFAULT 'mentor' 
  CHECK (horus_mode IN ('silent','critical_only','mentor','narrator'));

CREATE TABLE IF NOT EXISTS public.user_horus_seen (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trigger_key)
);
ALTER TABLE public.user_horus_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own horus seen select" ON public.user_horus_seen FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own horus seen insert" ON public.user_horus_seen FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own horus seen delete" ON public.user_horus_seen FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.horus_triggers (
  trigger_key TEXT PRIMARY KEY,
  texto TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('onboarding','evento','dica','critico')),
  min_mode TEXT NOT NULL DEFAULT 'mentor' CHECK (min_mode IN ('critical_only','mentor','narrator')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.horus_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read horus triggers" ON public.horus_triggers FOR SELECT USING (true);

INSERT INTO public.horus_triggers (trigger_key, texto, categoria, min_mode) VALUES
  ('ciclos_first_visit',          'Esta é sua banca de ciclos. Separada da banca principal. Cada ciclo possui regra operacional própria.', 'onboarding', 'mentor'),
  ('punter_meu_plano_first_visit','Aqui você cria seu plano determinístico. O Mycroft global continua rodando em paralelo.',                'onboarding', 'mentor'),
  ('trader_meu_plano_first_visit','Seu plano filtra apenas o que importa para você. Mycroft segue ativo no fundo.',                         'onboarding', 'mentor'),
  ('punter_first_visit',          'Pré-live. Mantenha sua Betfair logada. Oportunidades podem ser aprovadas a qualquer momento.',          'onboarding', 'mentor'),
  ('punter_config_first_visit',   'Aqui você ajusta meu comportamento. Se preferir silêncio, é só escolher.',                               'onboarding', 'mentor'),
  ('eventos_raros_first_visit',   'Mercados raros, alto valor. Sempre com banca isolada.',                                                  'onboarding', 'mentor'),
  ('liga_mycroft_first_visit',    'Liga Mycroft. ROI percentual decide o ranking. Não é volume.',                                           'onboarding', 'mentor'),
  ('opportunity_approved_punter', 'Nova oportunidade aprovada na Arena Punter.',                                                            'evento',     'critical_only'),
  ('opportunity_approved_trader', 'Nova oportunidade aprovada na Arena Trader.',                                                            'evento',     'critical_only'),
  ('cashout_critical',            'O mercado mudou. Avalie sair da posição agora.',                                                         'critico',    'critical_only'),
  ('betfair_disconnected',        'Sua conta Betfair está desconectada.',                                                                   'critico',    'critical_only'),
  ('horus_pilota_paused',         'Operação pausada. Dois reveses consecutivos no método.',                                                 'evento',     'mentor'),
  ('trial_expiring_soon',         'Seu acesso expira em dois dias.',                                                                        'evento',     'mentor'),
  ('punter_connect_betfair',      'Conecte sua Betfair. Entradas aprovadas exigem execução rápida.',                                        'dica',       'mentor'),
  ('advanced_filter_enabled',     'Filtro avançado ativado.',                                                                               'dica',       'mentor')
ON CONFLICT (trigger_key) DO NOTHING;
