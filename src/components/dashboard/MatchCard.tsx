import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Loader2, Target, Check, ShieldAlert, Eye, Flame, AlertTriangle, Skull, Hourglass, Info, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isExpiredHtSignal } from '@/lib/signalValidity';
import { formatMatchPeriod } from '@/lib/matchPeriod';
import FavoriteButton from './FavoriteButton';
import { computeCriteria as computeCriteriaShared, getCriteriaSummary } from '@/lib/matchCriteria';
import CriteriaDetailModal from './CriteriaDetailModal';
import AdminStatsEditorModal from './AdminStatsEditorModal';
import { useAdmin } from '@/hooks/useAdmin';
import { MatchPressureChart, PressureFallback, useMatchPressure } from './MatchPressureChart';
import { translateMarket } from '@/utils/marketTranslator';
import { getPlanNameByMarket } from '@/utils/planNameMapper';

export interface MatchStats {
  possession_home?: number;
  possession_away?: number;
  attacks_home?: number;
  attacks_away?: number;
  shots_home?: number;
  shots_away?: number;
  corners_home?: number;
  corners_away?: number;
  xG_home?: number;
  xG_away?: number;
}

export interface Match {
  id: string;
  championship: string;
  championshipColor: 'yellow' | 'blue' | 'green' | 'red';
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  period: string;
  status: 'live' | 'scheduled' | 'finished';
  mycroftStatus: 'analyzing' | 'no_value' | 'opportunity' | 'APROVADO' | 'APROVADO_SITUACIONAL' | 'AGUARDAR' | 'VETADO' | 'LABAREDA' | 'CUIDADO' | 'JOGO_MORTO' | 'EXPIRADO';
  matchId?: string;
  hasBet?: boolean;
  stats?: MatchStats | null;
  planName?: string | null;
  market?: string | null;
  signalResult?: 'green' | 'red' | null;
  finalScoreHome?: number | null;
  finalScoreAway?: number | null;
  confidence?: number | null;
  alerts?: string[] | null;
  approvalOdd?: number | null;
  oddsLive?: { home?: number | null; draw?: number | null; away?: number | null; over25?: number | null; bookmaker?: string | null } | null;
  /** Stats Futodds em tempo real para o painel "Saúde do Sinal". */
  healthStats?: {
    pressure_indices?: { home?: number; away?: number; total?: number };
    last5min_stats?: any;
    last10min_stats?: any;
  } | null;
}

export const BETFAIR_REFERRAL_URL = 'https://promos.betfair.bet.br/choose-your-refer-and-earn-offer?referrerCode=DWGLHVUTF';

type CriteriaState = 'green' | 'red' | 'yellow' | 'gray';


const championshipColors: Record<string, string> = {
  yellow: 'bg-primary/20 text-primary border-primary/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green: 'bg-success/20 text-green-400 border-success/30',
  red: 'bg-destructive/20 text-red-400 border-destructive/30',
};

const isUrl = (s: string) => s.startsWith('http://') || s.startsWith('https://');

function TeamLogo({ logo, team }: { logo: string; team: string }) {
  const [imgError, setImgError] = useState(false);
  if (isUrl(logo) && !imgError) {
    return <img src={logo} alt={team} className="w-8 h-8 object-contain rounded-full" onError={() => setImgError(true)} />;
  }
  return <span className="text-2xl">{logo || '⚽'}</span>;
}

