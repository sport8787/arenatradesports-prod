import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Loader2, Eye, Zap, UserSearch, AlertTriangle, Brain, AudioWaveform, Volume2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Question } from '@/types/game';
import { BluffCoinCost } from './BluffCoinDisplay';

// Animated Waveform Component
const AnimatedWaveform = () => {
  return (
    <div className="flex items-center justify-center gap-0.5 h-16">
      {[...Array(24)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-gradient-to-t from-cyan-500 to-amber-400 rounded-full"
          animate={{
            height: [8, 20 + Math.random() * 40, 8],
          }}
          transition={{
            duration: 0.4 + Math.random() * 0.3,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  );
};

interface LieDetectorPanelProps {
  question: Question;
  isVisible: boolean;
  onClose: () => void;
  onActivate: () => void;
  onPlayScanner?: () => void;
  onPlayDataBeep?: () => void;
  onPlayTyping?: () => void;
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
  onPlayDataBeep,
  onPlayTyping,
  cost,
  canAfford,
  hasUsed,
}: LieDetectorPanelProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Play sounds during loading animation
  useEffect(() => {
    if (isLoading) {
      // Play initial typing sound
      onPlayTyping?.();
      
      // Set up interval for beep sounds during profile building
      let beepCount = 0;
      soundIntervalRef.current = setInterval(() => {
        beepCount++;
        if (beepCount <= 4) {
          onPlayDataBeep?.();
        }
        if (beepCount === 2) {
          onPlayTyping?.();
        }
      }, 400);
    } else {
      // Clear interval when loading stops
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    }

    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }
    };
  }, [isLoading, onPlayDataBeep, onPlayTyping]);

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
                    <AudioWaveform className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-orbitron text-lg font-bold text-cyan-400 uppercase tracking-wider">
                      Perito Forense
                    </h3>
                    <p className="text-xs text-cyan-300/60 uppercase tracking-wider">
                      Análise Vocal & Linguística
                    </p>
                  </div>
                </div>

                {/* Content */}
                {!analysis && !isLoading && !hasUsed && (
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Ative o Perito para receber uma <span className="text-cyan-400 font-bold">armadilha lógica</span> (eliminação de resposta) e um <span className="text-amber-400 font-bold">alerta forense</span> sobre o áudio.
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
                      <Volume2 className="w-5 h-5" />
                      <span>Analisar Áudio</span>
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
                  <div className="space-y-4">
                    {/* Profile Header */}
                    <div className="flex items-center justify-between">
                      <p className="text-cyan-400 font-orbitron text-xs animate-pulse uppercase tracking-wider">
                        Analisando Padrões Vocais...
                      </p>
                      <motion.div
                        className="flex gap-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 h-1.5 bg-cyan-400 rounded-full"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                          />
                        ))}
                      </motion.div>
                    </div>

                    {/* Waveform Animation */}
                    <div className="relative py-4 bg-slate-800/30 rounded-lg border border-cyan-500/20">
                      <AnimatedWaveform />
                      <motion.div
                        className="absolute bottom-2 left-1/2 -translate-x-1/2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Volume2 className="w-5 h-5 text-amber-400" />
                      </motion.div>
                    </div>

                    {/* Voice Analysis Data */}
                    <div className="space-y-2">
                      {[
                        { label: 'Frequência Vocal', delay: 0.3 },
                        { label: 'Padrão de Pausa', delay: 0.6 },
                        { label: 'Nível de Tensão', delay: 0.9 },
                        { label: 'Coerência Lógica', delay: 1.2 },
                      ].map((item) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: item.delay }}
                          className="flex items-center gap-3"
                        >
                          <div className="w-28 text-xs text-slate-400 font-mono">
                            {item.label}
                          </div>
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-cyan-500 to-amber-500 rounded-full"
                              initial={{ width: '0%' }}
                              animate={{ width: `${60 + Math.random() * 35}%` }}
                              transition={{ delay: item.delay + 0.3, duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                          <motion.span
                            className="text-xs font-mono text-cyan-400 w-8"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: item.delay + 0.8 }}
                          >
                            {Math.floor(60 + Math.random() * 35)}%
                          </motion.span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Status Messages */}
                    <motion.div
                      className="text-center space-y-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5 }}
                    >
                      <p className="text-xs text-amber-400/80 font-mono">
                        &gt; Processando espectro de frequência...
                      </p>
                      <motion.p
                        className="text-xs text-cyan-400/80 font-mono"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2 }}
                      >
                        &gt; Detectando anomalias na fala...
                      </motion.p>
                    </motion.div>
                  </div>
                )}

                {analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 text-cyan-400">
                      <AudioWaveform className="w-5 h-5" />
                      <span className="text-sm font-orbitron uppercase tracking-wider">
                        Relatório Forense
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/50 to-cyan-900/30 rounded-lg p-4 border border-cyan-500/30">
                      <p className="text-foreground leading-relaxed whitespace-pre-line">
                        {analysis}
                      </p>
                    </div>

                    <p className="text-xs text-amber-400/70 text-center italic">
                      "A voz não mente. Escute com atenção."
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
                      Perito já consultado nesta rodada.
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
