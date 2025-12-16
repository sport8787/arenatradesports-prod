import { motion } from 'framer-motion';
import { Crown, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: 'host' | 'jury';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function RoleBadge({ role, size = 'md', showLabel = true }: RoleBadgeProps) {
  const sizes = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const isHost = role === 'host';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center rounded-full font-orbitron uppercase tracking-wider',
        sizes[size],
        isHost
          ? 'bg-gradient-to-r from-primary/30 to-primary/10 text-primary border border-primary/50 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
          : 'bg-gradient-to-r from-mycroft-cyan/20 to-mycroft-green/10 text-mycroft-cyan border border-mycroft-cyan/40'
      )}
    >
      {isHost ? (
        <Crown className={cn(iconSizes[size], 'text-primary')} />
      ) : (
        <Eye className={cn(iconSizes[size], 'text-mycroft-cyan')} />
      )}
      {showLabel && <span>{isHost ? 'HOST' : 'JÚRI'}</span>}
    </motion.div>
  );
}
