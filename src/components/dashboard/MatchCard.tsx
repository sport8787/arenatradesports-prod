import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Loader2, Target, Check, ShieldAlert, Eye, Flame, AlertTriangle, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  mycroftStatus: 'analyzing' | 'no_value' | 'opportunity' | 'APROVADO' | 'APROVADO_SITUACIONAL' | 'AGUARDAR' | 'VETADO' | 'LABAREDA' | 'CUIDADO' | 'JOGO_MORTO';
  matchId?: string;
  hasBet?: boolean;
  stats?: MatchStats | null;
  planName?: string | null;
}

type CriteriaState = 'green' | 'red' | 'yellow' | 'gray';

interface CriteriaResult {
  key: string;
  label: string;
  state: CriteriaState;
  detail: string;
  vetoReason?: string;
}

function computeCriteria(match: Match): CriteriaResult[] {
  const s = match.stats;
  const possHome = s?.possession_home;
  const atkHome = s?.attacks_home;
  const atkAway = s?.attacks_away;
  const shotsHome = s?.shots_home;
  const cornersHome = s?.corners_home;
  const xgHome = s?.xG_home;
  const xgAway = s?.xG_away;

  // 1 — DOMÍNIO
  let dominioState: CriteriaState = 'gray';
  let dominioDetail = 'Dados indisponíveis';
  let dominioVeto: string | undefined;
  if (possHome != null || atkHome != null) {
    const poss = possHome ?? 0;
    const atk = atkHome ?? 0;
    const atkOpp = atkAway ?? 0;
    dominioDetail = poss > 0 ? `${poss}% posse` : `${atk} vs ${atkOpp} ataques`;
    if (poss > 55 || atk > atkOpp * 1.3) {
      dominioState = 'green';
    } else if (poss < 45 && atk < atkOpp) {
      dominioState = 'red';
      dominioVeto = `sem domínio (${poss}% posse, ${atk} vs ${atkOpp} ataques)`;
    } else {
      dominioState = 'gray';
    }
  }

  // 2 — PRESSÃO
  let pressaoState: CriteriaState = 'gray';
  let pressaoDetail = 'Dados indisponíveis';
  let pressaoVeto: string | undefined;
  if (shotsHome != null || cornersHome != null) {
    const shots = shotsHome ?? 0;
    const corners = cornersHome ?? 0;
    pressaoDetail = `${shots} finalizações, ${corners} escanteios`;
    if (shots >= 3 || corners >= 2) {
      pressaoState = 'green';
    } else if (shots <= 1 && corners <= 1) {
      pressaoState = 'red';
      pressaoVeto = `sem pressão (${shots} finalizações, ${corners} escanteios)`;
    } else {
      pressaoState = 'gray';
    }
  }

  // 3 — xG
  let xgState: CriteriaState = 'gray';
  let xgDetail = 'xG indisponível';
  let xgVeto: string | undefined;
  if (xgHome != null && xgAway != null) {
    xgDetail = `${xgHome.toFixed(2)} vs ${xgAway.toFixed(2)}`;
    if (xgHome > xgAway) {
      xgState = 'green';
    } else if (xgAway > 0 && xgHome < xgAway * 0.5) {
      xgState = 'red';
      xgVeto = `xG muito inferior (${xgHome.toFixed(2)} vs ${xgAway.toFixed(2)})`;
    } else {
      xgState = 'gray';
    }
  }

  // 4 — PLACAR
  const diff = match.scoreHome - match.scoreAway;
  let placarState: CriteriaState;
  let placarDetail = `${match.scoreHome} - ${match.scoreAway}`;
  let placarVeto: string | undefined;
  if (diff >= 0) {
    placarState = 'green';
  } else if (diff === -1) {
    placarState = 'yellow';
    placarVeto = `perdendo por 1 gol (${match.scoreHome}-${match.scoreAway})`;
  } else {
    placarState = 'red';
    placarVeto = `placar desfavorável (${match.scoreHome}-${match.scoreAway})`;
  }

  // 5 — TIMING
  let timingState: CriteriaState;
  let timingDetail = `${match.minute}'`;
  let timingVeto: string | undefined;
  if (match.minute >= 25 && match.minute <= 80) {
    timingState = 'green';
  } else if (match.minute > 82) {
    timingState = 'red';
    timingVeto = `minuto avançado (${match.minute}')`;
  } else {
    timingState = 'gray';
  }

  return [
    { key: 'dominio', label: 'Domínio', state: dominioState, detail: dominioDetail, vetoReason: dominioVeto },
    { key: 'pressao', label: 'Pressão', state: pressaoState, detail: pressaoDetail, vetoReason: pressaoVeto },
    { key: 'xg', label: 'xG favorável', state: xgState, detail: xgDetail, vetoReason: xgVeto },
    { key: 'placar', label: 'Placar', state: placarState, detail: placarDetail, vetoReason: placarVeto },
    { key: 'timing', label: 'Timing', state: timingState, detail: timingDetail, vetoReason: timingVeto },
  ];
}

