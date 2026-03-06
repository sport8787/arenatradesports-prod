import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Award, Download, Share2, TrendingUp, Shield, BarChart3, Target, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Bankroll } from '@/hooks/useBankroll';

interface PerformanceCertificateProps {
  bankroll: Bankroll;
  onClose: () => void;
}

export default function PerformanceCertificate({ bankroll, onClose }: PerformanceCertificateProps) {
  const certRef = useRef<HTMLDivElement>(null);

  const roi = bankroll.initial_balance > 0
    ? ((bankroll.balance - bankroll.initial_balance) / bankroll.initial_balance * 100)
    : 0;

  const totalProfit = bankroll.total_profit || 0;
  const winRate = bankroll.win_rate || 0;
  const totalBets = bankroll.total_bets || 0;

  // Profit Factor = gross wins / gross losses (estimated)
  const avgWin = bankroll.green_bets > 0 && totalProfit > 0
    ? (totalProfit + bankroll.total_staked) / bankroll.green_bets
    : 0;
  const avgLoss = bankroll.red_bets > 0
    ? bankroll.total_staked / bankroll.red_bets
    : 1;
  const profitFactor = avgLoss > 0 ? (avgWin * bankroll.green_bets) / (avgLoss * bankroll.red_bets || 1) : 0;

  // Drawdown estimate (simple: max loss streak * avg stake)
  const drawdown = bankroll.initial_balance > 0
    ? Math.min(100, ((bankroll.initial_balance - Math.min(bankroll.balance, bankroll.initial_balance)) / bankroll.initial_balance * 100))
    : 0;

  // Simplified Sharpe (ROI / volatility proxy)
  const sharpe = totalBets > 10 ? roi / Math.max(10, 100 - winRate) : 0;

  const metrics = [
    { label: 'ROI', value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`, color: roi >= 0 ? 'text-success' : 'text-destructive', icon: TrendingUp },
    { label: 'Lucro Total', value: `R$ ${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? 'text-success' : 'text-destructive', icon: BarChart3 },
    { label: 'Win Rate', value: `${winRate.toFixed(0)}%`, color: winRate >= 55 ? 'text-success' : 'text-warning', icon: Target },
    { label: 'Drawdown', value: `${drawdown.toFixed(1)}%`, color: drawdown < 20 ? 'text-success' : 'text-destructive', icon: Shield },
    { label: 'Profit Factor', value: profitFactor.toFixed(2), color: profitFactor >= 1.5 ? 'text-success' : 'text-warning', icon: BarChart3 },
    { label: 'Sharpe Ratio', value: sharpe.toFixed(2), color: sharpe > 0.5 ? 'text-success' : 'text-muted-foreground', icon: TrendingUp },
  ];

  const shareText = `🏆 Meu desempenho no Oráculo Mycroft:\n📈 ROI: ${roi.toFixed(1)}%\n✅ Win Rate: ${winRate.toFixed(0)}%\n💰 Lucro: R$ ${totalProfit.toFixed(2)}\n📊 ${totalBets} apostas`;

  const handleShare = async (platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const url = encodeURIComponent('https://arenatradesports.lovable.app');

    const links: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${url}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${url}`,
    };

    if (links[platform]) {
      window.open(links[platform], '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Award className="w-5 h-5 text-yellow-400" />
          <h1 className="font-orbitron text-base font-bold text-foreground">Certificado de Performance</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        {/* Certificate Card */}
        <motion.div
          ref={certRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-card via-card to-primary/5 border-2 border-primary/30 rounded-2xl p-6 space-y-6 relative overflow-hidden"
        >
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="text-center space-y-2">
            <Award className="w-12 h-12 text-yellow-400 mx-auto" />
            <h2 className="font-orbitron text-xl font-bold text-foreground">Certificado de Performance</h2>
            <p className="text-xs text-muted-foreground">Oráculo Mycroft • Arena Punter</p>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-secondary/30 rounded-xl p-3 text-center">
                <m.icon className={cn("w-4 h-4 mx-auto mb-1", m.color)} />
                <p className="text-[10px] text-muted-foreground uppercase">{m.label}</p>
                <p className={cn("font-orbitron text-lg font-bold", m.color)}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">Total de apostas: <span className="font-bold text-foreground">{totalBets}</span></p>
            <p className="text-sm text-muted-foreground">
              Green: <span className="text-success font-bold">{bankroll.green_bets}</span> | Red: <span className="text-destructive font-bold">{bankroll.red_bets}</span>
            </p>
          </div>
        </motion.div>

        {/* Share Buttons */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground text-center">Compartilhar</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => handleShare('twitter')} className="gap-1.5">
              𝕏 Twitter
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleShare('whatsapp')} className="gap-1.5">
              📱 WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(shareText);
            }} className="gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              Copiar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
