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
import { toast } from 'sonner';

// --- Types ---
interface Card { rank: string; suit: 's' | 'h' | 'd' | 'c' }
interface Leak { id: string; title: string; severity: 'grave' | 'atencao' | 'info'; description: string; category: string }
interface CoachingMessage { id: string; text: string; type: 'provocacao' | 'estrategia' | 'alerta' }
interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; persona?: 'mycroft' | 'horus' }

// --- Simple HH Parser (demo) ---
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

// --- Page ---
const ArenaPoker = () => {
  const navigate = useNavigate();

  // State
  const [phase, setPhase] = useState<'input' | 'analyzing' | 'results'>('input');
  const [scanPhase, setScanPhase] = useState<'mycroft' | 'horus' | 'complete'>('mycroft');
  const [blufferScore, setBlufferScore] = useState(0);
  const [parsedHand, setParsedHand] = useState<ReturnType<typeof parseHandHistory> | null>(null);
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [technicalNotes, setTechnicalNotes] = useState<string[]>([]);
  const [coachingMessages, setCoachingMessages] = useState<CoachingMessage[]>([]);
  const [acordo, setAcordo] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleAnalyze = useCallback(async (handHistory: string) => {
    setPhase('analyzing');
    setScanPhase('mycroft');
    const parsed = parseHandHistory(handHistory);
    setParsedHand(parsed);

    // Simulate scanning animation phases
    await new Promise(r => setTimeout(r, 2000));
    setScanPhase('horus');
    await new Promise(r => setTimeout(r, 2000));
    setScanPhase('complete');
    await new Promise(r => setTimeout(r, 800));

    // Demo results — in production, these come from the AI edge function
    setBlufferScore(Math.floor(Math.random() * 60 + 30));
    setLeaks([
      { id: '1', title: 'Bet Sizing Inconsistente', severity: 'grave', description: 'Aposta de 1/4 pot no flop com mão forte. Sizing não protege contra draws.', category: 'Sizing' },
      { id: '2', title: 'Range de 3-Bet Estreito', severity: 'atencao', description: 'Frequência de 3-bet abaixo do ideal para posição de CO.', category: 'Pre-Flop' },
      { id: '3', title: 'Timing Tell Detectado', severity: 'info', description: 'Decisão no river tomada em <2s pode indicar range polarizado.', category: 'Comportamental' },
    ]);
    setTechnicalNotes([
      'SPR efetivo: 4.2 — favorece stack-off com top pair+',
      'Equidade estimada vs range de call: 62%',
      'Fold Equity no turn: ~35% baseado em sizing',
    ]);
    setCoachingMessages([
      { id: '1', text: 'Você apostou como quem tem medo de ser pago. Se tem a mão, cobre o preço certo.', type: 'provocacao' },
      { id: '2', text: 'Nesta textura de board, considere overbet no turn para maximizar valor contra draws.', type: 'estrategia' },
      { id: '3', text: 'Seu timing no river entregou informação. Adicione delay antes de decisões críticas.', type: 'alerta' },
    ]);
    setAcordo('Sugestão: Revise sizing em spots de valor antes de subir de stakes.');
    setTags(['#sizing-leak', '#range-construction', '#timing-tell', '#value-bet', '#NL50']);
    setPhase('results');
    toast.success('Análise completa');
  }, []);

  const handleChatSend = useCallback((message: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: message };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    // Demo response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Boa pergunta. Analisando o contexto da mão, ${message.toLowerCase().includes('sizing') ? 'o sizing deveria ser entre 65-75% do pot neste spot para balancear seu range de valor e blefe.' : 'considere que a textura do board favorece ranges de continuação mais amplos. Ajuste sua frequência de c-bet accordingly.'}`,
        persona: Math.random() > 0.5 ? 'mycroft' : 'horus',
      };
      setChatMessages(prev => [...prev, response]);
      setChatLoading(false);
    }, 1500);
  }, []);

  return (
    <div className="min-h-screen bg-black text-foreground">
      {/* Scanning overlay */}
      <ScanningOverlay isScanning={phase === 'analyzing'} phase={scanPhase} />

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[hsl(0_0%_10%)] bg-black/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/lobby')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
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

          {phase === 'results' && <BlufferScore score={blufferScore} />}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Input phase */}
        {phase === 'input' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl mx-auto space-y-6"
          >
            {/* Branding */}
            <div className="text-center space-y-3 mb-8">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-3 px-5 py-2 rounded-full border border-[hsl(var(--arena-gold)_/_0.2)] bg-[hsl(var(--arena-gold)_/_0.05)]"
              >
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

            <HandHistoryInput onAnalyze={handleAnalyze} isAnalyzing={false} />

            {/* Decorative waveform */}
            <div className="flex items-center justify-center gap-[2px] h-6 opacity-30">
              {[...Array(60)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-[2px] bg-[hsl(var(--arena-cyan))] rounded-full"
                  animate={{ height: [2, Math.random() * 12 + 3, 2] }}
                  transition={{ duration: 2, delay: i * 0.03, repeat: Infinity, repeatType: 'reverse' }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Results phase */}
        {phase === 'results' && parsedHand && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Hand Visualizer */}
            <div className="max-w-lg mx-auto">
              <HandVisualizer
                playerCards={parsedHand.playerCards}
                boardCards={parsedHand.boardCards}
                positions={parsedHand.positions}
              />
            </div>

            {/* Dual panels + Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-4 min-h-[500px]">
              {/* Mycroft */}
              <MycroftAnalysisPanel
                leaks={leaks}
                technicalNotes={technicalNotes}
                isLoading={false}
              />

              {/* Horus */}
              <HorusStrategyPanel
                messages={coachingMessages}
                acordo={acordo}
                tags={tags}
                isLoading={false}
                onAcordoClick={() => toast.info(acordo || '')}
              />

              {/* Chat */}
              <ArenaPokerChat
                messages={chatMessages}
                onSend={handleChatSend}
                isLoading={chatLoading}
              />
            </div>

            {/* New analysis button */}
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setPhase('input');
                  setLeaks([]);
                  setCoachingMessages([]);
                  setTags([]);
                  setAcordo(null);
                  setChatMessages([]);
                  setParsedHand(null);
                }}
                className="font-mono text-xs uppercase tracking-wider border-[hsl(0_0%_20%)] text-muted-foreground hover:text-foreground"
              >
                Nova Análise
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default ArenaPoker;
