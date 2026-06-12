import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ─── Utilitários ──────────────────────────────────────────────────────────────

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getBrazilDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// ─── Algoritmo do Calango ─────────────────────────────────────────────────────

interface CalangoPrediction {
  pick: 'home' | 'away' | 'draw';
  scoreH: number;  // sempre no formato casa × fora
  scoreA: number;
  showScore: boolean;
  energia: number;
  msg: string;
}

function generateScore(
  pick: 'home' | 'away' | 'draw',
  ptsDiff: number,
  seed: number,
): [number, number] {
  if (pick === 'draw') {
    const opts: [number, number][] = [[0, 0], [1, 1], [1, 1], [2, 2], [1, 1], [0, 0], [1, 1]];
    return opts[seed % opts.length];
  }
  const abs = Math.abs(ptsDiff ?? 0);
  const close: [number, number][] = [[1, 0], [2, 1], [1, 0], [2, 1], [1, 0], [3, 2]];
  const medium: [number, number][] = [[2, 0], [2, 1], [1, 0], [2, 0], [3, 1], [2, 1]];
  const big: [number, number][] = [[2, 0], [3, 0], [3, 1], [2, 0], [4, 0], [3, 0]];
  const opts = abs > 400 ? big : abs > 200 ? medium : close;
  const [w, l] = opts[seed % opts.length];
  return pick === 'home' ? [w, l] : [l, w]; // away win: casa < fora
}

