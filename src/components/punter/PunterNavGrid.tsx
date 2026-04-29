import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  MessagesSquare,
  Info,
  Search,
  ShieldCheck,
  Activity,
  Send,
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
  const { pendingAudio, playPending, dismissPending } = useHorusPunterAudio();

  return (
    <div className="space-y-6">
      {/* Arenas e Ferramentas Principais */}
      <section>
        <SectionLabel>Arenas e Ferramentas</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            primary
            onClick={() => navigate('/punter')}
            icon={<Search className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Arena Punter"
            description="Sinais pré-jogo do Mycroft com edge real"
          />
          <NavCard
            primary
            onClick={() => navigate('/arena-trader-sports')}
            icon={<Activity className="w-4 h-4" />}
            iconBg="bg-destructive/15"
            iconColor="text-destructive"
            title="Arena Live"
            description="Análise ao vivo pelo Mycroft em tempo real"
            badge={{ label: 'Ao vivo', tone: 'live' }}
          />
          <NavCard
            onClick={() => navigate('/punter/multiplas')}
            icon={<MessagesSquare className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Gerador de Múltipla"
            description="Múltiplas otimizadas por IA e Kelly"
            badge={{ label: 'Beta', tone: 'beta' }}
          />
        </div>
      </section>

      {/* Bancas e Suporte */}
      <section>
        <SectionLabel>Bancas e Suporte</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NavCard
            onClick={() => navigate('/punter/banca-virtual')}
            icon={<Wallet className="w-4 h-4" />}
            iconBg="bg-warning/15"
            iconColor="text-warning"
            title="Banca Virtual"
            description="Defina seu capital e gestão de risco"
          />
          <NavCard
            onClick={() => navigate('/punter/betfair-real')}
            icon={<ShieldCheck className="w-4 h-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            title="Banca Real"
            description="Apostas reais Betfair sincronizadas"
            badge={{ label: 'Novo', tone: 'exclusive' }}
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
        label="Ouvir mensagem dos Sinais Aprovados"
        onPlay={playPending}
        onDismiss={dismissPending}
      />
    </div>
  );
}
