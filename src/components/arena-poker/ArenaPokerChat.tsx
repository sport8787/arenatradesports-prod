import { useState, useRef, useEffect } from 'react';
import { Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  persona?: 'mycroft' | 'horus';
}

interface ArenaPokerChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

const ArenaPokerChat = ({ messages, onSend, isLoading }: ArenaPokerChatProps) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full border border-[hsl(0_0%_18%)] bg-black/70 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[hsl(0_0%_15%)] bg-[hsl(0_0%_5%)]">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Chat • Arena Intelligence
          </span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-xs font-mono py-8">
            Envie uma pergunta sobre a mão analisada...
          </p>
        )}
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[hsl(var(--arena-gold)_/_0.15)] text-[hsl(var(--arena-gold))] border border-[hsl(var(--arena-gold)_/_0.2)]'
                  : msg.persona === 'mycroft'
                  ? 'bg-[hsl(var(--arena-cyan)_/_0.1)] text-[hsl(var(--arena-cyan)_/_0.9)] border border-[hsl(var(--arena-cyan)_/_0.2)]'
                  : 'bg-[hsl(0_0%_10%)] text-foreground/80 border border-[hsl(0_0%_18%)]'
              }`}
            >
              {msg.persona && (
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-60 block mb-1">
                  {msg.persona === 'mycroft' ? '⟁ Mycroft' : '𓂀 Hórus'}
                </span>
              )}
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-1 px-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-[hsl(var(--arena-cyan)_/_0.5)]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[hsl(0_0%_15%)] bg-[hsl(0_0%_5%)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre a mão..."
            className="flex-1 bg-black/60 border border-[hsl(0_0%_20%)] rounded-md px-3 py-2 text-sm font-mono text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(var(--arena-gold)_/_0.4)]"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-[hsl(var(--arena-gold))] text-black hover:brightness-110"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArenaPokerChat;
