/**
 * FILA DE ÁUDIO CENTRALIZADA v2.0
 * ================================
 * 
 * REGRA DE OURO: Apenas UM áudio de voz pode tocar por vez.
 * Prioriza leitura de perguntas. Integra com ducking de música.
 * 
 * Prioridades (maior = mais urgente):
 * - 100: Bomba/Evento crítico (interrompe tudo)
 * - 50: Leitura de pergunta (prioridade máxima normal)
 * - 40: Eventos narrativos (cinematics)
 * - 30: Mycroft análise
 * - 20: Hórus diálogos contextuais
 * - 10: Bordões (baixa prioridade, reduzidos)
 * - 5: Áudio genérico
 */

import { backgroundMusic } from './backgroundMusicService';

// Prioridades predefinidas
export const AUDIO_PRIORITY = {
  BOMB_EVENT: 100,      // Interrompe tudo
  QUESTION_READ: 50,    // Leitura de pergunta (máxima prioridade normal)
  NARRATIVE_EVENT: 40,  // Eventos cinematográficos
  MYCROFT: 30,          // Análise do Mycroft
  HORUS_DIALOGUE: 20,   // Diálogos do Hórus
  BORDAO: 10,           // Bordões (reduzidos)
  GENERIC: 5,           // Áudio genérico
} as const;

interface QueuedAudioItem {
  id: string;
  audioUrl: string;
  label: string;
  priority: number;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  addedAt: number;
  source: 'queue' | 'horus' | 'dialog'; // ✅ Rastrear fonte
}

type AudioQueueListener = (state: { isPlaying: boolean; currentLabel: string | null; queueLength: number }) => void;

class CentralAudioQueue {
  private queue: QueuedAudioItem[] = [];
  private isPlaying: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentItem: QueuedAudioItem | null = null;
  private listeners: Set<AudioQueueListener> = new Set();
  private isMusicDucked: boolean = false;
  
  // Controle de bordões - máximo 1 a cada 30 segundos
  private lastBordaoTime: number = 0;
  private readonly BORDAO_COOLDOWN = 30000; // 30 segundos
  
  // ✅ NOVO: Flag para pausar enquanto outro sistema toca
  private isPaused: boolean = false;
  private currentSource: 'queue' | 'horus' | 'dialog' | null = null;
  
  // ✅ NOVO: Controle da rodada atual (para bloquear bord_1 na rodada 1)
  private currentRound: number = 0;

  // ✅ FIX: Dedupe de question_read - evita leitura duplicada da mesma pergunta
  private lastQuestionReadLabel: string | null = null;
  private lastQuestionReadTime: number = 0;
  private readonly QUESTION_READ_DEDUPE_MS = 8000; // 8 segundos de janela

  // ✅ NOVO: Lock global por partida para eventos narrativos (impede repetição por label)
  private narrativeEventLock: Map<string, number> = new Map(); // label -> round que disparou
  private readonly NARRATIVE_EVENT_LABELS = ['silent_observer', 'silent_observer_fallback', 'hidden_event'];

  /**
   * ✅ NOVO: Reseta o lock de eventos narrativos (chamar ao iniciar nova partida)
   */
  resetNarrativeEventLock(): void {
    this.narrativeEventLock.clear();
    console.log('[CentralAudioQueue] 🔓 Narrative event lock reset');
  }

  /**
   * ✅ NOVO: Define a rodada atual (para bloquear bord_1 na rodada 1)
   */
  setCurrentRound(round: number): void {
    this.currentRound = round;
    console.log(`[CentralAudioQueue] 🔢 Round set to: ${round}`);
  }

  /**
   * ✅ NOVO: Notificar que outro sistema vai tocar
   */
  pauseFor(source: 'horus' | 'dialog'): void {
    console.log(`[CentralAudioQueue] ⏸️ Pausing for ${source}`);
    
    // Para áudio atual se for de fonte diferente
    if (this.currentAudio && this.currentSource !== source) {
      this.currentAudio.pause();
      this.isPaused = true;
    }
  }

  /**
   * ✅ NOVO: Retomar após outro sistema terminar
   */
  resume(): void {
    console.log('[CentralAudioQueue] ▶️ Resuming');
    this.isPaused = false;

    // Se tinha áudio pausado POR INTERRUPÇÃO (não finalizado), continua
    // ⚠️ Importante: não deve dar play novamente se o áudio já terminou (ended=true),
    // senão a mesma fala pode tocar 2x.
    if (
      this.currentAudio &&
      this.currentAudio.paused &&
      !this.currentAudio.ended &&
      this.currentAudio.currentTime > 0
    ) {
      this.currentAudio.play().catch(console.error);
      return;
    }

    // Senão, processa fila
    void this.processNext();
  }

