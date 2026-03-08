import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface BetForChart {
  placed_at: string;
  profit_loss: number | null;
  status: string;
  result?: string;
}

interface BankrollEvolutionChartProps {
  bets: BetForChart[];
  initialBalance: number;
}

export default function BankrollEvolutionChart({ bets, initialBalance }: BankrollEvolutionChartProps) {
  const data = useMemo(() => {
    const settled = bets
      .filter(b => b.profit_loss != null && (b.status === 'settled' || b.status === 'green' || b.status === 'red' || b.result === 'green' || b.result === 'red'))
      .sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime());

    if (settled.length === 0) return [];

    let running = initialBalance;
    const points = [{ date: 'Início', balance: initialBalance }];

    settled.forEach((bet, i) => {
      running += bet.profit_loss || 0;
      const d = new Date(bet.placed_at);
      points.push({
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        balance: +running.toFixed(2),
      });
    });

    return points;
  }, [bets, initialBalance]);

  if (data.length < 2) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center text-xs text-muted-foreground font-orbitron">
        Liquide ao menos 2 posições para ver a evolução
      </div>
    );
  }

  const minVal = Math.min(...data.map(d => d.balance));
  const maxVal = Math.max(...data.map(d => d.balance));
  const isPositive = data[data.length - 1].balance >= initialBalance;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-xs font-orbitron uppercase text-muted-foreground">Evolução da Banca</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="bankrollGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} stopOpacity={0.3} />
              <stop offset="100%" stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[minVal * 0.95, maxVal * 1.05]}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '11px',
              fontFamily: 'Orbitron',
            }}
            formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
            strokeWidth={2}
            fill="url(#bankrollGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