function calangoPredict(
  home: string,
  away: string,
  homePts: number | null,
  awayPts: number | null,
  sessionSeed: number,
): CalangoPrediction {
  const gameSeed = simpleHash(home + '×' + away + String(sessionSeed));

  const ptsH = homePts ?? 1000;
  const ptsA = awayPts ?? 1000;
  const ptsDiff = ptsH - ptsA; // positivo = casa mais forte

  // 35% de chance de zebra (calango vai no azarão)
  const isZebra = (gameSeed % 100) < 35;
  const chaosFactor = ((gameSeed >> 4) % 60) - 30; // -30 a +30
  const effectiveDiff = (isZebra ? -ptsDiff : ptsDiff) + chaosFactor;

  // Empate: 20% de chance quando a diferença efetiva é pequena
  const drawChance = (gameSeed % 100) < 20 && Math.abs(effectiveDiff) < 200;
  let pick: 'home' | 'away' | 'draw';
  if (drawChance) {
    pick = 'draw';
  } else {
    pick = effectiveDiff >= 0 ? 'home' : 'away';
  }

  // 55% das previsões incluem placar exato
  const showScore = (gameSeed % 100) < 55;
  const scoreSeed = (gameSeed >> 2) % 7;
  const [scoreH, scoreA] = generateScore(pick, ptsDiff, scoreSeed);
  const energia = 45 + (gameSeed % 55);

  const winner = pick === 'home' ? home : pick === 'away' ? away : null;
  // Placar no formato vencedor × perdedor (para as mensagens)
  const wScore = pick === 'home' ? scoreH : scoreA;
  const lScore = pick === 'home' ? scoreA : scoreH;
  const scoreWL = `${wScore}×${lScore}`;
  // Placar padrão casa × fora (para display visual)
  const scoreStd = `${scoreH}×${scoreA}`;

  let msg = '';
  const si = gameSeed % 4;

  if (pick === 'draw') {
    const opts = showScore
      ? [
          `Nem um nem outro. As pedras mostram empate em ${scoreStd}.`,
          `O calango ficou exatamente no meio. ${scoreStd}.`,
          `Equilíbrio total. Empate em ${scoreStd}, as pedras cantaram.`,
          `Forças iguais se anulam. ${scoreStd} é o destino.`,
        ]
      : [
          `As forças estão equilibradas. Empate é o destino.`,
          `Nenhum lado domina. O calango viu empate.`,
          `O calango ficou parado no meio. Isso significa empate.`,
          `Pedra imóvel, resultado imóvel. Empate.`,
        ];
    msg = opts[si];
  } else if (isZebra && showScore) {
    const opts = [
      `${winner} vai surpreender! O oráculo viu ${scoreWL}. Confie no calango.`,
      `Zebra! ${winner} vence por ${scoreWL}. O calango não mente.`,
      `Improvável mas inevitável. ${winner} por ${scoreWL}. As pedras não erram.`,
      `${winner} chega com fome. Resultado: ${scoreWL}. Fé no ancestral.`,
    ];
    msg = opts[si];
  } else if (isZebra) {
    const opts = [
      `${winner} vai surpreender. O ancestral revelou.`,
      `Zebra! ${winner} leva. Não duvide do calango.`,
      `${winner} chega com a força do cerrado. Zebra confirmada.`,
      `Fé em ${winner}. Os favoritos vão se surpreender hoje.`,
    ];
    msg = opts[si];
  } else if (showScore) {
    const opts = [
      `${winner} domina este duelo. Placar final: ${scoreWL}.`,
      `As vibrações apontam para ${winner} por ${scoreWL}.`,
      `Minha língua bifurcada detecta: ${winner} por ${scoreWL}.`,
      `O oráculo viu ${winner} vencendo por ${scoreWL}. Pedra falou.`,
    ];
    msg = opts[si];
  } else {
    const opts = [
      `As vibrações favorecem ${winner}. A pedra revelou.`,
      `${winner} carrega a energia da vitória neste duelo.`,
      `Minha cauda aponta para ${winner}. Sinal claro.`,
      `${winner} domina as vibrações ancestrais. Confie.`,
    ];
    msg = opts[si];
  }

  return { pick, scoreH, scoreA, showScore, energia, msg };
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

type RevealState = 'idle' | 'thinking' | 'revealed';

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CalangoVidente() {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealState, setRevealState] = useState<RevealState>('idle');
  // Semente muda por visita: previsão diferente a cada vez que o usuário abre a página
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 99991));

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

  // Jogos de hoje ainda não iniciados (horário de Brasília)
  const todayGames = useMemo(() => {
    const today = getBrazilDate(new Date());
    return fixtures.filter(f => {
      const day = getBrazilDate(new Date(f.commence_time));
      return day === today && new Date(f.commence_time) > new Date();
    });
  }, [fixtures]);

  // Jogo escolhido pelo Calango: 1 jogo de hoje, ou o próximo disponível como fallback
  const chosenGame = useMemo((): Fixture | null => {
    if (todayGames.length > 0) return todayGames[sessionSeed % todayGames.length];
    return fixtures.find(f => new Date(f.commence_time) > new Date()) ?? null;
  }, [todayGames, fixtures, sessionSeed]);

  const prediction = useMemo((): CalangoPrediction | null => {
    if (!chosenGame) return null;
    return calangoPredict(
      chosenGame.home, chosenGame.away,
      chosenGame.home_fifa_pts, chosenGame.away_fifa_pts,
      sessionSeed,
    );
  }, [chosenGame, sessionSeed]);

  const isToday = chosenGame
    ? getBrazilDate(new Date(chosenGame.commence_time)) === getBrazilDate(new Date())
    : false;

  const handleReveal = () => {
    if (revealState !== 'idle') return;
    setRevealState('thinking');
    setTimeout(() => setRevealState('revealed'), 2600);
  };

  // Label da previsão no header do card
  const predLabel = () => {
    if (!prediction) return '';
    const { pick, scoreH, scoreA, showScore } = prediction;
    const wScore = pick === 'home' ? scoreH : scoreA;
    const lScore = pick === 'home' ? scoreA : scoreH;
    if (pick === 'draw') return showScore ? `EMPATE ${scoreH}×${scoreA}` : 'EMPATE';
    const name = pick === 'home' ? chosenGame!.home : chosenGame!.away;
    return showScore ? `${name} ${wScore}×${lScore}` : `${name} vence`;
  };

  return (
    <div className="min-h-screen bg-[#071207] text-white">
      {/* Keyframes para animação do calango */}
      <style>{`
        @keyframes calangoWiggle {
          0%   { transform: rotate(-14deg) scale(1.1); }
          25%  { transform: rotate(14deg)  scale(1.25); }
          50%  { transform: rotate(-10deg) scale(1.1); }
          75%  { transform: rotate(10deg)  scale(1.2); }
          100% { transform: rotate(-14deg) scale(1.1); }
        }
        @keyframes calangoPop {
          0%   { transform: scale(0.6) rotate(-8deg); opacity: 0; }
          65%  { transform: scale(1.2) rotate(4deg);  opacity: 1; }
          100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
        }
        @keyframes predSlide {
          0%   { transform: translateY(14px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-yellow-500/20 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/punter/copa')} className="text-white/50 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-mono text-sm font-bold text-yellow-400">CALANGO VIDENTE 🦎</h1>
            <p className="font-mono text-[10px] text-yellow-500/60">O oráculo da Caatinga prevê a Copa</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-xl space-y-4">
        {/* Bio */}
        <Card className="bg-gradient-to-br from-green-900/40 via-black/60 to-yellow-900/20 border-yellow-500/30">
          <CardContent className="pt-4 pb-3 flex gap-3 items-start">
            <span className="text-4xl flex-shrink-0">🦎</span>
            <div>
              <h2 className="font-mono font-black text-yellow-400 text-base">Calango da Caatinga</h2>
              <p className="text-xs text-white/60 leading-relaxed mt-1">
                Nasceu em Petrolina-PE, filho de mãe teiú e pai calango-verde.
                Usa o método <em>vibratório-ancestral</em> para prever resultados.
                Não tem medo de zebra. Consulta válida por visita.
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
        ) : !chosenGame ? (
          <Card className="bg-black/40 border-yellow-500/20">
            <CardContent className="pt-6 pb-5 text-center text-sm text-white/40">
              Nenhum jogo disponível para previsão no momento.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Outros jogos de hoje (contexto) */}
            {todayGames.length > 1 && (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-yellow-500/60 uppercase tracking-widest px-1">
                  {todayGames.length} jogos hoje · calango escolheu 1
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {todayGames.map(fx => (
                    <div
                      key={fx.fixture_id}
                      className={`text-[10px] px-2 py-1 rounded-lg border font-mono transition-colors ${
                        fx.fixture_id === chosenGame.fixture_id
                          ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                          : 'border-white/10 text-white/25'
                      }`}
                    >
                      {fx.home} × {fx.away}
                      {fx.fixture_id === chosenGame.fixture_id && ' 🦎'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card do jogo escolhido */}
            <Card className="border-yellow-500/30 bg-black/60 overflow-hidden">
              <div className="h-0.5 w-full bg-gradient-to-r from-green-600 via-yellow-500 to-green-600" />
              <CardContent className="pt-4 pb-5 space-y-4">

                {/* Fase + horário */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-300/80">
                    {PHASE_LABEL[chosenGame.phase] || chosenGame.phase}
                  </Badge>
                  <span className="text-[10px] text-white/40 font-mono">
                    {new Date(chosenGame.commence_time).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </span>
                  {isToday
                    ? <Badge className="text-[9px] bg-green-600/30 text-green-400 border border-green-500/30">Hoje</Badge>
                    : <Badge className="text-[9px] bg-white/5 text-white/40 border border-white/10">Próximo</Badge>
                  }
                </div>

                {/* Times + placar central */}
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex-1 text-center p-2.5 rounded-lg transition-all duration-500 ${
                    revealState === 'revealed' && (prediction?.pick === 'home' || prediction?.pick === 'draw')
                      ? 'bg-green-500/20 ring-1 ring-green-500/40'
                      : 'bg-white/5'
                  }`}>
                    <div className="text-sm font-bold text-white leading-tight">{chosenGame.home}</div>
                    {chosenGame.home_fifa_rank != null && (
                      <div className="text-[10px] text-white/35 mt-0.5">FIFA #{chosenGame.home_fifa_rank}</div>
                    )}
                  </div>

                  <div className="text-center min-w-[36px]">
                    {revealState === 'revealed' && prediction?.showScore ? (
                      <div
                        className="font-mono font-black text-yellow-400 text-xl leading-none"
                        style={{ animation: 'calangoPop 0.5s ease-out' }}
                      >
                        {prediction.scoreH}×{prediction.scoreA}
                      </div>
                    ) : (
                      <div className="text-white/25 text-lg font-mono">×</div>
                    )}
                  </div>

                  <div className={`flex-1 text-center p-2.5 rounded-lg transition-all duration-500 ${
                    revealState === 'revealed' && (prediction?.pick === 'away' || prediction?.pick === 'draw')
                      ? 'bg-green-500/20 ring-1 ring-green-500/40'
                      : 'bg-white/5'
                  }`}>
                    <div className="text-sm font-bold text-white leading-tight">{chosenGame.away}</div>
                    {chosenGame.away_fifa_rank != null && (
                      <div className="text-[10px] text-white/35 mt-0.5">FIFA #{chosenGame.away_fifa_rank}</div>
                    )}
                  </div>
                </div>

                {/* ── ESTADO IDLE: botão de consulta ── */}
                {revealState === 'idle' && (
                  <Button
                    onClick={handleReveal}
                    className="w-full bg-gradient-to-r from-green-800 to-yellow-700 hover:from-green-700 hover:to-yellow-600 text-white font-bold text-sm h-12 rounded-xl gap-2 border border-green-500/30"
                  >
                    <span className="text-xl">🦎</span>
                    Calango, qual sua previsão para hoje?
                  </Button>
                )}

                {/* ── ESTADO THINKING: animação ── */}
                {revealState === 'thinking' && (
                  <div className="text-center py-4 space-y-3">
                    <span
                      className="text-6xl inline-block select-none"
                      style={{ animation: 'calangoWiggle 0.38s ease-in-out infinite' }}
                    >
                      🦎
                    </span>
                    <p className="text-sm text-yellow-400/80 font-mono animate-pulse">
                      O calango está meditando...
                    </p>
                    <div className="flex justify-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 animate-bounce"
                          style={{ animationDelay: `${i * 0.18}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── ESTADO REVEALED: previsão ── */}
                {revealState === 'revealed' && prediction && (
                  <div
                    className="bg-green-900/30 border border-green-500/25 rounded-xl p-4 space-y-3"
                    style={{ animation: 'predSlide 0.4s ease-out' }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-3xl flex-shrink-0"
                        style={{ animation: 'calangoPop 0.55s ease-out' }}
                      >🦎</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-green-400 text-base leading-tight truncate">
                          {predLabel()}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          Energia ancestral: {prediction.energia}/100
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-white/60 italic leading-relaxed">
                      "{prediction.msg}"
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {['Visão Ancestral', 'Energia Espiritual', 'Ciência Calaiana'].map(tag => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-[9px] border-green-500/20 text-green-400/60"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <button
                      onClick={() => setRevealState('idle')}
                      className="w-full text-[11px] text-white/25 hover:text-white/50 text-center py-1 transition-colors"
                    >
                      ↺ consultar novamente
                    </button>
                  </div>
                )}

              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
