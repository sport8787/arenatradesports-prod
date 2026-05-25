import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Target, BarChart3, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import GoldButton from '@/components/game/GoldButton';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface BetRecord {
  id: string;
  match_id: string;
  market: string;
  odd: number;
  stake: number;
  status: string;
  result: string | null;
  profit_loss: number;
  created_at: string;
  match_name: string | null;
  league: string | null;
}

export default function SportsPerformance() {
  const navigate = useNavigate();
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data } = await supabase
        .from('virtual_bets')
        .select('*')
        .eq('user_id', session.session.user.id)
        .neq('status', 'pending')
        .order('placed_at', { ascending: true });

      if (data) {
        setBets(data.map((b: any) => ({
          id: b.id,
          match_id: b.match_id,
          market: b.market || 'N/A',
          odd: b.odd || 0,
          stake: b.stake || 0,
          status: b.status,
          result: b.result,
          profit_loss: b.profit_loss || 0,
          created_at: b.created_at,
          match_name: b.match_name,
          league: b.league,
        })));
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return bets;
    const days = periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    return bets.filter(b => b.created_at >= cutoff);
  }, [bets, periodFilter]);

  // KPIs
  const totalBets = filtered.length;
  const wins = filtered.filter(b => b.result === 'won').length;
  const losses = filtered.filter(b => b.result === 'lost').length;
  const winRate = totalBets > 0 ? (wins / totalBets * 100) : 0;
  const totalPL = filtered.reduce((s, b) => s + b.profit_loss, 0);
  const totalStaked = filtered.reduce((s, b) => s + b.stake, 0);
  const roi = totalStaked > 0 ? (totalPL / totalStaked * 100) : 0;
  const avgOdd = totalBets > 0 ? filtered.reduce((s, b) => s + b.odd, 0) / totalBets : 0;

  // Equity curve
  const equityCurve = useMemo(() => {
    let cumPL = 0;
    return filtered.map((b, i) => {
      cumPL += b.profit_loss;
      return {
        index: i + 1,
        date: new Date(b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        pl: parseFloat(cumPL.toFixed(2)),
      };
    });
  }, [filtered]);

  // By league
  const byLeague = useMemo(() => {
    const map = new Map<string, { wins: number; total: number; pl: number }>();
    filtered.forEach(b => {
      const league = b.league || 'Desconhecida';
      const entry = map.get(league) || { wins: 0, total: 0, pl: 0 };
      entry.total++;
      if (b.result === 'won') entry.wins++;
      entry.pl += b.profit_loss;
      map.set(league, entry);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, ...d, winRate: d.total > 0 ? (d.wins / d.total * 100) : 0 }))
      .sort((a, b) => b.pl - a.pl)
      .slice(0, 8);
  }, [filtered]);

  // By market
  const byMarket = useMemo(() => {
    const map = new Map<string, { wins: number; total: number; pl: number }>();
    filtered.forEach(b => {
      const entry = map.get(b.market) || { wins: 0, total: 0, pl: 0 };
      entry.total++;
      if (b.result === 'won') entry.wins++;
      entry.pl += b.profit_loss;
      map.set(b.market, entry);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, winRate: d.total > 0 ? (d.wins / d.total * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filtered]);

  // Win/loss pie
  const pieData = [
    { name: 'Green', value: wins, fill: '#22C55E' },
    { name: 'Red', value: losses, fill: '#EF4444' },
    { name: 'Outros', value: totalBets - wins - losses, fill: '#6B7280' },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate('/punter/menu')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-orbitron text-base md:text-lg font-bold text-primary">
            Performance Dashboard
          </h1>
          <div className="ml-auto flex gap-2">
            {(['7d', '30d', '90d', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-orbitron border transition-all',
                  periodFilter === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                )}
              >
                {p === 'all' ? 'Tudo' : p}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground font-orbitron">
            Carregando...
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Entradas" value={totalBets.toString()} icon={<BarChart3 className="w-5 h-5" />} />
              <KpiCard label="Win Rate" value={`${winRate.toFixed(1)}%`} icon={<Target className="w-5 h-5" />} positive={winRate >= 50} />
              <KpiCard label="P&L Total" value={`R$ ${totalPL.toFixed(2)}`} icon={totalPL >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />} positive={totalPL >= 0} />
              <KpiCard label="ROI" value={`${roi.toFixed(1)}%`} icon={<TrendingUp className="w-5 h-5" />} positive={roi >= 0} />
            </div>

            {/* Equity Curve */}
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <h2 className="font-orbitron text-sm font-bold text-foreground mb-4">Evolução da Banca</h2>
              {equityCurve.length > 1 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="pl" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground text-sm py-10">Dados insuficientes para gráfico</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By League */}
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <h2 className="font-orbitron text-sm font-bold text-foreground mb-4">P&L por Liga</h2>
                {byLeague.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={byLeague} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="pl" radius={[0, 4, 4, 0]}>
                        {byLeague.map((entry, i) => (
                          <Cell key={i} fill={entry.pl >= 0 ? '#22C55E' : '#EF4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-10">Sem dados</p>
                )}
              </div>

              {/* By Market */}
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <h2 className="font-orbitron text-sm font-bold text-foreground mb-4">Performance por Mercado</h2>
                {byMarket.length > 0 ? (
                  <div className="space-y-3">
                    {byMarket.map(m => (
                      <div key={m.name} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/20">
                        <span className="text-xs text-foreground font-medium truncate max-w-[140px]">{m.name}</span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">{m.total} trades</span>
                          <span className={m.winRate >= 50 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{m.winRate.toFixed(0)}% WR</span>
                          <span className={cn('font-orbitron font-bold', m.pl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                            R$ {m.pl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-10">Sem dados</p>
                )}
              </div>
            </div>

            {/* Win/Loss Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <h2 className="font-orbitron text-sm font-bold text-foreground mb-4">Distribuição W/L</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-10">Sem dados</p>
                )}
              </div>

              {/* Summary Stats */}
              <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
                <h2 className="font-orbitron text-sm font-bold text-foreground mb-2">Resumo</h2>
                <StatRow label="Odd Média" value={avgOdd.toFixed(2)} />
                <StatRow label="Stake Total" value={`R$ ${totalStaked.toFixed(2)}`} />
                <StatRow label="Greens" value={wins.toString()} color="text-[#22C55E]" />
                <StatRow label="Reds" value={losses.toString()} color="text-[#EF4444]" />
                <StatRow label="P&L Líquido" value={`R$ ${totalPL.toFixed(2)}`} color={totalPL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, positive }: { label: string; value: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-orbitron uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-xl font-orbitron font-bold', positive === true ? 'text-[#22C55E]' : positive === false ? 'text-[#EF4444]' : 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-orbitron font-bold', color || 'text-foreground')}>{value}</span>
    </div>
  );
}
