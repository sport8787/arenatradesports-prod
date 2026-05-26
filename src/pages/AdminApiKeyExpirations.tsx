import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Bell } from "lucide-react";

interface ApiKeyExpiry {
  id: string;
  api_name: string;
  display_name: string;
  expires_at: string;
  plan_label: string | null;
  notes: string | null;
  enabled: boolean;
  updated_at: string;
}

function daysUntil(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const exp = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((exp - today) / 86400000);
}

function badgeForDays(n: number) {
  if (n < 0) return <Badge variant="destructive">Expirada há {Math.abs(n)}d</Badge>;
  if (n === 0) return <Badge variant="destructive">Vence HOJE</Badge>;
  if (n <= 3) return <Badge variant="destructive">{n}d</Badge>;
  if (n <= 7) return <Badge className="bg-amber-500 text-black hover:bg-amber-500">{n}d</Badge>;
  if (n <= 30) return <Badge className="bg-amber-500/40 text-amber-200 hover:bg-amber-500/40">{n}d</Badge>;
  return <Badge variant="secondary">{n}d</Badge>;
}

export default function AdminApiKeyExpirations() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ApiKeyExpiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ api_name: "", display_name: "", expires_at: "", plan_label: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_key_expirations")
      .select("*")
      .order("expires_at", { ascending: true });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setRows((data as ApiKeyExpiry[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateRow = async (id: string, patch: Partial<ApiKeyExpiry>) => {
    setSaving(id);
    const { error } = await supabase.from("api_key_expirations").update(patch).eq("id", id);
    setSaving(null);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salvo" });
    load();
  };

  const deleteRow = async (id: string, name: string) => {
    if (!confirm(`Remover ${name}?`)) return;
    const { error } = await supabase.from("api_key_expirations").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const create = async () => {
    if (!form.api_name || !form.display_name || !form.expires_at) {
      toast({ title: "Preencha api_name, display_name e data", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("api_key_expirations").insert({
      api_name: form.api_name.trim().toLowerCase(),
      display_name: form.display_name.trim(),
      expires_at: form.expires_at,
      plan_label: form.plan_label || null,
      notes: form.notes || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setForm({ api_name: "", display_name: "", expires_at: "", plan_label: "", notes: "" });
    load();
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("api-key-expiry-notify", { body: {} });
    setRunning(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Verificação executada", description: JSON.stringify(data) });
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vencimentos de chaves API</h1>
          <p className="text-sm text-muted-foreground">Push admin-only em 7, 3 e 1 dia antes do vencimento. Cron diário às 13h UTC.</p>
        </div>
        <Button onClick={runNow} disabled={running} variant="outline">
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
          Executar verificação agora
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Chaves cadastradas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const d = daysUntil(r.expires_at);
                return (
                  <div key={r.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.display_name}</span>
                        <code className="text-xs text-muted-foreground">{r.api_name}</code>
                        {badgeForDays(d)}
                        {r.plan_label && <Badge variant="outline">{r.plan_label}</Badge>}
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                    </div>
                    <Input
                      type="date"
                      defaultValue={r.expires_at}
                      className="w-full md:w-44"
                      onBlur={(e) => { if (e.target.value !== r.expires_at) updateRow(r.id, { expires_at: e.target.value }); }}
                    />
                    <div className="flex items-center gap-2">
                      <Switch checked={r.enabled} onCheckedChange={(v) => updateRow(r.id, { enabled: v })} disabled={saving === r.id} />
                      <span className="text-xs text-muted-foreground">{r.enabled ? "Ativa" : "Off"}</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteRow(r.id, r.display_name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma chave cadastrada.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Adicionar nova chave</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>api_name (slug único)</Label>
              <Input value={form.api_name} onChange={(e) => setForm({ ...form, api_name: e.target.value })} placeholder="ex: api_football" />
            </div>
            <div>
              <Label>Nome de exibição</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="ex: API-Football" />
            </div>
            <div>
              <Label>Data de vencimento</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div>
              <Label>Plano (opcional)</Label>
              <Input value={form.plan_label} onChange={(e) => setForm({ ...form, plan_label: e.target.value })} placeholder="ex: Anual, Trial, 20K/mês" />
            </div>
            <div className="md:col-span-2">
              <Label>Notas (opcional)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <Button onClick={create}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
