import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEconomy } from '@/hooks/useEconomy';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, AlertTriangle, Clock, TrendingUp, TrendingDown, Zap, Shield, Brain, Timer, DollarSign, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// Types
interface Scenario {
  id: string;
  title: string;
  description: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  common_mistake: string;
  difficulty: string;
  category: string;
  bankroll_multiplier_win: number;
  bankroll_multiplier_loss: number;
}

interface Season {
  id: string;
  season_number: number;
  status: string;
  current_day: number;
  current_bankroll: number;
  initial_bankroll: number;
  total_rounds: number;
  correct_answers: number;
  win_streak: number;
  loss_streak: number;
  best_win_streak: number;
  tilt_warnings: number;
}

interface JuryVote {
  juror: string;
  profile: string;
  vote: 'CLARO' | 'BLEFE';
  confidence: number;
  reasoning: string;
}

type GamePhase = 'menu' | 'loading' | 'scenario' | 'jury' | 'result' | 'horus_offer' | 'season_end';

const TIMER_SECONDS = 30;
const NT_COST = 300;

export default function ArenaTraderSeason() {
  const navigate = useNavigate();
  const { profile, isAuthenticated } = useAuth();
  const { spendNT, ntBalance } = useEconomy();

  const [phase, setPhase] = useState<GamePhase>('menu');
  const [season, setSeason] = useState<Season | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [juryVotes, setJuryVotes] = useState<JuryVote[]>([]);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [horusOffer, setHorusOffer] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [juryDeliberating, setJuryDeliberating] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check for active season on mount
  useEffect(() => {
    if (profile?.user_id) {
      checkActiveSeason();
    }
  }, [profile?.user_id]);

  const checkActiveSeason = async () => {
    const { data } = await supabase.functions.invoke('arena-trader-season', {
      body: { action: 'get_active_season', userId: profile?.user_id },
    });
    if (data?.season) {
      setSeason(data.season);
      setPhase('loading');
      loadNextScenario(data.season.id, data.season.current_day);
    }
  };

  const startNewSeason = async () => {
    if (!isAuthenticated || !profile) {
      toast.error('Faça login para jogar o Modo Temporada');
      navigate('/auth');
      return;
    }

    if (ntBalance < NT_COST) {
      toast.error(`Saldo insuficiente! Você precisa de ${NT_COST} NT`);
      return;
    }

    const spent = await spendNT(NT_COST);
    if (!spent) {
      toast.error('Erro ao debitar NT');
      return;
    }

    const { data, error } = await supabase.functions.invoke('arena-trader-season', {
      body: { action: 'start_season', userId: profile.user_id },
    });

    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao iniciar temporada');
      return;
    }

    setSeason(data.season);
    toast.success(`Temporada ${data.season.season_number} iniciada! 🏆`);
    setPhase('loading');
    loadNextScenario(data.season.id, 1);
  };

  const loadNextScenario = async (sessionId: string, day: number) => {
    setPhase('loading');
    const { data } = await supabase.functions.invoke('arena-trader-season', {
      body: { action: 'get_scenario', sessionId, day },
    });

    if (data?.scenario) {
      setScenario(data.scenario);
      setSelectedOption(null);
      setTimeLeft(TIMER_SECONDS);
      startTimeRef.current = Date.now();
      setPhase('scenario');
      startTimer();
    } else {
      toast.error('Sem cenários disponíveis');
      setPhase('menu');
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeUp = () => {
    if (!selectedOption) {
      // Auto-select random if time runs out
      const options = ['A', 'B', 'C', 'D'];
      const random = options[Math.floor(Math.random() * options.length)];
      submitAnswer(random);
    }
  };

  const submitAnswer = async (option: string) => {
    if (isSubmitting || !season || !scenario) return;
    setIsSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const timeToChoose = Date.now() - startTimeRef.current;
    const isCorrect = option === scenario.correct_option;

    // Start jury deliberation
    setJuryDeliberating(true);
    setPhase('jury');

    let juryData = null;
    try {
      const { data } = await supabase.functions.invoke('arena-trader-jury', {
        body: { scenario, chosenOption: option, isCorrect, transcription: '' },
      });
      juryData = data;
      setJuryVotes(data?.votes || []);
    } catch {
      setJuryVotes([]);
    }
    setJuryDeliberating(false);

    // Submit answer to backend
    const { data: result } = await supabase.functions.invoke('arena-trader-season', {
      body: {
        action: 'submit_answer',
        sessionId: season.id,
        scenarioId: scenario.id,
        chosenOption: option,
        timeToChoose,
        juryVotes: juryData?.votes || [],
      },
    });

    setRoundResult(result);
    setSeason(prev => prev ? {
      ...prev,
      current_bankroll: result?.bankrollAfter ?? prev.current_bankroll,
      current_day: result?.newDay ?? prev.current_day,
      total_rounds: prev.total_rounds + 1,
      correct_answers: prev.correct_answers + (result?.isCorrect ? 1 : 0),
      win_streak: result?.isCorrect ? prev.win_streak + 1 : 0,
      loss_streak: result?.isCorrect ? 0 : prev.loss_streak + 1,
    } : null);

    if (result?.horusOffer) {
      setHorusOffer(result.horusOffer);
      setPhase('horus_offer');
    } else if (result?.seasonStatus !== 'active') {
      setPhase('season_end');
    } else {
      setPhase('result');
    }
    setIsSubmitting(false);
  };

  const handleOptionSelect = (option: string) => {
    if (isSubmitting) return;
    setSelectedOption(option);
  };

  const handleConfirm = () => {
    if (selectedOption) submitAnswer(selectedOption);
  };

  const handleNextRound = () => {
    if (season && season.current_day <= 30) {
      loadNextScenario(season.id, season.current_day);
    } else {
      setPhase('season_end');
    }
  };

  const handleHorusResponse = async (accepted: boolean) => {
    if (accepted) {
      toast.success('Você aceitou a oferta do Hórus! Temporada encerrada.');
      setPhase('season_end');
    } else {
      toast('Recusou o Hórus! Coragem ou loucura? 🔥');
      setPhase('result');
    }
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const difficultyColor = (d: string) => d === 'easy' ? 'text-green-400' : d === 'medium' ? 'text-yellow-400' : 'text-red-400';
  const categoryIcon = (c: string) => {
    switch (c) {
      case 'crypto': return <TrendingUp className="w-4 h-4" />;
      case 'futuros': return <Zap className="w-4 h-4" />;
      case 'acoes': return <DollarSign className="w-4 h-4" />;
      case 'comportamental': return <Brain className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-amber-900/30 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/arena-trader')} className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Arena Trader</span>
          </button>
          {season && phase !== 'menu' && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-amber-400/70">Dia {Math.min(season.current_day, 30)}/30</span>
              <span className="text-amber-400 font-bold">{season.current_bankroll.toLocaleString()} BC</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* MENU */}
          {phase === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                  ⚔️ Modo Temporada
                </h1>
                <p className="text-amber-400/60 max-w-lg mx-auto">
                  30 dias de cenários reais de mercado. Gerencie sua banca, enfrente o júri de IA e prove que você tem sangue frio.
                </p>
              </div>

              <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-amber-400">📋 Regras</h2>
                <ul className="space-y-2 text-sm text-amber-400/70">
                  <li>• Banca inicial: <span className="text-amber-400 font-bold">10.000 BC</span></li>
                  <li>• 30 cenários de dificuldade progressiva</li>
                  <li>• Júri de 3 IAs avalia suas decisões</li>
                  <li>• O Hórus pode oferecer um "deal" a qualquer momento</li>
                  <li>• Se a banca zerar, temporada acaba</li>
                  <li>• Custo: <span className="text-amber-400 font-bold">{NT_COST} NT</span></li>
                </ul>
              </div>

              <div className="text-center">
                <Button
                  onClick={startNewSeason}
                  disabled={ntBalance < NT_COST}
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold px-8 py-6 text-lg hover:from-amber-400 hover:to-yellow-400"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  Iniciar Temporada ({NT_COST} NT)
                </Button>
                {ntBalance < NT_COST && (
                  <p className="text-red-400 text-sm mt-2">Saldo insuficiente: {ntBalance} NT</p>
                )}
              </div>
            </motion.div>
          )}

          {/* LOADING */}
          {phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-amber-400/60 mt-4">Carregando cenário...</p>
            </motion.div>
          )}

          {/* SCENARIO */}
          {phase === 'scenario' && scenario && (
            <motion.div key="scenario" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Timer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {categoryIcon(scenario.category)}
                  <span className={`text-xs font-bold uppercase ${difficultyColor(scenario.difficulty)}`}>
                    {scenario.difficulty}
                  </span>
                </div>
                <div className={`flex items-center gap-2 text-lg font-mono font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                  <Timer className="w-5 h-5" />
                  {timeLeft}s
                </div>
              </div>

              <Progress value={(timeLeft / TIMER_SECONDS) * 100} className="h-1" />

              {/* Scenario Card */}
              <div className="bg-gradient-to-br from-amber-950/30 to-black border border-amber-900/40 rounded-xl p-6">
                <h2 className="text-xl font-bold text-amber-400 mb-3">{scenario.title}</h2>
                <p className="text-amber-100/80 leading-relaxed">{scenario.description}</p>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-3">
                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                  const text = scenario[`option_${opt.toLowerCase()}` as keyof Scenario] as string;
                  const isSelected = selectedOption === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleOptionSelect(opt)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/20'
                          : 'border-amber-900/30 bg-amber-950/10 hover:border-amber-700/50'
                      }`}
                    >
                      <span className={`font-bold mr-2 ${isSelected ? 'text-amber-400' : 'text-amber-600'}`}>{opt})</span>
                      <span className="text-amber-100/80">{text}</span>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={handleConfirm}
                disabled={!selectedOption || isSubmitting}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold py-6 text-lg"
              >
                Confirmar Resposta
              </Button>
            </motion.div>
          )}

          {/* JURY DELIBERATION */}
          {phase === 'jury' && (
            <motion.div key="jury" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 space-y-8">
              <h2 className="text-2xl font-bold text-amber-400">⚖️ Júri Deliberando...</h2>
              <div className="flex gap-8">
                {['O Prudente', 'O Tubarão', 'O Quant'].map((name, i) => (
                  <motion.div
                    key={name}
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-amber-950/50 border-2 border-amber-700/50 flex items-center justify-center text-2xl">
                      {i === 0 ? '🛡️' : i === 1 ? '🦈' : '📊'}
                    </div>
                    <span className="text-xs text-amber-400/60">{name}</span>
                  </motion.div>
                ))}
              </div>
              {juryDeliberating && <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}

              {/* Show votes as they come in */}
              {juryVotes.length > 0 && (
                <div className="space-y-2 w-full max-w-md">
                  {juryVotes.map((v, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.5 }}
                      className={`p-3 rounded-lg border ${v.vote === 'CLARO' ? 'border-green-700/50 bg-green-950/20' : 'border-red-700/50 bg-red-950/20'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">{v.juror}</span>
                        <span className={`font-bold ${v.vote === 'CLARO' ? 'text-green-400' : 'text-red-400'}`}>{v.vote}</span>
                      </div>
                      <p className="text-xs text-amber-400/60 mt-1">{v.reasoning}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* RESULT */}
          {phase === 'result' && roundResult && scenario && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className={`text-center p-8 rounded-xl border ${roundResult.isCorrect ? 'border-green-700/50 bg-green-950/20' : 'border-red-700/50 bg-red-950/20'}`}>
                <div className="text-5xl mb-4">{roundResult.isCorrect ? '✅' : '❌'}</div>
                <h2 className="text-2xl font-bold mb-2">{roundResult.isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}</h2>
                <div className="flex justify-center gap-6 text-sm mt-4">
                  <div>
                    <span className="text-amber-400/60">Antes:</span>
                    <span className="ml-2 font-bold">{roundResult.bankrollBefore?.toLocaleString()} BC</span>
                  </div>
                  <div>
                    <span className="text-amber-400/60">Depois:</span>
                    <span className={`ml-2 font-bold ${roundResult.bankrollAfter > roundResult.bankrollBefore ? 'text-green-400' : 'text-red-400'}`}>
                      {roundResult.bankrollAfter?.toLocaleString()} BC
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-5 space-y-3">
                <h3 className="text-amber-400 font-bold flex items-center gap-2">
                  <Brain className="w-4 h-4" /> Explicação
                </h3>
                <p className="text-amber-100/70 text-sm leading-relaxed">{roundResult.explanation}</p>
                {roundResult.commonMistake && (
                  <p className="text-red-400/70 text-xs mt-2">
                    ⚠️ Erro comum: {roundResult.commonMistake}
                  </p>
                )}
              </div>

              {/* Tilt warning */}
              {roundResult.tiltDetected && (
                <div className="bg-red-950/30 border border-red-700/50 rounded-xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <div>
                    <p className="text-red-400 font-bold">⚡ TILT DETECTADO!</p>
                    <p className="text-red-400/60 text-sm">Mycroft detectou sinais de impulsividade. Respire fundo.</p>
                  </div>
                </div>
              )}

              {/* Jury votes summary */}
              {juryVotes.length > 0 && (
                <div className="bg-amber-950/10 border border-amber-900/20 rounded-xl p-4">
                  <h3 className="text-amber-400/70 text-sm font-bold mb-2">⚖️ Veredito do Júri</h3>
                  <div className="flex gap-4">
                    {juryVotes.map((v, i) => (
                      <div key={i} className="flex-1 text-center">
                        <p className="text-xs text-amber-400/50">{v.juror}</p>
                        <p className={`font-bold ${v.vote === 'CLARO' ? 'text-green-400' : 'text-red-400'}`}>{v.vote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleNextRound} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold py-5">
                Próximo Cenário →
              </Button>
            </motion.div>
          )}

          {/* HORUS OFFER */}
          {phase === 'horus_offer' && horusOffer && (
            <motion.div key="offer" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className="text-center bg-gradient-to-br from-amber-900/40 to-black border-2 border-amber-500/50 rounded-xl p-8 space-y-4">
                <div className="text-5xl">🦅</div>
                <h2 className="text-2xl font-bold text-amber-400">O Hórus tem uma oferta!</h2>
                <p className="text-amber-100/70">
                  {horusOffer.trigger === 'bankroll_doubled' && 'Sua banca dobrou! O Hórus quer negociar...'}
                  {horusOffer.trigger === 'win_streak' && 'Sequência impressionante! Mas até quando vai durar?'}
                  {horusOffer.trigger === 'tilt_detected' && 'Mycroft detectou sinais de tilt. Hora de parar?'}
                  {horusOffer.trigger === 'last_round' && 'Última rodada! Deal or No Deal?'}
                </p>
                <div className="text-4xl font-bold text-amber-400">
                  {horusOffer.offer?.toLocaleString()} BC
                </div>
                <p className="text-amber-400/50 text-sm">
                  Banca atual: {season?.current_bankroll?.toLocaleString()} BC
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => handleHorusResponse(true)} className="bg-green-700 hover:bg-green-600 text-white font-bold py-6">
                  ✅ Aceitar Deal
                </Button>
                <Button onClick={() => handleHorusResponse(false)} variant="outline" className="border-red-700 text-red-400 hover:bg-red-950/30 font-bold py-6">
                  ❌ No Deal!
                </Button>
              </div>
            </motion.div>
          )}

          {/* SEASON END */}
          {phase === 'season_end' && season && (
            <motion.div key="end" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="text-center space-y-4">
                <div className="text-5xl">{season.current_bankroll > season.initial_bankroll ? '🏆' : '💀'}</div>
                <h2 className="text-2xl font-bold text-amber-400">
                  Temporada {season.season_number} Encerrada
                </h2>
              </div>

              <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-6 grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-amber-400/60">Banca Final:</span><br/><span className="text-xl font-bold text-amber-400">{season.current_bankroll.toLocaleString()} BC</span></div>
                <div><span className="text-amber-400/60">ROI:</span><br/><span className={`text-xl font-bold ${season.current_bankroll > season.initial_bankroll ? 'text-green-400' : 'text-red-400'}`}>
                  {(((season.current_bankroll - season.initial_bankroll) / season.initial_bankroll) * 100).toFixed(1)}%
                </span></div>
                <div><span className="text-amber-400/60">Dias Sobrevividos:</span><br/><span className="font-bold">{Math.min(season.total_rounds, 30)}</span></div>
                <div><span className="text-amber-400/60">Win Rate:</span><br/><span className="font-bold">{season.total_rounds > 0 ? ((season.correct_answers / season.total_rounds) * 100).toFixed(0) : 0}%</span></div>
                <div><span className="text-amber-400/60">Melhor Sequência:</span><br/><span className="font-bold">{season.best_win_streak} vitórias</span></div>
                <div><span className="text-amber-400/60">Alertas de Tilt:</span><br/><span className="font-bold">{season.tilt_warnings}</span></div>
              </div>

              <div className="flex gap-4">
                <Button onClick={() => { setSeason(null); setPhase('menu'); }} className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold">
                  Nova Temporada
                </Button>
                <Button onClick={() => navigate('/arena-trader')} variant="outline" className="flex-1 border-amber-700 text-amber-400">
                  Voltar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
