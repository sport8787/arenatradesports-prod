import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  analysis_id: string;
  match_id: string | null;
  field_name: string;
  old_value: string | null;
  attempted_value: string | null;
  source: string | null;
  created_at: string;
};

const STORAGE_KEY = "admin_seen_snapshot_violation";

export default function ApprovalSnapshotViolations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("approval_snapshot_violations" as any)
      .select("*")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setRows(data as unknown as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
    const t = setInterval(fetchRows, 60_000);
    return () => clearInterval(t);
  }, [fetchRows]);

  // Realtime: alerta imediato em nova violação
  useEffect(() => {
    const ch = supabase
      .channel("admin-snapshot-violations")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "approval_snapshot_violations" },
        (payload) => {
          const row = payload.new as Row;
          const lastSeen = localStorage.getItem(STORAGE_KEY);
          if (lastSeen === row.id) return;
          localStorage.setItem(STORAGE_KEY, row.id);
          toast.warning(`🔒 Imutabilidade violada: ${row.field_name}`, {
            description: `Tentativa bloqueada na análise ${row.analysis_id.slice(0, 8)}…`,
            duration: 8000,
          });
          fetchRows();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchRows]);

  const total24h = rows.length;
  const uniqueAnalyses = new Set(rows.map((r) => r.analysis_id)).size;

  return (
    <Card className={total24h > 0 ? "border-amber-500/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Violações de Imutabilidade (Snapshot de Aprovação)
            <Badge variant="outline" className="ml-2">
              {total24h} tentativas / 24h
            </Badge>
            {uniqueAnalyses > 0 && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                {uniqueAnalyses} análises afetadas
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {total24h === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Lock className="w-3.5 h-3.5 text-emerald-500/80" />
            ✅ Nenhuma tentativa de alteração nos campos imutáveis nas últimas 24h.
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 divide-y divide-amber-500/10 max-h-80 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono">
                      {r.field_name}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {r.analysis_id.slice(0, 8)}…
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-muted-foreground font-mono break-all">
                  <span className="text-emerald-400">old:</span> {r.old_value ?? "∅"}
                  {"  →  "}
                  <span className="text-destructive">tried:</span> {r.attempted_value ?? "∅"}
                </div>
                {r.match_id && (
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    match_id: {r.match_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
