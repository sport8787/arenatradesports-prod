import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  LayoutGrid,
  Wallet,
  LineChart,
  Download,
  MessageCircle,
  MessagesSquare,
  Info,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHorusPunterAudio } from '@/hooks/useHorusPunterAudio';
import HorusAudioFallback from '@/components/punter/HorusAudioFallback';

type Badge = { label: string; tone: 'live' | 'beta' | 'exclusive' };

interface NavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge?: Badge;
  primary?: boolean;
  onClick: () => void;
}

const badgeTone: Record<Badge['tone'], string> = {
  live: 'bg-destructive/15 text-destructive border border-destructive/30 animate-pulse',
  beta: 'bg-warning/15 text-warning border border-warning/30',
  exclusive: 'bg-primary/15 text-primary border border-primary/30',
};

const NavCard = ({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  badge,
  primary,
  onClick,
}: NavCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all',
      'hover:bg-card/80 hover:-translate-y-0.5',
      primary
        ? 'border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)] hover:border-primary/70 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.45)]'
        : 'border-border/60 hover:border-border',
    )}
  >
    <div
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md',
        iconBg,
      )}
    >
      <span className={cn('flex', iconColor)}>{icon}</span>
    </div>
    <div className="space-y-1">
      <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
      <p className="text-[12px] text-muted-foreground leading-snug">
        {description}
      </p>
    </div>
    {badge && (
      <span
        className={cn(
          'self-start rounded-md px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider',
          badgeTone[badge.tone],
        )}
      >
        {badge.label}
      </span>
    )}
  </button>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
    {children}
  </p>
);

interface Props {
  onApprovedSignalsClick?: () => void;
}

export default function PunterNavGrid({ onApprovedSignalsClick }: Props) {
  const navigate = useNavigate();
  const { playOnce } = useHorusPunterAudio();

  const goApproved = () => {
    // Toca o áudio "Sinais Aprovados" UMA ÚNICA VEZ por usuário
    playOnce('sinais_aprovados');
    if (onApprovedSignalsClick) {
      onApprovedSignalsClick();
      return;
    }
    navigate('/punter');
  };

  return (
    <div className="space-y-5">
      {/* Ações Principais */}
      <section>
        <SectionLabel>Ações Principais</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            primary
            onClick={goApproved}
            icon={<CheckCircle2 className="w-4 h-4" />}
            iconBg="bg-success/15"
            iconColor="text-success"
            title="Sinais Aprovados"
            description="Todos os sinais ativos com análise completa"
          />
          <NavCard
            onClick={() => navigate('/arena-trader-sports')}
            icon={<Clock className="w-4 h-4" />}
            iconBg="bg-destructive/15"
            iconColor="text-destructive"
            title="Arena Trader Sports"
            description="Análise ao vivo pelo Mycroft"
            badge={{ label: 'Ao vivo', tone: 'live' }}
          />
          <NavCard
            onClick={() => navigate('/punter/multiplas')}
            icon={<LayoutGrid className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Gerador de Múltipla"
            description="Múltiplas otimizadas por IA e Kelly"
            badge={{ label: 'Beta', tone: 'beta' }}
          />
        </div>
      </section>

      {/* Minha Banca */}
      <section>
        <SectionLabel>Minha Banca</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            onClick={() => navigate('/punter/banca-virtual')}
            icon={<Wallet className="w-4 h-4" />}
            iconBg="bg-warning/15"
            iconColor="text-warning"
            title="Configurar Banca Virtual"
            description="Defina seu capital e gestão de risco"
          />
          <NavCard
            onClick={() => navigate('/punter/analytics')}
            icon={<LineChart className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Meu Desempenho"
            description="ROI, P&L e histórico completo"
          />
          <NavCard
            onClick={() => navigate('/punter/import')}
            icon={<Download className="w-4 h-4" />}
            iconBg="bg-muted/40"
            iconColor="text-foreground"
            title="Importar Apostas"
            description="Importar ROI e P&L de outras casas"
          />
          <NavCard
            onClick={() => navigate('/punter/betfair-real')}
            icon={<Brain className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Apostas Reais Betfair"
            description="Sincronize e analise erros vs Arena Trader Sports"
            badge={{ label: 'Novo', tone: 'exclusive' }}
          />
        </div>
      </section>

      {/* Comunidade e Suporte */}
      <section>
        <SectionLabel>Comunidade e Suporte</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            onClick={() => navigate('/punter/comunidade')}
            icon={<MessageCircle className="w-4 h-4" />}
            iconBg="bg-[#229ED9]/15"
            iconColor="text-[#229ED9]"
            title="Grupo VIP Telegram"
            description="Sinais e alertas em tempo real"
          />
          <NavCard
            onClick={() => navigate('/punter/comunidade')}
            icon={<MessagesSquare className="w-4 h-4" />}
            iconBg="bg-[#25D366]/15"
            iconColor="text-[#25D366]"
            title="Grupo Fundadores"
            description="Acesso direto e voz no produto"
            badge={{ label: 'Exclusivo', tone: 'exclusive' }}
          />
          <NavCard
            onClick={() => navigate('/punter/comunidade')}
            icon={<Info className="w-4 h-4" />}
            iconBg="bg-muted/40"
            iconColor="text-foreground"
            title="Suporte e Tutorial"
            description="Dúvidas, bugs e como usar"
          />
        </div>
      </section>
    </div>
  );
}
