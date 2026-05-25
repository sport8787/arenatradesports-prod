import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, ArrowLeft, Search, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  match_id: string;
  home_team: string | null;
  away_team: string | null;
  league: string | null;
  commence_time: string | null;
  created_at: string;
  market: string;
  bookmaker: string | null;
  odd: number | null;
  confidence: number | null;
  value_percentage: number | null;
  stake_percentage: number | null;
  verdict: string;
  thesis: string | null;
  result: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  profit_loss: number | null;
  settled_at: string | null;
}

const fmt = (d: string | null) =>
  !d ? "—" : new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const APPROVED_VERDICTS = ["APROVADO", "APROVADO_SITUACIONAL"];

export default function AdminAuditoriaPunter() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "green" | "red" | "pending">("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<3 | 7 | 14 | 30>(7);
  const [initialBankroll, setInitialBankroll] = useState(1000);

  const fetchData = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("punter_analyses")
        .select(
          "id,match_id,home_team,away_team,league,commence_time,created_at,market,bookmaker,odd,confidence,value_percentage,stake_percentage,verdict,thesis,result,final_score_home,final_score_away,profit_loss,settled_at"
        )
        .in("verdict", APPROVED_VERDICTS)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setRows((data || []) as Row[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, days]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "green") list = list.filter((r) => r.result?.toUpperCase() === "GREEN");
    else if (filter === "red") list = list.filter((r) => r.result?.toUpperCase() === "RED");
    else if (filter === "pending") list = list.filter((r) => !r.result);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.market?.toLowerCase().includes(q) ||
          r.match_id?.toLowerCase().includes(q) ||
          r.home_team?.toLowerCase().includes(q) ||
          r.away_team?.toLowerCase().includes(q) ||
          r.league?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const green = rows.filter((r) => r.result?.toUpperCase() === "GREEN").length;
    const red = rows.filter((r) => r.result?.toUpperCase() === "RED").length;
    const pending = rows.filter((r) => !r.result).length;
    const settled = green + red;
    const winRate = settled > 0 ? (green / settled) * 100 : 0;
    const totalPL = rows.reduce((acc, r) => acc + (Number(r.profit_loss) || 0), 0);
    const avgOdd =
      rows.filter((r) => r.odd).reduce((a, r) => a + Number(r.odd), 0) /
        Math.max(1, rows.filter((r) => r.odd).length) || 0;
    const avgConf =
      rows.filter((r) => r.confidence).reduce((a, r) => a + Number(r.confidence), 0) /
        Math.max(1, rows.filter((r) => r.confidence).length) || 0;
    return { total, green, red, pending, settled, winRate, totalPL, avgOdd, avgConf };
  }, [rows]);

  // Simulação de banca (cronológica) usando stake_percentage de cada entrada
  const sim = useMemo(() => {
    const settledChrono = [...rows]
      .filter((r) => r.result && ["GREEN", "RED"].includes(r.result.toUpperCase()))
      .sort(
        (a, b) =>
          new Date(a.settled_at || a.created_at).getTime() -
          new Date(b.settled_at || b.created_at).getTime(),
      );
    let bank = initialBankroll;
    let peak = initialBankroll;
    let maxDD = 0;
    const curve: { i: number; bank: number }[] = [{ i: 0, bank }];
    for (let i = 0; i < settledChrono.length; i++) {
      const s = settledChrono[i];
      const pct = Math.max(0.5, Math.min(10, Number(s.stake_percentage) || 2.5));
      const stake = (bank * pct) / 100;
      const odd = Number(s.odd) || 0;
      if (s.result?.toUpperCase() === "GREEN") {
        bank += stake * (odd - 1);
      } else {
        bank -= stake;
      }
      if (bank > peak) peak = bank;
      const dd = ((peak - bank) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
      curve.push({ i: i + 1, bank });
    }
    const totalReturn = ((bank - initialBankroll) / initialBankroll) * 100;
    return { final: bank, peak, maxDD, totalReturn, count: settledChrono.length, curve };
  }, [rows, initialBankroll]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?redirect=/admin/auditoria-punter" replace />;
  if (!isAdmin) return <Navigate to="/punter" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Auditoria Pré-Live · Arena Punter</h1>
              <p className="text-sm text-muted-foreground">
                Entradas APROVADOS do Punter × resultado final · simulação de banca virtual
              </p>
            </div>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats agregadas */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="🟢 GREEN" value={stats.green} />
          <StatCard label="🔴 RED" value={stats.red} />
          <StatCard label="⏳ Pendentes" value={stats.pending} />
          <StatCard
            label="Win rate"
            value={`${stats.winRate.toFixed(1)}%`}
            highlight={stats.settled > 0 && stats.winRate < 50}
          />
          <StatCard
            label="Odd média"
            value={stats.avgOdd ? stats.avgOdd.toFixed(2) : "—"}
          />
        </div>

        {/* Simulação de banca */}
        <Card className={sim.totalReturn < -10 ? "border-destructive/40" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {sim.totalReturn < 0 ? (
                <TrendingDown className="w-4 h-4 text-destructive" />
              ) : (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              )}
              Simulação de banca virtual ({sim.count} entradas liquidados em {days}d)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-muted-foreground">Banca inicial (R$):</label>
              <Input
                type="number"
                value={initialBankroll}
                onChange={(e) => setInitialBankroll(Math.max(1, Number(e.target.value) || 1000))}
                className="w-32 h-8"
              />
              <span className="text-xs text-muted-foreground">
                (usa stake_percentage real de cada entrada, clamp 0.5%–10%)
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Banca final" value={`R$ ${sim.final.toFixed(2)}`} />
              <StatCard
                label="Retorno"
                value={`${sim.totalReturn >= 0 ? "+" : ""}${sim.totalReturn.toFixed(1)}%`}
                highlight={sim.totalReturn < 0}
              />
              <StatCard label="Pico" value={`R$ ${sim.peak.toFixed(2)}`} />
              <StatCard
                label="Max Drawdown"
                value={`${sim.maxDD.toFixed(1)}%`}
                highlight={sim.maxDD > 20}
              />
            </div>
            {sim.totalReturn < -20 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                ⚠ Período com perda significativa. Revisar critérios de aprovação, calibração por
                bucket e qualidade de odds dos bookmakers.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="green">🟢 GREEN</SelectItem>
                <SelectItem value="red">🔴 RED</SelectItem>
                <SelectItem value="pending">⏳ Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 dias</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por mercado, time, liga, match_id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filtered.length} de {rows.length}
            </span>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entradas Pré-Live · Punter</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criado</TableHead>
                      <TableHead>Jogo</TableHead>
                      <TableHead>Liga</TableHead>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Odd</TableHead>
                      <TableHead>Conf</TableHead>
                      <TableHead>Stake%</TableHead>
                      <TableHead>Final</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const isRed = r.result?.toUpperCase() === "RED";
                      const isGreen = r.result?.toUpperCase() === "GREEN";
                      return (
                        <TableRow
                          key={r.id}
                          className={
                            isRed ? "bg-destructive/5" : isGreen ? "bg-emerald-500/5" : ""
                          }
                        >
                          <TableCell className="text-xs whitespace-nowrap">
                            <div>{fmt(r.created_at)}</div>
                            <div className="text-muted-foreground">jogo: {fmt(r.commence_time)}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">
                              {r.home_team} × {r.away_team}
                            </div>
                            <div
                              className="text-muted-foreground truncate max-w-[160px]"
                              title={r.match_id}
                            >
                              {r.match_id}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                            {r.league || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{r.market}</div>
                            <div className="text-muted-foreground">
                              {r.bookmaker || "—"}
                              {r.value_percentage != null
                                ? ` · val ${Number(r.value_percentage).toFixed(1)}%`
                                : ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {r.odd != null ? Number(r.odd).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {r.confidence ?? "—"}%
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {r.stake_percentage ?? "—"}%
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {r.final_score_home ?? "—"}:{r.final_score_away ?? "—"}
                          </TableCell>
                          <TableCell>
                            {isGreen && (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                GREEN
                              </Badge>
                            )}
                            {isRed && (
                              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                                RED
                              </Badge>
                            )}
                            {!r.result && (
                              <Badge variant="outline" className="text-muted-foreground">
                                pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-sm font-mono ${
                              (r.profit_loss || 0) > 0
                                ? "text-emerald-400"
                                : (r.profit_loss || 0) < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {r.profit_loss != null ? Number(r.profit_loss).toFixed(2) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">
                          Nenhum entrada encontrado para os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        highlight ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