// Status badge config
function getStatusConfig(status: Match['mycroftStatus']) {
  switch (status) {
    case 'APROVADO':
    case 'opportunity':
      return {
        bg: 'bg-[#14532D]', border: 'border-[#22C55E]', text: 'text-[#4ADE80]',
        label: '✅ APROVADO', animate: 'animate-pulse-green', icon: <Target className="w-4 h-4" />,
      };
    case 'APROVADO_SITUACIONAL':
      return {
        bg: 'bg-[#1A3A2A]', border: 'border-[#34D399]', text: 'text-[#6EE7B7]',
        label: '📍 APROVADO • CONF. REDUZIDA', animate: 'animate-pulse-green', icon: <Target className="w-4 h-4" />,
      };
    case 'LABAREDA':
      return {
        bg: 'bg-[#7C2D12]', border: 'border-[#F97316]', text: 'text-[#FB923C]',
        label: '⚡ APROVADO LABAREDAS', animate: 'animate-pulse', icon: <Flame className="w-4 h-4" />,
      };
    case 'CUIDADO':
      return {
        bg: 'bg-[#713F12]', border: 'border-[#F59E0B]', text: 'text-[#FBBF24]',
        label: '🟡 NÃO ENTRE — OBSERVANDO', animate: '', icon: <AlertTriangle className="w-4 h-4" />,
      };
    case 'JOGO_MORTO':
      return {
        bg: 'bg-[#1C1917]', border: 'border-[#78716C]', text: 'text-[#A8A29E]',
        label: '💀 SEM CHANCE — NÃO ENTRE', animate: '', icon: <Skull className="w-4 h-4" />,
      };
    case 'VETADO':
    case 'no_value':
      return {
        bg: 'bg-[#1C1917]', border: 'border-[#78716C]', text: 'text-[#A8A29E]',
        label: '💀 SEM CHANCE — NÃO ENTRE', animate: '', icon: <Skull className="w-4 h-4" />,
      };
    case 'AGUARDAR':
      return {
        bg: 'bg-[#713F12]', border: 'border-[#F59E0B]', text: 'text-[#FBBF24]',
        label: '🔎 MYCROFT ANALISANDO O JOGO', animate: 'animate-pulse', icon: <Clock className="w-4 h-4" />,
      };
    case 'analyzing':
      return {
        bg: 'bg-[#1E3A5F]', border: 'border-[#3B82F6]', text: 'text-[#60A5FA]',
        label: '🔍 ANALISANDO...', animate: 'animate-shimmer', icon: <Loader2 className="w-4 h-4 animate-spin" />,
      };
    case 'EXPIRADO':
      return {
        bg: 'bg-[#1C1917]', border: 'border-[#78716C]', text: 'text-[#A8A29E]',
        label: '⌛ ENTRADA EXPIRADA', animate: '', icon: <Hourglass className="w-4 h-4" />,
      };
    default:
      return {
        bg: 'bg-muted/50', border: 'border-border', text: 'text-muted-foreground',
        label: '—', animate: '', icon: <Eye className="w-4 h-4" />,
      };
  }
}
function getCardBorderClass(status: Match['mycroftStatus'], criteriaCount: number) {
  switch (status) {
    case 'APROVADO':
    case 'APROVADO_SITUACIONAL':
    case 'opportunity':
      return 'border-[#22C55E]/70 shadow-[0_0_15px_rgba(34,197,94,0.15)]';
    case 'LABAREDA':
      return 'border-[#F97316]/70 shadow-[0_0_15px_rgba(249,115,22,0.15)]';
    case 'CUIDADO':
      return 'border-[#F59E0B]/50';
    case 'JOGO_MORTO':
    case 'VETADO':
    case 'no_value':
      return 'border-[#78716C]/40';
    case 'AGUARDAR':
      return criteriaCount >= 4 ? 'border-[#F59E0B]/70 animate-pulse-border-yellow' : 'border-border';
    case 'analyzing':
      return 'border-[#3B82F6]/50 animate-shimmer-border';
    case 'EXPIRADO':
      return 'border-[#78716C]/40 opacity-80';
    default:
      return 'border-border';
  }
}
interface MatchCardProps {
  match: Match;
  index: number;
  onAnalysisClick?: (matchId: string) => void;
}

