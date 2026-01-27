// Professional Landing Page for Millionaire Bluff Arena
// Features: Hero, Trailer, Features, Mycroft Technology, Testimonials, CTAs

import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
// Trailer scene imports
import trailerSceneTension from '@/assets/trailer-scene-tension.mp4';
import trailerSceneMycroft from '@/assets/trailer-scene-mycroft.mp4';
import trailerSceneVoting from '@/assets/trailer-scene-voting.mp4';
import trailerSceneVictory from '@/assets/trailer-scene-victory.mp4';
import trailerSceneCaught from '@/assets/trailer-scene-caught.mp4';
// New gameplay scenes
import trailerSceneQuestion from '@/assets/trailer-scene-question.mp4';
import trailerSceneRecording from '@/assets/trailer-scene-recording.mp4';
import trailerSceneAnalysis from '@/assets/trailer-scene-analysis.mp4';
import trailerSceneScoreboard from '@/assets/trailer-scene-scoreboard.mp4';
// Additional scenes
import trailerSceneDetector from '@/assets/trailer-scene-detector.mp4';
import trailerSceneRewards from '@/assets/trailer-scene-rewards.mp4';
import trailerSceneBriefcase from '@/assets/trailer-scene-briefcase.mp4';
import trailerSceneLobby from '@/assets/trailer-scene-lobby.mp4';
// Dramatic scenes
import trailerSceneElimination from '@/assets/trailer-scene-elimination.mp4';
import trailerSceneBonusCard from '@/assets/trailer-scene-bonus-card.mp4';
import trailerSceneHorusTaunt from '@/assets/trailer-scene-horus-taunt.mp4';
// Hero video
import trailerHero from '@/assets/trailer-hero.mp4';
import { 
  Play, 
  Pause,
  Bot, 
  Mic, 
  Eye, 
  Brain, 
  Trophy, 
  Users, 
  Zap,
  ChevronRight,
  Sparkles,
  Shield,
  Target,
  Video,
  Volume2,
  SkipForward,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HeroParticles } from '@/components/landing/HeroParticles';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { SocialFooter } from '@/components/landing/SocialFooter';

// Trailer scenes configuration - 16 scenes = ~80 seconds total
const TRAILER_SCENES = [
  { src: trailerSceneTension, title: 'Tensão', description: 'Jogador sob pressão' },
  { src: trailerSceneQuestion, title: 'Pergunta', description: 'Responda ou blefe' },
  { src: trailerSceneRecording, title: 'Gravação', description: 'Defenda sua resposta' },
  { src: trailerSceneDetector, title: 'Detector', description: 'Análise forense vocal' },
  { src: trailerSceneMycroft, title: 'Mycroft', description: 'IA forense em ação' },
  { src: trailerSceneHorusTaunt, title: 'Hórus', description: 'Provocação sarcástica' },
  { src: trailerSceneAnalysis, title: 'Análise', description: 'Convicção detectada' },
  { src: trailerSceneVoting, title: 'Votação', description: 'O júri decide' },
  { src: trailerSceneLobby, title: 'Lobby', description: 'Modo multiplayer' },
  { src: trailerSceneScoreboard, title: 'Placar', description: 'BluffCoins em jogo' },
  { src: trailerSceneBonusCard, title: 'Carta Bônus', description: 'Imunidade ativada' },
  { src: trailerSceneCaught, title: 'Flagrante', description: 'Blefe detectado' },
  { src: trailerSceneElimination, title: 'Eliminação', description: 'Fim de jogo' },
  { src: trailerSceneBriefcase, title: 'Maleta', description: 'Escolha misteriosa' },
  { src: trailerSceneRewards, title: 'Prêmios', description: 'Recompensas épicas' },
  { src: trailerSceneVictory, title: 'Vitória', description: '1 milhão de BC' },
];

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}

const FeatureCard = ({ icon, title, description, delay = 0 }: FeatureCardProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="group relative p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_40px_rgba(212,175,55,0.15)]"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
          {icon}
        </div>
        <h3 className="font-orbitron text-lg font-bold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
};

