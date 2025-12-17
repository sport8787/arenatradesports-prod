import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Users, Bot, Trophy, Play, LogOut, ShoppingCart, HelpCircle, Coins, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePin, getOrCreateSessionId } from '@/lib/gameUtils';
import { useAuth } from '@/hooks/useAuth';
import GoldButton from '@/components/game/GoldButton';
import LuxuryCard from '@/components/game/LuxuryCard';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ActiveRoom {
  roomId: string;
  nickname: string;
  playerId: string;
}

export default function Index() {
  const navigate = useNavigate();
  const { profile, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Check if player has an active room
  useEffect(() => {
    const checkActiveRoom = async () => {
      if (!profile) return;
      
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
  }, [profile]);

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

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ pin: roomPin, host_id: sessionId })
        .select()
        .single();

      if (roomError) throw roomError;

      navigate(`/room/${room.id}?host=true`);
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao criar sala', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!pin || !profile) {
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
          nickname: profile.username,
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
    await signOut();
    navigate('/auth');
  };

  // Loading state
  if (authLoading) {
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
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
      {profile && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 w-full max-w-md"
        >
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border border-primary/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-orbitron font-bold text-lg text-foreground">
                    Olá, {profile.username}!
                  </div>
                  <div className="text-xs text-muted-foreground">{profile.rank_title}</div>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg bg-destructive/20 border border-destructive/30 hover:bg-destructive/30 transition-all"
                title="Sair"
              >
                <LogOut className="w-4 h-4 text-destructive" />
              </button>
            </div>
            
            {/* BluffCoins Balance */}
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
              Entrando como: <span className="text-primary font-bold">{profile?.username}</span>
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
    </div>
  );
}
