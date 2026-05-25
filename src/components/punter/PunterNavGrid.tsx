import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  MessagesSquare,
  Info,
  Search,
  ShieldCheck,
  Activity,
  Send,
  Coins,
  Newspaper,
} from 'lucide-react';
import { useHorusPunterAudio } from '@/hooks/useHorusPunterAudio';
import HorusAudioFallback from '@/components/punter/HorusAudioFallback';
import NavCard from '@/components/punter/NavCard';
import { useSubscription, type ArenaKey } from '@/hooks/useSubscription';

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 mb-3 px-1">
    {children}
  </p>
);

interface Props {
  onApprovedSignalsClick?: () => void;
}

export default function PunterNavGrid({ onApprovedSignalsClick }: Props) {
  const navigate = useNavigate();
  const { pendingAudio, playPending, dismissPending } = useHorusPunterAudio();
  const { hasArena, subscription, loading: subLoading } = useSubscription();

  // Helper: gera onClick que respeita o gate de arena.
  // Se subscription ainda carregando → segue para a rota (RequireArena trata).
  // Se não tem acesso → manda para /paywall.
  const arenaNav = (arena: ArenaKey, route: string) => () => {
    if (subLoading) {
      navigate(route);
      return;
    }
    if (!hasArena(arena)) {
      navigate('/paywall');
      return;
    }
    navigate(route);
  };

  const planLabel = (subscription?.plan || 'trial').toUpperCase();
  const upgradeLabel = (arena: ArenaKey) =>
    subLoading ? undefined : (hasArena(arena) ? undefined : `Upgrade · plano ${planLabel}`);

  return (
    <div className="space-y-6">
      {/* Arenas e Ferramentas Principais */}
      <section>
        <SectionLabel>Arenas e Ferramentas</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            primary
            onClick={arenaNav('arena_punter', '/punter')}
            icon={<Search className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Arena Punter"
            description="Sinais pré-jogo do Mycroft com edge real"
            locked={!hasArena('arena_punter')}
            lockedLabel={upgradeLabel('arena_punter')}
          />
          <NavCard
            primary
            onClick={arenaNav('arena_live', '/arena-trader-sports')}
            icon={<Activity className="w-4 h-4" />}
            iconBg="bg-destructive/15"
            iconColor="text-destructive"
            title="Arena Live"
            description="Análise ao vivo pelo Mycroft em tempo real"
            badge={{ label: 'Ao vivo', tone: 'live' }}
            locked={!hasArena('arena_live')}
            lockedLabel={upgradeLabel('arena_live')}
          />
          <NavCard
            onClick={arenaNav('multiplas', '/punter/multiplas')}
            icon={<MessagesSquare className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Gerador de Múltipla"
            description="Múltiplas otimizadas por IA e Kelly"
            badge={{ label: 'Beta', tone: 'beta' }}
            locked={!hasArena('multiplas')}
            lockedLabel={upgradeLabel('multiplas')}
          />
        </div>
      </section>

      {/* Bancas e Suporte */}
      <section>
        <SectionLabel>Bancas e Suporte</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            onClick={arenaNav('banca_virtual', '/punter/banca-virtual')}
            icon={<Wallet className="w-4 h-4" />}
            iconBg="bg-warning/15"
            iconColor="text-warning"
            title="Banca Virtual"
            description="Defina seu capital e gestão de risco"
            locked={!hasArena('banca_virtual')}
            lockedLabel={upgradeLabel('banca_virtual')}
          />
          <NavCard
            onClick={arenaNav('banca_real', '/punter/betfair-real')}
            icon={<ShieldCheck className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Banca Real"
            description="Apostas reais Betfair sincronizadas"
            badge={{ label: 'Novo', tone: 'exclusive' }}
            locked={!hasArena('banca_real')}
            lockedLabel={upgradeLabel('banca_real')}
          />
          <NavCard
            onClick={() => navigate('/loja-bc')}
            icon={<Coins className="w-4 h-4" />}
            iconBg="bg-yellow-500/15"
            iconColor="text-yellow-400"
            title="Liga Mycroft"
            description="Ranking por ROI · Prêmios reais · Troféu da temporada"
            badge={{ label: 'Novo', tone: 'exclusive' }}
          />
        </div>
      </section>

      {/* Conteúdo */}
      <section>
        <SectionLabel>Conteúdo</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            onClick={() => window.open('/blog/', '_blank', 'noopener,noreferrer')}
            icon={<Newspaper className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Blog Mycroft"
            description="Análises de rodada, notícias e dedução fria"
          />
        </div>
      </section>

      {/* Suporte */}
      <section>
        <SectionLabel>Suporte</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      {/* Comunidade */}
      <section>
        <SectionLabel>Comunidade</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            onClick={() => navigate('/punter/comunidade')}
            icon={<Send className="w-4 h-4" />}
            iconBg="bg-[#229ED9]/15"
            iconColor="text-[#229ED9]"
            title="Grupo VIP Telegram Pré Live"
            description="Sinais pré-jogo e alertas em tempo real"
          />
          <NavCard
            onClick={() =>
              window.open('https://t.me/oraculo_mycroft_trader', '_blank', 'noopener,noreferrer')
            }
            icon={<Send className="w-4 h-4" />}
            iconBg="bg-destructive/15"
            iconColor="text-destructive"
            title="Grupo VIP Telegram AO VIVO"
            description="Sinais ao vivo do Oráculo Mycroft Trader"
            badge={{ label: 'Ao vivo', tone: 'live' }}
          />
          <NavCard
            onClick={() => navigate('/punter/comunidade')}
            icon={<MessagesSquare className="w-4 h-4" />}
            iconBg="bg-[#25D366]/15"
            iconColor="text-[#25D366]"
            title="Grupo Whatsapp Fundadores"
            description="Acesso direto e voz no produto"
            badge={{ label: 'Exclusivo', tone: 'exclusive' }}
          />
        </div>
      </section>

      <HorusAudioFallback
        visible={pendingAudio?.chave === 'sinais_aprovados'}
        label="Ouvir mensagem das Entradas Aprovadas"
        onPlay={playPending}
        onDismiss={dismissPending}
      />
    </div>
  );
}
