import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Beaker, Plus, Pause, Play, Trophy, X } from "lucide-react";
import { toast } from "sonner";

type Experiment = {
  id: string;
  name: string;
  hypothesis: string | null;
  scope: string;
  variant_a_config: any;
  variant_b_config: any;
  status: "draft" | "running" | "paused" | "promoted" | "discarded";
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
};

type Metrics = Record<string, any>;

export default function AdminAbLab() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [list, setList] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Experiment | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [divergences, setDivergences] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);

  // Form Novo
  const [fName, setFName] = useState("");
  const [fScope, setFScope] = useState("punter");
  const [fHypo, setFHypo] = useState("");
  const [fA, setFA] = useState('{\n  "provider": "groq",\n  "model": "llama-3.3-70b-versatile"\n}');
  const [fB, setFB] = useState('{\n  "provider": "gemini",\n  "model": "gemini-2.5-flash"\n}');

  useEffect(() => {
    if (isAdmin) loadList();
  }, [isAdmin]);

  async function loadList() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ab_experiments" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar experimentos: " + error.message);
    setList((data as any) || []);
    setLoading(false);
  }

  async function openExperiment(exp: Experiment) {
    setSelected(exp);
    setMetrics(null);
    setDivergences([]);
    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.rpc("ab_compute_metrics" as any, { _experiment_id: exp.id }),
      supabase.rpc("ab_list_divergences" as any, { _experiment_id: exp.id }),
    ]);
    setMetrics((m as any) || {});
    setDivergences((d as any) || []);
  }

  async function createExperiment() {
    if (!fName.trim()) {
      toast.error("Dê um nome ao experimento.");
      return;
    }
    let pa, pb;
    try { pa = JSON.parse(fA); } catch { toast.error("JSON inválido em Variante A"); return; }
    try { pb = JSON.parse(fB); } catch { toast.error("JSON inválido em Variante B"); return; }
    const { error } = await supabase.from("ab_experiments" as any).insert({
      name: fName.trim(),
      hypothesis: fHypo.trim() || null,
      scope: fScope,
      variant_a_config: pa,
      variant_b_config: pb,
      status: "draft",
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Experimento criado.");
    setShowNew(false);
    setFName(""); setFHypo("");
    loadList();
  }

  async function setStatus(exp: Experiment, status: Experiment["status"]) {
    const patch: any = { status };
    if (status === "running" && !exp.started_at) patch.started_at = new Date().toISOString();
    if (["promoted", "discarded"].includes(status)) patch.ended_at = new Date().toISOString();
    const { error } = await supabase.from("ab_experiments" as any).update(patch).eq("id", exp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status: ${status}`);
    loadList();
    if (selected?.id === exp.id) setSelected({ ...exp, ...patch });
  }

  const runningCount = useMemo(() => list.filter(e => e.status === "running").length, [list]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?redirect=/admin/ab-lab" replace />;
  if (!isAdmin) return <Navigate to="/punter" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Beaker className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">A/B Lab</h1>
              <p className="text-sm text-muted-foreground">
                Teste mudanças (provider, prompt, regra) em paralelo antes de promover ao global. {runningCount} rodando.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/hub">← Hub Admin</a>
            </Button>
            <Button size="sm" onClick={() => setShowNew(v => !v)}>
              <Plus className="w-4 h-4 mr-1" /> Novo Experimento
            </Button>
          </div>
        </div>

        {showNew && (
          <Card>
            <CardHeader><CardTitle>Novo experimento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="ex: Groq vs Gemini Punter" />
                </div>
                <div>
                  <Label>Escopo</Label>
                  <Select value={fScope} onValueChange={setFScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="punter">Punter</SelectItem>
                      <SelectItem value="trader">Trader Sports</SelectItem>
                      <SelectItem value="chats">Chats</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Hipótese</Label>
                <Textarea value={fHypo} onChange={e => setFHypo(e.target.value)} placeholder="O que você espera provar?" rows={2} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Variante A (config JSON)</Label>
                  <Textarea className="font-mono text-xs" rows={8} value={fA} onChange={e => setFA(e.target.value)} />
                </div>
                <div>
                  <Label>Variante B (config JSON)</Label>
                  <Textarea className="font-mono text-xs" rows={8} value={fB} onChange={e => setFB(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
                <Button onClick={createExperiment}>Criar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Experimentos</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum experimento ainda. Clique em "Novo Experimento".</p>
            ) : (
              <div className="space-y-2">
                {list.map(exp => (
                  <div
                    key={exp.id}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-muted/50 ${selected?.id === exp.id ? "bg-muted/40 border-primary" : ""}`}
                    onClick={() => openExperiment(exp)}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-semibold">{exp.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {exp.scope} · criado {new Date(exp.created_at).toLocaleDateString("pt-BR")}
                          {exp.hypothesis ? ` · ${exp.hypothesis}` : ""}
                        </div>
                      </div>
                      <Badge variant={
                        exp.status === "running" ? "default" :
                        exp.status === "promoted" ? "secondary" :
                        exp.status === "discarded" ? "destructive" : "outline"
                      }>{exp.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>{selected.name}</CardTitle>
                <div className="flex gap-2">
                  {selected.status !== "running" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(selected, "running")}>
                      <Play className="w-4 h-4 mr-1" /> Rodar
                    </Button>
                  )}
                  {selected.status === "running" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(selected, "paused")}>
                      <Pause className="w-4 h-4 mr-1" /> Pausar
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setStatus(selected, "promoted")}>
                    <Trophy className="w-4 h-4 mr-1" /> Promover B → Global
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setStatus(selected, "discarded")}>
                    <X className="w-4 h-4 mr-1" /> Descartar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                {(["A", "B"] as const).map(v => {
                  const cfg = v === "A" ? selected.variant_a_config : selected.variant_b_config;
                  const m = metrics?.[v];
                  return (
                    <div key={v} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Variante {v}</div>
                        <Badge variant="outline">{m?.total ?? 0} decisões</Badge>
                      </div>
                      <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto mb-2">{JSON.stringify(cfg, null, 2)}</pre>
                      {m ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <Stat label="Aprovados" value={m.approved} />
                          <Stat label="GREEN %" value={m.green_pct != null ? `${m.green_pct}%` : "—"} />
                          <Stat label="ROI %" value={m.roi_pct != null ? `${m.roi_pct}%` : "—"} />
                          <Stat label="Stake médio" value={m.avg_stake} />
                          <Stat label="Prob média" value={m.avg_prob} />
                          <Stat label="Edge médio" value={m.avg_edge} />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem decisões ainda.</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {metrics && (
                <div className="text-xs text-muted-foreground">
                  χ² = {metrics.chi_square ?? "—"} · p-value ≈ {metrics.p_value_approx ?? "—"} · mínimo recomendado por variante: {metrics.min_recommended_per_variant}
                </div>
              )}

              <div>
                <div className="font-semibold mb-2">Divergências A vs B</div>
                {divergences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem divergências registradas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left p-1">Jogo</th>
                          <th className="text-left p-1">Mercado</th>
                          <th className="text-left p-1">A</th>
                          <th className="text-left p-1">B</th>
                          <th className="text-left p-1">A Result</th>
                          <th className="text-left p-1">B Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divergences.map((d, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="p-1">{d.match_id}</td>
                            <td className="p-1">{d.market}</td>
                            <td className="p-1">{d.a_verdict}</td>
                            <td className="p-1">{d.b_verdict}</td>
                            <td className="p-1">{d.a_result ?? "—"}</td>
                            <td className="p-1">{d.b_result ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{String(value ?? "—")}</span>
    </div>
  );
}
