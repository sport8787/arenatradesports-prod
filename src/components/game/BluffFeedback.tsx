import { motion, AnimatePresence } from 'framer-motion';

interface BluffFeedbackProps {
  phrase: string;
  description: string;
  visible: boolean;
}

export default function BluffFeedback({ phrase, description, visible }: BluffFeedbackProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-amber-500/10"
          />
          
          {/* Main feedback card */}
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ 
              scale: [0, 1.15, 0.95, 1],
              y: [20, -5, 0, 0],
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              duration: 0.5,
              times: [0, 0.5, 0.7, 1],
              ease: [0.68, -0.55, 0.265, 1.55],
            }}
            className="relative bg-black/95 border-2 border-amber-500 rounded-xl p-6 px-8 max-w-md mx-4 shadow-2xl"
            style={{
              boxShadow: '0 0 60px hsl(43 74% 49% / 0.4), 0 0 30px hsl(43 74% 49% / 0.2)',
            }}
          >
            {/* Glowing corners */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-400 rounded-br-lg" />
            
            {/* Main phrase */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl md:text-3xl font-orbitron font-bold text-center"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px hsl(43 74% 49% / 0.5)',
              }}
            >
              {phrase}
            </motion.h2>
            
            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-amber-200/80 text-center mt-2 font-rajdhani text-lg"
            >
              {description}
            </motion.p>
            
            {/* Sparkle effects */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  delay: 0.2 + i * 0.1,
                  duration: 0.6,
                  repeat: 2,
                }}
                className="absolute w-2 h-2 bg-amber-400 rounded-full"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  boxShadow: '0 0 10px #fbbf24',
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
