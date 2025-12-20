import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Sparkles, Volume2 } from 'lucide-react';
import GoldButton from './GoldButton';

interface HorusBribeOfferProps {
  isVisible: boolean;
  bribeAmount: number;
  onAcceptBribe: () => void;
  onRejectBribe: () => void;
  onListenProposal: () => void;
  isListening: boolean;
  currentPhrase: string | null;
}

export default function HorusBribeOffer({
  isVisible,
  bribeAmount,
  onAcceptBribe,
  onRejectBribe,
  onListenProposal,
  isListening,
  currentPhrase,
}: HorusBribeOfferProps) {
  const [showChoices, setShowChoices] = useState(false);
  const [briefcaseGlow, setBriefcaseGlow] = useState(false);

  // Start briefcase glow when listening
  useEffect(() => {
    if (isListening) {
      setBriefcaseGlow(true);
      // Show choices after speech starts
      const timer = setTimeout(() => setShowChoices(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setBriefcaseGlow(false);
    }
  }, [isListening]);

  // Reset state when visibility changes
  useEffect(() => {
    if (!isVisible) {
      setShowChoices(false);
      setBriefcaseGlow(false);
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
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
                opacity: briefcaseGlow ? [0.3, 0.8, 0.3] : 0.2,
                scale: briefcaseGlow ? [1, 1.1, 1] : 1,
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--gold)/0.6)_0%,_transparent_70%)] blur-xl"
            />

            <div className="relative bg-gradient-to-b from-gray-900 via-gray-900 to-black border-2 border-gold/50 rounded-2xl p-6 space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <motion.div
                  animate={{ 
                    scale: [1, 1.05, 1],
                    textShadow: briefcaseGlow 
                      ? ['0 0 10px hsl(var(--gold))', '0 0 30px hsl(var(--gold))', '0 0 10px hsl(var(--gold))']
                      : '0 0 10px hsl(var(--gold))'
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="font-orbitron text-2xl text-gold font-bold"
                >
                  ⚠️ SEU DESTINO JÁ ESTÁ SELADO! ⚠️
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  O Hórus tem uma proposta irrecusável...
                </p>
              </div>

              {/* Animated Briefcase */}
              <div className="flex justify-center py-6">
                <motion.div
                  animate={{
                    y: briefcaseGlow ? [-10, 10, -10] : [-5, 5, -5],
                    rotateY: briefcaseGlow ? [0, 15, 0, -15, 0] : 0,
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="relative"
                >
                  {/* Glow rings */}
                  {briefcaseGlow && (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 w-40 h-32 bg-gold/30 rounded-lg blur-xl"
                      />
                      <motion.div
                        animate={{ scale: [1.2, 1.8, 1.2], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        className="absolute inset-0 w-40 h-32 bg-gold/20 rounded-lg blur-2xl"
                      />
                    </>
                  )}

                  {/* Briefcase */}
                  <div className={`
                    w-40 h-32 bg-gradient-to-br from-gray-800 via-gray-900 to-black 
                    rounded-lg border-4 flex items-center justify-center relative
                    ${briefcaseGlow ? 'border-gold shadow-[0_0_40px_hsl(var(--gold)/0.6)]' : 'border-gold/60'}
                    transition-all duration-500
                  `}>
                    {/* Handle */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-3 bg-gold/80 rounded-full" />
                    
                    {/* Lock */}
                    <motion.div
                      animate={briefcaseGlow ? { 
                        scale: [1, 1.2, 1],
                        boxShadow: ['0 0 0px hsl(var(--gold))', '0 0 20px hsl(var(--gold))', '0 0 0px hsl(var(--gold))']
                      } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-8 h-6 bg-gold rounded flex items-center justify-center"
                    >
                      <Briefcase className="w-4 h-4 text-black" />
                    </motion.div>

                    {/* Sparkles when glowing */}
                    {briefcaseGlow && (
                      <>
                        <motion.div
                          animate={{ y: [-20, -40], opacity: [1, 0], x: [-10, -20] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute top-2 left-4"
                        >
                          <Sparkles className="w-4 h-4 text-gold" />
                        </motion.div>
                        <motion.div
                          animate={{ y: [-20, -40], opacity: [1, 0], x: [10, 20] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                          className="absolute top-2 right-4"
                        >
                          <Sparkles className="w-4 h-4 text-gold" />
                        </motion.div>
                      </>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Bribe Amount Display */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-4 bg-gold/10 border border-gold/30 rounded-xl"
              >
                <p className="text-sm text-muted-foreground mb-1">Valor do Suborno</p>
                <p className="font-orbitron text-3xl text-gold font-bold">
                  {bribeAmount.toLocaleString('pt-BR')} BC
                </p>
              </motion.div>

              {/* Speech Display */}
              <AnimatePresence>
                {currentPhrase && isListening && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-black/50 border border-gold/30 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        <Volume2 className="w-5 h-5 text-gold flex-shrink-0 mt-1" />
                      </motion.div>
                      <p className="text-sm text-foreground italic leading-relaxed">
                        "{currentPhrase}"
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="space-y-3">
                {!isListening && !showChoices && (
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <GoldButton
                      onClick={onListenProposal}
                      className="w-full"
                      size="lg"
                    >
                      <Volume2 className="w-5 h-5 mr-2" />
                      Ouvir Proposta do Hórus
                    </GoldButton>
                  </motion.div>
                )}

                {showChoices && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <GoldButton
                      onClick={onAcceptBribe}
                      className="bg-green-600/20 border-green-500/50 hover:bg-green-600/30"
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      Aceitar Suborno
                    </GoldButton>
                    <GoldButton
                      variant="outline"
                      onClick={onRejectBribe}
                      className="border-red-500/50 hover:bg-red-500/20"
                    >
                      Recusar e Jogar
                    </GoldButton>
                  </motion.div>
                )}

                {isListening && !showChoices && (
                  <div className="text-center py-2">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-sm text-muted-foreground"
                    >
                      Ouvindo proposta...
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
