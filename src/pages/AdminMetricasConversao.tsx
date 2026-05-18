import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Users, UserCheck, UserX, Clock, CreditCard, Activity, ArrowLeft } from 'lucide-react';
import EdgeFunctionAlerts from '@/components/admin/EdgeFunctionAlerts';
import ApprovalSnapshotViolations from '@/components/admin/ApprovalSnapshotViolations';
import EmailSequenceReport from '@/components/admin/EmailSequenceReport';
import LiveProviderCompare from '@/components/admin/LiveProviderCompare';
import FutoddsProbe from '@/components/admin/FutoddsProbe';

type User = {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  status: string;
  coupon_code: string | null;
  coupon_partner: string | null;
};

type Data = {
  overview: {
    total: number;
    activeToday: number;
    active3d: number;
    neverReturned: number;
    trialExpiringSoon: number;
    trialExpired: number;
    paidActive: number;
  };
  conversion: {
    d1Rate: number;
    d3Rate: number;
    trialActive: number;
    paidTotal: number;
    trialToPaidRate: number;
  };
  users: User[];
  feed: { type: string; email: string; timestamp: string }[];
};

const FILTERS = ['Todos', 'Ativos hoje', 'Inativos', 'Trial expirando', 'Trial expirado', 'Pagos'] as const;
type Filter = (typeof FILTERS)[number];

const statusColor: Record<string, string> = {
  'Pago': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Trial expirando': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Trial expirado': 'bg-destructive/15 text-destructive border-destructive/40',
  'Ativo hoje': 'bg-primary/15 text-primary border-primary/30',
  'Ativo recente': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Inativo': 'bg-muted text-muted-foreground border-border',
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const feedLabel: Record<string, string> = {
  signup: '🆕 Novo cadastro',
  trial_expiring: '⏳ Trial expirando',
  converted: '💳 Conversão para pago',
};

export default function AdminMetricasConversao() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('Todos');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-dashboard-data');
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as Data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user || !isAdmin) return;
    fetchData();
    const t = setInterval(fetchData, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    let list = data.users.slice();
    if (filter === 'Ativos hoje') list = list.filter((u) => u.status === 'Ativo hoje');
    else if (filter === 'Inativos') list = list.filter((u) => u.status === 'Inativo');
    else if (filter === 'Trial expirando') list = list.filter((u) => u.status === 'Trial expirando');
    else if (filter === 'Trial expirado') list = list.filter((u) => u.status === 'Trial expirado');
    else if (filter === 'Pagos') list = list.filter((u) => u.status === 'Pago');

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((u) =>
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ta = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
      const tb = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [data, filter, search]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth?redirect=/admin/metricas-conversao" replace />;
  if (!isAdmin) return <Navigate to="/punter" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <a href="/admin" aria-label="Voltar"><ArrowLeft className="w-5 h-5" /></a>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Métricas de Conversão</h1>
              <p className="text-sm text-muted-foreground">Cadastros, retenção e conversão · atualiza a cada 60s</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchData} disabled={refreshing} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/admin/hub">🧭 Hub Admin</a>
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">Erro: {error}</CardContent>
          </Card>
        )}

        {loading || !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <EdgeFunctionAlerts />
            <ApprovalSnapshotViolations />

            <section>
              <h2 className="text-lg font-semibold mb-3">Visão geral</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                <StatCard icon={<Users className="w-4 h-4" />} label="Total" value={data.overview.total} />
                <StatCard icon={<UserCheck className="w-4 h-4" />} label="Ativos hoje" value={data.overview.activeToday} />
                <StatCard icon={<Activity className="w-4 h-4" />} label="Ativos 3 dias" value={data.overview.active3d} />
                <StatCard icon={<UserX className="w-4 h-4" />} label="Nunca voltaram" value={data.overview.neverReturned} />
                <StatCard icon={<Clock className="w-4 h-4" />} label="Trial expirando" value={data.overview.trialExpiringSoon} />
                <StatCard icon={<UserX className="w-4 h-4" />} label="Trial expirado" value={data.overview.trialExpired} />
                <StatCard icon={<CreditCard className="w-4 h-4" />} label="Pagos ativos" value={data.overview.paidActive} />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Métricas de conversão</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Ativação D1" value={`${data.conversion.d1Rate.toFixed(1)}%`} />
                <StatCard label="Ativação D3" value={`${data.conversion.d3Rate.toFixed(1)}%`} />
                <StatCard label="Trials ativos" value={data.conversion.trialActive} />
                <StatCard label="Convertidos" value={data.conversion.paidTotal} />
                <StatCard label="Trial → Pago" value={`${data.conversion.trialToPaidRate.toFixed(1)}%`} />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <h2 className="text-lg font-semibold">Usuários ({filteredUsers.length})</h2>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="Buscar por nome ou email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 h-9"
                  />
                  {FILTERS.map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={filter === f ? 'default' : 'outline'}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Cupom</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Último acesso</TableHead>
                        <TableHead>Trial (dias)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="text-sm">
                            {u.full_name ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{u.full_name}</span>
                                {u.username && u.username !== 'Jogador' && (
                                  <span className="text-xs text-muted-foreground">@{u.username}</span>
                                )}
                              </div>
                            ) : u.username && u.username !== 'Jogador' ? (
                              <span className="text-muted-foreground">@{u.username}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{u.email || '—'}</TableCell>
                          <TableCell className="text-sm">
                            {u.coupon_code ? (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                {u.coupon_code}
                              </Badge>
                            ) : u.coupon_partner ? (
                              <span className="text-xs text-muted-foreground">{u.coupon_partner}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDate(u.last_sign_in_at)}</TableCell>
                          <TableCell className="text-sm">
                            {u.trial_days_left !== null ? `${u.trial_days_left}d` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColor[u.status] || ''}>
                              {u.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum usuário encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            <EmailSequenceReport />
            {/* LiveProviderCompare removido — API-Football descontinuada (Fase 1) */}
            <FutoddsProbe />

            <section>
              <h2 className="text-lg font-semibold mb-3">Atividade recente</h2>
              <Card>
                <CardContent className="p-4 space-y-2">
                  {data.feed.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem atividade recente.</p>
                  )}
                  {data.feed.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 py-2"
                    >
                      <span>
                        <span className="font-medium">{feedLabel[e.type] || e.type}</span>{' '}
                        <span className="text-muted-foreground">— {e.email}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{fmtDate(e.timestamp)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
