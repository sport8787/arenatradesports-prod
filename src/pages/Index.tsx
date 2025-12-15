import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Users, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePin, getOrCreateSessionId } from '@/lib/gameUtils';
import GoldButton from '@/components/game/GoldButton';
import LuxuryCard from '@/components/game/LuxuryCard';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function Index() {
  const navigate = useNavigate();
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

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
      await supabase.from('players').insert({
        room_id: room.id,
        nickname,
        session_id: sessionId,
        is_host: false,
      });

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
          Engane, blefe e conquiste a fortuna. Quem mente melhor, ganha mais.
        </p>
      </motion.div>

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
