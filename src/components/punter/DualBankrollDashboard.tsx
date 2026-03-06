import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Wallet, TrendingUp, TrendingDown, Target, Zap, Settings, AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Bankroll } from '@/hooks/useBankroll';
import type { ManualBankroll } from '@/hooks/useManualBankroll';
import BankrollSettingsDialog from '@/components/arena-trader/BankrollSettingsDialog';

interface DualBankrollDashboardProps {
  horus: Bankroll;
  manual: ManualBankroll;
  onUpdateHorusBalance?: (v: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateManualBalance?: (v: number) => Promise<{ success: boolean; error?: string }>;
}

export default function DualBankrollDashboard({ horus, manual, onUpdateHorusBalance, onUpdateManualBalance }: DualBankrollDashboardProps) {
  const [settingsTarget, setSettingsTarget] = useState<'horus' | 'manual' | null>(null);

  const totalBalance = (horus.balance || 0) + (manual.balance || 0);

  const horusRoi = horus.initial_balance > 0
    ? (((horus.balance || 0) - horus.initial_balance) / horus.initial_balance * 100)
    : 0;

  const manualRoi = manual.initial_balance > 0
    ? (((manual.balance || 0) - manual.initial_balance) / manual.initial_balance * 100)
    : 0;

  const performanceGap = horusRoi - manualRoi;

  return (
    <div className="space-y-3">
      {/* Total Capital */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital Total</p>
            <p className="text-2xl font-orbitron font-bold text-foreground">
              R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <Wallet className="w-8 h-8 text-primary/50" />
        </div>
      </motion.div>

      {/* Dual Bankroll Tabs */}
      <Tabs defaultValue="horus" className="w-full">
        <TabsList className="bg-secondary/50 w-full">
          <TabsTrigger value="horus" className="flex-1 gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            Bankroll Hórus
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex-1 gap-1.5">
            <User className="w-3.5 h-3.5" />
            Bankroll Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="horus">
          <BankrollCard
            label="Bankroll Hórus"
            sublabel="IA Automática"
            icon={<Bot className="w-5 h-5 text-primary" />}
            balance={horus.balance || 0}
            roi={horusRoi}
            profit={horus.total_profit || 0}
            totalBets={horus.total_bets || 0}
            wins={horus.green_bets || 0}
            losses={horus.red_bets || 0}
            winRate={horus.win_rate || 0}
            nextStake={Math.round((horus.balance || 0) * 0.05 * 100) / 100}
            accentClass="border-primary/30"
            onSettings={onUpdateHorusBalance ? () => setSettingsTarget('horus') : undefined}
          />
        </TabsContent>

        <TabsContent value="manual">
          <BankrollCard
            label="Bankroll Manual"
            sublabel="Suas Decisões"
            icon={<User className="w-5 h-5 text-accent" />}
            balance={manual.balance || 0}
            roi={manualRoi}
            profit={manual.total_profit || 0}
            totalBets={manual.total_bets || 0}
            wins={manual.green_bets || 0}
            losses={manual.red_bets || 0}
            winRate={manual.win_rate || 0}
            nextStake={Math.round((manual.balance || 0) * 0.05 * 100) / 100}
            accentClass="border-accent/30"
            onSettings={onUpdateManualBalance ? () => setSettingsTarget('manual') : undefined}
          />
        </TabsContent>
      </Tabs>

      {/* Performance Gap Alert */}
      {manual.total_bets > 0 && horus.total_bets > 0 && Math.abs(performanceGap) > 10 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "border rounded-xl p-3 flex items-start gap-2",
            performanceGap > 0
              ? 'border-warning/30 bg-warning/5'
              : 'border-success/30 bg-success/5'
          )}
        >
          <AlertCircle className={cn("w-4 h-4 mt-0.5 shrink-0", performanceGap > 0 ? 'text-warning' : 'text-success')} />
          <p className="text-xs text-foreground/80">
            {performanceGap > 0
              ? `Hórus está +${performanceGap.toFixed(1)}% acima no ROI. Considere seguir mais recomendações.`
              : `Parabéns! Você está superando Hórus em ${Math.abs(performanceGap).toFixed(1)}% ROI.`}
          </p>
        </motion.div>
      )}

      {/* Settings Dialogs */}
      {settingsTarget === 'horus' && onUpdateHorusBalance && (
        <BankrollSettingsDialog
          isOpen={true}
          onClose={() => setSettingsTarget(null)}
          currentBalance={horus.initial_balance}
          onSave={onUpdateHorusBalance}
        />
      )}
      {settingsTarget === 'manual' && onUpdateManualBalance && (
        <BankrollSettingsDialog
          isOpen={true}
          onClose={() => setSettingsTarget(null)}
          currentBalance={manual.initial_balance}
          onSave={onUpdateManualBalance}
        />
      )}
    </div>
  );
}

function BankrollCard({ label, sublabel, icon, balance, roi, profit, totalBets, wins, losses, winRate, nextStake, accentClass, onSettings }: {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  balance: number;
  roi: number;
  profit: number;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  nextStake: number;
  accentClass: string;
  onSettings?: () => void;
}) {
  const isProfit = profit >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("border rounded-xl p-4 space-y-3 relative bg-card", accentClass)}
    >
      {onSettings && (
        <button
          onClick={onSettings}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          title="Configurar banca"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="font-orbitron text-sm font-bold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">{sublabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatBox icon={<Wallet className="w-3.5 h-3.5 text-primary" />} label="Saldo" value={`R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} sub={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}% ROI`} subColor={roi >= 0 ? 'text-success' : 'text-destructive'} />
        <StatBox icon={<Target className="w-3.5 h-3.5 text-warning" />} label="Win Rate" value={`${winRate.toFixed(0)}%`} sub={`${totalBets} apostas`} />
        <StatBox icon={isProfit ? <TrendingUp className="w-3.5 h-3.5 text-success" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />} label="Green / Red" value={`${wins} / ${losses}`} sub="Resultado" />
        <StatBox icon={<Zap className="w-3.5 h-3.5 text-accent" />} label="Próxima Entrada" value={`R$ ${nextStake.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} sub="5% da banca" />
      </div>
    </motion.div>
  );
}

function StatBox({ icon, label, value, sub, subColor }: { icon: React.ReactNode; label: string; value: string; sub: string; subColor?: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-muted-foreground font-orbitron uppercase">{label}</span>
      </div>
      <p className="text-sm font-orbitron font-bold text-foreground">{value}</p>
      <p className={cn("text-[10px]", subColor || 'text-muted-foreground')}>{sub}</p>
    </div>
  );
}
