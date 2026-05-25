import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, User, Wallet, TrendingUp, Target, Settings, AlertCircle, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Bankroll } from '@/hooks/useBankroll';
import type { ManualBankroll } from '@/hooks/useManualBankroll';
import BankrollSettingsDialog from '@/components/arena-trader/BankrollSettingsDialog';

interface DualBankrollDashboardProps {
  horus: Bankroll;
  manual: ManualBankroll;
  horusPendingBets?: any[];
  manualPendingBets?: any[];
  onUpdateHorusBalance?: (v: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateManualBalance?: (v: number) => Promise<{ success: boolean; error?: string }>;
}

export default function DualBankrollDashboard({ horus, manual, horusPendingBets = [], manualPendingBets = [], onUpdateHorusBalance, onUpdateManualBalance }: DualBankrollDashboardProps) {
  const navigate = useNavigate();
  const [settingsTarget, setSettingsTarget] = useState<'horus' | 'manual' | null>(null);

  const horusExposure = horusPendingBets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
  const manualExposure = manualPendingBets.reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);

  const horusEquity = (horus.balance || 0) + horusExposure;
  const manualEquity = (manual.balance || 0) + manualExposure;

  const horusPL = horusEquity - (horus.initial_balance || 0);
  const manualPL = manualEquity - (manual.initial_balance || 0);

  // Retorno da Banca = (equity - initial) / initial (capital growth)
  const horusBankReturn = horus.initial_balance > 0 ? (horusPL / horus.initial_balance * 100) : 0;
  const manualBankReturn = manual.initial_balance > 0 ? (manualPL / manual.initial_balance * 100) : 0;

  // ROI sobre Entradas = lucro / total apostado (betting efficiency)
  const horusROI = horus.total_staked > 0 ? ((horus.total_profit || 0) / horus.total_staked * 100) : 0;
  const manualROI = manual.total_staked > 0 ? ((manual.total_profit || 0) / (manual.total_staked || 1) * 100) : 0;

  const horusSettled = (horus.green_bets || 0) + (horus.red_bets || 0);
  const manualSettled = (manual.green_bets || 0) + (manual.red_bets || 0);
  const horusWinRate = horusSettled > 0 ? ((horus.green_bets || 0) / horusSettled * 100) : 0;
  const manualWinRate = manualSettled > 0 ? ((manual.green_bets || 0) / manualSettled * 100) : 0;

  const performanceGap = horusBankReturn - manualBankReturn;

