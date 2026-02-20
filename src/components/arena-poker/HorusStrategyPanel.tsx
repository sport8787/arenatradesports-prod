import { motion } from 'framer-motion';
import { Brain, Handshake, MessageSquare, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CoachingMessage {
  id: string;
  text: string;
  type: 'provocacao' | 'estrategia' | 'alerta';
}

interface HorusStrategyPanelProps {
  messages: CoachingMessage[];
  acordo: string | null;
  tags: string[];
  isLoading: boolean;
  onAcordoClick?: () => void;
}

const typeConfig = {
  provocacao: { icon: Flame, color: 'text-orange-400' },
  estrategia: { icon: Brain, color: 'text-[hsl(var(--arena-gold))]' },
  alerta: { icon: MessageSquare, color: 'text-yellow-300' },
};

const HorusStrategyPanel = ({ messages, acordo, tags, isLoading, onAcordoClick }: HorusStrategyPanelProps) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex flex-col h-full border border-[hsl(var(--arena-gold)_/_0.25)] bg-black/70 rounded-lg overflow-hidden"
  >
    {/* Header */}
    <div className="p-4 border-b border-[hsl(var(--arena-gold)_/_0.2)] bg-[hsl(var(--arena-gold)_/_0.05)]">
      <div className="flex items-center gap-2">
        <span className="text-xl">𓂀</span>
        <h3 className="font-mono text-sm uppercase tracking-[0.2em] text-[hsl(var(--arena-gold))]">
          Hórus • Estratégia & Mental Game
        </h3>
      </div>
      <p className="text-[10px] font-mono text-[hsl(var(--arena-gold)_/_0.5)] mt-1 tracking-wider">
        COACHING INTELLIGENCE SYSTEM
      </p>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Brain className="w-8 h-8 text-[hsl(var(--arena-gold)_/_0.4)] animate-pulse" />
          <span className="font-mono text-xs text-[hsl(var(--arena-gold)_/_0.4)] tracking-wider">
            Processando estratégia...
          </span>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-[hsl(var(--arena-gold)_/_0.3)] mx-auto mb-2" />
          <p className="font-mono text-xs text-muted-foreground">Aguardando análise</p>
        </div>
      ) : (
        <>
          {messages.map((msg, i) => {
            const cfg = typeConfig[msg.type];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                className="p-3 rounded-md border border-[hsl(var(--arena-gold)_/_0.15)] bg-[hsl(var(--arena-gold)_/_0.03)]"
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                  <p className="text-sm text-foreground/90 leading-relaxed italic">
                    "{msg.text}"
                  </p>
                </div>
              </motion.div>
            );
          })}
        </>
      )}
    </div>

    {/* Acordo do Hórus */}
    {acordo && (
      <div className="mx-4 mb-3">
        <Button
          onClick={onAcordoClick}
          className="w-full bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold font-mono text-xs uppercase tracking-wider hover:brightness-110"
        >
          <Handshake className="w-4 h-4 mr-2" />
          O Acordo do Hórus
        </Button>
        <p className="text-[10px] text-center text-[hsl(var(--arena-gold)_/_0.5)] font-mono mt-1">{acordo}</p>
      </div>
    )}

    {/* Tags */}
    {tags.length > 0 && (
      <div className="p-3 border-t border-[hsl(var(--arena-gold)_/_0.15)] bg-black/40">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--arena-gold)_/_0.5)] mb-2 block">
          Tags da Análise
        </span>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full border border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))] text-[10px] font-mono bg-[hsl(var(--arena-gold)_/_0.08)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    )}
  </motion.div>
);

export default HorusStrategyPanel;
