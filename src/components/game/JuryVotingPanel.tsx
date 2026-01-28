// Jury Voting Panel - UI Component to display AI jury votes
// Shows 3 juror cards with their votes, confidence, and reasoning
// Includes dramatic animations: confetti for CONVENCEU, shake for NÃO CONVENCEU

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sword, Calculator, CheckCircle, XCircle, Clock, DollarSign, Sparkles, AlertTriangle, Copy, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

// Local audio files for verdict sounds (no API costs)
const VERDICT_SOUNDS = {
  victory: [
    '/audio/horus/vitoria.mp3',
    '/audio/horus/vitoria2.mp3',
    '/audio/horus/vitoria3.mp3',
    '/audio/horus/vitoria4.mp3',
  ],
  defeat: [
    '/audio/horus/derrota.mp3',
    '/audio/horus/derrota2.mp3',
  ],
};
import type { JuryVerdict, JuryVote, JurorProfile, JuryVoteRequest } from '@/services/juryClaudeService';

interface JuryVotingPanelProps {
  verdict: JuryVerdict | null;
  isLoading: boolean;
  debugRequest?: JuryVoteRequest | null;
}

// Confetti particle component for CONVENCEU
const ConfettiParticle: React.FC<{ delay: number; x: number }> = ({ delay, x }) => {
  const colors = ['#FFD700', '#FFA500', '#FFDF00', '#F0E68C', '#DAA520'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = Math.random() * 8 + 4;
  const rotation = Math.random() * 360;
  
  return (
    <motion.div
      initial={{ y: -20, x, opacity: 1, rotate: 0, scale: 0 }}
      animate={{ 
        y: 400, 
        x: x + (Math.random() - 0.5) * 100,
        opacity: [1, 1, 0],
        rotate: rotation + 720,
        scale: [0, 1, 1, 0.5]
      }}
      transition={{ 
        duration: 3,
        delay,
        ease: "easeOut"
      }}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        top: 0,
        left: '50%',
        zIndex: 100,
      }}
    />
  );
};

// Golden coins falling animation
const GoldenCoin: React.FC<{ delay: number; x: number }> = ({ delay, x }) => (
  <motion.div
    initial={{ y: -30, x, opacity: 0, scale: 0 }}
    animate={{ 
      y: 350, 
      opacity: [0, 1, 1, 0],
      scale: [0, 1, 1, 0.8],
      rotateY: [0, 1080]
    }}
    transition={{ 
      duration: 2.5,
      delay,
      ease: "easeIn"
    }}
    className="absolute top-0 left-1/2 text-2xl z-50"
    style={{ marginLeft: x }}
  >
    🪙
  </motion.div>
);

// Juror metadata for UI
const JUROR_META: Record<JurorProfile, {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
}> = {
  conservador: {
    name: 'O Prudente',
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'Analista conservador que valoriza evidências concretas',
  },
  agressivo: {
    name: 'O Tubarão',
    icon: Sword,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    description: 'Jurado agressivo que valoriza convicção e coragem',
  },
  neutro: {
    name: 'O Quant',
    icon: Calculator,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    description: 'Analista objetivo que segue os dados rigorosamente',
  },
};

/**
 * Individual Juror Vote Card
 */
