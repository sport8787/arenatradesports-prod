import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trophy, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

interface CopaGate {
  modo_copa: boolean;
  copa_start_date: string | null;
  copa_end_date: string | null;
  copa_config: any;
}

export default function AdminCopaMode() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [gate, setGate] = useState<CopaGate | null>(null);
  const [signalsToday, setSignalsToday] = useState(0);
  const [fixturesNext, setFixturesNext] = useState(0);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("punter_gate_config")
      .select("modo_copa, copa_start_date, copa_end_date, copa_config")
      .limit(1)
      .maybeSingle();
    setGate(data as any);

    const today = new Date().toISOString().slice(0, 10);
    const { count: sigCount } = await supabase
      .from("punter_copa_signals")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`);
    setSignalsToday(sigCount || 0);

    const horizon = new Date(Date.now() + 5 * 86400_000).toISOString();
    const { count: fxCount } = await supabase
      .from("copa_fixtures")
      .select("fixture_id", { count: "exact", head: true })
      .gte("commence_time", new Date().toISOString())
      .lte("commence_time", horizon);
    setFixturesNext(fxCount || 0);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (authLoading || adminLoading) return null;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/lobby" replace />;
  if (!gate) return <div className="p-6">Carregando…</div>;

  const cfg = gate.copa_config || {};

  async function save() {
    if (!gate) return;
    setSaving(true);
    const { error } = await supabase
      .from("punter_gate_config")
      .update({
        modo_copa: gate.modo_copa,
        copa_start_date: gate.copa_start_date,
        copa_end_date: gate.copa_end_date,
      })
      .gte("id", "00000000-0000-0000-0000-000000000000");
    setSaving(false);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Modo Copa atualizado"); load(); }
  }

  async function runNow(fn: string) {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke(fn, { body: {} });
    setRunning(false);
    if (error) toast.error(`${fn}: ${error.message}`);
    else { toast.success(`${fn} executado`); console.log(fn, data); load(); }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <Link to="/admin/hub" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Hub Admin
        </Link>
        <div className="flex items-center gap-2 text-primary">
          <Trophy className="h-5 w-5" />
          <h1 className="text-xl font-bold">Modo Copa do Mundo 2026</h1>
        </div>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-base">Toggle Global</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <div className="font-semibold">Modo Copa Ativo</div>
              <div className="text-xs text-muted-foreground">
                Substitui parâmetros globais por regras específicas da Copa.
              </div>
            </div>
            <Switch
              checked={gate.modo_copa}
              onCheckedChange={(v) => setGate({ ...gate, modo_copa: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Início</label>
              <Input
                type="date"
                value={gate.copa_start_date || ""}
                onChange={(e) => setGate({ ...gate, copa_start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fim (auto-desativa)</label>
              <Input
                type="date"
                value={gate.copa_end_date || ""}
                onChange={(e) => setGate({ ...gate, copa_end_date: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
          </Button>
        </CardContent>
      </Card>

      <div className="max-w-4xl mx-auto grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{signalsToday}</div>
            <div className="text-xs text-muted-foreground">Sinais Copa hoje</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{fixturesNext}</div>
            <div className="text-xs text-muted-foreground">Fixtures próximos 5 dias</div>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-base">Thresholds da Copa</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-80">
            {JSON.stringify(cfg, null, 2)}
          </pre>
          <div className="text-xs text-muted-foreground mt-2">
            Edição fina em <code>punter_gate_config.copa_config</code>.
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-base">Execução Manual</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={running}
            onClick={() => runNow("copa-fixtures-sync")}>
            <Play className="h-4 w-4 mr-2" />copa-fixtures-sync
          </Button>
          <Button variant="outline" disabled={running}
            onClick={() => runNow("mycroft-punter-copa")}>
            <Play className="h-4 w-4 mr-2" />mycroft-punter-copa
          </Button>
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardContent>
      </Card>
    </div>
  );
}
