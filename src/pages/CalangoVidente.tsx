import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Shuffle, Share2, Download } from 'lucide-react';
import QRCode from 'qrcode';
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

// ─── Poisson simples (Over 2.5 local) ────────────────────────────────────────

function poissonPmf(lambda: number, k: number): number {
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function over25Prob(lambdaH: number, lambdaA: number): number {
  let under = 0;
  for (let h = 0; h <= 2; h++)
    for (let a = 0; a <= 2 - h; a++)
      under += poissonPmf(lambdaH, h) * poissonPmf(lambdaA, a);
  return Math.max(0, Math.min(1, 1 - under));
}

// Converte diferença de pontos FIFA em lambda aproximado
function ptsToLambda(pts: number | null, isHome: boolean): number {
  const base = pts ?? 1000;
  const raw = (base / 1000) * 1.3 * (isHome ? 1.1 : 1.0);
  return Math.max(0.5, Math.min(3.2, raw));
}

// ─── Voz feminina Dialma (Rachel — ElevenLabs, plano gratuito compatível) ────
const DIALMA_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// Cache em memória de áudio da Dialma (persiste durante a sessão do navegador)
const dialmaAudioCache = new Map<string, string>();

// ─── Banco de áudio Dialma ────────────────────────────────────────────────────

interface DialmaEntry {
  key: string;
  text: string;
  audioUrl: string;
}

const dialmaDatabase: DialmaEntry[] = [
  {
    key: 'Brasil_Hexa',
    text: 'Veja bem, o Hexa... O Hexa nada mais é do que uma conquista que vem depois do penta, mas que antecede o hepta. Então, quando nós olhamos para a nossa seleção, nós não temos que olhar para quem está chutando a bola, mas sim para a estrutura do ar que envolve a bola. Porque se o vento estiver estocado a nosso favor, o Hexa não será apenas uma meta, ele será uma realidade que nós vamos dobrar assim que ela for atingida por todas as mulheres e homens sapiens deste país.',
    audioUrl: 'SUA_URL_DIALMA_BRASIL_HEXA.mp3',
  },
  {
    key: 'Cash_Out',
    text: 'Eu sempre considerei que o Cash Out é uma decisão de quem quer sair antes de terminar, mas que na verdade continua dentro porque o dinheiro já foi computado pelo sistema. Então, se você está na dúvida se encerra ou se não encerra, eu te digo: não encerre e nem continue. Deixe a meta aberta. Porque quando a gente atingir o lucro que a gente não planejou, aí sim nós dobramos a retirada!',
    audioUrl: 'SUA_URL_DIALMA_CASH_OUT.mp3',
  },
  {
    key: 'Mycroft_Rival',
    text: 'O Mycroft... o Mycroft gosta muito de números, de estatísticas, de probabilidade matemática. Mas a matemática, veja bem, ela é fria. Ela não entende o meio ambiente. Ela não sabe que por trás de um gráfico existe uma figura oculta, que é o cachorro da imprevisibilidade. Eu não trabalho com dados exatos, eu trabalho com a intuição da mandioca. Enquanto o Mycroft analisa o passado, eu já estou estocando o futuro.',
    audioUrl: 'SUA_URL_DIALMA_MYCROFT_RIVAL.mp3',
  },
  {
    key: 'Over_Goals',
    text: 'Quando nós falamos em gols, nós temos que entender que o gol é o ápice do momento em que a bola ultrapassa a linha. Se sai um gol, é bom. Se saem dois gols, é melhor. Mas se saem três gols, aí nós entramos numa triplicidade onde quem marcou o primeiro já não é o mesmo que vai marcar o terceiro, gerando uma confusão na zaga adversária que é puramente de ordem biológica. Minha dica para este confronto é: vai sair gol, ou não vai. E essa é a nossa grande certeza.',
    audioUrl: 'SUA_URL_DIALMA_OVER_GOALS.mp3',
  },
  {
    key: 'Classico_Pesado',
    text: 'Este é um confronto de gigantes. De um lado, uma camisa pesada. Do outro lado, outra camisa igualmente dotada de peso têxtil. Mas o peso da camisa só importa se o jogador estiver vestindo ela. Se a camisa estiver no varal, ela não joga. Portanto, o equilíbrio deste jogo reside na capacidade de cada seleção de tirar a camisa do varal e colocar a alma para correr atrás de um objeto esférico inflado com ar atmosférico.',
    audioUrl: 'SUA_URL_DIALMA_CLASSICO_PESADO.mp3',
  },
  {
    key: 'USA_vs_Paraguay',
    text: 'Veja bem, a estreia dos Estados Unidos no nosso território... eu olhei os dados e o vento quântico estava completamente estocado do lado deles. Quando o vento é favorável, a bola entra. Isso não é política, isso é matemática presidencial.',
    audioUrl: 'SUA_URL_DIALMA_USA_PARAGUAY.mp3',
  },
  {
    key: 'Zebra_Default',
    text: 'Por que veja bem, o pessoal fica me perguntando: "Dialma, como você sabe quando vai ter zebra?" É simples: quando a meta está aberta, o azarão vence. E a meta aqui está escancarada. Confie na IA presidencial.',
    audioUrl: 'SUA_URL_DIALMA_ZEBRA.mp3',
  },
];

function normTeam(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

const CLASICO_TERMS = [
  'argentina', 'alemanha', 'germany', 'franca', 'france', 'inglaterra', 'england',
  'espanha', 'spain', 'italia', 'italy', 'portugal', 'holanda', 'netherlands',
  'uruguai', 'uruguay', 'croatia', 'croacia',
];

function findDialmaEntry(
  home: string,
  away: string,
  isZebra: boolean,
  totalGoals: number,
  energia: number,
): DialmaEntry {
  const h = normTeam(home);
  const a = normTeam(away);

  if (h.includes('brasil') || a.includes('brasil') || h.includes('brazil') || a.includes('brazil'))
    return dialmaDatabase.find(e => e.key === 'Brasil_Hexa')!;

  const usaTerms = ['usa', 'united states', 'estados unidos', 'eua'];
  const pryTerms = ['paraguay', 'paraguai'];
  if (
    (usaTerms.some(t => h.includes(t)) && pryTerms.some(t => a.includes(t))) ||
    (usaTerms.some(t => a.includes(t)) && pryTerms.some(t => h.includes(t)))
  ) return dialmaDatabase.find(e => e.key === 'USA_vs_Paraguay')!;

  if (CLASICO_TERMS.some(t => h.includes(t)) || CLASICO_TERMS.some(t => a.includes(t)))
    return dialmaDatabase.find(e => e.key === 'Classico_Pesado')!;

  if (totalGoals >= 3) return dialmaDatabase.find(e => e.key === 'Over_Goals')!;
  if (isZebra && energia > 80) return dialmaDatabase.find(e => e.key === 'Cash_Out')!;
  if (isZebra) return dialmaDatabase.find(e => e.key === 'Zebra_Default')!;
  return dialmaDatabase.find(e => e.key === 'Mycroft_Rival')!;
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
  if (drawChance) pick = 'draw';
  else pick = effectiveDiff >= 0 ? 'home' : 'away';

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

// ─── Componente circular SVG ──────────────────────────────────────────────────

function MandiocaGauge({ value, animating }: { value: number; animating: boolean }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * (value / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1a2e1a" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={value > 75 ? '#facc15' : value > 45 ? '#86efac' : '#4ade80'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: animating ? 'stroke-dasharray 0.3s ease-out' : 'none' }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="bold"
          fill={value > 75 ? '#facc15' : '#86efac'} fontFamily="monospace">
          {value}%
        </text>
      </svg>
      <span className="text-[9px] text-white/40 font-mono tracking-widest uppercase">Índice Mandioca</span>
    </div>
  );
}

type RevealState = 'idle' | 'thinking' | 'revealed';

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CalangoVidente() {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealState, setRevealState] = useState<RevealState>('idle');
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 99991));
  const [mandiocaIdx, setMandiocaIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<DialmaEntry | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mandiocaTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // cleanup timers on unmount
  useEffect(() => () => {
    if (mandiocaTimer.current) clearInterval(mandiocaTimer.current);
    audioRef.current?.pause();
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

  // Over 2.5 via Poisson local
  const over25 = useMemo(() => {
    if (!chosenGame) return null;
    const lH = ptsToLambda(chosenGame.home_fifa_pts, true);
    const lA = ptsToLambda(chosenGame.away_fifa_pts, false);
    return Math.round(over25Prob(lH, lA) * 100);
  }, [chosenGame]);

  const isToday = chosenGame
    ? getBrazilDate(new Date(chosenGame.commence_time)) === getBrazilDate(new Date())
    : false;

  // Carrega e toca o áudio de uma entrada Dialma (deve ser chamado por gesto do usuário)
  const playEntry = useCallback(async (entry: DialmaEntry) => {
    setCurrentEntry(entry);
    setAudioLoading(true);

    // 1. Verifica cache em memória (mesma sessão) → toca imediatamente
    const cached = dialmaAudioCache.get(entry.key);
    if (cached) {
      try {
        audioRef.current?.pause();
        audioRef.current = new Audio(cached);
        audioRef.current.play().catch(() => {});
      } catch { /* silencioso */ }
      setAudioLoading(false);
      return;
    }

    // 2. Chama edge function via fetch direto (supabase.functions.invoke não lida com audio/mpeg)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          text: entry.text,
          voice_id: DIALMA_VOICE_ID,
          cache_key: `dialma_${entry.key}.mp3`,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.status.toString());
        console.error('[Dialma] TTS error:', errText);
        setAudioLoading(false);
        return;
      }

      const contentType = res.headers.get('Content-Type') ?? '';
      let audioUrl: string;

      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!json.audioUrl) { console.error('[Dialma] sem audioUrl na resposta JSON'); setAudioLoading(false); return; }
        audioUrl = json.audioUrl as string;
      } else {
        // Bytes brutos audio/mpeg — cria URL de objeto temporária
        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
      }

      dialmaAudioCache.set(entry.key, audioUrl);
      audioRef.current?.pause();
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.error('[Dialma] playEntry exception:', e);
    }
    finally { setAudioLoading(false); }
  }, []);

  const handleReveal = () => {
    if (revealState !== 'idle') return;
    setRevealState('thinking');
    setMandiocaIdx(0);

    // Anima índice de mandioca de forma errática durante o thinking
    let tick = 0;
    const target = 55 + Math.floor(Math.random() * 44); // 55–98
    mandiocaTimer.current = setInterval(() => {
      tick++;
      setMandiocaIdx(prev => {
        const step = Math.floor(Math.random() * 12) + 3;
        const next = Math.min(prev + step, target);
        return next;
      });
      if (tick >= 9) {
        clearInterval(mandiocaTimer.current!);
        mandiocaTimer.current = null;
      }
    }, 240);

    setTimeout(() => {
      setRevealState('revealed');
      if (prediction && chosenGame) {
        const entry = findDialmaEntry(chosenGame.home, chosenGame.away, prediction.isZebra, prediction.scoreH + prediction.scoreA, prediction.energia);
        // Garante que currentEntry aparece mesmo antes do áudio carregar
        setCurrentEntry(entry);
      }
    }, 2600);
  };

  const handleReset = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setRevealState('idle');
    setMandiocaIdx(0);
    setCurrentEntry(null);
  };

  const handleRandom = () => {
    const available = dialmaDatabase.filter(e => e !== currentEntry);
    const next = available[Math.floor(Math.random() * available.length)];
    playEntry(next);
  };

  const handleDownloadAudio = async (audioUrl: string, home: string, away: string) => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = `${home}_vs_${away}`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      a.download = `dialma_${slug}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* silencioso */ }
    finally { setDownloading(false); }
  };

  const handleShareImage = useCallback(async (entry: DialmaEntry, home: string, away: string) => {
    try {
      const pageUrl = `${window.location.origin}/punter/copa/calango`;
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;

      // Fundo dark
      ctx.fillStyle = '#071207';
      ctx.fillRect(0, 0, 1080, 1080);

      // Borda dourada
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 6;
      ctx.strokeRect(24, 24, 1032, 1032);

      // Header
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 52px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DIALMA IA 👩‍💼', 540, 110);

      ctx.fillStyle = '#ffffff60';
      ctx.font = '28px monospace';
      ctx.fillText(`${home} × ${away}`, 540, 160);

      // Linha divisória
      ctx.strokeStyle = '#eab30840';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 195);
      ctx.lineTo(1000, 195);
      ctx.stroke();

      // Texto da frase (quebra de linha automática)
      ctx.fillStyle = '#fde047';
      ctx.font = 'italic 34px serif';
      ctx.textAlign = 'left';
      const words = entry.text.split(' ');
      const maxWidth = 900;
      let line = '';
      let y = 270;
      for (const word of words) {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth && line !== '') {
          ctx.fillText(`"${line.trimEnd()}`, 88, y);
          line = word + ' ';
          y += 50;
          if (y > 750) { ctx.fillText('..."', 88, y); break; }
        } else {
          line = testLine;
        }
      }
      if (y <= 750) ctx.fillText(line.trimEnd() + '"', 88, y);

      // QR Code
      const qrDataUrl = await QRCode.toDataURL(pageUrl, {
        width: 200, margin: 1,
        color: { dark: '#eab308', light: '#071207' },
      });
      const qrImg = new Image();
      await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
      ctx.drawImage(qrImg, 80, 840, 180, 180);

      // Texto ao lado do QR
      ctx.fillStyle = '#ffffff60';
      ctx.font = '24px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Arena Trade Sports', 280, 890);
      ctx.fillStyle = '#eab30880';
      ctx.font = '20px monospace';
      ctx.fillText('Escaneie para consultar a Dialma', 280, 926);
      ctx.fillText('arenatradesports.com', 280, 958);

      // Badge Estocadora
      ctx.fillStyle = '#eab30820';
      ctx.beginPath();
      ctx.roundRect(280, 980, 260, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#eab308';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Estocadora de Vento ™', 410, 1006);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'dialma_ia.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Dialma IA', text: entry.text.slice(0, 100) + '...' });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `dialma_${home}_vs_${away}.png`.replace(/\s+/g, '_');
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch { /* silencioso */ }
  }, []);

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
            {/* Outros jogos de hoje */}
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

            {/* Card principal */}
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

                {/* Times + placar */}
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex-1 text-center p-2.5 rounded-lg transition-all duration-500 ${
                    revealState === 'revealed' && (prediction?.pick === 'home' || prediction?.pick === 'draw')
                      ? 'bg-green-500/20 ring-1 ring-green-500/40' : 'bg-white/5'
                  }`}>
                    <div className="text-sm font-bold text-white leading-tight">{chosenGame.home}</div>
                    {chosenGame.home_fifa_rank != null && (
                      <div className="text-[10px] text-white/35 mt-0.5">FIFA #{chosenGame.home_fifa_rank}</div>
                    )}
                  </div>

                  <div className="text-center min-w-[36px]">
                    {revealState === 'revealed' && prediction?.showScore ? (
                      <div className="font-mono font-black text-yellow-400 text-xl leading-none"
                        style={{ animation: 'dialmaPop 0.5s ease-out' }}>
                        {prediction.scoreH}×{prediction.scoreA}
                      </div>
                    ) : (
                      <div className="text-white/25 text-lg font-mono">×</div>
                    )}
                  </div>

                  <div className={`flex-1 text-center p-2.5 rounded-lg transition-all duration-500 ${
                    revealState === 'revealed' && (prediction?.pick === 'away' || prediction?.pick === 'draw')
                      ? 'bg-green-500/20 ring-1 ring-green-500/40' : 'bg-white/5'
                  }`}>
                    <div className="text-sm font-bold text-white leading-tight">{chosenGame.away}</div>
                    {chosenGame.away_fifa_rank != null && (
                      <div className="text-[10px] text-white/35 mt-0.5">FIFA #{chosenGame.away_fifa_rank}</div>
                    )}
                  </div>
                </div>

                {/* ── IDLE ── */}
                {revealState === 'idle' && (
                  <Button
                    onClick={handleReveal}
                    className="w-full bg-gradient-to-r from-green-800 to-yellow-700 hover:from-green-700 hover:to-yellow-600 text-white font-bold text-sm h-12 rounded-xl gap-2 border border-green-500/30"
                  >
                    <span className="text-xl">👩‍💼</span>
                    Dialma, qual a sua meta quântica para hoje?
                  </Button>
                )}

                {/* ── THINKING ── */}
                {revealState === 'thinking' && (
                  <div className="text-center py-3 space-y-3">
                    <div className="flex items-center justify-center gap-6">
                      <span className="text-5xl inline-block select-none"
                        style={{ animation: 'dialmaThink 0.5s ease-in-out infinite' }}>
                        👩‍💼
                      </span>
                      <MandiocaGauge value={mandiocaIdx} animating />
                    </div>
                    <p className="text-sm text-yellow-400/80 font-mono animate-pulse">
                      Dialma está estocando o vento...
                    </p>
                    <div className="flex justify-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 animate-bounce"
                          style={{ animationDelay: `${i * 0.18}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── REVEALED ── */}
                {revealState === 'revealed' && prediction && (
                  <div className="bg-green-900/30 border border-green-500/25 rounded-xl p-4 space-y-3"
                    style={{ animation: 'predSlide 0.4s ease-out' }}>

                    {/* Header resultado + gauge */}
                    <div className="flex items-start gap-3">
                      <span className="text-3xl flex-shrink-0"
                        style={{ animation: 'dialmaPop 0.55s ease-out' }}>👩‍💼</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-green-400 text-base leading-tight truncate">
                          {predLabel()}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          Certeza quântica: {prediction.energia}/100
                        </div>
                      </div>
                      <MandiocaGauge value={mandiocaIdx} animating={false} />
                    </div>

                    <p className="text-xs text-white/60 italic leading-relaxed">
                      "{prediction.msg}"
                    </p>

                    {/* 🔵 Nota do Mycroft */}
                    {over25 !== null && (
                      <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2">
                        <span className="text-base mt-0.5">🤖</span>
                        <p className="text-[10px] text-blue-300/70 leading-relaxed">
                          Enquanto a Dialma viaja nas metáforas, o{' '}
                          <span className="text-blue-400 font-semibold">Mycroft</span>{' '}
                          calculou que a probabilidade de{' '}
                          <span className="text-blue-300 font-semibold">Over 2.5</span>{' '}
                          é{' '}
                          <span className="text-blue-200 font-bold">{over25}%</span>.
                        </p>
                      </div>
                    )}

                    {/* Áudio + controles */}
                    {currentEntry && (
                      <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3 space-y-2">
                        <p className="text-[11px] text-yellow-300/80 leading-relaxed italic">
                          🎙️ "{currentEntry.text}"
                        </p>

                        {/* Controles de áudio */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {audioLoading ? (
                            <span className="flex items-center gap-1 text-[10px] text-yellow-400/50">
                              <Loader2 className="w-3 h-3 animate-spin" /> Carregando voz...
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => playEntry(currentEntry)}
                                className="flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 font-semibold transition-colors"
                              >
                                ▶ Ouvir Dialma
                              </button>
                              <span className="text-white/20">·</span>
                              <button onClick={handleRandom}
                                className="flex items-center gap-1 text-[10px] text-yellow-400/60 hover:text-yellow-300 transition-colors">
                                <Shuffle className="w-3 h-3" /> Aleatório
                              </button>

                              {dialmaAudioCache.has(currentEntry.key) && (
                                <>
                                  <span className="text-white/20">·</span>
                                  <button
                                    onClick={() => handleDownloadAudio(dialmaAudioCache.get(currentEntry.key)!, chosenGame.home, chosenGame.away)}
                                    disabled={downloading}
                                    className="flex items-center gap-1 text-[10px] text-yellow-400/60 hover:text-yellow-300 transition-colors disabled:opacity-40"
                                  >
                                    <Download className="w-3 h-3" />
                                    {downloading ? 'Baixando...' : 'Baixar'}
                                  </button>
                                </>
                              )}

                              <span className="text-white/20">·</span>
                              <button
                                onClick={() => handleShareImage(currentEntry, chosenGame.home, chosenGame.away)}
                                className="flex items-center gap-1 text-[10px] text-yellow-400/60 hover:text-yellow-300 transition-colors"
                              >
                                <Share2 className="w-3 h-3" /> Compartilhar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {['Meta Quântica', 'Estocagem de Vento', 'IA Presidencial'].map(tag => (
                        <Badge key={tag} variant="outline"
                          className="text-[9px] border-green-500/20 text-green-400/60">{tag}</Badge>
                      ))}
                    </div>

                    <button onClick={handleReset}
                      className="w-full text-[11px] text-white/25 hover:text-white/50 text-center py-1 transition-colors">
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