  /**
   * Adiciona áudio à fila com prioridade
   * Retorna o ID do item na fila
   */
  enqueue(
    audioUrl: string,
    options: {
      label?: string;
      priority?: number;
      onComplete?: () => void;
      onError?: (error: Error) => void;
      interruptCurrent?: boolean; // Para eventos de bomba
      source?: 'queue' | 'horus' | 'dialog'; // ✅ NOVO: fonte do áudio
    } = {}
  ): string {
    const {
      label = 'audio',
      priority = AUDIO_PRIORITY.GENERIC,
      onComplete,
      onError,
      interruptCurrent = false,
      source = 'queue'
    } = options;
    
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // ✅ GLOBAL DEDUPE: Block if same audioUrl is already playing or in queue
    const isUrlPlaying = this.currentItem?.audioUrl === audioUrl;
    const isUrlInQueue = this.queue.some(q => q.audioUrl === audioUrl);
    if (isUrlPlaying || isUrlInQueue) {
      console.log(`[CentralAudioQueue] ⛔ URL dedupe blocked: "${label}" (already ${isUrlPlaying ? 'playing' : 'in queue'})`);
      onComplete?.();
      return id;
    }
    
    // ✅ FIX: Dedupe de QUESTION_READ - bloqueia leituras duplicadas da mesma pergunta
    if (priority === AUDIO_PRIORITY.QUESTION_READ) {
      const dedupeKey = label || audioUrl;
      const timeSinceLast = now - this.lastQuestionReadTime;
      
      // Se mesmo label/URL dentro da janela de dedupe, ignora
      if (this.lastQuestionReadLabel === dedupeKey && timeSinceLast < this.QUESTION_READ_DEDUPE_MS) {
        console.log(`[CentralAudioQueue] ⛔ QUESTION_READ duplicado bloqueado: "${dedupeKey}" (${timeSinceLast}ms atrás)`);
        onComplete?.();
        return id;
      }
      
      // Também verifica se já está na fila ou tocando
      const isInQueue = this.queue.some(q => q.priority === AUDIO_PRIORITY.QUESTION_READ);
      const isCurrentlyPlaying = this.currentItem?.priority === AUDIO_PRIORITY.QUESTION_READ;
      
      if (isInQueue || isCurrentlyPlaying) {
        console.log(`[CentralAudioQueue] ⛔ QUESTION_READ bloqueado - já existe na fila ou tocando`);
        onComplete?.();
        return id;
      }
      
      // Atualiza rastreamento
      this.lastQuestionReadLabel = dedupeKey;
      this.lastQuestionReadTime = now;
    }
    
    // ✅ Bloquear bord_1.mp3 na primeira rodada
    if (audioUrl.includes('bord_1.mp3') && this.currentRound <= 1) {
      console.log(`[CentralAudioQueue] ⛔ bord_1.mp3 bloqueado na rodada ${this.currentRound}`);
      onComplete?.();
      return id;
    }
    
    // Limitar bordões
    if (priority === AUDIO_PRIORITY.BORDAO) {
      if (now - this.lastBordaoTime < this.BORDAO_COOLDOWN) {
        console.log(`[CentralAudioQueue] ⏸️ Bordão ignorado (cooldown: ${Math.ceil((this.BORDAO_COOLDOWN - (now - this.lastBordaoTime)) / 1000)}s)`);
        onComplete?.();
        return id;
      }
      this.lastBordaoTime = now;
    }

    // ✅ NOVO: Lock global para eventos narrativos (bloqueia repetição por label na mesma partida)
    if (priority === AUDIO_PRIORITY.NARRATIVE_EVENT || this.NARRATIVE_EVENT_LABELS.includes(label)) {
      const lockedRound = this.narrativeEventLock.get(label);
      if (lockedRound !== undefined) {
        console.log(`[CentralAudioQueue] 🔒 Evento narrativo "${label}" bloqueado (já disparou na rodada ${lockedRound})`);
        onComplete?.();
        return id;
      }
      // Registra o lock para esta label
      this.narrativeEventLock.set(label, this.currentRound);
      console.log(`[CentralAudioQueue] 🔐 Evento narrativo "${label}" registrado para rodada ${this.currentRound}`);
    }
    
    const item: QueuedAudioItem = {
      id,
      audioUrl,
      label,
      priority,
      onComplete,
      onError,
      addedAt: Date.now(),
      source
    };
    
    console.log(`[CentralAudioQueue] ➕ Enqueue: ${label} (priority: ${priority}, source: ${source})`);
    
    // Interromper áudio atual se for evento de bomba
    if (interruptCurrent && this.isPlaying && this.currentAudio) {
      console.log(`[CentralAudioQueue] 💥 Interrompendo áudio atual para evento prioritário`);
      this.currentAudio.pause();
      this.currentAudio = null;
      if (this.currentItem?.onComplete) {
        this.currentItem.onComplete();
      }
      this.currentItem = null;
      this.isPlaying = false;
    }
    
    // Adicionar à fila
    this.queue.push(item);
    
    // Ordenar por prioridade (maior primeiro), depois por tempo (FIFO para mesma prioridade)
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.addedAt - b.addedAt;
    });
    
    this.notifyListeners();
    
    // ✅ MODIFICADO: Não processar se pausado
    if (!this.isPlaying && !this.isPaused) {
      this.processNext();
    }
    
    return id;
  }

  /**
   * ✅ NOVO: Método para outros sistemas enfileirarem com controle de fonte
   */
  enqueueExternal(
    audioUrl: string,
    source: 'horus' | 'dialog',
    priority: number = AUDIO_PRIORITY.HORUS_DIALOGUE,
    onComplete?: () => void
  ): string {
    // Pausar fila atual
    this.pauseFor(source);
    
    // Criar item com alta prioridade
    const id = this.enqueue(audioUrl, {
      priority,
      label: source,
      source,
      onComplete: () => {
        onComplete?.();
        this.resume(); // Retoma fila após terminar
      }
    });
    
    this.currentSource = source;
    return id;
  }

  /**
   * Processa o próximo item da fila
   */
  private async processNext(): Promise<void> {
    // ✅ MODIFICADO: Não processar se pausado
    if (this.isPaused) {
      console.log('[CentralAudioQueue] ⏸️ Paused - not processing');
      return;
    }
    
    if (this.isPlaying || this.queue.length === 0) {
      // Se fila vazia, restaurar música
      if (this.queue.length === 0 && this.isMusicDucked) {
        backgroundMusic.unduck();
        this.isMusicDucked = false;
        console.log(`[CentralAudioQueue] 🎵 Música restaurada (fila vazia)`);
      }
      return;
    }

    const item = this.queue.shift()!;
    this.currentItem = item;
    this.isPlaying = true;
    
    // Duck música enquanto houver áudio na fila
    if (!this.isMusicDucked) {
      backgroundMusic.duck();
      this.isMusicDucked = true;
      console.log(`[CentralAudioQueue] 🔉 Música reduzida (40%)`);
    }
    
    this.notifyListeners();

    // ✅ NOVO: Rastrear fonte atual
    this.currentSource = item.source;
    
    console.log(`[CentralAudioQueue] ▶️ Playing: ${item.label} (priority: ${item.priority}, source: ${item.source})`);

    try {
      await this.playAudio(item);
      item.onComplete?.();
    } catch (error) {
      console.error(`[CentralAudioQueue] ❌ Error playing ${item.label}:`, error);
      item.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    console.log(`[CentralAudioQueue] ✅ Finished: ${item.label}`);

    this.isPlaying = false;
    this.currentItem = null;
    this.currentAudio = null;
    this.currentSource = null; // ✅ NOVO: Limpar fonte
    this.notifyListeners();

    // Delay pequeno antes do próximo
    setTimeout(() => this.processNext(), 200);
  }

  /**
   * Toca um áudio e aguarda conclusão
   */
  private playAudio(item: QueuedAudioItem): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(item.audioUrl);
      this.currentAudio = audio;
      
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };

      const onEnded = () => {
        cleanup();
        resolve();
      };
      
      const onError = (e: Event) => {
        cleanup();
        console.error(`[CentralAudioQueue] Audio error for ${item.label}:`, e);
        resolve(); // Continua mesmo com erro
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      audio.play().catch((err) => {
        cleanup();
        console.error(`[CentralAudioQueue] Play error for ${item.label}:`, err);
        resolve(); // Continua mesmo com erro
      });

      // Timeout de segurança (45s máx por áudio)
      const timeoutId = setTimeout(() => {
        if (!audio.ended && !audio.paused) {
          console.warn(`[CentralAudioQueue] ⏱️ Timeout for ${item.label}, forcing next`);
          audio.pause();
          cleanup();
          resolve();
        }
      }, 45000);
      
      // Limpar timeout quando terminar
      audio.addEventListener('ended', () => clearTimeout(timeoutId), { once: true });
      audio.addEventListener('error', () => clearTimeout(timeoutId), { once: true });
    });
  }

  /**
   * Limpa toda a fila e para o áudio atual
   * Chamado ao mudar de tela ou encerrar rodada
   */
  clearQueue(): void {
    console.log('[CentralAudioQueue] 🗑️ Clearing queue and stopping audio');
    
    // Parar áudio atual
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    // Chamar callbacks de items removidos
    this.queue.forEach(item => {
      try {
        item.onComplete?.();
      } catch (e) {
        console.error('[CentralAudioQueue] Error in onComplete during clear:', e);
      }
    });
    
    // Limpar fila
    this.queue = [];
    this.isPlaying = false;
    this.currentItem = null;
    
    // Restaurar música
    if (this.isMusicDucked) {
      backgroundMusic.unduck();
      this.isMusicDucked = false;
    }
    
    this.notifyListeners();
  }

  /**
   * Remove um item específico da fila por ID
   */
  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    const [removed] = this.queue.splice(index, 1);
    removed.onComplete?.();
    this.notifyListeners();
    
    return true;
  }

  /**
   * Verifica se está tocando
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Retorna tamanho da fila
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Retorna label do áudio atual
   */
  getCurrentLabel(): string | null {
    return this.currentItem?.label || null;
  }

  /**
   * Subscribe para mudanças de estado
   */
  subscribe(callback: AudioQueueListener): () => void {
    this.listeners.add(callback);
    // Notificar estado atual imediatamente
    callback({
      isPlaying: this.isPlaying,
      currentLabel: this.currentItem?.label || null,
      queueLength: this.queue.length
    });
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const state = {
      isPlaying: this.isPlaying,
      currentLabel: this.currentItem?.label || null,
      queueLength: this.queue.length
    };
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (e) {
        console.error('[CentralAudioQueue] Error in listener:', e);
      }
    });
  }

  /**
   * Debug: retorna estado atual
   */
  getDebugState() {
    return {
      isPlaying: this.isPlaying,
      currentLabel: this.currentItem?.label,
      queueLength: this.queue.length,
      queueLabels: this.queue.map(q => `${q.label} (p:${q.priority})`),
      isMusicDucked: this.isMusicDucked,
    };
  }
}

