import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, ArrowLeft, RefreshCw, History, AlertTriangle, FlaskConical } from "lucide-react";
import { MycroftRulesAuditTab } from "@/components/admin/MycroftRulesAuditTab";
import { MycroftRulesSimulatorTab } from "@/components/admin/MycroftRulesSimulatorTab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Modo = "trader" | "punter";

interface Rule {
  id: string;
  modo: Modo;
  name: string;
  category: "pontuacao" | "veto";
  field: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "!=";
  value: number;
  points: number | null;
  priority: number;
  mercado: string | null;
  time_start: number | null;
  time_end: number | null;
  active: boolean;
}

interface ConfigState {
  score_minimo_aprovar: number;
  score_minimo_cuidado: number;
  stake_min_percent: number;
  stake_max_percent: number;
  odd_minima: number;
  odd_maxima: number;
  tempo_minimo_analise: number;
}

const DEFAULT_CONFIG: ConfigState = {
  score_minimo_aprovar: 70,
  score_minimo_cuidado: 50,
  stake_min_percent: 2,
  stake_max_percent: 5,
  odd_minima: 1.5,
  odd_maxima: 3.0,
  tempo_minimo_analise: 10,
};

const CONFIG_LABELS: Record<keyof ConfigState, { label: string; min: number; max: number; step: number }> = {
  score_minimo_aprovar: { label: "Score mínimo APROVADO", min: 0, max: 100, step: 1 },
  score_minimo_cuidado: { label: "Score mínimo CUIDADO", min: 0, max: 100, step: 1 },
  stake_min_percent: { label: "Stake mínimo (%)", min: 0.5, max: 10, step: 0.5 },
  stake_max_percent: { label: "Stake máximo (%)", min: 1, max: 15, step: 0.5 },
  odd_minima: { label: "Odd mínima", min: 1.1, max: 5, step: 0.05 },
  odd_maxima: { label: "Odd máxima", min: 1.5, max: 10, step: 0.05 },
  tempo_minimo_analise: { label: "Minuto mínimo de análise", min: 0, max: 45, step: 1 },
};