const JurorCard: React.FC<{
  vote: JuryVote;
  index: number;
}> = ({ vote, index }) => {
  const meta = JUROR_META[vote.profile];
  const Icon = meta.icon;
  
  const isClaro = vote.vote === 'CLARO';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.2 }}
      className={`relative overflow-hidden rounded-lg border ${
        isClaro 
          ? 'border-emerald-500/30 bg-emerald-500/5' 
          : 'border-red-500/30 bg-red-500/5'
      } p-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${meta.bgColor}`}>
            <Icon className={`w-5 h-5 ${meta.color}`} />
          </div>
          <div>
            <h3 className={`font-bold ${meta.color}`}>{meta.name}</h3>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>
        
        {/* Vote Icon */}
        {isClaro ? (
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        ) : (
          <XCircle className="w-8 h-8 text-red-400" />
        )}
      </div>
      
      {/* Vote Decision */}
      <div className={`text-center py-3 px-4 rounded-lg ${
        isClaro ? 'bg-emerald-500/20' : 'bg-red-500/20'
      } mb-3`}>
        <div className={`text-2xl font-bold ${
          isClaro ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {vote.vote}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          Confiança: {vote.confidence}%
        </div>
        
        {/* Confidence Bar */}
        <div className="w-full h-1 bg-secondary rounded-full mt-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${vote.confidence}%` }}
            transition={{ delay: index * 0.2 + 0.3, duration: 0.5 }}
            className={`h-full ${
              isClaro ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
        </div>
      </div>
      
      {/* Reasoning */}
      <div className="text-sm text-foreground/80 bg-background/20 p-3 rounded-lg">
        <p className="italic">"{vote.reasoning}"</p>
      </div>
      
      {/* Processing Time */}
      {vote.processingTimeMs && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Clock className="w-3 h-3" />
          <span>{vote.processingTimeMs}ms</span>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Fallback Badge - shows when jury used random votes instead of Claude
 */
const FallbackBadge: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs font-medium"
  >
    <AlertTriangle className="w-3.5 h-3.5" />
    <span>Fallback ativado</span>
  </motion.div>
);

/**
 * Detect if verdict is a fallback (random votes)
 */
function isFallbackVerdict(verdict: JuryVerdict): boolean {
  // Fallback indicators:
  // 1. Cost is 0
  // 2. Total processing time is 0 or very low (< 100ms)
  // 3. All votes have confidence = 50 (the fallback default)
  // 4. Any reasoning contains "fallback", "indisponível", "erro"
  
  if (verdict.costEstimate === 0) return true;
  if (verdict.totalProcessingTimeMs < 100) return true;
  
  const allConfidence50 = verdict.votes.every(v => v.confidence === 50);
  const hasFallbackReasoning = verdict.votes.some(v => 
    v.reasoning.toLowerCase().includes('fallback') ||
    v.reasoning.toLowerCase().includes('indisponível') ||
    v.reasoning.toLowerCase().includes('erro') ||
    v.reasoning.toLowerCase().includes('aleatório')
  );
  
  if (allConfidence50 && hasFallbackReasoning) return true;
  
  return false;
}

/**
 * Verdict Summary Banner with dramatic animations
 */
const VerdictBanner: React.FC<{ verdict: JuryVerdict }> = ({ verdict }) => {
  const claroCount = verdict.votes.filter(v => v.vote === 'CLARO').length;
  const [showEffects, setShowEffects] = useState(false);
  const audioPlayedRef = useRef(false);
  
  // Play verdict sound effect
  useEffect(() => {
    if (audioPlayedRef.current) return;
    audioPlayedRef.current = true;
    
    const sounds = verdict.convicted ? VERDICT_SOUNDS.victory : VERDICT_SOUNDS.defeat;
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
    
    const audio = new Audio(randomSound);
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Silently fail if audio can't play
    });
  }, [verdict.convicted]);
  
  // Trigger effects after initial animation
  useEffect(() => {
    const timer = setTimeout(() => setShowEffects(true), 800);
    return () => clearTimeout(timer);
  }, []);
  
  // Generate confetti particles for CONVENCEU
  const confettiParticles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: (Math.random() - 0.5) * 300,
  }));
  
  // Generate golden coins
  const goldenCoins = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8 + 0.2,
    x: (Math.random() - 0.5) * 250,
  }));
  
  // Shake animation for NÃO CONVENCEU
  const shakeAnimation = !verdict.convicted ? {
    x: [0, -10, 10, -10, 10, -5, 5, 0],
    scale: 1,
    opacity: 1
  } : {
    scale: 1,
    opacity: 1
  };
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={shakeAnimation}
      transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
      className={`relative overflow-hidden rounded-xl border-2 ${
        verdict.convicted 
          ? 'border-emerald-500 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5' 
          : 'border-red-500 bg-gradient-to-r from-red-500/20 to-red-500/5'
      } p-6 mb-6`}
    >
      {/* Confetti & Coins for CONVENCEU */}
      <AnimatePresence>
        {verdict.convicted && showEffects && (
          <>
            {confettiParticles.map(p => (
              <ConfettiParticle key={p.id} delay={p.delay} x={p.x} />
            ))}
            {goldenCoins.map(c => (
              <GoldenCoin key={`coin-${c.id}`} delay={c.delay} x={c.x} />
            ))}
          </>
        )}
      </AnimatePresence>
      
      {/* Shake overlay for NÃO CONVENCEU */}
      {!verdict.convicted && showEffects && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 0.5, repeat: 2 }}
          className="absolute inset-0 bg-red-500/20 z-10 pointer-events-none"
        />
      )}
      
      <div className="flex items-center justify-between relative z-20">
        <div>
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1, type: "spring", stiffness: 300 }}
            className={`text-3xl font-bold mb-2 ${
              verdict.convicted ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {verdict.convicted ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.5, delay: 1.2 }}
                >
                  ✅
                </motion.span>
                <span>CONVENCEU O JÚRI</span>
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.3, delay: 1.5, repeat: 2 }}
                >
                  <Sparkles className="w-6 h-6 text-gold" />
                </motion.span>
              </span>
            ) : (
              <motion.span 
                animate={{ x: [0, -3, 3, -3, 3, 0] }}
                transition={{ duration: 0.4, delay: 1 }}
                className="flex items-center gap-2"
              >
                ❌ NÃO CONVENCEU
              </motion.span>
            )}
          </motion.div>
          <div className="text-foreground/80">
            Votação: {claroCount} CLARO × {3 - claroCount} BLEFE
            {verdict.unanimous && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 }}
                className="ml-2 text-yellow-400"
              >
                (Unânime! 🏆)
              </motion.span>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            <span>{(verdict.totalProcessingTimeMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
            <DollarSign className="w-4 h-4" />
            <span>R${verdict.costEstimate.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* Animated background effect */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl ${
          verdict.convicted ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      
      {/* Victory glow pulse for CONVENCEU */}
      {verdict.convicted && (
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -left-10 -top-10 w-32 h-32 rounded-full blur-2xl bg-gold"
        />
      )}
    </motion.div>
  );
};

/**
 * Loading State
 */
const LoadingState: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="text-center py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block"
        >
          <Calculator className="w-12 h-12 text-purple-400" />
        </motion.div>
        <p className="text-xl font-bold text-foreground mt-4">
          Júri IA Deliberando...
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Claude Sonnet 4 analisando evidências
        </p>
      </div>
      
      {/* Animated placeholder cards */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{
            delay: i * 0.2,
            duration: 1.5,
            repeat: Infinity,
          }}
          className="h-48 rounded-lg bg-secondary/50 animate-pulse"
        />
      ))}
    </div>
  );
};

