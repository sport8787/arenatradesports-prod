import { motion } from 'framer-motion';
import { Wallet, Target, TrendingUp, TrendingDown, Percent, Zap } from 'lucide-react';
import type { Bankroll } from '@/hooks/useBankroll';

interface BankrollWidgetProps {
  bankroll: Bankroll;
}

export default function BankrollWidget({ bankroll }: BankrollWidgetProps) {
  const roi = bankroll.initial_balance > 0
    ? ((bankroll.balance - bankroll.initial_balance) / bankroll.initial_balance * 100).toFixed(1)
    : '0';
  const isProfit = bankroll.total_profit >= 0;
  const roiNum = parseFloat(roi);
  const nextStake = Math.round(bankroll.balance * 0.05 * 100) / 100;

  const cards = [
    {
      label: 'Banca Virtual',
      value: `R$ ${bankroll.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: `${roiNum >= 0 ? '+' : ''}${roi}% ROI`,
      subColor: roiNum >= 0 ? 'text-success' : 'text-destructive',
      icon: Wallet,
      iconColor: 'text-primary',
    },
    {
      label: 'Win Rate',
      value: `${bankroll.win_rate.toFixed(0)}%`,
      sub: `${bankroll.total_bets} apostas`,
      subColor: 'text-muted-foreground',
      icon: Target,
      iconColor: 'text-warning',
    },
    {
      label: 'Green / Red',
      value: `${bankroll.green_bets} / ${bankroll.red_bets}`,
      sub: 'Resultado',
      subColor: 'text-muted-foreground',
      icon: isProfit ? TrendingUp : TrendingDown,
      iconColor: isProfit ? 'text-success' : 'text-destructive',
    },
    {
      label: 'Próxima Entrada',
      value: `R$ ${nextStake.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: '5% da banca',
      subColor: 'text-muted-foreground',
      icon: Zap,
      iconColor: 'text-accent',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="bg-card border border-border rounded-xl p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            <span className="text-xs text-muted-foreground font-orbitron uppercase">{card.label}</span>
          </div>
          <p className="text-lg font-orbitron font-bold text-foreground">{card.value}</p>
          <p className={`text-xs ${card.subColor}`}>{card.sub}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
