import { useEffect, useMemo, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, AlertTriangle, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";

const ADMIN_EMAIL = "pabloescobar@gmail.com";

interface AuditRow {
  id: string;
  source: "primary";
  match_id: string;
  market: string;
  verdict: string;
  odd: number | null;
  confidence: number | null;
  approved_at_timestamp: string | null;
  approved_at_minute: number | null;
  approved_at_score_home: number | null;
  approved_at_score_away: number | null;
  result: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  settled_at: string | null;
  settle_reason: string | null;
  home_team?: string | null;
  away_team?: string | null;
  inconsistencies: string[];
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

function detectInconsistencies(row: Omit<AuditRow, "inconsistencies">): string[] {
  const issues: string[] = [];
  const m = (row.market || "").toLowerCase();
  const ah = row.approved_at_score_home;
  const aa = row.approved_at_score_away;
  const fh = row.final_score_home;
  const fa = row.final_score_away;

  // Sem snapshot
  if (row.approved_at_timestamp == null) {
    issues.push("SNAPSHOT_AUSENTE");
  }
  if (ah == null || aa == null) {
    issues.push("PLACAR_APROVACAO_NULO");
  }

  // Próximo Gol — exige gol APÓS snapshot
  if (/(pr[óo]ximo\s+gol|next\s+goal)/i.test(row.market || "")) {
    if (row.result === "green" && ah != null && aa != null && fh != null && fa != null) {
      const apprTotal = (ah || 0) + (aa || 0);
      const finalTotal = (fh || 0) + (fa || 0);
      if (finalTotal <= apprTotal) {
        issues.push("PROX_GOL_GREEN_SEM_GOL");
      }
    }
    if (row.result === "red" && ah != null && aa != null && fh != null && fa != null) {
      const apprTotal = (ah || 0) + (aa || 0);
      const finalTotal = (fh || 0) + (fa || 0);
      if (finalTotal > apprTotal) {
        issues.push("PROX_GOL_RED_COM_GOL");
      }
    }
  }

  // Over X.5 sanity
  const over = m.match(/over\s*([0-9]+(\.[0-9]+)?)/);
  if (over && row.result && fh != null && fa != null) {
    const line = parseFloat(over[1]);
    const total = (fh || 0) + (fa || 0);
    const should = total > line ? "green" : "red";
    if (row.result !== should) issues.push(`OVER_${line}_INCONSISTENTE`);
  }
  const under = m.match(/under\s*([0-9]+(\.[0-9]+)?)/);
  if (under && row.result && fh != null && fa != null) {
    const line = parseFloat(under[1]);
    const total = (fh || 0) + (fa || 0);
    const should = total < line ? "green" : "red";
    if (row.result !== should) issues.push(`UNDER_${line}_INCONSISTENTE`);
  }

  // Final regrediu (placar final < placar aprovação)
  if (ah != null && aa != null && fh != null && fa != null) {
    if (fh < ah || fa < aa) issues.push("PLACAR_REGRESSO");
  }

  return issues;
}

export default function AdminAuditoriaSinais() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "inconsistent" | "green" | "red" | "pending">("inconsistent");
  const [sourceFilter, setSourceFilter] = useState<"all" | "primary">("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<7 | 14 | 30>(7);

  const fetchData = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const primaryRes = await (supabase as any)
        .from("mycroft_analyses")
        .select("id,match_id,market,verdict,odd,confidence,approved_at_timestamp,approved_at_minute,approved_at_score_home,approved_at_score_away,result,final_score_home,final_score_away,settled_at,settle_reason,created_at")
        .in("verdict", ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (primaryRes.error) throw primaryRes.error;

      const matchIds = Array.from(
        new Set((primaryRes.data || []).map((r: any) => r.match_id))
      ).filter(Boolean);

      let teamsMap: Record<string, { home_team: string; away_team: string }> = {};
      if (matchIds.length) {
        const { data: lm } = await (supabase as any)
          .from("live_matches")
          .select("match_id,home_team,away_team")
          .in("match_id", matchIds);
        (lm || []).forEach((m: any) => {
          teamsMap[m.match_id] = { home_team: m.home_team, away_team: m.away_team };
        });
      }

      const build = (r: any, source: AuditRow["source"]): AuditRow => {
        const base: Omit<AuditRow, "inconsistencies"> = {
          id: r.id,
          source,
          match_id: r.match_id,
          market: r.market,
          verdict: r.verdict,
          odd: r.odd,
          confidence: r.confidence,
          approved_at_timestamp: r.approved_at_timestamp,
          approved_at_minute: r.approved_at_minute,
          approved_at_score_home: r.approved_at_score_home,
          approved_at_score_away: r.approved_at_score_away,
          result: r.result,
          final_score_home: r.final_score_home,
          final_score_away: r.final_score_away,
          settled_at: r.settled_at,
          settle_reason: r.settle_reason,
          home_team: teamsMap[r.match_id]?.home_team ?? null,
          away_team: teamsMap[r.match_id]?.away_team ?? null,
        };
        return { ...base, inconsistencies: detectInconsistencies(base) };
      };

      const combined: AuditRow[] = (primaryRes.data || [])
        .map((r: any) => build(r, "primary"))
        .sort(
          (a, b) =>
            new Date(b.approved_at_timestamp || 0).getTime() -
            new Date(a.approved_at_timestamp || 0).getTime()
        );

      setRows(combined);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, days]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "inconsistent") list = list.filter((r) => r.inconsistencies.length > 0);
    else if (filter === "green") list = list.filter((r) => r.result === "green");
    else if (filter === "red") list = list.filter((r) => r.result === "red");
    else if (filter === "pending") list = list.filter((r) => !r.result);
    if (sourceFilter !== "all") list = list.filter((r) => r.source === sourceFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.market?.toLowerCase().includes(q) ||
          r.match_id?.toLowerCase().includes(q) ||
          r.home_team?.toLowerCase().includes(q) ||
          r.away_team?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filter, sourceFilter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const green = rows.filter((r) => r.result === "green").length;
    const red = rows.filter((r) => r.result === "red").length;
    const pending = rows.filter((r) => !r.result).length;
    const inconsistent = rows.filter((r) => r.inconsistencies.length > 0).length;
    return { total, green, red, pending, inconsistent };
  }, [rows]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?redirect=/admin/auditoria-sinais" replace />;
  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return <Navigate to="/punter" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Auditoria de Entradas Aprovadas</h1>
              <p className="text-sm text-muted-foreground">
                Snapshot de aprovação × resultado final · destaca inconsistências (Próximo Gol, Over/Under, etc.)
              </p>
            </div>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="🟢 GREEN" value={stats.green} />
          <StatCard label="🔴 RED" value={stats.red} />
          <StatCard label="⏳ Pendentes" value={stats.pending} />
          <StatCard
            label="⚠️ Inconsistentes"
            value={stats.inconsistent}
            highlight={stats.inconsistent > 0}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inconsistent">⚠️ Inconsistentes</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="green">🟢 GREEN</SelectItem>
                <SelectItem value="red">🔴 RED</SelectItem>
                <SelectItem value="pending">⏳ Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por mercado, time, match_id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filtered.length} de {rows.length}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aprovado</TableHead>
                    <TableHead>Jogo</TableHead>
                    <TableHead>Mercado</TableHead>
                    <TableHead>Snapshot</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>⚠️</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const bad = r.inconsistencies.length > 0;
                    return (
                      <TableRow
                        key={`${r.source}-${r.id}`}
                        onClick={() => navigate(`/admin/auditoria-sinais/${r.source}/${r.id}`)}
                        className={`cursor-pointer ${bad ? "bg-destructive/10 hover:bg-destructive/15" : "hover:bg-muted/40"}`}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          <div>{fmtDate(r.approved_at_timestamp)}</div>
                          <div className="text-muted-foreground">
                            min {r.approved_at_minute ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">
                            {r.home_team && r.away_team
                              ? `${r.home_team} × ${r.away_team}`
                              : r.match_id}
                          </div>
                          <div className="text-muted-foreground truncate max-w-[180px]" title={r.match_id}>
                            {r.match_id}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{r.market}</div>
                          <div className="text-muted-foreground">
                            @{r.odd?.toFixed(2) ?? "?"} · {r.confidence ?? "?"}% · {r.verdict}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {r.approved_at_score_home ?? "?"}:{r.approved_at_score_away ?? "?"}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {r.final_score_home ?? "—"}:{r.final_score_away ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.result === "green" && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                              GREEN
                            </Badge>
                          )}
                          {r.result === "red" && (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                              RED
                            </Badge>
                          )}
                          {!r.result && (
                            <Badge variant="outline" className="text-muted-foreground">
                              pendente
                            </Badge>
                          )}
                          {r.settle_reason && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {r.settle_reason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">primary</Badge>
                        </TableCell>
                        <TableCell>
                          {bad && (
                            <div className="flex flex-col gap-1">
                              {r.inconsistencies.map((i) => (
                                <Badge
                                  key={i}
                                  className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]"
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {i}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum entrada encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-500/40" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? "text-amber-400" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
