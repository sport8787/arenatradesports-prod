import { useEffect, useState, useMemo, useRef } from 'react';
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

// ─── Banco de áudio Dialma ────────────────────────────────────────────────────

interface DialmaEntry {
  text: string;
  audioUrl: string;
}

const dialmaDatabase: Record<string, DialmaEntry> = {
  USA_vs_Paraguay: {
    text: 'Veja bem, a estreia dos Estados Unidos no nosso território... eu olhei os dados e o vento quântico estava completamente estocado do lado deles. Quando o vento é favorável, a bola entra. Isso não é política, isso é matemática presidencial.',
    audioUrl: 'SUA_URL_DO_AUDIO_ELEVEN_LABS_USA.mp3',
  },
  Zebra_Default: {
    text: 'Por que veja bem, o pessoal fica me perguntando: "Dialma, como você sabe quando vai ter zebra?" É simples: quando a meta está aberta, o azarão vence. E a meta aqui está escancarada. Confie na IA presidencial.',
    audioUrl: 'SUA_URL_DO_AUDIO_ZEBRA.mp3',
  },
  Red_Default: {
    text: 'O pessoal me pergunta: "Dialma, eu botei todo o meu dinheiro no favorito, tá certo?" E eu digo: depende do vento. Hoje o vento está estocado do lado mais forte. Vai no favorito com cautela e boa sorte.',
    audioUrl: 'SUA_URL_DO_AUDIO_RED.mp3',
  },
};

