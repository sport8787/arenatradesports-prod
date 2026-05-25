import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MycroftRulesImpactChart } from "./MycroftRulesImpactChart";

type Modo = "trader" | "punter";

interface Threshold {
  modo: Modo;
  divergence_threshold_pct: number;
  window_hours: number;
  min_samples: number;
  active: boolean;
}

interface SimResult {
  total: number;
  dist_novo: Record<string, number>;
  dist_atual: Record<string, number>;
  divergencia_pct: number;
  novos_aprovou_atual_nao: number;
  atual_aprovou_novo_nao: number;
  winrate: {
    total_settled: number;
    novo_winrate: number | null;
    atual_winrate: number | null;
    novo_aprovou: number;
    atual_aprovou: number;
  };
  samples: any[];
  rule_ranking?: Array<{
    rule: string; field: string; op: string; value: number;
    category: "pontuacao" | "veto"; points: number | null;
    hits_total: number; hits_div: number;
    veto_div: number; bonus_div: number;
    flips_to_aprovado: number; flips_from_aprovado: number;
    impacto_pct: number;
  }>;
  rules_source?: string;
  rules_count: number;
}

interface HistoryOption {
  id: string;
  created_at: string;
  changed_by_email: string | null;
  operation: string;
  rule_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  APROVADO: "bg-green-500/15 text-green-500 border-green-500/30",
  CUIDADO: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  AGUARDAR: "bg-muted text-muted-foreground",
  VETADO: "bg-destructive/15 text-destructive border-destructive/30",
};

