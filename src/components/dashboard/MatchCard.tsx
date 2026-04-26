import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Loader2, Target, Check, ShieldAlert, Eye, Flame, AlertTriangle, Skull, Hourglass, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isExpiredHtSignal } from '@/lib/signalValidity';
import { formatMatchPeriod } from '@/lib/matchPeriod';
import FavoriteButton from './FavoriteButton';
import { computeCriteria as computeCriteriaShared, getCriteriaSummary } from '@/lib/matchCriteria';
import CriteriaDetailModal from './CriteriaDetailModal';

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
}

type CriteriaState = 'green' | 'red' | 'yellow' | 'gray';

interface CriteriaResult {
  key: string;
  label: string;
  state: CriteriaState;
  detail: string;
  vetoReason?: string;
  eliminatory?: boolean;
}

/**
 * Sistema B1-B5 (atualizado)
 * B1 — Probabilidade Poisson ≥ 40% (ELIMINATÓRIO)
 * B2 — Valor Esperado positivo (edge)  (ELIMINATÓRIO)
 * B3 — Regra Situacional S1-S4 confirmada
 * B4 — Janela de tempo válida 10-70', não HT (ELIMINATÓRIO)
 * B5 — Stats ao vivo confirmam (Pressão + Dentro da área)
 *
 * Como o Poisson e o EV são calculados na edge function que produz o veredito
 * (APROVADO/LABAREDA), inferimos B1 e B2 a partir do status + confidence.
 * Já B4 e B5 são 100% calculáveis no client a partir dos dados ao vivo.
 */
