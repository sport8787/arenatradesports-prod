import { ArrowLeft, BarChart3, Target, Clock, TrendingUp, AlertTriangle, Brain, Search, Calculator, Layers, Award, Shield, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import PerformanceGap from '@/components/punter/PerformanceGap';
import MissedOpportunities from '@/components/punter/MissedOpportunities';
import PerformanceByTime from '@/components/punter/PerformanceByTime';
import MarketDetectorsPanel from '@/components/punter/MarketDetectorsPanel';
import CLVPanel from '@/components/punter/CLVPanel';
import PortfolioPanel from '@/components/punter/PortfolioPanel';
import SelfLearningPanel from '@/components/punter/SelfLearningPanel';
import SmartOddsScannerPanel from '@/components/punter/SmartOddsScannerPanel';
import BankrollAiPanel from '@/components/punter/BankrollAiPanel';
import PatternMiningPanel from '@/components/punter/PatternMiningPanel';
import AssetScorePanel from '@/components/punter/AssetScorePanel';
import PoissonPanel from '@/components/punter/PoissonPanel';
import EnsemblePanel from '@/components/punter/EnsemblePanel';
import AntiLimitingPanel from '@/components/punter/AntiLimitingPanel';

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
        {/* Poisson/Dixon-Coles */}
        <section>
          <SectionHeader icon={<Calculator className="w-3.5 h-3.5" />} label="MODELO POISSON / DIXON-COLES" />
          <PoissonPanel />
        </section>

        {/* Ensemble Models */}
        <section>
          <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label="ENSEMBLE MODELS (POISSON + xG + ELO + MARKET)" />
          <EnsemblePanel />
        </section>

        {/* Anti-Limiting Engine */}
        <section>
          <SectionHeader icon={<ShieldAlert className="w-3.5 h-3.5" />} label="ANTI-LIMITING ENGINE" />
          <AntiLimitingPanel />
        </section>

        {/* Betting Asset Score */}
        <section>
          <SectionHeader icon={<Award className="w-3.5 h-3.5" />} label="BETTING ASSET SCORE" />
          <AssetScorePanel />
        </section>

        {/* CLV Engine */}
        <section>
          <SectionHeader icon={<Target className="w-3.5 h-3.5" />} label="CLOSING LINE VALUE ENGINE" />
          <CLVPanel />
        </section>

        {/* Bankroll AI Kelly */}
        <section>
          <SectionHeader icon={<Calculator className="w-3.5 h-3.5" />} label="BANKROLL AI — KELLY CRITERION" />
          <BankrollAiPanel />
        </section>

        {/* Pattern Mining */}
        <section>
          <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label="PATTERN MINING ENGINE" />
          <PatternMiningPanel />
        </section>

        {/* Portfolio Optimization */}
        <section>
          <SectionHeader icon={<Shield className="w-3.5 h-3.5" />} label="PORTFOLIO OPTIMIZER" />
          <PortfolioPanel />
        </section>

        {/* Self Learning Engine */}
        <section>
          <SectionHeader icon={<Brain className="w-3.5 h-3.5" />} label="SELF LEARNING ENGINE" />
          <SelfLearningPanel />
        </section>

        {/* Smart Odds Scanner */}
        <section>
          <SectionHeader icon={<Search className="w-3.5 h-3.5" />} label="SMART ODDS SCANNER" />
          <SmartOddsScannerPanel />
        </section>

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
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <span className="font-mono text-[10px] font-semibold text-muted-foreground tracking-widest">{label}</span>
    </div>
  );
}
