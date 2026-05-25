import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Hourglass,
  Trophy,
  Target,
  TrendingUp,
  ShieldAlert,
  BookOpen,
  Calculator,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AnalysisDetail {
  id: string;
  match_id: string;
  market: string;
  verdict: string;
  odd: number | null;
  confidence: number | null;
  thesis: string;
  plan_name: string | null;
  result: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  settled_at: string | null;
  settle_reason: string | null;
  created_at: string;
  fundamentation: any;
  risk_management: any;
  alerts: string[] | null;
}

interface MatchInfo {
  match_id: string;
  home_team: string;
  away_team: string;
  championship: string | null;
  score_home: number | null;
  score_away: number | null;
  status: string | null;
  minute: number | null;
}

const VERDICT_LABELS: Record<string, { label: string; className: string }> = {
  APROVADO: { label: '🎯 APROVADO', className: 'bg-success/15 text-success border-success/40' },
  APROVADO_SITUACIONAL: { label: '🎯 APROVADO • CONF. REDUZIDA', className: 'bg-success/10 text-success border-success/30' },
  LABAREDA: { label: '⚡ APROVADO LABAREDAS', className: 'bg-warning/15 text-warning border-warning/40' },
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isFinishedStatus(status?: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return ['finished', 'ft', 'aet', 'pen', 'fin', 'ended', 'cancelled', 'canceled', 'abandoned'].includes(s);
}

/**
 * Avalia a entrada em relação ao placar final, retornando um texto explicativo
 * de como a entrada virou GREEN/RED/PUSH. Suporta os mercados mais comuns
 * gerados pelo Mycroft (Over/Under gols, BTTS, Resultado, Over HT, etc.).
 */
function explainOutcome(market: string, home: number | null, away: number | null, homeName: string, awayName: string) {
  if (home == null || away == null) return null;
  const total = home + away;
  const m = market.toLowerCase().trim();

  // Over/Under X.5 (FT)
  const ouMatch = m.match(/(over|under)\s*([0-9]+(?:\.[0-9])?)/);
  if (ouMatch && !m.includes('ht') && !m.includes('1t')) {
    const side = ouMatch[1];
    const line = parseFloat(ouMatch[2]);
    if (side === 'over') {
      const ok = total > line;
      return {
        ok,
        text: `Mercado pedia mais de ${line} gols na partida. Placar final ${home}-${away} = ${total} gol(s). ${ok ? 'Entrada bateu a linha → GREEN.' : 'Entrada não bateu a linha → RED.'}`,
      };
    }
    const ok = total < line;
    return {
      ok,
      text: `Mercado pedia menos de ${line} gols na partida. Placar final ${home}-${away} = ${total} gol(s). ${ok ? 'Total ficou abaixo da linha → GREEN.' : 'Total ultrapassou a linha → RED.'}`,
    };
  }

  // BTTS
  if (m.includes('btts') || m.includes('ambas')) {
    const both = home > 0 && away > 0;
    const isNo = m.includes('no') || m.includes('não');
    const ok = isNo ? !both : both;
    return {
      ok,
      text: `Mercado de Ambas Marcam (${isNo ? 'NÃO' : 'SIM'}). Placar ${home}-${away}. ${both ? 'Os dois times marcaram' : 'Pelo menos um time não marcou'} → ${ok ? 'GREEN' : 'RED'}.`,
    };
  }

  // Resultado simples
  if (m === 'casa' || m === 'home' || m === '1') {
    const ok = home > away;
    return { ok, text: `Entrada na vitória do mandante (${homeName}). Placar ${home}-${away}. ${ok ? 'Mandante venceu → GREEN.' : 'Mandante não venceu → RED.'}` };
  }
  if (m === 'fora' || m === 'away' || m === '2') {
    const ok = away > home;
    return { ok, text: `Entrada na vitória do visitante (${awayName}). Placar ${home}-${away}. ${ok ? 'Visitante venceu → GREEN.' : 'Visitante não venceu → RED.'}` };
  }
  if (m === 'empate' || m === 'draw' || m === 'x') {
    const ok = home === away;
    return { ok, text: `Entrada no empate. Placar ${home}-${away}. ${ok ? 'Jogo terminou empatado → GREEN.' : 'Jogo não terminou empatado → RED.'}` };
  }

  // Genérico — só relata placar
  return {
    ok: null as null | boolean,
    text: `Placar final ${home}-${away}. Verifique o mercado "${market}" para confirmar como o resultado foi liquidado.`,
  };
}

export default function MycroftSinalDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from('mycroft_analyses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        console.error('[entrada-detalhe] erro:', error);
        if (mounted) setLoading(false);
        return;
      }

      let matchInfo: MatchInfo | null = null;
      if (data.match_id) {
        const { data: m } = await supabase
          .from('live_matches')
          .select('match_id, home_team, away_team, championship, score_home, score_away, status, minute')
          .eq('match_id', data.match_id)
          .maybeSingle();
        matchInfo = m ?? null;
      }

      if (mounted) {
        setAnalysis(data as AnalysisDetail);
        setMatch(matchInfo);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const finalScore = useMemo(() => {
    if (!analysis) return null;
    if (analysis.final_score_home != null && analysis.final_score_away != null) {
      return { home: analysis.final_score_home, away: analysis.final_score_away, source: 'final' as const };
    }
    if (match?.score_home != null && match?.score_away != null) {
      return { home: match.score_home, away: match.score_away, source: 'live' as const };
    }
    return null;
  }, [analysis, match]);

  const outcome = useMemo(() => {
    if (!analysis || !finalScore) return null;
    return explainOutcome(
      analysis.market,
      finalScore.home,
      finalScore.away,
      match?.home_team ?? 'Mandante',
      match?.away_team ?? 'Visitante',
    );
  }, [analysis, finalScore, match]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-orbitron text-sm text-muted-foreground">Carregando análise...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Análise não encontrada.</p>
        <button onClick={() => navigate(-1)} className="luxury-button-outline px-4 py-2 text-sm">
          Voltar
        </button>
      </div>
    );
  }

  const verdictMeta =
    VERDICT_LABELS[analysis.verdict] ?? { label: analysis.verdict, className: 'bg-muted text-foreground border-border' };

  const finished = isFinishedStatus(match?.status) || !!analysis.settled_at;
  let resultBadge: { label: string; className: string; icon: React.ReactNode };
  if (analysis.result === 'green') {
    resultBadge = {
      label: 'GREEN',
      className: 'bg-success text-success-foreground border-success',
      icon: <CheckCircle2 className="w-4 h-4" />,
    };
  } else if (analysis.result === 'red') {
    resultBadge = {
      label: 'RED',
      className: 'bg-destructive text-destructive-foreground border-destructive',
      icon: <XCircle className="w-4 h-4" />,
    };
  } else if (finished) {
    resultBadge = {
      label: 'EXPIRADO',
      className: 'bg-muted text-muted-foreground border-border',
      icon: <Hourglass className="w-4 h-4" />,
    };
  } else {
    resultBadge = {
      label: 'PENDENTE',
      className: 'bg-warning/15 text-warning border-warning/40',
      icon: <Clock className="w-4 h-4" />,
    };
  }

  const fund = analysis.fundamentation ?? {};
  const risk = analysis.risk_management ?? {};

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/arena-trader-sports/sinais-aprovados')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar para Entradas Aprovadas"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-5 h-5 text-primary shrink-0" />
            <h1 className="font-orbitron text-base md:text-lg font-bold text-primary truncate">
              Detalhes do Entrada
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
        {/* Header card: verdict + result + match */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className={cn('text-xs font-orbitron uppercase px-3 py-1 rounded-full border', verdictMeta.className)}>
              {verdictMeta.label}
            </span>
            <span className={cn('text-xs font-orbitron uppercase px-3 py-1 rounded-full border flex items-center gap-1.5', resultBadge.className)}>
              {resultBadge.icon}
              {resultBadge.label}
            </span>
          </div>

          {match?.championship && (
            <p className="text-[11px] font-orbitron uppercase tracking-wider text-primary">
              {match.championship}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-lg md:text-xl font-bold text-foreground">
                {match?.home_team ?? '—'} <span className="text-muted-foreground font-normal">vs</span> {match?.away_team ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Entrada emitido em {formatDate(analysis.created_at)}</p>
            </div>
            {finalScore && (
              <div className="text-right">
                <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground">
                  {finalScore.source === 'final' ? 'Placar Final' : 'Placar Atual'}
                </p>
                <p className="font-orbitron text-3xl font-bold text-foreground">
                  {finalScore.home} - {finalScore.away}
                </p>
              </div>
            )}
          </div>

          {match?.match_id && (
            <button
              onClick={() => navigate(`/arena-trader-sports/jogo/${match.match_id}`)}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Abrir página da partida
            </button>
          )}
        </motion.section>

        {/* Bet selection */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="luxury-card p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-primary">
            <Target className="w-4 h-4" />
            <h2 className="font-orbitron text-sm uppercase tracking-wider">Entrada Aprovada</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Mercado / Seleção" value={analysis.market} highlight />
            <Field label="Odd recomendada" value={analysis.odd != null ? Number(analysis.odd).toFixed(2) : '—'} />
            <Field label="Confiança" value={analysis.confidence != null ? `${analysis.confidence}%` : '—'} />
            {analysis.plan_name && <Field label="Plano" value={analysis.plan_name} />}
            {risk?.stake_percent != null && <Field label="Stake sugerida" value={`${risk.stake_percent}% da banca`} />}
            {risk?.entry && <Field label="Entrada" value={String(risk.entry)} />}
          </div>
        </motion.section>

        {/* Outcome explanation */}
        {outcome && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'luxury-card p-5 space-y-3 border-2',
              outcome.ok === true && 'border-success/40',
              outcome.ok === false && 'border-destructive/40',
              outcome.ok == null && 'border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <h2 className="font-orbitron text-sm uppercase tracking-wider text-primary">Como o placar gerou o resultado</h2>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{outcome.text}</p>
            {analysis.settle_reason && (
              <p className="text-[11px] text-muted-foreground font-mono">
                Motivo da liquidação: <span className="text-foreground">{analysis.settle_reason}</span>
                {analysis.settled_at && ` • ${formatDate(analysis.settled_at)}`}
              </p>
            )}
          </motion.section>
        )}

        {/* Thesis */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="luxury-card p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="w-4 h-4" />
            <h2 className="font-orbitron text-sm uppercase tracking-wider">Tese do Mycroft</h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{analysis.thesis}</p>
        </motion.section>

        {/* Fundamentation */}
        {fund && (fund.pattern || fund.citation || fund.source || fund.historical_wr) && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="luxury-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-4 h-4" />
              <h2 className="font-orbitron text-sm uppercase tracking-wider">Fundamentação</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fund.pattern && <Field label="Padrão" value={fund.pattern} />}
              {fund.historical_wr && <Field label="WR histórico" value={fund.historical_wr} />}
              {fund.source && <Field label="Fonte" value={fund.source} />}
              {fund.citation && <Field label="Snapshot" value={fund.citation} />}
            </div>
          </motion.section>
        )}

        {/* Risk Management */}
        {risk && (risk.target || risk.stop || risk.ev || risk.rr) && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="luxury-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-primary">
              <ShieldAlert className="w-4 h-4" />
              <h2 className="font-orbitron text-sm uppercase tracking-wider">Gestão de Risco</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {risk.target && <Field label="Alvo" value={String(risk.target)} />}
              {risk.stop && <Field label="Stop" value={String(risk.stop)} />}
              {risk.ev && <Field label="EV" value={String(risk.ev)} />}
              {risk.rr && <Field label="R:R" value={String(risk.rr)} />}
              {risk.stake_value != null && <Field label="Stake (valor)" value={String(risk.stake_value)} />}
            </div>
          </motion.section>
        )}

        {/* Alerts */}
        {analysis.alerts && analysis.alerts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="luxury-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-warning">
              <ShieldAlert className="w-4 h-4" />
              <h2 className="font-orbitron text-sm uppercase tracking-wider">Alertas e observações</h2>
            </div>
            <ul className="space-y-2">
              {analysis.alerts.map((a, i) => (
                <li key={i} className="text-sm text-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2">
                  {a}
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* Timeline */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="luxury-card p-5 space-y-2"
        >
          <div className="flex items-center gap-2 text-primary">
            <Calendar className="w-4 h-4" />
            <h2 className="font-orbitron text-sm uppercase tracking-wider">Linha do tempo</h2>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 font-mono">
            <p>Entrada emitido: <span className="text-foreground">{formatDate(analysis.created_at)}</span></p>
            <p>
              Liquidação:{' '}
              <span className="text-foreground">
                {analysis.settled_at ? formatDate(analysis.settled_at) : 'pendente'}
              </span>
            </p>
            {match?.status && <p>Status da partida: <span className="text-foreground">{match.status}{match.minute != null ? ` (${match.minute}')` : ''}</span></p>}
          </div>
        </motion.section>
      </main>
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-sm break-words', highlight ? 'font-orbitron text-base font-bold text-primary' : 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}
