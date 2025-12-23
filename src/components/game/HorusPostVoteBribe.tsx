import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Sparkles, Volume2, AlertTriangle, Coins, Loader2, Check, X } from 'lucide-react';
import GoldButton from './GoldButton';

interface HorusPostVoteBribeProps {
  isVisible: boolean;
  totalBluffCoins?: number | null;
  onAcceptBribe: () => void;
  onRejectBribe: () => void;
  onListenProposal: () => void;
  isListening: boolean;
  isLoading?: boolean;
  currentPhrase: string | null;
  isAllIn?: boolean; // Round 15 - shows briefcase aesthetic
  playerGotCorrect?: boolean; // If player answered correctly, skip offer
}

export default function HorusPostVoteBribe({
  isVisible,
  totalBluffCoins,
  onAcceptBribe,
  onRejectBribe,
  onListenProposal,
  isListening,
  isLoading = false,
  currentPhrase,
  isAllIn = false,
  playerGotCorrect = false,
}: HorusPostVoteBribeProps) {
  const [showChoices, setShowChoices] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(false);

  // Show choices after a delay when visible - regardless of isListening state
  // This ensures buttons always appear even if audio fails
  useEffect(() => {
    if (isVisible && !showChoices) {
      setGlowIntensity(true);
      const timer = setTimeout(() => {
        setShowChoices(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, showChoices]);

  // Start glow when loading
  useEffect(() => {
    if (isLoading) {
      setGlowIntensity(true);
    }
  }, [isLoading]);

  // Reset state when visibility changes
  useEffect(() => {
    if (!isVisible) {
      setShowChoices(false);
      setGlowIntensity(false);
    }
  }, [isVisible]);

  // Determine display value
  const hasExactValue = totalBluffCoins !== null && totalBluffCoins !== undefined && totalBluffCoins > 0;

  // Determine labels based on context
  const offerTitle = isAllIn ? 'MALETA FINAL' : 'ACORDO DE OURO';
  const acceptLabel = isAllIn ? 'ACEITAR MALETA' : 'ACEITAR ACORDO';
  const rejectLabel = 'REVELAR DESTINO';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            className="relative w-full max-w-lg"
          >
            {/* Background glow effect */}
            <motion.div
              animate={{
                opacity: glowIntensity ? [0.4, 0.9, 0.4] : 0.3,
                scale: glowIntensity ? [1, 1.15, 1] : 1,
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 blur-2xl bg-[radial-gradient(ellipse_at_center,_hsl(var(--gold)/0.7)_0%,_transparent_60%)]"
            />

            <div className="relative bg-gradient-to-b from-gray-900 via-gray-900 to-black border-2 border-gold/60 rounded-2xl p-6 space-y-6">
              {/* Header - Dramatic */}
              <div className="text-center space-y-2">
                <motion.div
                  animate={{ 
                    scale: [1, 1.08, 1],
                    textShadow: glowIntensity 
                      ? ['0 0 15px hsl(var(--gold))', '0 0 40px hsl(var(--gold))', '0 0 15px hsl(var(--gold))']
                      : '0 0 15px hsl(var(--gold))'
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="font-orbitron text-2xl text-gold font-bold"
                >
                  ⚖️ {offerTitle} ⚖️
                </motion.div>
                <p className="text-sm text-muted-foreground italic">
                  O júri votou. Seu destino está selado. Mas eu tenho uma proposta...
                </p>
              </div>

              {/* Visual Element - Always Gold themed */}
              <div className="flex justify-center py-4">
                {isAllIn ? (
                  // Briefcase for All-In round
                  <motion.div
                    animate={{
                      y: glowIntensity ? [-10, 10, -10] : [-5, 5, -5],
                      rotateY: glowIntensity ? [0, 15, 0, -15, 0] : 0,
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="relative"
                  >
                    {glowIntensity && (
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 w-36 h-28 bg-gold/30 rounded-lg blur-xl"
                      />
                    )}
                    <div className={`
                      w-36 h-28 bg-gradient-to-br from-gray-800 via-gray-900 to-black 
                      rounded-lg border-4 flex items-center justify-center relative
                      ${glowIntensity ? 'border-gold shadow-[0_0_50px_hsl(var(--gold)/0.7)]' : 'border-gold/60'}
                      transition-all duration-500
                    `}>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-2.5 bg-gold/80 rounded-full" />
                      <motion.div
                        animate={glowIntensity ? { 
                          scale: [1, 1.3, 1],
                          boxShadow: ['0 0 0px hsl(var(--gold))', '0 0 25px hsl(var(--gold))', '0 0 0px hsl(var(--gold))']
                        } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-8 h-6 bg-gold rounded flex items-center justify-center"
                      >
                        <Briefcase className="w-4 h-4 text-black" />
                      </motion.div>
                      {glowIntensity && (
                        <>
                          <motion.div
                            animate={{ y: [-20, -40], opacity: [1, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute top-2 left-3"
                          >
                            <Sparkles className="w-3 h-3 text-gold" />
                          </motion.div>
                          <motion.div
                            animate={{ y: [-20, -40], opacity: [1, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                            className="absolute top-2 right-3"
                          >
                            <Sparkles className="w-3 h-3 text-gold" />
                          </motion.div>
                        </>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  // Gold coins pile for normal rounds
                  <motion.div
                    animate={{
                      y: glowIntensity ? [-8, 8, -8] : [-4, 4, -4],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="relative"
                  >
                    {glowIntensity && (
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 w-28 h-28 bg-gold/40 rounded-full blur-xl"
                      />
                    )}
                    <div className={`
                      w-28 h-28 rounded-full bg-gradient-to-br from-gold/30 via-amber-600/20 to-gold/30
                      flex items-center justify-center relative
                      ${glowIntensity ? 'shadow-[0_0_40px_hsl(var(--gold)/0.6)]' : 'shadow-[0_0_20px_hsl(var(--gold)/0.3)]'}
                      transition-all duration-500 border-2 border-gold/50
                    `}>
                      <motion.div
                        animate={glowIntensity ? { rotate: [0, 360] } : {}}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      >
                        <Coins className="w-14 h-14 text-gold" />
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Value Display */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-4 rounded-xl border bg-gold/10 border-gold/40"
              >
                <p className="text-sm text-muted-foreground mb-1">
                  {isAllIn ? 'Pega ou Larga?' : 'Desistência Honrosa'}
                </p>
                {hasExactValue ? (
                  <>
                    <p className="font-orbitron text-3xl text-gold font-bold">
                      {totalBluffCoins!.toLocaleString('pt-BR')} BC
                    </p>
                    <p className="text-xs text-gold/70 mt-1">
                      Seu prêmio acumulado até agora
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-orbitron text-xl text-gold font-bold">
                      Prêmio Acumulado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aceite e saia com o que conquistou
                    </p>
                  </>
                )}
              </motion.div>

              {/* Speech Display */}
              <AnimatePresence>
                {(currentPhrase || isLoading) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border rounded-lg p-4 bg-black/60 border-gold/40"
                  >
                    <div className="flex items-start gap-3">
                      <motion.div
                        animate={{ scale: isLoading ? [1, 1.2, 1] : [1, 1.1, 1] }}
                        transition={{ duration: isLoading ? 0.8 : 0.5, repeat: Infinity }}
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 flex-shrink-0 mt-1 text-gold animate-spin" />
                        ) : (
                          <Volume2 className="w-5 h-5 flex-shrink-0 mt-1 text-gold" />
                        )}
                      </motion.div>
                      <p className="text-sm text-foreground italic leading-relaxed">
                        {isLoading ? 'Preparando mensagem do Hórus...' : `"${currentPhrase}"`}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="space-y-3">
                {/* Loading state */}
                {isLoading && (
                  <div className="text-center py-2">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-sm text-muted-foreground"
                    >
                      Carregando áudio...
                    </motion.div>
                  </div>
                )}

                {/* Listening state */}
                {isListening && !isLoading && !showChoices && (
                  <div className="text-center py-2">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-sm text-gold"
                    >
                      <Volume2 className="w-4 h-4 inline-block mr-2 animate-pulse" />
                      Ouvindo o Hórus...
                    </motion.div>
                  </div>
                )}

                {/* Choice buttons */}
                {showChoices && !isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 gap-3"
                  >
                    {/* Accept button - Big, Gold, Pulsating */}
                    <motion.div
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <GoldButton
                        onClick={onAcceptBribe}
                        className="w-full h-14 text-lg bg-gradient-to-r from-gold/30 via-amber-500/30 to-gold/30 border-gold hover:border-gold/80"
                        size="lg"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        {acceptLabel}
                      </GoldButton>
                    </motion.div>

                    {/* Reject button - Red, Dangerous */}
                    <GoldButton
                      variant="outline"
                      onClick={onRejectBribe}
                      className="w-full h-12 border-destructive/60 hover:bg-destructive/20 text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {rejectLabel}
                    </GoldButton>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
