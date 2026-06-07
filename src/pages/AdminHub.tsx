import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import {
  Users,
  CreditCard,
  ShieldCheck,
  Activity,
  AlertTriangle,
  MessageSquare,
  Brain,
  Bell,
  ScrollText,
  Search,
  ListChecks,
  ArrowLeft,
  BookOpen,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminLink {
  to: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  group: 'Operação' | 'Análise' | 'Usuários' | 'Mycroft' | 'Logs';
}

const LINKS: AdminLink[] = [
  // Usuários
  {
    to: '/admin',
    label: 'Dashboard de Usuários',
    description: 'Lista, status, trial e conversão de cada conta.',
    icon: <Users className="h-4 w-4" />,
    group: 'Usuários',
  },
  {
    to: '/admin/assinaturas',
    label: 'Assinaturas',
    description: 'Conceder/revogar planos, alterar arenas, anotar pagamentos.',
    icon: <CreditCard className="h-4 w-4" />,
    group: 'Usuários',
  },
  {
    to: '/admin/metricas-conversao',
    label: 'Métricas de Conversão',
    description: 'Visão geral, retenção D1/D3, trial→pago e lista completa de usuários.',
    icon: <Users className="h-4 w-4" />,
    group: 'Usuários',
  },
  // Operação
  {
    to: '/admin/edge-status',
    label: 'Status das Edge Functions',
    description: 'Saúde, latência e contadores das funções deployadas.',
    icon: <Activity className="h-4 w-4" />,
    group: 'Operação',
  },
  {
    to: '/admin/edge-errors',
    label: 'Erros das Edges',
    description: 'Stack traces e erros recentes dos workers.',
    icon: <AlertTriangle className="h-4 w-4" />,
    group: 'Operação',
  },
  {
    to: '/admin/futodds-health',
    label: 'Futodds Health',
    description: 'Latência, taxa de erro e cobertura de ligas dos endpoints Futodds.',
    icon: <Activity className="h-4 w-4" />,
    group: 'Operação',
  },
  {
    to: '/admin/settlement-log',
    label: 'Log de Liquidações',
    description: 'Histórico completo de settlements (skip, green, red, erros).',
    icon: <ScrollText className="h-4 w-4" />,
    group: 'Logs',
  },
  {
    to: '/admin/push-test',
    label: 'Push Test',
    description: 'Disparar push notifications de teste para QA.',
    icon: <Bell className="h-4 w-4" />,
    group: 'Operação',
  },
  {
    to: '/admin/api-key-expirations',
    label: 'Vencimentos APIs',
    description: 'Cadastrar e acompanhar vencimentos das chaves API (Futodds, Sportmonks, etc). Push avisa em 7/3/1 dia.',
    icon: <Bell className="h-4 w-4" />,
    group: 'Operação',
  },
  // Análise
  {
    to: '/admin/ab-lab',
    label: 'A/B Lab',
    description: 'Testar mudanças (provider, prompt, regra) em paralelo antes de promover ao global.',
    icon: <Search className="h-4 w-4" />,
    group: 'Análise',
  },
  {
    to: '/admin/auditoria-sinais',
    label: 'Auditoria de Entradas (Trader Live)',
    description: 'Inspeção minuto-a-minuto de cada análise ao vivo do Mycroft.',
    icon: <Search className="h-4 w-4" />,
    group: 'Análise',
  },
  {
    to: '/admin/auditoria-punter',
    label: 'Auditoria Pré-Live (Punter)',
    description: 'Entradas APROVADOS do Punter × resultado · simulação de banca virtual e drawdown.',
    icon: <Search className="h-4 w-4" />,
    group: 'Análise',
  },
  {
    to: '/admin/chat-analytics',
    label: 'Chat Analytics',
    description: 'Métricas de uso do Mycroft Chat por usuário.',
    icon: <MessageSquare className="h-4 w-4" />,
    group: 'Análise',
  },
  {
    to: '/admin/mycroft-chat-access',
    label: 'Acesso ao Chat Mycroft',
    description: 'Quem consultou o chat, quando e o veredito.',
    icon: <ListChecks className="h-4 w-4" />,
    group: 'Logs',
  },
  // Mycroft
  {
    to: '/admin/mycroft-rules',
    label: 'Mycroft Rules Engine',
    description: 'Regras dinâmicas em SHADOW + comparação com motor padrão.',
    icon: <Brain className="h-4 w-4" />,
    group: 'Mycroft',
  },
  {
    to: '/admin/clv-monitor',
    label: 'CLV Monitor (Punter)',
    description: 'CLV vs Betfair, buckets de calibração e quarentenas ativas.',
    icon: <Activity className="h-4 w-4" />,
    group: 'Mycroft',
  },
  {
    to: '/admin/trader-leagues',
    label: 'Trader Sports — Ligas',
    description: 'Gerenciar whitelist e tiers (A/B/C) das ligas analisadas pelo Trader.',
    icon: <Activity className="h-4 w-4" />,
    group: 'Operação',
  },
  {
    to: '/admin/borderline-ai',
    label: 'Camada 2 — Validador IA Borderline',
    description: 'Métricas do validador Gemini para entradas ao vivo com confiança 55-65%.',
    icon: <Activity className="h-4 w-4" />,
    group: 'Mycroft',
  },
  {
    to: '/admin/user-trader-plans',
    label: 'Planos Pessoais (Trader Sports)',
    description: 'Planos personalizados dos usuários + G/R para calibrar regras globais.',
    icon: <Activity className="h-4 w-4" />,
    group: 'Mycroft',
  },
  {
    to: '/admin/league-roi',
    label: 'ROI por Liga (Antes vs Depois)',
    description: 'Compara hit rate e ROI por liga antes/depois de uma data de corte. Valida impacto Tier A.',
    icon: <Activity className="h-4 w-4" />,
    group: 'Análise',
  },
  {
    to: '/admin/copa-mode',
    label: '🏆 Modo Copa do Mundo 2026',
    description: 'Toggle que substitui parâmetros globais por critérios específicos da Copa (AH, vetos, stakes por fase). Auto-desativa em 20/07/2026.',
    icon: <Trophy className="h-4 w-4" />,
    group: 'Mycroft',
  },
];

const groupOrder: AdminLink['group'][] = ['Usuários', 'Operação', 'Análise', 'Mycroft', 'Logs'];

const groupTone: Record<AdminLink['group'], string> = {
  Usuários: 'border-primary/30 text-primary',
  Operação: 'border-warning/30 text-warning',
  Análise: 'border-blue-500/30 text-blue-400',
  Mycroft: 'border-emerald-500/30 text-emerald-400',
  Logs: 'border-muted-foreground/30 text-muted-foreground',
};

export default function AdminHubPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (authLoading || adminLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/lobby" replace />;

  const grouped = groupOrder.map((g) => ({
    group: g,
    items: LINKS.filter((l) => l.group === g),
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight flex-1 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            HUB ADMIN — ORÁCULO MYCROFT
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Ferramentas administrativas</h2>
          <p className="font-mono text-xs text-muted-foreground">
            Tudo que era /admin/* num só lugar. Acesso restrito a administradores.
          </p>
        </div>

        {grouped.map(({ group, items }) =>
          items.length === 0 ? null : (
            <section key={group} className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 px-1">
                {group}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((link) => (
                  <motion.button
                    key={link.to}
                    onClick={() => navigate(link.to)}
                    whileHover={{ y: -2 }}
                    className="group flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-background ${groupTone[link.group]}`}
                      >
                        {link.icon}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${groupTone[link.group]}`}
                      >
                        {link.group}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">{link.label}</p>
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        {link.description}
                      </p>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors">
                      {link.to}
                    </p>
                  </motion.button>
                ))}
              </div>
            </section>
          ),
        )}

        <div className="border border-dashed border-border/50 rounded-xl p-4 text-center">
          <BookOpen className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
          <p className="font-mono text-[11px] text-muted-foreground">
            Adicionar uma nova ferramenta admin? Edite{' '}
            <code className="text-foreground">src/pages/AdminHub.tsx</code> e cadastre em{' '}
            <code className="text-foreground">LINKS</code>.
          </p>
        </div>
      </main>
    </div>
  );
}