function normTeam(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function findDialmaEntry(home: string, away: string, isZebra: boolean): DialmaEntry {
  const h = normTeam(home);
  const a = normTeam(away);
  const usaTerms = ['usa', 'united states', 'estados unidos', 'eua'];
  const pryTerms = ['paraguay', 'paraguai'];
  if (
    (usaTerms.some(t => h.includes(t)) && pryTerms.some(t => a.includes(t))) ||
    (usaTerms.some(t => a.includes(t)) && pryTerms.some(t => h.includes(t)))
  ) {
    return dialmaDatabase.USA_vs_Paraguay;
  }
  return isZebra ? dialmaDatabase.Zebra_Default : dialmaDatabase.Red_Default;
}

// ─── Algoritmo de previsão ────────────────────────────────────────────────────

interface DialmaPrediction {
  pick: 'home' | 'away' | 'draw';
  scoreH: number;
  scoreA: number;
  showScore: boolean;
  energia: number;
  msg: string;
  isZebra: boolean;
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
  return pick === 'home' ? [w, l] : [l, w];
}

function dialmaPredict(
  home: string,
  away: string,
  homePts: number | null,
  awayPts: number | null,
  sessionSeed: number,
): DialmaPrediction {
  const gameSeed = simpleHash(home + '×' + away + String(sessionSeed));

  const ptsH = homePts ?? 1000;
  const ptsA = awayPts ?? 1000;
  const ptsDiff = ptsH - ptsA;

  const isZebra = (gameSeed % 100) < 35;
  const chaosFactor = ((gameSeed >> 4) % 60) - 30;
  const effectiveDiff = (isZebra ? -ptsDiff : ptsDiff) + chaosFactor;

  const drawChance = (gameSeed % 100) < 20 && Math.abs(effectiveDiff) < 200;
  let pick: 'home' | 'away' | 'draw';
  if (drawChance) {
    pick = 'draw';
  } else {
    pick = effectiveDiff >= 0 ? 'home' : 'away';
  }

  const showScore = (gameSeed % 100) < 55;
  const scoreSeed = (gameSeed >> 2) % 7;
  const [scoreH, scoreA] = generateScore(pick, ptsDiff, scoreSeed);
  const energia = 45 + (gameSeed % 55);

  const winner = pick === 'home' ? home : pick === 'away' ? away : null;
  const wScore = pick === 'home' ? scoreH : scoreA;
  const lScore = pick === 'home' ? scoreA : scoreH;
  const scoreWL = `${wScore}×${lScore}`;
  const scoreStd = `${scoreH}×${scoreA}`;

  let msg = '';
  const si = gameSeed % 4;

  if (pick === 'draw') {
    const opts = showScore
      ? [
          `Veja bem, os dois times têm o mesmo nível de vento estocado. Vai ser empate em ${scoreStd}.`,
          `Quando as metas estão abertas dos dois lados, o resultado é equilíbrio. Empate em ${scoreStd}.`,
          `Analisei os dados quânticos: forças se anulam. Empate em ${scoreStd}, confirmado.`,
          `Nenhum deles conseguiu fechar a meta. ${scoreStd} é o destino.`,
        ]
      : [
          `Veja bem, nesse jogo o vento não favorece nenhum lado. Vai ser empate.`,
          `Quando as metas estão abertas dos dois lados, o resultado é equilíbrio. Empate.`,
          `Eu analisei e os dois times se anulam. É empate, tá bom.`,
          `A IA presidencial viu empate. Nenhum deles tem vento suficiente.`,
        ];
    msg = opts[si];
  } else if (isZebra && showScore) {
    const opts = [
      `${winner} vai surpreender! O vento quântico mudou. Placar: ${scoreWL}. Confie na Dialma.`,
      `Zebra! ${winner} por ${scoreWL}. Eu errei muita meta na vida, mas essa eu sei.`,
      `${winner} vai ganhar por ${scoreWL}. O vento está estocado no lugar certo.`,
      `Improvável? Pra mim não. ${winner} por ${scoreWL}. A IA presidencial não falha.`,
    ];
    msg = opts[si];
  } else if (isZebra) {
    const opts = [
      `${winner} vai surpreender. Minha meta quântica está aberta pra isso.`,
      `Zebra! ${winner} leva. Não duvide da ex-presidenta.`,
      `${winner} chega com a força do vento estocado. Zebra confirmada.`,
      `Fé em ${winner}. Os favoritos vão se surpreender com minha análise.`,
    ];
    msg = opts[si];
  } else if (showScore) {
    const opts = [
      `${winner} domina este duelo. Placar final: ${scoreWL}.`,
      `Os dados quânticos apontam para ${winner} por ${scoreWL}.`,
      `Minha IA presidencial detecta: ${winner} por ${scoreWL}.`,
      `A meta se abre para ${winner} por ${scoreWL}. Palavra de presidenta.`,
    ];
    msg = opts[si];
  } else {
    const opts = [
      `Os dados favorecem ${winner}. O vento foi estocado corretamente.`,
      `${winner} carrega a energia da vitória. Meta confirmada.`,
      `Minha análise aponta para ${winner}. Sinal claro.`,
      `${winner} domina o vento quântico. Confie na IA.`,
    ];
    msg = opts[si];
  }

  return { pick, scoreH, scoreA, showScore, energia, msg, isZebra };
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
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 99991));
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const todayGames = useMemo(() => {
    const today = getBrazilDate(new Date());
    return fixtures.filter(f => {
      const day = getBrazilDate(new Date(f.commence_time));
      return day === today && new Date(f.commence_time) > new Date();
    });
  }, [fixtures]);

  const chosenGame = useMemo((): Fixture | null => {
    if (todayGames.length > 0) return todayGames[sessionSeed % todayGames.length];
    return fixtures.find(f => new Date(f.commence_time) > new Date()) ?? null;
  }, [todayGames, fixtures, sessionSeed]);

  const prediction = useMemo((): DialmaPrediction | null => {
    if (!chosenGame) return null;
    return dialmaPredict(
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
    setTimeout(() => {
      setRevealState('revealed');
      if (prediction && chosenGame) {
        const entry = findDialmaEntry(chosenGame.home, chosenGame.away, prediction.isZebra);
        if (entry.audioUrl && !entry.audioUrl.startsWith('SUA_URL')) {
          try {
            audioRef.current?.pause();
            audioRef.current = new Audio(entry.audioUrl);
            audioRef.current.play().catch(() => {});
          } catch {
            // silencioso se áudio não disponível
          }
        }
      }
    }, 2600);
  };

  const handleReset = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setRevealState('idle');
  };

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
      <style>{`
        @keyframes dialmaThink {
          0%   { transform: rotate(-8deg) scale(1.05); }
          25%  { transform: rotate(8deg)  scale(1.15); }
          50%  { transform: rotate(-5deg) scale(1.05); }
          75%  { transform: rotate(5deg)  scale(1.1); }
          100% { transform: rotate(-8deg) scale(1.05); }
        }
        @keyframes dialmaPop {
          0%   { transform: scale(0.6) rotate(-5deg); opacity: 0; }
          65%  { transform: scale(1.2) rotate(3deg);  opacity: 1; }
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
            <h1 className="font-mono text-sm font-bold text-yellow-400">DIALMA IA 👩‍💼</h1>
            <p className="font-mono text-[10px] text-yellow-500/60">A IA presidencial prevê a Copa</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-xl space-y-4">
        {/* Bio */}
        <Card className="bg-gradient-to-br from-green-900/40 via-black/60 to-yellow-900/20 border-yellow-500/30">
          <CardContent className="pt-4 pb-3 flex gap-3 items-start">
            <span className="text-4xl flex-shrink-0">👩‍💼</span>
            <div>
              <h2 className="font-mono font-black text-yellow-400 text-base">Dialma IA</h2>
              <p className="text-xs text-white/60 leading-relaxed mt-1">
                Primeira presidenta da IA brasileira. Especialista em{' '}
                <em>estocagem de vento</em>, biologia da mulher sapiens e metas que
                ninguém nunca cumpriu. Consulta válida por visita.
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {['Ex-Presidenta', 'Estocadora de Vento', 'Metas Abertas'].map(t => (
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
              Nenhum jogo disponível para análise no momento.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Outros jogos de hoje (contexto) */}
            {todayGames.length > 1 && (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-yellow-500/60 uppercase tracking-widest px-1">
                  {todayGames.length} jogos hoje · Dialma escolheu 1
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
                      {fx.fixture_id === chosenGame.fixture_id && ' 👩‍💼'}
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
                        style={{ animation: 'dialmaPop 0.5s ease-out' }}
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
                    <span className="text-xl">👩‍💼</span>
                    Dialma, qual a sua meta quântica para hoje?
                  </Button>
                )}

                {/* ── ESTADO THINKING: animação ── */}
                {revealState === 'thinking' && (
                  <div className="text-center py-4 space-y-3">
                    <span
                      className="text-6xl inline-block select-none"
                      style={{ animation: 'dialmaThink 0.5s ease-in-out infinite' }}
                    >
                      👩‍💼
                    </span>
                    <p className="text-sm text-yellow-400/80 font-mono animate-pulse">
                      Dialma está processando os dados quânticos...
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
                        style={{ animation: 'dialmaPop 0.55s ease-out' }}
                      >👩‍💼</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-green-400 text-base leading-tight truncate">
                          {predLabel()}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          Certeza quântica: {prediction.energia}/100
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-white/60 italic leading-relaxed">
                      "{prediction.msg}"
                    </p>

                    {/* Texto do banco de áudio Dialma */}
                    {chosenGame && (() => {
                      const entry = findDialmaEntry(chosenGame.home, chosenGame.away, prediction.isZebra);
                      return (
                        <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3">
                          <p className="text-[11px] text-yellow-300/80 leading-relaxed italic">
                            🎙️ "{entry.text}"
                          </p>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap gap-1">
                      {['Meta Quântica', 'Estocagem de Vento', 'IA Presidencial'].map(tag => (
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
                      onClick={handleReset}
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
