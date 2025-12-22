import { motion, AnimatePresence } from 'framer-motion';
import { Bot, AlertTriangle, Shield, Activity, Clock, Mic, Loader2 } from 'lucide-react';
import { VerdictReport } from '@/hooks/useMycroftVerdict';
import { useAudioQueueStatus } from '@/hooks/useAudioQueueStatus';

interface MycroftVerdictPanelProps {
  verdict: VerdictReport | null;
  isVisible: boolean;
  isSpeaking: boolean;
  isGenerating?: boolean;
  roomStatus?: string; // Para verificar se está em 'discussion'
  onClose?: () => void;
}

const getRiskColor = (level: string) => {
  switch (level) {
    case 'CRITICAL': return 'text-red-500';
    case 'HIGH': return 'text-orange-500';
    case 'MEDIUM': return 'text-yellow-500';
    case 'LOW': return 'text-green-500';
    default: return 'text-blue-500';
  }
};

const getRiskBorderColor = (level: string) => {
  switch (level) {
    case 'CRITICAL': return 'border-red-500/50';
    case 'HIGH': return 'border-orange-500/50';
    case 'MEDIUM': return 'border-yellow-500/50';
    case 'LOW': return 'border-green-500/50';
    default: return 'border-cyan-500/50';
  }
};

const getRiskBgColor = (level: string) => {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500/10';
    case 'HIGH': return 'bg-orange-500/10';
    case 'MEDIUM': return 'bg-yellow-500/10';
    case 'LOW': return 'bg-green-500/10';
    default: return 'bg-cyan-500/10';
  }
};

export default function MycroftVerdictPanel({ verdict, isVisible, isSpeaking, isGenerating, roomStatus, onClose }: MycroftVerdictPanelProps) {
  const { isPlaying: isAudioPlaying } = useAudioQueueStatus();
  
  // Só mostra "Gerando Veredito" quando:
  // 1. isGenerating é true
  // 2. isVisible é true  
  // 3. NÃO há áudio tocando (fila vazia)
  // 4. Status da sala é 'discussion' (opcional, para mais segurança)
  const shouldShowLoading = isGenerating && isVisible && !isAudioPlaying;
  
  // Show loading state
  if (shouldShowLoading) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96
            bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50
            rounded-xl shadow-2xl overflow-hidden z-50"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/50">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              >
                <Bot className="w-5 h-5 text-cyan-400" />
              </motion.div>
              <div>
                <h3 className="font-bold text-cyan-400 text-sm">MYCROFT</h3>
                <p className="text-xs text-cyan-400/60">Sistema de Arbitragem</p>
              </div>
            </div>
          </div>

          {/* Loading Content */}
          <div className="px-4 py-8 flex flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl" />
              <Loader2 className="w-12 h-12 text-cyan-400 animate-spin relative z-10" />
            </motion.div>
            
            <div className="text-center space-y-2">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-cyan-300 font-mono text-sm"
              >
                Gerando Veredito...
              </motion.p>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 3, ease: 'easeInOut' }}
                className="h-1 bg-gradient-to-r from-cyan-500/50 via-cyan-400 to-cyan-500/50 rounded-full mx-auto max-w-[200px]"
              />
              <p className="text-xs text-slate-400">
                Analisando métricas comportamentais...
              </p>
            </div>
            
            {/* Scanning animation */}
            <div className="w-full grid grid-cols-3 gap-2 mt-2">
              {['Latência', 'Histórico', 'Fatos'].map((label, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }}
                  className="text-center py-2 bg-slate-800/50 rounded border border-slate-700/50"
                >
                  <p className="text-xs text-cyan-400/80">{label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }
  
  if (!isVisible || !verdict) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`
          fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96
          bg-slate-900/95 backdrop-blur-xl border ${getRiskBorderColor(verdict.riskLevel)}
          rounded-xl shadow-2xl overflow-hidden z-50
        `}
      >
        {/* Header */}
        <div className={`px-4 py-3 ${getRiskBgColor(verdict.riskLevel)} border-b ${getRiskBorderColor(verdict.riskLevel)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={isSpeaking ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Bot className="w-5 h-5 text-cyan-400" />
              </motion.div>
              <div>
                <h3 className="font-bold text-cyan-400 text-sm">MYCROFT</h3>
                <p className="text-xs text-cyan-400/60">Sistema de Arbitragem</p>
              </div>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-bold ${getRiskColor(verdict.riskLevel)} ${getRiskBgColor(verdict.riskLevel)}`}>
              RISCO: {verdict.riskLevel}
            </div>
          </div>
        </div>

        {/* Protocol Code */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="px-4 py-3 border-b border-slate-700/50"
        >
          <p className="text-cyan-300 font-mono text-sm">
            {verdict.protocolCode}
          </p>
        </motion.div>

        {/* Metrics Grid */}
        <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-slate-700/50">
          <div className="text-center">
            <Clock className="w-4 h-4 mx-auto text-slate-400 mb-1" />
            <p className="text-xs text-slate-400">Latência</p>
            <p className="text-sm font-bold text-white">{formatTime(verdict.metrics.responseTimeMs)}</p>
          </div>
          <div className="text-center">
            <Shield className="w-4 h-4 mx-auto text-green-400 mb-1" />
            <p className="text-xs text-slate-400">Blefes OK</p>
            <p className="text-sm font-bold text-green-400">{verdict.metrics.successfulBluffs}</p>
          </div>
          <div className="text-center">
            <AlertTriangle className="w-4 h-4 mx-auto text-red-400 mb-1" />
            <p className="text-xs text-slate-400">Flagras</p>
            <p className="text-sm font-bold text-red-400">{verdict.metrics.caughtBluffs}</p>
          </div>
        </div>

        {/* Analysis Points */}
        <div className="px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
          {verdict.analysis.map((point, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.15 }}
              className="flex items-start gap-2"
            >
              <Activity className="w-3 h-3 text-cyan-400 mt-1 flex-shrink-0" />
              <p className="text-xs text-slate-300 leading-relaxed">{point}</p>
            </motion.div>
          ))}
        </div>

        {/* Recommendation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className={`px-4 py-3 ${getRiskBgColor(verdict.riskLevel)}`}
        >
          <p className={`text-sm font-medium ${getRiskColor(verdict.riskLevel)}`}>
            {verdict.recommendation}
          </p>
        </motion.div>

        {/* Speaking Indicator */}
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-2 bg-cyan-500/10 border-t border-cyan-500/30 flex items-center gap-2"
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
            >
              <Mic className="w-4 h-4 text-cyan-400" />
            </motion.div>
            <span className="text-xs text-cyan-400">Transmitindo análise...</span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}