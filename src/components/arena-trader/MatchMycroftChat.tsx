import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Brain, ChevronDown, ChevronUp, Loader2, MessageSquare, Lock, ArrowDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';
import { Link } from 'react-router-dom';
import { logMycroftChatAttempt } from '@/services/mycroftChatAccessLog';

interface MatchContext {
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  minute: number;
  score_home: number;
  score_away: number;
  stats?: Record<string, unknown>;
  analysis?: {
    verdict?: string;
    market?: string;
    odd?: number;
    confidence?: number;
    thesis?: string;
    plan_name?: string;
    alerts?: string[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Props {
  matchContext: MatchContext;
}

const STORAGE_PREFIX = 'mycroft-match-chat:';

interface PersistedState {
  messages: ChatMessage[];
  scrollTop: number;
}

function loadPersisted(matchId: string): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + matchId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.messages)) return null;
    return { messages: parsed.messages, scrollTop: Number(parsed.scrollTop) || 0 };
  } catch {
    return null;
  }
}

export default function MatchMycroftChat({ matchContext }: Props) {
  const [expanded, setExpanded] = useState(false);
  const initial = loadPersisted(matchContext.match_id);
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<number>(initial?.scrollTop ?? 0);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const { isPaid, subscription, daysLeft, chatOverrideActive } = useSubscription();
  const { isAdmin } = useAdmin();

  // Liberado para Admin OU Premium pago OU override temporário de chat (teste 7 dias).
  const canUse = isAdmin || (isPaid && subscription?.plan === 'premium') || chatOverrideActive;

  // Registra tentativa quando usuário sem permissão expande o chat de partida
  useEffect(() => {
    if (!expanded || canUse) return;
    let reason: 'free' | 'trial_expired' | 'plan_insufficient' | 'unknown' = 'unknown';
    if (!subscription) reason = 'free';
    else if (subscription.plan === 'trial' && daysLeft <= 0) reason = 'trial_expired';
    else if (['trial', 'starter', 'basic', 'base'].includes(subscription.plan)) reason = 'plan_insufficient';
    logMycroftChatAttempt({
      source: 'match',
      reason,
      plan: subscription?.plan ?? null,
      daysLeft: subscription ? daysLeft : null,
      matchId: matchContext.match_id,
      homeTeam: matchContext.home_team,
      awayTeam: matchContext.away_team,
      league: matchContext.league,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, canUse, matchContext.match_id]);

  // Threshold (px) para considerar "no fim"
  const BOTTOM_THRESHOLD = 60;

  const checkAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setHasUnread(false);
    shouldAutoScrollRef.current = true;
  }, []);

  // Persiste mensagens + scrollTop por match_id (sessionStorage)
  useEffect(() => {
    try {
      const payload: PersistedState = {
        messages,
        scrollTop: scrollRef.current?.scrollTop ?? savedScrollRef.current,
      };
      sessionStorage.setItem(STORAGE_PREFIX + matchContext.match_id, JSON.stringify(payload));
    } catch { /* quota / privacy mode */ }
  }, [messages, matchContext.match_id]);

  // Ao expandir: restaura scroll salvo, ou vai pro fim se for primeira abertura
  useEffect(() => {
    if (!expanded || !canUse) return;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      if (savedScrollRef.current > 0) {
        node.scrollTop = savedScrollRef.current;
      } else {
        node.scrollTop = node.scrollHeight;
      }
      setIsAtBottom(checkAtBottom());
    });
  }, [expanded, canUse, checkAtBottom]);

  // Auto-scroll só se o usuário estava no fim (ou acabou de enviar)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (shouldAutoScrollRef.current || isAtBottom) {
      el.scrollTop = el.scrollHeight;
      setHasUnread(false);
    } else {
      // chegou mensagem nova mas usuário está rolando para cima
      if (messages.length > 0) setHasUnread(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = checkAtBottom();
    setIsAtBottom(atBottom);
    shouldAutoScrollRef.current = atBottom;
    savedScrollRef.current = el.scrollTop;
    if (atBottom) setHasUnread(false);
  }, [checkAtBottom]);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const q = input.trim();
    const userMsg: ChatMessage = { role: 'user', content: q, timestamp: Date.now() };
    shouldAutoScrollRef.current = true; // ao enviar, sempre rola pro fim
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('mycroft-match-chat', {
        body: {
          query: q,
          matchContext,
          history: messages.slice(-8),
        },
      });
      if (error) throw error;
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data?.response || data?.error || '⚠️ Sem resposta do Mycroft.',
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.error('match chat error', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Erro ao conectar com o Mycroft. Tente novamente.', timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'Por que essa entrada agora?',
    'Qual o principal risco?',
    'E se eu esperar mais 5 minutos?',
    'Qual stake você sugere?',
  ];

  return (
    <div className="bg-[#0a0a0a] border border-amber-900/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm text-amber-400 uppercase tracking-wider">
            Falar com Mycroft
          </span>
          {!canUse && <Lock className="w-3 h-3 text-amber-400/50" />}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-amber-400/60" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-400/60" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {!canUse ? (
              <div className="p-6 text-center space-y-3 border-t border-amber-900/20">
                <Lock className="w-8 h-8 text-amber-400/40 mx-auto" />
                <p className="text-sm text-white/70">
                  O <strong className="text-amber-400">Chat com Mycroft</strong> é exclusivo do plano <strong>Premium</strong>.
                </p>
                <p className="text-xs text-white/40">
                  Debata cada partida com o oráculo — análise, números ao vivo e contexto completo.
                </p>
                <Link
                  to="/oferta-especial"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
                >
                  Liberar Premium 50% OFF
                </Link>
              </div>
            ) : (
              <>
                <div className="relative">
                <div ref={scrollRef} onScroll={handleScroll} className="h-[300px] overflow-y-auto overscroll-contain px-4 py-2 space-y-3 border-t border-amber-900/20">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="w-8 h-8 text-amber-400/20 mb-2" />
                      <p className="text-xs text-white/40">
                        Debata com o Mycroft sobre essa partida
                      </p>
                      <p className="text-[10px] text-white/30 mt-1">
                        Ele já tem o contexto da análise e dos números ao vivo.
                      </p>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                          msg.role === 'user'
                            ? 'bg-amber-500/20 text-amber-100'
                            : 'bg-white/5 text-white/80'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm prose-invert max-w-none [&_p]:text-xs [&_p]:text-white/80 [&_li]:text-xs [&_strong]:text-amber-400">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                        <span className="text-[10px] text-amber-400/60">Mycroft analisando...</span>
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
                {!isAtBottom && (hasUnread || messages.length > 2) && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom(true)}
                    className="absolute bottom-2 right-3 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/90 text-black text-[10px] font-bold shadow-lg hover:bg-amber-400 transition-colors"
                    aria-label="Voltar ao fim do chat"
                  >
                    <ArrowDown className="w-3 h-3" />
                    {hasUnread ? 'Novas mensagens' : 'Voltar ao fim'}
                  </button>
                )}
                </div>

                {messages.length === 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-amber-900/10">
                    {quickPrompts.map(p => (
                      <button
                        key={p}
                        onClick={() => setInput(p)}
                        className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 hover:text-amber-400 transition-colors border border-amber-500/10"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                <div className="px-4 py-3 border-t border-amber-900/20 flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Pergunte sobre essa partida..."
                    className="flex-1 bg-white/5 border border-amber-900/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                    disabled={isLoading}
                  />
                  <button
                    onClick={send}
                    disabled={isLoading || !input.trim()}
                    className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-30"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
