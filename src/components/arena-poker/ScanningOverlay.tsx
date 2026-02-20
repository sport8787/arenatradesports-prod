import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Eye, Brain } from 'lucide-react';

interface ScanningOverlayProps {
  isScanning: boolean;
  phase: 'mycroft' | 'horus' | 'complete';
}

const ScanningOverlay = ({ isScanning, phase }: ScanningOverlayProps) => (
  <AnimatePresence>
    {isScanning && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center"
      >
        {/* Waveform background */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute left-0 right-0 h-px"
              style={{ top: `${20 + i * 8}%` }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{
                scaleX: [0, 1, 0.3, 0.8, 0],
                opacity: [0, 0.4, 0.2, 0.3, 0],
              }}
              transition={{
                duration: 3,
                delay: i * 0.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div
                className="h-full"
                style={{
                  background: phase === 'mycroft'
                    ? 'linear-gradient(90deg, transparent, hsl(var(--arena-cyan)), transparent)'
                    : 'linear-gradient(90deg, transparent, hsl(var(--arena-gold)), transparent)',
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Scanner ring */}
        <motion.div
          className="relative w-40 h-40 mb-8"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{
              borderTopColor: phase === 'mycroft' ? 'hsl(var(--arena-cyan))' : 'hsl(var(--arena-gold))',
              borderRightColor: phase === 'mycroft' ? 'hsl(var(--arena-cyan) / 0.3)' : 'hsl(var(--arena-gold) / 0.3)',
            }}
          />
          <div className="absolute inset-4 rounded-full border border-[hsl(0_0%_20%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            {phase === 'mycroft' ? (
              <Eye className="w-10 h-10 text-[hsl(var(--arena-cyan))]" />
            ) : phase === 'horus' ? (
              <Brain className="w-10 h-10 text-[hsl(var(--arena-gold))]" />
            ) : (
              <Activity className="w-10 h-10 text-[hsl(var(--arena-gold))]" />
            )}
          </div>
        </motion.div>

        <motion.p
          key={phase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-sm uppercase tracking-[0.3em]"
          style={{
            color: phase === 'mycroft' ? 'hsl(var(--arena-cyan))' : 'hsl(var(--arena-gold))',
          }}
        >
          {phase === 'mycroft' && '⟁ Mycroft analisando métricas técnicas...'}
          {phase === 'horus' && '𓂀 Hórus processando estratégia...'}
          {phase === 'complete' && '✓ Análise completa'}
        </motion.p>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-[hsl(0_0%_15%)] rounded-full mt-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: phase === 'mycroft'
                ? 'hsl(var(--arena-cyan))'
                : 'hsl(var(--arena-gold))',
            }}
            initial={{ width: '0%' }}
            animate={{ width: phase === 'complete' ? '100%' : '60%' }}
            transition={{ duration: 2 }}
          />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ScanningOverlay;
