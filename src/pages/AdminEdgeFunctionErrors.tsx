import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, Eye, AlertTriangle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type ErrorRow = {
  id: string;
  function_name: string;
  error_message: string;
  error_stack: string | null;
  context: Record<string, unknown> | null;
  status_code: number | null;
  severity: string;
  created_at: string;
};

const PAGE_SIZE = 100;

export default function AdminEdgeFunctionErrors() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [functionFilter, setFunctionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [hours, setHours] = useState<number>(24);
  const [selected, setSelected] = useState<ErrorRow | null>(null);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let q = supabase
      .from("edge_function_errors")
      .select("*")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (functionFilter !== "all") q = q.eq("function_name", functionFilter);
    if (severityFilter !== "all") q = q.eq("severity", severityFilter);

    const { data, error } = await q;
    if (!error && data) setRows(data as ErrorRow[]);
    setLoading(false);
  }, [hours, functionFilter, severityFilter]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/");
  }, [adminLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) fetchErrors();
  }, [isAdmin, fetchErrors]);

  const functionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.function_name));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.error_message?.toLowerCase().includes(s) ||
        r.function_name?.toLowerCase().includes(s) ||
        JSON.stringify(r.context ?? {}).toLowerCase().includes(s),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const errors = filtered.filter((r) => r.severity === "error").length;
    const warnings = filtered.filter((r) => r.severity === "warning").length;
    const uniqueFns = new Set(filtered.map((r) => r.function_name)).size;
    return { total, errors, warnings, uniqueFns };
  }, [filtered]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Erros de Edge Functions
              </h1>
              <p className="text-xs text-muted-foreground">
                Logs de falhas registradas em <code>edge_function_errors</code>
              </p>
            </div>
          </div>
          <Button onClick={fetchErrors} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Erros" value={stats.errors} tone="destructive" />
          <StatCard label="Warnings" value={stats.warnings} tone="warning" />
          <StatCard label="Funções únicas" value={stats.uniqueFns} />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Função</Label>
              <Select value={functionFilter} onValueChange={setFunctionFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {functionOptions.map((fn) => (
                    <SelectItem key={fn} value={fn}>
                      {fn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Severidade</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Janela (horas)</Label>
              <Select value={String(hours)} onValueChange={(v) => setHours(parseInt(v, 10))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="72">72 horas</SelectItem>
                  <SelectItem value="168">7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Buscar</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="mensagem, função, contexto..."
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {filtered.length} registro(s){" "}
              {rows.length === PAGE_SIZE && (
                <span className="text-xs text-muted-foreground">
                  (limitado aos últimos {PAGE_SIZE})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Quando</TableHead>
                  <TableHead className="w-[200px]">Função</TableHead>
                  <TableHead className="w-[100px]">Severidade</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      ✅ Nenhum erro encontrado nesta janela.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.function_name}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={r.severity} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.status_code ? (
                          <Badge variant="outline" className="font-mono">
                            {r.status_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[400px] truncate">
                        {r.error_message}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              {selected?.function_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={selected.severity} />
                {selected.status_code && (
                  <Badge variant="outline" className="font-mono">
                    HTTP {selected.status_code}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(selected.created_at).toLocaleString("pt-BR")}
                </span>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Mensagem</Label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs whitespace-pre-wrap break-words">
                  {selected.error_message}
                </pre>
              </div>

              {selected.error_stack && (
                <div>
                  <Label className="text-xs text-muted-foreground">Stack trace</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                    {selected.error_stack}
                  </pre>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">
                  Payload / Contexto problemático
                </Label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
                  {selected.context && Object.keys(selected.context).length > 0
                    ? JSON.stringify(selected.context, null, 2)
                    : "— sem contexto registrado —"}
                </pre>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(selected, null, 2),
                    );
                  }}
                >
                  Copiar JSON
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive" | "warning";
}) {
  const color =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-500"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "warning") {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30">
        warning
      </Badge>
    );
  }
  return <Badge variant="destructive">error</Badge>;
}
