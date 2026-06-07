import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Send, Flame, MessageCircle, Copy, Share2, Hammer, Bell, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FOUNDERS_GROUP } from '@/config/foundersGroup';
import PunterCronToggle from '@/components/punter/PunterCronToggle';
import { useAdmin } from '@/hooks/useAdmin';

interface FeaturedSignal {
  match_label: string;
  league: string;
  market: string;
  odd: number;
  confidence: number;
}

interface NextMatch {
  label: string;
  league: string;
  kickoff: string; // ISO
}

interface Stats {
  winRate: number;
  weeklyRoi: number;
  greensToday: number;
  betsToday: number;
  settledCount: number;
  weeklyStaked: number;
  source: 'virtual' | 'history' | 'empty';
  lastUpdated: number | null;
}

interface Props {
  userId?: string;
  featuredSignal?: FeaturedSignal | null;
  nextMatch?: NextMatch | null;
  onCtaClick?: () => void;
}

function useCountdown(targetIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PunterHeroBanner = ({ userId, featuredSignal, nextMatch, onCtaClick }: Props) => {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const [stats, setStats] = useState<Stats>({ winRate: 0, weeklyRoi: 0, greensToday: 0, betsToday: 0, settledCount: 0, weeklyStaked: 0, source: 'empty', lastUpdated: null });
  const countdown = useCountdown(nextMatch?.kickoff);

  // (synthetic online counter removed — was creating noise)

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const compute = (data: any[], source: 'virtual' | 'history' | 'empty') => {
      const isGreen = (b: any) => b.status === 'green' || b.result === 'green';
      const isRed = (b: any) => b.status === 'red' || b.result === 'red';
      const settled = data.filter((b: any) => isGreen(b) || isRed(b));
      const wins = settled.filter(isGreen).length;
      const winRate = settled.length ? (wins / settled.length) * 100 : 0;

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekly = data.filter((b: any) => new Date(b.created_at).getTime() >= weekAgo);
      const weeklyStaked = weekly.reduce((s: number, b: any) => s + (Number(b.stake) || 0), 0);
      const weeklyProfit = weekly.reduce((s: number, b: any) => s + (Number(b.profit_loss) || 0), 0);
      const weeklyRoi = weeklyStaked > 0 ? (weeklyProfit / weeklyStaked) * 100 : 0;

      const todayStr = new Date().toISOString().slice(0, 10);
      const today = data.filter((b: any) => (b.created_at || '').slice(0, 10) === todayStr);
      const greensToday = today.filter(isGreen).length;
      return { winRate, weeklyRoi, greensToday, betsToday: today.length, settledCount: settled.length, weeklyStaked, source, lastUpdated: Date.now() };
    };

    const load = async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [punterRes, manualRes] = await Promise.all([
        supabase
          .from('virtual_bets_punter')
          .select('status, result, profit_loss, stake, created_at')
          .eq('user_id', userId)
          .gte('created_at', since)
          .limit(1000),
        supabase
          .from('virtual_bets_manual')
          .select('status, result, profit_loss, stake, created_at')
          .eq('user_id', userId)
          .gte('created_at', since)
          .limit(1000),
      ]);
      if (cancelled) return;
      const virtual = [...(punterRes.data || []), ...(manualRes.data || [])];
      const settledVirtual = virtual.filter((b: any) =>
        b.status === 'green' || b.status === 'red' || b.result === 'green' || b.result === 'red'
      );

      // Fallback: if no settled virtual bets, try bets_history
      if (settledVirtual.length === 0) {
        const { data: history } = await supabase
          .from('bets_history')
          .select('result, profit_loss, stake, created_at')
          .eq('user_id', userId)
          .gte('created_at', since)
          .in('result', ['green', 'red'])
          .limit(1000);
        if (cancelled) return;
        const histData = history || [];
        setStats(compute(histData, histData.length > 0 ? 'history' : 'empty'));
        return;
      }

      setStats(compute(virtual, 'virtual'));
    };

    load();
    // Refresh every 60s for "live data" indicator
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative"
    >
      {/* Subtle scanline + grid backdrop */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Title bar */}
      <div className="flex items-center justify-between mb-3 px-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_hsl(var(--success))]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-success truncate">
            Dados em tempo real
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 hidden sm:inline">
            • {stats.source === 'virtual' ? 'BANCA VIRTUAL' : stats.source === 'history' ? 'HISTÓRICO' : 'AGUARDANDO'}
          </span>
          {stats.lastUpdated && (
            <span className="font-mono text-[10px] text-muted-foreground/50 hidden md:inline">
              • atualizado {new Date(stats.lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/60 hidden sm:inline shrink-0">
          TERMINAL_ID: {userId ? userId.slice(0, 6).toUpperCase() : 'GUEST'}
        </span>
      </div>

      {/* Stats grid — hidden until user has data */}
      {stats.source !== 'empty' && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <StatCard
            label="Strike Rate 30d"
            value={stats.settledCount > 0 ? `${stats.winRate.toFixed(1)}%` : '—'}
            color="primary"
            progress={stats.settledCount > 0 ? stats.winRate : undefined}
            hint={stats.settledCount > 0 ? `${stats.settledCount} entradas resolvidas` : 'aguardando 1ª entrada'}
          />
          <StatCard
            label="ROI 7d"
            value={stats.weeklyStaked > 0 ? `${stats.weeklyRoi >= 0 ? '+' : ''}${stats.weeklyRoi.toFixed(1)}%` : '—'}
            color="warning"
            hint={stats.weeklyStaked > 0 ? 'últimos 7 dias' : 'sem entradas esta semana'}
          />
          <StatCard
            label="Greens Hoje"
            value={stats.betsToday > 0 ? `${stats.greensToday}/${stats.betsToday}` : '—'}
            color="foreground"
            highlight={stats.greensToday > 0}
            hint={stats.betsToday > 0 ? 'entradas hoje' : 'nenhuma entrada hoje'}
          />
        </div>
      )}

      {/* Featured Signal + Next Match */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Featured */}
        <div className="lg:col-span-2 border border-primary/30 bg-card relative overflow-hidden">
          <div className="bg-warning text-warning-foreground px-3 py-1.5 font-black uppercase text-[11px] tracking-widest flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5" /> Entrada Destaque
            </span>
            <span className="font-mono text-[10px] opacity-70">REC.LIVE</span>
          </div>
          {featuredSignal ? (
            <div className="p-4 sm:p-6">
              <p className="font-mono text-[10px] uppercase text-primary/70 mb-1 tracking-widest">
                {featuredSignal.league}
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-foreground italic uppercase mb-4 leading-tight">
                {featuredSignal.match_label}
              </h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="border-l-2 border-primary pl-3">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase">Mercado</p>
                  <p className="text-sm sm:text-base font-bold text-foreground truncate">
                    {featuredSignal.market}
                  </p>
                </div>
                <div className="border-l-2 border-warning pl-3">
                  <p className="text-[9px] font-mono text-warning uppercase">Odd</p>
                  <p className="text-lg sm:text-xl font-mono font-black text-warning italic">
                    @ {featuredSignal.odd.toFixed(2)}
                  </p>
                </div>
                <div className="border-l-2 border-success pl-3">
                  <p className="text-[9px] font-mono text-success uppercase">Confiança</p>
                  <p className="text-lg sm:text-xl font-mono font-black text-success">
                    {featuredSignal.confidence}%
                  </p>
                </div>
              </div>
              <a
                href="https://www.betfair.bet.br/exchange/plus/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onCtaClick}
                className="block w-full bg-primary text-primary-foreground font-black py-3 uppercase text-sm tracking-widest hover:opacity-90 transition-opacity text-center"
              >
                Executar Posição
              </a>
            </div>
          ) : (
            <div className="p-6 sm:p-8 text-center text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aguardando próximo entrada aprovado pelo Mycroft.</p>
              <p className="text-[10px] font-mono mt-2 opacity-60">SCANNING_MARKETS...</p>
            </div>
          )}
        </div>

        {/* Side column: countdown + telegram */}
        <div className="space-y-3">
          {nextMatch && (
            <div className="border border-primary/30 bg-card/50">
              <div className="px-3 py-1.5 border-b border-primary/20 font-mono text-[10px] flex justify-between text-muted-foreground">
                <span>NEXT_EVENT</span>
                <span className="text-destructive animate-pulse">COUNTDOWN</span>
              </div>
              <div className="p-4 text-center">
                <div className="font-mono text-2xl sm:text-3xl font-black text-foreground tabular-nums tracking-tight">
                  {countdown ?? '--:--:--'}
                </div>
                <p className="text-[9px] font-mono text-primary/60 uppercase tracking-widest mt-1">
                  Hrs : Min : Seg
                </p>
                <p className="text-[10px] text-foreground mt-3 font-bold uppercase truncate">
                  {nextMatch.label}
                </p>
              </div>
            </div>
          )}

          <a
            href="https://t.me/oraculo_mycroft"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-[#229ED9]/40 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 transition-colors p-3 group text-left flex items-center gap-3"
          >
            <div className="shrink-0 w-9 h-9 flex items-center justify-center border border-[#229ED9]/50 bg-background">
              <Send className="w-4 h-4 text-[#229ED9]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#229ED9]/80">
                Comunidade Oficial
              </p>
              <p className="font-bold text-foreground text-sm">
                Entrar no grupo VIP do Telegram
              </p>
            </div>
            <span className="bg-[#229ED9] text-white px-2 py-1 text-[10px] font-black uppercase tracking-tight group-hover:bg-foreground transition-colors">
              Entrar
            </span>
          </a>

          <div className="border border-[#25D366]/40 bg-[#25D366]/10 transition-colors group text-left flex items-stretch">
            <a
              href={FOUNDERS_GROUP.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 flex items-center gap-3 p-3 hover:bg-[#25D366]/20 transition-colors"
            >
              <div className="shrink-0 w-9 h-9 flex items-center justify-center border border-[#25D366]/50 bg-background">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm leading-tight">
                  Acessar Grupo VIP Whatsapp
                </p>
              </div>
              <span className="bg-[#25D366] text-white px-2 py-1 text-[10px] font-black uppercase tracking-tight group-hover:bg-foreground transition-colors shrink-0">
                {FOUNDERS_GROUP.cta}
              </span>
            </a>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const shareData = {
                  title: FOUNDERS_GROUP.eyebrow,
                  text: FOUNDERS_GROUP.title,
                  url: FOUNDERS_GROUP.url,
                };
                const canShare =
                  typeof navigator !== 'undefined' &&
                  typeof navigator.share === 'function' &&
                  (typeof navigator.canShare !== 'function' || navigator.canShare(shareData));
                if (canShare) {
                  try {
                    await navigator.share(shareData);
                    return;
                  } catch (err: any) {
                    // User cancelled — silent. Other errors fall through to clipboard.
                    if (err?.name === 'AbortError') return;
                  }
                }
                try {
                  await navigator.clipboard.writeText(FOUNDERS_GROUP.url);
                  toast.success('Link copiado!', {
                    description: 'Compartilhe com outros fundadores.',
                  });
                } catch {
                  toast.error('Não foi possível copiar o link.');
                }
              }}
              aria-label="Compartilhar link do grupo dos Fundadores"
              title="Compartilhar link"
              className="shrink-0 px-3 flex items-center justify-center border-l border-[#25D366]/40 hover:bg-[#25D366]/20 transition-colors"
            >
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                <Share2 className="w-4 h-4 text-[#25D366]" />
              ) : (
                <Copy className="w-4 h-4 text-[#25D366]" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/punter/liquidacoes')}
            className="w-full border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-colors p-3 group text-left flex items-center gap-3"
          >
            <div className="shrink-0 w-9 h-9 flex items-center justify-center border border-primary/50 bg-background">
              <Hammer className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-primary/80">
                Liquidação Automática
              </p>
              <p className="font-bold text-foreground text-sm leading-tight">
                Verificar Entradas Liquidadas
              </p>
            </div>
            <span className="bg-primary text-primary-foreground px-2 py-1 text-[10px] font-black uppercase tracking-tight group-hover:bg-foreground transition-colors shrink-0">
              Abrir
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/punter/feed-eventos')}
            className="w-full border border-warning/40 bg-warning/10 hover:bg-warning/20 transition-colors p-3 group text-left flex items-center gap-3"
          >
            <div className="shrink-0 w-9 h-9 flex items-center justify-center border border-warning/50 bg-background">
              <Bell className="w-4 h-4 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-warning/80">
                Feed & Eventos Raros
              </p>
              <p className="font-bold text-foreground text-sm leading-tight">
                Ver Feed de Entradas e Eventos Raros
              </p>
            </div>
            <span className="bg-warning text-background px-2 py-1 text-[10px] font-black uppercase tracking-tight group-hover:bg-foreground transition-colors shrink-0">
              Abrir
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/punter/performance-por-mercado')}
            className="w-full border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors p-3 group text-left flex items-center gap-3"
          >
            <div className="shrink-0 w-9 h-9 flex items-center justify-center border border-emerald-500/50 bg-background">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/80">
                Análise de Desempenho
              </p>
              <p className="font-bold text-foreground text-sm leading-tight">
                Performance por Mercado
              </p>
            </div>
            <span className="bg-emerald-500 text-background px-2 py-1 text-[10px] font-black uppercase tracking-tight group-hover:bg-foreground transition-colors shrink-0">
              Abrir
            </span>
          </button>

          {isAdmin && (
            <div className="flex justify-end pt-1">
              <PunterCronToggle />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  color: 'primary' | 'warning' | 'foreground';
  progress?: number;
  highlight?: boolean;
  hint?: string;
}

const StatCard = ({ label, value, color, progress, highlight, hint }: StatCardProps) => {
  const colorMap = {
    primary: 'text-primary',
    warning: 'text-warning',
    foreground: highlight ? 'text-success' : 'text-foreground',
  } as const;
  const glowMap = {
    primary: '0 0 10px hsl(var(--primary) / 0.6)',
    warning: '0 0 10px hsl(var(--warning) / 0.6)',
    foreground: highlight ? '0 0 10px hsl(var(--success) / 0.6)' : 'none',
  } as const;
  return (
    <div className="border border-primary/20 bg-card/60 p-3 sm:p-4 backdrop-blur-sm">
      <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div
        className={`text-2xl sm:text-4xl font-mono font-extrabold tabular-nums mt-1 sm:mt-2 ${colorMap[color]}`}
        style={{ textShadow: glowMap[color] }}
      >
        {value}
      </div>
      {typeof progress === 'number' && (
        <div className="h-1 w-full bg-muted/30 mt-2 sm:mt-3">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%`, boxShadow: '0 0 8px hsl(var(--primary))' }}
          />
        </div>
      )}
      {hint && (
        <p className="font-mono text-[9px] text-muted-foreground/70 mt-1.5 truncate">{hint}</p>
      )}
    </div>
  );
};

export default PunterHeroBanner;
