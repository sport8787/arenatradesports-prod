import { motion, AnimatePresence } from 'framer-motion';
import { Bot, AlertTriangle, TrendingUp } from 'lucide-react';
import { Question } from '@/types/game';
import { useEffect, useState } from 'react';

interface MycroftPanelProps {
  question: Question;
  variant: 'bluff' | 'analytics';
  isVisible: boolean;
  onClose?: () => void;
}

export default function MycroftPanel({ question, variant, isVisible, onClose }: MycroftPanelProps) {
  const [riskProgress, setRiskProgress] = useState(0);

  useEffect(() => {
    if (isVisible && variant === 'analytics' && question.mycroft_risk_level) {
      const timer = setTimeout(() => {
        setRiskProgress(question.mycroft_risk_level || 0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, variant, question.mycroft_risk_level]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: variant === 'bluff' ? 50 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: variant === 'bluff' ? 50 : -20 }}
          transition={{ type: 'spring', damping: 20 }}
          className={variant === 'bluff' ? 'fixed inset-0 z-50 flex items-center justify-center p-4' : 'w-full'}
        >
          {variant === 'bluff' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={onClose}
            />
          )}

          <motion.div
            className={`
              hud-panel scanlines relative
              ${variant === 'bluff' ? 'max-w-lg w-full' : 'w-full'}
            `}
            layout
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-mycroft-green/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-mycroft-green" />
              </div>
              <div>
                <h3 className="mycroft-text text-lg font-bold">
                  {variant === 'bluff' ? 'MYCROFT BLUFF' : 'MYCROFT ANALYTICS'}
                </h3>
                <p className="text-xs text-mycroft-cyan/70 uppercase tracking-wider">
                  {variant === 'bluff' ? 'Sugestão de Mentira' : 'Análise de Risco'}
                </p>
              </div>
            </div>

            {variant === 'bluff' ? (
              <>
                {/* Bluff Suggestion */}
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-1" />
                    <p className="text-foreground/90 leading-relaxed">
                      {question.mycroft_bluff_suggestion}
                    </p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="w-full py-3 rounded-lg bg-mycroft-green/20 border border-mycroft-green/50 text-mycroft-green font-orbitron font-bold uppercase tracking-wider hover:bg-mycroft-green/30 transition-colors"
                  >
                    Entendido
                  </motion.button>
                </div>
              </>
            ) : (
              <>
                {/* Analytics View */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-mycroft-cyan" />
                    <span className="text-sm text-mycroft-cyan/80">Probabilidade de Blefe</span>
                  </div>

                  <div className="risk-bar">
                    <motion.div
                      className="risk-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${riskProgress}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Baixo Risco</span>
                    <span className="font-orbitron text-mycroft-green font-bold">{riskProgress}%</span>
                    <span className="text-muted-foreground">Alto Risco</span>
                  </div>

                  <p className="text-sm text-foreground/80 italic">
                    "{question.mycroft_risk_analysis}"
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
