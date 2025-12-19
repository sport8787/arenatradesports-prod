import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { PersonaId, PERSONAS } from '@/types/personas';

// Eye of Hórus icon
const EyeOfHorusIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    {/* Eye of Horus - Egyptian style */}
    <path d="M12 4C7 4 2.73 7.11 1 11.5 2.73 15.89 7 19 12 19s9.27-3.11 11-7.5C21.27 7.11 17 4 12 4zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    <circle cx="12" cy="11.5" r="2.5"/>
    {/* Decorative lines below (Egyptian style) */}
    <path d="M8 17l-3 4M12 18v3M16 17l3 4" strokeWidth="1.5" stroke="currentColor" fill="none"/>
  </svg>
);

// Monocle icon for Mycroft
const MonocleIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    {/* Monocle lens */}
    <circle cx="12" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1"/>
    {/* Chain/cord */}
    <path d="M18 10c1.5 0 3 1 3 3v6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    {/* Reflection */}
    <path d="M9 8l1.5 1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
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
            w-10 h-10 rounded-full flex items-center justify-center
            ${activePersona === 'horus' ? 'bg-amber-500/30 ring-2 ring-amber-400/50' : 'bg-muted/30'}
          `}>
            <EyeOfHorusIcon className={`w-6 h-6 ${activePersona === 'horus' ? 'text-amber-400' : 'text-muted-foreground'}`} />
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
            w-10 h-10 rounded-full flex items-center justify-center
            ${activePersona === 'mycroft' ? 'bg-mycroft-green/30 ring-2 ring-mycroft-green/50' : 'bg-muted/30'}
          `}>
            <MonocleIcon className={`w-6 h-6 ${activePersona === 'mycroft' ? 'text-mycroft-green' : 'text-muted-foreground'}`} />
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
