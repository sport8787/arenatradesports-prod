import { ArrowLeft, BarChart3, Settings, Target, Clock, TrendingUp, Sparkles, Zap, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import PerformanceGap from '@/components/punter/PerformanceGap';
import MissedOpportunities from '@/components/punter/MissedOpportunities';
import PerformanceByTime from '@/components/punter/PerformanceByTime';
import MarketDetectorsPanel from '@/components/punter/MarketDetectorsPanel';

export default function PunterAnalytics() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { bankroll, loading: bankrollLoading } = useBankroll();
  const { bankroll: manualBankroll, loading: manualLoading } = useManualBankroll();

  const username = profile?.username || 'MANUAL';

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
        {/* Market Manipulation Detector */}
        <section>
          <SectionHeader icon={<AlertTriangle className="w-3.5 h-3.5" />} label="MARKET MANIPULATION DETECTOR" />
          <MarketDetectorsPanel />
        </section>

        {/* Comparativo Hórus vs Username */}
        {bankroll && manualBankroll && !bankrollLoading && !manualLoading && (
          <section>
            <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} label={`COMPARATIVO HÓRUS vs ${username.toUpperCase()}`} />
            <PerformanceGap horus={bankroll} manual={manualBankroll} username={username} />
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
      </div>
    </div>
  );

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <span className="font-mono text-[10px] font-semibold text-muted-foreground tracking-widest">{label}</span>
    </div>
  );
}
