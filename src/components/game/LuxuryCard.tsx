import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LuxuryCardProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export default function LuxuryCard({ children, className, animate = true }: LuxuryCardProps) {
  const Component = animate ? motion.div : 'div';
  
  const animationProps = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
  } : {};

  return (
    <Component
      className={cn('luxury-card p-6', className)}
      {...animationProps}
    >
      {children}
    </Component>
  );
}
