import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Users, Bot, Trophy, Play, LogOut, ShoppingCart, HelpCircle, Coins, User, UserX, Pencil, X, Check, Eye, ChevronRight, Briefcase, TrendingUp, Target, Spade, Activity, Zap, Clock, Lock, LineChart, BarChart3, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePin, getOrCreateSessionId } from '@/lib/gameUtils';
import { useAuth } from '@/hooks/useAuth';
import { useAudioPreloader } from '@/hooks/useAudioPreloader';
import { useFounderCase } from '@/hooks/useFounderCase';
import GoldButton from '@/components/game/GoldButton';
import AudioPreloadIndicator from '@/components/game/AudioPreloadIndicator';
import { GameOpening } from '@/components/game/GameOpening';
import { BalanceHeader } from '@/components/game/BalanceHeader';
import { FakeLobby } from '@/components/game/FakeLobby';
import { PhaseSelector } from '@/components/game/PhaseSelector';
import { DailyBonusModal } from '@/components/game/DailyBonusModal';
import { InsufficientEnergyModal } from '@/components/game/InsufficientEnergyModal';
import { FounderCaseModal } from '@/components/game/FounderCaseModal';
import { PresenterRoleSelector } from '@/components/game/PresenterRoleSelector';
import ProgressToPrize from '@/components/game/ProgressToPrize';
import { useEconomy, GAME_PHASES, DAILY_BONUS_AMOUNT } from '@/hooks/useEconomy';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import logoOraculo from '@/assets/logo_oraculo_mycroft.png';

const nicknameSchema = z.string().min(3, 'Mínimo 3 caracteres').max(20, 'Máximo 20 caracteres');

interface ActiveRoom {
  roomId: string;
  nickname: string;
  playerId: string;
}

