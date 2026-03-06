import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Wallet, TrendingUp, TrendingDown, Target, Settings, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Bankroll } from '@/hooks/useBankroll';
import type { ManualBankroll } from '@/hooks/useManualBankroll';
import BankrollSettingsDialog from '@/components/arena-trader/BankrollSettingsDialog';

interface DualBankrollDashboardProps {
  horus: Bankroll;
  manual: ManualBankroll;
  pendingBets?: any[];
  onUpdateHorusBalance?: (v: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateManualBalance?: (v: number) => Promise<{ success: boolean; error?: string }>;
}

export default function DualBankrollDashboard({ horus, manual, pendingBets = [], onUpdateHorusBalance, onUpdateManualBalance }: DualBankrollDashboardProps) {
  const [settingsTarget, setSettingsTarget] = useState<'horus' | 'manual' | null>(null);

  // Exposure = sum of stakes from pending (open) bets only
  const pendingExposure = pendingBets.reduce((sum, b) => sum + (b.stake || 0), 0);

  // Total equity = current cash balance + money in play (pending bets)
  const totalEquity = (horus.balance || 0) + (manual.balance || 0) + pendingExposure;
  const totalInitial = (horus.initial_balance || 0) + (manual.initial_balance || 0);
  const totalPL = totalEquity - totalInitial;
  const totalROI = totalInitial > 0 ? ((totalPL / totalInitial) * 100) : 0;

  const horusRoi = horus.initial_balance > 0
    ? (((horus.balance || 0) - horus.initial_balance) / horus.initial_balance * 100)
    : 0;

  const manualRoi = manual.initial_balance > 0
    ? (((manual.balance || 0) - manual.initial_balance) / manual.initial_balance * 100)
    : 0;

  const performanceGap = horusRoi - manualRoi;

  return (
    <div className="space-y-3">
      {/* Top Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="PATRIMÔNIO TOTAL"
          value={`R$ ${totalEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sub={`${totalROI >= 0 ? '+' : ''}${totalROI.toFixed(2)}%`}
          subColor={totalROI >= 0 ? 'text-success' : 'text-destructive'}
          icon={<Wallet className="w-4 h-4" />}
          highlight
        />
        <MetricCard
          label="P&L TOTAL"
          value={`${totalPL >= 0 ? '+' : ''}R$ ${totalPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sub={`${(horus.total_bets || 0) + (manual.total_bets || 0)} operações`}
          subColor={totalPL >= 0 ? 'text-success' : 'text-destructive'}
          icon={totalPL >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        />
        <MetricCard
          label="WIN RATE"
          value={`${horus.total_bets ? ((horus.green_bets || 0) / horus.total_bets * 100).toFixed(0) : 0}%`}
          sub={`${horus.green_bets || 0}G / ${horus.red_bets || 0}R`}
          icon={<Target className="w-4 h-4" />}
        />
        <MetricCard
          label="EXPOSIÇÃO"
          value={`R$ ${pendingExposure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sub={`${pendingBets.length} apostas em aberto`}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* Dual Bankroll Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BankrollCard
          label="HÓRUS IA"
          icon={<Bot className="w-4 h-4 text-primary" />}
          balance={horus.balance || 0}
          initial={horus.initial_balance || 0}
          roi={horusRoi}
          profit={(horus.balance || 0) - (horus.initial_balance || 0)}
          totalBets={horus.total_bets || 0}
          wins={horus.green_bets || 0}
          losses={horus.red_bets || 0}
          accentColor="primary"
          onSettings={onUpdateHorusBalance ? () => setSettingsTarget('horus') : undefined}
        />
        <BankrollCard
          label="MINHA BANCA"
          icon={<User className="w-4 h-4 text-accent" />}
          balance={manual.balance || 0}
          initial={manual.initial_balance || 0}
          roi={manualRoi}
          profit={(manual.balance || 0) - (manual.initial_balance || 0)}
          totalBets={manual.total_bets || 0}
          wins={manual.green_bets || 0}
          losses={manual.red_bets || 0}
          accentColor="accent"
          onSettings={onUpdateManualBalance ? () => setSettingsTarget('manual') : undefined}
        />
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

function MetricCard({ label, value, sub, subColor, icon, highlight }: {
  label: string; value: string; sub: string; subColor?: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg p-3 border",
      highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
    )}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground tracking-wider">{label}</span>
        <span className={cn("text-muted-foreground", highlight && "text-primary")}>{icon}</span>
      </div>
      <p className={cn("font-mono font-bold text-foreground", highlight ? "text-lg" : "text-sm")}>{value}</p>
      <p className={cn("text-[10px] font-mono mt-0.5", subColor || 'text-muted-foreground')}>{sub}</p>
    </div>
  );
}

function BankrollCard({ label, icon, balance, initial, roi, profit, totalBets, wins, losses, accentColor, onSettings }: {
  label: string;
  icon: React.ReactNode;
  balance: number;
  initial: number;
  roi: number;
  profit: number;
  totalBets: number;
  wins: number;
  losses: number;
  accentColor: 'primary' | 'accent';
  onSettings?: () => void;
}) {
  const isPositive = profit >= 0;
  const borderClass = accentColor === 'primary' ? 'border-primary/20' : 'border-accent/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("border rounded-lg p-4 bg-card relative", borderClass)}
    >
      {onSettings && (
        <button
          onClick={onSettings}
          className="absolute top-3 right-3 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="font-mono text-xs font-semibold text-foreground tracking-wider">{label}</span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="font-mono text-xl font-bold text-foreground">
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-xs font-mono font-semibold", isPositive ? 'text-success' : 'text-destructive')}>
              {isPositive ? '+' : ''}{roi.toFixed(2)}% ROI
            </span>
            <span className={cn("text-xs font-mono", isPositive ? 'text-success' : 'text-destructive')}>
              ({isPositive ? '+' : ''}R$ {profit.toFixed(2)})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div>
            <p className="text-[9px] font-mono text-muted-foreground">OPERAÇÕES</p>
            <p className="text-xs font-mono font-bold text-foreground">{totalBets}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-muted-foreground">GREEN</p>
            <p className="text-xs font-mono font-bold text-success">{wins}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-muted-foreground">RED</p>
            <p className="text-xs font-mono font-bold text-destructive">{losses}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
