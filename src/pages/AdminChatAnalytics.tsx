import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Users, Clock, TrendingUp, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ChatLog {
  id: string;
  user_id: string;
  match_id: string | null;
  home_team: string | null;
  away_team: string | null;
  league: string | null;
  role: 'user' | 'assistant';
  content: string;
  tokens_estimated: number | null;
  response_time_ms: number | null;
  created_at: string;
}

interface UserStat {
  user_id: string;
  email?: string;
  username?: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
  estimatedCostUsd: number;
  sessions: number;
  totalDurationMin: number;
  lastActivity: string;
}

// Gemini 2.5 Flash pricing approx (USD per 1M tokens, input+output averaged)
const COST_PER_1M_TOKENS = 0.30;

export default function AdminChatAnalytics() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { username?: string; email?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!isAdmin) return;
    void loadData();
  }, [isAdmin, days]);

  const loadData = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('mycroft_chat_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const rows = (data || []) as ChatLog[];
    setLogs(rows);

    // Carregar perfis dos usuários únicos
    const uids = Array.from(new Set(rows.map(r => r.user_id)));
    if (uids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', uids);
      const map: Record<string, { username?: string }> = {};
      (profs || []).forEach((p: { user_id: string; username: string | null }) => {
        map[p.user_id] = { username: p.username || undefined };
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  const stats = useMemo(() => {
    const byUser = new Map<string, UserStat>();
    // Para sessões: agrupa mensagens com gap < 30min
    const userTimestamps = new Map<string, number[]>();

    for (const log of logs) {
      const stat = byUser.get(log.user_id) || {
        user_id: log.user_id,
        username: profiles[log.user_id]?.username,
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        sessions: 0,
        totalDurationMin: 0,
        lastActivity: log.created_at,
      };
      stat.totalMessages++;
      if (log.role === 'user') stat.userMessages++;
      else stat.assistantMessages++;
      stat.totalTokens += log.tokens_estimated || 0;
      if (new Date(log.created_at) > new Date(stat.lastActivity)) {
        stat.lastActivity = log.created_at;
      }
      byUser.set(log.user_id, stat);

      const arr = userTimestamps.get(log.user_id) || [];
      arr.push(new Date(log.created_at).getTime());
      userTimestamps.set(log.user_id, arr);
    }

    // Calcula sessões e duração (gap >30min = nova sessão)
    for (const [uid, ts] of userTimestamps.entries()) {
      ts.sort((a, b) => a - b);
      let sessions = 1;
      let durationMs = 0;
      let sessionStart = ts[0];
      for (let i = 1; i < ts.length; i++) {
        const gap = ts[i] - ts[i - 1];
        if (gap > 30 * 60 * 1000) {
          durationMs += ts[i - 1] - sessionStart;
          sessions++;
          sessionStart = ts[i];
        }
      }
      durationMs += ts[ts.length - 1] - sessionStart;
      const stat = byUser.get(uid)!;
      stat.sessions = sessions;
      stat.totalDurationMin = Math.round(durationMs / 60000);
      stat.estimatedCostUsd = (stat.totalTokens / 1_000_000) * COST_PER_1M_TOKENS;
    }

    return Array.from(byUser.values()).sort((a, b) => b.totalMessages - a.totalMessages);
  }, [logs, profiles]);

  const totals = useMemo(() => {
    return {
      messages: logs.length,
      users: stats.length,
      tokens: stats.reduce((s, u) => s + u.totalTokens, 0),
      costUsd: stats.reduce((s, u) => s + u.estimatedCostUsd, 0),
      avgRespMs: Math.round(
        logs.filter(l => l.response_time_ms).reduce((s, l) => s + (l.response_time_ms || 0), 0) /
          Math.max(1, logs.filter(l => l.response_time_ms).length)
      ),
    };
  }, [logs, stats]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-lg font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Esta página é exclusiva para administradores.
          </p>
          <Button onClick={() => navigate('/admin')} variant="outline" size="sm">Voltar</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <MessageSquare className="w-4 h-4 text-primary" />
          <h1 className="font-mono text-sm font-semibold tracking-tight">CHAT ANALYTICS — MYCROFT</h1>
          <div className="ml-auto flex gap-1">
            {[1, 7, 30].map(d => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? 'default' : 'outline'}
                onClick={() => setDays(d)}
                className="text-xs h-7"
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-6xl">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MessageSquare className="w-3 h-3" /> Mensagens
            </div>
            <div className="text-xl font-bold">{totals.messages.toLocaleString('pt-BR')}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="w-3 h-3" /> Usuários
            </div>
            <div className="text-xl font-bold">{totals.users}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3 h-3" /> Tokens
            </div>
            <div className="text-xl font-bold">{(totals.tokens / 1000).toFixed(1)}k</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              💰 Custo est.
            </div>
            <div className="text-xl font-bold">US$ {totals.costUsd.toFixed(3)}</div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="w-3 h-3" /> Resp. média
            </div>
            <div className="text-xl font-bold">{(totals.avgRespMs / 1000).toFixed(1)}s</div>
          </Card>
        </div>

        {/* Top usuários */}
        <Card className="p-4">
          <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Top Usuários ({days}d)
          </h2>
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : stats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma mensagem registrada nesse período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Usuário</th>
                    <th className="py-2 px-2 text-right">Msgs</th>
                    <th className="py-2 px-2 text-right">Sessões</th>
                    <th className="py-2 px-2 text-right">Tempo (min)</th>
                    <th className="py-2 px-2 text-right">Tokens</th>
                    <th className="py-2 px-2 text-right">Custo (US$)</th>
                    <th className="py-2 pl-2 text-right">Última atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(u => (
                    <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{u.username || 'Sem nome'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{u.user_id.slice(0, 8)}…</div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{u.totalMessages}</td>
                      <td className="py-2 px-2 text-right font-mono">{u.sessions}</td>
                      <td className="py-2 px-2 text-right font-mono">{u.totalDurationMin}</td>
                      <td className="py-2 px-2 text-right font-mono">{u.totalTokens.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-2 text-right font-mono">{u.estimatedCostUsd.toFixed(4)}</td>
                      <td className="py-2 pl-2 text-right text-xs text-muted-foreground">
                        {new Date(u.lastActivity).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Últimas mensagens */}
        <Card className="p-4">
          <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Últimas Mensagens
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {logs.slice(0, 50).map(l => (
              <div
                key={l.id}
                className={`text-xs p-2 rounded border ${
                  l.role === 'user'
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {profiles[l.user_id]?.username || l.user_id.slice(0, 8)} • {l.role === 'user' ? '👤' : '🧠'} {l.role}
                    {l.home_team && (
                      <> • {l.home_team} x {l.away_team}</>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {l.response_time_ms ? ` • ${(l.response_time_ms / 1000).toFixed(1)}s` : ''}
                  </span>
                </div>
                <p className="text-foreground/90 line-clamp-3 whitespace-pre-wrap">{l.content}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