export default function Index() {
  const navigate = useNavigate();
  const { profile, isAuthenticated, loading: authLoading, signOut, updateProfile } = useAuth();
  const economy = useEconomy();
  const founderCase = useFounderCase();
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestNickname, setGuestNickname] = useState('');
  const [showFakeLobby, setShowFakeLobby] = useState(false);
  const [showPhaseSelector, setShowPhaseSelector] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3>(1);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [isClaimingDailyBonus, setIsClaimingDailyBonus] = useState(false);
  const [showInsufficientEnergy, setShowInsufficientEnergy] = useState(false);
  const [showFounderCaseModal, setShowFounderCaseModal] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [pendingPresenterRoom, setPendingPresenterRoom] = useState<{ id: string; playerSlotTaken: boolean; currentPlayerName?: string } | null>(null);
  // ✅ FIX: Estado inicial sem lógica de sessionStorage para evitar problemas de hidratação
  const [showOpening, setShowOpening] = useState(false);

  // Audio preloader DISABLED on landing page to prevent any ElevenLabs usage before playing
  const audioPreloader = useAudioPreloader(false);

  // ✅ FIX: Verificar showOpening via useEffect para evitar problemas de estado
  useEffect(() => {
    const shouldShow = sessionStorage.getItem('showOpening') === 'true';
    if (shouldShow) {
      setShowOpening(true);
      sessionStorage.removeItem('showOpening');
    }
  }, []);

  // Check for guest mode
  useEffect(() => {
    const guestMode = sessionStorage.getItem('guestMode');
    if (guestMode === 'true') {
      setIsGuest(true);
      // Usa nickname salvo ou gera aleatório
      const savedNickname = sessionStorage.getItem('guestNickname');
      setGuestNickname(savedNickname || `Convidado${Math.floor(Math.random() * 9999)}`);
    }
  }, []);

  // Check for daily bonus on load
  useEffect(() => {
    if (isAuthenticated && !economy.loading && economy.dailyBonusAvailable) {
      const today = new Date().toISOString().split('T')[0];
      const dismissedToday = sessionStorage.getItem('dailyBonusDismissed') === today;
      if (dismissedToday) return;

      // Small delay to let the page render first
      const timeout = setTimeout(() => {
        setShowDailyBonus(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, economy.loading, economy.dailyBonusAvailable]);

  // Redirect to landing if not authenticated and not guest
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isGuest) {
      const guestMode = sessionStorage.getItem('guestMode');
      if (guestMode !== 'true') {
        navigate('/');
      }
    }
  }, [isAuthenticated, authLoading, navigate, isGuest]);

  // Check if player has an active room
  useEffect(() => {
    const checkActiveRoom = async () => {
      if (!profile && !isGuest) return;
      
      const sessionId = getOrCreateSessionId();
      
      // Find player's active room
      const { data: player } = await supabase
        .from('players')
        .select('id, room_id, nickname, rooms!inner(id, current_status)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (player && player.rooms) {
        setActiveRoom({
          roomId: player.room_id,
          nickname: player.nickname,
          playerId: player.id
        });
      }
    };

    checkActiveRoom();
  }, [profile, isGuest]);

  const rejoinRoom = () => {
    if (activeRoom) {
      navigate(`/room/${activeRoom.roomId}`);
    }
  };

  const leaveRoomPermanently = async () => {
    if (!activeRoom) return;
    
    try {
      await supabase.from('players').delete().eq('id', activeRoom.playerId);
      setActiveRoom(null);
      toast({ title: 'Você saiu da sala', description: 'Pode entrar em outra partida agora.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao sair da sala', variant: 'destructive' });
    }
  };

  const createRoom = async () => {
    setLoading(true);
    try {
      const sessionId = getOrCreateSessionId();
      const roomPin = generatePin();
      const nickname = isGuest ? guestNickname : profile?.username || 'Jogador';

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ pin: roomPin, host_id: sessionId })
        .select()
        .single();

      if (roomError) throw roomError;

      // Create host player record immediately
      const { error: playerError } = await supabase.from('players').insert({
        room_id: room.id,
        nickname: nickname,
        session_id: sessionId,
        is_host: true,
      });

      if (playerError) {
        console.error('Error creating host player:', playerError);
        // Clean up room if player creation fails
        await supabase.from('rooms').delete().eq('id', room.id);
        throw playerError;
      }

      navigate(`/room/${room.id}?host=true`);
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao criar sala', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const nickname = isGuest ? guestNickname : profile?.username;
    if (!pin || !nickname) {
      toast({ title: 'Preencha o PIN', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('pin', pin.toUpperCase())
        .maybeSingle();

      if (error || !room) {
        toast({ title: 'Sala não encontrada', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const sessionId = getOrCreateSessionId();
      
      // Check if player already exists in this room
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id, role')
        .eq('room_id', room.id)
        .eq('session_id', sessionId)
        .maybeSingle();

      // Se é sala de modo apresentador, mostrar seletor de papel
      if (room.mode === 'presenter') {
        // Verificar se já existe um jogador principal
        const { data: mainPlayer } = await supabase
          .from('players')
          .select('nickname')
          .eq('room_id', room.id)
          .eq('role', 'player')
          .maybeSingle();

        if (existingPlayer) {
          // Jogador já existe, navegar direto
          setShowJoinForm(false); // ✅ Fechar modal de PIN
          navigate(`/player-screen/${room.id}`);
        } else {
          // ✅ FIX: Fechar modal de PIN ANTES de abrir seletor de papel
          setShowJoinForm(false);
          setPin(''); // Limpar PIN
          
          // Abrir seletor de papel
          setPendingPresenterRoom({
            id: room.id,
            playerSlotTaken: !!mainPlayer,
            currentPlayerName: mainPlayer?.nickname
          });
          setShowRoleSelector(true);
        }
        setLoading(false);
        return;
      }

      // Modo normal - entrar como jogador comum
      if (!existingPlayer) {
        await supabase.from('players').insert({
          room_id: room.id,
          nickname: nickname,
          session_id: sessionId,
          is_host: false,
        });
      }

      navigate(`/room/${room.id}`);
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao entrar na sala', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Função para confirmar papel no Modo Apresentador
  const handleRoleSelect = async (role: 'player' | 'jury') => {
    if (!pendingPresenterRoom) return;

    const nickname = isGuest ? guestNickname : profile?.username;
    if (!nickname) return;

    setLoading(true);
    try {
      const sessionId = getOrCreateSessionId();

      await supabase.from('players').insert({
        room_id: pendingPresenterRoom.id,
        nickname: nickname,
        session_id: sessionId,
        is_host: false,
        role: role
      });

      setShowRoleSelector(false);
      setShowJoinForm(false);
      setPendingPresenterRoom(null);
      navigate(`/player-screen/${pendingPresenterRoom.id}`);
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao entrar na sala', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isGuest) {
      sessionStorage.removeItem('guestMode');
      sessionStorage.removeItem('guestNickname');
      setIsGuest(false);
      navigate('/auth');
    } else {
      await signOut();
      navigate('/auth');
    }
  };

  const handleStartEditNickname = () => {
    setEditNickname(isGuest ? guestNickname : profile?.username || '');
    setIsEditingNickname(true);
  };

  const handleSaveNickname = async () => {
    const result = nicknameSchema.safeParse(editNickname);
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }

    setSavingNickname(true);

    if (isGuest) {
      // Salva no sessionStorage para convidados
      sessionStorage.setItem('guestNickname', editNickname);
      setGuestNickname(editNickname);
      setIsEditingNickname(false);
      toast({ title: 'Nickname atualizado!', description: `Agora você é ${editNickname}` });
    } else {
      // Atualiza no perfil para usuários logados
      const { error } = await updateProfile({ username: editNickname });
      if (error) {
        toast({ title: 'Erro', description: 'Falha ao salvar nickname', variant: 'destructive' });
      } else {
        setIsEditingNickname(false);
        toast({ title: 'Nickname atualizado!', description: `Agora você é ${editNickname}` });
      }
    }

    setSavingNickname(false);
  };

  const handleCancelEditNickname = () => {
    setIsEditingNickname(false);
    setEditNickname('');
  };

  // Handle "Desafie o Hórus" button click - show phase selector
  const handleChallengeHorus = () => {
    setShowPhaseSelector(true);
  };

  // Handle phase selection
  const handlePhaseSelect = (phase: 1 | 2 | 3) => {
    setSelectedPhase(phase);
    setShowPhaseSelector(false);
    setShowFakeLobby(true);
  };

  // Handle fake lobby completion - navigate to solo mode with shadow players
  const handleLobbyComplete = (shadowPlayers: { id: string; nickname: string; avatar: string; bluffVoteChance: number; claroVoteChance: number }[]) => {
    // ✅ FIX: Validação de shadow players
    if (!shadowPlayers || shadowPlayers.length === 0) {
      console.error('[FakeLobby] Shadow players não definidos ou vazios');
      toast({ title: 'Erro ao iniciar jogo', description: 'Não foi possível criar oponentes.', variant: 'destructive' });
      setShowFakeLobby(false);
      return;
    }
    
    try {
      // Store shadow players in sessionStorage for the single player room
      sessionStorage.setItem('horusShadowPlayers', JSON.stringify(shadowPlayers));
      sessionStorage.setItem('gamePhase', selectedPhase.toString());
      navigate('/single-player?mode=horus');
    } catch (error) {
      console.error('[FakeLobby] Erro ao salvar shadow players:', error);
      toast({ title: 'Erro ao iniciar jogo', variant: 'destructive' });
      setShowFakeLobby(false);
    }
  };

  // Handle daily bonus claim
  const handleClaimDailyBonus = async () => {
    const today = new Date().toISOString().split('T')[0];
    sessionStorage.setItem('dailyBonusDismissed', today);

    // Close immediately so the user never gets stuck on this screen
    setShowDailyBonus(false);
    setIsClaimingDailyBonus(true);

    const success = await economy.claimDailyBonus();
    if (success) {
      toast({
        title: `⚡ +${DAILY_BONUS_AMOUNT} NT`,
        description: 'Bônus diário resgatado!',
      });
    }

    setIsClaimingDailyBonus(false);
  };

  const handleDismissDailyBonus = () => {
    const today = new Date().toISOString().split('T')[0];
    sessionStorage.setItem('dailyBonusDismissed', today);
    setShowDailyBonus(false);
  };

  // Loading state
  if (authLoading && !isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Coins className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  const displayName = isGuest ? guestNickname : profile?.username;

  // Show cinematic opening (covers everything)
  if (showOpening) {
    return <GameOpening onComplete={() => setShowOpening(false)} />;
  }

  // Show phase selector
  if (showPhaseSelector) {
    return (
      <PhaseSelector
        phases={GAME_PHASES}
        ntBalance={economy.ntBalance}
        onSelectPhase={handlePhaseSelect}
        onCancel={() => setShowPhaseSelector(false)}
      />
    );
  }

  // Show fake lobby
  if (showFakeLobby) {
    const phaseConfig = economy.getPhaseConfig(selectedPhase);
    return (
      <FakeLobby
        playerName={displayName || 'Jogador'}
        onComplete={handleLobbyComplete}
        duration={5000}
        phaseConfig={phaseConfig}
      />
    );
  }

  return (
    <>
      {/* Daily Bonus Modal */}
      <DailyBonusModal
        open={showDailyBonus}
        amount={DAILY_BONUS_AMOUNT}
        onClaim={handleClaimDailyBonus}
        onClose={handleDismissDailyBonus}
      />

      {/* Insufficient Energy Modal */}
      <InsufficientEnergyModal
        open={showInsufficientEnergy}
        onClose={() => setShowInsufficientEnergy(false)}
        requiredNT={50}
        currentNT={economy.ntBalance}
        onBuyTokens={() => {
          setShowInsufficientEnergy(false);
          navigate('/mercado-negro');
        }}
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Header Condensado - Bloomberg Style */}
        <header className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <img src={logoOraculo} alt="Oráculo Mycroft" className="w-8 h-8" />
              <div>
                <h1 className="text-sm font-bold font-orbitron text-foreground">ORÁCULO MYCROFT</h1>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">PUNTER</p>
              </div>
            </div>
            
            {/* Live Stats + User */}
            <div className="flex items-center gap-4 text-xs">
              <div className="hidden sm:flex items-center gap-1">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-muted-foreground">Live</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-muted-foreground">NT</span>
                <span className="ml-1 text-primary font-bold font-mono">⚡ {economy.ntBalance}</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-muted-foreground">BC</span>
                <span className="ml-1 text-primary font-bold font-mono">🪙 {economy.bcBalance.toLocaleString()}</span>
              </div>
              
              {/* User Info */}
              {(profile || isGuest) && (
                <div className="flex items-center gap-2">
                  {isEditingNickname ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        className="h-7 text-xs w-24 bg-background/50"
                        maxLength={20}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNickname();
                          if (e.key === 'Escape') handleCancelEditNickname();
                        }}
                      />
                      <Button size="icon" variant="ghost" onClick={handleSaveNickname} disabled={savingNickname || editNickname.length < 3} className="h-6 w-6">
                        <Check className="w-3 h-3 text-success" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={handleCancelEditNickname} className="h-6 w-6">
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <button onClick={handleStartEditNickname} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                      <span className="text-xs font-medium text-foreground">{displayName}</span>
                      <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                    title="Sair"
                  >
                    <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 space-y-4 max-w-5xl mx-auto pb-24">
          {/* Quick Stats Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="bg-gradient-to-br from-success/10 to-transparent border border-success/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-success" />
                <p className="text-[10px] text-muted-foreground font-mono uppercase">PATRIMÔNIO</p>
              </div>
              <p className="text-lg font-bold text-foreground font-mono">⚡ {economy.ntBalance}</p>
              <p className="text-xs text-success font-mono">NT Balance</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-blue-500" />
                <p className="text-[10px] text-muted-foreground font-mono uppercase">MOEDAS</p>
              </div>
              <p className="text-lg font-bold text-foreground font-mono">🪙 {economy.bcBalance.toLocaleString()}</p>
              <p className="text-xs text-blue-400 font-mono">BC Balance</p>
            </div>
            
            <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-[10px] text-muted-foreground font-mono uppercase">RANK</p>
              </div>
              <p className="text-sm font-bold text-foreground">{isGuest ? 'Convidado' : profile?.rank_title || '—'}</p>
              <p className="text-xs text-primary font-mono">{profile?.wins || 0} wins</p>
            </div>
          </motion.div>

          {/* Progress */}
          {!isGuest && profile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ProgressToPrize currentBC={economy.bcBalance} />
            </motion.div>
          )}

          {/* Produtos Ativos */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider font-mono">
              Produtos Ativos
            </h2>
            
            <div className="space-y-2">
              {/* Arena Punter - Destaque */}
              <button
                onClick={() => navigate('/punter')}
                disabled={loading}
                className="w-full text-left bg-gradient-to-r from-blue-900/30 to-blue-900/10 border-l-4 border-blue-500 rounded-r-lg p-4 hover:from-blue-900/40 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground font-orbitron text-sm">ARENA PUNTER</h3>
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded font-mono">
                          ATIVO
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Value Betting • Pré-jogo</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>

              {/* Arena Trader Sports */}
              <button
                onClick={() => navigate('/arena-trader-sports')}
                disabled={loading}
                className="w-full text-left bg-gradient-to-r from-success/10 to-success/5 border-l-4 border-success rounded-r-lg p-4 hover:from-success/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success/80 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground font-orbitron text-sm">ARENA TRADER SPORTS</h3>
                        <span className="px-2 py-0.5 bg-success/80 text-white text-[10px] font-bold rounded font-mono">
                          LIVE
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Análise tempo real • Futebol</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>

              {/* Arena Trader Financeiro */}
              <button
                onClick={() => navigate('/arena-trader')}
                disabled={loading}
                className="w-full text-left bg-card border border-border rounded-lg p-4 hover:bg-card/80 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent/30 rounded-lg flex items-center justify-center">
                      <LineChart className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground font-orbitron text-sm">ARENA TRADER FINANCEIRO</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">Simulador de trades • Cripto & Forex</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>

              {/* Arena Blackjack */}
              <button
                onClick={() => navigate('/arena-blackjack')}
                disabled={loading}
                className="w-full text-left bg-card border border-border rounded-lg p-4 hover:bg-card/80 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                      <Spade className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground font-orbitron text-sm">ARENA BLACKJACK</h3>
                        <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded font-mono">
                          NEW
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Contagem Hi-Lo • Gestão de banca</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>
            </div>
          </motion.div>

          {/* Active Room Banner */}
          {activeRoom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <button 
                onClick={rejoinRoom}
                className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-success/10 border border-success/30 hover:border-success transition-all"
              >
                <Play className="w-5 h-5 text-success" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Partida em andamento</div>
                  <div className="text-xs text-success">Clique para voltar</div>
                </div>
              </button>
              <button
                onClick={leaveRoomPermanently}
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-all"
              >
                <LogOut className="w-5 h-5 text-destructive" />
              </button>
            </motion.div>
          )}
        </main>

        {/* Bottom Nav - Bloomberg Style */}
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-2 z-50">
          <div className="flex items-center justify-around max-w-md mx-auto">
            <Link to="/punter" className="flex flex-col items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors">
              <Target className="w-5 h-5" />
              <span className="text-[10px] font-medium font-mono">Punter</span>
            </Link>
            <Link to="/arena-trader-sports" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Activity className="w-5 h-5" />
              <span className="text-[10px] font-mono">Live</span>
            </Link>
            <Link to="/arena-trader/rankings" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <BarChart3 className="w-5 h-5" />
              <span className="text-[10px] font-mono">Ranking</span>
            </Link>
            <Link to="/arena-blackjack" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Spade className="w-5 h-5" />
              <span className="text-[10px] font-mono">Blackjack</span>
            </Link>
            <button onClick={handleSignOut} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <User className="w-5 h-5" />
              <span className="text-[10px] font-mono">Perfil</span>
            </button>
          </div>
        </nav>

        {/* Modals */}
        <FounderCaseModal
          open={showFounderCaseModal}
          onClose={() => setShowFounderCaseModal(false)}
          onValidate={(success) => {
            setShowFounderCaseModal(false);
            if (success) {
              toast({ title: '🎉 Maleta Fundador ativada!', description: 'Agora você pode usar o Modo Apresentador.' });
            }
          }}
          validateCode={founderCase.validateCaseCode}
        />

        <PresenterRoleSelector
          open={showRoleSelector}
          onSelect={handleRoleSelect}
          onClose={() => {
            setShowRoleSelector(false);
            setPendingPresenterRoom(null);
          }}
          playerSlotTaken={pendingPresenterRoom?.playerSlotTaken}
          currentPlayerName={pendingPresenterRoom?.currentPlayerName}
        />

        {/* Join Form Modal */}
        {showJoinForm && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowJoinForm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-orbitron text-lg font-bold text-center text-primary">Entrar na Sala</h3>
              <Input
                placeholder="PIN DA SALA (ex: X7Z2)"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                maxLength={4}
                className="text-center font-orbitron text-2xl tracking-widest"
              />
              <p className="text-xs text-center text-muted-foreground">
                Entrando como: <span className="text-primary font-bold">{displayName}</span>
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowJoinForm(false)} className="flex-1">
                  Cancelar
                </Button>
                <GoldButton onClick={joinRoom} disabled={loading} className="flex-1">
                  Entrar
                </GoldButton>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Audio Preload Indicator */}
        <AudioPreloadIndicator
          isLoading={audioPreloader.isLoading}
          isComplete={audioPreloader.isComplete}
          progressPercent={audioPreloader.progressPercent}
          currentPhrase={audioPreloader.currentPhrase}
        />
      </div>
    </>
  );
}