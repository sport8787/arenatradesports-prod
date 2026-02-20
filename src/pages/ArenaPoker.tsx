import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import HandHistoryInput from '@/components/arena-poker/HandHistoryInput';
import BlufferScore from '@/components/arena-poker/BlufferScore';
import HandVisualizer from '@/components/arena-poker/HandVisualizer';
import MycroftAnalysisPanel from '@/components/arena-poker/MycroftAnalysisPanel';
import HorusStrategyPanel from '@/components/arena-poker/HorusStrategyPanel';
import ArenaPokerChat from '@/components/arena-poker/ArenaPokerChat';
import ScanningOverlay from '@/components/arena-poker/ScanningOverlay';
import SessionReviewInput from '@/components/arena-poker/SessionReviewInput';
import SessionReviewResults from '@/components/arena-poker/SessionReviewResults';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Types ---
interface Card { rank: string; suit: 's' | 'h' | 'd' | 'c' }
interface Leak { id: string; title: string; severity: 'grave' | 'atencao' | 'info'; description: string; category: string }
interface CoachingMessage { id: string; text: string; type: 'provocacao' | 'estrategia' | 'alerta' }
interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; persona?: 'mycroft' | 'horus' }

interface SessionReviewData {
  totalHands: number;
  overallScore: number;
  recurringLeaks: { title: string; frequency: number; severity: 'grave' | 'atencao' | 'info'; description: string; hands: number[] }[];
  spotClusters: { type: string; count: number; insight: string }[];
  trainingPlan: { day: string; focus: string; exercises: string[] }[];
  tags: string[];
  summary: string;
}

// --- Simple HH Parser ---
function parseHandHistory(raw: string) {
  const cards: Card[] = [];
  const board: Card[] = [];

  const heroMatch = raw.match(/Dealt to [\w\s]+\[(\w{2})\s(\w{2})\]/i);
  if (heroMatch) {
    cards.push(parseCard(heroMatch[1]), parseCard(heroMatch[2]));
  }

  const boardMatch = raw.match(/\*\*\* (?:FLOP|TURN|RIVER) \*\*\*.*?\[([\w\s]+)\]/gi);
  if (boardMatch) {
    boardMatch.forEach(m => {
      const inner = m.match(/\[([\w\s]+)\]/)?.[1];
      if (inner) inner.trim().split(/\s+/).forEach(c => board.push(parseCard(c)));
    });
  }

  const posMatch = raw.match(/Seat \d+: (\w+).*?is the button/i);
  const heroNameMatch = raw.match(/Dealt to ([\w]+)/i);

  return {
    playerCards: cards,
    boardCards: board.slice(0, 5),
    positions: { hero: heroNameMatch?.[1] || 'Hero', villain: posMatch?.[1] },
  };
}

function parseCard(s: string): Card {
  const rank = s.slice(0, -1).toUpperCase();
  const suitMap: Record<string, 's' | 'h' | 'd' | 'c'> = { s: 's', h: 'h', d: 'd', c: 'c' };
  return { rank, suit: suitMap[s.slice(-1).toLowerCase()] || 's' };
}

