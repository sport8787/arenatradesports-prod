import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, RefreshCw, ArrowLeft, CheckCircle2, Activity, Trash2, Clock, Sparkles } from "lucide-react";
import { AIMonitorPanel } from "@/components/admin/AIMonitorPanel";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface RunRow {
  id: string;
  function_name: string;
  status: string;
  duration_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  context: Record<string, unknown> | null;
  started_at: string;
  finished_at: string;
}

interface ErrorRow {
  id: string;
  function_name: string;
  error_message: string;
  error_stack: string | null;
  context: Record<string, unknown> | null;
  status_code: number | null;
  severity: string;
  created_at: string;
}

const WINDOW_OPTIONS = [
  { value: "15", label: "15 minutos" },
  { value: "60", label: "1 hora" },
  { value: "360", label: "6 horas" },
  { value: "1440", label: "24 horas" },
  { value: "10080", label: "7 dias" },
];

export default function AdminEdgeFunctionsStatus() {
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [windowMinutes, setWindowMinutes] = useState("60");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [filterFn, setFilterFn] = useState<string>("all");

  const fetchRows = async () => {
    const since = new Date(Date.now() - parseInt(windowMinutes) * 60_000).toISOString();
    const [errRes, runRes] = await Promise.all([
      supabase
        .from("edge_function_errors")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("edge_function_runs")
        .select("*")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200),
    ]);
    if (errRes.error) toast.error("Falha ao carregar logs", { description: errRes.error.message });
    else setRows((errRes.data ?? []) as ErrorRow[]);
    if (!runRes.error) setRuns((runRes.data ?? []) as RunRow[]);
    setLastFetched(new Date());
    setLoading(false);
  };

  // Initial + window change
  useEffect(() => {
    setLoading(true);
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMinutes]);

  // Polling
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchRows, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, windowMinutes]);

  // Realtime: refresh immediately when a sync fails
  useEffect(() => {
    const channel = supabase
      .channel("edge-fn-errors")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "edge_function_errors" },
        (payload) => {
          const row = payload.new as ErrorRow;
          toast.error(`⚠️ Falha em ${row.function_name}`, {
            description: row.error_message?.slice(0, 120),
          });
          fetchRows();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMinutes]);

  const functionNames = useMemo(() => {
    const set = new Set(rows.map((r) => r.function_name));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filteredRows = useMemo(
    () => (filterFn === "all" ? rows : rows.filter((r) => r.function_name === filterFn)),
    [rows, filterFn],
  );

  const stats = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const r of rows) grouped[r.function_name] = (grouped[r.function_name] || 0) + 1;
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const totalErrors = rows.length;

  const clearOld = async () => {
    if (!confirm("Limpar registros com mais de 24h?")) return;
    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { error } = await supabase.from("edge_function_errors").delete().lt("created_at", cutoff);
    if (error) toast.error("Falha ao limpar", { description: error.message });
    else {
      toast.success("Logs antigos removidos");
      fetchRows();
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/punter">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Status das Edge Functions</h1>
              <p className="text-sm text-muted-foreground">
                Erros recentes capturados em tempo real
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRows}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <Switch id="auto" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label htmlFor="auto" className="cursor-pointer">
                Auto-refresh (15s + realtime)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Label>Janela:</Label>
              <Select value={windowMinutes} onValueChange={setWindowMinutes}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDOW_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Função:</Label>
              <Select value={filterFn} onValueChange={setFilterFn}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {functionNames.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n === "all" ? "Todas" : n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              {lastFetched && <span>Atualizado {formatDistanceToNow(lastFetched, { locale: ptBR, addSuffix: true })}</span>}
              <Button variant="ghost" size="sm" onClick={clearOld}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar &gt;24h
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4" /> Total de erros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalErrors}</div>
              <p className="text-xs text-muted-foreground">na janela selecionada</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top funções com falha</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Nenhum erro registrado — tudo saudável.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stats.slice(0, 8).map(([name, count]) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setFilterFn(name)}
                    >
                      {name} <span className="ml-2 font-bold">{count}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Errors + Runs */}
        <Tabs defaultValue="errors">
          <TabsList>
            <TabsTrigger value="errors">
              <AlertTriangle className="mr-1 h-4 w-4" /> Erros ({filteredRows.length})
            </TabsTrigger>
            <TabsTrigger value="runs">
              <Clock className="mr-1 h-4 w-4" /> Execuções ({runs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="errors">
            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : filteredRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum erro encontrado nesta janela.
                  </p>
                ) : (
                  <ScrollArea className="h-[55vh]">
                    <div className="space-y-3">
                      {filteredRows.map((r) => (
                        <div key={r.id} className="rounded-lg border bg-card p-3 transition hover:bg-accent/30">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant={r.severity === "warning" ? "secondary" : "destructive"} className="text-xs">
                              {r.function_name}
                            </Badge>
                            {r.status_code && <Badge variant="outline" className="text-xs">HTTP {r.status_code}</Badge>}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(r.created_at), { locale: ptBR, addSuffix: true })}
                            </span>
                          </div>
                          <p className="break-words font-mono text-sm text-foreground">{r.error_message}</p>
                          {r.error_stack && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-muted-foreground">Stack trace</summary>
                              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{r.error_stack}</pre>
                            </details>
                          )}
                          {r.context && Object.keys(r.context).length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-muted-foreground">Contexto</summary>
                              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(r.context, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs">
            <Card>
              <CardContent className="pt-4">
                {runs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma execução registrada (instrumentadas: anti-limiting-engine, mycroft-sports-analysis, sync-betfair).
                  </p>
                ) : (
                  <ScrollArea className="h-[55vh]">
                    <div className="space-y-2">
                      {runs
                        .filter((r) => filterFn === "all" || r.function_name === filterFn)
                        .map((r) => (
                          <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5 text-sm">
                            <Badge variant={r.status === "success" ? "outline" : "destructive"} className="text-xs">
                              {r.status === "success" ? "✓" : "✗"} {r.function_name}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                            </span>
                            {r.status_code && <Badge variant="outline" className="text-xs">HTTP {r.status_code}</Badge>}
                            {r.error_message && (
                              <span className="truncate text-xs text-destructive" title={r.error_message}>
                                {r.error_message}
                              </span>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(r.started_at), { locale: ptBR, addSuffix: true })}
                            </span>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