// Singleton global
export const centralAudioQueue = new CentralAudioQueue();

// Helper functions para uso comum
export function playQuestionAudio(audioUrl: string, onComplete?: () => void): string {
  return centralAudioQueue.enqueue(audioUrl, {
    label: 'question_read',
    priority: AUDIO_PRIORITY.QUESTION_READ,
    onComplete
  });
}

export function playHorusDialogue(audioUrl: string, moment: string, onComplete?: () => void): string {
  return centralAudioQueue.enqueue(audioUrl, {
    label: `horus_${moment}`,
    priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
    onComplete
  });
}

export function playBordao(audioUrl: string, onComplete?: () => void): string {
  return centralAudioQueue.enqueue(audioUrl, {
    label: 'bordao',
    priority: AUDIO_PRIORITY.BORDAO,
    onComplete
  });
}

export function playMycroftAudio(audioUrl: string, onComplete?: () => void): string {
  return centralAudioQueue.enqueue(audioUrl, {
    label: 'mycroft',
    priority: AUDIO_PRIORITY.MYCROFT,
    onComplete
  });
}

export function playNarrativeEvent(audioUrl: string, eventName: string, onComplete?: () => void): string {
  return centralAudioQueue.enqueue(audioUrl, {
    label: `narrative_${eventName}`,
    priority: AUDIO_PRIORITY.NARRATIVE_EVENT,
    onComplete
  });
}

export function playBombEvent(audioUrl: string, onComplete?: () => void): string {
  return centralAudioQueue.enqueue(audioUrl, {
    label: 'bomb_event',
    priority: AUDIO_PRIORITY.BOMB_EVENT,
    interruptCurrent: true,
    onComplete
  });
}

export function clearAllAudio(): void {
  centralAudioQueue.clearQueue();
}

// ✅ NOVO: Função helper para definir a rodada atual
export function setAudioQueueRound(round: number): void {
  centralAudioQueue.setCurrentRound(round);
}

// ✅ NOVO: Função helper para resetar lock de eventos narrativos (chamar ao iniciar nova partida)
export function resetNarrativeAudioLock(): void {
  centralAudioQueue.resetNarrativeEventLock();
}
