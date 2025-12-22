import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, Bot, Trophy, Play, LogOut, ShoppingCart, HelpCircle, Coins, User, UserX, Pencil, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePin, getOrCreateSessionId } from '@/lib/gameUtils';
import { useAuth } from '@/hooks/useAuth';
import { useAudioPreloader } from '@/hooks/useAudioPreloader';
import GoldButton from '@/components/game/GoldButton';
import LuxuryCard from '@/components/game/LuxuryCard';
import AudioPreloadIndicator from '@/components/game/AudioPreloadIndicator';
import { GameOpening } from '@/components/game/GameOpening';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const nicknameSchema = z.string().min(3, 'Mínimo 3 caracteres').max(20, 'Máximo 20 caracteres');

interface ActiveRoom {
  roomId: string;
  nickname: string;
  playerId: string;
}

export default function Index() {
  const navigate = useNavigate();
  const { profile, isAuthenticated, loading: authLoading, signOut, updateProfile } = useAuth();
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestNickname, setGuestNickname] = useState('');
  const [showOpening, setShowOpening] = useState(() => {
    // Check if we should show opening (first visit after login)
    const shouldShow = sessionStorage.getItem('showOpening') === 'true';
    if (shouldShow) {
      sessionStorage.removeItem('showOpening');
    }
    return shouldShow;
  });

  // Audio preloader DISABLED on landing page to prevent any ElevenLabs usage before playing
  const audioPreloader = useAudioPreloader(false);

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

  // Redirect to auth if not authenticated and not guest
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isGuest) {
      const guestMode = sessionStorage.getItem('guestMode');
      if (guestMode !== 'true') {
        navigate('/auth');
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
        return;
      }

      const sessionId = getOrCreateSessionId();
      
      // Check if player already exists in this room
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', room.id)
        .eq('session_id', sessionId)
        .maybeSingle();

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

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen flex flex-col items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-orbitron text-4xl md:text-6xl font-black text-gold text-glow-gold mb-4">
          O BLEFADOR
        </h1>
        <h2 className="font-orbitron text-2xl md:text-3xl text-primary/80">
          MILIONÁRIO
        </h2>
        <p className="text-muted-foreground mt-4 max-w-md mx-auto">
          Analise, deduza e conquiste. Onde a inteligência emocional supera a sorte.
        </p>
      </motion.div>

      {/* User Profile Card */}
      {(profile || isGuest) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 w-full max-w-md"
        >
          <div className={cn(
            "border rounded-xl p-4",
            isGuest 
              ? "bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 border-muted-foreground/30"
              : "bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-primary/30"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  isGuest 
                    ? "bg-gradient-to-br from-muted-foreground to-muted-foreground/60"
                    : "bg-gradient-to-br from-primary to-primary/60"
                )}>
                  {isGuest ? (
                    <UserX className="w-6 h-6 text-background" />
                  ) : (
                    <User className="w-6 h-6 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  {isEditingNickname ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        className="h-8 text-sm bg-background/50 border-border/50"
                        maxLength={20}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNickname();
                          if (e.key === 'Escape') handleCancelEditNickname();
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSaveNickname}
                        disabled={savingNickname || editNickname.length < 3}
                        className="h-8 w-8 text-success hover:text-success hover:bg-success/20"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelEditNickname}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-orbitron font-bold text-lg text-foreground">
                          Olá, {displayName}!
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isGuest ? 'Convidado (não salva moedas)' : profile?.rank_title}
                        </div>
                      </div>
                      <button
                        onClick={handleStartEditNickname}
                        className="p-1.5 rounded-md hover:bg-primary/20 transition-colors"
                        title="Editar nickname"
                      >
                        <Pencil className="w-3.5 h-3.5 text-primary" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg bg-destructive/20 border border-destructive/30 hover:bg-destructive/30 transition-all"
                title={isGuest ? "Sair do modo convidado" : "Sair"}
              >
                <LogOut className="w-4 h-4 text-destructive" />
              </button>
            </div>
            
            {/* BluffCoins Balance - only show for authenticated users */}
            {!isGuest && profile && (
              <>
                <div className="mt-4 flex items-center justify-center gap-2 py-3 bg-background/50 rounded-lg border border-primary/20">
                  <Coins className="w-6 h-6 text-primary" />
                  <span className="font-orbitron text-2xl font-bold text-primary">
                    {profile.bluff_coins.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">BluffCoins</span>
                </div>

                {/* Stats */}
                <div className="mt-3 flex justify-center gap-6 text-xs text-muted-foreground">
                  <div className="text-center">
                    <div className="font-bold text-foreground">{profile.matches_played}</div>
                    <div>Partidas</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-foreground">{profile.wins}</div>
                    <div>Vitórias</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Active Room Banner */}
      {activeRoom && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 flex items-center gap-2"
        >
          <button 
            onClick={rejoinRoom}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-success/20 to-success/10 border border-success/50 hover:border-success transition-all hover:scale-105"
          >
            <Play className="w-5 h-5 text-success" />
            <div className="text-left">
              <div className="font-orbitron font-bold text-sm text-foreground">
                Partida em andamento
              </div>
              <div className="text-xs text-success">Clique para voltar</div>
            </div>
          </button>
          <button
            onClick={leaveRoomPermanently}
            className="p-3 rounded-xl bg-destructive/20 border border-destructive/50 hover:bg-destructive/30 transition-all hover:scale-105"
            title="Sair da sala permanentemente"
          >
            <LogOut className="w-5 h-5 text-destructive" />
          </button>
        </motion.div>
      )}

      <LuxuryCard className="w-full max-w-md space-y-6">
        {!showJoinForm ? (
          <>
            <GoldButton onClick={createRoom} disabled={loading} className="w-full" size="lg">
              <Sparkles className="w-5 h-5 mr-2 inline" />
              Criar Mesa
            </GoldButton>

            <Link to="/single-player" className="block">
              <GoldButton 
                className="w-full bg-gradient-to-r from-purple-900/80 via-red-900/60 to-purple-900/80 border-purple-500/50 hover:border-purple-400" 
                size="lg"
              >
                <Bot className="w-5 h-5 mr-2 inline" />
                DESAFIAR A MÁQUINA (SOLO) 🤖
              </GoldButton>
            </Link>

            <GoldButton 
              variant="outline" 
              onClick={() => setShowJoinForm(true)} 
              className="w-full" 
              size="lg"
            >
              <Users className="w-5 h-5 mr-2 inline" />
              Entrar na Mesa
            </GoldButton>

            <Link to="/como-jogar" className="block">
              <GoldButton 
                variant="outline" 
                className="w-full border-gold/30 hover:border-gold/60" 
                size="lg"
              >
                <HelpCircle className="w-5 h-5 mr-2 inline" />
                COMO JOGAR
              </GoldButton>
            </Link>

            <Link to="/mercado-negro" className="block">
              <GoldButton 
                className="w-full bg-gradient-to-r from-red-900/80 to-gold-dark/80 border-gold/50 hover:border-gold" 
                size="lg"
              >
                <ShoppingCart className="w-5 h-5 mr-2 inline" />
                MERCADO NEGRO 🛒
              </GoldButton>
            </Link>

            <Link to="/rankings" className="block">
              <GoldButton variant="ghost" className="w-full">
                <Trophy className="w-5 h-5 mr-2 inline" />
                Ver Ranking
              </GoldButton>
            </Link>
          </>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Input
              placeholder="PIN DA SALA (ex: X7Z2)"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              maxLength={4}
              className="text-center font-orbitron text-2xl tracking-widest bg-secondary border-border"
            />
            <p className="text-xs text-center text-muted-foreground">
              Entrando como: <span className="text-primary font-bold">{displayName}</span>
              {isGuest && <span className="block text-destructive/80">(Modo convidado - sem salvar moedas)</span>}
            </p>
            <GoldButton onClick={joinRoom} disabled={loading} className="w-full" size="lg">
              Entrar
            </GoldButton>
            <GoldButton variant="ghost" onClick={() => setShowJoinForm(false)} className="w-full">
              Voltar
            </GoldButton>
          </motion.div>
        )}

        <div className="flex items-center gap-2 pt-4 border-t border-border justify-center">
          <Bot className="w-4 h-4 text-mycroft-green" />
          <span className="text-xs text-mycroft-cyan/70">Powered by Mycroft AI</span>
        </div>
      </LuxuryCard>

      {/* Audio Preload Indicator */}
      <AudioPreloadIndicator
        isLoading={audioPreloader.isLoading}
        isComplete={audioPreloader.isComplete}
        progressPercent={audioPreloader.progressPercent}
        currentPhrase={audioPreloader.currentPhrase}
      />
    </motion.div>
  );
}
