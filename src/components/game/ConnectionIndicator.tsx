import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionIndicatorProps {
  isConnected: boolean;
  isReconnecting: boolean;
  retryCount: number;
  onReconnect: () => void;
}

export default function ConnectionIndicator({
  isConnected,
  isReconnecting,
  retryCount,
  onReconnect,
}: ConnectionIndicatorProps) {
  // Only show when disconnected or reconnecting
  if (isConnected && !isReconnecting) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-destructive/90 backdrop-blur-sm text-destructive-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
          {isReconnecting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">
                Reconectando... ({retryCount}/10)
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">Conexão perdida</span>
              <button
                onClick={onReconnect}
                className="ml-2 bg-background/20 hover:bg-background/30 px-2 py-1 rounded text-xs font-medium transition-colors"
              >
                Reconectar
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