export default function AdminMycroftRules() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [modo, setModo] = useState<Modo>("trader");
  const [rules, setRules] = useState<Rule[]>([]);
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [shadowReport, setShadowReport] = useState<any[]>([]);
  const [globalAlerts, setGlobalAlerts] = useState<Array<{ modo: string; pct: number; samples: number; threshold: number }>>([]);

  async function loadGlobalAlerts() {
    const list: Array<{ modo: string; pct: number; samples: number; threshold: number }> = [];
    const { data: ths } = await supabase.from("mycroft_alert_thresholds" as any).select("*").eq("active", true);
    for (const t of (ths ?? []) as any[]) {
      const since = new Date(Date.now() - t.window_hours * 3600_000).toISOString();
      const { data: rows } = await supabase
        .from("analises_comparativas" as any)
        .select("verdicto_atual,verdicto_novo")
        .eq("modo", t.modo).gte("created_at", since).limit(2000);
      const arr = (rows ?? []) as any[];
      if (arr.length < t.min_samples) continue;
      const div = arr.filter((r) => (r.verdicto_atual === "APROVADO") !== (r.verdicto_novo === "APROVADO")).length;
      const pct = (100 * div) / arr.length;
      if (pct > t.divergence_threshold_pct) list.push({ modo: t.modo, pct: +pct.toFixed(1), samples: arr.length, threshold: t.divergence_threshold_pct });
    }
    setGlobalAlerts(list);
  }
  useEffect(() => { if (isAdmin) loadGlobalAlerts(); }, [isAdmin]);

  useEffect(() => {
    if (!adminLoading && isAdmin) loadAll();
  }, [modo, isAdmin, adminLoading]);

  async function loadAll() {
    setLoading(true);
    const [r, c, sr] = await Promise.all([
      supabase.from("mycroft_rules").select("*").eq("modo", modo).order("priority", { ascending: false }),
      supabase.from("mycroft_config").select("key,value").eq("modo", modo),
      supabase.from("analises_comparativas").select("mercado,verdicto_atual,verdicto_novo,resultado_real").eq("modo", modo).not("resultado_real", "is", null).limit(2000),
    ]);
    setRules((r.data ?? []) as Rule[]);
    const cfg = { ...DEFAULT_CONFIG };
    (c.data ?? []).forEach((row: any) => {
      if (row.key in cfg) (cfg as any)[row.key] = Number(row.value);
    });
    setConfig(cfg);
    setShadowReport(buildReport(sr.data ?? []));
    setLoading(false);
  }

  function buildReport(rows: any[]) {
    const map = new Map<string, { mercado: string; total: number; atual_green: number; novo_green: number; novo_aprovou: number }>();
    for (const r of rows) {
      const key = (r.mercado || "—").toLowerCase();
      const e = map.get(key) ?? { mercado: r.mercado || "—", total: 0, atual_green: 0, novo_green: 0, novo_aprovou: 0 };
      e.total++;
      if (r.resultado_real === "GREEN") {
        if (String(r.verdicto_atual ?? "").toUpperCase().startsWith("APROV")) e.atual_green++;
        if (String(r.verdicto_novo ?? "").toUpperCase().startsWith("APROV")) e.novo_green++;
      }
      if (String(r.verdicto_novo ?? "").toUpperCase().startsWith("APROV")) e.novo_aprovou++;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 30);
  }

  async function saveConfig(key: keyof ConfigState, value: number) {
    setConfig((p) => ({ ...p, [key]: value }));
    const { error } = await supabase.from("mycroft_config").upsert(
      { modo, key, value: String(value) },
      { onConflict: "modo,key" },
    );
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
  }

  async function saveRule(rule: Rule) {
    const { error } = await supabase.from("mycroft_rules").upsert(rule);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Regra salva" });
    loadAll();
  }

  async function deleteRule(id: string) {
    if (!confirm("Remover regra?")) return;
    await supabase.from("mycroft_rules").delete().eq("id", id);
    loadAll();
  }

  function addRule(category: "pontuacao" | "veto") {
    const newRule: Rule = {
      id: crypto.randomUUID(),
      modo,
      name: category === "veto" ? "Novo veto" : "Nova regra de pontuação",
      category,
      field: "xg_total",
      operator: ">=",
      value: 0,
      points: category === "veto" ? null : 10,
      priority: 50,
      mercado: null,
      time_start: null,
      time_end: null,
      active: true,
    };
    setRules((p) => [newRule, ...p]);
  }

  if (adminLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <div className="p-8 text-center text-destructive">Acesso restrito a administradores.</div>;

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Regras do Mycroft</h1>
            <p className="text-sm text-muted-foreground">Motor de regras dinâmico — Shadow mode ativo (não afeta produção)</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="h-4 w-4 mr-1" />Recarregar</Button>
      </div>

      {globalAlerts.length > 0 && (
        <div className="space-y-2">
          {globalAlerts.map((a) => (
            <Alert key={a.modo} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ Divergência Shadow alta — modo {a.modo.toUpperCase()}</AlertTitle>
              <AlertDescription>
                {a.pct}% das análises divergiram (limiar {a.threshold}% sobre {a.samples} amostras). Ajuste regras antes de migrar.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs value={modo} onValueChange={(v) => v !== "audit" && v !== "simulator" && setModo(v as Modo)}>
        <TabsList>
          <TabsTrigger value="trader">⚡ Trader (live)</TabsTrigger>
          <TabsTrigger value="punter">🎯 Punter (pré-live)</TabsTrigger>
          <TabsTrigger value="simulator"><FlaskConical className="h-4 w-4 mr-1" />Simulador</TabsTrigger>
          <TabsTrigger value="audit"><History className="h-4 w-4 mr-1" />Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="simulator">
          <MycroftRulesSimulatorTab />
        </TabsContent>

        <TabsContent value="audit">
          <MycroftRulesAuditTab />
        </TabsContent>

        <TabsContent value={modo} className="space-y-6">
          {/* CONFIG */}
          <Card>
            <CardHeader><CardTitle>Configurações gerais — {modo}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(CONFIG_LABELS) as (keyof ConfigState)[]).map((k) => {
                const meta = CONFIG_LABELS[k];
                return (
                  <div key={k} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>{meta.label}</Label>
                      <span className="font-mono">{config[k]}</span>
                    </div>
                    <Slider min={meta.min} max={meta.max} step={meta.step} value={[config[k]]} onValueChange={(v) => saveConfig(k, v[0])} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* REGRAS */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Regras ({rules.length})</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addRule("pontuacao")}><Plus className="h-4 w-4 mr-1" />Pontuação</Button>
                <Button size="sm" variant="destructive" onClick={() => addRule("veto")}><Plus className="h-4 w-4 mr-1" />Veto</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {!loading && rules.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>}
              {rules.map((rule, idx) => (
                <RuleEditor key={rule.id} rule={rule} onChange={(r) => setRules((p) => p.map((x, i) => i === idx ? r : x))} onSave={saveRule} onDelete={deleteRule} />
              ))}
            </CardContent>
          </Card>

          {/* SHADOW REPORT */}
          <Card>
            <CardHeader>
              <CardTitle>Relatório Shadow Mode (resultados liquidados)</CardTitle>
              <p className="text-sm text-muted-foreground">Comparação por mercado: motor atual vs motor novo (regras), em entradas com resultado real.</p>
            </CardHeader>
            <CardContent>
              {shadowReport.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem amostras liquidadas ainda. Aguarde GREEN/RED chegarem em <code>analises_comparativas</code>.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Atual GREEN</TableHead>
                      <TableHead className="text-right">Novo GREEN</TableHead>
                      <TableHead className="text-right">Novo aprovou</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shadowReport.map((r) => (
                      <TableRow key={r.mercado}>
                        <TableCell className="font-mono text-xs">{r.mercado}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right text-green-500">{r.atual_green}</TableCell>
                        <TableCell className="text-right text-green-500">{r.novo_green}</TableCell>
                        <TableCell className="text-right">{r.novo_aprovou}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RuleEditor({ rule, onChange, onSave, onDelete }: { rule: Rule; onChange: (r: Rule) => void; onSave: (r: Rule) => void; onDelete: (id: string) => void }) {
  const isVeto = rule.category === "veto";
  return (
    <div className={`p-3 rounded-lg border ${isVeto ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20"}`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <Input className="font-medium" value={rule.name} onChange={(e) => onChange({ ...rule, name: e.target.value })} />
        <Badge variant={isVeto ? "destructive" : "secondary"}>{isVeto ? "VETO" : "PONTUAÇÃO"}</Badge>
        <div className="flex items-center gap-1">
          <Switch checked={rule.active} onCheckedChange={(v) => onChange({ ...rule, active: v })} />
          <Button size="icon" variant="ghost" onClick={() => onSave(rule)}><Save className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(rule.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
        <div>
          <Label className="text-xs">Campo</Label>
          <Input value={rule.field} onChange={(e) => onChange({ ...rule, field: e.target.value })} placeholder="ex: xg_total" />
        </div>
        <div>
          <Label className="text-xs">Operador</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value as any })}>
            {[">", ">=", "<", "<=", "==", "!="].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Valor</Label>
          <Input type="number" step="0.01" value={rule.value} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })} />
        </div>
        {!isVeto && (
          <div>
            <Label className="text-xs">Pontos</Label>
            <Input type="number" value={rule.points ?? 0} onChange={(e) => onChange({ ...rule, points: Number(e.target.value) })} />
          </div>
        )}
        <div>
          <Label className="text-xs">Prioridade</Label>
          <Input type="number" value={rule.priority} onChange={(e) => onChange({ ...rule, priority: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Mercado (filtro)</Label>
          <Input value={rule.mercado ?? ""} onChange={(e) => onChange({ ...rule, mercado: e.target.value || null })} placeholder="todos" />
        </div>
        <div>
          <Label className="text-xs">Min início</Label>
          <Input type="number" value={rule.time_start ?? ""} onChange={(e) => onChange({ ...rule, time_start: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div>
          <Label className="text-xs">Min fim</Label>
          <Input type="number" value={rule.time_end ?? ""} onChange={(e) => onChange({ ...rule, time_end: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
    </div>
  );
}