// --- Chat helper ---
async function sendChat(opts: {
  messages: { role: string; content: string }[];
  handContext?: string;
}): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arena-poker-chat`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages: opts.messages, handContext: opts.handContext }),
  });

  if (resp.status === 429) { toast.error('Rate limit atingido. Tente novamente em breve.'); return ''; }
  if (!resp.ok) { toast.error('Erro ao conectar com a IA.'); return ''; }

  const data = await resp.json();
  return data.content || 'Sem resposta.';
}

type AnalysisMode = 'single' | 'session';
type Phase = 'input' | 'analyzing' | 'results';

const ArenaPoker = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AnalysisMode>('single');
  const [phase, setPhase] = useState<Phase>('input');
  const [scanPhase, setScanPhase] = useState<'mycroft' | 'horus' | 'complete'>('mycroft');

  // Single analysis state
  const [blufferScore, setBlufferScore] = useState(0);
  const [parsedHand, setParsedHand] = useState<ReturnType<typeof parseHandHistory> | null>(null);
  const [rawHandHistory, setRawHandHistory] = useState('');
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [technicalNotes, setTechnicalNotes] = useState<string[]>([]);
  const [coachingMessages, setCoachingMessages] = useState<CoachingMessage[]>([]);
  const [acordo, setAcordo] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Session review state
  const [sessionData, setSessionData] = useState<SessionReviewData | null>(null);

  const resetAll = () => {
    setPhase('input');
    setLeaks([]);
    setCoachingMessages([]);
    setTags([]);
    setAcordo(null);
    setChatMessages([]);
    setParsedHand(null);
    setRawHandHistory('');
    setSessionData(null);
    setBlufferScore(0);
  };

  const handleAnalyze = useCallback(async (handHistory: string) => {
    setPhase('analyzing');
    setScanPhase('mycroft');
    setRawHandHistory(handHistory);
    const parsed = parseHandHistory(handHistory);
    setParsedHand(parsed);

    const scanTimer = setTimeout(() => setScanPhase('horus'), 2000);

    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-analyze', {
        body: { handHistory },
      });

      clearTimeout(scanTimer);

      if (error) {
        console.error('Analysis error:', error);
        toast.error('Erro na análise. Tente novamente.');
        setPhase('input');
        return;
      }

      setScanPhase('complete');
      await new Promise(r => setTimeout(r, 600));

      const m = data.mycroft;
      setBlufferScore(m.blufferScore ?? 50);
      setLeaks(m.leaks ?? []);
      setTechnicalNotes(m.technicalNotes ?? []);

      const h = data.horus;
      setCoachingMessages(h.messages ?? []);
      setAcordo(h.acordo ?? null);
      setTags(h.tags ?? []);

      setPhase('results');
      toast.success('Análise completa');
    } catch (err) {
      clearTimeout(scanTimer);
      console.error('Analysis failed:', err);
      toast.error('Falha ao analisar. Verifique sua conexão.');
      setPhase('input');
    }
  }, []);

  const handleSessionReview = useCallback(async (hands: string[]) => {
    setPhase('analyzing');
    setScanPhase('mycroft');

    const scanTimer = setTimeout(() => setScanPhase('horus'), 2500);

    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-session-review', {
        body: { hands },
      });

      clearTimeout(scanTimer);

      if (error) {
        console.error('Session review error:', error);
        toast.error('Erro na revisão. Tente novamente.');
        setPhase('input');
        return;
      }

      setScanPhase('complete');
      await new Promise(r => setTimeout(r, 600));

      setSessionData(data);
      setPhase('results');
      toast.success(`Sessão analisada: ${hands.length} mãos`);
    } catch (err) {
      clearTimeout(scanTimer);
      console.error('Session review failed:', err);
      toast.error('Falha na revisão. Verifique sua conexão.');
      setPhase('input');
    }
  }, []);

  const handleChatSend = useCallback(async (message: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: message };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const allMessages = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const content = await sendChat({
        messages: allMessages,
        handContext: rawHandHistory || undefined,
      });

      if (content) {
        const persona: 'mycroft' | 'horus' = content.includes('[MYCROFT]') ? 'mycroft' : 'horus';
        setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content, persona }]);
      }
    } catch {
      toast.error('Erro no chat.');
    } finally {
      setChatLoading(false);
    }
  }, [chatMessages, rawHandHistory]);

  return (
    <div className="min-h-screen bg-black text-foreground">
      <ScanningOverlay isScanning={phase === 'analyzing'} phase={scanPhase} />

      <header className="sticky top-0 z-40 border-b border-[hsl(0_0%_10%)] bg-black/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="h-5 w-px bg-[hsl(0_0%_18%)]" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[hsl(var(--arena-gold))]" />
              <h1 className="font-mono text-sm font-bold uppercase tracking-[0.15em]">
                <span className="text-[hsl(var(--arena-gold))]">Arena</span>{' '}
                <span className="text-[hsl(var(--arena-cyan))]">Poker</span>
              </h1>
            </div>
          </div>
          {phase === 'results' && mode === 'single' && <BlufferScore score={blufferScore} />}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {phase === 'input' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-3 mb-8">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="inline-flex items-center gap-3 px-5 py-2 rounded-full border border-[hsl(var(--arena-gold)_/_0.2)] bg-[hsl(var(--arena-gold)_/_0.05)]">
                <Shield className="w-6 h-6 text-[hsl(var(--arena-gold))]" />
                <span className="font-mono text-lg font-bold tracking-wider">
                  <span className="text-[hsl(var(--arena-gold))]">ARENA</span>{' '}
                  <span className="text-[hsl(var(--arena-cyan))]">POKER</span>
                </span>
              </motion.div>
              <p className="font-mono text-xs text-muted-foreground tracking-wider max-w-md mx-auto">
                Análise de inteligência forense aplicada ao poker. Cole seu Hand History e deixe Mycroft e Hórus revelarem seus leaks.
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center gap-2 justify-center">
              <button
                onClick={() => setMode('single')}
                className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all ${
                  mode === 'single'
                    ? 'bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))] border border-[hsl(var(--arena-cyan)_/_0.4)]'
                    : 'text-muted-foreground border border-transparent hover:text-foreground'
                }`}
              >
                Mão Única
              </button>
              <button
                onClick={() => setMode('session')}
                className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all ${
                  mode === 'session'
                    ? 'bg-[hsl(var(--arena-gold)_/_0.15)] text-[hsl(var(--arena-gold))] border border-[hsl(var(--arena-gold)_/_0.4)]'
                    : 'text-muted-foreground border border-transparent hover:text-foreground'
                }`}
              >
                Session Review
              </button>
            </div>

            {mode === 'single' ? (
              <HandHistoryInput onAnalyze={handleAnalyze} isAnalyzing={false} />
            ) : (
              <SessionReviewInput onAnalyze={handleSessionReview} isAnalyzing={false} />
            )}

            <div className="flex items-center justify-center gap-[2px] h-6 opacity-30">
              {[...Array(60)].map((_, i) => (
                <motion.div key={i} className="w-[2px] bg-[hsl(var(--arena-cyan))] rounded-full" animate={{ height: [2, Math.random() * 12 + 3, 2] }} transition={{ duration: 2, delay: i * 0.03, repeat: Infinity, repeatType: 'reverse' }} />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'results' && mode === 'single' && parsedHand && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="max-w-lg mx-auto">
              <HandVisualizer playerCards={parsedHand.playerCards} boardCards={parsedHand.boardCards} positions={parsedHand.positions} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-4 min-h-[500px]">
              <MycroftAnalysisPanel leaks={leaks} technicalNotes={technicalNotes} isLoading={false} />
              <HorusStrategyPanel messages={coachingMessages} acordo={acordo} tags={tags} isLoading={false} onAcordoClick={() => toast.info(acordo || '')} />
              <ArenaPokerChat messages={chatMessages} onSend={handleChatSend} isLoading={chatLoading} />
            </div>
            <div className="text-center pt-4">
              <Button variant="outline" onClick={resetAll} className="font-mono text-xs uppercase tracking-wider border-[hsl(0_0%_20%)] text-muted-foreground hover:text-foreground">
                Nova Análise
              </Button>
            </div>
          </motion.div>
        )}

        {phase === 'results' && mode === 'session' && sessionData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SessionReviewResults data={sessionData} />
            <div className="text-center pt-4">
              <Button variant="outline" onClick={resetAll} className="font-mono text-xs uppercase tracking-wider border-[hsl(0_0%_20%)] text-muted-foreground hover:text-foreground">
                Nova Revisão
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default ArenaPoker;