function DistBar({ dist, total, label }: { dist: Record<string, number>; total: number; label: string }) {
  const order = ["APROVADO", "CUIDADO", "AGUARDAR", "VETADO"];
  const colors: Record<string, string> = {
    APROVADO: "bg-green-500", CUIDADO: "bg-yellow-500", AGUARDAR: "bg-muted-foreground/40", VETADO: "bg-destructive",
  };
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex h-6 rounded overflow-hidden">
        {order.map((s) => {
          const v = dist[s] ?? 0;
          const pct = total > 0 ? (v / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div key={s} className={`${colors[s]} flex items-center justify-center text-[10px] text-white font-semibold`} style={{ width: `${pct}%` }} title={`${s}: ${v} (${pct.toFixed(1)}%)`}>
              {pct > 8 ? `${s.slice(0, 3)} ${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 text-[10px] mt-1 text-muted-foreground">
        {order.map((s) => <span key={s}>{s}: <strong>{dist[s] ?? 0}</strong></span>)}
      </div>
    </div>
  );
}

export function MycroftRulesSimulatorTab() {
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [alerts, setAlerts] = useState<Array<{ modo: Modo; pct: number; samples: number; threshold: number }>>([]);
  const [modo, setModo] = useState<Modo>("trader");
  const [sampleSize, setSampleSize] = useState(200);
  const [windowHours, setWindowHours] = useState(168);
  const [mercadoFilter, setMercadoFilter] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [rulesSourceMode, setRulesSourceMode] = useState<"current" | "history_at" | "history_versions">("current");
  const [historyAt, setHistoryAt] = useState<string>(""); // datetime-local
  const [historyOptions, setHistoryOptions] = useState<HistoryOption[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  // Filtros do ranking
  const [filterCategory, setFilterCategory] = useState<"all" | "pontuacao" | "veto">("all");
  const [filterField, setFilterField] = useState<string>("all");
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [filterRuleSearch, setFilterRuleSearch] = useState("");

  const loadHistoryOptions = async (m: Modo) => {
    const { data } = await supabase
      .from("mycroft_rules_history" as any)
      .select("id,created_at,changed_by_email,operation,new_data,old_data")
      .eq("table_name", "mycroft_rules")
      .eq("modo", m)
      .order("created_at", { ascending: false })
      .limit(100);
    setHistoryOptions(((data ?? []) as any[]).map((h) => ({
      id: h.id,
      created_at: h.created_at,
      changed_by_email: h.changed_by_email,
      operation: h.operation,
      rule_name: h.new_data?.name ?? h.old_data?.name ?? "—",
    })));
  };

  useEffect(() => { loadHistoryOptions(modo); setSelectedHistoryIds([]); }, [modo]);

  const loadThresholds = async () => {
    const { data } = await supabase.from("mycroft_alert_thresholds" as any).select("*");
    if (data) setThresholds(data as any);
  };

  const checkAlerts = async () => {
    const list: Array<{ modo: Modo; pct: number; samples: number; threshold: number }> = [];
    const { data: ths } = await supabase.from("mycroft_alert_thresholds" as any).select("*").eq("active", true);
    for (const t of (ths ?? []) as any[]) {
      const since = new Date(Date.now() - t.window_hours * 3600_000).toISOString();
      const { data: rows } = await supabase
        .from("analises_comparativas" as any)
        .select("verdicto_atual,verdicto_novo")
        .eq("modo", t.modo)
        .gte("created_at", since)
        .limit(2000);
      const arr = (rows ?? []) as any[];
      if (arr.length < t.min_samples) continue;
      const div = arr.filter((r) => (r.verdicto_atual === "APROVADO") !== (r.verdicto_novo === "APROVADO")).length;
      const pct = (100 * div) / arr.length;
      if (pct > t.divergence_threshold_pct) {
        list.push({ modo: t.modo, pct: +pct.toFixed(1), samples: arr.length, threshold: t.divergence_threshold_pct });
      }
    }
    setAlerts(list);
  };

  useEffect(() => { loadThresholds(); checkAlerts(); }, []);

  const updateThreshold = async (modo: Modo, patch: Partial<Threshold>) => {
    const { error } = await supabase.from("mycroft_alert_thresholds" as any).update(patch).eq("modo", modo);
    if (error) toast.error("Erro ao salvar limiar");
    else { toast.success("Limiar atualizado"); loadThresholds(); checkAlerts(); }
  };

  const runSimulation = async (overrideRules?: any[]) => {
    setRunning(true);
    setResult(null);
    try {
      const body: any = { modo, sample_size: sampleSize, window_hours: windowHours, mercado_filter: mercadoFilter || undefined };
      if (overrideRules && overrideRules.length > 0) {
        body.override_rules = overrideRules;
      } else if (rulesSourceMode === "history_at" && historyAt) {
        body.history_at = new Date(historyAt).toISOString();
      } else if (rulesSourceMode === "history_versions" && selectedHistoryIds.length > 0) {
        body.history_version_ids = selectedHistoryIds;
      }
      const { data, error } = await supabase.functions.invoke("simulate-mycroft-rules", { body });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha");
      if (data.total === 0) toast.warning("Sem cenários no período. Aumente a janela.");
      setResult(data);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  const rerunWithFilteredRules = async () => {
    const { data, error } = await supabase
      .from("mycroft_rules" as any)
      .select("*")
      .eq("modo", modo)
      .eq("active", true);
    if (error) { toast.error("Erro ao carregar regras"); return; }
    const filtered = ((data ?? []) as any[]).filter((r) => {
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      if (filterField !== "all" && r.field !== filterField) return false;
      if (filterOperator !== "all" && r.operator !== filterOperator) return false;
      if (filterRuleSearch && !r.name.toLowerCase().includes(filterRuleSearch.toLowerCase())) return false;
      return true;
    });
    if (filtered.length === 0) { toast.warning("Nenhuma regra após filtros."); return; }
    toast.info(`Re-rodando com ${filtered.length} regras filtradas…`);
    await runSimulation(filtered);
  };

  const filteredRanking = useMemo(() => {
    if (!result?.rule_ranking) return [];
    return result.rule_ranking.filter((r) => {
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      if (filterField !== "all" && r.field !== filterField) return false;
      if (filterOperator !== "all" && r.op !== filterOperator) return false;
      if (filterRuleSearch && !r.rule.toLowerCase().includes(filterRuleSearch.toLowerCase())) return false;
      return true;
    });
  }, [result, filterCategory, filterField, filterOperator, filterRuleSearch]);

  const availableFields = useMemo(() => {
    const set = new Set<string>();
    result?.rule_ranking?.forEach((r) => set.add(r.field));
    return Array.from(set).sort();
  }, [result]);

  const availableOps = useMemo(() => {
    const set = new Set<string>();
    result?.rule_ranking?.forEach((r) => set.add(r.op));
    return Array.from(set).sort();
  }, [result]);

  const clearFilters = () => {
    setFilterCategory("all"); setFilterField("all"); setFilterOperator("all"); setFilterRuleSearch("");
  };

  const hasFilters = filterCategory !== "all" || filterField !== "all" || filterOperator !== "all" || !!filterRuleSearch;

  const winDelta = useMemo(() => {
    if (!result?.winrate.novo_winrate || !result?.winrate.atual_winrate) return null;
    return +(result.winrate.novo_winrate - result.winrate.atual_winrate).toFixed(2);
  }, [result]);

  return (
    <div className="space-y-6">
      {/* ALERTAS */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Alert key={a.modo} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Divergência alta no modo {a.modo.toUpperCase()}</AlertTitle>
              <AlertDescription>
                Motor novo divergiu em <strong>{a.pct}%</strong> dos casos (limiar: {a.threshold}%) sobre {a.samples} amostras recentes. Revise as regras antes de migrar.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* THRESHOLDS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Limiares de alerta de divergência</CardTitle>
            <Button size="sm" variant="outline" onClick={checkAlerts}><RefreshCw className="h-4 w-4 mr-1" />Recalcular</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {thresholds.map((t) => (
            <div key={t.modo} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t.modo.toUpperCase()}</Badge>
                  <span className="text-sm font-medium">Alerta quando divergência &gt; {t.divergence_threshold_pct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Ativo</Label>
                  <Switch checked={t.active} onCheckedChange={(v) => updateThreshold(t.modo, { active: v })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between"><Label>Limiar (%)</Label><span className="font-mono">{t.divergence_threshold_pct}</span></div>
                  <Slider min={5} max={80} step={1} value={[t.divergence_threshold_pct]} onValueChange={(v) => setThresholds((p) => p.map((x) => x.modo === t.modo ? { ...x, divergence_threshold_pct: v[0] } : x))} onValueCommit={(v) => updateThreshold(t.modo, { divergence_threshold_pct: v[0] })} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label>Janela (h)</Label><span className="font-mono">{t.window_hours}</span></div>
                  <Slider min={1} max={168} step={1} value={[t.window_hours]} onValueChange={(v) => setThresholds((p) => p.map((x) => x.modo === t.modo ? { ...x, window_hours: v[0] } : x))} onValueCommit={(v) => updateThreshold(t.modo, { window_hours: v[0] })} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label>Mín. amostras</Label><span className="font-mono">{t.min_samples}</span></div>
                  <Slider min={5} max={200} step={1} value={[t.min_samples]} onValueChange={(v) => setThresholds((p) => p.map((x) => x.modo === t.modo ? { ...x, min_samples: v[0] } : x))} onValueCommit={(v) => updateThreshold(t.modo, { min_samples: v[0] })} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SIMULADOR */}
      <Card>
        <CardHeader>
          <CardTitle>Simulador de regras (cenários históricos)</CardTitle>
          <p className="text-sm text-muted-foreground">Roda as regras ATIVAS atuais contra snapshots já capturados em <code>analises_comparativas</code> para prever a distribuição de veredictos antes de migrar.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Modo</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
                <option value="trader">Trader</option>
                <option value="punter">Punter</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Tamanho da amostra (máx 1000)</Label>
              <Input type="number" min={10} max={1000} value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Janela (horas)</Label>
              <Input type="number" min={1} max={720} value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Mercado (filtro opcional)</Label>
              <Input placeholder="ex: over 2.5" value={mercadoFilter} onChange={(e) => setMercadoFilter(e.target.value)} />
            </div>
          </div>

          {/* FONTE DE REGRAS */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Fonte das regras</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant={rulesSourceMode === "current" ? "default" : "outline"} onClick={() => setRulesSourceMode("current")}>Regras ativas (atual)</Button>
              <Button size="sm" variant={rulesSourceMode === "history_at" ? "default" : "outline"} onClick={() => setRulesSourceMode("history_at")}>Snapshot por data</Button>
              <Button size="sm" variant={rulesSourceMode === "history_versions" ? "default" : "outline"} onClick={() => setRulesSourceMode("history_versions")}>Versões específicas</Button>
            </div>
            {rulesSourceMode === "history_at" && (
              <div>
                <Label className="text-xs">Reconstruir estado em</Label>
                <Input type="datetime-local" value={historyAt} onChange={(e) => setHistoryAt(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">Aplica todas as alterações registradas até esta data.</p>
              </div>
            )}
            {rulesSourceMode === "history_versions" && (
              <div className="space-y-2">
                <Label className="text-xs">Selecione versões ({selectedHistoryIds.length} marcadas)</Label>
                <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1 bg-background">
                  {historyOptions.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico para este modo.</p>}
                  {historyOptions.map((h) => (
                    <label key={h.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.includes(h.id)}
                        onChange={(e) => setSelectedHistoryIds((p) => e.target.checked ? [...p, h.id] : p.filter((x) => x !== h.id))}
                      />
                      <Badge variant="outline" className="text-[10px]">{h.operation}</Badge>
                      <span className="font-medium">{h.rule_name}</span>
                      <span className="text-muted-foreground ml-auto">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      <span className="text-muted-foreground">{h.changed_by_email ?? "—"}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => runSimulation()} disabled={running || (rulesSourceMode === "history_at" && !historyAt) || (rulesSourceMode === "history_versions" && selectedHistoryIds.length === 0)}>
            <Play className="h-4 w-4 mr-2" />{running ? "Rodando…" : "Rodar simulação"}
          </Button>
          {result?.rules_source && (
            <p className="text-[11px] text-muted-foreground">Fonte usada: <code>{result.rules_source}</code> · {result.rules_count} regras</p>
          )}

          {result && result.total > 0 && (
            <div className="space-y-4 pt-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-xs text-muted-foreground">cenários avaliados</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className={`text-2xl font-bold ${result.divergencia_pct > 30 ? "text-destructive" : "text-foreground"}`}>{result.divergencia_pct}%</div>
                  <div className="text-xs text-muted-foreground">divergência (APROVADO atual ≠ novo)</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-lg font-semibold text-green-500">+{result.novos_aprovou_atual_nao}</div>
                  <div className="text-xs text-muted-foreground">novos entradas que o atual não daria</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-lg font-semibold text-destructive">−{result.atual_aprovou_novo_nao}</div>
                  <div className="text-xs text-muted-foreground">entradas atuais que o novo veta</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DistBar dist={result.dist_atual} total={result.total} label="Distribuição — motor ATUAL" />
                <DistBar dist={result.dist_novo} total={result.total} label="Distribuição — motor NOVO" />
              </div>

              {result.winrate.total_settled > 0 && (
                <div className="border rounded-lg p-3 grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Atual winrate</div>
                    <div className="font-bold">{result.winrate.atual_winrate ?? "—"}% ({result.winrate.atual_aprovou} entradas)</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Novo winrate</div>
                    <div className="font-bold">{result.winrate.novo_winrate ?? "—"}% ({result.winrate.novo_aprovou} entradas)</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Delta</div>
                    <div className={`font-bold flex items-center justify-center gap-1 ${winDelta != null && winDelta > 0 ? "text-green-500" : winDelta != null && winDelta < 0 ? "text-destructive" : ""}`}>
                      {winDelta != null && winDelta > 0 && <TrendingUp className="h-4 w-4" />}
                      {winDelta != null && winDelta < 0 && <TrendingDown className="h-4 w-4" />}
                      {winDelta != null ? `${winDelta > 0 ? "+" : ""}${winDelta}pp` : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* RANKING DE REGRAS DIVERGENTES */}
              {result.rule_ranking && result.rule_ranking.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">Regras que mais contribuíram para divergências</h4>
                      <p className="text-xs text-muted-foreground">Mostrando <strong>{filteredRanking.length}</strong> de {result.rule_ranking.length} regras. Filtre e re-rode com somente as regras filtradas para isolar impacto.</p>
                    </div>
                    <Button size="sm" variant="default" onClick={rerunWithFilteredRules} disabled={running || !hasFilters}>
                      <Play className="h-3 w-3 mr-1" />Re-rodar só com regras filtradas
                    </Button>
                  </div>

                  {/* FILTROS DO RANKING */}
                  <div className="border rounded-lg p-3 mb-3 bg-muted/20 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                    <div>
                      <Label className="text-[11px] flex items-center gap-1"><Filter className="h-3 w-3" />Categoria</Label>
                      <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="pontuacao">Pontuação</SelectItem>
                          <SelectItem value="veto">Veto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">Field</Label>
                      <Select value={filterField} onValueChange={setFilterField}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {availableFields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">Operador</Label>
                      <Select value={filterOperator} onValueChange={setFilterOperator}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {availableOps.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">Buscar regra</Label>
                      <Input className="h-8 text-xs" placeholder="nome contém…" value={filterRuleSearch} onChange={(e) => setFilterRuleSearch(e.target.value)} />
                    </div>
                    <Button size="sm" variant="outline" onClick={clearFilters} disabled={!hasFilters} className="h-8">
                      <X className="h-3 w-3 mr-1" />Limpar
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Regra</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Condição</TableHead>
                        <TableHead className="text-right">Hits</TableHead>
                        <TableHead className="text-right">Em divergência</TableHead>
                        <TableHead className="text-right">% impacto</TableHead>
                        <TableHead className="text-right">→ APROVADO</TableHead>
                        <TableHead className="text-right">← APROVADO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRanking.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">Nenhuma regra corresponde aos filtros.</TableCell></TableRow>
                      )}
                      {filteredRanking.map((r) => (
                        <TableRow key={r.rule}>
                          <TableCell className="text-xs font-medium">{r.rule}</TableCell>
                          <TableCell>
                            <Badge variant={r.category === "veto" ? "destructive" : "secondary"} className="text-[10px]">
                              {r.category === "veto" ? "VETO" : `+${r.points ?? 0}pts`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{r.field} {r.op} {r.value}</TableCell>
                          <TableCell className="text-right text-xs">{r.hits_total}</TableCell>
                          <TableCell className="text-right text-xs font-bold">{r.hits_div}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={r.impacto_pct > 50 ? "bg-destructive/15 text-destructive border-destructive/30" : r.impacto_pct > 25 ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" : ""}>
                              {r.impacto_pct}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-green-500">+{r.flips_to_aprovado}</TableCell>
                          <TableCell className="text-right text-xs text-destructive">−{r.flips_from_aprovado}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4">
                    <MycroftRulesImpactChart ranking={filteredRanking} />
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">Amostras (primeiros 30)</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jogo</TableHead>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Atual</TableHead>
                      <TableHead>Novo</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Real</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.samples.map((s, i) => (
                      <TableRow key={i} className={s.divergente ? "bg-yellow-500/5" : ""}>
                        <TableCell className="text-xs">{s.home} vs {s.away}</TableCell>
                        <TableCell className="text-xs font-mono">{s.mercado}</TableCell>
                        <TableCell><Badge variant="outline" className={STATUS_COLORS[s.verdicto_atual] ?? ""}>{s.verdicto_atual}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={STATUS_COLORS[s.verdicto_novo] ?? ""}>{s.verdicto_novo}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{s.score_novo}</TableCell>
                        <TableCell className="text-xs">{s.resultado_real ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result && result.total === 0 && (
            <Alert>
              <AlertDescription>Sem cenários encontrados nesta janela. Aumente o intervalo ou aguarde mais shadow logs.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
