import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Ban, Clock, Target, Shield, BarChart3, BookOpen, AlertTriangle, Crosshair, Flag, Scale, ArrowUpRight, Wallet, DollarSign, Pencil } from 'lucide-react';
import OddsComparator from './OddsComparator';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import type { Match } from '@/components/dashboard/MatchCard';
import AdminStatsEditorModal from './AdminStatsEditorModal';
import { useAdmin } from '@/hooks/useAdmin';
import { MatchPressureChart, PressureFallback, useMatchPressure, FormDots } from './MatchPressureChart';
import { Activity } from 'lucide-react';

export interface AdditionalMarket {
  market: string;
  odd: number;
  confidence: number;
  thesis: string;
  stake_percent: number;
  stake_value?: number;
}

export interface MycroftAnalysisData {
  id: string;
  verdict: string;
  plan_name?: string | null;
  market: string;
  odd: number;
  confidence: number;
  thesis: string;
  fundamentation: any;
  risk_management: any;
  alerts: string[];
  asset_score?: number | null;
  asset_classification?: string | null;
  additional_markets?: AdditionalMarket[];
}

const basConfig: Record<string, { color: string; icon: string; border: string }> = {
  ELITE: { color: 'text-amber-400', icon: '👑', border: 'border-amber-400/40' },
  PREMIUM: { color: 'text-cyan-400', icon: '💎', border: 'border-cyan-400/40' },
  FORTE: { color: 'text-emerald-400', icon: '⚡', border: 'border-emerald-400/40' },
  ESPECULATIVO: { color: 'text-orange-400', icon: '🎯', border: 'border-orange-400/40' },
};

const verdictConfig: Record<string, { icon: string; bg: string; text: string; glow: string }> = {
  APROVADO: { icon: '✅', bg: 'bg-success', text: 'text-success-foreground', glow: 'shadow-[0_0_30px_hsl(142_76%_36%/0.5)]' },
  APROVADO_SITUACIONAL: { icon: '📍', bg: 'bg-success', text: 'text-success-foreground', glow: 'shadow-[0_0_30px_hsl(142_76%_36%/0.5)]' },
  LABAREDA: { icon: '⚡', bg: 'bg-[#7C2D12]', text: 'text-[#FB923C]', glow: 'shadow-[0_0_30px_rgba(249,115,22,0.5)]' },
  CUIDADO: { icon: '⚠️', bg: 'bg-warning', text: 'text-warning-foreground', glow: 'shadow-[0_0_30px_hsl(38_92%_50%/0.5)]' },
  JOGO_MORTO: { icon: '💀', bg: 'bg-muted', text: 'text-muted-foreground', glow: '' },
  VETADO: { icon: '💀', bg: 'bg-muted', text: 'text-muted-foreground', glow: '' },
  AGUARDAR: { icon: '⏸️', bg: 'bg-warning', text: 'text-warning-foreground', glow: 'shadow-[0_0_30px_hsl(38_92%_50%/0.5)]' },
};

interface BankrollProps {
  balance: number;
  recommendedStake: number;
  placeBet: (analysis: { id: string; match_id: string; market: string; odd: number; home_team?: string; away_team?: string }) => Promise<{ success: boolean; error?: string; stake?: number }>;
  dismissBet?: () => Promise<any>;
}

interface AnalysisModalProps {
  match: Match | null;
  analysis: MycroftAnalysisData | null;
  isOpen: boolean;
  onClose: () => void;
  bankrollProps?: BankrollProps;
  matchStats?: { attacks_home?: number; attacks_away?: number; xG_home?: number; xG_away?: number; possession_home?: number; possession_away?: number; shots_home?: number; shots_away?: number } | null;
}

