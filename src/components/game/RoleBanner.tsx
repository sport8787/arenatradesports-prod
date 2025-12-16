import { motion } from 'framer-motion';
import { Crown, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleBannerProps {
  isHost: boolean;
}

export default function RoleBanner({ isHost }: RoleBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-lg px-4 py-3 mb-4',
        isHost
          ? 'bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border border-primary/40'
          : 'bg-gradient-to-r from-mycroft-cyan/15 via-mycroft-green/10 to-mycroft-cyan/15 border border-mycroft-cyan/30'
      )}
    >
      {/* Glow effect */}
      <div
        className={cn(
          'absolute inset-0 opacity-30',
          isHost
            ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent'
            : 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-mycroft-cyan/30 via-transparent to-transparent'
        )}
      />

      <div className="relative flex items-center justify-center gap-3">
        {isHost ? (
          <>
            <Crown className="w-5 h-5 text-primary" />
            <span className="font-orbitron text-sm uppercase tracking-widest text-primary">
              Você é o HOST
            </span>
            <Crown className="w-5 h-5 text-primary" />
          </>
        ) : (
          <>
            <Eye className="w-5 h-5 text-mycroft-cyan" />
            <span className="font-orbitron text-sm uppercase tracking-widest text-mycroft-cyan">
              Você é JÚRI
            </span>
            <Eye className="w-5 h-5 text-mycroft-cyan" />
          </>
        )}
      </div>

      {/* Animated border glow for host */}
      {isHost && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-primary/50"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}
    </motion.div>
  );
}