function computeCriteria(match: Match): CriteriaResult[] {
  const s = match.stats;
  const status = match.mycroftStatus;
  const isApproved = status === 'APROVADO' || status === 'APROVADO_SITUACIONAL' || status === 'opportunity' || status === 'LABAREDA';
  const isVetoed = status === 'VETADO' || status === 'JOGO_MORTO' || status === 'no_value';
  const conf = match.confidence ?? null;
  const period = (match.period || '').toLowerCase();
  const isHalftime = period.includes('intervalo') || period.includes('halftime') || period.includes('ht');

  // B1 — Poisson ≥ 40% (eliminatório)
  let b1: CriteriaState = 'gray';
  let b1Detail = 'Aguardando análise Poisson';
  let b1Veto: string | undefined;
  if (conf != null) {
    b1Detail = `Probabilidade ${conf}%`;
    if (conf >= 40) b1 = 'green';
    else if (conf >= 30) { b1 = 'yellow'; b1Veto = `prob. abaixo do alvo (${conf}%)`; }
    else { b1 = 'red'; b1Veto = `prob. ${conf}% < 40%`; }
  } else if (isApproved) {
    b1 = 'green';
    b1Detail = 'Aprovado pelo motor (≥40%)';
  } else if (isVetoed) {
    b1 = 'red';
    b1Detail = 'Vetado pelo motor';
    b1Veto = 'probabilidade Poisson abaixo do alvo';
  }

  // B2 — Valor Esperado positivo (eliminatório)
  let b2: CriteriaState = 'gray';
  let b2Detail = 'EV pendente';
  let b2Veto: string | undefined;
  if (isApproved) {
    b2 = 'green';
    b2Detail = 'EV positivo';
  } else if (isVetoed) {
    b2 = 'red';
    b2Detail = 'EV negativo';
    b2Veto = 'sem valor esperado positivo';
  }

  // B3 — Situacional S1-S4
  let b3: CriteriaState = 'gray';
  let b3Detail = 'Sem padrão situacional';
  if (status === 'APROVADO_SITUACIONAL') {
    b3 = 'green';
    b3Detail = 'Padrão S1-S4 confirmado';
  } else {
    const sit = (match.alerts || []).find(a => /\bS[1-4]\b/i.test(a));
    if (sit) { b3 = 'green'; b3Detail = sit; }
    else if (isApproved) { b3 = 'yellow'; b3Detail = 'Aprovado sem padrão situacional'; }
  }

  // B4 — Janela de tempo válida 10-70', não HT (eliminatório)
  let b4: CriteriaState;
  let b4Detail = `${match.minute}'`;
  let b4Veto: string | undefined;
  if (isHalftime) {
    b4 = 'red';
    b4Detail = 'Intervalo';
    b4Veto = 'janela inválida (intervalo)';
  } else if (match.minute >= 10 && match.minute <= 65) {
    b4 = 'green';
  } else if (match.minute > 65 && match.minute <= 70) {
    b4 = 'yellow';
    b4Veto = `janela fechando (${match.minute}')`;
  } else if (match.minute > 70) {
    b4 = 'red';
    b4Veto = `fora da janela (${match.minute}')`;
  } else {
    b4 = 'gray';
    b4Detail = `${match.minute}' (cedo)`;
  }

  // B5 — Stats ao vivo (Pressão + dentro da área)
  let b5: CriteriaState = 'gray';
  let b5Detail = 'Stats indisponíveis';
  const shots = s?.shots_home;
  const corners = s?.corners_home;
  const atk = s?.attacks_home;
  const atkOpp = s?.attacks_away;
  if (shots != null || corners != null || atk != null) {
    const sH = shots ?? 0;
    const cH = corners ?? 0;
    const aH = atk ?? 0;
    const aA = atkOpp ?? 0;
    b5Detail = `${sH} fin., ${cH} esc.${aH || aA ? ` · ${aH}v${aA} ataques` : ''}`;
    const pressao = sH >= 3 || cH >= 3;
    const dentroArea = aH > aA * 1.2 || sH >= 4;
    if (pressao && dentroArea) b5 = 'green';
    else if (pressao || dentroArea) b5 = 'yellow';
    else if (sH === 0 && cH === 0 && aH < aA) b5 = 'red';
    else b5 = 'gray';
  }

  return [
    { key: 'b1', label: 'B1 · Poisson ≥40%', state: b1, detail: b1Detail, vetoReason: b1Veto, eliminatory: true },
    { key: 'b2', label: 'B2 · EV positivo', state: b2, detail: b2Detail, vetoReason: b2Veto, eliminatory: true },
    { key: 'b3', label: 'B3 · Situacional S1-S4', state: b3, detail: b3Detail },
    { key: 'b4', label: 'B4 · Janela 10-70\'', state: b4, detail: b4Detail, vetoReason: b4Veto, eliminatory: true },
    { key: 'b5', label: 'B5 · Stats (pressão + área)', state: b5, detail: b5Detail },
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
  const criteria = useMemo(() => computeCriteria(match), [match]);
  const criteriaMet = criteria.filter(c => c.state === 'green').length;
  // Eliminatórios (B1, B2, B4): se algum estiver vermelho, card fica opaco e não pulsa
  const eliminatoryFailed = criteria.some(c => c.eliminatory && c.state === 'red');
  const vetoSummary = useMemo(() => getVetoSummary(criteria), [criteria]);

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
                          <TooltipContent side="top" className="text-xs max-w-[240px]">
                            <div className="space-y-0.5">
                              <div>
                                <span className="font-semibold">{c.label}</span>
                                {c.eliminatory && <span className="ml-1 text-[10px] uppercase tracking-wider text-destructive">eliminatório</span>}
                              </div>
                              <div className="text-muted-foreground">{c.detail}</div>
                              {c.state === 'red' && c.vetoReason && <div>❌ {c.vetoReason}</div>}
                              {c.state === 'yellow' && c.vetoReason && <div>⚠️ {c.vetoReason}</div>}
                              {c.state === 'yellow' && !c.vetoReason && <div>⚠️ atenção</div>}
                              {c.state === 'green' && <div>{stateEmoji.green} ok</div>}
                              {c.state === 'gray' && <div>— sem dados</div>}
                            </div>
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
                  📍 SITUACIONAL
                </span>
              )}
              {effectiveStatus === 'LABAREDA' && (
                <span className="font-orbitron font-bold text-[#FB923C]">
                  ⚡ Potencial de gol tardio
                </span>
              )}
              {effectiveStatus === 'CUIDADO' && (
                <span className="font-orbitron text-[#FBBF24]">
                  ⚠️ Fator de risco ativo
                </span>
              )}
              {(effectiveStatus === 'JOGO_MORTO' || effectiveStatus === 'VETADO' || effectiveStatus === 'no_value') && (
                <span className="font-orbitron text-[#A8A29E]">
                  {vetoSummary ? `💀 ${vetoSummary}` : `Sem oportunidade (${criteriaMet}/5)`}
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
              {effectiveStatus === 'LABAREDA' ? 'Ver Oportunidade Labareda' : 'Ver Análise Completa'}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
