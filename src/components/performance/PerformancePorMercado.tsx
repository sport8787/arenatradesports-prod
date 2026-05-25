import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts";
import { translateMarket } from "@/utils/marketTranslator";

type Modalidade = "punter" | "trader";
type Periodo = 7 | 30 | 0; // 0 = todos

interface Row {
  mercado: string;
  greens: number;
  reds: number;
  win_rate_pct: number | null;
  roi_pct: number | null;
  total_sinais: number;
}

interface Props {
  modalidade: Modalidade;
  title: string;
  backTo: string;
}

function winRateColor(wr: number | null): string {
  if (wr == null) return "bg-muted text-muted-foreground";
  if (wr >= 60) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
  if (wr >= 50) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40";
  return "bg-red-500/20 text-red-400 border border-red-500/40";
}

function winRateBarColor(wr: number | null): string {
  if (wr == null) return "hsl(var(--muted))";
  if (wr >= 60) return "hsl(142 71% 45%)";
  if (wr >= 50) return "hsl(48 96% 53%)";
  return "hsl(0 84% 60%)";
}

export default function PerformancePorMercado({ modalidade, title, backTo }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fnName = modalidade === "punter" ? "get_performance_punter" : "get_performance_trader";
        const { data, error } = await supabase.rpc(fnName as any, { p_days: periodo });
        if (error) throw error;
        if (!cancelled) setRows((data as Row[]) || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Falha ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalidade, periodo]);

  const totals = useMemo(() => {
    const greens = rows.reduce((a, r) => a + r.greens, 0);
    const reds = rows.reduce((a, r) => a + r.reds, 0);
    const total = greens + reds;
    const wr = total > 0 ? (greens / total) * 100 : null;
    return { greens, reds, total, wr };
  }, [rows]);

  const chartData = useMemo(
    () =>
      rows
        .filter((r) => r.total_sinais >= 3)
        .slice(0, 15)
        .map((r) => ({
          mercado: translateMarket(r.mercado).slice(0, 28),
          win_rate: Number(r.win_rate_pct ?? 0),
          total: r.total_sinais,
        })),
    [rows],
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={backTo}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retornar
              </Button>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
              <p className="text-xs text-muted-foreground">Análise real de greens, reds, win rate e ROI por mercado</p>
            </div>
          </div>
          <div className="flex gap-2">
            {[7, 30, 0].map((p) => (
              <Button
                key={p}
                variant={periodo === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo(p as Periodo)}
              >
                {p === 0 ? "Tudo" : `${p} dias`}
              </Button>
            ))}
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total de entradas</div>
              <div className="text-2xl font-bold">{totals.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Greens</div>
              <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {totals.greens}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Reds</div>
              <div className="text-2xl font-bold text-red-400 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                {totals.reds}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Win Rate Geral</div>
              <div className="text-2xl font-bold">
                {totals.wr != null ? `${totals.wr.toFixed(1)}%` : <Minus className="w-5 h-5" />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Win Rate por mercado (top 15, mín. 3 entradas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[320px]">
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      type="category"
                      dataKey="mercado"
                      width={170}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                      formatter={(v: any, _n, p: any) => [`${v}% (${p.payload.total} entradas)`, "Win Rate"]}
                    />
                    <Bar dataKey="win_rate" radius={[0, 4, 4, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={winRateBarColor(d.win_rate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes por mercado</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Carregando...
              </div>
            ) : error ? (
              <div className="text-sm text-red-400">Erro: {error}</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhum entrada liquidado no período selecionado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mercado</TableHead>
                    <TableHead className="text-right">Greens</TableHead>
                    <TableHead className="text-right">Reds</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.mercado}>
                      <TableCell className="font-medium max-w-[320px]">{translateMarket(r.mercado)}</TableCell>
                      <TableCell className="text-right text-emerald-400">{r.greens}</TableCell>
                      <TableCell className="text-right text-red-400">{r.reds}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={winRateColor(r.win_rate_pct)}>
                          {r.win_rate_pct != null ? `${Number(r.win_rate_pct).toFixed(1)}%` : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          (r.roi_pct ?? 0) > 0
                            ? "text-emerald-400"
                            : (r.roi_pct ?? 0) < 0
                            ? "text-red-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {r.roi_pct != null ? `${Number(r.roi_pct) > 0 ? "+" : ""}${Number(r.roi_pct).toFixed(2)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.total_sinais}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
