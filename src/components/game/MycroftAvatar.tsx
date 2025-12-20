import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

interface MycroftAvatarProps {
  isAnimating?: boolean;
  isSpeaking?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'minimal' | 'full';
}

// Audio visualization waveform component
export default function MycroftAvatar({ 
  isAnimating = false, 
  isSpeaking = false,
  size = 'md',
  variant = 'full'
}: MycroftAvatarProps) {
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(24).fill(0.3));
  const animationRef = useRef<number | null>(null);
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };
  
  const barWidth = {
    sm: 'w-0.5',
    md: 'w-1',
    lg: 'w-1.5'
  };

  // Animate waveform bars when speaking
  useEffect(() => {
    if (isSpeaking || isAnimating) {
      const animate = () => {
        setWaveformBars(prev => 
          prev.map(() => {
            // Create more dynamic wave patterns
            const base = 0.2 + Math.random() * 0.8;
            const pulse = Math.sin(Date.now() / 100) * 0.2;
            return Math.max(0.1, Math.min(1, base + pulse));
          })
        );
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      // Idle state - gentle pulse
      const idle = setInterval(() => {
        setWaveformBars(prev => 
          prev.map((_, i) => {
            const wave = Math.sin((Date.now() / 500) + i * 0.3) * 0.15 + 0.25;
            return wave;
          })
        );
      }, 100);
      
      return () => clearInterval(idle);
    }
  }, [isSpeaking, isAnimating]);

  if (variant === 'minimal') {
    return (
      <motion.div
        className={`${sizeClasses[size]} relative flex items-center justify-center`}
        animate={isSpeaking ? {
          scale: [1, 1.05, 1],
        } : {}}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        {/* Central core */}
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-mycroft-green"
          animate={{
            boxShadow: isSpeaking 
              ? ['0 0 10px hsl(var(--mycroft-green))', '0 0 30px hsl(var(--mycroft-green))', '0 0 10px hsl(var(--mycroft-green))']
              : '0 0 10px hsl(var(--mycroft-green)/0.5)'
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        
        {/* Waveform bars in circular pattern */}
        <div className="absolute inset-0 flex items-center justify-center">
          {waveformBars.slice(0, 12).map((height, i) => {
            const angle = (i / 12) * 360;
            const radians = (angle * Math.PI) / 180;
            const radius = size === 'lg' ? 50 : size === 'md' ? 38 : 25;
            
            return (
              <motion.div
                key={i}
                className={`absolute ${barWidth[size]} rounded-full bg-mycroft-cyan`}
                style={{
                  height: `${height * (size === 'lg' ? 20 : size === 'md' ? 14 : 8)}px`,
                  left: `calc(50% + ${Math.cos(radians) * radius}% - 2px)`,
                  top: `calc(50% + ${Math.sin(radians) * radius}% - ${height * 5}px)`,
                  transform: `rotate(${angle + 90}deg)`,
                  transformOrigin: 'center bottom',
                  opacity: 0.6 + height * 0.4,
                }}
                transition={{ duration: 0.05 }}
              />
            );
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${sizeClasses[size]} relative`}
      animate={isSpeaking ? {
        scale: [1, 1.02, 1],
      } : {}}
      transition={{ duration: 0.3, repeat: Infinity }}
    >
      {/* Outer ring - pulsing */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-mycroft-green/30"
        animate={{
          scale: isSpeaking ? [1, 1.1, 1] : [1, 1.05, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Middle ring */}
      <motion.div
        className="absolute inset-2 rounded-full border border-mycroft-cyan/40"
        animate={{
          scale: isSpeaking ? [1, 1.08, 1] : 1,
          opacity: isSpeaking ? [0.4, 0.8, 0.4] : 0.4,
        }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
      />
      
      {/* Background glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-mycroft-green/20 via-mycroft-cyan/10 to-mycroft-green/20"
        animate={{
          opacity: isSpeaking ? [0.3, 0.6, 0.3] : 0.2,
        }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />
      
      {/* Waveform visualization - horizontal bars */}
      <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-3">
        {waveformBars.map((height, i) => (
          <motion.div
            key={i}
            className={`${barWidth[size]} rounded-full`}
            style={{
              height: `${height * 100}%`,
              maxHeight: '80%',
              background: `linear-gradient(to top, hsl(var(--mycroft-green)), hsl(var(--mycroft-cyan)))`,
              opacity: 0.5 + height * 0.5,
            }}
            transition={{ duration: 0.05 }}
          />
        ))}
      </div>
      
      {/* Central eye/core */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-4 h-4 rounded-full bg-mycroft-green"
          animate={{
            boxShadow: isSpeaking 
              ? ['0 0 15px hsl(var(--mycroft-green))', '0 0 35px hsl(var(--mycroft-green))', '0 0 15px hsl(var(--mycroft-green))']
              : '0 0 10px hsl(var(--mycroft-green)/0.5)',
            scale: isSpeaking ? [1, 1.2, 1] : 1,
          }}
          transition={{ duration: 0.3, repeat: Infinity }}
        />
      </div>
      
      {/* Scanlines effect */}
      <div 
        className="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-20"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--mycroft-cyan)/0.1) 2px, hsl(var(--mycroft-cyan)/0.1) 4px)'
        }}
      />
      
      {/* Corner accents */}
      <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-mycroft-green/60 rounded-tl" />
      <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-mycroft-green/60 rounded-tr" />
      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-mycroft-green/60 rounded-bl" />
      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-mycroft-green/60 rounded-br" />
    </motion.div>
  );
}
