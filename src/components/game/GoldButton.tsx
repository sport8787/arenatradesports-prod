import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GoldButtonProps {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

export default function GoldButton({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  children, 
  disabled,
  onClick,
  type = 'button'
}: GoldButtonProps) {
  const baseStyles = 'relative font-orbitron font-bold uppercase tracking-wider transition-all duration-300 rounded-lg';
  
  const variants = {
    primary: 'btn-gold',
    outline: 'bg-transparent border-2 border-primary text-primary hover:bg-primary/10',
    ghost: 'bg-transparent text-primary hover:bg-primary/10',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm',
    md: 'px-4 py-2 text-sm md:px-6 md:py-3 md:text-base',
    lg: 'px-5 py-2.5 text-sm md:px-8 md:py-4 md:text-lg',
  };

  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
