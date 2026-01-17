import { motion, AnimatePresence } from 'framer-motion';
import cenario1 from '@/assets/cenario-1.png';
import cenario2 from '@/assets/cenario-2.png';
import cenario3 from '@/assets/cenario-3.png';

interface RoundBackgroundProps {
  round: number;
  className?: string;
}

export function getScenarioForRound(round: number): { image: string; name: string } {
  if (round >= 11) {
    return { image: cenario3, name: 'O Grande Final' };
  } else if (round >= 6) {
    return { image: cenario2, name: 'A Pressão' };
  } else {
    return { image: cenario1, name: 'Backstage VIP' };
  }
}

export default function RoundBackground({ round, className = '' }: RoundBackgroundProps) {
  const scenario = getScenarioForRound(round);
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={scenario.name}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        className={`fixed inset-0 z-0 ${className}`}
      >
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${scenario.image})` }}
        />
        
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background/80" />
        
        {/* Vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_hsl(var(--background))_100%)] opacity-50" />
      </motion.div>
    </AnimatePresence>
  );
}
