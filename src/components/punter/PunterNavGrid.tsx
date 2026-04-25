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
  Search,
  ExternalLink,
} from 'lucide-react';
import { useHorusPunterAudio } from '@/hooks/useHorusPunterAudio';
import HorusAudioFallback from '@/components/punter/HorusAudioFallback';
import NavCard from '@/components/punter/NavCard';

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
  const { playOnce, pendingAudio, playPending, dismissPending } = useHorusPunterAudio();

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
      {/* Buscar Sinais — atalho direto para análise */}
      <section>
        <SectionLabel>Buscar Sinais</SectionLabel>
        <div className="grid grid-cols-1 gap-3">
          <NavCard
            primary
            onClick={() => navigate('/punter')}
            icon={<Search className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Buscar Sinais Agora"
            description="Acessa a Arena Punter e dispara a análise do Mycroft"
          />
        </div>
      </section>

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

      {/* Casas de Apostas */}
      <section>
        <SectionLabel>Casas de Apostas</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            onClick={() => window.open('https://www.pinnacle.com', '_blank', 'noopener,noreferrer')}
            icon={<ExternalLink className="w-4 h-4" />}
            iconBg="bg-warning/15"
            iconColor="text-warning"
            title="Pinnacle"
            description="Casa referência em odds altas e sharp money"
          />
          <NavCard
            onClick={() => window.open('https://www.betfair.com', '_blank', 'noopener,noreferrer')}
            icon={<ExternalLink className="w-4 h-4" />}
            iconBg="bg-[#FFB80C]/15"
            iconColor="text-[#FFB80C]"
            title="Betfair"
            description="Exchange e Sportsbook — abrir site oficial"
          />
          <NavCard
            onClick={() => window.open('https://www.bet365.com', '_blank', 'noopener,noreferrer')}
            icon={<ExternalLink className="w-4 h-4" />}
            iconBg="bg-success/15"
            iconColor="text-success"
            title="Bet365"
            description="Acesso direto ao site oficial da Bet365"
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

      <HorusAudioFallback
        visible={pendingAudio?.chave === 'sinais_aprovados'}
        label="Ouvir mensagem dos Sinais Aprovados"
        onPlay={playPending}
        onDismiss={dismissPending}
      />
    </div>
  );
}
