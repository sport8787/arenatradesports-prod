import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Trophy, Loader2, ChevronRight, TrendingUp,
  BarChart2, Target, Layers, Eye, EyeOff, Bell, BellOff, BellRing,
} from 'lucide-react';
import CopaChatMycroft from '@/components/punter/CopaChatMycroft';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useCopaSignalSound } from '@/hooks/useCopaSignalSound';
import { setupAudioUnlock } from '@/lib/criticalAlertSound';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CopaSignal {
  id: string;
  created_at: string;
  home: string | null;
  away: string | null;
  phase: string | null;
  market: string | null;
  selection: string | null;
  ah_line: number | null;
  odd: number | null;
  prob: number | null;
  ve_pct: number | null;
  edge_pct: number | null;
  confidence: number | null;
  block: string | null;
  stake_pct: number | null;
  rationale: string | null;
  vetos: string[] | null;
  resultado: string | null;
  profit_loss: number | null;
  copa_badge: boolean | null;
  commence_time: string | null;
  status: string | null;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  grupos_j1: 'Grupos · J1',
  grupos_j2: 'Grupos · J2',
  grupos_j3: 'Grupos · J3',
  oitavas: 'Oitavas',
  quartas: 'Quartas',
  semi: 'Semifinal',
  '3lugar': '3º Lugar',
  final: 'Final',
};

const PHASE_ORDER = ['grupos_j1', 'grupos_j2', 'grupos_j3', 'oitavas', 'quartas', 'semi', '3lugar', 'final'];

type SubPage = 'sinais' | 'roi' | 'acerto' | 'mercados';

// ─── Entrada em Destaque ───────────────────────────────────────────────────────

