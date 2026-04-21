import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Search, RefreshCw, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LogRow {
  id: string;
  match_id: string | null;
  analysis_id: string | null;
  market: string | null;
  verdict: string | null;
  score_home: number | null;
  score_away: number | null;
  total_goals: number | null;
  result: string | null;
  outcome: string | null;
  reason: string | null;
  trigger_source: string | null;
  status_old: string | null;
  status_new: string | null;
  error_message: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

const RESULT_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "green", label: "🟢 GREEN" },
  { value: "red", label: "🔴 RED" },
  { value: "skipped", label: "⏭️ Skipped" },
  { value: "error", label: "⚠️ Error" },
];

const OUTCOME_OPTIONS = [
  { value: "all", label: "Todos os outcomes" },
  { value: "green", label: "green" },
  { value: "red", label: "red" },
  { value: "already_settled", label: "already_settled" },
  { value: "mismatch", label: "mismatch" },
  { value: "unsupported_market", label: "unsupported_market" },
  { value: "not_active", label: "not_active" },
  { value: "lock_busy", label: "lock_busy" },
  { value: "error", label: "error" },
];

function resultBadge(result: string | null) {
  if (!result) return <Badge variant="outline">—</Badge>;
  if (result === "green") return <Badge className="bg-success text-success-foreground hover:bg-success">GREEN</Badge>;
  if (result === "red") return <Badge variant="destructive">RED</Badge>;
  if (result === "error") return <Badge variant="destructive">ERROR</Badge>;
  return <Badge variant="secondary">{result.toUpperCase()}</Badge>;
}

export default function AdminSettlementLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [matchFilter, setMatchFilter] = useState("");
  const [analysisFilter, setAnalysisFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("mycroft_settlement_log" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (matchFilter.trim()) q = q.ilike("match_id", `%${matchFilter.trim()}%`);
      if (analysisFilter.trim()) q = q.eq("analysis_id", analysisFilter.trim());
      if (marketFilter.trim()) q = q.ilike("market", `%${marketFilter.trim()}%`);
      if (resultFilter !== "all") q = q.eq("result", resultFilter);
      if (outcomeFilter !== "all") q = q.eq("outcome", outcomeFilter);
      if (dateFrom) q = q.gte("created_at", dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }

      const { data, error, count: c } = await q;
      if (error) throw error;
      setRows((data as any) || []);
      setCount(c || 0);
    } catch (e: any) {
      toast.error("Erro ao carregar logs", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = () => {
    setPage(0);
    fetchLogs();
  };

  const resetFilters = () => {
    setMatchFilter("");
    setAnalysisFilter("");
    setMarketFilter("");
    setResultFilter("all");
    setOutcomeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
    setTimeout(fetchLogs, 0);
  };

  const stats = useMemo(() => {
    const green = rows.filter(r => r.result === "green").length;
    const red = rows.filter(r => r.result === "red").length;
    const skipped = rows.filter(r => r.result === "skipped").length;
    const errors = rows.filter(r => r.result === "error").length;
    return { green, red, skipped, errors };
  }, [rows]);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auditoria de Liquidações Automáticas</h1>
          <p className="text-sm text-muted-foreground">
            Registros do trigger <code>auto_settle_mycroft_on_finish</code>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Stats da página atual */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total (filtro)</div><div className="text-2xl font-bold">{count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">GREEN (página)</div><div className="text-2xl font-bold text-success">{stats.green}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">RED (página)</div><div className="text-2xl font-bold text-destructive">{stats.red}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Skipped</div><div className="text-2xl font-bold">{stats.skipped}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Errors</div><div className="text-2xl font-bold text-destructive">{stats.errors}</div></CardContent></Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Match ID</label>
            <Input placeholder="contém..." value={matchFilter} onChange={e => setMatchFilter(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Analysis ID (UUID exato)</label>
            <Input placeholder="uuid" value={analysisFilter} onChange={e => setAnalysisFilter(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Market</label>
            <Input placeholder="ex: over 2.5" value={marketFilter} onChange={e => setMarketFilter(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Result</label>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESULT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Outcome</label>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">De</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Até</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="flex-1">
              <Search className="h-4 w-4 mr-2" /> Aplicar
            </Button>
            <Button variant="outline" onClick={resetFilters}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Mercado</TableHead>
                  <TableHead>Placar</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                )}
                {!loading && rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), "dd/MM HH:mm:ss")}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[140px] truncate" title={r.match_id || ""}>{r.match_id}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={r.market || ""}>{r.market || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.score_home ?? "?"}-{r.score_away ?? "?"}</TableCell>
                    <TableCell>{resultBadge(r.result)}</TableCell>
                    <TableCell className="text-xs"><code>{r.outcome || "—"}</code></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.status_old || "—"} → {r.status_new || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[280px]">
                      <div className="truncate" title={r.reason || ""}>{r.reason || "—"}</div>
                      {r.error_message && <div className="text-destructive truncate" title={r.error_message}>⚠ {r.error_message}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between p-3 border-t">
            <div className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} • {count} registros
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
