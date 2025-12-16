import { motion, AnimatePresence } from 'framer-motion';
import { Bot, AlertTriangle, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import { Question } from '@/types/game';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MycroftPanelProps {
  question: Question;
  variant: 'bluff' | 'analytics';
  isVisible: boolean;
  onClose?: () => void;
}

export default function MycroftPanel({ question, variant, isVisible, onClose }: MycroftPanelProps) {
  const [riskProgress, setRiskProgress] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible && variant === 'analytics') {
      generateAIAnalytics();
    }
  }, [isVisible, variant, question.id]);

  useEffect(() => {
    if (isVisible && variant === 'bluff') {
      generateAISuggestion();
    }
  }, [isVisible, variant, question.id]);

  const getCorrectAnswerText = () => {
    const optionMap: Record<string, string> = {
      'A': question.option_a,
      'B': question.option_b,
      'C': question.option_c,
      'D': question.option_d,
    };
    return optionMap[question.correct_option] || '';
  };

  const generateAISuggestion = async () => {
    setIsLoading(true);
    setError(null);
    setAiSuggestion(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mycroft-ai', {
        body: {
          questionText: question.question_text,
          correctAnswer: getCorrectAnswerText(),
          type: 'bluff',
        },
      });

      if (fnError) throw new Error(fnError.message);

      if (data?.suggestion) {
        setAiSuggestion(data.suggestion);
      } else {
        throw new Error('No suggestion received');
      }
    } catch (err) {
      console.error('Error generating AI suggestion:', err);
      setError('Erro ao gerar sugestão. Usando fallback...');
      setAiSuggestion(question.mycroft_bluff_suggestion || 'Confie na sua intuição e blefe com confiança!');
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    setAiAnalysis(null);
    setRiskProgress(0);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mycroft-ai', {
        body: {
          questionText: question.question_text,
          type: 'analytics',
        },
      });

      if (fnError) throw new Error(fnError.message);

      if (data?.riskLevel !== undefined) {
        setTimeout(() => setRiskProgress(data.riskLevel), 300);
        setAiAnalysis(data.analysis);
      } else {
        throw new Error('No analysis received');
      }
    } catch (err) {
      console.error('Error generating AI analytics:', err);
      setError('Erro ao gerar análise. Usando fallback...');
      setTimeout(() => setRiskProgress(question.mycroft_risk_level || 50), 300);
      setAiAnalysis(question.mycroft_risk_analysis || 'Análise indisponível');
    } finally {
      setIsLoading(false);
    }
  };

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
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="mycroft-text text-lg font-bold">
                    {variant === 'bluff' ? 'MYCROFT AI' : 'MYCROFT ANALYTICS'}
                  </h3>
                  <Sparkles className="w-4 h-4 text-mycroft-cyan animate-pulse" />
                </div>
                <p className="text-xs text-mycroft-cyan/70 uppercase tracking-wider">
                  {variant === 'bluff' ? 'Sugestão de Blefe (IA)' : 'Análise de Risco (IA)'}
                </p>
              </div>
            </div>

            {variant === 'bluff' ? (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Loader2 className="w-8 h-8 text-mycroft-green animate-spin" />
                    <p className="text-mycroft-cyan/80 text-sm font-orbitron">
                      Mycroft está pensando...
                    </p>
                  </div>
                ) : (
                  <>
                    {error && (
                      <p className="text-warning/70 text-xs mb-2">{error}</p>
                    )}
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-1" />
                      <p className="text-foreground/90 leading-relaxed">
                        {aiSuggestion}
                      </p>
                    </div>
                  </>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full py-3 rounded-lg bg-mycroft-green/20 border border-mycroft-green/50 text-mycroft-green font-orbitron font-bold uppercase tracking-wider hover:bg-mycroft-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Aguarde...' : 'Entendido'}
                </motion.button>
              </div>
            ) : (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <Loader2 className="w-6 h-6 text-mycroft-cyan animate-spin" />
                    <p className="text-mycroft-cyan/80 text-xs font-orbitron">
                      Analisando padrões...
                    </p>
                  </div>
                ) : (
                  <>
                    {error && (
                      <p className="text-warning/70 text-xs mb-2">{error}</p>
                    )}
                    
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
                      "{aiAnalysis || question.mycroft_risk_analysis}"
                    </p>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
