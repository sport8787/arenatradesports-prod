import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { PersonaId, PERSONAS } from '@/types/personas';

// Pharaoh icon for Hórus
const PharaohIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M12 2L4 6v2h16V6L12 2zM4 10v8c0 2.21 3.58 4 8 4s8-1.79 8-4v-8H4zm8 10c-3.31 0-6-1.34-6-3v-5h12v5c0 1.66-2.69 3-6 3z"/>
    <path d="M12 4l5 2.5H7L12 4z"/>
    <circle cx="9" cy="14" r="1.5"/>
    <circle cx="15" cy="14" r="1.5"/>
  </svg>
);

// Analyst icon for Mycroft
const AnalystIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
    <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z"/>
    <circle cx="12" cy="6" r="1"/>
    <path d="M10 8h4v1h-4z"/>
  </svg>
);

interface PersonaIndicatorProps {
  activePersona: PersonaId | null;
  isSpeaking: boolean;
  isLoading: boolean;
  currentText?: string | null;
  onMute?: () => void;
  isMuted?: boolean;
}

export default function PersonaIndicator({
  activePersona,
  isSpeaking,
  isLoading,
  currentText,
  onMute,
  isMuted = false,
}: PersonaIndicatorProps) {
  const persona = activePersona ? PERSONAS[activePersona] : null;
  
  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {/* Both personas always visible, but one is highlighted */}
      <div className="flex gap-2">
        {/* Hórus indicator */}
        <motion.div
          className={`
            relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300
            ${activePersona === 'horus' 
              ? 'bg-amber-950/90 border-amber-500/70 shadow-lg shadow-amber-500/30' 
              : 'bg-card/50 border-border/30 opacity-50'
            }
          `}
          animate={{
            scale: activePersona === 'horus' && isSpeaking ? [1, 1.02, 1] : 1,
          }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${activePersona === 'horus' ? 'bg-amber-500/30' : 'bg-muted/30'}
          `}>
            <PharaohIcon className={`w-5 h-5 ${activePersona === 'horus' ? 'text-amber-400' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex flex-col">
            <span className={`text-xs font-bold ${activePersona === 'horus' ? 'text-amber-400' : 'text-muted-foreground'}`}>
              HÓRUS
            </span>
            <span className={`text-[10px] ${activePersona === 'horus' ? 'text-amber-300/70' : 'text-muted-foreground/50'}`}>
              Apresentador
            </span>
          </div>
          
          {/* Speaking indicator */}
          {activePersona === 'horus' && isSpeaking && (
            <div className="flex gap-0.5 ml-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-amber-400 rounded-full"
                  animate={{ height: [4, 12, 4] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.6,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}
          
          {activePersona === 'horus' && isLoading && (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin ml-1" />
          )}
        </motion.div>

        {/* Mycroft indicator */}
        <motion.div
          className={`
            relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300
            ${activePersona === 'mycroft' 
              ? 'bg-mycroft-green/10 border-mycroft-green/70 shadow-lg shadow-mycroft-green/30' 
              : 'bg-card/50 border-border/30 opacity-50'
            }
          `}
          animate={{
            scale: activePersona === 'mycroft' && isSpeaking ? [1, 1.02, 1] : 1,
          }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${activePersona === 'mycroft' ? 'bg-mycroft-green/30' : 'bg-muted/30'}
          `}>
            <AnalystIcon className={`w-5 h-5 ${activePersona === 'mycroft' ? 'text-mycroft-green' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex flex-col">
            <span className={`text-xs font-bold ${activePersona === 'mycroft' ? 'text-mycroft-green' : 'text-muted-foreground'}`}>
              MYCROFT
            </span>
            <span className={`text-[10px] ${activePersona === 'mycroft' ? 'text-mycroft-cyan/70' : 'text-muted-foreground/50'}`}>
              Especialista
            </span>
          </div>
          
          {/* Speaking indicator */}
          {activePersona === 'mycroft' && isSpeaking && (
            <div className="flex gap-0.5 ml-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-mycroft-green rounded-full"
                  animate={{ height: [4, 12, 4] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.6,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}
          
          {activePersona === 'mycroft' && isLoading && (
            <Loader2 className="w-4 h-4 text-mycroft-green animate-spin ml-1" />
          )}
        </motion.div>
      </div>

      {/* Current speech text bubble */}
      <AnimatePresence>
        {activePersona && currentText && (isSpeaking || isLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`
              max-w-xs px-4 py-3 rounded-xl border-2 backdrop-blur-sm
              ${activePersona === 'horus' 
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-100' 
                : 'bg-card/90 border-mycroft-green/50 text-foreground'
              }
            `}
          >
            <p className="text-sm leading-relaxed">
              "{currentText}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mute button */}
      {onMute && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onMute}
          className="self-start p-2 rounded-lg bg-card/50 border border-border/30 text-muted-foreground hover:text-foreground transition-colors"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </motion.button>
      )}
    </div>
  );
}
