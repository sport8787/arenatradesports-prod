/**
 * Catálogo estático de gatilhos do Hórus Mentor.
 * Usado como fallback se a tabela `horus_triggers` no DB falhar.
 * Mantenha em sincronia com o seed da migration.
 */

export type HorusCategoria = 'onboarding' | 'evento' | 'dica' | 'critico';
export type HorusMode = 'silent' | 'critical_only' | 'mentor' | 'narrator';

export interface HorusTrigger {
  trigger_key: string;
  texto: string;
  categoria: HorusCategoria;
  min_mode: Exclude<HorusMode, 'silent'>;
  enabled: boolean;
}

export const HORUS_TRIGGERS_FALLBACK: HorusTrigger[] = [
  // Onboarding (primeiro acesso a páginas avançadas)
  { trigger_key: 'ciclos_first_visit',           texto: 'Esta é sua banca de ciclos. Separada da banca principal. Cada ciclo possui regra operacional própria.', categoria: 'onboarding', min_mode: 'mentor', enabled: true },
  { trigger_key: 'punter_meu_plano_first_visit', texto: 'Aqui você cria seu plano determinístico. O Mycroft global continua rodando em paralelo.',                categoria: 'onboarding', min_mode: 'mentor', enabled: true },
  { trigger_key: 'trader_meu_plano_first_visit', texto: 'Seu plano filtra apenas o que importa para você. Mycroft segue ativo no fundo.',                         categoria: 'onboarding', min_mode: 'mentor', enabled: true },
  { trigger_key: 'punter_first_visit',           texto: 'Pré-live. Mantenha sua Betfair logada. Oportunidades podem ser aprovadas a qualquer momento.',          categoria: 'onboarding', min_mode: 'mentor', enabled: true },
  { trigger_key: 'punter_config_first_visit',    texto: 'Aqui você ajusta meu comportamento. Se preferir silêncio, é só escolher.',                               categoria: 'onboarding', min_mode: 'mentor', enabled: true },
  { trigger_key: 'eventos_raros_first_visit',    texto: 'Mercados raros, alto valor. Sempre com banca isolada.',                                                  categoria: 'onboarding', min_mode: 'mentor', enabled: true },
  { trigger_key: 'liga_mycroft_first_visit',     texto: 'Liga Mycroft. ROI percentual decide o ranking. Não é volume.',                                           categoria: 'onboarding', min_mode: 'mentor', enabled: true },

  // Eventos importantes
  { trigger_key: 'opportunity_approved_punter',  texto: 'Nova oportunidade aprovada na Arena Punter.',           categoria: 'evento',  min_mode: 'critical_only', enabled: true },
  { trigger_key: 'opportunity_approved_trader',  texto: 'Nova oportunidade aprovada na Arena Trader.',           categoria: 'evento',  min_mode: 'critical_only', enabled: true },
  { trigger_key: 'cashout_critical',             texto: 'O mercado mudou. Avalie sair da posição agora.',        categoria: 'critico', min_mode: 'critical_only', enabled: true },
  { trigger_key: 'betfair_disconnected',         texto: 'Sua conta Betfair está desconectada.',                  categoria: 'critico', min_mode: 'critical_only', enabled: true },
  { trigger_key: 'horus_pilota_paused',          texto: 'Operação pausada. Dois reveses consecutivos no método.', categoria: 'evento', min_mode: 'mentor',        enabled: true },
  { trigger_key: 'trial_expiring_soon',          texto: 'Seu acesso expira em dois dias.',                       categoria: 'evento',  min_mode: 'mentor',        enabled: true },

  // Dicas operacionais
  { trigger_key: 'punter_connect_betfair',       texto: 'Conecte sua Betfair. Entradas aprovadas exigem execução rápida.', categoria: 'dica', min_mode: 'mentor', enabled: true },
  { trigger_key: 'advanced_filter_enabled',      texto: 'Filtro avançado ativado.',                                        categoria: 'dica', min_mode: 'mentor', enabled: true },
];

// Ordem hierárquica para comparação min_mode
export const MODE_RANK: Record<HorusMode, number> = {
  silent: 0,
  critical_only: 1,
  mentor: 2,
  narrator: 3,
};

export const HORUS_MODE_LABELS: Record<HorusMode, { title: string; desc: string }> = {
  silent:        { title: 'Silencioso',        desc: 'Hórus não fala. Apenas alertas visuais.' },
  critical_only: { title: 'Só críticos',       desc: 'Apenas oportunidades aprovadas, cash-out e Betfair desconectada.' },
  mentor:        { title: 'Mentor (padrão)',   desc: 'Onboarding no primeiro acesso, eventos importantes e dicas pontuais.' },
  narrator:      { title: 'Narrador',          desc: 'Tudo do Mentor + narração de mudanças de contexto.' },
};
