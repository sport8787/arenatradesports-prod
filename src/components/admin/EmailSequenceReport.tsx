import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";

type Row = {
  user_id: string;
  email: string;
  d1_enviado_em: string | null;
  d1_status: string | null;
  d1_erro: string | null;
  d3_enviado_em: string | null;
  d3_status: string | null;
  d5_enviado_em: string | null;
  d5_status: string | null;
  d7_enviado_em: string | null;
  d7_status: string | null;
  expirado_enviado_em: string | null;
  expirado_status: string | null;
  total_enviados: number;
  total_falhas: number;
};

const SEQS: Array<{ key: "d1" | "d3" | "d5" | "d7" | "expirado"; label: string }> = [
  { key: "d1", label: "D1" },
  { key: "d3", label: "D3" },
  { key: "d5", label: "D5" },
  { key: "d7", label: "D7" },
  { key: "expirado", label: "Exp." },
];

const fmt = (d: string | null) =>
  !d ? "—" : new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function StatusDot({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  if (status === "sent")
    return (
      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
        ✓
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
        !
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground">
      {status}
    </Badge>
  );
}

export default function EmailSequenceReport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "com_falha" | "sem_d1">("todos");

  const fetchData = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("v_email_status_por_usuario" as any)
      .select("*")
      .order("d1_enviado_em", { ascending: false, nullsFirst: false })
      .limit(500);
    if (!error && data) setRows(data as unknown as Row[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (filter === "com_falha") list = list.filter((r) => r.total_falhas > 0);
    else if (filter === "sem_d1") list = list.filter((r) => !r.d1_enviado_em);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.email?.toLowerCase().includes(q));
    }
    return list;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const d1Sent = rows.filter((r) => r.d1_status === "sent").length;
    const failures = rows.reduce((s, r) => s + (r.total_falhas || 0), 0);
    const sent = rows.reduce((s, r) => s + (r.total_enviados || 0), 0);
    return { total, d1Sent, failures, sent };
  }, [rows]);

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5" /> Sequência de E-mails (Onboarding)
        </h2>
        <Button onClick={fetchData} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Usuários no log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> D1 enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.d1Sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Falhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.failures}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <Input
          placeholder="Buscar por email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 h-9"
        />
        <Button size="sm" variant={filter === "todos" ? "default" : "outline"} onClick={() => setFilter("todos")}>
          Todos
        </Button>
        <Button
          size="sm"
          variant={filter === "com_falha" ? "default" : "outline"}
          onClick={() => setFilter("com_falha")}
        >
          Com falha
        </Button>
        <Button size="sm" variant={filter === "sem_d1" ? "default" : "outline"} onClick={() => setFilter("sem_d1")}>
          Sem D1
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  {SEQS.map((s) => (
                    <TableHead key={s.key} className="text-center">
                      {s.label}
                    </TableHead>
                  ))}
                  <TableHead>Último D1</TableHead>
                  <TableHead className="text-right">Enviados / Falhas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium text-sm">
                      {r.email}
                      {r.d1_erro && (
                        <div className="text-[11px] text-destructive truncate max-w-[260px]" title={r.d1_erro}>
                          erro D1: {r.d1_erro}
                        </div>
                      )}
                    </TableCell>
                    {SEQS.map((s) => (
                      <TableCell key={s.key} className="text-center">
                        <StatusDot status={(r as any)[`${s.key}_status`] as string | null} />
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-muted-foreground">{fmt(r.d1_enviado_em)}</TableCell>
                    <TableCell className="text-right text-sm">
                      <span className="text-emerald-400">{r.total_enviados}</span>
                      {" / "}
                      <span className="text-destructive">{r.total_falhas}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={SEQS.length + 3} className="text-center text-muted-foreground py-8">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