// Mycroft tech feature
interface TechFeatureProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const TechFeature = ({ icon, label, value }: TechFeatureProps) => (
  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-mycroft-green/20">
    <div className="w-10 h-10 rounded-lg bg-mycroft-green/10 flex items-center justify-center text-mycroft-green">
      {icon}
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-orbitron text-sm font-bold text-mycroft-green">{value}</p>
    </div>
  </div>
);

// Trailer Section Component - Full Cinematic Experience with Auto-play
const TrailerSection = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentScene = TRAILER_SCENES[currentSceneIndex];
  const totalDuration = TRAILER_SCENES.length * 5; // 5 seconds per scene

  // Auto-advance to next scene when video ends
  const handleVideoEnd = useCallback(() => {
    const nextIndex = currentSceneIndex + 1;
    
    if (nextIndex < TRAILER_SCENES.length) {
      setIsTransitioning(true);
      
      // Small delay for transition effect
      setTimeout(() => {
        setCurrentSceneIndex(nextIndex);
        setProgress((nextIndex / TRAILER_SCENES.length) * 100);
        setIsTransitioning(false);
      }, 300);
    } else {
      // Trailer finished - loop back to beginning
      setCurrentSceneIndex(0);
      setProgress(0);
      setIsPlaying(false);
      setHasStarted(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  }, [currentSceneIndex]);

  // Start playing trailer
  const handlePlayClick = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(console.error);
        audioRef.current.play().catch(console.error);
        setHasStarted(true);
        // Start progress tracking
        progressIntervalRef.current = setInterval(() => {
          setProgress(prev => {
            const newProgress = prev + (100 / (totalDuration * 10));
            return newProgress >= 100 ? 100 : newProgress;
          });
        }, 100);
      }
    }
  }, [isPlaying, totalDuration]);

  // Load and play new scene source when scene changes
  useEffect(() => {
    if (hasStarted && videoRef.current && !isTransitioning) {
      const video = videoRef.current;
      video.src = currentScene.src;
      video.load();
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    }
  }, [currentSceneIndex, hasStarted, currentScene.src, isTransitioning]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return (
    <section id="trailer" className="relative py-20 px-4">
      {/* Hidden audio element for theme music */}
      <audio
        ref={audioRef}
        src="/audio/horus/tema.mp3"
        preload="auto"
        loop
      />

      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-foreground mb-2">
            <span className="text-primary">TRAILER</span> CINEMATOGRÁFICO
          </h2>
          <p className="text-muted-foreground">9 cenas épicas do gameplay multiplayer • ~45 segundos</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_0_60px_rgba(212,175,55,0.2)]"
        >
{/* Video element - persistent to maintain ref */}
          <motion.div
            className="absolute inset-0"
            animate={{ 
              opacity: isTransitioning ? 0 : 1,
              scale: isTransitioning ? 0.95 : 1
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleVideoEnd}
            />
          </motion.div>

          {/* Cinematic letterbox bars */}
          <div className="absolute top-0 left-0 right-0 h-[8%] bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />

          {/* Play overlay - ONLY show when trailer hasn't started yet */}
          <AnimatePresence>
            {!hasStarted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer z-20"
                onClick={handlePlayClick}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-24 h-24 rounded-full bg-primary/30 backdrop-blur-sm flex items-center justify-center mb-6 hover:bg-primary/40 transition-colors border border-primary/50"
                >
                  <Play className="w-12 h-12 text-primary ml-2" />
                </motion.div>
                <h3 className="font-orbitron text-2xl font-bold text-foreground mb-2">
                  ASSISTIR TRAILER COMPLETO
                </h3>
                <p className="text-muted-foreground mb-4">
                  ~45 segundos • 9 cenas • Com música tema original
                </p>
                
                {/* Scene indicator pills */}
                <div className="flex gap-1.5 mt-4">
                  {TRAILER_SCENES.map((_, index) => (
                    <motion.div
                      key={index}
                      className="w-2 h-2 rounded-full bg-white/30"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Click to pause when playing */}
          {isPlaying && (
            <div 
              className="absolute inset-0 cursor-pointer z-15" 
              onClick={handlePlayClick}
            />
          )}

          {/* Scene indicator and controls - visible when playing */}
          {isPlaying && (
            <>
              {/* Current scene label with smooth transition */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSceneIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-4 left-4 z-30"
                >
                  <div className="px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm border border-primary/30">
                    <p className="text-xs text-muted-foreground">Cena {currentSceneIndex + 1} de {TRAILER_SCENES.length}</p>
                    <p className="font-orbitron text-sm font-bold text-primary">{currentScene.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{currentScene.description}</p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Controls: Pause + Download */}
              <div className="absolute top-4 right-4 z-30 flex gap-2">
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handlePlayClick}
                  className="p-2 rounded-lg bg-black/70 backdrop-blur-sm hover:bg-black/80 transition-colors border border-white/20"
                  title="Pausar"
                >
                  <Pause className="w-5 h-5 text-white" />
                </motion.button>
                <motion.a
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  href={currentScene.src}
                  download={`bluff-arena-${currentScene.title.toLowerCase().replace(/\s+/g, '-')}.mp4`}
                  className="p-2 rounded-lg bg-black/70 backdrop-blur-sm hover:bg-primary/30 transition-colors border border-white/20"
                  title="Baixar cena atual"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-5 h-5 text-white" />
                </motion.a>
              </div>

              {/* Playing indicator with audio visualizer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm"
              >
                <Volume2 className="w-4 h-4 text-primary" />
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      animate={{ height: [6, 14, 6] }}
                      transition={{
                        duration: 0.4,
                        repeat: Infinity,
                        delay: i * 0.08,
                      }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 z-30">
                <motion.div 
                  className="h-full bg-primary"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
                {/* Scene markers */}
                <div className="absolute inset-0 flex">
                  {TRAILER_SCENES.map((_, index) => (
                    <div 
                      key={index}
                      className="flex-1 border-r border-white/20 last:border-r-0"
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-primary z-40 pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-primary z-40 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-primary z-40 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-primary z-40 pointer-events-none" />
        </motion.div>

        {/* Scene progress indicators */}
        <div className="flex justify-center gap-3 mt-6">
          {TRAILER_SCENES.map((scene, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center"
              animate={currentSceneIndex === index ? { scale: 1.1 } : { scale: 1 }}
            >
              <div className={cn(
                "w-8 h-1 rounded-full transition-all mb-2",
                index < currentSceneIndex 
                  ? "bg-primary" 
                  : index === currentSceneIndex 
                    ? "bg-primary shadow-[0_0_10px_rgba(212,175,55,0.5)]" 
                    : "bg-muted-foreground/20"
              )} />
              <span className={cn(
                "text-[10px] transition-all hidden md:block",
                currentSceneIndex === index ? "text-primary font-medium" : "text-muted-foreground/50"
              )}>
                {scene.title}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Video caption */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-muted-foreground text-sm mt-4"
        >
          O Santuário de Hórus espera por você • Clique para iniciar a reprodução automática
        </motion.p>
      </div>
    </section>
  );
};

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const mycroftRef = useRef(null);
  const ctaRef = useRef(null);

  const featuresInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const mycroftInView = useInView(mycroftRef, { once: true, margin: "-100px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  const handlePlay = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ============ HERO SECTION ============ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-4 py-20">
        {/* Background Video - Sanctuary of Horus */}
        <div className="absolute inset-0 overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          >
            <source src={trailerHero} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background" />
          
          {/* Animated glow effects */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-mycroft-green/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          
          {/* Golden Particles */}
          <HeroParticles />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Novo: Análise de Micro-Expressões com IA</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-orbitron text-4xl md:text-6xl lg:text-7xl font-black text-foreground mb-6"
          >
            <span className="text-primary">MILLIONAIRE</span>
            <br />
            <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              BLUFF ARENA
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10"
          >
            O primeiro game show com <span className="text-mycroft-green font-semibold">detector de mentiras por IA</span>. 
            Responda, blufe, e engane os jurados — se conseguir.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Button
              onClick={handlePlay}
              size="lg"
              className="btn-gold text-lg px-8 py-6 rounded-xl group"
            >
              <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              JOGAR AGORA
              <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 rounded-xl border-muted-foreground/30 hover:border-primary/50"
              onClick={() => document.getElementById('trailer')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Video className="w-5 h-5 mr-2" />
              Ver Trailer
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex items-center justify-center gap-8 md:gap-12 text-center"
          >
            <div>
              <p className="font-orbitron text-2xl md:text-3xl font-bold text-primary">478</p>
              <p className="text-xs text-muted-foreground">Pontos Faciais</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="font-orbitron text-2xl md:text-3xl font-bold text-mycroft-green">7+</p>
              <p className="text-xs text-muted-foreground">Métricas Vocais</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="font-orbitron text-2xl md:text-3xl font-bold text-foreground">1M</p>
              <p className="text-xs text-muted-foreground">BluffCoins em Jogo</p>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-3 rounded-full bg-primary" />
          </motion.div>
        </motion.div>
      </section>

      {/* ============ TRAILER SECTION ============ */}
      <TrailerSection />

      {/* ============ FEATURES SECTION ============ */}
      <section ref={featuresRef} className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-foreground mb-4">
              Por que o <span className="text-primary">Bluff Arena</span> é diferente?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Não é só responder certo. É convencer os outros de que você sabe — mesmo quando não sabe.
            </p>
          </motion.div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Brain className="w-6 h-6 text-primary" />}
              title="Blefe Estratégico"
              description="Não sabe a resposta? Invente uma justificativa convincente e engane o júri para ganhar pontos."
              delay={0}
            />
            <FeatureCard
              icon={<Bot className="w-6 h-6 text-mycroft-green" />}
              title="IA Forense"
              description="O Mycroft analisa sua voz e expressões faciais em tempo real para detectar sinais de mentira."
              delay={0.1}
            />
            <FeatureCard
              icon={<Users className="w-6 h-6 text-primary" />}
              title="Júri Humano"
              description="Jogadores votam se acreditam ou duvidam da sua resposta. Engane-os e ganhe o dobro."
              delay={0.2}
            />
            <FeatureCard
              icon={<Trophy className="w-6 h-6 text-primary" />}
              title="Até 1 Milhão BC"
              description="Acumule BluffCoins rodada após rodada. Chegue até a Rodada 15 para disputar o prêmio máximo."
              delay={0.3}
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-primary" />}
              title="Múltiplos Modos"
              description="Jogue solo contra a IA, multiplayer com amigos, ou no Modo Apresentador para eventos ao vivo."
              delay={0.4}
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6 text-primary" />}
              title="Cartas Bônus"
              description="Desbloqueie Imunidade, Porto Seguro e outras cartas especiais para momentos críticos."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* ============ MYCROFT TECHNOLOGY SECTION ============ */}
      <section ref={mycroftRef} className="relative py-20 px-4 overflow-hidden">
        {/* Background effect */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-mycroft-green/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-mycroft-green/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-mycroft-green/5 via-transparent to-mycroft-green/5" />
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={mycroftInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-mycroft-green/20 flex items-center justify-center mycroft-glow">
                  <Bot className="w-6 h-6 text-mycroft-green" />
                </div>
                <div>
                  <h3 className="font-orbitron text-xl font-bold text-mycroft-green">MYCROFT 2.0</h3>
                  <p className="text-xs text-muted-foreground">Sistema de Análise Comportamental</p>
                </div>
              </div>

              <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-foreground mb-6">
                A IA que <span className="text-mycroft-green">lê mentiras</span>
              </h2>

              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                O Mycroft combina análise biométrica vocal com detecção de micro-expressões faciais 
                para gerar um perfil comportamental único de cada jogador. Quanto mais você joga, 
                mais ele aprende seu padrão — e mais difícil fica enganá-lo.
              </p>

              {/* Tech specs */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <TechFeature
                  icon={<Mic className="w-5 h-5" />}
                  label="Análise Vocal"
                  value="60% do Score"
                />
                <TechFeature
                  icon={<Eye className="w-5 h-5" />}
                  label="Análise Facial"
                  value="40% do Score"
                />
                <TechFeature
                  icon={<Target className="w-5 h-5" />}
                  label="Landmarks"
                  value="478 Pontos"
                />
                <TechFeature
                  icon={<Volume2 className="w-5 h-5" />}
                  label="Métricas"
                  value="Pitch, Jitter, Shimmer"
                />
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                <span className="text-mycroft-green">10 cenários humanizados</span> traduzem dados técnicos 
                em leituras intuitivas como "Convicção sólida sob pressão" ou "Zona de risco comportamental".
              </p>
            </motion.div>

            {/* Right: Visualization */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={mycroftInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative aspect-square max-w-md mx-auto">
                {/* Central avatar */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-40 h-40 rounded-full bg-gradient-to-br from-muted to-card border-2 border-mycroft-green/30 flex items-center justify-center shadow-[0_0_60px_rgba(0,255,136,0.2)]"
                  >
                    <Bot className="w-20 h-20 text-mycroft-green/80" />
                  </motion.div>
                </div>

                {/* Orbiting metrics */}
                {[
                  { label: 'Pitch', angle: 0, color: 'text-primary' },
                  { label: 'Jitter', angle: 60, color: 'text-mycroft-green' },
                  { label: 'Latência', angle: 120, color: 'text-primary' },
                  { label: 'Olhar', angle: 180, color: 'text-mycroft-green' },
                  { label: 'Shimmer', angle: 240, color: 'text-primary' },
                  { label: 'Piscadas', angle: 300, color: 'text-mycroft-green' },
                ].map((metric, i) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={mycroftInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="absolute"
                    style={{
                      top: `${50 + 40 * Math.sin((metric.angle * Math.PI) / 180)}%`,
                      left: `${50 + 40 * Math.cos((metric.angle * Math.PI) / 180)}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className={cn(
                      "px-3 py-1.5 rounded-lg bg-card/80 border border-border/50 backdrop-blur-sm",
                      metric.color
                    )}>
                      <span className="font-orbitron text-xs font-bold">{metric.label}</span>
                    </div>
                  </motion.div>
                ))}

                {/* Pulse rings */}
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border border-mycroft-green/30"
                />
                <motion.div
                  animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  className="absolute inset-0 rounded-full border border-mycroft-green/20"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS SECTION ============ */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como <span className="text-primary">Funciona</span>?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: 1, title: 'Receba a Pergunta', desc: 'Uma pergunta de conhecimento geral aparece para você.' },
              { step: 2, title: 'Escolha e Justifique', desc: 'Selecione uma resposta e grave sua justificativa em áudio/vídeo.' },
              { step: 3, title: 'Mycroft Analisa', desc: 'A IA processa sua voz e expressões para detectar sinais de blefe.' },
              { step: 4, title: 'Júri Decide', desc: 'Jogadores votam. Se enganar o júri, você dobra os pontos!' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="relative text-center"
              >
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <span className="font-orbitron text-2xl font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="font-orbitron text-lg font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS SECTION ============ */}
      <TestimonialsSection />

      {/* ============ FINAL CTA SECTION ============ */}
      <section ref={ctaRef} className="relative py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent" />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={ctaInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="relative max-w-3xl mx-auto text-center"
        >
          <h2 className="font-orbitron text-3xl md:text-5xl font-bold text-foreground mb-6">
            Pronto para <span className="text-primary">blefar</span>?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Entre na arena e descubra se você consegue enganar a IA e os outros jogadores.
          </p>

          <Button
            onClick={handlePlay}
            size="lg"
            className="btn-gold text-xl px-12 py-7 rounded-2xl group animate-pulse-glow"
          >
            <Play className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
            COMEÇAR AGORA
            <ChevronRight className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform" />
          </Button>

          <p className="mt-6 text-sm text-muted-foreground">
            Gratuito para jogar • Sem downloads • Direto no navegador
          </p>
        </motion.div>
      </section>

      {/* ============ FOOTER WITH SOCIAL ============ */}
      <SocialFooter />
    </div>
  );
}
