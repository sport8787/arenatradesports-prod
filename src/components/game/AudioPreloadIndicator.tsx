// Visual indicator for audio preloading progress
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPreloadIndicatorProps {
  isLoading: boolean;
  isComplete: boolean;
  progressPercent: number;
  currentPhrase?: string;
  className?: string;
}

export default function AudioPreloadIndicator({
  isLoading,
  isComplete,
  progressPercent,
  currentPhrase,
  className,
}: AudioPreloadIndicatorProps) {
  if (!isLoading && !isComplete) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "bg-background/90 backdrop-blur-sm border border-border rounded-xl p-3 shadow-lg",
          "min-w-[200px] max-w-[300px]",
          className
        )}
      >
        <div className="flex items-center gap-3">
          {isComplete ? (
            <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-success" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <Volume2 className="w-4 h-4 text-primary" />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground">
                {isComplete ? 'Áudios prontos!' : 'Preparando áudios...'}
              </span>
              <span className="text-xs text-muted-foreground">
                {progressPercent}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  isComplete ? "bg-success" : "bg-primary"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Current phrase preview */}
            {isLoading && currentPhrase && (
              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                {currentPhrase}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
