import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CreditCard, Bell, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type ErrorRow = {
  id: string;
  function_name: string;
  error_message: string;
  status_code: number | null;
  severity: string;
  created_at: string;
};

type FuncCount = {
  function_name: string;
  count: number;
  last_error_at: string;
  last_message: string;
  has_credit_issue: boolean;
};

const CREDIT_PATTERNS = [
  /credit/i,
  /quota/i,
  /rate.?limit/i,
  /402/,
  /429/,
  /insufficient/i,
  /esgotad/i,
  /limite/i,
  /payment required/i,
];

const isCreditIssue = (msg: string, code: number | null) => {
  if (code === 402 || code === 429) return true;
  return CREDIT_PATTERNS.some((p) => p.test(msg || ""));
};

const STORAGE_KEY = "admin_alert_threshold";

export default function EdgeFunctionAlerts() {
  const [threshold, setThreshold] = useState<number>(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Math.max(1, parseInt(v, 10)) : 5;
  });
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenIds] = useState<Set<string>>(new Set());

  const fetchErrors = useCallback(async () => {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("edge_function_errors")
      .select("id, function_name, error_message, status_code, severity, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setErrors(data as ErrorRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchErrors();
    const t = setInterval(fetchErrors, 60_000);
    return () => clearInterval(t);
  }, [fetchErrors]);

  // Realtime: novo erro → toast imediato se for crédito
  useEffect(() => {
    const ch = supabase
      .channel("admin-alerts-errors")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "edge_function_errors" },
        (payload) => {
          const row = payload.new as ErrorRow;
          if (seenIds.has(row.id)) return;
          seenIds.add(row.id);
          if (isCreditIssue(row.error_message, row.status_code)) {
            toast.error(`💳 Crédito/Quota: ${row.function_name}`, {
              description: row.error_message?.slice(0, 140),
              duration: 10_000,
            });
          }
          fetchErrors();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchErrors, seenIds]);

  // Agrupar por função na última hora
  const grouped: FuncCount[] = (() => {
    const map = new Map<string, FuncCount>();
    for (const e of errors) {
      if (e.severity === "warning") continue;
      const cur = map.get(e.function_name);
      const credit = isCreditIssue(e.error_message, e.status_code);
      if (cur) {
        cur.count += 1;
        if (credit) cur.has_credit_issue = true;
      } else {
        map.set(e.function_name, {
          function_name: e.function_name,
          count: 1,
          last_error_at: e.created_at,
          last_message: e.error_message,
          has_credit_issue: credit,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  const overThreshold = grouped.filter((g) => g.count >= threshold);
  const creditIssues = grouped.filter((g) => g.has_credit_issue);
  const totalLastHour = errors.length;

  // Toast quando funções cruzam o threshold (uma vez por função/sessão)
  const [warned] = useState<Set<string>>(new Set());
  useEffect(() => {
    for (const g of overThreshold) {
      const key = `${g.function_name}:${threshold}`;
      if (warned.has(key)) continue;
      warned.add(key);
      toast.warning(`⚠️ ${g.function_name}: ${g.count} falhas/h`, {
        description: `Acima do limite de ${threshold}.`,
        duration: 8000,
      });
    }
  }, [overThreshold, threshold, warned]);

  const saveThreshold = (n: number) => {
    const v = Math.max(1, Math.min(999, n || 1));
    setThreshold(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  };

  return (
    <Card className={overThreshold.length || creditIssues.length ? "border-destructive/60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alertas de Edge Functions
            <Badge variant="outline" className="ml-2">
              {totalLastHour} erros / 1h
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="thr" className="text-xs text-muted-foreground">
              Limite (falhas/h):
            </Label>
            <Input
              id="thr"
              type="number"
              min={1}
              max={999}
              value={threshold}
              onChange={(e) => saveThreshold(parseInt(e.target.value, 10))}
              className="h-8 w-20"
            />
            <Button size="sm" variant="outline" onClick={fetchErrors} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Link to="/admin/edge-errors">
              <Button size="sm" variant="ghost">
                Ver erros →
              </Button>
            </Link>
            <Link to="/admin/edge-status">
              <Button size="sm" variant="ghost">
                Status →
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Falhas por crédito */}
        {creditIssues.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-400 mb-2">
              <CreditCard className="w-4 h-4" />
              Falhas por crédito / quota da API
            </div>
            <div className="space-y-1.5">
              {creditIssues.map((g) => (
                <div key={g.function_name} className="text-xs flex items-center justify-between">
                  <span className="font-mono">{g.function_name}</span>
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                    {g.count}× / 1h
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acima do threshold */}
        {overThreshold.length > 0 ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
              <AlertTriangle className="w-4 h-4" />
              Funções acima do limite ({threshold}/h)
            </div>
            <div className="space-y-1.5">
              {overThreshold.map((g) => (
                <div key={g.function_name} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium">{g.function_name}</span>
                    <Badge variant="destructive">{g.count} falhas</Badge>
                  </div>
                  <div className="text-muted-foreground truncate mt-0.5">{g.last_message}</div>
                </div>
              ))}
            </div>
          </div>
        ) : creditIssues.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            ✅ Nenhuma função acima do limite na última hora.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
