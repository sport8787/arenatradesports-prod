/**
 * Hook para reproduzir áudios do Hórus Punter UMA ÚNICA VEZ por usuário.
 * Verifica em horus_punter_audio_plays se o áudio já foi tocado para o user
 * e, se não, toca e registra. Funciona para usuários novos E existentes.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const inFlight = new Set<string>(); // evita race no mesmo tab

export function useHorusPunterAudio() {
  const playOnce = useCallback(async (chave: 'apresentacao_horus' | 'sinais_aprovados') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const lockKey = `${user.id}:${chave}`;
      if (inFlight.has(lockKey)) return;
      inFlight.add(lockKey);

      // Já tocou antes? (persistente entre sessões/dispositivos)
      const { data: existing } = await supabase
        .from('horus_punter_audio_plays')
        .select('id')
        .eq('user_id', user.id)
        .eq('audio_chave', chave)
        .maybeSingle();

      if (existing) {
        inFlight.delete(lockKey);
        return;
      }

      // Busca URL do áudio
      const { data: audio } = await supabase
        .from('audios_horus_punter')
        .select('audio_url')
        .eq('chave', chave)
        .eq('ativo', true)
        .maybeSingle();

      if (!audio?.audio_url) {
        inFlight.delete(lockKey);
        return;
      }

      // Marca como tocado ANTES de reproduzir (idempotência via UNIQUE)
      const { error: insErr } = await supabase
        .from('horus_punter_audio_plays')
        .insert({ user_id: user.id, audio_chave: chave });

      if (insErr && !insErr.message.includes('duplicate')) {
        console.error('[HorusPunterAudio] Erro ao registrar play:', insErr);
        inFlight.delete(lockKey);
        return;
      }
      if (insErr) {
        // duplicate = outro device já tocou; não toca de novo
        inFlight.delete(lockKey);
        return;
      }

      // Reproduz
      const el = new Audio(audio.audio_url);
      el.volume = 0.95;
      el.play().catch((e) => console.warn('[HorusPunterAudio] Play bloqueado:', e));
    } catch (e) {
      console.error('[HorusPunterAudio] Erro:', e);
    }
  }, []);

  return { playOnce };
}