function EntradaDestaque({ s, onNavigate }: { s: CopaSignal; onNavigate: () => void }) {
  const isPending = !s.resultado;
  const isExpired = s.status === 'EXPIRADO' || (isPending && s.commence_time != null && new Date(s.commence_time) <= new Date());
  return (
    <div className="rounded-2xl overflow-hidden border border-yellow-500/40 shadow-[0_0_30px_rgba(234,179,8,0.08)]">
      {/* Header bar */}
      <div className="bg-yellow-500 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-black font-mono font-black text-[11px] tracking-widest uppercase">
            🔥 Entrada Destaque
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-black/20 text-black text-[10px] font-mono font-bold px-2 py-0.5 rounded">
            🏆 COPA 2026
          </span>
          {s.phase && (
            <span className="bg-black/15 text-black text-[10px] font-mono px-2 py-0.5 rounded">
              {PHASE_LABEL[s.phase] || s.phase}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-[#0d1a0d] px-4 py-4 space-y-4">
        {/* Times */}
        <div>
          <div className="font-mono font-black text-xl sm:text-2xl text-white uppercase tracking-tight leading-tight">
            {s.home ?? '?'} <span className="text-yellow-400/60">vs</span> {s.away ?? '?'}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border-l-2 border-yellow-500/60 pl-3">
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Mercado</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {s.market ?? '—'}{s.selection ? ` ${s.selection}` : ''}
            </div>
          </div>
          <div className="border-l-2 border-yellow-500/60 pl-3">
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Odd</div>
            <div className="text-xl font-black text-yellow-400 mt-0.5 font-mono">
              @ {s.odd != null ? Number(s.odd).toFixed(2) : '—'}
            </div>
          </div>
          <div className="border-l-2 border-green-500/60 pl-3">
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Confiança</div>
            <div className="text-xl font-black text-green-400 mt-0.5 font-mono">
              {s.confidence != null ? `${s.confidence}%` : '—'}
            </div>
          </div>
        </div>

        {/* CTA */}
        {!isPending ? (
          <div className={`w-full text-center font-mono font-bold text-sm py-3 rounded-xl ${s.resultado === 'GREEN' ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'bg-red-900/40 text-red-400 border border-red-500/30'}`}>
            {s.resultado}{s.profit_loss != null ? ` · ${s.profit_loss >= 0 ? '+' : ''}${Number(s.profit_loss).toFixed(2)}u` : ''}
          </div>
        ) : isExpired ? (
          <div className="w-full text-center font-mono font-bold text-sm py-3 rounded-xl bg-orange-900/30 text-orange-400 border border-orange-500/30">
            ⏰ Jogo iniciado — entrada encerrada
          </div>
        ) : (
          <button
            onClick={onNavigate}
            className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-mono font-black text-sm tracking-widest uppercase py-3 rounded-xl transition-all"
          >
            Executar Posição
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Feature Button ────────────────────────────────────────────────────────────

function FeatureButton({ emoji, label, subtitle, color, onClick }: {
  emoji: string; label: string; subtitle: string; color: 'yellow' | 'green' | 'red'; onClick: () => void;
}) {
  const iconBg = color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/20'
    : color === 'green' ? 'bg-green-500/10 border-green-500/20'
    : 'bg-red-500/10 border-red-500/20';
  const btnBg = color === 'yellow' ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
    : color === 'green' ? 'bg-green-600 hover:bg-green-500 text-white'
    : 'bg-red-600 hover:bg-red-500 text-white';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-[#0a140a] border border-white/8 rounded-xl px-4 py-3.5 hover:border-white/15 hover:bg-white/5 transition-all text-left group"
    >
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl flex-shrink-0 ${iconBg}`}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/40 font-mono uppercase tracking-wider leading-none mb-0.5">
          Arena Copa
        </div>
        <div className="text-sm font-bold text-white truncate">{label}</div>
        <div className="text-[10px] text-white/40 mt-0.5 truncate">{subtitle}</div>
      </div>
      <span className={`text-[11px] font-mono font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${btnBg}`}>
        ABRIR
      </span>
    </button>
  );
}

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="bg-black/40 border-yellow-500/20">
      <CardContent className="pt-4 pb-3">
        <div className={`text-2xl font-bold font-mono ${color ?? 'text-yellow-400'}`}>{value}</div>
        <div className="text-xs text-white/60 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SignalCard({ s, advanced }: { s: CopaSignal; advanced: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isGreen = s.resultado === 'GREEN';
  const isRed = s.resultado === 'RED';
  const isExpired = s.status === 'EXPIRADO' || (!s.resultado && s.commence_time != null && new Date(s.commence_time) <= new Date());

  return (
    <Card className="border-yellow-500/20 bg-black/40 overflow-hidden">
      <div className={`h-1 w-full ${isGreen ? 'bg-green-500' : isRed ? 'bg-red-500' : 'bg-yellow-500/40'}`} />
      <CardContent className="pt-4 space-y-3">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="bg-yellow-500 text-black text-[10px] font-bold gap-1 px-2">
            🏆 COPA 2026
          </Badge>
          {s.phase && (
            <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-300/80">
              {PHASE_LABEL[s.phase] || s.phase}
            </Badge>
          )}
          {s.block && (
            <Badge variant="secondary" className="text-[10px]">Bloco {s.block}</Badge>
          )}
          {s.resultado ? (
            <Badge className={`text-[10px] ${isGreen ? 'bg-green-600' : 'bg-red-600'}`}>
              {s.resultado}{s.profit_loss != null ? ` (${s.profit_loss >= 0 ? '+' : ''}${Number(s.profit_loss).toFixed(2)}u)` : ''}
            </Badge>
          ) : isExpired ? (
            <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-400">
              ⏰ JOGO INICIADO
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">
              PENDENTE
            </Badge>
          )}
        </div>

        {/* Times */}
        <div className="font-semibold text-white">
          {s.home ?? '?'} <span className="text-white/40 text-sm font-normal">vs</span> {s.away ?? '?'}
        </div>

        {/* Dados técnicos */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {[
            { l: 'Odd', v: s.odd != null ? Number(s.odd).toFixed(2) : '—' },
            { l: 'VE', v: s.ve_pct != null ? `${Number(s.ve_pct).toFixed(1)}%` : '—' },
            { l: 'Conf', v: s.confidence != null ? `${s.confidence}%` : '—' },
            { l: 'Stake', v: s.stake_pct != null ? `${s.stake_pct}%` : '—' },
          ].map(({ l, v }) => (
            <div key={l} className="bg-white/5 rounded-lg py-1.5">
              <div className="text-[10px] text-white/40">{l}</div>
              <div className="text-xs font-mono font-semibold text-yellow-300">{v}</div>
            </div>
          ))}
        </div>

        {/* Mercado */}
        <div className="text-xs text-white/60 font-mono">
          {s.market}{s.selection ? ` · ${s.selection}` : ''}
        </div>

        {/* Tese Mycroft */}
        {s.rationale && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-[11px] text-yellow-400/80 hover:text-yellow-400 border border-yellow-500/20 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {expanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              Tese Mycroft
            </span>
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
        {expanded && s.rationale && (
          <div className="bg-white/5 rounded-lg p-3 text-xs text-white/70 leading-relaxed border border-yellow-500/10 font-mono">
            {s.rationale}
          </div>
        )}

        {/* Score asset (advanced) */}
        {advanced && (s.prob != null || s.edge_pct != null) && (
          <div className="flex gap-2 text-[10px]">
            {s.prob != null && (
              <span className="bg-white/5 rounded px-2 py-1 text-white/50 font-mono">
                Prob {(Number(s.prob) * 100).toFixed(0)}%
              </span>
            )}
            {s.edge_pct != null && (
              <span className="bg-white/5 rounded px-2 py-1 text-white/50 font-mono">
                Edge {Number(s.edge_pct).toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sub-páginas ───────────────────────────────────────────────────────────────

function RoiPage({ signals }: { signals: CopaSignal[] }) {
  const settled = signals.filter(s => s.resultado && s.profit_loss != null);
  let cumulative = 0;
  const points = settled.map(s => {
    cumulative += s.profit_loss!;
    return {
      label: `${s.home?.slice(0, 3).toUpperCase()} x ${s.away?.slice(0, 3).toUpperCase()}`,
      cum: cumulative,
      resultado: s.resultado,
    };
  });
  const roi = cumulative;

  return (
    <Card className="bg-black/40 border-yellow-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-yellow-400 font-mono">ROI Acumulado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`text-4xl font-bold font-mono ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {roi >= 0 ? '+' : ''}{roi.toFixed(2)}u
        </div>
        <div className="text-xs text-white/50">{settled.length} entradas liquidadas</div>
        {points.length === 0 ? (
          <p className="text-xs text-white/30">Nenhuma entrada liquidada ainda.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {points.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                <span className="text-white/50 font-mono">{i + 1}. {p.label}</span>
                <span className={`font-mono font-semibold ${p.cum >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.cum >= 0 ? '+' : ''}{p.cum.toFixed(2)}u
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccuracyPage({ signals }: { signals: CopaSignal[] }) {
  const byPhase = PHASE_ORDER.map(phase => {
    const inPhase = signals.filter(s => s.phase === phase && s.resultado);
    const greens = inPhase.filter(s => s.resultado === 'GREEN').length;
    const reds = inPhase.filter(s => s.resultado === 'RED').length;
    const total = greens + reds;
    return { phase, label: PHASE_LABEL[phase] || phase, total, greens, reds, acc: total ? Math.round((greens / total) * 100) : null };
  }).filter(p => p.total > 0);

  return (
    <Card className="bg-black/40 border-yellow-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-yellow-400 font-mono">% Acerto por Fase</CardTitle>
      </CardHeader>
      <CardContent>
        {byPhase.length === 0 ? (
          <p className="text-xs text-white/40">Nenhum resultado liquidado ainda.</p>
        ) : (
          <div className="space-y-4">
            {byPhase.map(p => (
              <div key={p.phase}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/70 font-semibold">{p.label}</span>
                  <span className="font-mono text-yellow-400">
                    {p.acc ?? '—'}% <span className="text-white/40">({p.greens}G · {p.reds}R)</span>
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all"
                    style={{ width: `${p.acc ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketsPage({ signals }: { signals: CopaSignal[] }) {
  const settled = signals.filter(s => s.resultado && s.profit_loss != null);
  const byMarket = Array.from(new Set(settled.map(s => s.market))).map(mkt => {
    const inMkt = settled.filter(s => s.market === mkt);
    const greens = inMkt.filter(s => s.resultado === 'GREEN').length;
    const reds = inMkt.filter(s => s.resultado === 'RED').length;
    const pl = inMkt.reduce((acc, s) => acc + (s.profit_loss ?? 0), 0);
    const acc = greens + reds > 0 ? Math.round((greens / (greens + reds)) * 100) : 0;
    return { market: mkt || '?', count: inMkt.length, greens, reds, pl, acc };
  }).sort((a, b) => b.pl - a.pl);

  return (
    <Card className="bg-black/40 border-yellow-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-yellow-400 font-mono">Mercados mais lucrativos</CardTitle>
      </CardHeader>
      <CardContent>
        {byMarket.length === 0 ? (
          <p className="text-xs text-white/40">Nenhum resultado liquidado ainda.</p>
        ) : (
          <div className="space-y-2">
            {byMarket.map(m => (
              <div key={m.market} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <div className="text-sm font-semibold text-white">{m.market}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{m.count} entradas · {m.acc}% acerto</div>
                </div>
                <div className={`font-mono font-bold text-base ${m.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {m.pl >= 0 ? '+' : ''}{m.pl.toFixed(2)}u
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function PunterCopa() {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<CopaSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextFixture, setNextFixture] = useState<{ fixture_id: string; home: string; away: string; phase: string; commence_time: string } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [subPage, setSubPage] = useState<SubPage>('sinais');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('copa.sound.enabled') !== 'false'; } catch { return true; }
  });

  const { requestPush, disablePush, isSupported, permission, enabled: pushEnabled } = usePushNotifications();
  useCopaSignalSound(soundEnabled);

  useEffect(() => { setupAudioUnlock(); }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem('copa.sound.enabled', String(next)); } catch { /* ignore */ }
  };

  const handlePushToggle = async () => {
    if (pushEnabled && permission === 'granted') await disablePush();
    else await requestPush();
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('punter_copa_signals')
        .select('id, created_at, home, away, phase, market, selection, ah_line, odd, prob, ve_pct, edge_pct, confidence, block, stake_pct, rationale, vetos, resultado, profit_loss, copa_badge, commence_time, status')
        .order('commence_time', { ascending: true })
        .limit(500);
      setSignals((data as CopaSignal[]) || []);
      setLoading(false);
    })();
  }, []);

  // Próximo jogo Copa para contexto do chat
  useEffect(() => {
    (async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('copa_fixtures')
        .select('fixture_id, home, away, phase, commence_time')
        .gte('commence_time', now)
        .order('commence_time', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) setNextFixture(data as typeof nextFixture);
    })();
  }, []);

  const approved = useMemo(
    () => signals.filter(s => s.status === 'APROVADO' || (!s.status && (!s.vetos || (s.vetos as string[]).length === 0))),
    [signals],
  );
  const vetados = useMemo(
    () => signals.filter(s => s.status === 'VETADO' && s.vetos && (s.vetos as string[]).length > 0),
    [signals],
  );
  const settled = useMemo(
    () => signals.filter(s => s.resultado && s.profit_loss != null),
    [signals],
  );

  const greens = settled.filter(s => s.resultado === 'GREEN').length;
  const reds = settled.filter(s => s.resultado === 'RED').length;
  const winRate = greens + reds > 0 ? Math.round((greens / (greens + reds)) * 100) : null;
  const roi = settled.reduce((acc, s) => acc + (s.profit_loss ?? 0), 0);

  const subNavItems: { key: SubPage; label: string; icon: React.ElementType }[] = [
    { key: 'sinais', label: 'Sinais', icon: Target },
    { key: 'roi', label: 'ROI', icon: TrendingUp },
    { key: 'acerto', label: '% Acerto', icon: BarChart2 },
    { key: 'mercados', label: 'Mercados', icon: Layers },
  ];

  // Sinal destaque: pendente de jogo ainda não iniciado, com maior confiança
  const featuredSignal = useMemo(() => {
    const now = new Date();
    // Prefere sinais pendentes cujo jogo ainda não começou
    const actionable = approved.filter(s =>
      !s.resultado &&
      s.status !== 'EXPIRADO' &&
      s.commence_time != null &&
      new Date(s.commence_time) > now,
    );
    if (actionable.length > 0) {
      return actionable.reduce((best, s) =>
        (s.confidence ?? 0) > (best.confidence ?? 0) ? s : best, actionable[0]);
    }
    // Fallback: mostra o sinal mais recente (pode ser expirado/liquidado)
    return approved[approved.length - 1] ?? null;
  }, [approved]);

  return (
    <div className="min-h-screen bg-[#071207] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-yellow-500/20 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/lobby')}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl flex-shrink-0">🏆</span>
            <div className="min-w-0">
              <h1 className="font-mono text-sm font-bold tracking-tight text-yellow-400 truncate">
                ESPECIAL COPA DO MUNDO 2026
              </h1>
              <p className="font-mono text-[10px] text-yellow-500/60 tracking-widest">
                RUMO AO HEXA · ARENA PUNTER
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAdvanced(v => !v); setSubPage('sinais'); }}
            className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-[11px] gap-1.5 flex-shrink-0"
          >
            {advanced ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {advanced ? 'Simples' : 'Avançado'}
          </Button>
        </div>

        {/* Sub-nav (modo avançado) */}
        {advanced && (
          <div className="border-t border-yellow-500/10">
            <div className="container mx-auto px-4 flex gap-1 py-1.5 overflow-x-auto">
              {subNavItems.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSubPage(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap transition-colors ${
                    subPage === key
                      ? 'bg-yellow-500 text-black'
                      : 'text-yellow-400/60 hover:text-yellow-400 hover:bg-yellow-500/10'
                  }`}
                >
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-5 max-w-2xl space-y-5">
        <PunterBreadcrumb items={[{ label: 'Copa 2026' }]} />

        {/* Hero banner */}
        <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-green-900/50 via-black/60 to-yellow-900/30 p-6 text-center">
          <div className="text-4xl mb-2">🇧🇷</div>
          <h2 className="font-mono font-black text-2xl text-yellow-400 tracking-tight">
            RUMO AO HEXA
          </h2>
          <p className="text-xs text-white/50 mt-1.5 font-mono leading-relaxed max-w-xs mx-auto">
            Mycroft analisa cada duelo da Copa com edge matemático real e validação por IA
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-yellow-400/50">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando sinais…
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Sinais Copa" value={String(approved.length)} />
              <StatCard
                label="Win Rate"
                value={winRate != null ? `${winRate}%` : '—'}
                sub={winRate != null ? `${greens}G · ${reds}R` : 'sem dados'}
                color={winRate != null ? (winRate >= 50 ? 'text-green-400' : 'text-red-400') : 'text-yellow-400'}
              />
              <StatCard
                label="P/L Total"
                value={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}u`}
                color={roi >= 0 ? 'text-green-400' : 'text-red-400'}
              />
              <StatCard label="Liquidados" value={String(settled.length)} sub={`de ${approved.length}`} />
            </div>

            {/* ── Notificações (sempre visível) ── */}
            {subPage === 'sinais' && (
              <div className="rounded-2xl border border-yellow-500/20 bg-[#0a140a] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">Alertas de Entrada</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Som + push quando Mycroft aprovar um sinal Copa</div>
                  </div>
                </div>
                <div className="px-4 pb-3 flex gap-2 flex-wrap">
                  {/* Botão de som */}
                  <button
                    onClick={toggleSound}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex-1 justify-center ${
                      soundEnabled
                        ? 'bg-yellow-500 text-black'
                        : 'bg-white/8 text-white/50 border border-white/10'
                    }`}
                  >
                    {soundEnabled ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    {soundEnabled ? 'Som ativo' : 'Ativar som'}
                  </button>

                  {/* Botão de push */}
                  {isSupported && (
                    <button
                      onClick={handlePushToggle}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex-1 justify-center ${
                        pushEnabled && permission === 'granted'
                          ? 'bg-green-600 text-white'
                          : permission === 'denied'
                          ? 'bg-white/5 text-red-400/60 border border-red-500/20 cursor-not-allowed'
                          : 'bg-green-900/50 text-green-400 border border-green-500/30'
                      }`}
                      disabled={permission === 'denied'}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {pushEnabled && permission === 'granted'
                        ? 'Push ativo'
                        : permission === 'denied'
                        ? 'Bloqueado'
                        : 'Ativar push'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Sinais ── */}
            {subPage === 'sinais' && (
              <div className="space-y-5">

                {/* Entrada em Destaque */}
                {featuredSignal ? (
                  <EntradaDestaque
                    s={featuredSignal}
                    onNavigate={() => navigate('/punter/sinais-alavanca')}
                  />
                ) : (
                  <Card className="bg-black/40 border-yellow-500/20">
                    <CardContent className="pt-8 pb-7 text-center space-y-2">
                      <Trophy className="w-9 h-9 text-yellow-400/20 mx-auto" />
                      <p className="text-sm text-white/50">Nenhum sinal Copa aprovado ainda.</p>
                      <p className="text-[11px] text-white/30 font-mono leading-relaxed">
                        O Mycroft analisa automaticamente às 11:00 UTC.<br />
                        Copa do Mundo começa em junho de 2026.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Funcionalidades Copa — sempre visíveis */}
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-500/50 px-1">
                    Funcionalidades Copa
                  </p>
                  <FeatureButton
                    emoji="⚽"
                    label="Bolão da Copa 2026"
                    subtitle="Acerte os placares e suba no ranking"
                    color="yellow"
                    onClick={() => navigate('/punter/copa/bolao')}
                  />
                  <FeatureButton
                    emoji="👩‍💼"
                    label="Dialma IA"
                    subtitle="A IA presidencial prevê a Copa com metas quânticas"
                    color="green"
                    onClick={() => navigate('/punter/copa/calango')}
                  />
                  <FeatureButton
                    emoji="🔴"
                    label="Arena Live Copa"
                    subtitle="Jogos ao vivo com sinais em tempo real"
                    color="red"
                    onClick={() => navigate('/arena-live/copa')}
                  />
                </div>

                {/* Todos os sinais aprovados */}
                {approved.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-500/50 px-1">
                      Todas as Entradas · {approved.length}
                    </p>
                    {approved.map(s => <SignalCard key={s.id} s={s} advanced={advanced} />)}
                  </div>
                )}

                {/* Sinais vetados */}
                {vetados.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-red-500/50 px-1">
                      Vetados pelo Mycroft · {vetados.length}
                    </p>
                    {vetados.map(s => (
                      <Card key={s.id} className="border-red-500/20 bg-black/40 overflow-hidden">
                        <div className="h-0.5 w-full bg-red-500/40" />
                        <CardContent className="pt-3 pb-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-red-900/60 text-red-400 border border-red-500/30 text-[10px]">VETADO</Badge>
                            {s.phase && (
                              <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
                                {PHASE_LABEL[s.phase] || s.phase}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-white/70">
                            {s.home ?? '?'} <span className="text-white/30 text-xs font-normal">vs</span> {s.away ?? '?'}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(s.vetos as string[]).map((v, i) => (
                              <span key={i} className="text-[10px] bg-red-900/30 text-red-400/80 px-2 py-0.5 rounded font-mono border border-red-500/20">
                                {v}
                              </span>
                            ))}
                          </div>
                          {(s.ve_pct != null || s.confidence != null) && (
                            <div className="flex gap-2 text-[10px]">
                              {s.ve_pct != null && (
                                <span className="text-white/30 font-mono">VE {Number(s.ve_pct).toFixed(1)}%</span>
                              )}
                              {s.confidence != null && (
                                <span className="text-white/30 font-mono">Conf {s.confidence}%</span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {subPage === 'roi' && <RoiPage signals={signals} />}
            {subPage === 'acerto' && <AccuracyPage signals={signals} />}
            {subPage === 'mercados' && <MarketsPage signals={signals} />}
          </>
        )}
      </main>

      {/* Chat flutuante com Mycroft para análise manual Copa */}
      <CopaChatMycroft featuredMatch={nextFixture} />
    </div>
  );
}
