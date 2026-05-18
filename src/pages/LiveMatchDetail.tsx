import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Activity, History, Trophy, Clock, Target, AlertTriangle, TrendingUp, Loader2, Wallet, ExternalLink, Bell, BellOff, Lock, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useLiveMatches } from '@/hooks/useLiveMatches';
import { useSportsBankroll } from '@/hooks/useSportsBankroll';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import GoldButton from '@/components/game/GoldButton';
import { supabase } from '@/integrations/supabase/client';
import { getPushPermission, requestPushPermission, showBrowserPush, type PushPermission } from '@/lib/browserPush';
import MatchMycroftChat from '@/components/arena-trader/MatchMycroftChat';
import { isExpiredHtSignal } from '@/lib/signalValidity';
import { formatMatchPeriod } from '@/lib/matchPeriod';
import { useAdmin } from '@/hooks/useAdmin';
import AdminStatsEditorModal from '@/components/dashboard/AdminStatsEditorModal';

interface SnapshotEvent {
  at: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  verdict?: string;
  confidence?: number;
  market?: string;
  odd?: number;
  stats?: any;
}

interface VerdictSession {
  verdict: string;
  market?: string;
  odd?: number;
  confidence?: number;
  firstAt: string;
  lastAt: string;
  firstMinute: number;
  lastMinute: number;
  count: number;
  scoreChanged: boolean;
  scoreFinal: { home: number; away: number };
}

// Agrupa snapshots consecutivos com o mesmo verdict+market+odd em "sessões"
function groupHistory(history: SnapshotEvent[]): VerdictSession[] {
  const sessions: VerdictSession[] = [];
  for (const ev of history) {
    if (!ev.verdict) continue;
    const last = sessions[sessions.length - 1];
    const sameSession =
      last &&
      last.verdict === ev.verdict &&
      last.market === ev.market &&
      Number(last.odd ?? 0).toFixed(2) === Number(ev.odd ?? 0).toFixed(2);

    if (sameSession) {
      last.lastAt = ev.at;
      last.lastMinute = ev.minute;
      last.count += 1;
      last.confidence = ev.confidence ?? last.confidence;
      if (
        last.scoreFinal.home !== ev.scoreHome ||
        last.scoreFinal.away !== ev.scoreAway
      ) {
        last.scoreChanged = true;
        last.scoreFinal = { home: ev.scoreHome, away: ev.scoreAway };
      }
    } else {
      sessions.push({
        verdict: ev.verdict,
        market: ev.market,
        odd: ev.odd,
        confidence: ev.confidence,
        firstAt: ev.at,
        lastAt: ev.at,
        firstMinute: ev.minute,
        lastMinute: ev.minute,
        count: 1,
        scoreChanged: false,
        scoreFinal: { home: ev.scoreHome, away: ev.scoreAway },
      });
    }
  }
  return sessions;
}