function getVetoSummary(criteria: CriteriaResult[]): string | null {
  const reds = criteria.filter(c => c.state === 'red' && c.vetoReason);
  if (reds.length === 0) return null;
  return reds[0].vetoReason!;
}

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
        label: '📍 SITUACIONAL', animate: 'animate-pulse-green', icon: <Target className="w-4 h-4" />,
      };
    case 'LABAREDA':
      return {
        bg: 'bg-[#7C2D12]', border: 'border-[#F97316]', text: 'text-[#FB923C]',
        label: '⚡ LABAREDA', animate: 'animate-pulse', icon: <Flame className="w-4 h-4" />,
      };
    case 'CUIDADO':
      return {
        bg: 'bg-[#713F12]', border: 'border-[#F59E0B]', text: 'text-[#FBBF24]',
        label: '⚠️ CUIDADO', animate: '', icon: <AlertTriangle className="w-4 h-4" />,
      };
    case 'JOGO_MORTO':
      return {
        bg: 'bg-[#1C1917]', border: 'border-[#78716C]', text: 'text-[#A8A29E]',
        label: '💀 JOGO MORTO', animate: '', icon: <Skull className="w-4 h-4" />,
      };
    case 'VETADO':
    case 'no_value':
      return {
        bg: 'bg-[#1C1917]', border: 'border-[#78716C]', text: 'text-[#A8A29E]',
        label: '💀 JOGO MORTO', animate: '', icon: <Skull className="w-4 h-4" />,
      };
    case 'AGUARDAR':
      return {
        bg: 'bg-[#713F12]', border: 'border-[#F59E0B]', text: 'text-[#FBBF24]',
        label: '⏳ AGUARDAR', animate: '', icon: <Clock className="w-4 h-4" />,
      };
    case 'analyzing':
      return {
        bg: 'bg-[#1E3A5F]', border: 'border-[#3B82F6]', text: 'text-[#60A5FA]',
        label: '🔍 ANALISANDO...', animate: 'animate-shimmer', icon: <Loader2 className="w-4 h-4 animate-spin" />,
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
  const criteria = useMemo(() => computeCriteria(match), [match]);
  const criteriaMet = criteria.filter(c => c.state === 'green').length;
  const vetoSummary = useMemo(() => getVetoSummary(criteria), [criteria]);
  const statusConfig = getStatusConfig(match.mycroftStatus);
  const borderClass = getCardBorderClass(match.mycroftStatus, criteriaMet);
  const isImminent = criteriaMet >= 4 && (match.mycroftStatus === 'AGUARDAR' || match.mycroftStatus === 'analyzing');

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08, duration: 0.4 }}
        whileHover={{ scale: 1.02 }}
        className={cn(
          'relative rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer',
          'bg-gradient-to-b from-[hsl(0,0%,10%)] to-[hsl(0,0%,6%)]',
          borderClass
        )}
      >
        <div className="p-4 space-y-3">
          {/* Header: Championship + Live Badge */}
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-[10px] font-orbitron uppercase tracking-wider px-2 py-0.5 rounded-full border',
              championshipColors[match.championshipColor]
            )}>
              {match.championship}
            </span>
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
            {match.status === 'finished' && (
              <span className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground">Finalizado</span>
            )}
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

          {/* Bet Placed Badge */}
          {match.hasBet && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-primary font-bold uppercase font-orbitron">APOSTA REALIZADA</span>
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

            {/* Criteria Dots */}
            {match.status === 'live' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2">
                    {criteria.map((c) => {
                      const dotColors = {
                        green: 'bg-[#22C55E] border-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.6)]',
                        red: 'bg-[#EF4444] border-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.6)]',
                        yellow: 'bg-[#F59E0B] border-[#F59E0B] shadow-[0_0_6px_rgba(245,158,11,0.6)]',
                        gray: 'bg-transparent border-muted-foreground/40',
                      };
                      const stateEmoji = { green: '✓', red: '✗', yellow: '⚠', gray: '—' };
                      return (
                        <Tooltip key={c.key}>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              'w-3 h-3 rounded-full border transition-all duration-300 cursor-help',
                              dotColors[c.state]
                            )} />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                            {c.state === 'red' ? (
                              <span>❌ <span className="font-semibold">{c.label}:</span> {c.detail} — {c.vetoReason}</span>
                            ) : c.state === 'yellow' ? (
                              <span>⚠️ <span className="font-semibold">{c.label}:</span> {c.detail} — risco</span>
                            ) : (
                              <span><span className="font-semibold">{c.label}:</span> {c.detail} {stateEmoji[c.state]}</span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  <span className="text-[10px] text-muted-foreground font-orbitron ml-1">
                    {criteriaMet}/5
                  </span>
                </div>

                {/* Imminent entry alert */}
                {isImminent && (
                  <div className="text-center">
                    <span className="text-[11px] font-orbitron font-bold text-[#FBBF24] animate-pulse">
                      ⚡ Entrada iminente
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
              <span className="font-orbitron">{match.minute}' | {match.period}</span>
            </div>
            <div className="truncate max-w-[60%] text-right">
              {(match.mycroftStatus === 'APROVADO' || match.mycroftStatus === 'APROVADO_SITUACIONAL' || match.mycroftStatus === 'opportunity') && match.planName && (
                <span className="font-orbitron font-bold text-primary">
                  PLANO {match.planName}
                </span>
              )}
              {match.mycroftStatus === 'APROVADO_SITUACIONAL' && !match.planName && (
                <span className="font-orbitron font-bold text-[#6EE7B7]">
                  📍 SITUACIONAL
                </span>
              )}
              {(match.mycroftStatus === 'VETADO' || match.mycroftStatus === 'no_value') && (
                <span className="font-orbitron text-[#F87171]">
                  {vetoSummary ? `⛔ Vetado: ${vetoSummary}` : `Critérios insuficientes (${criteriaMet}/5)`}
                </span>
              )}
            </div>
          </div>

          {/* CTA for approved */}
          {(match.mycroftStatus === 'opportunity' || match.mycroftStatus === 'APROVADO' || match.mycroftStatus === 'APROVADO_SITUACIONAL') && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAnalysisClick?.(match.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] text-black font-orbitron font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all"
            >
              Ver Análise Completa
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
