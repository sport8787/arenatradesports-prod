import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import type { Signal } from '@/pages/Historico';

interface WinRateChartProps {
  signals: Signal[];
}

export default function WinRateChart({ signals }: WinRateChartProps) {
  const data = useMemo(() => {
    const approved = signals
      .filter(s => s.verdict === 'APROVADO' && s.result && s.result !== 'PENDING')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let wins = 0;
    return approved.map((s, i) => {
      if (s.result === 'GREEN') wins++;
      return {
        name: new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        winRate: Math.round((wins / (i + 1)) * 100),
      };
    });
  }, [signals]);

  if (data.length < 2) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3">📈 WIN RATE AO LONGO DO TEMPO</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Line type="monotone" dataKey="winRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
