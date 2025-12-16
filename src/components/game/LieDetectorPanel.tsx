import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Loader2, Eye, Zap, UserSearch, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Question } from '@/types/game';
import { BluffCoinCost } from './BluffCoinDisplay';

interface LieDetectorPanelProps {
  question: Question;
  isVisible: boolean;
  onClose: () => void;
  onActivate: () => void;
  onPlayScanner?: () => void;
  cost: number;
  canAfford: boolean;
  hasUsed: boolean;
}

export default function LieDetectorPanel({
  question,
  isVisible,
  onClose,
  onActivate,
  onPlayScanner,
  cost,
  canAfford,
  hasUsed,
}: LieDetectorPanelProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWrongOptions = () => {
    const allOptions = [
      { key: 'A', value: question.option_a },
      { key: 'B', value: question.option_b },
      { key: 'C', value: question.option_c },
      { key: 'D', value: question.option_d },
    ];
    return allOptions
      .filter(opt => opt.key !== question.correct_option)
      .map(opt => opt.value);
  };

  const activateDetector = async () => {
    if (!canAfford || hasUsed) return;

    onActivate(); // Deduct coins
    setIsLoading(true);
    setIsScanning(true);
    setError(null);
    setAnalysis(null);

    // Play scanner sound
    onPlayScanner?.();

    // Scanning animation delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mycroft-ai', {
        body: {
          questionText: question.question_text,
          wrongOptions: getWrongOptions(),
          type: 'detector',
        },
      });

      if (fnError) throw new Error(fnError.message);

      if (data?.analysis) {
        setAnalysis(data.analysis);
      } else {
        throw new Error('No analysis received');
      }
    } catch (err) {
      console.error('Error activating detector:', err);
      setError('Falha na análise comportamental. Tente novamente.');
    } finally {
      setIsLoading(false);
      setIsScanning(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="relative max-w-md w-full"
          >
            {/* Scanner Frame */}
            <div className="relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-2 border-cyan-500/50 rounded-xl overflow-hidden">
              {/* Scanning Line Animation */}
              {isScanning && (
                <motion.div
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent z-10"
                  initial={{ top: 0 }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Corner Brackets */}
              <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-cyan-400" />
              <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-cyan-400" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-cyan-400" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-cyan-400" />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
                    <UserSearch className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-orbitron text-lg font-bold text-cyan-400 uppercase tracking-wider">
                      Analista FBI
                    </h3>
                    <p className="text-xs text-cyan-300/60 uppercase tracking-wider">
                      Behavioral Analysis Unit
                    </p>
                  </div>
                </div>

                {/* Content */}
                {!analysis && !isLoading && !hasUsed && (
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Ative o Analista para receber uma <span className="text-cyan-400 font-bold">eliminação</span> de resposta incorreta e uma <span className="text-amber-400 font-bold">dica de pressão</span> psicológica.
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: canAfford ? 1.02 : 1 }}
                      whileTap={{ scale: canAfford ? 0.98 : 1 }}
                      onClick={activateDetector}
                      disabled={!canAfford}
                      className={`w-full py-4 rounded-lg font-orbitron font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all ${
                        canAfford
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Zap className="w-5 h-5" />
                      <span>Ativar Analista</span>
                      <BluffCoinCost amount={cost} className="text-sm" />
                    </motion.button>

                    {!canAfford && (
                      <p className="text-center text-xs text-destructive">
                        Moedas insuficientes
                      </p>
                    )}
                  </div>
                )}

                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <div className="relative">
                      <ScanLine className="w-16 h-16 text-cyan-400 animate-pulse" />
                      <motion.div
                        className="absolute inset-0 border-2 border-cyan-400 rounded-full"
                        animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    </div>
                    <p className="text-cyan-400 font-orbitron text-sm animate-pulse">
                      ANALISANDO COMPORTAMENTO...
                    </p>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-8 bg-cyan-500/50 rounded"
                          animate={{ height: ['32px', '16px', '32px'] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 text-cyan-400">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="text-sm font-orbitron uppercase tracking-wider">
                        Análise Comportamental
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/50 to-cyan-900/30 rounded-lg p-4 border border-cyan-500/30">
                      <p className="text-foreground leading-relaxed whitespace-pre-line">
                        {analysis}
                      </p>
                    </div>

                    <p className="text-xs text-amber-400/70 text-center italic">
                      "A verdade está nos detalhes que eles tentam esconder."
                    </p>
                  </motion.div>
                )}

                {error && (
                  <div className="text-center py-4">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                {hasUsed && !analysis && !isLoading && (
                  <div className="text-center py-4">
                    <p className="text-slate-400 text-sm">
                      Analista já consultado nesta rodada.
                    </p>
                  </div>
                )}

                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="w-full mt-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 font-orbitron text-sm uppercase tracking-wider hover:bg-slate-700/50 transition-colors"
                >
                  Fechar
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
