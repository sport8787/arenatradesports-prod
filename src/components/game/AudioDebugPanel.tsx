import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Database, Zap, X, Bug } from 'lucide-react';
import { getAudioCacheStats } from '@/services/audioCacheService';

interface AudioStats {
  cacheHits: number;
  cacheMisses: number;
  sessionRequests: number;
  memoryCacheSize: number;
}

export function AudioDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<AudioStats>({
    cacheHits: 0,
    cacheMisses: 0,
    sessionRequests: 0,
    memoryCacheSize: 0,
  });

  useEffect(() => {
    // Update stats every 500ms when panel is open
    const interval = setInterval(() => {
      const currentStats = getAudioCacheStats();
      setStats(currentStats);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const totalRequests = stats.cacheHits + stats.cacheMisses;
  const hitRate = totalRequests > 0 ? ((stats.cacheHits / totalRequests) * 100).toFixed(1) : '0.0';
  const estimatedSavings = stats.cacheHits * 50; // ~50 chars average per request

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-accent transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Audio Debug Panel"
      >
        <Bug className="w-5 h-5 text-muted-foreground" />
      </motion.button>

      {/* Debug Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 z-50 w-72 rounded-lg bg-background/95 backdrop-blur-md border border-border shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Audio Cache Debug</span>
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
              {/* Hit Rate Gauge */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Taxa de Cache</span>
                  <span className="font-mono font-bold text-primary">{hitRate}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${hitRate}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Cache Hits */}
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">Cache Hits</span>
                  </div>
                  <span className="text-xl font-bold text-green-400 font-mono">
                    {stats.cacheHits}
                  </span>
                </div>

                {/* API Calls */}
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3 h-3 text-red-500" />
                    <span className="text-xs text-red-500">API Calls</span>
                  </div>
                  <span className="text-xl font-bold text-red-400 font-mono">
                    {stats.cacheMisses}
                  </span>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Requests</span>
                  <span className="font-mono">{totalRequests}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Memory Cache</span>
                  <span className="font-mono">{stats.memoryCacheSize} items</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Session Dedup</span>
                  <span className="font-mono">{stats.sessionRequests} unique</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Est. Chars Saved</span>
                  <span className="font-mono text-green-400">~{estimatedSavings.toLocaleString()}</span>
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
