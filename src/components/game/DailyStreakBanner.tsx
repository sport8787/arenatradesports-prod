import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Gift, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { BC_REWARDS } from '@/services/bcRewardsService';

interface DailyStreakBannerProps {
  currentStreak: number;
  lastStreakDate: string | null;
  onClaimed: (bonus: number, newStreak: number) => void;
}

export default function DailyStreakBanner({ 
  currentStreak, 
  lastStreakDate, 
  onClaimed 
}: DailyStreakBannerProps) {
  const { profile } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const canClaim = lastStreakDate !== today;

  const calculateNextStreakDay = () => {
    if (!lastStreakDate) return 1;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (lastStreakDate === yesterdayStr) {
      return Math.min(currentStreak + 1, BC_REWARDS.MAX_DAILY_STREAK_DAYS);
    }
    return 1; // Reset streak
  };

  const nextStreakDay = calculateNextStreakDay();
  const potentialBonus = nextStreakDay * BC_REWARDS.DAILY_STREAK;

  const handleClaim = async () => {
    if (!profile || claiming) return;

    setClaiming(true);
    try {
      // Cast to unknown first to handle the RPC typing
      const { data, error } = await (supabase.rpc as any)('claim_daily_streak_bonus', {
        p_user_id: profile.user_id,
      });

      if (error) throw error;

      const bonusAmount = typeof data === 'number' ? data : 0;
      
      if (bonusAmount > 0) {
        toast({
          title: `🔥 Streak Dia ${nextStreakDay}!`,
          description: `+${bonusAmount} BC adicionados à sua carteira!`,
          duration: 4000,
        });
        onClaimed(bonusAmount, nextStreakDay);
      } else {
        toast({
          title: '✅ Já coletado',
          description: 'Você já coletou seu bônus de streak hoje!',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error claiming streak bonus:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível coletar o bônus de streak.',
        variant: 'destructive',
      });
    } finally {
      setClaiming(false);
    }
  };

  if (!canClaim || dismissed || !profile) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative overflow-hidden rounded-xl border border-orange-500/50 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors z-10"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="p-4 flex items-center gap-4">
          {/* Flame Icon */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex-shrink-0"
          >
            <div className="relative">
              <Flame className="w-10 h-10 text-orange-500" />
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
              >
                {nextStreakDay}
              </motion.span>
            </div>
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-orbitron font-bold text-orange-400 text-sm">
              STREAK DIÁRIO
            </h3>
            <p className="text-foreground/80 text-xs">
              Dia {nextStreakDay} de {BC_REWARDS.MAX_DAILY_STREAK_DAYS} • Ganhe <span className="text-gold font-bold">{potentialBonus} BC</span>
            </p>
          </div>

          {/* Claim Button */}
          <motion.button
            onClick={handleClaim}
            disabled={claiming}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="
              flex-shrink-0 px-4 py-2 rounded-lg
              bg-gradient-to-r from-orange-500 to-amber-500
              text-white font-bold text-sm
              hover:from-orange-400 hover:to-amber-400
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
              flex items-center gap-2
            "
          >
            {claiming ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <Gift className="w-4 h-4" />
                COLETAR
              </>
            )}
          </motion.button>
        </div>

        {/* Streak Progress */}
        <div className="px-4 pb-3 flex gap-1">
          {Array.from({ length: BC_REWARDS.MAX_DAILY_STREAK_DAYS }).map((_, i) => {
            const dayNum = i + 1;
            const isCompleted = dayNum <= currentStreak;
            const isCurrent = dayNum === nextStreakDay;
            
            return (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`
                  flex-1 h-2 rounded-full transition-colors
                  ${isCompleted 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500' 
                    : isCurrent 
                      ? 'bg-orange-500/50 animate-pulse' 
                      : 'bg-border/50'
                  }
                `}
              />
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
