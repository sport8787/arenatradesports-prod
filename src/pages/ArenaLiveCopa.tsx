import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Loader2, RefreshCw, Bell, BellOff, BellRing } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCopaSignalSound } from '@/hooks/useCopaSignalSound';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { setupAudioUnlock } from '@/lib/criticalAlertSound';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CopaFixture {
  fixture_id: string;
  home: string;
  away: string;
  phase: string;
  commence_time: string;
  home_fifa_rank: number | null;
  away_fifa_rank: number | null;
  raw: any;
}

interface LiveSignal {
  id: string;
  fixture_id: string;
  home: string;
  away: string;
  market: string;
  selection: string | null;
  odd: number | null;
  ve_pct: number | null;
  confidence: number | null;
  rationale: string | null;
  status: string | null;
  resultado: string | null;
  profit_loss: number | null;
  commence_time: string | null;
}

const PHASE_LABEL: Record<string, string> = {
  grupos_j1: 'Grupos J1', grupos_j2: 'Grupos J2', grupos_j3: 'Grupos J3',
  oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semifinal', '3lugar': '3º Lugar', final: 'Final',
};

function isToday(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isLive(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = Date.now();
  const start = d.getTime();
  // Considerado "em campo" se começou há menos de 110 minutos
  return start <= now && now <= start + 110 * 60 * 1000;
}

// ─── Componente de jogo ao vivo / hoje ────────────────────────────────────────

function MatchCard({ fx, signals }: { fx: CopaFixture; signals: LiveSignal[] }) {
  const live = isLive(fx.commence_time);
  const started = new Date(fx.commence_time) <= new Date();

  // Placares do raw se disponíveis
  const scoreH = fx.raw?.goals?.home ?? null;
  const scoreA = fx.raw?.goals?.away ?? null;
  const elapsed = fx.raw?.fixture?.status?.elapsed ?? null;

  return (
    <Card className={`overflow-hidden ${live ? 'border-red-500/50 bg-red-900/10' : 'border-yellow-500/20 bg-black/40'}`}>
      {live && <div className="h-0.5 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-pulse" />}
      <CardContent className="pt-4 pb-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {live ? (
            <Badge className="bg-red-600 text-[10px] animate-pulse gap-1">
              <Activity className="w-2.5 h-2.5" /> AO VIVO {elapsed != null ? `${elapsed}'` : ''}
            </Badge>
          ) : started ? (
            <Badge variant="secondary" className="text-[10px]">Encerrado</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-300/80">
              {new Date(fx.commence_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
            {PHASE_LABEL[fx.phase] || fx.phase}
          </Badge>
        </div>

        {/* Placar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 text-right">
            <div className="font-bold text-white">{fx.home}</div>
            {fx.home_fifa_rank && <div className="text-[10px] text-white/30">FIFA #{fx.home_fifa_rank}</div>}
          </div>
          <div className="font-mono font-black text-2xl text-yellow-400">
            {scoreH != null && scoreA != null ? `${scoreH}:${scoreA}` : '–:–'}
          </div>
          <div className="flex-1">
            <div className="font-bold text-white">{fx.away}</div>
            {fx.away_fifa_rank && <div className="text-[10px] text-white/30">FIFA #{fx.away_fifa_rank}</div>}
          </div>
        </div>

        {/* Sinais aprovados para este jogo */}
        {signals.length > 0 && (
          <div className="border-t border-white/5 pt-2 space-y-1.5">
            <p className="text-[10px] text-yellow-400/60 font-mono">Sinais Punter Copa</p>
            {signals.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-white/70 font-mono">{s.market}{s.selection ? ` · ${s.selection}` : ''}</span>
                <div className="flex items-center gap-2">
                  {s.odd != null && <span className="text-yellow-400 font-mono">@{Number(s.odd).toFixed(2)}</span>}
                  {s.resultado && (
                    <Badge className={`text-[9px] ${s.resultado === 'GREEN' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {s.resultado}
                    </Badge>
                  )}
                  {!s.resultado && s.status === 'APROVADO' && (
                    <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">ATIVO</Badge>
                  )}
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

export default function ArenaLiveCopa() {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<CopaFixture[]>([]);
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('copa.sound.enabled') !== 'false'; } catch { return true; }
  });

  const { requestPush, disablePush, isSupported, permission, enabled: pushEnabled } = usePushNotifications();
  useCopaSignalSound(soundEnabled);

  // Desbloqueia AudioContext na primeira interação do usuário
  useEffect(() => { setupAudioUnlock(); }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem('copa.sound.enabled', String(next)); } catch { /* ignore */ }
  };

  const handlePushToggle = async () => {
    if (pushEnabled && permission === 'granted') {
      await disablePush();
    } else {
      await requestPush();
    }
  };

  async function loadData() {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);

    const [fxRes, sigRes] = await Promise.all([
      supabase
        .from('copa_fixtures')
        .select('fixture_id, home, away, phase, commence_time, home_fifa_rank, away_fifa_rank, raw')
        .gte('commence_time', `${today}T00:00:00`)
        .lte('commence_time', `${tomorrow}T23:59:59`)
        .order('commence_time'),
      supabase
        .from('punter_copa_signals')
        .select('id, fixture_id, home, away, market, selection, odd, ve_pct, confidence, rationale, status, resultado, profit_loss, commence_time')
        .gte('commence_time', `${today}T00:00:00`)
        .order('commence_time'),
    ]);

    setFixtures((fxRes.data || []) as CopaFixture[]);
    setSignals((sigRes.data || []) as LiveSignal[]);
    setLastUpdate(new Date());
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000); // atualiza a cada 1 min
    return () => clearInterval(interval);
  }, []);

  const liveFixtures = fixtures.filter(f => isLive(f.commence_time));
  const todayFixtures = fixtures.filter(f => isToday(f.commence_time) && !isLive(f.commence_time));

  const getSignals = (fixtureId: string) =>
    signals.filter(s => s.fixture_id === fixtureId && s.status === 'APROVADO');

  return (
    <div className="min-h-screen bg-[#071207] text-white">
      <header className="sticky top-0 z-40 border-b border-red-500/30 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/punter/copa')} className="text-white/50 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-sm font-bold text-red-400 flex items-center gap-2">
              <Activity className="w-4 h-4 animate-pulse" /> ARENA LIVE · COPA 2026
            </h1>
            <p className="font-mono text-[10px] text-red-500/60">
              Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-[11px] gap-1.5">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
        </div>

        {/* Barra de notificações */}
        <div className="border-t border-red-500/10 container mx-auto px-4 py-2 flex items-center gap-2">
          {/* Som */}
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors ${
              soundEnabled
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-white/5 text-white/40 border border-white/10'
            }`}
          >
            {soundEnabled ? <BellRing className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            {soundEnabled ? 'Som ativo' : 'Som off'}
          </button>

          {/* Push */}
          {isSupported && (
            <button
              onClick={handlePushToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors ${
                pushEnabled && permission === 'granted'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 animate-pulse'
              }`}
            >
              <Bell className="w-3 h-3" />
              {pushEnabled && permission === 'granted' ? 'Push ativo' : 'Ativar push'}
            </button>
          )}
          {permission === 'denied' && (
            <span className="text-[10px] text-red-400/60 font-mono">Notificações bloqueadas no navegador</span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-xl space-y-5">
        {loading ? (
          <div className="flex justify-center py-12 text-red-400/50">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* Jogos ao vivo */}
            {liveFixtures.length > 0 && (
              <section className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-red-400/70 px-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />
                  Ao vivo agora · {liveFixtures.length}
                </p>
                {liveFixtures.map(fx => (
                  <MatchCard key={fx.fixture_id} fx={fx} signals={getSignals(fx.fixture_id)} />
                ))}
              </section>
            )}

            {/* Jogos de hoje */}
            {todayFixtures.length > 0 && (
              <section className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-500/60 px-1">
                  Hoje · {todayFixtures.length} jogos
                </p>
                {todayFixtures.map(fx => (
                  <MatchCard key={fx.fixture_id} fx={fx} signals={getSignals(fx.fixture_id)} />
                ))}
              </section>
            )}

            {liveFixtures.length === 0 && todayFixtures.length === 0 && (
              <Card className="bg-black/40 border-yellow-500/20">
                <CardContent className="pt-8 pb-7 text-center space-y-2">
                  <Activity className="w-8 h-8 text-red-400/20 mx-auto" />
                  <p className="text-sm text-white/50">Nenhum jogo Copa ao vivo agora.</p>
                  <p className="text-[11px] text-white/30 font-mono leading-relaxed">
                    Esta página mostra apenas os jogos do dia corrente.<br />
                    Confira os próximos sinais na aba Arena Punter Copa.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
