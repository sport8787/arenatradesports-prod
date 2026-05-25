/**
 * Hórus Mentor — orquestrador único de gatilhos de voz.
 *
 * Filosofia: curto, técnico, calmo, objetivo, confiante.
 * - 4 modos: silent / critical_only / mentor / narrator
 * - Dedupe por sessão (1 trigger por categoria) e por usuário (onboarding nunca repete)
 * - Não fala se aba inativa, modo = silent, mute de sessão ativo, ou áudio crítico na fila
 */

import { supabase } from '@/integrations/supabase/client';
import { centralAudioQueue, AUDIO_PRIORITY } from './centralAudioQueue';
import {
  HORUS_TRIGGERS_FALLBACK,
  MODE_RANK,
  type HorusMode,
  type HorusTrigger,
} from '@/data/horusTriggers';

const SESSION_MUTE_KEY = 'horus_mentor_session_mute';
const SESSION_CATEGORY_PREFIX = 'horus_mentor_cat_';
const HORUS_VOICE_ID = 'N2lVS1w4EtoT3dr4eOWO'; // Callum
const TTS_FN = 'elevenlabs-tts';

type Listener = () => void;

class HorusMentorService {
  private triggersCache: HorusTrigger[] | null = null;
  private triggersLoadedAt = 0;
  private userMode: HorusMode = 'mentor';
  private userId: string | null = null;
  private listeners = new Set<Listener>();
  private seenCache: Set<string> = new Set();

  // ---------- Estado público ----------
  getMode(): HorusMode {
    return this.userMode;
  }

  isSessionMuted(): boolean {
    try {
      return sessionStorage.getItem(SESSION_MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }

  setSessionMuted(muted: boolean) {
    try {
      if (muted) sessionStorage.setItem(SESSION_MUTE_KEY, '1');
      else sessionStorage.removeItem(SESSION_MUTE_KEY);
    } catch { /* ignore */ }
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  // ---------- Boot por usuário ----------
  async hydrate(userId: string | null) {
    this.userId = userId;
    if (!userId) {
      this.userMode = 'mentor';
      this.seenCache = new Set();
      this.emit();
      return;
    }
    const [{ data: pref }, { data: seen }] = await Promise.all([
      supabase.from('user_preferences').select('horus_mode').eq('user_id', userId).maybeSingle(),
      supabase.from('user_horus_seen').select('trigger_key').eq('user_id', userId),
    ]);
    const mode = (pref as any)?.horus_mode as HorusMode | undefined;
    if (mode && mode in MODE_RANK) this.userMode = mode;
    this.seenCache = new Set((seen ?? []).map((r: any) => r.trigger_key));
    this.emit();
  }

  async setMode(mode: HorusMode) {
    this.userMode = mode;
    this.emit();
    if (!this.userId) return;
    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: this.userId, horus_mode: mode, updated_at: new Date().toISOString() } as any,
        { onConflict: 'user_id' }
      );
  }

  // ---------- Catálogo de gatilhos ----------
  private async loadTriggers(): Promise<HorusTrigger[]> {
    const now = Date.now();
    if (this.triggersCache && now - this.triggersLoadedAt < 5 * 60_000) {
      return this.triggersCache;
    }
    const { data, error } = await supabase
      .from('horus_triggers')
      .select('trigger_key, texto, categoria, min_mode, enabled');
    if (error || !data || data.length === 0) {
      this.triggersCache = HORUS_TRIGGERS_FALLBACK;
    } else {
      this.triggersCache = data as any as HorusTrigger[];
    }
    this.triggersLoadedAt = now;
    return this.triggersCache;
  }

  // ---------- Gatilho principal ----------
  /**
   * Dispara uma frase do Hórus se todas as condições forem satisfeitas.
   * - onceForUser=true (padrão para onboarding): nunca repete para o mesmo usuário
   * - onceForUser=false: respeita só o dedupe de categoria/sessão
   */
  async speak(triggerKey: string, opts: { onceForUser?: boolean } = {}): Promise<void> {
    const { onceForUser = false } = opts;

    // 1) Bloqueios globais
    if (this.userMode === 'silent') return;
    if (this.isSessionMuted()) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    // 2) Buscar trigger
    const triggers = await this.loadTriggers();
    const trigger = triggers.find((t) => t.trigger_key === triggerKey);
    if (!trigger || !trigger.enabled) return;

    // 3) Hierarquia de modo
    if (MODE_RANK[this.userMode] < MODE_RANK[trigger.min_mode as HorusMode]) return;

    // 4) Dedupe por usuário (onboarding e similares)
    if (onceForUser) {
      if (this.seenCache.has(triggerKey)) return;
      // Marca otimisticamente
      this.seenCache.add(triggerKey);
      if (this.userId) {
        supabase
          .from('user_horus_seen')
          .insert({ user_id: this.userId, trigger_key: triggerKey } as any)
          .then(({ error }) => {
            if (error) console.warn('[HorusMentor] falha gravando seen:', error.message);
          });
      }
    }

    // 5) Dedupe por categoria/sessão (1 da mesma categoria por sessão)
    //    Exceção: críticos sempre passam (cashout, betfair desconectada)
    if (trigger.categoria !== 'critico') {
      const key = SESSION_CATEGORY_PREFIX + trigger.categoria;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch { /* ignore */ }
    }

    await this.playTTS(trigger);
  }

  // ---------- TTS ----------
  private async playTTS(trigger: HorusTrigger) {
    try {
      const cacheKey = `horus-mentor-${trigger.trigger_key}.mp3`;
      const { data, error } = await supabase.functions.invoke(TTS_FN, {
        body: {
          text: trigger.texto,
          voiceId: HORUS_VOICE_ID,
          stability: 0.55,
          similarityBoost: 0.8,
          style: 0.45,
          speed: 1.0,
          cacheKey,
        },
      });
      if (error) {
        console.warn('[HorusMentor] TTS error:', error.message);
        return;
      }
      const audioUrl = (data as any)?.audioUrl as string | undefined;
      if (!audioUrl) return;

      centralAudioQueue.enqueue(audioUrl, {
        label: `horus_mentor_${trigger.trigger_key}`,
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
      });
    } catch (err) {
      console.warn('[HorusMentor] playTTS failed:', err);
    }
  }
}

export const horusMentor = new HorusMentorService();
