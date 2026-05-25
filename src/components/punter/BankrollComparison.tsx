import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Scale, Loader2, TrendingUp, TrendingDown, Percent, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  userId: string;
}

type DataSource = 'manual' | 'betfair';

interface BankrollData {
  label: string;
  totalBets: number;
  greens: number;
  reds: number;
  totalPL: number;
  totalStaked: number;
  roi: number;
  winRate: number;
  avgOdd: number;
  evolution: { index: number; date: string; pl: number }[];
}

export default function BankrollComparison({ userId }: Props) {
  const [source, setSource] = useState<DataSource>('manual');
  const [importedBets, setImportedBets] = useState<any[]>([]);
  const [horusBets, setHorusBets] = useState<any[]>([]);
  const [horusBankroll, setHorusBankroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    const [importedRes, horusRes, bankrollRes] = await Promise.all([
      supabase.from('imported_bets').select('*').eq('user_id', userId).order('bet_date', { ascending: true }),
      supabase.from('virtual_bets_punter' as any).select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('user_bankroll' as any).select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setImportedBets(importedRes.data || []);
    setHorusBets(horusRes.data || []);
    setHorusBankroll(bankrollRes.data);
    setLoading(false);
  };

  const filteredImported = useMemo(() => {
    if (source === 'betfair') {
      return importedBets.filter(b => b.source === 'betfair');
    }
    return importedBets.filter(b => b.source !== 'betfair');
  }, [importedBets, source]);

  const realData = useMemo((): BankrollData => {
    const settled = filteredImported.filter(b => b.result === 'green' || b.result === 'red');
    const greens = settled.filter(b => b.result === 'green');
    const reds = settled.filter(b => b.result === 'red');
    const totalStaked = settled.reduce((s: number, b: any) => s + (b.stake || 0), 0);
    const totalPL = settled.reduce((s: number, b: any) => s + (b.profit_loss || 0), 0);

    let cum = 0;
    const evolution = settled.map((b: any, i: number) => {
      cum += b.profit_loss || 0;
      const d = b.bet_date ? new Date(b.bet_date) : new Date();
      return {
        index: i + 1,
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        pl: +cum.toFixed(2),
      };
    });

    return {
      label: source === 'betfair' ? 'Betfair Real' : 'Import Manual',
      totalBets: settled.length,
      greens: greens.length,
      reds: reds.length,
      totalPL,
      totalStaked,
      roi: totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0,
      winRate: settled.length > 0 ? (greens.length / settled.length) * 100 : 0,
      avgOdd: settled.length > 0 ? settled.reduce((s: number, b: any) => s + (b.odd || 0), 0) / settled.length : 0,
      evolution,
    };
  }, [filteredImported, source]);

  const horusData = useMemo((): BankrollData => {
    const settled = horusBets.filter((b: any) => b.result === 'green' || b.result === 'red');
    const greens = settled.filter((b: any) => b.result === 'green');
    const reds = settled.filter((b: any) => b.result === 'red');
    const totalStaked = settled.reduce((s: number, b: any) => s + (parseFloat(b.stake) || 0), 0);
    const totalPL = settled.reduce((s: number, b: any) => s + (parseFloat(b.profit_loss) || 0), 0);

    let cum = 0;
    const evolution = settled.map((b: any, i: number) => {
      cum += parseFloat(b.profit_loss) || 0;
      const d = b.created_at ? new Date(b.created_at) : new Date();
      return {
        index: i + 1,
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        pl: +cum.toFixed(2),
      };
    });

    return {
      label: 'Banca Hórus (IA)',
      totalBets: settled.length,
      greens: greens.length,
      reds: reds.length,
      totalPL,
      totalStaked,
      roi: totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0,
      winRate: settled.length > 0 ? (greens.length / settled.length) * 100 : 0,
      avgOdd: settled.length > 0 ? settled.reduce((s: number, b: any) => s + (parseFloat(b.odd) || 0), 0) / settled.length : 0,
      evolution,
    };
  }, [horusBets]);

  // Merge evolution for chart
  const mergedChart = useMemo(() => {
    const maxLen = Math.max(realData.evolution.length, horusData.evolution.length);
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        index: i + 1,
        real: realData.evolution[i]?.pl ?? (realData.evolution[realData.evolution.length - 1]?.pl || 0),
        horus: horusData.evolution[i]?.pl ?? (horusData.evolution[horusData.evolution.length - 1]?.pl || 0),
      });
    }
    return data;
  }, [realData, horusData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-lg p-4 space-y-3"
      >
        <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase">
          Comparar Banca Real com Hórus IA
        </h3>
        <p className="text-xs text-muted-foreground">
          Escolha a fonte dos dados da sua banca real para comparação:
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setSource('manual')}
            className={cn(
              "flex-1 py-2.5 rounded-lg font-mono text-xs font-bold transition-colors border",
              source === 'manual'
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-secondary/30 border-border text-muted-foreground hover:text-foreground'
            )}
          >
            📄 Import Manual
          </button>
          <button
            onClick={() => setSource('betfair')}
            className={cn(
              "flex-1 py-2.5 rounded-lg font-mono text-xs font-bold transition-colors border",
              source === 'betfair'
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-secondary/30 border-border text-muted-foreground hover:text-foreground'
            )}
          >
            🟡 Betfair
          </button>
        </div>
      </motion.div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-3">
        <ComparisonCard data={realData} accent="accent" />
        <ComparisonCard data={horusData} accent="primary" />
      </div>

      {/* Delta */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card border border-border rounded-lg p-4"
      >
        <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-3">
          Diferença (Hórus — Real)
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'P&L', value: horusData.totalPL - realData.totalPL, suffix: '' },
            { label: 'ROI', value: horusData.roi - realData.roi, suffix: '%' },
            { label: 'Win Rate', value: horusData.winRate - realData.winRate, suffix: '%' },
          ].map(d => (
            <div key={d.label} className="text-center">
              <p className="text-[9px] text-muted-foreground font-mono uppercase">{d.label}</p>
              <p className={cn(
                "text-sm font-mono font-bold",
                d.value > 0 ? 'text-success' : d.value < 0 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {d.value > 0 ? '+' : ''}{d.label === 'P&L' ? `R$ ${d.value.toFixed(2)}` : `${d.value.toFixed(1)}${d.suffix}`}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Evolution chart */}
      {mergedChart.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-3">
            Evolução Comparativa P&L
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={mergedChart}>
              <defs>
                <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="horusGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="index" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [
                  `R$ ${value.toFixed(2)}`,
                  name === 'real' ? realData.label : 'Hórus IA'
                ]}
              />
              <Legend
                formatter={(value: string) => value === 'real' ? realData.label : 'Hórus IA'}
                wrapperStyle={{ fontSize: '11px' }}
              />
              <Area type="monotone" dataKey="real" stroke="hsl(var(--accent))" fill="url(#realGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="horus" stroke="hsl(var(--primary))" fill="url(#horusGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {realData.totalBets === 0 && horusData.totalBets === 0 && (
        <div className="text-center py-12 space-y-2">
          <Scale className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">Sem dados suficientes para comparação.</p>
          <p className="text-muted-foreground text-xs">Importe entradas reais e aguarde entradas do Hórus.</p>
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ data, accent }: { data: BankrollData; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={cn("bg-card border rounded-lg p-3 space-y-2", `border-${accent}/30`)}
    >
      <h4 className={cn("font-mono text-[10px] font-bold uppercase tracking-wider", `text-${accent}`)}>
        {data.label}
      </h4>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Entradas</span>
          <span className="text-xs font-mono font-bold text-foreground">{data.totalBets}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Win Rate</span>
          <span className="text-xs font-mono font-bold text-foreground">{data.winRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">ROI</span>
          <span className={cn("text-xs font-mono font-bold", data.roi >= 0 ? 'text-success' : 'text-destructive')}>
            {data.roi.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">P&L</span>
          <span className={cn("text-xs font-mono font-bold", data.totalPL >= 0 ? 'text-success' : 'text-destructive')}>
            {data.totalPL >= 0 ? '+' : ''}R$ {data.totalPL.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Odd Média</span>
          <span className="text-xs font-mono font-bold text-foreground">{data.avgOdd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Green/Red</span>
          <span className="text-xs font-mono">
            <span className="text-success font-bold">{data.greens}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-destructive font-bold">{data.reds}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
