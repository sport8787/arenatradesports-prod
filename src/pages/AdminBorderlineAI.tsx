import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ShieldX, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Row {
  id: string;
  created_at: string;
  match_id: string;
  home_team: string | null;
  away_team: string | null;
  league: string | null;
  minute: number | null;
  market: string | null;
  original_verdict: string;
  original_confidence: number | null;
  ai_decision: string;
  ai_reason: string | null;
  ai_confidence_adjustment: number | null;
  final_verdict: string;
  final_confidence: number | null;
  ai_model: string | null;
  latency_ms: number | null;
  outcome: string | null;
}

export default function AdminBorderlineAI() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<boolean>(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("borderline_ai_validations" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as any) || []);
    const { data: kill } = await supabase
      .from("cron_settings")
      .select("is_enabled")
      .eq("setting_key", "borderline_ai_validator")
      .maybeSingle();
    setEnabled(kill?.is_enabled ?? true);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleKill = async (next: boolean) => {
    setEnabled(next);
    const { error } = await supabase
      .from("cron_settings")
      .update({ is_enabled: next })
      .eq("setting_key", "borderline_ai_validator");
    if (error) toast.error("Falha ao atualizar kill switch");
    else toast.success(next ? "Validador IA LIGADO" : "Validador IA DESLIGADO");
  };

  const total = rows.length;
  const confirma = rows.filter((r) => r.ai_decision === "CONFIRMA").length;
  const veta = rows.filter((r) => r.ai_decision === "VETA").length;
  const erros = rows.filter((r) => r.ai_decision === "ERROR").length;
  const taxaVeto = total ? ((veta / total) * 100).toFixed(1) : "0";
  const avgLatency = total
    ? Math.round(rows.reduce((s, r) => s + (r.latency_ms || 0), 0) / total)
    : 0;

  const decisionBadge = (d: string) => {
    if (d === "CONFIRMA") return <Badge className="bg-success/20 text-success border-success/40"><ShieldCheck className="h-3 w-3 mr-1" />CONFIRMA</Badge>;
    if (d === "VETA") return <Badge className="bg-destructive/20 text-destructive border-destructive/40"><ShieldX className="h-3 w-3 mr-1" />VETA</Badge>;
    return <Badge variant="outline" className="text-warning border-warning/40"><AlertTriangle className="h-3 w-3 mr-1" />{d}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao AdminHub
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Validador ativo</span>
          <Switch checked={enabled} onCheckedChange={toggleKill} />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Camada 2 — Validador IA Borderline</h1>
        <p className="text-sm text-muted-foreground">
          Gemini revisa entradas ao vivo com confiança matemática 55-65% e decide CONFIRMA ou VETA. Fail-open em erro.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-success">Confirma</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">{confirma}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-destructive">Veta</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{veta}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-warning">Erro/Skip</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-warning">{erros}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">% Veto · Latência</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{taxaVeto}% · {avgLatency}ms</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimas 200 validações</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma validação ainda. Aguarde entradas borderline ao vivo.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-left p-2">Jogo</th>
                    <th className="text-left p-2">Mercado</th>
                    <th className="text-left p-2">Original</th>
                    <th className="text-left p-2">IA</th>
                    <th className="text-left p-2">Final</th>
                    <th className="text-left p-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="p-2 text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2">
                        <div className="font-medium">{r.home_team} x {r.away_team}</div>
                        <div className="text-xs text-muted-foreground">{r.league} · {r.minute}'</div>
                      </td>
                      <td className="p-2">{r.market}</td>
                      <td className="p-2">
                        <div className="font-medium">{r.original_verdict}</div>
                        <div className="text-xs text-muted-foreground">{Number(r.original_confidence ?? 0).toFixed(0)}%</div>
                      </td>
                      <td className="p-2">{decisionBadge(r.ai_decision)}{r.ai_confidence_adjustment ? <span className="ml-1 text-xs">{r.ai_confidence_adjustment > 0 ? "+" : ""}{r.ai_confidence_adjustment}pp</span> : null}</td>
                      <td className="p-2">
                        <div className="font-medium">{r.final_verdict}</div>
                        <div className="text-xs text-muted-foreground">{Number(r.final_confidence ?? 0).toFixed(0)}%</div>
                      </td>
                      <td className="p-2 max-w-md text-xs text-muted-foreground">{r.ai_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