  return (
    <div className="space-y-3">
      {/* HÓRUS IA Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-primary tracking-wider">HÓRUS IA</span>
          <button onClick={() => navigate('/punter/config')} className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors border border-border px-2 py-0.5 rounded">
            Configurar Hórus
          </button>
          {onUpdateHorusBalance && (
            <button onClick={() => setSettingsTarget('horus')} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="PATRIMÔNIO HÓRUS"
            value={`R$ ${horusEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            sub={`${horusBankReturn >= 0 ? '+' : ''}${horusBankReturn.toFixed(2)}% retorno da banca`}
            subColor={horusBankReturn >= 0 ? 'text-success' : 'text-destructive'}
            icon={<Wallet className="w-4 h-4" />}
            highlight
          />
          <MetricCard
            label="P&L HÓRUS"
            value={`${horusPL >= 0 ? '+' : ''}R$ ${horusPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            sub={`ROI s/ entradas: ${horusROI >= 0 ? '+' : ''}${horusROI.toFixed(1)}%`}
            subColor={horusPL >= 0 ? 'text-success' : 'text-destructive'}
            icon={horusPL >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            tooltip="ROI s/ Entradas = Lucro ÷ Total Apostado (eficiência). Retorno da Banca = (Patrimônio - Capital Inicial) ÷ Capital Inicial (crescimento)."
          />
          <MetricCard
            label="WIN RATE HÓRUS"
            value={`${horusWinRate.toFixed(1)}%`}
            sub={`${horus.green_bets || 0}G / ${horus.red_bets || 0}R (${horusSettled} liquidadas)`}
            subColor={horusWinRate >= 55 ? 'text-success' : horusWinRate >= 45 ? 'text-warning' : 'text-destructive'}
            icon={<Target className="w-4 h-4" />}
            tooltip="Win Rate = Greens ÷ (Greens + Reds). Entradas pendentes não são contabilizadas."
          />
          <MetricCard
            label="EXPOSIÇÃO HÓRUS"
            value={`R$ ${horusExposure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            sub={`${horusPendingBets.length} posições em aberto`}
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* MINHA BANCA Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-accent" />
          <span className="font-mono text-xs font-semibold text-accent tracking-wider">MINHA BANCA</span>
          {onUpdateManualBalance && (
            <button onClick={() => setSettingsTarget('manual')} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="MEU PATRIMÔNIO"
            value={`R$ ${manualEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            sub={`${manualBankReturn >= 0 ? '+' : ''}${manualBankReturn.toFixed(2)}% retorno da banca`}
            subColor={manualBankReturn >= 0 ? 'text-success' : 'text-destructive'}
            icon={<Wallet className="w-4 h-4" />}
            accentColor="accent"
          />
          <MetricCard
            label="MEU P&L"
            value={`${manualPL >= 0 ? '+' : ''}R$ ${manualPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            sub={`ROI s/ entradas: ${manualROI >= 0 ? '+' : ''}${manualROI.toFixed(1)}%`}
            subColor={manualPL >= 0 ? 'text-success' : 'text-destructive'}
            icon={manualPL >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            tooltip="ROI s/ Entradas = Lucro ÷ Total Apostado (eficiência). Retorno da Banca = (Patrimônio - Capital Inicial) ÷ Capital Inicial (crescimento)."
          />
          <MetricCard
            label="MEU WIN RATE"
            value={`${manualWinRate.toFixed(1)}%`}
            sub={`${manual.green_bets || 0}G / ${manual.red_bets || 0}R (${manualSettled} liquidadas)`}
            subColor={manualWinRate >= 55 ? 'text-success' : manualWinRate >= 45 ? 'text-warning' : 'text-destructive'}
            icon={<Target className="w-4 h-4" />}
            tooltip="Win Rate = Greens ÷ (Greens + Reds). Entradas pendentes não são contabilizadas."
          />
          <MetricCard
            label="MINHA EXPOSIÇÃO"
            value={`R$ ${manualExposure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            sub={`${manualPendingBets.length} posições em aberto`}
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Performance Gap */}
      {manual.total_bets > 0 && horus.total_bets > 0 && Math.abs(performanceGap) > 5 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "border rounded-lg p-3 flex items-center gap-2 text-xs font-mono",
            performanceGap > 0
              ? 'border-warning/20 bg-warning/5'
              : 'border-success/20 bg-success/5'
          )}
        >
          <AlertCircle className={cn("w-3.5 h-3.5 shrink-0", performanceGap > 0 ? 'text-warning' : 'text-success')} />
          <span className="text-foreground/80">
            {performanceGap > 0
              ? `Hórus IA está +${performanceGap.toFixed(1)}pp acima no ROI`
              : `Você está superando Hórus IA em ${Math.abs(performanceGap).toFixed(1)}pp`}
          </span>
        </motion.div>
      )}

      {/* Settings Dialogs */}
      {settingsTarget === 'horus' && onUpdateHorusBalance && (
        <BankrollSettingsDialog isOpen={true} onClose={() => setSettingsTarget(null)} currentBalance={horus.initial_balance} onSave={onUpdateHorusBalance} />
      )}
      {settingsTarget === 'manual' && onUpdateManualBalance && (
        <BankrollSettingsDialog isOpen={true} onClose={() => setSettingsTarget(null)} currentBalance={manual.initial_balance} onSave={onUpdateManualBalance} />
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, subColor, icon, highlight, accentColor, tooltip }: {
  label: string; value: string; sub: string; subColor?: string; icon: React.ReactNode; highlight?: boolean; accentColor?: 'primary' | 'accent'; tooltip?: string;
}) {
  const accent = accentColor || 'primary';
  const isHighlight = highlight || accentColor;
  return (
    <div className={cn(
      "rounded-lg p-3 border",
      isHighlight
        ? accent === 'accent' ? 'border-accent/30 bg-accent/5' : 'border-primary/30 bg-primary/5'
        : 'border-border bg-card'
    )}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground tracking-wider">{label}</span>
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs">
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className={cn("text-muted-foreground", isHighlight && (accent === 'accent' ? "text-accent" : "text-primary"))}>{icon}</span>
      </div>
      <p className={cn("font-mono font-bold text-foreground", isHighlight ? "text-lg" : "text-sm")}>{value}</p>
      <p className={cn("text-[10px] font-mono mt-0.5", subColor || 'text-muted-foreground')}>{sub}</p>
    </div>
  );
}