export default function MatchCard({ match, index, onAnalysisClick }: MatchCardProps) {
  const [criteriaModalOpen, setCriteriaModalOpen] = useState(false);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  
  const { isAdmin } = useAdmin();
  const criteria = useMemo(() => computeCriteriaShared(match), [match]);
  const summary = useMemo(() => getCriteriaSummary(criteria), [criteria]);
  const criteriaMet = summary.greens;
  const eliminatoryFailed = summary.eliminatoryFailed;
  const vetoSummary = summary.vetoSummary;

  // 🛡️ Sinal de 1º tempo deixa de valer após o intervalo — rebaixa o status visual
  const htExpired = useMemo(
    () => isExpiredHtSignal({
      market: match.market,
      minute: match.minute,
      period: match.period,
      status: match.status,
    }) && (match.mycroftStatus === 'APROVADO' || match.mycroftStatus === 'APROVADO_SITUACIONAL' || match.mycroftStatus === 'opportunity' || match.mycroftStatus === 'LABAREDA'),
    [match.market, match.minute, match.period, match.status, match.mycroftStatus],
  );
  const effectiveStatus: Match['mycroftStatus'] = htExpired ? 'EXPIRADO' : match.mycroftStatus;

  const statusConfig = getStatusConfig(effectiveStatus);
  const borderClass = getCardBorderClass(effectiveStatus, criteriaMet);
  // Pulso conforme bolinhas verdes (5/5 forte = LABAREDA, 4/5 suave = APROVADO)
  // Eliminatório vermelho cancela qualquer pulso e deixa o card opaco
  const pulseClass = eliminatoryFailed
    ? 'opacity-60'
    : criteriaMet >= 5
      ? 'animate-pulse'
      : criteriaMet >= 4
        ? 'animate-pulse-border-yellow'
        : '';
  const isImminent = !eliminatoryFailed && criteriaMet >= 4 && (effectiveStatus === 'AGUARDAR' || effectiveStatus === 'analyzing');

  // Gráfico de pressão embutido — somente jogos ao vivo OU sinais aprovados
  const showPressureChart =
    match.status === 'live' ||
    effectiveStatus === 'APROVADO' ||
    effectiveStatus === 'APROVADO_SITUACIONAL' ||
    effectiveStatus === 'LABAREDA' ||
    effectiveStatus === 'opportunity';
  const { data: pressureData, loading: pressureLoading, error: pressureError } = useMatchPressure(
    showPressureChart ? { home: match.home, away: match.away } : { home: '', away: '' },
    30000,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08, duration: 0.4 }}
        whileHover={{ scale: 1.02 }}
        onClick={() => onAnalysisClick?.(match.id)}
        className={cn(
          'relative rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer',
          'bg-gradient-to-b from-[hsl(0,0%,10%)] to-[hsl(0,0%,6%)]',
          borderClass,
          pulseClass,
        )}
      >
        <div className="p-4 space-y-3">
          {/* Header: Championship + Live Badge + Favorite */}
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              'text-[10px] font-orbitron uppercase tracking-wider px-2 py-0.5 rounded-full border truncate',
              championshipColors[match.championshipColor]
            )}>
              {match.championship}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {match.status === 'live' && (
                <span className="flex items-center gap-1.5 text-[10px] font-orbitron uppercase tracking-wider text-destructive">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                  </span>
                  Ao Vivo
                </span>
              )}
              {match.status === 'scheduled' && (
                <span className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground">Pré-Live</span>
              )}
              {match.status === 'finished' && !match.signalResult && (
                <span className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground">Finalizado</span>
              )}
              {match.signalResult === 'green' && (
                <span className="flex items-center gap-1 text-[10px] font-orbitron uppercase font-bold px-2 py-0.5 rounded-full bg-success text-success-foreground border border-success">
                  <Check className="w-3 h-3" /> GREEN
                </span>
              )}
              {match.signalResult === 'red' && (
                <span className="flex items-center gap-1 text-[10px] font-orbitron uppercase font-bold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground border border-destructive">
                  <ShieldAlert className="w-3 h-3" /> RED
                </span>
              )}
              {isAdmin && match.status === 'live' && match.matchId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAdminEditOpen(true); }}
                      className="p-1 rounded hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 transition-colors"
                      aria-label="Editar stats (admin)"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Editar stats (admin)</TooltipContent>
                </Tooltip>
              )}
              <FavoriteButton
                size="sm"
                keys={[match.matchId, match.home, match.away]}
              />
            </div>
          </div>

          {/* Teams + Score */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <TeamLogo logo={match.homeLogo} team={match.home} />
              <span className="text-xs font-semibold text-foreground truncate max-w-full">{match.home}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl md:text-4xl font-orbitron font-bold text-foreground">{match.scoreHome}</span>
              <span className="text-sm text-muted-foreground font-orbitron">-</span>
              <span className="text-3xl md:text-4xl font-orbitron font-bold text-foreground">{match.scoreAway}</span>
            </div>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <TeamLogo logo={match.awayLogo} team={match.away} />
              <span className="text-xs font-semibold text-foreground truncate max-w-full">{match.away}</span>
            </div>
          </div>

          {/* Odds (modelo Futodds): Casa | Empate | Fora | Over 2.5 */}
          {match.status === 'live' && match.oddsLive && (match.oddsLive.home || match.oddsLive.draw || match.oddsLive.away || match.oddsLive.over25) && (
            <div className="rounded-lg bg-muted/20 border border-border/60 p-2 space-y-1">
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { k: 'home', label: 'Casa', cls: 'text-blue-400' },
                  { k: 'draw', label: 'Empate', cls: 'text-muted-foreground' },
                  { k: 'away', label: 'Fora', cls: 'text-red-400' },
                  { k: 'over25', label: 'Over 2.5', cls: 'text-emerald-400' },
                ] as const).map((o) => {
                  const val = (match.oddsLive as any)?.[o.k];
                  return (
                    <div key={o.k} className="flex flex-col items-center justify-center px-1 py-1">
                      <span className="text-[9px] text-muted-foreground font-orbitron uppercase tracking-wider">{o.label}</span>
                      <span className={cn('text-sm font-bold tabular-nums', o.cls)}>
                        {val != null ? Number(val).toFixed(2) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {match.oddsLive.bookmaker && (
                <div className="text-[8px] text-muted-foreground/70 text-right font-mono uppercase tracking-wider">
                  {match.oddsLive.bookmaker}
                </div>
              )}
            </div>
          )}

          {/* Botão único Betfair (modelo Futodds, somente Betfair) */}
          {match.status === 'live' && (
            <a
              href={BETFAIR_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-[#FFB80C] hover:bg-[#FFC93D] text-black font-orbitron font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(255,184,12,0.25)]"
              aria-label="Abrir Betfair"
            >
              <ArrowRight className="w-4 h-4 -rotate-45" />
              Betfair
            </a>
          )}

          {/* Gráfico de Pressão embutido — agora abaixo das odds para não sobrepor o status */}
          {showPressureChart && (
            <div
              className="rounded-lg bg-background/40 border border-border/60 p-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[9px] font-orbitron uppercase tracking-wider text-muted-foreground">
                  📊 Pressão Ao Vivo
                </span>
                {pressureData?.source === 'trends' && (
                  <span className="text-[9px] text-muted-foreground/70 italic">sintético</span>
                )}
              </div>
              {pressureData ? (
                <MatchPressureChart data={pressureData} height={70} showAxis={false} showEvents />
              ) : (
                <PressureFallback loading={pressureLoading} error={pressureError} />
              )}
            </div>
          )}

          {/* Entrada aprovada — mercado em destaque + odd + confiança */}
          {(match.mycroftStatus === 'APROVADO' || match.mycroftStatus === 'APROVADO_SITUACIONAL' || match.mycroftStatus === 'LABAREDA' || match.mycroftStatus === 'opportunity') && (match.market || match.approvalOdd != null || match.confidence != null) && (
            <div className="rounded-lg bg-success/15 border-2 border-success/50 px-3 py-2.5 space-y-1.5 shadow-[0_0_18px_hsl(var(--success)/0.25)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-white font-orbitron uppercase tracking-widest font-bold">
                  🎯 Entrada Aprovada
                </span>
                {match.approvalOdd != null && (
                  <span className="text-[10px] font-orbitron text-white/90 uppercase tracking-wider">
                    Odd <span className="text-sm font-bold tabular-nums text-white ml-1">{Number(match.approvalOdd).toFixed(2)}</span>
                  </span>
                )}
              </div>
              {(() => {
                const rawPlan = (match.planName || '').toString().replace(/^plano\s+/i, '').trim();
                const displayPlan = rawPlan || getPlanNameByMarket(match.market)?.replace(/^Plano\s+/i, '') || null;
                return displayPlan ? (
                  <div className="text-center py-1 rounded-md bg-amber-400/15 border border-amber-300/40">
                    <span className="text-[11px] md:text-xs font-orbitron font-black text-amber-300 uppercase tracking-widest">
                      🔱 MYCROFT ATIVOU O PLANO {displayPlan}
                    </span>
                  </div>
                ) : null;
              })()}
              {match.market && (
                <div className="text-center py-1 rounded-md bg-success/20 border border-success/40">
                  <span className="text-base md:text-lg font-orbitron font-black text-white uppercase tracking-wide leading-tight">
                    {translateMarket(match.market)}
                  </span>
                </div>
              )}
              {match.confidence != null && (
                <div className="flex items-center justify-end gap-1" title="Força estatística do sinal. 70% ou mais = entrada recomendada. Abaixo disso, Mycroft só observa.">
                  <span className="text-[10px] font-orbitron text-white/90 uppercase tracking-wider">Força do sinal</span>
                  <span className="text-xs font-orbitron font-bold text-white tabular-nums">
                    {Math.round(Number(match.confidence))}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Mycroft Status Badge */}
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground font-orbitron uppercase tracking-wider">🤖 Status Mycroft</span>
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border',
              statusConfig.bg,
              statusConfig.border,
              statusConfig.animate,
            )}>
              <span className={statusConfig.text}>{statusConfig.icon}</span>
              <span className={cn('text-sm font-bold uppercase font-orbitron', statusConfig.text)}>
                {statusConfig.label}
              </span>
            </div>

            {/* Criteria Dots — clique abre modal explicativo */}
            {match.status === 'live' && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCriteriaModalOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 group hover:bg-muted/30 rounded-md py-1 transition-colors"
                  aria-label="Ver detalhes dos critérios B1-B5"
                >
                  {criteria.map((c) => {
                    const dotColors = {
                      green: 'bg-[#22C55E] border-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.6)]',
                      red: 'bg-[#EF4444] border-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.6)]',
                      yellow: 'bg-[#F59E0B] border-[#F59E0B] shadow-[0_0_6px_rgba(245,158,11,0.6)]',
                      gray: 'bg-transparent border-muted-foreground/40',
                    };
                    return (
                      <Tooltip key={c.key}>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            'w-3 h-3 rounded-full border transition-all duration-300',
                            dotColors[c.state]
                          )} />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[240px]">
                          <div className="space-y-0.5">
                            <div>
                              <span className="font-semibold">{c.label}</span>
                              {c.eliminatory && <span className="ml-1 text-[10px] uppercase tracking-wider text-destructive">eliminatório</span>}
                            </div>
                            <div className="text-muted-foreground">{c.detail}</div>
                            {c.state === 'red' && c.vetoReason && <div>❌ {c.vetoReason}</div>}
                            {c.state === 'yellow' && c.vetoReason && <div>⚠️ {c.vetoReason}</div>}
                            {c.state === 'gray' && <div>— sem dados</div>}
                            <div className="text-[10px] text-muted-foreground/80 pt-0.5 italic">clique para detalhes</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <span className="text-[10px] text-muted-foreground font-orbitron ml-1">
                    {criteriaMet}/5
                  </span>
                  <Info className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                </button>

                {/* Imminent entry alert */}
                {isImminent && (
                  <div className="text-center">
                    <span className="text-[11px] font-orbitron font-bold text-[#FBBF24] animate-pulse">
                      ⚡ Entrada iminente — fique atento
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span className="font-orbitron">{match.minute}' | {formatMatchPeriod(match.period)}</span>
            </div>
            <div className="truncate max-w-[60%] text-right">
              {(effectiveStatus === 'APROVADO' || effectiveStatus === 'APROVADO_SITUACIONAL' || effectiveStatus === 'opportunity') && match.planName && (
                <span className="font-orbitron font-bold text-primary">
                  PLANO {match.planName}
                </span>
              )}
              {effectiveStatus === 'APROVADO_SITUACIONAL' && !match.planName && (
                <span className="font-orbitron font-bold text-[#6EE7B7]">
                  📍 APROVADO • CONF. REDUZIDA
                </span>
              )}
              {effectiveStatus === 'LABAREDA' && (
                <span className="font-orbitron font-bold text-[#FB923C]">
                  ⚡ Potencial de gol tardio
                </span>
              )}
              {effectiveStatus === 'CUIDADO' && (
                <span className="font-orbitron text-[#FBBF24]">
                  ⚠️ Cenário ainda não favorável — não entre agora
                </span>
              )}
              {(effectiveStatus === 'JOGO_MORTO' || effectiveStatus === 'VETADO' || effectiveStatus === 'no_value') && (
                <span className="font-orbitron text-[#A8A29E]">
                  {vetoSummary ? `💀 ${vetoSummary}` : `Sem oportunidade neste jogo (${criteriaMet}/5 critérios)`}
                </span>
              )}
              {effectiveStatus === 'EXPIRADO' && (
                <span className="font-orbitron text-[#A8A29E]" title={`Mercado "${match.market}" inválido após o 1º tempo`}>
                  ⌛ Janela do 1º tempo encerrada
                </span>
              )}
            </div>
          </div>

          {/* CTA for approved (oculto se sinal expirou) */}
          {(effectiveStatus === 'opportunity' || effectiveStatus === 'APROVADO' || effectiveStatus === 'APROVADO_SITUACIONAL' || effectiveStatus === 'LABAREDA') && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAnalysisClick?.(match.id)}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-orbitron font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all",
                effectiveStatus === 'LABAREDA'
                  ? 'bg-[#F97316] text-black'
                  : 'bg-[#22C55E] text-black'
              )}
            >
              {effectiveStatus === 'LABAREDA' ? 'Ver Oportunidade Labaredas' : 'Ver Análise Completa'}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </motion.div>
      <CriteriaDetailModal match={match} open={criteriaModalOpen} onOpenChange={setCriteriaModalOpen} />
      {isAdmin && match.matchId && (
        <AdminStatsEditorModal
          isOpen={adminEditOpen}
          onClose={() => setAdminEditOpen(false)}
          matchId={match.matchId}
          homeTeam={match.home}
          awayTeam={match.away}
          currentStats={match.stats as any}
        />
      )}
    </TooltipProvider>
  );
}
