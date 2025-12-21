import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Database, Zap, X, DollarSign, Shield, AlertTriangle } from 'lucide-react';
import { getAudioCacheStats } from '@/services/audioCacheService';

interface AudioStats {
  cacheHits: number;
  cacheMisses: number;
  blockedDuplicates: number;
  estimatedCreditsSaved: number;
  sessionRequests: number;
  memoryCacheSize: number;
}

export function AudioDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<AudioStats>({
    cacheHits: 0,
    cacheMisses: 0,
    blockedDuplicates: 0,
    estimatedCreditsSaved: 0,
    sessionRequests: 0,
    memoryCacheSize: 0,
  });
  const [flashApiCall, setFlashApiCall] = useState(false);
  const prevMissesRef = useRef(0);

  useEffect(() => {
    // Update stats every 500ms
    const interval = setInterval(() => {
      const currentStats = getAudioCacheStats();
      
      // Flash when new API call is detected
      if (currentStats.cacheMisses > prevMissesRef.current) {
        setFlashApiCall(true);
        setTimeout(() => setFlashApiCall(false), 1000);
      }
      prevMissesRef.current = currentStats.cacheMisses;
      
      setStats(currentStats);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const totalRequests = stats.cacheHits + stats.cacheMisses;
  const hitRate = totalRequests > 0 ? ((stats.cacheHits / totalRequests) * 100).toFixed(1) : '100';
  const estimatedCost = (stats.cacheMisses * 50).toFixed(0); // Rough estimate: ~50 chars avg per call

  // Show mini indicator when closed if there are API calls
  const hasApiCalls = stats.cacheMisses > 0;

  return (
    <>
      {/* Toggle Button with Mini Stats */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full backdrop-blur-sm border shadow-lg transition-all ${
          flashApiCall 
            ? 'bg-red-500/30 border-red-500 animate-pulse' 
            : hasApiCalls 
              ? 'bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30' 
              : 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Monitor de Créditos ElevenLabs"
      >
        <div className="flex items-center gap-2">
          {hasApiCalls ? (
            <DollarSign className={`w-5 h-5 ${flashApiCall ? 'text-red-400' : 'text-orange-400'}`} />
          ) : (
            <Shield className="w-5 h-5 text-green-400" />
          )}
          {/* Mini counter when closed */}
          {!isOpen && (
            <div className="flex items-center gap-1 text-xs font-mono">
              <span className="text-green-400">{stats.cacheHits}</span>
              <span className="text-muted-foreground">/</span>
              <span className={hasApiCalls ? 'text-red-400' : 'text-muted-foreground'}>{stats.cacheMisses}</span>
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
            className="fixed bottom-20 right-4 z-50 w-80 rounded-lg bg-background/95 backdrop-blur-md border border-border shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-border ${
              hasApiCalls ? 'bg-orange-500/10' : 'bg-green-500/10'
            }`}>
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${hasApiCalls ? 'text-orange-400' : 'text-green-400'}`} />
                <span className="font-semibold text-sm">Monitor ElevenLabs</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Stats */}
            <div className="p-4 space-y-4">
              {/* Main Stats - Big Numbers */}
              <div className="grid grid-cols-2 gap-3">
                {/* Cache Hits (FREE) */}
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium text-green-400">CACHE (Grátis)</span>
                  </div>
                  <span className="text-3xl font-bold text-green-400 font-mono">
                    {stats.cacheHits}
                  </span>
                </div>

                {/* API Calls ($$) */}
                <div className={`p-4 rounded-lg border ${
                  stats.cacheMisses > 0 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-muted/30 border-border'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className={`w-4 h-4 ${stats.cacheMisses > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${stats.cacheMisses > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      API (Pago)
                    </span>
                  </div>
                  <span className={`text-3xl font-bold font-mono ${
                    stats.cacheMisses > 0 ? 'text-red-400' : 'text-muted-foreground'
                  }`}>
                    {stats.cacheMisses}
                  </span>
                </div>
              </div>

              {/* Hit Rate Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Taxa de Cache</span>
                  <span className={`font-mono font-bold ${
                    parseFloat(hitRate) >= 90 ? 'text-green-400' : 
                    parseFloat(hitRate) >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {hitRate}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      parseFloat(hitRate) >= 90 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 
                      parseFloat(hitRate) >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' : 
                      'bg-gradient-to-r from-red-500 to-rose-400'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${hitRate}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Cost Alert */}
              {stats.cacheMisses > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-400">Créditos Consumidos</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.cacheMisses} chamada(s) à API ElevenLabs foram feitas esta sessão.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* All good message */}
              {stats.cacheMisses === 0 && totalRequests > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3"
                >
                  <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Zero Custo!</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Todos os {totalRequests} áudios vieram do cache. Nenhum crédito consumido!
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Blocked Duplicates */}
              {stats.blockedDuplicates > 0 && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⛔</span>
                      <span className="text-xs text-purple-400">Duplicatas Bloqueadas</span>
                    </div>
                    <span className="text-lg font-bold text-purple-400 font-mono">
                      {stats.blockedDuplicates}
                    </span>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Memory Cache</span>
                  <span className="font-mono">{stats.memoryCacheSize} áudios</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">💸 Créditos Salvos</span>
                  <span className="font-mono text-green-400 font-bold">~{stats.estimatedCreditsSaved.toLocaleString()}</span>
                </div>
              </div>

              {/* Live Indicator */}
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