import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Users, Bot, Trophy, Play, LogOut, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePin, getOrCreateSessionId } from '@/lib/gameUtils';
import { useRankings } from '@/hooks/useRankings';
import GoldButton from '@/components/game/GoldButton';
import LuxuryCard from '@/components/game/LuxuryCard';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { getRankTier } from '@/types/ranking';
import { cn } from '@/lib/utils';

interface ActiveRoom {
  roomId: string;
  nickname: string;
  playerId: string;
}

export default function Index() {
  const navigate = useNavigate();
  const { myRanking } = useRankings();
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);

  const tier = myRanking ? getRankTier(myRanking.total_points) : null;

  // Check if player has an active room
  useEffect(() => {
    const checkActiveRoom = async () => {
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
        // Room is still active (not finished)
        setActiveRoom({
          roomId: player.room_id,
          nickname: player.nickname,
          playerId: player.id
        });
      }
    };

    checkActiveRoom();
  }, []);

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
    if (!pin || !nickname) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
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
          nickname,
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="font-orbitron text-4xl md:text-6xl font-black text-gold text-glow-gold mb-4">
          O BLEFADOR
        </h1>
        <h2 className="font-orbitron text-2xl md:text-3xl text-primary/80">
          MILIONÁRIO
        </h2>
        <p className="text-muted-foreground mt-4 max-w-md mx-auto">
          Analise, deduza e conquiste. Onde a inteligência emocional supera a sorte. Quem tem a melhor leitura humana, vence.
        </p>
      </motion.div>

      {/* My Rank Badge - Clickable to rejoin room if active */}
      {myRanking && tier && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          {activeRoom ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={rejoinRoom}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r border border-success/50 hover:border-success transition-all hover:scale-105',
                  tier.color
                )}
              >
                <span className="text-xl">{tier.icon}</span>
                <div className="text-left">
                  <div className="font-orbitron font-bold text-sm flex items-center gap-2">
                    {myRanking.nickname}
                    <span className="text-xs text-success animate-pulse">● EM JOGO</span>
                  </div>
                  <div className="text-xs opacity-80">{tier.tier} • {myRanking.total_points} pts</div>
                </div>
                <Play className="w-4 h-4 text-success ml-2" />
              </button>
              <button
                onClick={leaveRoomPermanently}
                className="p-2 rounded-full bg-destructive/20 border border-destructive/50 hover:bg-destructive/30 transition-all hover:scale-105"
                title="Sair da sala permanentemente"
              >
                <LogOut className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ) : (
            <div 
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r border border-primary/30',
                tier.color
              )}
            >
              <span className="text-xl">{tier.icon}</span>
              <div>
                <div className="font-orbitron font-bold text-sm">{myRanking.nickname}</div>
                <div className="text-xs opacity-80">{tier.tier} • {myRanking.total_points} pts</div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Active Room Banner for players without ranking */}
      {activeRoom && !myRanking && (
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
                {activeRoom.nickname}
              </div>
              <div className="text-xs text-success">Clique para voltar à partida</div>
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

            <GoldButton 
              variant="outline" 
              onClick={() => setShowJoinForm(true)} 
              className="w-full" 
              size="lg"
            >
              <Users className="w-5 h-5 mr-2 inline" />
              Entrar na Mesa
            </GoldButton>

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
            <Input
              placeholder="Seu Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={15}
              className="bg-secondary border-border"
            />
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
