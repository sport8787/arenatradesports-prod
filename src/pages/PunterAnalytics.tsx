import { ArrowLeft, BarChart3, Settings, Target, Clock, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import PerformanceGap from '@/components/punter/PerformanceGap';
import MissedOpportunities from '@/components/punter/MissedOpportunities';
import PerformanceByTime from '@/components/punter/PerformanceByTime';
import HorusConfig from '@/components/punter/HorusConfig';
import ComingSoonModule from '@/components/punter/ComingSoonModule';

export default function PunterAnalytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bankroll, loading: bankrollLoading } = useBankroll();
  const { bankroll: manualBankroll, loading: manualLoading } = useManualBankroll();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/punter')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
              ANÁLISE DETALHADA
            </h1>
            <span className="text-[10px] text-muted-foreground font-mono border border-border px-1.5 py-0.5 rounded">
              ORÁCULO
            </span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-5xl">
        {/* Comparativo Hórus vs Manual */}
        {bankroll && manualBankroll && !bankrollLoading && !manualLoading && (
          <section>
            <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} label="COMPARATIVO HÓRUS vs MANUAL" />
            <PerformanceGap horus={bankroll} manual={manualBankroll} />
          </section>
        )}

        {/* Oportunidades Perdidas */}
        {user && (
          <section>
            <SectionHeader icon={<Target className="w-3.5 h-3.5" />} label="OPORTUNIDADES PERDIDAS" />
            <MissedOpportunities userId={user.id} />
          </section>
        )}

        {/* Analytics por Horário */}
        {user && (
          <section>
            <SectionHeader icon={<Clock className="w-3.5 h-3.5" />} label="PERFORMANCE POR HORÁRIO" />
            <PerformanceByTime userId={user.id} />
          </section>
        )}

        {/* Configuração Hórus */}
        {user && (
          <section>
            <SectionHeader icon={<Settings className="w-3.5 h-3.5" />} label="CONFIGURAÇÕES DO HÓRUS" />
            <HorusConfig userId={user.id} />
          </section>
        )}

        {/* Em Breve */}
        <section>
          <SectionHeader icon={<Sparkles className="w-3.5 h-3.5" />} label="EM BREVE" />
          <div className="grid md:grid-cols-2 gap-4">
            <ComingSoonModule
              title="Market Manipulation Detector"
              description="Detecta quando o mercado está precificando errado e identifica oportunidades escondidas."
              features={[
                'Market Inefficiency Score (MIS)',
                'Odds Drift Detection',
                'Value hidden detection',
              ]}
            />
            <ComingSoonModule
              title="Sharp Money Detector"
              description="Identifica movimentos de dinheiro inteligente e reverse line movements."
              features={[
                'Reverse Line Movement (RLM)',
                'Steam Move Detection',
                'Sharp Activity Score 0-100',
              ]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <span className="font-mono text-[10px] font-semibold text-muted-foreground tracking-widest">{label}</span>
    </div>
  );
}
