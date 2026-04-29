import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Eye, History, Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoryEntry {
  id: string;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  modo: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  old_data: any;
  new_data: any;
  diff: any;
  changed_fields: string[] | null;
  created_at: string;
}

const opColor = {
  INSERT: "bg-green-500/15 text-green-500 border-green-500/30",
  UPDATE: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

export function MycroftRulesAuditTab() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTable, setFilterTable] = useState<string>("all");
  const [filterModo, setFilterModo] = useState<string>("all");
  const [filterOp, setFilterOp] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("mycroft_rules_history" as any).select("*").order("created_at", { ascending: false }).limit(200);
    if (filterTable !== "all") q = q.eq("table_name", filterTable);
    if (filterModo !== "all") q = q.eq("modo", filterModo);
    if (filterOp !== "all") q = q.eq("operation", filterOp);
    const { data, error } = await q;
    if (!error && data) setEntries(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterTable, filterModo, filterOp]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (e.changed_by_email ?? "").toLowerCase().includes(s) ||
      (e.new_data?.name ?? e.old_data?.name ?? "").toLowerCase().includes(s) ||
      (e.changed_fields ?? []).some((f) => f.toLowerCase().includes(s))
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Auditoria de alterações</CardTitle>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Atualizar
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <Select value={filterTable} onValueChange={setFilterTable}>
            <SelectTrigger><SelectValue placeholder="Tabela" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tabelas</SelectItem>
              <SelectItem value="mycroft_rules">mycroft_rules</SelectItem>
              <SelectItem value="mycroft_config">mycroft_config</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterModo} onValueChange={setFilterModo}>
            <SelectTrigger><SelectValue placeholder="Modo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os modos</SelectItem>
              <SelectItem value="trader">Trader</SelectItem>
              <SelectItem value="punter">Punter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOp} onValueChange={setFilterOp}>
            <SelectTrigger><SelectValue placeholder="Operação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as operações</SelectItem>
              <SelectItem value="INSERT">Criação</SelectItem>
              <SelectItem value="UPDATE">Edição</SelectItem>
              <SelectItem value="DELETE">Exclusão</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar por usuário/regra/campo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma alteração registrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Op</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Regra/Config</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Campos alterados</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(e.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={opColor[e.operation]}>{e.operation}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{e.table_name}</TableCell>
                  <TableCell><Badge variant="outline">{e.modo ?? "-"}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">
                    {e.new_data?.name ?? e.old_data?.name ?? e.new_data?.key ?? e.old_data?.key ?? e.record_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-xs">{e.changed_by_email ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1 max-w-[250px]">
                      {(e.changed_fields ?? []).slice(0, 4).map((f) => (
                        <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                      ))}
                      {(e.changed_fields?.length ?? 0) > 4 && <span className="text-muted-foreground">+{(e.changed_fields?.length ?? 0) - 4}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setSelected(e)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && <Badge variant="outline" className={opColor[selected.operation]}>{selected.operation}</Badge>}
              {selected?.table_name} — {selected && format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-xs grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Por: </span>{selected.changed_by_email ?? "Sistema"}</div>
                <div><span className="text-muted-foreground">Modo: </span>{selected.modo ?? "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Record: </span><code>{selected.record_id}</code></div>
              </div>

              {selected.operation === "UPDATE" && selected.diff && Object.keys(selected.diff).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Diff</h4>
                  <div className="space-y-2">
                    {Object.entries(selected.diff as Record<string, any>).map(([key, val]) => (
                      <div key={key} className="border rounded p-2 text-xs">
                        <div className="font-mono font-semibold mb-1">{key}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-destructive/10 p-2 rounded">
                            <div className="text-muted-foreground text-[10px] mb-1">ANTES</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(val.old, null, 2)}</pre>
                          </div>
                          <div className="bg-green-500/10 p-2 rounded">
                            <div className="text-muted-foreground text-[10px] mb-1">DEPOIS</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(val.new, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.operation === "INSERT" && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Dados criados</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{JSON.stringify(selected.new_data, null, 2)}</pre>
                </div>
              )}

              {selected.operation === "DELETE" && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Dados removidos</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{JSON.stringify(selected.old_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
