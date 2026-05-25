/**
 * Hook para reproduzir áudios do Hórus Punter UMA ÚNICA VEZ por usuário.
 * Verifica em horus_punter_audio_plays se o áudio já foi tocado para o user
 * e, se não, toca e registra. Funciona para usuários novos E existentes.
 *
 * Inclui fallback: se o navegador bloquear o autoplay, expõe `pendingAudio`
 * para que a UI mostre um botão "Tocar áudio" e o usuário inicie manualmente.
 */
import { useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const inFlight = new Set<string>(); // evita race no mesmo tab

type AudioChave = 'apresentacao_horus' | 'entradas_aprovadas';

export function useHorusPunterAudio() {
  const [pendingAudio, setPendingAudio] = useState<{
    chave: AudioChave;
    url: string;
  } | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const playUrl = useCallback((chave: AudioChave, url: string) => {
    const el = new Audio(url);
    el.volume = 0.95;
    audioElRef.current = el;
    return el.play()
      .then(() => {
        setPendingAudio((cur) => (cur?.chave === chave ? null : cur));
        return true;
      })
      .catch((e) => {
        console.warn('[HorusPunterAudio] Autoplay bloqueado:', e);
        setPendingAudio({ chave, url });
        return false;
      });
  }, []);

  const playOnce = useCallback(async (chave: AudioChave) => {
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

      // Tenta reproduzir; se autoplay for bloqueado, expõe pendingAudio
      await playUrl(chave, audio.audio_url);
      inFlight.delete(lockKey);
    } catch (e) {
      console.error('[HorusPunterAudio] Erro:', e);
    }
  }, [playUrl]);

  const playPending = useCallback(async () => {
    if (!pendingAudio) return;
    await playUrl(pendingAudio.chave, pendingAudio.url);
  }, [pendingAudio, playUrl]);

  const dismissPending = useCallback(() => {
    setPendingAudio(null);
  }, []);

  return { playOnce, pendingAudio, playPending, dismissPending };
}