/**
 * Main Panel Component
 */
export const JuryVotingPanel: React.FC<JuryVotingPanelProps> = ({
  verdict,
  isLoading,
  debugRequest,
}) => {
  // No auto-complete timer - results stay visible until user clicks "PRÓXIMA RODADA"
  
  if (isLoading) {
    return <LoadingState />;
  }
  
  if (!verdict) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aguardando deliberação do júri...
      </div>
    );
  }
  
  const isFallback = isFallbackVerdict(verdict);
  const [copied, setCopied] = useState(false);
  
  const handleCopyPayload = () => {
    if (debugRequest) {
      navigator.clipboard.writeText(JSON.stringify(debugRequest, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Fallback warning badge */}
      {isFallback && (
        <div className="flex justify-center">
          <FallbackBadge />
        </div>
      )}
      
      {/* Verdict Banner */}
      <VerdictBanner verdict={verdict} />
      
      {/* Juror Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {verdict.votes.map((vote, index) => (
          <JurorCard key={vote.profile} vote={vote} index={index} />
        ))}
      </div>

      {/* Tabs: technical + payload sent */}
      <Tabs defaultValue="tech" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="tech" className="flex-1">Detalhes Técnicos</TabsTrigger>
          <TabsTrigger value="payload" className="flex-1">Métricas enviadas</TabsTrigger>
        </TabsList>

        <TabsContent value="tech" className="mt-3">
          <div className="p-4 bg-background/20 rounded-lg text-xs text-muted-foreground space-y-1">
            <p>• Modelo: Claude Sonnet 4 (claude-sonnet-4-20250514)</p>
            <p>• Processamento: {verdict.totalProcessingTimeMs}ms</p>
            <p>• Custo estimado: R${verdict.costEstimate.toFixed(2)}</p>
            <p>• Tokens aprox: ~900 por jurado × 3 = ~2.700 tokens</p>
          </div>
        </TabsContent>

        <TabsContent value="payload" className="mt-3">
          {debugRequest ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Payload exato enviado para o júri IA nesta rodada.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPayload}
                  className="h-7 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1 text-emerald-400" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar JSON
                    </>
                  )}
                </Button>
              </div>
              <pre className="max-h-80 overflow-auto rounded-lg bg-secondary/30 p-3 text-xs text-foreground/80">
                {JSON.stringify(debugRequest, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="p-4 bg-background/20 rounded-lg text-xs text-muted-foreground">
              Nenhum payload capturado ainda nesta rodada.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default JuryVotingPanel;
