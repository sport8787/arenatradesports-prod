import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Target, LineChart, Trophy, LogOut, Settings2,
  Lock, Zap, Play, X, Volume2, VolumeX, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import logoOraculo from '@/assets/logo_oraculo_mycroft.png';
import { supabase } from '@/integrations/supabase/client';

// ─── Áudio de boas-vindas do Hórus (2 partes) ──────────────────────────────
// Parte 1: TTS via ElevenLabs (personalizado com nome do usuário)
// Parte 2: arquivo gravado salvo no Supabase Storage
//
// Após fazer upload do áudio no Supabase Storage:
//   Dashboard → Storage → Bucket "audio" (público) → upload "inicio.mp3"
//   A URL pública segue o padrão abaixo.
const SUPABASE_PROJECT_REF = 'ogpohiugfkvygcejrzfp';
const INICIO_AUDIO_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/audio/inicio.mp3`;

// URL do vídeo tutorial (YouTube embed ou link direto)
const TUTORIAL_VIDEO_URL = ''; // TODO: inserir URL do vídeo tutorial após produção

// Texto TTS personalizado — {name} será substituído pelo nome do usuário
const TTS_GREETING = (name: string) =>
  `Seja bem-vindo, ${name}, ao Oráculo Mycroft.`;

const heroArenas = [
  {
    key: 'arena_punter',
    title: 'Arena Punter',
    description: 'Entradas pré-jogo aprovadas pelo Mycroft com edge matemático real. O coração do sistema.',
    href: '/punter',
    icon: Target,
    badge: 'CORE',
    accent: 'from-amber-500/30 via-amber-600/15 to-amber-900/10 border-amber-500/60',
    badgeClass: 'bg-amber-500 text-black',
  },
  {
    key: 'arena_live',
    title: 'Arena Live',
    description: 'Trade ao vivo com leitura situacional, LABAREDA e cash-out em tempo real.',
    href: '/arena-trader-sports',
    icon: Activity,
    badge: 'AO VIVO',
    accent: 'from-rose-500/30 via-rose-600/15 to-rose-900/10 border-rose-500/60',
    badgeClass: 'bg-rose-500 text-white',
  },
];

const sideArenas = [
  {
    title: 'Arena Trader Financeiro',
    description: 'Experimental — WIN, WDO e BTC sendo testados com a lógica do Trader Sports.',
    href: '/arena-trader',
    icon: LineChart,
    badge: 'BETA',
    accent: 'from-sky-500/15 to-sky-700/5 border-sky-500/30',
    badgeClass: 'bg-amber-500 text-black',
  },
  {
    title: 'Liga Mycroft',
    description: 'Ranking de ROI e recompensas BC.',
    href: '/loja-bc',
    icon: Trophy,
    badge: null,
    accent: 'from-purple-500/15 to-purple-700/5 border-purple-500/30',
  },
  {
    title: 'Funções Avançadas',
    description: 'Configurações, ferramentas e ajustes do Oráculo.',
    href: '/menu',
    icon: Settings2,
    badge: null,
    accent: 'from-slate-500/15 to-slate-700/5 border-slate-500/30',
  },
];

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, profile } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [audioLabel, setAudioLabel] = useState('Hórus está falando com você...');
  const [videoOpen, setVideoOpen] = useState(false);

  // Redireciona usuário não autenticado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // ── Sequência de áudio de boas-vindas (apenas para usuários sem assinatura, 1x) ──
  // Parte 1: TTS personalizado via ElevenLabs ("Seja bem-vindo, [nome]...")
  // Parte 2: arquivo inicio.mp3 do Supabase Storage (resto do discurso do Hórus)
  useEffect(() => {
    if (authLoading || subLoading || hasAccess || !isAuthenticated) return;

    const userId = profile?.id ?? null;
    const userName = profile?.full_name || profile?.username || null;
    if (!userId || !userName) return; // aguarda profile carregar

    const storageKey = `horus_welcome_played_${userId}`;
    if (localStorage.getItem(storageKey)) return;

    // Marca como tocado imediatamente para não repetir em re-renders
    localStorage.setItem(storageKey, '1');

    let cancelled = false;

    const playSequence = async () => {
      setShowWelcomeBanner(true);

      // ── PARTE 1: TTS personalizado ──────────────────────────────────────
      try {
        setAudioLabel(`Hórus: "Seja bem-vindo, ${userName}..."`);
        setAudioPlaying(true);

        const ttsRes = await fetch(
          `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/elevenlabs-tts`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: TTS_GREETING(userName) }),
          }
        );

        if (!cancelled && ttsRes.ok) {
          const blob = await ttsRes.blob();
          const url = URL.createObjectURL(blob);
          const part1 = new Audio(url);
          audioRef.current = part1;
          part1.volume = 0.85;

          await new Promise<void>((resolve) => {
            part1.addEventListener('ended', () => {
              URL.revokeObjectURL(url);
              resolve();
            });
            part1.addEventListener('error', () => {
              URL.revokeObjectURL(url);
              resolve();
            });
            part1.play().catch(() => resolve());
          });
        }
      } catch {
        // TTS falhou — continua para parte 2 sem bloquear
      }

      if (cancelled) return;

      // ── PARTE 2: inicio.mp3 do Supabase Storage ─────────────────────────
      try {
        setAudioLabel('Hórus está falando com você...');
        const part2 = new Audio(INICIO_AUDIO_URL);
        audioRef.current = part2;
        part2.volume = 0.85;

        await new Promise<void>((resolve) => {
          part2.addEventListener('ended', () => {
            setAudioPlaying(false);
            resolve();
          });
          part2.addEventListener('error', () => {
            setAudioPlaying(false);
            resolve();
          });
          part2.play().catch(() => {
            setAudioPlaying(false);
            resolve();
          });
        });
      } catch {
        setAudioPlaying(false);
      }
    };

    const timer = setTimeout(() => { playSequence(); }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, subLoading, hasAccess, isAuthenticated, profile?.id, profile?.username, profile?.full_name]);

  const handleToggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !audioMuted;
    setAudioMuted(!audioMuted);
  };

  // Replay manual (toca apenas o inicio.mp3)
  const handlePlayAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(INICIO_AUDIO_URL);
    audioRef.current = audio;
    audio.volume = audioMuted ? 0 : 0.85;
    audio.muted = audioMuted;
    audio.addEventListener('ended', () => setAudioPlaying(false));
    audio.play().then(() => setAudioPlaying(true)).catch(() => {});
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const isNewUser = !hasAccess && !subLoading && !authLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/40 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/lobby" className="flex items-center gap-3">
            <img src={logoOraculo} alt="Oráculo Mycroft" className="h-10 w-10" />
            <div className="leading-tight">
              <div className="text-base font-semibold">Oráculo Mycroft</div>
              <div className="text-xs text-muted-foreground">Lobby de Arenas</div>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* Banner do áudio de boas-vindas */}
      <AnimatePresence>
        {showWelcomeBanner && isNewUser && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-primary/10 border-b border-primary/20 px-4 py-2.5"
          >
            <div className="container mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${audioPlaying ? 'bg-primary/20 animate-pulse' : 'bg-primary/10'}`}>
                  <span className="text-sm">🤖</span>
                </div>
                <p className="font-mono text-xs text-foreground/90">
                  {audioPlaying ? audioLabel : 'Hórus tem uma mensagem para você'}
                </p>
                <div className="flex items-center gap-1.5">
                  {!audioPlaying && (
                    <button
                      onClick={handlePlayAudio}
                      className="flex items-center gap-1 font-mono text-[10px] text-primary hover:text-primary/80 border border-primary/30 rounded px-2 py-0.5"
                    >
                      <Play className="w-2.5 h-2.5" /> Ouvir
                    </button>
                  )}
                  {audioPlaying && (
                    <button onClick={handleToggleMute} className="text-muted-foreground hover:text-foreground">
                      {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => setShowWelcomeBanner(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="container mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold sm:text-3xl">
            {isNewUser ? 'Bem-vindo' : 'Olá'}{profile?.username ? `, ${profile.username}` : ''}.
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {isNewUser
              ? 'Aqui o Mycroft varre o mercado por você — cada partida é um Ativo Financeiro.'
              : 'Escolha em qual arena o Mycroft vai trabalhar para você agora.'}
          </p>
        </motion.div>

        {/* FAIXA 1 — Arenas principais */}
        <section className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-3 px-1">
            Onde o Mycroft trabalha pra você
          </p>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {heroArenas.map((arena, i) => {
              const Icon = arena.icon;
              const locked = isNewUser;

              return (
                <motion.div
                  key={arena.href}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative"
                >
                  <button
                    onClick={() => navigate(arena.href)}
                    className={`group w-full relative rounded-2xl border-2 bg-gradient-to-br ${arena.accent} p-7 sm:p-8 text-left transition shadow-lg ${
                      locked
                        ? 'opacity-60 cursor-pointer hover:opacity-70'
                        : 'hover:scale-[1.02] hover:shadow-2xl'
                    }`}
                  >
                    {arena.badge && (
                      <span className={`absolute top-4 right-4 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${arena.badgeClass}`}>
                        {arena.badge}
                      </span>
                    )}
                    {locked && (
                      <span className="absolute top-4 left-4 flex items-center gap-1 bg-background/80 backdrop-blur rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold text-muted-foreground border border-border/60">
                        <Lock className="w-3 h-3" /> BLOQUEADA
                      </span>
                    )}
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-background/50 backdrop-blur">
                      {locked ? <Lock className="h-7 w-7 text-muted-foreground" /> : <Icon className="h-7 w-7" />}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">{arena.title}</div>
                    <div className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {arena.description}
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ESPECIAL COPA DO MUNDO 2026 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate('/punter/copa')}
            className="group w-full relative rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-br from-green-900/50 via-black/60 to-yellow-900/40 p-5 sm:p-6 text-left transition hover:scale-[1.01] hover:shadow-xl hover:border-yellow-400/70 hover:shadow-yellow-500/10"
          >
            <span className="absolute top-4 right-4 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider bg-yellow-500 text-black">
              🏆 ESPECIAL
            </span>
            <div className="flex items-center gap-4">
              <div className="text-4xl flex-shrink-0">🇧🇷</div>
              <div>
                <div className="text-lg sm:text-xl font-black text-yellow-400 font-mono tracking-tight leading-tight">
                  ESPECIAL COPA DO MUNDO 2026
                </div>
                <div className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">
                  Sinais pré-live do Mycroft para cada jogo · Edge matemático · Validação IA · Rumo ao Hexa
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-yellow-400/70 text-[11px] font-mono group-hover:text-yellow-400 transition-colors">
              Ver entradas Copa <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </motion.section>

        {/* CTA Day Pass — exibido apenas para usuários sem assinatura */}
        {isNewUser && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-10 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary/70 mb-1">
                  Libere as arenas agora
                </p>
                <h2 className="font-bold text-lg sm:text-xl text-foreground leading-tight">
                  Arena Punter + Arena Live
                </h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Acesso completo às duas principais arenas com sinais ao vivo e pré-jogo,<br className="hidden sm:block" />
                  banca virtual e BC coins.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                {/* Day Pass */}
                <a
                  href="/lobby-preview"
                  className="flex flex-col items-center justify-center gap-0.5 bg-primary text-primary-foreground font-mono font-bold px-5 py-3 rounded-xl hover:opacity-90 transition-opacity text-center"
                >
                  <span className="flex items-center gap-1.5 text-sm">
                    <Zap className="w-4 h-4" /> Day Pass
                  </span>
                  <span className="text-xs font-normal opacity-90">R$ 9,90 · 24 horas</span>
                </a>
                {/* Plano Mensal */}
                <a
                  href="/paywall"
                  className="flex flex-col items-center justify-center gap-0.5 border border-primary/50 text-foreground font-mono font-bold px-5 py-3 rounded-xl hover:bg-primary/10 transition-colors text-center"
                >
                  <span className="text-sm">Plano Mensal</span>
                  <span className="text-xs font-normal text-muted-foreground">R$ 47,90 / mês</span>
                </a>
              </div>
            </div>
          </motion.section>
        )}

        {/* Vídeo Tutorial — exibido para todos (mas em destaque para novos usuários) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`mb-10 rounded-2xl border ${isNewUser ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card/30'} p-5 sm:p-6`}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Play className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-mono font-semibold text-sm text-foreground">
                Tutorial — Como o Oráculo Mycroft funciona
              </h3>
              <p className="font-mono text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Entradas aprovadas pré-live, sinais ao vivo, Greens e como calcular seu ROI.
              </p>
            </div>
          </div>

          {TUTORIAL_VIDEO_URL ? (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-background/50">
              <iframe
                src={TUTORIAL_VIDEO_URL}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title="Tutorial Oráculo Mycroft"
              />
            </div>
          ) : (
            /* Placeholder enquanto o vídeo não está disponível */
            <button
              onClick={() => setVideoOpen(true)}
              className="w-full rounded-xl aspect-video bg-background/50 border border-dashed border-border/60 flex flex-col items-center justify-center gap-3 hover:bg-background/70 transition-colors group"
            >
              <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
                <Play className="w-7 h-7 text-amber-400" />
              </div>
              <div className="text-center">
                <p className="font-mono text-sm font-semibold text-foreground">Vídeo tutorial em breve</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  Aprenda como usar o Oráculo Mycroft do zero
                </p>
              </div>
            </button>
          )}
        </motion.section>

        {/* FAIXA 2 — Ferramentas complementares */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-3 px-1">
            Ferramentas complementares
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {sideArenas.map((arena, i) => {
              const Icon = arena.icon;
              return (
                <motion.button
                  key={arena.href}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.04 }}
                  onClick={() => navigate(arena.href)}
                  className={`group relative rounded-xl border bg-gradient-to-br ${arena.accent} p-4 text-left transition hover:scale-[1.02] hover:shadow-lg`}
                >
                  {arena.badge && (
                    <span className={`absolute top-2 right-2 rounded-full backdrop-blur px-2 py-0.5 text-[9px] font-bold tracking-wider border ${
                      arena.badge === 'BETA'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                        : 'bg-background/70 text-foreground/80 border-border/50'
                    }`}>
                      {arena.badge}
                    </span>
                  )}
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-background/40">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold leading-tight">{arena.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-snug">
                    {arena.description}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Modal placeholder de vídeo (para quando não há URL configurada) */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full text-center"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="font-mono font-bold text-base mb-2">Tutorial em produção</h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
                O vídeo tutorial está sendo produzido e estará disponível em breve.
                Ele mostrará Entradas aprovadas pré-live, sinais ao vivo, Greens e como calcular seu ROI.
              </p>
              <button
                onClick={() => setVideoOpen(false)}
                className="font-mono text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2"
              >
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
