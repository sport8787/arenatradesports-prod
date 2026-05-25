import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Share2, TrendingUp, Shield, BarChart3, Target, ArrowLeft, Smartphone, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import type { Bankroll } from '@/hooks/useBankroll';
import { toast } from 'sonner';

interface PerformanceCertificateProps {
  bankroll: Bankroll;
  onClose: () => void;
}

export default function PerformanceCertificate({ bankroll, onClose }: PerformanceCertificateProps) {
  const certRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [growthData, setGrowthData] = useState<{ bet: number; balance: number }[]>([]);

  // Load growth curve from bets_history
  useEffect(() => {
    async function loadGrowth() {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      const { data: bets } = await supabase
        .from('bets_history')
        .select('profit_loss, created_at')
        .eq('user_id', user.user.id)
        .not('result', 'is', null)
        .order('created_at', { ascending: true })
        .limit(500);

      if (bets && bets.length > 0) {
        let cumBalance = bankroll.initial_balance || 1000;
        const points = [{ bet: 0, balance: cumBalance }];
        bets.forEach((b, i) => {
          cumBalance += (b.profit_loss as number) || 0;
          points.push({ bet: i + 1, balance: Math.round(cumBalance * 100) / 100 });
        });
        setGrowthData(points);
      } else {
        // Generate sample from bankroll data
        const initial = bankroll.initial_balance || 1000;
        const current = bankroll.balance || initial;
        const totalBets = bankroll.total_bets || 0;
        if (totalBets > 0) {
          const step = (current - initial) / totalBets;
          const points = Array.from({ length: Math.min(totalBets + 1, 50) }, (_, i) => ({
            bet: i,
            balance: Math.round((initial + step * i * (totalBets / Math.min(totalBets, 49))) * 100) / 100,
          }));
          setGrowthData(points);
        }
      }
    }
    loadGrowth();
  }, [bankroll]);

  const roiOverStakes = bankroll.total_staked > 0
    ? ((bankroll.total_profit || 0) / bankroll.total_staked * 100) : 0;

  const bankReturn = bankroll.initial_balance > 0
    ? ((bankroll.balance - bankroll.initial_balance) / bankroll.initial_balance * 100) : 0;

  const totalProfit = bankroll.total_profit || 0;
  const winRate = bankroll.win_rate || 0;
  const totalBets = bankroll.total_bets || 0;

  const avgWin = bankroll.green_bets > 0 && totalProfit > 0
    ? (totalProfit + bankroll.total_staked) / bankroll.green_bets : 0;
  const avgLoss = bankroll.red_bets > 0 ? bankroll.total_staked / bankroll.red_bets : 1;
  const profitFactor = avgLoss > 0 ? (avgWin * bankroll.green_bets) / (avgLoss * bankroll.red_bets || 1) : 0;

  const drawdown = bankroll.initial_balance > 0
    ? Math.min(100, ((bankroll.initial_balance - Math.min(bankroll.balance, bankroll.initial_balance)) / bankroll.initial_balance * 100)) : 0;

  const sharpe = totalBets > 10 ? roiOverStakes / Math.max(10, 100 - winRate) : 0;

  const metrics = [
    { label: 'ROI s/ Entradas', value: `${roiOverStakes >= 0 ? '+' : ''}${roiOverStakes.toFixed(1)}%`, color: roiOverStakes >= 0 ? 'text-success' : 'text-destructive', icon: TrendingUp },
    { label: 'Retorno Banca', value: `${bankReturn >= 0 ? '+' : ''}${bankReturn.toFixed(1)}%`, color: bankReturn >= 0 ? 'text-success' : 'text-destructive', icon: TrendingUp },
    { label: 'Lucro Total', value: `R$ ${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? 'text-success' : 'text-destructive', icon: BarChart3 },
    { label: 'Win Rate', value: `${winRate.toFixed(0)}%`, color: winRate >= 55 ? 'text-success' : 'text-warning', icon: Target },
    { label: 'Drawdown', value: `${drawdown.toFixed(1)}%`, color: drawdown < 20 ? 'text-success' : 'text-destructive', icon: Shield },
    { label: 'Sharpe Ratio', value: sharpe.toFixed(2), color: sharpe >= 1 ? 'text-success' : 'text-warning', icon: BarChart3 },
  ];

  const shareText = `🏆 Meu desempenho no Oráculo Mycroft:\n📈 ROI: ${roiOverStakes.toFixed(1)}%\n📊 Retorno: ${bankReturn.toFixed(1)}%\n✅ Win Rate: ${winRate.toFixed(0)}%\n💰 Lucro: R$ ${totalProfit.toFixed(2)}\n📊 ${totalBets} entradas\n\nhttps://arenatradesports.lovable.app`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Certificado de Performance — Oráculo Mycroft',
          text: shareText,
          url: 'https://arenatradesports.lovable.app',
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleShare = (platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const url = encodeURIComponent('https://arenatradesports.lovable.app');

    const links: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodedText}`,
      instagram: '#', // Instagram doesn't support URL sharing, use native
    };

    if (platform === 'instagram') {
      handleNativeShare();
      return;
    }

    if (links[platform]) {
      window.open(links[platform], '_blank');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success('Texto copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const chartColor = bankReturn >= 0 ? '#22c55e' : '#ef4444';

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
          className="bg-gradient-to-br from-card via-card to-primary/5 border-2 border-primary/30 rounded-2xl p-6 space-y-5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="text-center space-y-2">
            <Award className="w-12 h-12 text-yellow-400 mx-auto" />
            <h2 className="font-orbitron text-xl font-bold text-foreground">Certificado de Performance</h2>
            <p className="text-xs text-muted-foreground">Oráculo Mycroft • Arena Punter</p>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>

          {/* Bankroll Growth Chart */}
          {growthData.length > 1 && (
            <div className="bg-secondary/20 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-2 text-center font-bold">Crescimento da Banca</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bet" hide />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(v) => `Entrada #${v}`}
                    formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Banca']}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#growthGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-secondary/30 rounded-xl p-3 text-center">
                <m.icon className={cn("w-4 h-4 mx-auto mb-1", m.color)} />
                <p className="text-[10px] text-muted-foreground uppercase">{m.label}</p>
                <p className={cn("font-orbitron text-lg font-bold", m.color)}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{totalBets}</span> entradas</p>
            <p className="text-sm text-muted-foreground">
              Green: <span className="text-success font-bold">{bankroll.green_bets}</span> | Red: <span className="text-destructive font-bold">{bankroll.red_bets}</span>
            </p>
          </div>
        </motion.div>

        {/* Share Buttons */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground text-center">Compartilhar</p>

          {/* Native Share (mobile) */}
          {typeof navigator !== 'undefined' && navigator.share && (
            <Button onClick={handleNativeShare} className="w-full gap-2" variant="default">
              <Smartphone className="w-4 h-4" />
              Compartilhar (Instagram, Stories, etc.)
            </Button>
          )}

          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => handleShare('twitter')} className="gap-1.5 flex-1">
              𝕏 Twitter
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleShare('whatsapp')} className="gap-1.5 flex-1">
              📱 WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 flex-1">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
