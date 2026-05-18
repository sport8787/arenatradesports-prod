import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Layers, TrendingUp, Target, Percent, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell,
} from "recharts";

type Row = {
  id: string;
  league: string | null;
  odd: number | null;
  value_percentage: number | null;
  estimated_probability: number | null;
  approval_block: "A" | "B" | "C" | null;
  resultado: string | null; // green | red | void
  profit_loss: number | null;
  stake_percentage: number | null;
  match_date: string | null;
  created_at: string;
};

const BLOCK_COLORS: Record<string, string> = {
  A: "hsl(142 71% 45%)",
  B: "hsl(38 92% 50%)",
  C: "hsl(0 84% 60%)",
};

function oddBucket(odd: number | null | undefined): string {
  if (!odd || odd <= 0) return "?";
  if (odd < 1.50) return "1.30–1.49";
  if (odd < 1.85) return "1.50–1.84";
  if (odd < 2.30) return "1.85–2.29";
  if (odd < 3.20) return "2.30–3.19";
  return "3.20+";
}
const ODD_ORDER = ["1.30–1.49", "1.50–1.84", "1.85–2.29", "2.30–3.19", "3.20+"];

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export default function PunterGateDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<string>("30");
  const [blockFilter, setBlockFilter] = useState<string>("all");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [oddFilter, setOddFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const { data, error } = await supabase
        .from("punter_sinais")
        .select("id, league, odd, value_percentage, estimated_probability, approval_block, resultado, profit_loss, stake_percentage, match_date, created_at")
        .gte("created_at", since)
        .ilike("verdict", "APROVADO%")
        .order("created_at", { ascending: true })
        .limit(5000);
      if (!error) setRows((data as any) || []);
      setLoading(false);
    })();
  }, [days]);

  const leagues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.league && s.add(r.league));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (blockFilter !== "all" && r.approval_block !== blockFilter) return false;
      if (leagueFilter !== "all" && r.league !== leagueFilter) return false;
      if (oddFilter !== "all" && oddBucket(r.odd) !== oddFilter) return false;
      return true;
    });
  }, [rows, blockFilter, leagueFilter, oddFilter]);

  // KPIs globais e por bloco
  const kpis = useMemo(() => {
    const calc = (list: Row[]) => {
      const settled = list.filter((r) => r.resultado === "green" || r.resultado === "red");
      const green = settled.filter((r) => r.resultado === "green").length;
      const red = settled.filter((r) => r.resultado === "red").length;
      const winRate = settled.length ? (green / settled.length) * 100 : 0;
      const evSum = list.reduce((s, r) => s + (Number(r.value_percentage) || 0), 0);
      const evAvg = list.length ? evSum / list.length : 0;
      const totalPnL = list.reduce((s, r) => s + (Number(r.profit_loss) || 0), 0);
      const totalStake = list.reduce((s, r) => s + (Number(r.stake_percentage) || 0), 0);
      const roi = totalStake > 0 ? (totalPnL / totalStake) * 100 : 0;
      return { total: list.length, green, red, winRate, evAvg, roi };
    };
    return {
      all: calc(filtered),
      A: calc(filtered.filter((r) => r.approval_block === "A")),
      B: calc(filtered.filter((r) => r.approval_block === "B")),
      C: calc(filtered.filter((r) => r.approval_block === "C")),
    };
  }, [filtered]);

  // Série por dia
  const daily = useMemo(() => {
    const map = new Map<string, { date: string; aprovados: number; green: number; red: number; ev: number; pnl: number }>();
    filtered.forEach((r) => {
      const d = (r.match_date || r.created_at?.slice(0, 10)) as string;
      if (!d) return;
      const it = map.get(d) || { date: d, aprovados: 0, green: 0, red: 0, ev: 0, pnl: 0 };
      it.aprovados++;
      if (r.resultado === "green") it.green++;
      if (r.resultado === "red") it.red++;
      it.ev += Number(r.value_percentage) || 0;
      it.pnl += Number(r.profit_loss) || 0;
      map.set(d, it);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        winRate: d.green + d.red > 0 ? (d.green / (d.green + d.red)) * 100 : 0,
        evAvg: d.aprovados > 0 ? d.ev / d.aprovados : 0,
      }));
  }, [filtered]);

  // Série por semana
  const weekly = useMemo(() => {
    const map = new Map<string, { week: string; aprovados: number; green: number; red: number; ev: number; pnl: number }>();
    filtered.forEach((r) => {
      const d = new Date((r.match_date || r.created_at) as string);
      const k = isoWeek(d);
      const it = map.get(k) || { week: k, aprovados: 0, green: 0, red: 0, ev: 0, pnl: 0 };
      it.aprovados++;
      if (r.resultado === "green") it.green++;
      if (r.resultado === "red") it.red++;
      it.ev += Number(r.value_percentage) || 0;
      it.pnl += Number(r.profit_loss) || 0;
      map.set(k, it);
    });
    return Array.from(map.values())
      .sort((a, b) => a.week.localeCompare(b.week))
      .map((w) => ({
        ...w,
        winRate: w.green + w.red > 0 ? (w.green / (w.green + w.red)) * 100 : 0,
        evAvg: w.aprovados > 0 ? w.ev / w.aprovados : 0,
      }));
  }, [filtered]);

  // Por liga
  const byLeague = useMemo(() => {
    const map = new Map<string, { league: string; total: number; green: number; red: number; pnl: number }>();
    filtered.forEach((r) => {
      const k = r.league || "?";
      const it = map.get(k) || { league: k, total: 0, green: 0, red: 0, pnl: 0 };
      it.total++;
      if (r.resultado === "green") it.green++;
      if (r.resultado === "red") it.red++;
      it.pnl += Number(r.profit_loss) || 0;
      map.set(k, it);
    });
    return Array.from(map.values())
      .map((l) => ({ ...l, winRate: l.green + l.red ? (l.green / (l.green + l.red)) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [filtered]);

  // Por bucket de odd
  const byOdd = useMemo(() => {
    const map = new Map<string, { bucket: string; total: number; green: number; red: number; pnl: number }>();
    filtered.forEach((r) => {
      const k = oddBucket(r.odd);
      const it = map.get(k) || { bucket: k, total: 0, green: 0, red: 0, pnl: 0 };
      it.total++;
      if (r.resultado === "green") it.green++;
      if (r.resultado === "red") it.red++;
      it.pnl += Number(r.profit_loss) || 0;
      map.set(k, it);
    });
    return ODD_ORDER.map((b) => map.get(b)).filter(Boolean).map((l: any) => ({
      ...l, winRate: l.green + l.red ? (l.green / (l.green + l.red)) * 100 : 0,
    }));
  }, [filtered]);

  // Por bloco
  const byBlock = useMemo(() => {
    return (["A", "B", "C"] as const).map((b) => {
      const k = kpis[b];
      return { block: `Bloco ${b}`, total: k.total, winRate: k.winRate, evAvg: k.evAvg, roi: k.roi };
    });
  }, [kpis]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate("/punter/funcoes")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Layers className="w-4 h-4 text-primary" />
          <h1 className="font-mono text-sm font-semibold tracking-tight">GATE DASHBOARD — BLOCOS A/B/C</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-6xl space-y-5">
        {/* Filtros */}
        <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-mono text-muted-foreground tracking-wider">PERÍODO</label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted-foreground tracking-wider">BLOCO</label>
            <Select value={blockFilter} onValueChange={setBlockFilter}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="A">🟢 Bloco A — Segurança</SelectItem>
                <SelectItem value="B">🟡 Bloco B — Valor</SelectItem>
                <SelectItem value="C">🔥 Bloco C — Elite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted-foreground tracking-wider">LIGA</label>
            <Select value={leagueFilter} onValueChange={setLeagueFilter}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Todas</SelectItem>
                {leagues.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted-foreground tracking-wider">FAIXA DE ODD</label>
            <Select value={oddFilter} onValueChange={setOddFilter}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ODD_ORDER.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* KPIs globais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Activity className="w-4 h-4" />} label="Aprovados" value={kpis.all.total.toString()} sub={`${kpis.all.green}G / ${kpis.all.red}R`} />
          <KpiCard icon={<Target className="w-4 h-4" />} label="Win Rate" value={`${kpis.all.winRate.toFixed(1)}%`} sub={`${kpis.all.green + kpis.all.red} liquidadas`} />
          <KpiCard icon={<Percent className="w-4 h-4" />} label="EV Médio" value={`${kpis.all.evAvg.toFixed(2)}%`} sub="value_percentage" />
          <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="ROI" value={`${kpis.all.roi.toFixed(2)}%`} sub="profit / stake" />
        </div>

        {/* KPIs por bloco */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["A", "B", "C"] as const).map((b) => (
            <Card key={b} className="p-4" style={{ borderLeft: `4px solid ${BLOCK_COLORS[b]}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: BLOCK_COLORS[b] }}>
                  BLOCO {b}
                </span>
                <span className="text-[10px] text-muted-foreground">{kpis[b].total} aprovados</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="WIN" value={`${kpis[b].winRate.toFixed(0)}%`} />
                <Metric label="EV" value={`${kpis[b].evAvg.toFixed(1)}%`} />
                <Metric label="ROI" value={`${kpis[b].roi.toFixed(1)}%`} />
              </div>
            </Card>
          ))}
        </div>

        {/* Gráficos temporais */}
        <Card className="p-4">
          <Tabs defaultValue="day">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">EVOLUÇÃO TEMPORAL</h2>
              <TabsList>
                <TabsTrigger value="day">Por dia</TabsTrigger>
                <TabsTrigger value="week">Por semana</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="day" className="space-y-4">
              <ChartTimeSeries data={daily} xKey="date" />
            </TabsContent>
            <TabsContent value="week" className="space-y-4">
              <ChartTimeSeries data={weekly} xKey="week" />
            </TabsContent>
          </Tabs>
        </Card>

        {/* Por bloco */}
        <Card className="p-4">
          <h2 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground mb-3">COMPARATIVO ENTRE BLOCOS</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byBlock}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="block" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="winRate" name="Win Rate %" fill="hsl(var(--primary))" />
              <Bar dataKey="evAvg" name="EV %" fill="hsl(38 92% 50%)" />
              <Bar dataKey="roi" name="ROI %" fill="hsl(142 71% 45%)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Por faixa de odd */}
        <Card className="p-4">
          <h2 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground mb-3">DESEMPENHO POR FAIXA DE ODD</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byOdd}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="total" name="Aprovados" fill="hsl(var(--muted-foreground))" />
              <Bar yAxisId="right" dataKey="winRate" name="Win Rate %" fill="hsl(var(--primary))" />
              <Bar yAxisId="right" dataKey="pnl" name="Lucro" fill="hsl(142 71% 45%)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Por liga */}
        <Card className="p-4">
          <h2 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground mb-3">TOP 15 LIGAS</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono text-muted-foreground tracking-wider border-b border-border">
                  <th className="py-2">LIGA</th>
                  <th className="py-2 text-right">SINAIS</th>
                  <th className="py-2 text-right">G/R</th>
                  <th className="py-2 text-right">WIN %</th>
                  <th className="py-2 text-right">LUCRO</th>
                </tr>
              </thead>
              <tbody>
                {byLeague.map((l) => (
                  <tr key={l.league} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 truncate max-w-xs">{l.league}</td>
                    <td className="py-2 text-right font-mono">{l.total}</td>
                    <td className="py-2 text-right font-mono text-xs">{l.green}/{l.red}</td>
                    <td className="py-2 text-right font-mono" style={{ color: l.winRate >= 55 ? "hsl(142 71% 45%)" : l.winRate >= 45 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)" }}>
                      {l.winRate.toFixed(0)}%
                    </td>
                    <td className="py-2 text-right font-mono" style={{ color: l.pnl > 0 ? "hsl(142 71% 45%)" : l.pnl < 0 ? "hsl(0 84% 60%)" : undefined }}>
                      {l.pnl > 0 ? "+" : ""}{l.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {byLeague.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem dados no filtro atual.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {loading && <p className="text-center text-sm text-muted-foreground">Carregando…</p>}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-[10px] font-mono tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function ChartTimeSeries({ data, xKey }: { data: any[]; xKey: string }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="aprovados" name="Aprovados" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="winRate" name="Win Rate %" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="evAvg" name="EV %" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="pnl" name="Lucro acumulado">
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