const VERDICT_META: Record<string, { icon: string; label: string; tone: string; isActive?: boolean; isCancel?: boolean }> = {
  APROVADO: { icon: '✅', label: 'ENTRADA ATIVA', tone: 'border-success/40 bg-success/10 text-success', isActive: true },
  APROVADO_SITUACIONAL: { icon: '✅', label: 'APROVADO • CONF. REDUZIDA', tone: 'border-success/40 bg-success/10 text-success', isActive: true },
  opportunity: { icon: '✅', label: 'OPORTUNIDADE ATIVA', tone: 'border-success/40 bg-success/10 text-success', isActive: true },
  LABAREDA: { icon: '🔥', label: 'APROVADO LABAREDAS — ALTO RISCO', tone: 'border-orange-500/40 bg-orange-500/10 text-orange-400', isActive: true },
  CUIDADO: { icon: '🟡', label: 'NÃO ENTRE — OBSERVANDO', tone: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' },
  AGUARDAR: { icon: '⏳', label: 'AINDA SEM SINAL', tone: 'border-border bg-muted/20 text-muted-foreground' },
  analyzing: { icon: '🧠', label: 'ANALISANDO', tone: 'border-border bg-muted/20 text-muted-foreground' },
  JOGO_MORTO: { icon: '🛑', label: 'JOGO MORTO', tone: 'border-destructive/40 bg-destructive/10 text-destructive', isCancel: true },
  VETADO: { icon: '⛔', label: 'ENTRADA CANCELADA', tone: 'border-destructive/40 bg-destructive/10 text-destructive', isCancel: true },
  no_value: { icon: '⛔', label: 'SEM VALOR — CANCELADA', tone: 'border-destructive/40 bg-destructive/10 text-destructive', isCancel: true },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtTimeSec(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const verdictColors: Record<string, string> = {
  APROVADO: 'bg-success/20 text-success border-success/40',
  APROVADO_SITUACIONAL: 'bg-success/20 text-success border-success/40',
  opportunity: 'bg-success/20 text-success border-success/40',
  LABAREDA: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  CUIDADO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  AGUARDAR: 'bg-muted/40 text-muted-foreground border-border',
  analyzing: 'bg-muted/40 text-muted-foreground border-border',
  JOGO_MORTO: 'bg-destructive/20 text-destructive border-destructive/40',
  VETADO: 'bg-destructive/20 text-destructive border-destructive/40',
  no_value: 'bg-destructive/20 text-destructive border-destructive/40',
};

// Traduz chaves técnicas para rótulos amigáveis em PT-BR
const FRIENDLY_LABELS: Record<string, string> = {
  xG_home: 'Gols Esperados (Mandante)',
  xG_away: 'Gols Esperados (Visitante)',
  xg_home: 'Gols Esperados (Mandante)',
  xg_away: 'Gols Esperados (Visitante)',
  shots_home: 'Chutes (Mandante)',
  shots_away: 'Chutes (Visitante)',
  shots_total_home: 'Total de Chutes (Mandante)',
  shots_total_away: 'Total de Chutes (Visitante)',
  shots_on_target_home: 'Chutes no Gol (Mandante)',
  shots_on_target_away: 'Chutes no Gol (Visitante)',
  attacks_home: 'Ataques (Mandante)',
  attacks_away: 'Ataques (Visitante)',
  dangerous_attacks_home: 'Ataques Perigosos (Mandante)',
  dangerous_attacks_away: 'Ataques Perigosos (Visitante)',
  possession_home: 'Posse de Bola (Mandante)',
  possession_away: 'Posse de Bola (Visitante)',
  corners_home: 'Escanteios (Mandante)',
  corners_away: 'Escanteios (Visitante)',
  cards_home: 'Cartões (Mandante)',
  cards_away: 'Cartões (Visitante)',
  fouls_home: 'Faltas (Mandante)',
  fouls_away: 'Faltas (Visitante)',
};

function friendlyLabel(key: string): string {
  if (FRIENDLY_LABELS[key]) return FRIENDLY_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\bhome\b/gi, 'Mandante')
    .replace(/\baway\b/gi, 'Visitante')
    .replace(/\bxg\b/gi, 'Gols Esperados')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPercentKey(key: string): boolean {
  return /possession|percent|pct|rate/i.test(key);
}

function formatValue(key: string, value: any): string {
  if (value == null) return '-';
  if (typeof value === 'number') {
    const suffix = isPercentKey(key) ? '%' : '';
    return `${Number.isInteger(value) ? value : value.toFixed(2)}${suffix}`;
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string') return value;
  return String(value);
}

// Renderiza um objeto de estatísticas como pares amigáveis Mandante x Visitante
function renderStatsObject(obj: Record<string, any>) {
  // Agrupa pares home/away
  const pairs: Array<{ label: string; home?: any; away?: any; key: string }> = [];
  const used = new Set<string>();
  const keys = Object.keys(obj);

  for (const k of keys) {
    if (used.has(k)) continue;
    const lower = k.toLowerCase();
    let baseKey: string | null = null;
    let isHome = false;
    if (lower.endsWith('_home')) { baseKey = k.slice(0, -5); isHome = true; }
    else if (lower.endsWith('_away')) { baseKey = k.slice(0, -5); isHome = false; }

    if (baseKey) {
      const counterpart = isHome ? `${baseKey}_away` : `${baseKey}_home`;
      const matched = keys.find(kk => kk.toLowerCase() === counterpart.toLowerCase());
      if (matched) {
        used.add(k);
        used.add(matched);
        pairs.push({
          key: baseKey,
          label: friendlyLabel(baseKey),
          home: isHome ? obj[k] : obj[matched],
          away: isHome ? obj[matched] : obj[k],
        });
        continue;
      }
    }
    used.add(k);
    pairs.push({ key: k, label: friendlyLabel(k), home: obj[k], away: undefined });
  }

  return (
    <div className="space-y-2">
      {pairs.map((p, idx) => (
        <div key={p.key + idx} className="bg-muted/20 rounded-lg p-3 border border-border/40">
          <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground mb-1.5">
            {p.label.replace(/\s*\((Mandante|Visitante)\)/, '')}
          </p>
          {p.away !== undefined ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex-1 text-left">
                <span className="text-[9px] text-muted-foreground block">Mandante</span>
                <span className="text-foreground font-bold tabular-nums">{formatValue(p.key + '_home', p.home)}</span>
              </div>
              <div className="text-muted-foreground">×</div>
              <div className="flex-1 text-right">
                <span className="text-[9px] text-muted-foreground block">Visitante</span>
                <span className="text-foreground font-bold tabular-nums">{formatValue(p.key + '_away', p.away)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground break-words">
              {typeof p.home === 'object' && p.home !== null
                ? renderStatsObject(p.home)
                : formatValue(p.key, p.home)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function StatRow({ label, home, away, suffix = '' }: { label: string; home?: number | null; away?: number | null; suffix?: string }) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  const pctH = (h / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-orbitron uppercase tracking-wider">
        <span className="text-foreground font-bold">{home ?? '-'}{suffix}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-bold">{away ?? '-'}{suffix}</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden flex">
        <div className="bg-primary h-full transition-all" style={{ width: `${pctH}%` }} />
        <div className="bg-secondary h-full transition-all" style={{ width: `${100 - pctH}%` }} />
      </div>
    </div>
  );
}

export default function LiveMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { matches, loading } = useLiveMatches();
  const { bankroll, placeBet } = useSportsBankroll();
  const [history, setHistory] = useState<SnapshotEvent[]>([]);
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [customStake, setCustomStake] = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [pushPerm, setPushPerm] = useState<PushPermission>('default');
  const [statsEditorOpen, setStatsEditorOpen] = useState(false);
  const { isAdmin } = useAdmin();
  const lastNotifiedRef = useRef<{ approved?: string; cancelled?: string }>({});

  // Fallback: se o jogo não estiver mais no feed ao vivo, busca direto no banco
  const [fallbackMatch, setFallbackMatch] = useState<any | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackTried, setFallbackTried] = useState(false);

  const liveMatch = useMemo(() => matches.find(m => m.id === id), [matches, id]);

  useEffect(() => {
    if (loading || liveMatch || !id || fallbackTried) return;
    setFallbackLoading(true);
    (async () => {
      try {
        // 1) live_matches por id ou match_id
        const { data: lm } = await supabase
          .from('live_matches')
          .select('*')
          .or(`id.eq.${id},match_id.eq.${id}`)
          .maybeSingle();

        let analysisRow: any = null;
        let matchKey: string | null = lm?.match_id || null;

        // 2) mycroft_analyses por match_id (se já temos)
        if (matchKey) {
          const { data: an } = await supabase
            .from('mycroft_analyses')
            .select('*')
            .eq('match_id', matchKey)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          analysisRow = an;
        }

        // 3) Se ainda não temos análise, tenta direto por id (mycroft_analyses)
        if (!analysisRow) {
          const { data: an } = await supabase
            .from('mycroft_analyses')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (an) {
            analysisRow = an;
            matchKey = matchKey || an.match_id;
          }
        }

        // 4) Se ainda não achou, tenta em mycroft_analyses_shadow_af (cards "Sinais Aprovados (API Football)")
        let shadowRow: any = null;
        if (!analysisRow) {
          const { data: sh } = await (supabase as any)
            .from('mycroft_analyses_shadow_af')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (sh) {
            shadowRow = sh as any;
            matchKey = matchKey || sh.match_id;
            analysisRow = {
              id: sh.id,
              match_id: sh.match_id,
              verdict: sh.verdict,
              market: sh.market,
              odd: sh.odd,
              confidence: sh.confidence,
              thesis: sh.thesis,
              alerts: sh.alerts,
              risk_management: sh.risk_management,
              fundamentation: sh.fundamentation,
              plan_name: sh.plan_name,
              created_at: sh.created_at,
              result: sh.result,
              final_score_home: sh.final_score_home,
              final_score_away: sh.final_score_away,
              settled_at: sh.settled_at,
              settle_reason: sh.settle_reason,
              approved_at_minute: sh.approved_at_minute,
              approved_at_score_home: sh.approved_at_score_home,
              approved_at_score_away: sh.approved_at_score_away,
              stats_snapshot: sh.stats_snapshot,
              _provider: sh.provider || 'api-football',
            };
          }
        }

        // 5) Se temos matchKey mas não temos lm, busca live_matches por match_id agora
        let liveRow: any = lm;
        if (!liveRow && matchKey) {
          const { data: lm2 } = await supabase
            .from('live_matches')
            .select('*')
            .eq('match_id', matchKey)
            .maybeSingle();
          liveRow = lm2;
        }

        if (liveRow) {
          setFallbackMatch({ ...liveRow, mycroft_analysis: analysisRow, _finished: !!analysisRow?.settled_at });
        } else if (analysisRow) {
          // Sintetiza match a partir do snapshot da análise
          const snap = analysisRow.stats_snapshot || {};
          setFallbackMatch({
            id: analysisRow.id || id,
            match_id: matchKey || id,
            home_team: snap.home_team || 'Mandante',
            away_team: snap.away_team || 'Visitante',
            championship: snap.league || '—',
            score_home: analysisRow.final_score_home ?? snap.score_home ?? analysisRow.approved_at_score_home ?? 0,
            score_away: analysisRow.final_score_away ?? snap.score_away ?? analysisRow.approved_at_score_away ?? 0,
            minute: snap.minute ?? analysisRow.approved_at_minute ?? 0,
            stats: snap.stats || {},
            updated_at: analysisRow.settled_at || analysisRow.created_at,
            mycroft_analysis: analysisRow,
            _finished: true,
          });
        }
      } catch (e) {
        console.error('LiveMatchDetail fallback error', e);
      } finally {
        setFallbackLoading(false);
        setFallbackTried(true);
      }
    })();
  }, [loading, liveMatch, id, fallbackTried]);

  const match = liveMatch || fallbackMatch;
  const stats = (match?.stats as any) || {};
  const analysis = match?.mycroft_analysis;


  useEffect(() => {
    setPushPerm(getPushPermission());
  }, []);

  // Build session history of updates (in-memory)
  useEffect(() => {
    if (!match) return;
    setHistory(prev => {
      const last = prev[prev.length - 1];
      const next: SnapshotEvent = {
        at: new Date().toISOString(),
        scoreHome: match.score_home ?? 0,
        scoreAway: match.score_away ?? 0,
        minute: match.minute ?? 0,
        verdict: analysis?.verdict,
        confidence: analysis?.confidence,
        market: analysis?.market,
        odd: analysis?.odd != null ? Number(analysis.odd) : undefined,
        stats,
      };
      if (
        !last ||
        last.scoreHome !== next.scoreHome ||
        last.scoreAway !== next.scoreAway ||
        last.minute !== next.minute ||
        last.verdict !== next.verdict ||
        last.confidence !== next.confidence ||
        last.market !== next.market ||
        last.odd !== next.odd
      ) {
        return [...prev.slice(-49), next];
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.updated_at, analysis?.verdict, analysis?.confidence, analysis?.market, analysis?.odd]);

  // Detecta transições e dispara push + Telegram
  useEffect(() => {
    if (!match || !analysis?.verdict || !analysis?.market) return;

    const currentVerdict = String(analysis.verdict).toUpperCase();
    const isLabareda = currentVerdict.includes('LABAREDA');
    const isApproved = currentVerdict.includes('APROVAD') || isLabareda;
    const isRejected = ['VETADO', 'SEM VALOR', 'REJEITADO', 'CANCELADO'].some(v =>
      currentVerdict.includes(v),
    );

    const prevDifferent = [...history]
      .reverse()
      .find(h => h.verdict && h.verdict !== analysis.verdict);
    const prevWasApproved = prevDifferent
      ? String(prevDifferent.verdict).toUpperCase().includes('APROVAD')
      : false;

    const marketKey = `${match.match_id}::${analysis.market}::${Number(analysis.odd ?? 0).toFixed(2)}`;

    if (isApproved && lastNotifiedRef.current.approved !== marketKey) {
      lastNotifiedRef.current.approved = marketKey;
      const pushTitle = isLabareda
        ? `⚡ APROVADO LABAREDAS: ${analysis.market}`
        : `✅ APROVADO: ${analysis.market}`;
      showBrowserPush(
        pushTitle,
        `${match.home_team} x ${match.away_team} • ${match.score_home ?? 0}:${match.score_away ?? 0} ${match.minute ?? 0}' • Odd ${Number(analysis.odd ?? 0).toFixed(2)} (${analysis.confidence ?? '—'}%)`,
        { tag: marketKey, url: window.location.href },
      );
      supabase.functions.invoke('notify-trader-event', {
        body: {
          match_id: match.match_id,
          market: analysis.market,
          event_type: isLabareda ? 'LABAREDA' : 'APROVADO',
          home_team: match.home_team,
          away_team: match.away_team,
          league: match.championship,
          odd: Number(analysis.odd ?? 0),
          confidence: analysis.confidence,
          minute: match.minute,
          score_home: match.score_home,
          score_away: match.score_away,
        },
      }).catch(err => console.error('notify approved failed', err));
    }

    if (isRejected && prevWasApproved && lastNotifiedRef.current.cancelled !== marketKey) {
      lastNotifiedRef.current.cancelled = marketKey;
      showBrowserPush(
        `⚠️ CANCELADO: ${prevDifferent?.market ?? analysis.market}`,
        `${match.home_team} x ${match.away_team} • ${match.minute ?? 0}' • Mycroft detectou condição adversa`,
        { tag: `cancel-${marketKey}`, url: window.location.href },
      );
      supabase.functions.invoke('notify-trader-event', {
        body: {
          match_id: match.match_id,
          market: prevDifferent?.market ?? analysis.market,
          event_type: 'CANCELADO',
          home_team: match.home_team,
          away_team: match.away_team,
          league: match.championship,
          minute: match.minute,
          score_home: match.score_home,
          score_away: match.score_away,
          previous_market: prevDifferent?.market,
          previous_odd: prevDifferent?.odd,
          previous_confidence: prevDifferent?.confidence,
        },
      }).catch(err => console.error('notify cancelled failed', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.verdict, analysis?.market, analysis?.odd, match?.match_id]);

  const handleEnablePush = async () => {
    const result = await requestPushPermission();
    setPushPerm(result);
    if (result === 'granted') {
      toast.success('Notificações ativadas! Você receberá alertas de entradas e cancelamentos.');
    } else if (result === 'denied') {
      toast.error('Permissão negada. Ative manualmente nas configurações do navegador.');
    } else if (result === 'unsupported') {
      toast.error('Seu navegador não suporta notificações push.');
    }
  };

  const recommendedStake = bankroll ? Math.round(bankroll.balance * 0.05 * 100) / 100 : 0;

  const handleManualBet = async () => {
    if (!match || !analysis || !bankroll) return;
    const stake = Number(customStake);
    if (!stake || stake <= 0) {
      toast.error('Informe um valor válido para a stake.');
      return;
    }
    if (stake > bankroll.balance) {
      toast.error('Saldo insuficiente na banca virtual.');
      return;
    }
    setBetLoading(true);
    const result = await placeBet({
      id: (analysis as any).id || match.id,
      match_id: match.match_id || match.id,
      market: analysis.market || 'N/A',
      odd: Number(analysis.odd) || 1.01,
      home_team: match.home_team,
      away_team: match.away_team,
    });
    setBetLoading(false);
    if (result.success) {
      toast.success(`Aposta virtual registrada: R$ ${stake.toFixed(2)}`);
      setBetDialogOpen(false);
      setCustomStake('');
    } else {
      toast.error(result.error || 'Falha ao registrar aposta.');
    }
  };

  const openBetfair = () => {
    const query = encodeURIComponent(`${match?.home_team || ''} ${match?.away_team || ''}`.trim());
    const url = `https://www.betfair.bet.br/exchange/plus/pt/futebol-aposta-1/search?q=${query}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading || fallbackLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground max-w-md">
          Este jogo já foi finalizado e saiu do feed ao vivo. Veja o desfecho no seu histórico de sinais.
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          <GoldButton onClick={() => navigate('/historico')}>
            <History className="w-4 h-4 mr-2" /> Ver histórico
          </GoldButton>
          <Button variant="outline" onClick={() => navigate('/arena-trader-sports')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const verdictClass = verdictColors[analysis?.verdict || ''] || verdictColors.AGUARDAR;

  // 🛡️ Sinal de 1º tempo deixa de valer após o intervalo
  const htSignalExpired = isExpiredHtSignal({
    market: analysis?.market,
    minute: match?.minute,
    period: match?.period,
    status: match?.status,
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/arena-trader-sports')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-orbitron uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" /> Retornar
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs font-orbitron uppercase tracking-wider text-primary truncate max-w-[200px] sm:max-w-none">
              {match.championship}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Scoreboard */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-6 sm:p-8"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            {(analysis as any)?.result === 'green' ? (
              <span className="px-3 py-1 rounded-full bg-success/20 border border-success/40 text-success text-[10px] font-orbitron uppercase tracking-[0.2em]">
                🟢 GREEN — Sinal vencedor
              </span>
            ) : (analysis as any)?.result === 'red' ? (
              <span className="px-3 py-1 rounded-full bg-destructive/20 border border-destructive/40 text-destructive text-[10px] font-orbitron uppercase tracking-[0.2em]">
                🔴 RED — Sinal perdedor
              </span>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                </span>
                <span className="text-[10px] font-orbitron uppercase tracking-[0.2em] text-destructive">
                  AO VIVO
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 items-center gap-4">
            {/* Home */}
            <div className="flex flex-col items-center gap-2 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                {match.home_logo && /^https?:\/\//.test(match.home_logo) ? (
                  <img
                    src={match.home_logo}
                    alt={match.home_team}
                    width={80}
                    height={80}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    loading="lazy"
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = 'none';
                      const fb = t.nextElementSibling as HTMLElement | null;
                      if (fb) fb.style.display = 'block';
                    }}
                  />
                ) : null}
                <span
                  className="text-4xl sm:text-6xl"
                  style={{ display: match.home_logo && /^https?:\/\//.test(match.home_logo) ? 'none' : 'block' }}
                >
                  ⚽
                </span>
              </div>
              <p className="font-orbitron text-xs sm:text-base font-bold text-foreground truncate max-w-full text-center">
                {match.home_team}
              </p>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-2 min-w-0">
              <div className="font-orbitron text-4xl sm:text-7xl font-black text-foreground tabular-nums whitespace-nowrap">
                {match.score_home ?? 0}
                <span className="text-muted-foreground mx-2">:</span>
                {match.score_away ?? 0}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-orbitron uppercase tracking-wider text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{match.minute ?? 0}'</span>
                {match.period && <span className="truncate">• {formatMatchPeriod(match.period)}</span>}
              </div>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-2 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                {match.away_logo && /^https?:\/\//.test(match.away_logo) ? (
                  <img
                    src={match.away_logo}
                    alt={match.away_team}
                    width={80}
                    height={80}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    loading="lazy"
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = 'none';
                      const fb = t.nextElementSibling as HTMLElement | null;
                      if (fb) fb.style.display = 'block';
                    }}
                  />
                ) : null}
                <span
                  className="text-4xl sm:text-6xl"
                  style={{ display: match.away_logo && /^https?:\/\//.test(match.away_logo) ? 'none' : 'block' }}
                >
                  ⚽
                </span>
              </div>
              <p className="font-orbitron text-xs sm:text-base font-bold text-foreground truncate max-w-full text-center">
                {match.away_team}
              </p>
            </div>
          </div>

          {analysis && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Badge className={cn('font-orbitron uppercase tracking-wider border', htSignalExpired ? 'bg-muted/40 text-muted-foreground border-border line-through' : verdictClass)}>
                {analysis.verdict}
              </Badge>
              {analysis.market && (
                <Badge variant="outline" className={cn('font-orbitron text-xs', htSignalExpired && 'line-through text-muted-foreground')}>
                  {analysis.market}
                </Badge>
              )}
              {analysis.odd != null && (
                <Badge variant="outline" className={cn('font-orbitron text-xs', htSignalExpired && 'line-through text-muted-foreground')}>
                  Odd {Number(analysis.odd).toFixed(2)}
                </Badge>
              )}
              {analysis.confidence != null && (
                <Badge variant="outline" className={cn('font-orbitron text-xs', htSignalExpired && 'line-through text-muted-foreground')}>
                  Confiança {Math.round(Number(analysis.confidence) * (analysis.confidence > 1 ? 1 : 100))}%
                </Badge>
              )}
            </div>
          )}

          {(analysis?.approved_at_timestamp || analysis?.approved_at_minute != null) && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-2 flex items-center gap-1.5 pl-1 text-left text-[11px] text-muted-foreground font-medium cursor-help">
                    <Lock className="w-3 h-3 text-emerald-500/80" aria-hidden="true" />
                    <span>
                      Sinal aprovado no minuto {analysis.approved_at_minute ?? 0}'
                      {' | '}Placar: {analysis.approved_at_score_home ?? 0}:{analysis.approved_at_score_away ?? 0}
                      {analysis.approved_at_period && (
                        <>{' | '}{formatMatchPeriod(analysis.approved_at_period)}</>
                      )}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                  <p className="font-medium mb-1">📌 Snapshot imutável</p>
                  <p className="text-muted-foreground">
                    Estes dados foram registrados no momento exato da aprovação e
                    não podem ser alterados.
                  </p>
                  {(analysis.approved_at_timestamp || analysis.created_at) && (
                    <p className="mt-1.5 text-muted-foreground">
                      Aprovado em:{' '}
                      <span className="font-mono">
                        {new Date(analysis.approved_at_timestamp || analysis.created_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </span>
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {!htSignalExpired && analysis && (VERDICT_META[String(analysis.verdict).toUpperCase()]?.isActive) && (
            <div className="mt-4 mx-auto max-w-2xl rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-center">
              <p className="text-xs sm:text-sm font-orbitron uppercase tracking-wider text-yellow-400">
                ⚠️ CUIDADO
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
                O sinal pode ser cancelado caso o cenário mude.
              </p>
            </div>
          )}

          {htSignalExpired && analysis && (
            <div className="mt-4 mx-auto max-w-2xl rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-center">
              <p className="text-xs sm:text-sm font-orbitron uppercase tracking-wider text-destructive">
                ⌛ Entrada expirada
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
                Este sinal era válido apenas durante o 1º tempo. O jogo está no minuto {match.minute ?? 0}' — não entre mais.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
            <Button
              onClick={() => {
                if (!bankroll) {
                  toast.error('Banca virtual ainda carregando...');
                  return;
                }
                setCustomStake(recommendedStake.toString());
                setBetDialogOpen(true);
              }}
              disabled={!analysis || !analysis.odd || htSignalExpired}
              className="w-full bg-success/20 hover:bg-success/30 text-success border border-success/40 font-orbitron uppercase tracking-wider"
              variant="outline"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {htSignalExpired ? 'Entrada Indisponível' : 'Entrada Manual (Virtual)'}
            </Button>
            <Button
              onClick={openBetfair}
              className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-orbitron uppercase tracking-wider"
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir na Betfair
            </Button>
            <Button
              onClick={handleEnablePush}
              disabled={pushPerm === 'granted' || pushPerm === 'unsupported'}
              className={cn(
                'w-full font-orbitron uppercase tracking-wider border',
                pushPerm === 'granted'
                  ? 'bg-success/10 text-success border-success/40 cursor-default'
                  : 'bg-warning/20 hover:bg-warning/30 text-warning border-warning/40',
              )}
              variant="outline"
            >
              {pushPerm === 'granted' ? (
                <><Bell className="w-4 h-4 mr-2" />Notificações Ativas</>
              ) : (
                <><BellOff className="w-4 h-4 mr-2" />Ativar Push + Telegram</>
              )}
            </Button>
          </div>
          {analysis && !analysis.odd && (
            <p className="mt-2 text-[10px] text-center text-muted-foreground">
              Aguardando odd da análise para liberar entrada virtual.
            </p>
          )}
        </motion.section>

        {/* Tabs */}
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="analysis" className="font-orbitron text-xs uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5 mr-1" /> Mycroft
            </TabsTrigger>
            <TabsTrigger value="stats" className="font-orbitron text-xs uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 mr-1" /> Estatísticas
            </TabsTrigger>
            <TabsTrigger value="history" className="font-orbitron text-xs uppercase tracking-wider">
              <History className="w-3.5 h-3.5 mr-1" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Análise Mycroft */}
          <TabsContent value="analysis" className="mt-4 space-y-4">
            {!analysis ? (
              <div className="luxury-card p-8 text-center space-y-2">
                <Brain className="w-10 h-10 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  O Mycroft está fazendo uma reanálise da partida em busca de oportunidades.
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-orbitron uppercase">{match.mycroft_status || 'aguardando'}</span>
                </p>
              </div>
            ) : (
              <>
                {/* Chat com Mycroft sobre essa partida — topo para acesso rápido */}
                <MatchMycroftChat
                  matchContext={{
                    match_id: match.match_id || match.id,
                    home_team: match.home_team,
                    away_team: match.away_team,
                    league: match.championship,
                    minute: match.minute ?? 0,
                    score_home: match.score_home ?? 0,
                    score_away: match.score_away ?? 0,
                    stats,
                    analysis: analysis
                      ? {
                          verdict: analysis.verdict,
                          market: analysis.market,
                          odd: analysis.odd != null ? Number(analysis.odd) : undefined,
                          confidence: analysis.confidence,
                          thesis: analysis.thesis,
                          alerts: analysis.alerts,
                        }
                      : undefined,
                  }}
                />

                {/* Indicador xG indisponível */}
                {stats?.xg_unavailable && (
                  <div className="luxury-card p-4 border border-amber-500/40 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-amber-300 font-orbitron uppercase tracking-wider">
                          xG indisponível nesta partida
                        </p>
                        <p className="text-xs text-amber-100/80 leading-relaxed">
                          A fonte de dados (SofaScore/Futodds) não retornou Gols Esperados para este jogo —{' '}
                          <strong>isso não significa xG = 0</strong>. O Mycroft removeu o critério de xG do cálculo
                          e baseou a análise em ataques perigosos, chutes (totais e no gol), posse, big chances e momentum.
                          Como resultado, a confiança do sinal foi reduzida em ~10pp e o risco classificado é mais conservador.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {stats?.xg_estimated && !stats?.xg_unavailable && (
                  <div className="luxury-card p-4 border border-blue-500/40 bg-blue-500/5">
                    <div className="flex items-start gap-3">
                      <Activity className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-blue-300 font-orbitron uppercase tracking-wider">
                          xG estimado (sintético)
                        </p>
                        <p className="text-xs text-blue-100/80 leading-relaxed">
                          xG calculado via Flashscore a partir de chutes (não é o xG oficial SofaScore).
                          Mycroft usa este valor com peso reduzido (~10pp) e prioriza chutes, ataques e posse.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tese */}
                <div className="luxury-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                      Tese
                    </h3>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {analysis.thesis || 'Sem tese disponível.'}
                  </p>
                </div>

                {/* Fundamentação removida — poluição visual; tese + alertas já cobrem o necessário */}

                {/* Gestão de Risco */}
                {analysis.risk_management && (
                  <div className="luxury-card p-5 space-y-3">
                    <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                      Gestão de Risco
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(analysis.risk_management).map(([k, v]) => (
                        <div key={k} className="bg-muted/20 rounded-lg p-3 border border-border/40">
                          <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground mb-2">
                            {friendlyLabel(k)}
                          </p>
                          {typeof v === 'object' && v !== null ? (
                            renderStatsObject(v as Record<string, any>)
                          ) : (
                            <p className="text-sm text-foreground break-words">{formatValue(k, v)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alertas */}
                {analysis.alerts && analysis.alerts.length > 0 && (
                  <div className="luxury-card p-5 space-y-3 border-yellow-500/40">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <h3 className="font-orbitron text-sm uppercase tracking-wider text-yellow-400">
                        Alertas
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {analysis.alerts.map((alert, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">⚠</span>
                          <span>{alert}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </>
            )}
          </TabsContent>

          {/* Estatísticas */}
          <TabsContent value="stats" className="mt-4">
            <div className="luxury-card p-5 space-y-5">
              {isAdmin && (
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
                  <div className="text-[11px] text-amber-300/90 leading-snug">
                    🛠️ <strong>Modo Admin:</strong> você pode corrigir manualmente qualquer estatística zerada/faltando (xG, posse, chutes, escanteios, odd da entrada).
                  </div>
                  <button
                    onClick={() => setStatsEditorOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase rounded-md bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar Stats
                  </button>
                </div>
              )}
              {Object.keys(stats).length === 0 && !isAdmin ? (
                <div className="text-center py-8 space-y-2">
                  <Activity className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Estatísticas indisponíveis no momento.</p>
                </div>
              ) : (
                <>
                  <StatRow
                    label={
                      stats.xg_unavailable
                        ? 'xG (indisponível — não considerado)'
                        : stats.xg_estimated
                        ? 'xG (estimado — peso reduzido)'
                        : 'xG (Gols Esperados)'
                    }
                    home={stats.xG_home ?? stats.xg_home ?? 0}
                    away={stats.xG_away ?? stats.xg_away ?? 0}
                  />
                  {stats.xg_unavailable && (
                    <p className="text-[11px] text-amber-300/80 -mt-2 pl-1 leading-snug">
                      ⚠️ Fonte não retornou xG. Mycroft ignorou este critério e reduziu a confiança em ~10pp.
                    </p>
                  )}
                  <StatRow label="Posse de Bola" home={stats.possession_home} away={stats.possession_away} suffix="%" />
                  <StatRow label="Ataques Perigosos" home={stats.dangerous_attacks_home ?? stats.attacks_home} away={stats.dangerous_attacks_away ?? stats.attacks_away} />
                  <StatRow label="Chutes" home={stats.shots_total_home ?? stats.shots_home} away={stats.shots_total_away ?? stats.shots_away} />
                  <StatRow label="Chutes no Gol" home={stats.shots_on_target_home} away={stats.shots_on_target_away} />
                  <StatRow label="Escanteios" home={stats.corners_home} away={stats.corners_away} />
                  <StatRow label="Cartões" home={stats.cards_home} away={stats.cards_away} />
                  {stats.odd_manual != null && Number(stats.odd_manual) > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-[11px] font-orbitron uppercase tracking-wider text-amber-300">Odd manual (admin)</span>
                      <span className="text-amber-200 font-bold tabular-nums">{Number(stats.odd_manual).toFixed(2)}</span>
                    </div>
                  )}
                  {stats.admin_override && (
                    <p className="text-[10px] text-amber-300/70 text-center">
                      ✏️ Algumas estatísticas foram corrigidas manualmente pelo admin.
                    </p>
                  )}
                </>
              )}
              <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground text-center pt-3 border-t border-border/40">
                Atualização automática em tempo real
              </p>
            </div>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="history" className="mt-4">
            <div className="luxury-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                  Histórico de Atualizações
                </h3>
              </div>
              {(() => {
                const sessions = groupHistory(history);
                if (sessions.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aguardando análises do Mycroft...
                    </p>
                  );
                }
                const reversed = [...sessions].reverse();
                return (
                  <ol className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {reversed.map((s, i) => {
                      const meta = VERDICT_META[s.verdict] || {
                        icon: '•',
                        label: s.verdict.toUpperCase(),
                        tone: 'border-border bg-muted/20 text-foreground',
                      };
                      // A "sessão anterior cronologicamente" é a próxima no array reverso
                      const previousChrono = reversed[i + 1];
                      const isCurrent = i === 0;
                      const showCancelDetail =
                        meta.isCancel &&
                        previousChrono &&
                        (VERDICT_META[previousChrono.verdict]?.isActive);
                      const confidencePct =
                        s.confidence != null
                          ? Math.round(Number(s.confidence) * (s.confidence > 1 ? 1 : 100))
                          : null;

                      return (
                        <li
                          key={s.firstAt + i}
                          className={cn(
                            'rounded-lg p-3 border space-y-1.5',
                            meta.tone,
                            isCurrent && meta.isActive && 'ring-1 ring-success/40'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base leading-none shrink-0">{meta.icon}</span>
                              <span className="font-orbitron text-[11px] uppercase tracking-wider font-bold truncate">
                                {meta.label}
                              </span>
                            </div>
                            {isCurrent && meta.isActive && (
                              <span className="shrink-0 text-[9px] font-orbitron uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/40">
                                Atual
                              </span>
                            )}
                          </div>

                          {(s.market || s.odd) && (
                            <p className="text-xs text-foreground/90 font-medium truncate">
                              {s.market || 'Mercado'}{' '}
                              {s.odd != null && (
                                <span className="text-muted-foreground">
                                  • Odd <span className="text-foreground font-bold tabular-nums">{Number(s.odd).toFixed(2)}</span>
                                </span>
                              )}
                            </p>
                          )}

                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Confirmada às{' '}
                            <span className="text-foreground tabular-nums">{fmtTime(s.firstAt)}</span>{' '}
                            ({s.firstMinute}')
                            {s.count > 1 && (
                              <>
                                {' '}→ Última confirmação:{' '}
                                <span className="text-foreground tabular-nums">{fmtTimeSec(s.lastAt)}</span>{' '}
                                ({s.lastMinute}')
                              </>
                            )}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            {confidencePct != null && (
                              <span>
                                Confiança {s.count > 1 ? 'mantida' : ''}:{' '}
                                <span className="text-foreground font-bold">{confidencePct}%</span>
                              </span>
                            )}
                            {s.count > 1 && (
                              <span>• {s.count} verificações consecutivas</span>
                            )}
                            <span>
                              • Placar:{' '}
                              <span className="text-foreground tabular-nums">
                                {s.scoreFinal.home}:{s.scoreFinal.away}
                              </span>
                              {s.scoreChanged && <span className="text-yellow-400"> (alterou)</span>}
                            </span>
                          </div>

                          {showCancelDetail && previousChrono && (
                            <div className="mt-1 pt-1.5 border-t border-current/20 text-[10px] text-muted-foreground">
                              Era:{' '}
                              <span className="text-foreground/80">
                                {previousChrono.market || 'Mercado'}
                                {previousChrono.odd != null && ` | Odd ${Number(previousChrono.odd).toFixed(2)}`}
                                {previousChrono.confidence != null &&
                                  ` | ${Math.round(
                                    Number(previousChrono.confidence) *
                                      (previousChrono.confidence > 1 ? 1 : 100)
                                  )}%`}
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                );
              })()}
              <p className="text-[10px] text-muted-foreground text-center pt-2">
                O histórico cobre apenas a sessão atual (não persistido).
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Manual Bet Dialog */}
      <Dialog open={betDialogOpen} onOpenChange={setBetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-orbitron uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-success" />
              Entrada Manual — Banca Virtual
            </DialogTitle>
            <DialogDescription className="text-xs">
              {match?.home_team} vs {match?.away_team} • {analysis?.market} • Odd {analysis?.odd != null ? Number(analysis.odd).toFixed(2) : '-'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo</p>
                <p className="font-orbitron font-bold text-foreground">
                  R$ {(bankroll?.balance ?? 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sugerido (5%)</p>
                <p className="font-orbitron font-bold text-success">
                  R$ {recommendedStake.toFixed(2)}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground">
                Stake (R$)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={customStake}
                onChange={(e) => setCustomStake(e.target.value)}
                placeholder="0,00"
                className="font-orbitron"
              />
              {Number(customStake) > 0 && analysis?.odd && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Retorno potencial: <span className="text-success font-bold">
                    R$ {(Number(customStake) * Number(analysis.odd)).toFixed(2)}
                  </span> (lucro R$ {(Number(customStake) * (Number(analysis.odd) - 1)).toFixed(2)})
                </p>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground bg-muted/20 rounded p-2 leading-relaxed">
              ⚠️ Esta é uma <strong>aposta virtual</strong> que debita apenas da sua banca de simulação. Use para testar o desempenho do Mycroft sem risco real.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setBetDialogOpen(false)} disabled={betLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleManualBet}
              disabled={betLoading || !customStake || Number(customStake) <= 0}
              className="bg-success/20 hover:bg-success/30 text-success border border-success/40"
              variant="outline"
            >
              {betLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
              Confirmar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && match && (
        <AdminStatsEditorModal
          isOpen={statsEditorOpen}
          onClose={() => setStatsEditorOpen(false)}
          matchId={match.match_id || match.id}
          homeTeam={match.home_team}
          awayTeam={match.away_team}
          currentStats={stats}
        />
      )}
    </div>
  );
}
