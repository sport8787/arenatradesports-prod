import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

interface PlanRow {
  id?: string;
  user_id: string;
  name?: string;
  market: string;
  plan: any;
  enabled?: boolean;
  updated_at: string;
}

interface SignalRow {
  id: string;
  user_id: string;
  match_id: string;
  match_name: string | null;
  league: string | null;
  market: string;
  outcome: string;
  market_label: string;
  selected_odd: number | null;
  minute: number | null;
  status: 'pending' | 'green' | 'red';
  profit_loss: number | null;
  placed_at: string;
}

interface ProfileLite {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
}

function stats(signals: SignalRow[]) {
  const total = signals.length;
  const settled = signals.filter((s) => s.status !== 'pending');
  const greens = settled.filter((s) => s.status === 'green').length;
  const reds = settled.filter((s) => s.status === 'red').length;
  const pending = total - settled.length;
  const wr = settled.length > 0 ? (greens / settled.length) * 100 : 0;
  const pnl = settled.reduce((acc, s) => acc + (Number(s.profit_loss) || 0), 0);
  const roi = settled.length > 0 ? pnl / settled.length : 0; // % por sinal (stake 100)
  return { total, greens, reds, pending, wr, pnl, roi, settled: settled.length };
}

export default function AdminUserTraderPlans() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('user_trader_plans_v2').select('*').order('updated_at', { ascending: false }),
        supabase.from('user_trader_plan_signals').select('*').order('placed_at', { ascending: false }).limit(2000),
      ]);
      if (cancel) return;
      setPlans((p as PlanRow[]) || []);
      setSignals((s as SignalRow[]) || []);
      const userIds = Array.from(new Set([...(p || []).map((r: any) => r.user_id), ...(s || []).map((r: any) => r.user_id)]));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id,email,display_name')
          .in('user_id', userIds);
        const map: Record<string, ProfileLite> = {};
        (profs || []).forEach((pr: any) => { map[pr.user_id] = pr; });
        if (!cancel) setProfiles(map);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [isAdmin]);

  // ===== Por usuário =====
  const byUser = useMemo(() => {
    const map = new Map<string, { plans: PlanRow[]; signals: SignalRow[] }>();
    plans.forEach((p) => {
      if (!map.has(p.user_id)) map.set(p.user_id, { plans: [], signals: [] });
      map.get(p.user_id)!.plans.push(p);
    });
    signals.forEach((s) => {
      if (!map.has(s.user_id)) map.set(s.user_id, { plans: [], signals: [] });
      map.get(s.user_id)!.signals.push(s);
    });
    return Array.from(map.entries()).map(([uid, v]) => ({
      user_id: uid,
      ...v,
      ...stats(v.signals),
    })).sort((a, b) => b.settled - a.settled);
  }, [plans, signals]);

  // ===== Agregado por mercado =====
  const byMarket = useMemo(() => {
    const markets = ['1x2', 'over_under', 'btts', 'corners'] as const;
    return markets.map((m) => {
      const planSubset = plans.filter((p) => p.market === m);
      const sigSubset = signals.filter((s) => s.market === m);
      const st = stats(sigSubset);
      // Médias dos thresholds
      const minMin: number[] = [];
      const maxMin: number[] = [];
      const minOdd: number[] = [];
      const maxOdd: number[] = [];
      planSubset.forEach((p) => {
        const o = p.plan?.obrigatorios || {};
        if (typeof o.minuto_min === 'number') minMin.push(o.minuto_min);
        if (typeof o.minuto_max === 'number') maxMin.push(o.minuto_max);
        if (typeof o.odd_min === 'number') minOdd.push(o.odd_min);
        if (typeof o.odd_max === 'number') maxOdd.push(o.odd_max);
      });
      const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—');
      return {
        market: m,
        users: planSubset.length,
        ...st,
        avgMinMin: avg(minMin),
        avgMaxMin: avg(maxMin),
        avgMinOdd: avg(minOdd),
        avgMaxOdd: avg(maxOdd),
      };
    });
  }, [plans, signals]);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth?redirect=/admin/user-trader-plans" replace />;
  if (!isAdmin) return <Navigate to="/punter" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/hub')} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub Admin
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">Planos Pessoais dos Usuários</h1>
            <p className="text-sm text-muted-foreground">
              Compare G/R dos planos individuais com o global para calibrar regras do Trader Sports.
            </p>
          </div>
          <Badge variant="outline" className="font-mono">
            {plans.length} planos · {signals.length} sinais logados
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="users">
            <TabsList>
              <TabsTrigger value="users">Por Usuário ({byUser.length})</TabsTrigger>
              <TabsTrigger value="markets">Agregado por Mercado</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Mercados</TableHead>
                        <TableHead className="text-right">Sinais</TableHead>
                        <TableHead className="text-right">G</TableHead>
                        <TableHead className="text-right">R</TableHead>
                        <TableHead className="text-right">Pend.</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">ROI/sinal</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byUser.length === 0 && (
                        <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum plano sincronizado ainda.</TableCell></TableRow>
                      )}
                      {byUser.map((u) => {
                        const prof = profiles[u.user_id];
                        const open = expandedUser === u.user_id;
                        return (
                          <>
                            <TableRow key={u.user_id} className="cursor-pointer" onClick={() => setExpandedUser(open ? null : u.user_id)}>
                              <TableCell className="font-mono text-xs">
                                {prof?.display_name || prof?.email || u.user_id.slice(0, 8)}
                              </TableCell>
                              <TableCell className="text-xs">
                                {u.plans.map((p) => p.market).join(', ') || '—'}
                              </TableCell>
                              <TableCell className="text-right">{u.total}</TableCell>
                              <TableCell className="text-right text-green-500">{u.greens}</TableCell>
                              <TableCell className="text-right text-red-500">{u.reds}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{u.pending}</TableCell>
                              <TableCell className="text-right font-mono">{u.settled > 0 ? `${u.wr.toFixed(1)}%` : '—'}</TableCell>
                              <TableCell className={`text-right font-mono ${u.roi > 0 ? 'text-green-500' : u.roi < 0 ? 'text-red-500' : ''}`}>
                                {u.settled > 0 ? `${u.roi > 0 ? '+' : ''}${u.roi.toFixed(2)}%` : '—'}
                              </TableCell>
                              <TableCell>{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</TableCell>
                            </TableRow>
                            {open && (
                              <TableRow key={`${u.user_id}-detail`}>
                                <TableCell colSpan={9} className="bg-muted/20">
                                  <div className="space-y-4 py-2">
                                    {/* Planos */}
                                    <div>
                                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Configuração por mercado</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {u.plans.map((p) => (
                                          <Card key={p.id || p.market} className="border-border/50">
                                            <CardHeader className="pb-2">
                                              <CardTitle className="text-sm flex items-center justify-between">
                                                <span className="truncate">
                                                  {p.name || p.market.toUpperCase()}
                                                  <span className="text-[10px] text-muted-foreground ml-2 font-normal">[{p.market.toUpperCase()}]</span>
                                                </span>
                                                <Badge variant={p.enabled ? 'default' : 'outline'} className="text-[10px]">
                                                  {p.enabled ? 'ATIVO' : 'inativo'}
                                                </Badge>
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-[11px] font-mono space-y-1">
                                              <div>outcome: <span className="text-foreground">{p.plan?.outcome}</span>{p.plan?.line ? ` · linha ${p.plan.line}` : ''}</div>
                                              <div className="text-muted-foreground">obrigatórios:</div>
                                              <pre className="bg-background/50 p-2 rounded text-[10px] overflow-auto max-h-32">{JSON.stringify(p.plan?.obrigatorios, null, 2)}</pre>
                                              <div className="text-muted-foreground">vetos:</div>
                                              <pre className="bg-background/50 p-2 rounded text-[10px] overflow-auto max-h-32">{JSON.stringify(p.plan?.vetos, null, 2)}</pre>
                                            </CardContent>
                                          </Card>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Últimos sinais */}
                                    <div>
                                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Últimos sinais ({Math.min(u.signals.length, 30)})</h4>
                                      <div className="rounded border border-border bg-card/30">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="text-xs">Data</TableHead>
                                              <TableHead className="text-xs">Jogo</TableHead>
                                              <TableHead className="text-xs">Mercado</TableHead>
                                              <TableHead className="text-xs text-right">Odd</TableHead>
                                              <TableHead className="text-xs text-right">Min</TableHead>
                                              <TableHead className="text-xs text-right">Status</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {u.signals.slice(0, 30).map((s) => (
                                              <TableRow key={s.id}>
                                                <TableCell className="text-[11px] font-mono">{new Date(s.placed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</TableCell>
                                                <TableCell className="text-xs">{s.match_name || s.match_id} <span className="text-muted-foreground">· {s.league || ''}</span></TableCell>
                                                <TableCell className="text-xs">{s.market_label}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{s.selected_odd ? Number(s.selected_odd).toFixed(2) : '—'}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{s.minute ?? '—'}'</TableCell>
                                                <TableCell className="text-xs text-right">
                                                  <Badge variant="outline" className={
                                                    s.status === 'green' ? 'border-green-500/40 text-green-500' :
                                                    s.status === 'red' ? 'border-red-500/40 text-red-500' :
                                                    'border-muted text-muted-foreground'
                                                  }>{s.status}</Badge>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="markets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Comparativo por Mercado</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Médias dos thresholds escolhidos pelos usuários + performance dos sinais gerados pelos planos pessoais.
                    Compare com a performance do plano global para identificar regras melhores.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mercado</TableHead>
                        <TableHead className="text-right">Usuários c/ plano</TableHead>
                        <TableHead className="text-right">Sinais</TableHead>
                        <TableHead className="text-right">G</TableHead>
                        <TableHead className="text-right">R</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">ROI/sinal</TableHead>
                        <TableHead className="text-right">Min méd.</TableHead>
                        <TableHead className="text-right">Odd méd.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byMarket.map((m) => (
                        <TableRow key={m.market}>
                          <TableCell className="font-mono">{m.market}</TableCell>
                          <TableCell className="text-right">{m.users}</TableCell>
                          <TableCell className="text-right">{m.total}</TableCell>
                          <TableCell className="text-right text-green-500">{m.greens}</TableCell>
                          <TableCell className="text-right text-red-500">{m.reds}</TableCell>
                          <TableCell className="text-right font-mono">{m.settled > 0 ? `${m.wr.toFixed(1)}%` : '—'}</TableCell>
                          <TableCell className={`text-right font-mono ${m.roi > 0 ? 'text-green-500' : m.roi < 0 ? 'text-red-500' : ''}`}>
                            {m.settled > 0 ? `${m.roi > 0 ? '+' : ''}${m.roi.toFixed(2)}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{m.avgMinMin}–{m.avgMaxMin}'</TableCell>
                          <TableCell className="text-right font-mono text-xs">{m.avgMinOdd}–{m.avgMaxOdd}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
