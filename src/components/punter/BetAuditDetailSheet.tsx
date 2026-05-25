import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ExternalLink, Info } from 'lucide-react';

export interface AuditBetLite {
  id: string;
  source: 'horus' | 'manual';
  match_id: string | null;
  match_name: string | null;
  market: string;
  odd: number;
  stake: number;
  status: string;
  result: string | null;
  profit_loss: number | null;
  score_home: number | null;
  score_away: number | null;
  commence_time: string | null;
  created_at: string;
  analysis_id?: string | null;
}

interface AnalysisInfo {
  id: string;
  verdict: string;
  result: string | null;
  settle_attempts: number;
  last_settle_attempt_at: string | null;
  settled_at: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
}

interface SettlementLogRow {
  id: string;
  outcome: string | null;
  result: string | null;
  reason: string | null;
  status_old: string | null;
  status_new: string | null;
  error_message: string | null;
  created_at: string;
}

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return '—'; }
}

function isMarketSupported(market: string) {
  const m = market.toLowerCase();
  return /(over|under|btts|ambas|both teams|casa|fora|empate|home|away|draw)/.test(m);
}

export function BetAuditDetailSheet({
  bet,
  open,
  onOpenChange,
  onUpdated,
}: {
  bet: AuditBetLite | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisInfo | null>(null);
  const [logs, setLogs] = useState<SettlementLogRow[]>([]);
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    if (!open || !bet) return;
    (async () => {
      setLoading(true);
      setAnalysis(null);
      setLogs([]);
      try {
        // Análise vinculada (se Hórus tem analysis_id) ou por match_id+market
        let aId = bet.analysis_id || null;
        if (!aId && bet.match_id) {
          const { data } = await supabase
            .from('punter_analyses')
            .select('id, verdict, result, settle_attempts, last_settle_attempt_at, settled_at, final_score_home, final_score_away')
            .eq('match_id', bet.match_id)
            .ilike('market', bet.market)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) {
            setAnalysis(data as AnalysisInfo);
            aId = data.id;
          }
        } else if (aId) {
          const { data } = await supabase
            .from('punter_analyses')
            .select('id, verdict, result, settle_attempts, last_settle_attempt_at, settled_at, final_score_home, final_score_away')
            .eq('id', aId)
            .maybeSingle();
          if (data) setAnalysis(data as AnalysisInfo);
        }

        // Logs de liquidação por match_id (tabela mycroft_settlement_log também usada para punter)
        if (bet.match_id) {
          const { data: lg } = await supabase
            .from('mycroft_settlement_log' as any)
            .select('id, outcome, result, reason, status_old, status_new, error_message, created_at')
            .eq('match_id', bet.match_id)
            .order('created_at', { ascending: false })
            .limit(20);
          if (lg) setLogs(lg as any);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open, bet]);

  if (!bet) return null;

  const supported = isMarketSupported(bet.market);
  const isPending = bet.status === 'pending' && !bet.result;
  const score = bet.score_home != null && bet.score_away != null
    ? `${bet.score_home}-${bet.score_away}`
    : analysis && analysis.final_score_home != null
      ? `${analysis.final_score_home}-${analysis.final_score_away}`
      : null;

  // Motivo do pending
  const reasons: string[] = [];
  if (isPending) {
    if (!supported) reasons.push('Mercado não suportado pela liquidação automática.');
    if (analysis?.settle_attempts && analysis.settle_attempts >= 30) reasons.push(`Limite de tentativas atingido (${analysis.settle_attempts}/30).`);
    if (!score) reasons.push('Placar final ainda não foi obtido nas APIs (jogo pode não ter terminado ou não está mapeado).');
    if (bet.commence_time) {
      const ms = Date.now() - new Date(bet.commence_time).getTime();
      const hoursSinceStart = ms / 3600_000;
      if (hoursSinceStart < 2.5) reasons.push(`Jogo iniciou há ${hoursSinceStart.toFixed(1)}h — auditoria varre apenas jogos terminados há 2h+.`);
    }
    if (!analysis) reasons.push('Análise Punter não encontrada — provavelmente entrada manual sem vínculo.');
    if (reasons.length === 0) reasons.push('Aguardando próximo ciclo automático.');
  }

  const suggestedActions: { label: string; onClick: () => Promise<void> | void; variant?: 'default' | 'outline' | 'destructive' }[] = [];

  if (isPending) {
    suggestedActions.push({
      label: 'Reprocessar liquidação automática',
      variant: 'default',
      onClick: async () => {
        setReprocessing(true);
        try {
          const { data, error } = await supabase.functions.invoke('punter-settle-results', { body: {} });
          if (error) throw error;
          toast({ title: 'Reprocessamento iniciado', description: `Verificados: ${data?.checked ?? 0} • Liquidados: ${data?.settled ?? 0}` });
          onUpdated?.();
        } catch (e: any) {
          toast({ title: 'Erro', description: String(e?.message || e), variant: 'destructive' });
        } finally {
          setReprocessing(false);
        }
      },
    });

    if (score && supported) {
      suggestedActions.push({
        label: `Forçar liquidação com placar ${score}`,
        variant: 'default',
        onClick: async () => {
          if (!analysis) return;
          const [h, a] = score.split('-').map(Number);
          const { data, error } = await supabase.rpc('settle_mycroft_analysis' as any, {
            p_analysis_id: analysis.id, p_score_home: h, p_score_away: a, p_reason: 'manual_audit_ui',
          });
          if (error) toast({ title: 'Erro RPC', description: String(error.message), variant: 'destructive' });
          else { toast({ title: 'Liquidado', description: String(data) }); onUpdated?.(); }
        },
      });
    }

    if (analysis && analysis.settle_attempts >= 30) {
      suggestedActions.push({
        label: 'Resetar contador de tentativas',
        variant: 'outline',
        onClick: async () => {
          await supabase.from('punter_analyses').update({ settle_attempts: 0 }).eq('id', analysis.id);
          toast({ title: 'Tentativas resetadas' });
          onUpdated?.();
        },
      });
    }

    suggestedActions.push({
      label: 'Marcar manualmente em /apostas',
      variant: 'outline',
      onClick: () => { window.location.href = '/apostas'; },
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm uppercase tracking-wider">Detalhes da entrada</SheetTitle>
          <SheetDescription className="text-xs">
            {bet.match_name || bet.match_id || '—'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Resumo */}
          <section className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={bet.source === 'horus' ? 'default' : 'secondary'} className="font-mono">
                {bet.source === 'horus' ? 'HÓRUS' : 'MANUAL'}
              </Badge>
              {isPending ? (
                <Badge className="bg-warning/15 text-warning border-warning/30 font-mono">PENDENTE</Badge>
              ) : (
                <Badge className={`font-mono ${(bet.result || '').toLowerCase().match(/green|won|win/) ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/15 text-destructive border-destructive/30'}`}>
                  {(bet.result || '').toUpperCase()}{score ? ` ${score}` : ''}
                </Badge>
              )}
              {!supported && <Badge variant="outline" className="font-mono text-warning border-warning/30">SEM SUPORTE AUTO</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p className="text-muted-foreground">Mercado:</p><p className="font-mono">{bet.market}</p>
              <p className="text-muted-foreground">Odd:</p><p className="font-mono">{Number(bet.odd).toFixed(2)}</p>
              <p className="text-muted-foreground">Stake:</p><p className="font-mono">{Number(bet.stake).toFixed(2)}</p>
              <p className="text-muted-foreground">P&L:</p>
              <p className={`font-mono ${Number(bet.profit_loss || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {bet.profit_loss != null ? `${Number(bet.profit_loss) >= 0 ? '+' : ''}${Number(bet.profit_loss).toFixed(2)}` : '—'}
              </p>
              <p className="text-muted-foreground">Início:</p><p className="font-mono">{fmt(bet.commence_time)}</p>
              <p className="text-muted-foreground">Criada em:</p><p className="font-mono">{fmt(bet.created_at)}</p>
              <p className="text-muted-foreground">Placar final:</p><p className="font-mono">{score || '—'}</p>
            </div>
          </section>

          {/* Tentativas de liquidação */}
          <section className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Tentativas de liquidação
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : analysis ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="text-muted-foreground">Verdict:</p><p className="font-mono">{analysis.verdict}</p>
                <p className="text-muted-foreground">Tentativas:</p><p className="font-mono">{analysis.settle_attempts}/30</p>
                <p className="text-muted-foreground">Última tentativa:</p><p className="font-mono">{fmt(analysis.last_settle_attempt_at)}</p>
                <p className="text-muted-foreground">Liquidada em:</p><p className="font-mono">{fmt(analysis.settled_at)}</p>
                <p className="text-muted-foreground">Resultado análise:</p><p className="font-mono">{analysis.result || '—'}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem análise Punter vinculada (entrada manual).</p>
            )}
          </section>

          {/* Eventos / logs */}
          <section className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Eventos do jogo / liquidações registradas
            </h3>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado para este jogo.</p>
            ) : (
              <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                {logs.map(l => (
                  <li key={l.id} className="text-xs border-l-2 border-border pl-2 py-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-muted-foreground">{fmt(l.created_at)}</span>
                      <span className={`font-mono font-semibold ${l.outcome === 'green' ? 'text-success' : l.outcome === 'red' ? 'text-destructive' : l.outcome === 'error' ? 'text-destructive' : 'text-warning'}`}>
                        {(l.outcome || l.result || '?').toUpperCase()}
                      </span>
                      {l.status_old && l.status_new && (
                        <span className="font-mono text-muted-foreground">{l.status_old} → {l.status_new}</span>
                      )}
                    </div>
                    {l.reason && <p className="text-muted-foreground mt-0.5">{l.reason}</p>}
                    {l.error_message && <p className="text-destructive mt-0.5">⚠ {l.error_message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Motivo do pending */}
          {isPending && (
            <section className="bg-warning/5 border border-warning/30 rounded-xl p-4 space-y-2">
              <h3 className="font-mono text-xs uppercase tracking-wider text-warning flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Por que ainda está pendente?
              </h3>
              <ul className="space-y-1 text-sm">
                {reasons.map((r, i) => (
                  <li key={i} className="flex gap-2"><Info className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" /><span>{r}</span></li>
                ))}
              </ul>
            </section>
          )}

          {/* Ações sugeridas */}
          {suggestedActions.length > 0 && (
            <section className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ações sugeridas
              </h3>
              <div className="flex flex-col gap-2">
                {suggestedActions.map((a, i) => (
                  <Button key={i} variant={a.variant || 'default'} disabled={reprocessing} onClick={() => a.onClick()} className="justify-start gap-2">
                    {a.variant === 'outline' ? <ExternalLink className="w-4 h-4" /> : <RefreshCw className={`w-4 h-4 ${reprocessing ? 'animate-spin' : ''}`} />}
                    {a.label}
                  </Button>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
