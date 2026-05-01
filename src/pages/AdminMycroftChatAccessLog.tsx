import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
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
import { Loader2, RefreshCw, ArrowLeft, Search, Lock, Users, MessageSquare, Sparkles } from "lucide-react";

interface AttemptRow {
  id: string;
  user_id: string | null;
  email: string | null;
  plan: string | null;
  days_left: number | null;
  source: string;
  reason: string;
  route: string | null;
  match_id: string | null;
  home_team: string | null;
  away_team: string | null;
  league: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
};

const sourceLabel: Record<string, string> = {
  analyst: "Mycroft Analyst (geral)",
  match: "Card de Partida",
  sports: "Mycroft Sports",
  other: "Outro",
};

const reasonLabel: Record<string, { label: string; color: string }> = {
  no_login: { label: "Sem login", color: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  free: { label: "Conta free", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  trial_expired: { label: "Trial expirado", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  plan_insufficient: { label: "Plano insuficiente", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  unknown: { label: "Outro", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40" },
};

export default function AdminMycroftChatAccessLog() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterReason, setFilterReason] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mycroft_chat_access_attempts" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setRows(data as unknown as AttemptRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterSource !== "all" && r.source !== filterSource) return false;
      if (filterReason !== "all" && r.reason !== filterReason) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [r.email, r.home_team, r.away_team, r.league, r.match_id, r.route]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filterSource, filterReason, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const uniqueUsers = new Set(rows.map((r) => r.user_id || r.email).filter(Boolean)).size;
    const last24h = rows.filter(
      (r) => new Date(r.created_at).getTime() > Date.now() - 24 * 3600_000,
    ).length;
    const trialExpired = rows.filter((r) => r.reason === "trial_expired").length;
    return { total, uniqueUsers, last24h, trialExpired };
  }, [rows]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="gap-1 text-white/60 hover:text-white">
                <ArrowLeft className="w-4 h-4" /> Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                Tentativas de Acesso — Chat Mycroft
              </h1>
              <p className="text-xs text-white/50">
                Usuários sem permissão (free / trial / starter / base) que tentaram abrir o chat com o Mycroft.
              </p>
            </div>
          </div>
          <Button onClick={load} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-[#111] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <MessageSquare className="w-3 h-3" /> Total
              </div>
              <div className="text-2xl font-bold mt-1">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Users className="w-3 h-3" /> Usuários únicos
              </div>
              <div className="text-2xl font-bold mt-1">{stats.uniqueUsers}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-white/10">
            <CardContent className="p-4">
              <div className="text-xs text-white/50">Últimas 24h</div>
              <div className="text-2xl font-bold mt-1">{stats.last24h}</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-amber-300/80">
                <Sparkles className="w-3 h-3" /> Trial expirado (oportunidade)
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-300">{stats.trialExpired}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <Input
                placeholder="Buscar por email, time, liga, rota..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-black/40 border-white/10"
              />
            </div>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="bg-black/40 border-white/10">
                <SelectValue placeholder="Origem do chat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="analyst">Mycroft Analyst (geral)</SelectItem>
                <SelectItem value="match">Card de Partida</SelectItem>
                <SelectItem value="sports">Mycroft Sports</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterReason} onValueChange={setFilterReason}>
              <SelectTrigger className="bg-black/40 border-white/10">
                <SelectValue placeholder="Motivo do bloqueio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os motivos</SelectItem>
                <SelectItem value="no_login">Sem login</SelectItem>
                <SelectItem value="free">Conta free</SelectItem>
                <SelectItem value="trial_expired">Trial expirado</SelectItem>
                <SelectItem value="plan_insufficient">Plano insuficiente</SelectItem>
                <SelectItem value="unknown">Outro</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card className="bg-[#111] border-white/10">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/60">Quando</TableHead>
                  <TableHead className="text-white/60">Usuário</TableHead>
                  <TableHead className="text-white/60">Plano</TableHead>
                  <TableHead className="text-white/60">Origem</TableHead>
                  <TableHead className="text-white/60">Motivo</TableHead>
                  <TableHead className="text-white/60">Contexto</TableHead>
                  <TableHead className="text-white/60">Rota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-white/40">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-white/40">
                      Nenhuma tentativa encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const reason = reasonLabel[r.reason] ?? reasonLabel.unknown;
                    return (
                      <TableRow key={r.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{r.email || <span className="text-white/30">anônimo</span>}</div>
                          {r.user_id && (
                            <div className="text-[10px] text-white/30 font-mono">{r.user_id.slice(0, 8)}…</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.plan ? (
                            <div>
                              <Badge variant="outline" className="capitalize">{r.plan}</Badge>
                              {r.days_left !== null && (
                                <div className="text-[10px] text-white/40 mt-1">{r.days_left}d restantes</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{sourceLabel[r.source] ?? r.source}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${reason.color}`}>
                            {reason.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px]">
                          {r.home_team && r.away_team ? (
                            <div>
                              <div className="font-medium truncate">
                                {r.home_team} × {r.away_team}
                              </div>
                              {r.league && <div className="text-[10px] text-white/40 truncate">{r.league}</div>}
                            </div>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[10px] text-white/40 font-mono max-w-[180px] truncate">
                          {r.route || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-[10px] text-white/30 text-center">
          Limite: 500 registros mais recentes • Throttle: 30s no servidor + 5min no cliente para evitar spam
        </p>
      </div>
    </div>
  );
}
