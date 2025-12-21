import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Database, Zap, X, DollarSign, Shield, AlertTriangle } from 'lucide-react';
import { getAudioCacheStats } from '@/services/audioCacheService';
import { getSfxStats } from '@/hooks/useSoundEffects';

interface AudioStats {
  cacheHits: number;
  cacheMisses: number;
  blockedDuplicates: number;
  estimatedCreditsSaved: number;
  sessionRequests: number;
  memoryCacheSize: number;
}

interface SfxStats {
  sfxCacheHits: number;
  sfxApiCalls: number;
  sfxErrors: number;
  sfxCacheSize: number;
  lastSfxEvent: { type: string; source: 'cache' | 'api' | 'error'; ts: number } | null;
}

export function AudioDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [ttsStats, setTtsStats] = useState<AudioStats>({
    cacheHits: 0,
    cacheMisses: 0,
    blockedDuplicates: 0,
    estimatedCreditsSaved: 0,
    sessionRequests: 0,
    memoryCacheSize: 0,
  });
  const [sfxStats, setSfxStats] = useState<SfxStats>({
    sfxCacheHits: 0,
    sfxApiCalls: 0,
    sfxErrors: 0,
    sfxCacheSize: 0,
    lastSfxEvent: null,
  });

  const [flashPaidCall, setFlashPaidCall] = useState(false);
  const prevPaidRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTts = getAudioCacheStats();
      const currentSfx = getSfxStats();

      const totalPaid = currentTts.cacheMisses + currentSfx.sfxApiCalls;
      if (totalPaid > prevPaidRef.current) {
        setFlashPaidCall(true);
        setTimeout(() => setFlashPaidCall(false), 1000);
      }
      prevPaidRef.current = totalPaid;

      setTtsStats(currentTts);
      setSfxStats(currentSfx);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const ttsTotal = ttsStats.cacheHits + ttsStats.cacheMisses;
  const ttsHitRate = ttsTotal > 0 ? ((ttsStats.cacheHits / ttsTotal) * 100).toFixed(1) : '100';

  const totalPaidCalls = ttsStats.cacheMisses + sfxStats.sfxApiCalls;
  const hasPaidCalls = totalPaidCalls > 0;

  return (
    <>
      {/* Toggle Button with Mini Stats */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full backdrop-blur-sm border shadow-lg transition-all ${
          flashPaidCall
            ? 'bg-red-500/30 border-red-500 animate-pulse'
            : hasPaidCalls
              ? 'bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30'
              : 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Monitor de créditos ElevenLabs (TTS + SFX)"
      >
        <div className="flex items-center gap-2">
          {hasPaidCalls ? (
            <DollarSign className={`w-5 h-5 ${flashPaidCall ? 'text-red-400' : 'text-orange-400'}`} />
          ) : (
            <Shield className="w-5 h-5 text-green-400" />
          )}

          {!isOpen && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-muted-foreground">TTS</span>
              <span className="text-green-400">{ttsStats.cacheHits}</span>
              <span className="text-muted-foreground">/</span>
              <span className={ttsStats.cacheMisses > 0 ? 'text-red-400' : 'text-muted-foreground'}>{ttsStats.cacheMisses}</span>

              <span className="text-muted-foreground">SFX</span>
              <span className="text-green-400">{sfxStats.sfxCacheHits}</span>
              <span className="text-muted-foreground">/</span>
              <span className={sfxStats.sfxApiCalls > 0 ? 'text-red-400' : 'text-muted-foreground'}>{sfxStats.sfxApiCalls}</span>
            </div>
          )}
        </div>
      </motion.button>

      {/* Debug Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 z-50 w-[22rem] rounded-lg bg-background/95 backdrop-blur-md border border-border shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-border ${
              hasPaidCalls ? 'bg-orange-500/10' : 'bg-green-500/10'
            }`}
            >
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${hasPaidCalls ? 'text-orange-400' : 'text-green-400'}`} />
                <span className="font-semibold text-sm">Monitor ElevenLabs</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-accent transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Paid calls alert */}
              {hasPaidCalls && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-400">Consumo detectado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalPaidCalls} chamada(s) pagas nesta sessão (TTS: {ttsStats.cacheMisses}, SFX: {sfxStats.sfxApiCalls}).
                    </p>
                  </div>
                </motion.div>
              )}

              {!hasPaidCalls && (ttsTotal > 0 || sfxStats.sfxCacheHits > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3"
                >
                  <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Zero custo até agora</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nenhuma chamada paga (API) foi feita nesta sessão.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* TTS section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">TTS (vozes)</span>
                  <span className="text-xs font-mono">Cache hit: {ttsHitRate}%</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-400">Cache</span>
                    </div>
                    <span className="text-2xl font-bold text-green-400 font-mono">{ttsStats.cacheHits}</span>
                  </div>
                  <div className={`p-3 rounded-lg border ${
                    ttsStats.cacheMisses > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-muted/30 border-border'
                  }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-3 h-3 ${ttsStats.cacheMisses > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <span className={`text-xs ${ttsStats.cacheMisses > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>API</span>
                    </div>
                    <span className={`text-2xl font-bold font-mono ${ttsStats.cacheMisses > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{ttsStats.cacheMisses}</span>
                  </div>
                </div>
              </div>

              {/* SFX section */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">SFX (efeitos sonoros)</span>
                  <span className="text-xs font-mono">Cache: {sfxStats.sfxCacheSize}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-400">Cache</span>
                    </div>
                    <span className="text-2xl font-bold text-green-400 font-mono">{sfxStats.sfxCacheHits}</span>
                  </div>
                  <div className={`p-3 rounded-lg border ${
                    sfxStats.sfxApiCalls > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-muted/30 border-border'
                  }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-3 h-3 ${sfxStats.sfxApiCalls > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <span className={`text-xs ${sfxStats.sfxApiCalls > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>API</span>
                    </div>
                    <span className={`text-2xl font-bold font-mono ${sfxStats.sfxApiCalls > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{sfxStats.sfxApiCalls}</span>
                  </div>
                </div>

                {sfxStats.lastSfxEvent && (
                  <div className="text-xs text-muted-foreground">
                    Último SFX: <span className="font-mono">{sfxStats.lastSfxEvent.type}</span> ({sfxStats.lastSfxEvent.source})
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-green-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs text-muted-foreground">Atualizando em tempo real</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