export default function AnalysisModal({ match, analysis, isOpen, onClose, bankrollProps, matchStats }: AnalysisModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { recordAction } = useSignalHistory();
  const { isAdmin } = useAdmin();
  const [placing, setPlacing] = useState(false);
  const [adminEditOpen, setAdminEditOpen] = useState(false);

  const bankroll = bankrollProps ? { balance: bankrollProps.balance } : null;
  const recommendedStake = bankrollProps?.recommendedStake ?? 0;

  // Live pressure chart (only fetches when modal is open and match is live)
  const isLive = match?.status === 'live';
  const { data: pressureData, loading: pressureLoading, error: pressureError } = useMatchPressure(
    isOpen && isLive && match ? { home: match.home, away: match.away } : { home: '', away: '' },
    30000,
  );

  if (!match) return null;

  const vc = analysis ? verdictConfig[analysis.verdict] || verdictConfig['AGUARDAR'] : null;

  // risk_management can be JSON object or plain text
  const riskRaw = analysis?.risk_management;
  const risk = (riskRaw && typeof riskRaw === 'object' && !Array.isArray(riskRaw)) ? riskRaw as {
    stake_percent?: number;
    stake_value?: number;
    entry?: string;
    stop?: string;
    target?: string;
    rr?: string;
    ev?: string;
  } : null;
  const riskText = (typeof riskRaw === 'string') ? riskRaw : null;

  // Stats: prefer matchStats prop, then fundamentation if it's a JSON object with stats
  const fundRaw = analysis?.fundamentation;
  const fundObj = (fundRaw && typeof fundRaw === 'object' && !Array.isArray(fundRaw)) ? fundRaw as Record<string, any> : null;
  const statsFromFund = fundObj?.stats || (fundObj?.attacks_home != null ? fundObj : null);
  const stats = matchStats || statsFromFund as {
    attacks_home?: number;
    attacks_away?: number;
    xG_home?: number;
    xG_away?: number;
    possession_home?: number;
    possession_away?: number;
    shots_home?: number;
    shots_away?: number;
  } | null;

  const handleCopy = () => {
    if (!risk?.entry) return;
    navigator.clipboard.writeText(risk.entry);
    if (analysis?.id) {
      recordAction(analysis.id, 'copied');
    }
    toast({ title: '📋 Copiado!', description: risk.entry });
  };

  const handleEntered = async () => {
    if (!analysis || !match) return;

    if (!analysis.odd || analysis.odd <= 0) {
      toast({ title: '❌ Erro', description: 'Odd inválida — análise pode estar incompleta (truncada)' });
      return;
    }

    if (!bankrollProps) {
      toast({ title: '❌ Erro', description: 'Banca não disponível' });
      return;
    }

    setPlacing(true);

    try {
      const betPayload = {
        id: analysis.id,
        match_id: String(match.matchId || match.id),
        market: analysis.market,
        odd: Number(analysis.odd),
        home_team: match.home,
        away_team: match.away,
      };

      const result = await Promise.race([
        bankrollProps.placeBet(betPayload),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Timeout ao registrar entrada. Tente novamente.' }), 12000)
        ),
      ]);

      if (result.success) {
        // Não bloquear UX por falha/latência em histórico
        void recordAction(analysis.id, 'entered', result.stake).catch((e) => {
          console.error('[AnalysisModal] recordAction failed (non-blocking):', e);
        });

        toast({
          title: '💰 Entrada registrada!',
          description: `Stake: R$ ${result.stake?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Boa sorte!`,
        });
        onClose();
        return;
      }

      console.error('[AnalysisModal] placeBet failed:', result.error);
      toast({ title: '❌ Erro', description: result.error || 'Erro desconhecido ao registrar entrada' });
    } catch (err: any) {
      console.error('[AnalysisModal] Bet placement exception:', err);
      toast({ title: '❌ Erro', description: err?.message || 'Erro ao registrar entrada' });
    } finally {
      setPlacing(false);
    }
  };

  const handleDismissed = async () => {
    if (analysis?.id) {
      await recordAction(analysis.id, 'dismissed');
    }
    if (bankrollProps?.dismissBet) await bankrollProps.dismissBet();
    onClose();
  };

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  // Stats: mostra se tiver valor não-zero. Para admin, sempre mostra (mesmo zerado) para permitir edição.
  const hasRealStats = stats && Object.values(stats).some(v => typeof v === 'number' && v > 0);
  const showStatsBlock = hasRealStats || isAdmin;
  const statRows = showStatsBlock ? [
    { label: 'Ataques perigosos', home: stats?.attacks_home ?? '-', away: stats?.attacks_away ?? '-' },
    { label: 'xG', home: stats?.xG_home ?? '-', away: stats?.xG_away ?? '-' },
    { label: 'Posse', home: stats?.possession_home != null ? `${stats!.possession_home}%` : '-', away: stats?.possession_away != null ? `${stats!.possession_away}%` : '-' },
    { label: 'Chutes ao gol', home: stats?.shots_home ?? '-', away: stats?.shots_away ?? '-' },
  ] : [];

  const riskItems = risk ? [
    { icon: Target, label: 'Stake', value: risk.stake_percent != null ? `${risk.stake_percent}% (R$ ${(risk.stake_value ?? 0).toFixed(2)})` : '-' },
    { icon: Crosshair, label: 'Entry', value: risk.entry ?? '-' },
    { icon: AlertTriangle, label: 'Stop', value: risk.stop ?? '-' },
    { icon: Flag, label: 'Target', value: risk.target ?? '-' },
    { icon: Scale, label: 'R:R', value: risk.rr ?? '-' },
    { icon: ArrowUpRight, label: 'EV', value: risk.ev ?? '-' },
  ] : [];

  const insufficientBalance = bankroll ? recommendedStake > bankroll.balance : false;
  const balanceAfter = bankroll ? bankroll.balance - recommendedStake : 0;
  const alreadyBet = match.hasBet === true;

  const content = (
    <div className="space-y-6 p-5 pb-28 md:pb-5 overflow-y-auto flex-1">
      {/* Header */}
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold text-foreground">
          ⚽ {match.home} vs {match.away}
        </p>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          ⏱️ {match.minute}' | {match.scoreHome}-{match.scoreAway}
        </p>
      </div>

      {/* Live Pressure Chart */}
      {isLive && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-orbitron uppercase tracking-wider text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Gráfico de Pressão
              {pressureData?.source === 'trends' && (
                <span className="text-[9px] opacity-60 normal-case">(sintético)</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/70">
              Atualiza a cada 30s
            </span>
          </div>

          {pressureData && (
            <div className="grid grid-cols-3 items-center gap-2 pb-1">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <span className="text-[11px] font-semibold text-foreground truncate max-w-full">{pressureData.header.home.name}</span>
                <FormDots form={pressureData.form.home} side="home" />
              </div>
              <div className="text-center text-[11px] font-orbitron text-primary">
                {pressureData.header.minute > 0 ? `${pressureData.header.minute}'` : '—'}
              </div>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <span className="text-[11px] font-semibold text-foreground truncate max-w-full">{pressureData.header.away.name}</span>
                <FormDots form={pressureData.form.away} side="away" />
              </div>
            </div>
          )}

          {pressureData ? (
            <MatchPressureChart data={pressureData} height={200} />
          ) : (
            <PressureFallback loading={pressureLoading} error={pressureError} />
          )}
        </div>
      )}

      {/* No analysis available */}
      {!analysis && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-medium">Análise ainda não disponível para este jogo.</p>
        </div>
      )}

      {/* Analysis Content */}
      {analysis && vc && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
          {/* 🚨 EXIT WARNING BANNER — Cancelamento de planos monitorados */}
          {(analysis.plan_name === 'CANCELAMENTO UNDER 2.5 EARLY' || analysis.plan_name === 'CANCELAMENTO BACK AO DOMINANTE') && (
            <motion.div
              variants={fadeUp}
              className="rounded-xl border-2 border-destructive bg-destructive/15 p-4 shadow-[0_0_30px_hsl(var(--destructive)/0.4)] animate-pulse"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🚨</span>
                <div>
                  <div className="font-orbitron text-lg font-black uppercase text-destructive tracking-wider">
                    SAIR DA OPERAÇÃO AGORA
                  </div>
                  <div className="text-xs text-destructive/80 uppercase tracking-widest">
                    {analysis.plan_name === 'CANCELAMENTO UNDER 2.5 EARLY' ? 'Sinal Under 2.5 Early revogado' : 'Sinal Back ao Dominante revogado'}
                  </div>
                </div>
              </div>
              <p className="text-sm text-foreground/90 mt-2">
                Execute <strong>cashout</strong> ou <strong>hedge</strong> imediatamente para limitar perda. As condições do entrada mudaram.
              </p>
            </motion.div>
          )}

          {/* Plan Name */}
          {analysis.plan_name && analysis.plan_name !== 'CANCELAMENTO UNDER 2.5 EARLY' && analysis.plan_name !== 'CANCELAMENTO BACK AO DOMINANTE' && (
            <motion.div variants={fadeUp} className="flex justify-center">
              <div className="px-4 py-1.5 rounded-lg bg-primary/10 border border-primary/30 font-orbitron text-xs font-bold text-primary uppercase tracking-widest">
                🔱 {analysis.plan_name}
              </div>
            </motion.div>
          )}

          {/* Verdict */}
          <motion.div variants={fadeUp} className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className={cn('px-8 py-3 rounded-xl font-orbitron text-xl font-bold uppercase tracking-widest', vc.bg, vc.text, vc.glow)}
            >
              {vc.icon} {analysis.verdict}
            </motion.div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-sm text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-orbitron">Mercado</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{analysis.market}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-orbitron">Odd</p>
                <p className="text-sm font-bold text-primary mt-0.5">{analysis.odd || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-orbitron">Confiança</p>
                <p className="text-sm font-bold text-success mt-0.5">{analysis.confidence}%</p>
              </div>
            </div>

            {/* BAS (Asset Score) */}
            {analysis.asset_score != null && analysis.asset_classification && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 180 }}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-secondary/30 max-w-sm w-full',
                  basConfig[analysis.asset_classification]?.border || 'border-border'
                )}
              >
                <span className="text-xl">{basConfig[analysis.asset_classification]?.icon || '📊'}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xs font-orbitron font-bold uppercase tracking-wider', basConfig[analysis.asset_classification]?.color || 'text-foreground')}>
                      {analysis.asset_classification}
                    </span>
                    <span className={cn('text-lg font-orbitron font-black', basConfig[analysis.asset_classification]?.color || 'text-foreground')}>
                      {analysis.asset_score}
                    </span>
                  </div>
                  <Progress value={analysis.asset_score} className={cn('h-1.5 mt-1', 
                    analysis.asset_classification === 'ELITE' ? '[&>div]:bg-amber-400' :
                    analysis.asset_classification === 'PREMIUM' ? '[&>div]:bg-cyan-400' :
                    analysis.asset_classification === 'FORTE' ? '[&>div]:bg-emerald-400' :
                    '[&>div]:bg-orange-400'
                  )} />
                </div>
                <span className="text-[10px] text-muted-foreground font-orbitron">BAS</span>
              </motion.div>
            )}

            <Progress value={analysis.confidence} className="h-2 max-w-sm w-full [&>div]:bg-success" />
          </motion.div>

          {/* Alerts */}
          {analysis.alerts && analysis.alerts.length > 0 && (
            <motion.div variants={fadeUp} className="space-y-2">
              {analysis.alerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                  <span className="text-sm text-warning">{alert}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Stats */}
          {statRows.length > 0 && (
            <motion.div variants={fadeUp} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" /> Situação do Jogo
                </h3>
                {isAdmin && match.matchId && (
                  <button
                    type="button"
                    onClick={() => setAdminEditOpen(true)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-md border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Editar (admin)
                  </button>
                )}
              </div>
              <div className="luxury-card p-4">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <p className="font-bold text-foreground">{match.home}</p>
                  <p className="text-muted-foreground text-xs" />
                  <p className="font-bold text-foreground">{match.away}</p>
                </div>
                {statRows.map(row => (
                  <div key={row.label} className="grid grid-cols-3 gap-2 text-center text-sm py-1.5 border-t border-border">
                    <p className="font-bold text-foreground">{row.home}</p>
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="font-bold text-foreground">{row.away}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Thesis */}
          <motion.div variants={fadeUp} className="space-y-3">
            <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> Fundamentação Mycroft
            </h3>
            <div className="luxury-card p-5 border-l-4 border-l-success">
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed italic">
                {analysis.thesis}
              </p>
            </div>
          </motion.div>

          {/* Odds Comparator */}
          <motion.div variants={fadeUp} className="space-y-3">
            <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Comparador de Odds
            </h3>
            <div className="luxury-card p-4">
              <OddsComparator
                matchId={match.matchId || match.id}
                homeTeam={match.home}
                awayTeam={match.away}
                market={analysis.market}
              />
            </div>
          </motion.div>

          {/* Risk Management - structured or text */}
          {(riskItems.length > 0 || riskText) && (
            <motion.div variants={fadeUp} className="space-y-3">
              <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Gestão de Risco
              </h3>
              {riskItems.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {riskItems.map(item => (
                    <div key={item.label} className="luxury-card p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <item.icon className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-orbitron uppercase">{item.label}</span>
                      </div>
                      <p className="text-sm font-bold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : riskText ? (
                <div className="luxury-card p-4 border-l-4 border-l-warning">
                  <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                    {riskText}
                  </p>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Additional Markets */}
          {analysis.additional_markets && analysis.additional_markets.length > 0 && (
            <motion.div variants={fadeUp} className="space-y-3">
              <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Mercados Adicionais ({analysis.additional_markets.length})
              </h3>
              <div className="space-y-2">
                {analysis.additional_markets.map((am, i) => (
                  <div key={i} className="luxury-card p-4 border-l-4 border-l-primary/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-orbitron text-sm font-bold text-foreground">{am.market}</span>
                      <span className="text-xs font-orbitron text-primary">Odd {am.odd}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{am.thesis}</p>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-muted-foreground">Confiança: <strong className="text-foreground">{am.confidence}%</strong></span>
                      <span className="text-muted-foreground">Stake: <strong className="text-foreground">{am.stake_percent}%</strong></span>
                      {am.stake_value && (
                        <span className="text-muted-foreground">= <strong className="text-foreground">R$ {am.stake_value.toFixed(2)}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 italic">
                💡 Mercados complementares com fundamento independente. Registre cada entrada separadamente.
              </p>
            </motion.div>
          )}

          <motion.div variants={fadeUp} className="hidden md:block space-y-4">
            {/* Already bet banner */}
            {alreadyBet && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30">
                <Check className="w-5 h-5 text-primary" />
                <span className="font-orbitron font-bold text-primary text-sm uppercase">APOSTA JÁ REALIZADA</span>
              </div>
            )}

            {/* Bankroll preview */}
            {bankroll && !alreadyBet && (
              <div className="bg-secondary/30 border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-orbitron uppercase text-muted-foreground">
                  <Wallet className="w-4 h-4" /> Banca Virtual
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">Banca atual:</span>
                    <span className="ml-2 font-orbitron font-bold text-foreground">
                      R$ {bankroll.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Após entrada:</span>
                    <span className={cn('ml-2 font-orbitron font-bold', insufficientBalance ? 'text-destructive' : 'text-foreground')}>
                      R$ {balanceAfter.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                {insufficientBalance && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Saldo insuficiente para esta entrada
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent/20 border border-accent/30 text-accent font-orbitron text-sm font-bold uppercase hover:bg-accent/30 transition-colors">
                <Copy className="w-4 h-4" /> Copiar Entrada
              </button>
              <button
                onClick={handleEntered}
                disabled={placing || insufficientBalance || alreadyBet}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg bg-success text-success-foreground font-orbitron text-sm font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> {alreadyBet ? '✅ Já apostado' : placing ? 'Registrando...' : '💰 ENTREI'}
                </span>
                {!alreadyBet && (
                  <span className="text-[10px] opacity-80">
                    R$ {recommendedStake.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </button>
              <button onClick={handleDismissed} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-muted-foreground font-orbitron text-sm font-bold uppercase hover:bg-secondary/50 transition-colors">
                <Ban className="w-4 h-4" /> Dispensar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );

  const panelVariants = isMobile
    ? { hidden: { y: '100%' }, visible: { y: 0 }, exit: { y: '100%' } }
    : { hidden: { x: '100%' }, visible: { x: 0 }, exit: { x: '100%' } };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
          />

          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed z-50 bg-card border-border flex flex-col',
              isMobile ? 'inset-0' : 'top-0 right-0 bottom-0 w-[60%] max-w-2xl border-l'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="font-orbitron text-sm font-bold text-primary uppercase tracking-wider">
                🤖 Análise Mycroft
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {content}

            {/* Mobile fixed bottom actions */}
            {isMobile && analysis && (
              <div className="fixed bottom-0 left-0 right-0 p-3 bg-card/95 backdrop-blur-lg border-t border-border space-y-2 z-50">
                {/* Already bet banner mobile */}
                {alreadyBet && (
                  <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="font-orbitron font-bold text-primary text-xs uppercase">APOSTA JÁ REALIZADA</span>
                  </div>
                )}
                {/* Bankroll preview mobile */}
                {bankroll && !alreadyBet && (
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-muted-foreground">
                      Banca: <span className="font-bold text-foreground">R$ {bankroll.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Stake: <span className="font-bold text-primary">R$ {recommendedStake.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-accent/20 border border-accent/30 text-accent font-orbitron text-xs font-bold uppercase">
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </button>
                  <button
                    onClick={handleEntered}
                    disabled={placing || insufficientBalance || alreadyBet}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-success text-success-foreground font-orbitron text-xs font-bold uppercase disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> {alreadyBet ? '✅ Já apostado' : placing ? '...' : '💰 Entrei'}
                  </button>
                  <button onClick={handleDismissed} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border text-muted-foreground font-orbitron text-xs font-bold uppercase">
                    <Ban className="w-3.5 h-3.5" /> Dispensar
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
      {isAdmin && match?.matchId && (
        <AdminStatsEditorModal
          isOpen={adminEditOpen}
          onClose={() => setAdminEditOpen(false)}
          matchId={match.matchId}
          homeTeam={match.home}
          awayTeam={match.away}
          currentStats={stats as any}
        />
      )}
    </AnimatePresence>
  );
}
