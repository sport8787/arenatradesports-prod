import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, HelpCircle, Eye, Sparkles } from 'lucide-react';
import GoldButton from './GoldButton';

interface MysteryBriefcaseModalProps {
  show: boolean;
  onOpenBriefcase: () => void;
  onRefuse: () => void;
}

export default function MysteryBriefcaseModal({ show, onOpenBriefcase, onRefuse }: MysteryBriefcaseModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="w-full max-w-lg"
          >
            {/* Dramatic background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <motion.div
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.2, 1],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--gold)/0.3)_0%,_transparent_70%)]"
              />
            </div>

            <div className="relative bg-gradient-to-b from-secondary via-background to-secondary border-2 border-gold/50 rounded-2xl p-8 space-y-8 overflow-hidden">
              {/* Sparkle effects */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-4 right-4"
              >
                <Sparkles className="w-6 h-6 text-gold/50" />
              </motion.div>
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-4 left-4"
              >
                <Sparkles className="w-4 h-4 text-gold/30" />
              </motion.div>

              {/* Title */}
              <div className="text-center">
                <motion.h2
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="font-orbitron text-2xl md:text-3xl text-gold mb-2"
                >
                  A ÚLTIMA OFERTA
                </motion.h2>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="h-0.5 w-32 mx-auto bg-gradient-to-r from-transparent via-gold to-transparent"
                />
              </div>

              {/* Briefcase */}
              <motion.div
                initial={{ scale: 0, rotateY: -180 }}
                animate={{ scale: 1, rotateY: 0 }}
                transition={{ delay: 0.2, type: "spring", damping: 15 }}
                className="flex justify-center"
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      '0 0 20px hsl(var(--gold)/0.3)',
                      '0 0 60px hsl(var(--gold)/0.5)',
                      '0 0 20px hsl(var(--gold)/0.3)',
                    ],
                    y: [-5, 5, -5],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-40 h-28 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-lg border-4 border-gold/60 flex items-center justify-center relative overflow-hidden"
                >
                  {/* Briefcase details */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-3 bg-gold/80 rounded-full" />
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gold rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-background rounded-full" />
                  </div>
                  <Briefcase className="w-16 h-16 text-gold/70" />
                  <motion.div
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-to-t from-gold/10 to-transparent"
                  />
                  <HelpCircle className="absolute bottom-2 right-2 w-6 h-6 text-gold/50" />
                </motion.div>
              </motion.div>

              {/* Description */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center space-y-3"
              >
                <p className="text-foreground font-medium">
                  Você quer arriscar tudo pela pergunta de <span className="text-gold font-orbitron">1 Milhão</span>
                </p>
                <p className="text-muted-foreground text-sm">
                  (sem chance de blefe)
                </p>
                <p className="text-foreground">
                  ou aceitar o conteúdo <span className="text-gold">desconhecido</span> desta maleta?
                </p>
              </motion.div>

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="space-y-4"
              >
                <GoldButton
                  onClick={onOpenBriefcase}
                  className="w-full"
                  size="lg"
                >
                  <Briefcase className="w-5 h-5 mr-2" />
                  ABRIR A MALETA E PARAR
                </GoldButton>

                <GoldButton
                  variant="outline"
                  onClick={onRefuse}
                  className="w-full border-destructive/50 hover:bg-destructive/20"
                  size="lg"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  RECUSAR E VER A PERGUNTA
                </GoldButton>
              </motion.div>

              {/* Warning */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-xs text-center text-muted-foreground"
              >
                ⚠️ Na Rodada 15, errar a pergunta significa perder tudo (ou cair para o seguro).
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
