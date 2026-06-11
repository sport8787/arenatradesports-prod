import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Algoritmo do Calango ─────────────────────────────────────────────────────
// Determinístico: mesmo jogo → mesmo resultado sempre.
// Baseado em: diferença de ranking FIFA + "energia espiritual" (hash das seleções).

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function calangoPredict(home: string, away: string, homeFifa: number | null, awayFifa: number | null): {
  pick: 'home' | 'away' | 'draw';
  energia: number;
  msg: string;
} {
  const seed = simpleHash(home + '×' + away);
  const energiaHome = simpleHash(home) % 100;
  const energiaAway = simpleHash(away) % 100;

  // Score base: ranking FIFA (menor rank = melhor)
  const fifaDiff = (homeFifa ?? 50) - (awayFifa ?? 50);
  const fifaBonus = fifaDiff < 0 ? 15 : fifaDiff > 0 ? -15 : 0; // home melhor = +15

  // Score com energia espiritual
  const scoreHome = 50 + fifaBonus + (energiaHome - 50) * 0.3;
  const scoreAway = 50 - fifaBonus + (energiaAway - 50) * 0.3;
  const drawScore = 50 + (seed % 20) - 10;

  const msgs_home = [
    `As vibrações ancestrais favorecem ${home}. A pedra revelou.`,
    `O calango correu em direção a ${home}. Sinal claro.`,
    `${home} carrega a energia da vitória neste duelo.`,
    `Minha língua bifurcada detecta dominância de ${home}.`,
  ];
  const msgs_away = [
    `${away} vai surpreender. O calango não mente.`,
    `As energias estão com ${away} hoje.`,
    `Minha cauda aponta para ${away}. Confie no ancestral.`,
    `${away} chega com a força do cerrado.`,
  ];
  const msgs_draw = [
    `As forças estão equilibradas. Empate é o que as pedras dizem.`,
    `Nenhum lado domina as vibrações. Vai para o empate, mano.`,
    `O calango ficou parado no meio. Empate.`,
  ];

  const msgIdx = seed % 4;
  const max = Math.max(scoreHome, scoreAway, drawScore);
  if (max === scoreHome) return { pick: 'home', energia: Math.round(scoreHome), msg: msgs_home[msgIdx % msgs_home.length] };
  if (max === scoreAway) return { pick: 'away', energia: Math.round(scoreAway), msg: msgs_away[msgIdx % msgs_away.length] };
  return { pick: 'draw', energia: Math.round(drawScore), msg: msgs_draw[msgIdx % msgs_draw.length] };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Fixture {
  fixture_id: string;
  home: string;
  away: string;
  phase: string;
  commence_time: string;
  home_fifa_rank: number | null;
  away_fifa_rank: number | null;
  home_fifa_pts: number | null;
  away_fifa_pts: number | null;
}

const PHASE_LABEL: Record<string, string> = {
  grupos_j1: 'Grupos J1', grupos_j2: 'Grupos J2', grupos_j3: 'Grupos J3',
  oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semifinal', '3lugar': '3º Lugar', final: 'Final',
};

// ─── Card de previsão ─────────────────────────────────────────────────────────

function PredictionCard({ fx }: { fx: Fixture }) {
  const { pick, energia, msg } = useMemo(
    () => calangoPredict(fx.home, fx.away, fx.home_fifa_pts, fx.away_fifa_pts),
    [fx.fixture_id],
  );
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="border-yellow-500/20 bg-black/40 overflow-hidden cursor-pointer" onClick={() => setRevealed(v => !v)}>
      <div className="h-0.5 w-full bg-gradient-to-r from-green-600 via-yellow-500 to-green-600" />
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-300/80">
            {PHASE_LABEL[fx.phase] || fx.phase}
          </Badge>
          <span className="text-[10px] text-white/40 font-mono">
            {new Date(fx.commence_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
          </span>
        </div>

        {/* Times */}
        <div className="flex items-center justify-between gap-2">
          <div className={`flex-1 text-center p-2 rounded-lg transition-all ${pick === 'home' && revealed ? 'bg-green-500/20 ring-1 ring-green-500/50' : 'bg-white/5'}`}>
            <div className="text-sm font-bold text-white">{fx.home}</div>
            {fx.home_fifa_rank && <div className="text-[10px] text-white/40">FIFA #{fx.home_fifa_rank}</div>}
          </div>
          <div className="text-white/30 text-lg font-mono">×</div>
          <div className={`flex-1 text-center p-2 rounded-lg transition-all ${pick === 'away' && revealed ? 'bg-green-500/20 ring-1 ring-green-500/50' : 'bg-white/5'}`}>
            <div className="text-sm font-bold text-white">{fx.away}</div>
            {fx.away_fifa_rank && <div className="text-[10px] text-white/40">FIFA #{fx.away_fifa_rank}</div>}
          </div>
        </div>

        {/* Previsão — revelada ao clicar */}
        {revealed ? (
          <div className="bg-green-900/30 border border-green-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🦎</span>
              <div>
                <div className="font-bold text-green-400 text-sm">
                  {pick === 'home' ? fx.home : pick === 'away' ? fx.away : 'EMPATE'}
                </div>
                <div className="text-[10px] text-white/50">Energia: {energia}/100</div>
              </div>
            </div>
            <p className="text-xs text-white/60 italic leading-relaxed">"{msg}"</p>
            <div className="flex gap-1">
              {['Visão Ancestral', 'Energia Espiritual', 'Ciência Calaiana'].map(tag => (
                <Badge key={tag} variant="outline" className="text-[9px] border-green-500/20 text-green-400/60">{tag}</Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <span className="text-2xl">🦎</span>
            <p className="text-[11px] text-white/40 mt-1">Clique para revelar a visão do Calango</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function CalangoVidente() {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('copa_fixtures')
        .select('fixture_id, home, away, phase, commence_time, home_fifa_rank, away_fifa_rank, home_fifa_pts, away_fifa_pts')
        .order('commence_time', { ascending: true })
        .limit(200);
      setFixtures((data || []) as Fixture[]);
      setLoading(false);
    })();
  }, []);

  const upcoming = fixtures.filter(f => new Date(f.commence_time) > new Date());
  const past = fixtures.filter(f => new Date(f.commence_time) <= new Date());
  const display = showAll ? fixtures : upcoming.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#071207] text-white">
      <header className="sticky top-0 z-40 border-b border-yellow-500/20 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/punter/copa')} className="text-white/50 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-mono text-sm font-bold text-yellow-400">CALANGO VIDENTE 🦎</h1>
            <p className="font-mono text-[10px] text-yellow-500/60">O oráculo de Caatinga previu a Copa</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-xl space-y-4">
        {/* Bio do Calango */}
        <Card className="bg-gradient-to-br from-green-900/40 via-black/60 to-yellow-900/20 border-yellow-500/30">
          <CardContent className="pt-4 pb-3 flex gap-3 items-start">
            <span className="text-4xl flex-shrink-0">🦎</span>
            <div>
              <h2 className="font-mono font-black text-yellow-400 text-base">Calango da Caatinga</h2>
              <p className="text-xs text-white/60 leading-relaxed mt-1">
                Nasceu em Petrolina-PE, filho de mãe teiú e pai calango-verde.
                Usa o método <em>vibratório-ancestral</em> para prever placares.
                Taxa histórica de acerto: altamente classificada.
              </p>
              <div className="flex gap-2 mt-2">
                {['Vidente', 'Petrolina-PE', '47 anos'].map(t => (
                  <Badge key={t} variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400/60">{t}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10 text-yellow-400/50">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            <p className="font-mono text-[10px] text-yellow-500/60 uppercase tracking-widest px-1">
              {upcoming.length} jogos pendentes · clique no card para revelar
            </p>

            <div className="space-y-3">
              {display.map(fx => <PredictionCard key={fx.fixture_id} fx={fx} />)}
            </div>

            {upcoming.length > 8 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full text-center text-[11px] text-yellow-400/60 hover:text-yellow-400 py-2 border border-yellow-500/20 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                {showAll ? 'Mostrar menos' : `Ver todos (${upcoming.length} jogos)`}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
