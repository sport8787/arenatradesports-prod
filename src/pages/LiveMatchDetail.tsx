import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Activity, History, Trophy, Clock, Target, AlertTriangle, TrendingUp, Loader2, Wallet, ExternalLink } from 'lucide-react';
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

interface SnapshotEvent {
  at: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  verdict?: string;
  confidence?: number;
  stats?: any;
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

  const match = useMemo(() => matches.find(m => m.id === id), [matches, id]);
  const stats = (match?.stats as any) || {};
  const analysis = match?.mycroft_analysis;

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
        stats,
      };
      // Only add if something meaningful changed
      if (
        !last ||
        last.scoreHome !== next.scoreHome ||
        last.scoreAway !== next.scoreAway ||
        last.minute !== next.minute ||
        last.verdict !== next.verdict ||
        last.confidence !== next.confidence
      ) {
        return [...prev.slice(-49), next];
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.updated_at, analysis?.verdict, analysis?.confidence]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Jogo não encontrado ou já finalizado.</p>
        <GoldButton onClick={() => navigate('/arena-trader-sports')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </GoldButton>
      </div>
    );
  }

  const verdictClass = verdictColors[analysis?.verdict || ''] || verdictColors.AGUARDAR;

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
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
            <span className="text-[10px] font-orbitron uppercase tracking-[0.2em] text-destructive">
              AO VIVO
            </span>
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
                {match.period && <span className="truncate">• {match.period}</span>}
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
              <Badge className={cn('font-orbitron uppercase tracking-wider border', verdictClass)}>
                {analysis.verdict}
              </Badge>
              {analysis.market && (
                <Badge variant="outline" className="font-orbitron text-xs">
                  {analysis.market}
                </Badge>
              )}
              {analysis.odd != null && (
                <Badge variant="outline" className="font-orbitron text-xs">
                  Odd {Number(analysis.odd).toFixed(2)}
                </Badge>
              )}
              {analysis.confidence != null && (
                <Badge variant="outline" className="font-orbitron text-xs">
                  Confiança {Math.round(Number(analysis.confidence) * (analysis.confidence > 1 ? 1 : 100))}%
                </Badge>
              )}
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
              disabled={!analysis || !analysis.odd}
              className="w-full bg-success/20 hover:bg-success/30 text-success border border-success/40 font-orbitron uppercase tracking-wider"
              variant="outline"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Entrada Manual (Virtual)
            </Button>
            <Button
              onClick={openBetfair}
              className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-orbitron uppercase tracking-wider"
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir na Betfair
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
                <Brain className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Mycroft ainda não analisou esta partida.
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-orbitron uppercase">{match.mycroft_status || 'aguardando'}</span>
                </p>
              </div>
            ) : (
              <>
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

                {/* Fundamentação */}
                {analysis.fundamentation && (
                  <div className="luxury-card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                        Fundamentação
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(analysis.fundamentation).map(([k, v]) => (
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
              {Object.keys(stats).length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Activity className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Estatísticas indisponíveis no momento.</p>
                </div>
              ) : (
                <>
                  <StatRow label="Posse de Bola" home={stats.possession_home} away={stats.possession_away} suffix="%" />
                  <StatRow label="Ataques Perigosos" home={stats.dangerous_attacks_home ?? stats.attacks_home} away={stats.dangerous_attacks_away ?? stats.attacks_away} />
                  <StatRow label="Chutes" home={stats.shots_home} away={stats.shots_away} />
                  <StatRow label="Chutes no Gol" home={stats.shots_on_target_home} away={stats.shots_on_target_away} />
                  <StatRow label="Escanteios" home={stats.corners_home} away={stats.corners_away} />
                  <StatRow label="Cartões" home={stats.cards_home} away={stats.cards_away} />
                  {(stats.xG_home != null || stats.xG_away != null) && (
                    <StatRow label="xG (Gols Esperados)" home={stats.xG_home} away={stats.xG_away} />
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
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aguardando atualizações...
                </p>
              ) : (
                <ol className="space-y-2 max-h-[480px] overflow-y-auto">
                  {[...history].reverse().map((ev, i) => (
                    <li
                      key={ev.at + i}
                      className="flex items-start gap-3 bg-muted/20 rounded-lg p-3 border border-border/40"
                    >
                      <div className="text-[10px] font-orbitron text-muted-foreground tabular-nums shrink-0 w-16">
                        {new Date(ev.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-orbitron text-foreground tabular-nums">
                            {ev.scoreHome} : {ev.scoreAway}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{ev.minute}'</span>
                          {ev.verdict && (
                            <Badge variant="outline" className="text-[9px] font-orbitron uppercase">
                              {ev.verdict}
                            </Badge>
                          )}
                          {ev.confidence != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(Number(ev.confidence) * (ev.confidence > 1 ? 1 : 100))}%
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[10px] text-muted-foreground text-center pt-2">
                O histórico cobre apenas a sessão atual (não persistido).
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
