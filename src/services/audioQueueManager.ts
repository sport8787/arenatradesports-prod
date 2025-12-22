/**
 * GERENCIADOR CENTRAL DE FILA DE ÁUDIO
 * =====================================
 * Garante que apenas UM áudio toque por vez em toda a aplicação.
 * Todos os componentes (Hórus, Mycroft, bordões) devem usar este gerenciador.
 */

interface QueuedAudio {
  id: string;
  audioUrl: string;
  label: string; // Para debug
  priority: number; // Maior = mais urgente
  onComplete?: () => void;
}

class AudioQueueManager {
  private queue: QueuedAudio[] = [];
  private isPlaying: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentId: string | null = null;
  private listeners: Set<(isPlaying: boolean) => void> = new Set();

  /**
   * Adiciona um áudio à fila
   */
  addToQueue(
    audioUrl: string,
    label: string = 'audio',
    priority: number = 0,
    onComplete?: () => void
  ): string {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[AudioQueue] ➕ Enqueue: ${label} (priority: ${priority})`);
    
    this.queue.push({
      id,
      audioUrl,
      label,
      priority,
      onComplete,
    });
    
    // Ordena por prioridade (maior primeiro)
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Inicia processamento se não estiver tocando
    if (!this.isPlaying) {
      this.processNext();
    }
    
    return id;
  }

  /**
   * Processa o próximo item da fila
   */
  private async processNext(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift()!;
    this.isPlaying = true;
    this.currentId = item.id;
    this.notifyListeners();

    console.log(`[AudioQueue] ▶️ Playing: ${item.label}`);

    try {
      await this.playAudio(item.audioUrl, item.label);
    } catch (error) {
      console.error(`[AudioQueue] ❌ Error playing ${item.label}:`, error);
    }

    // Chama callback de conclusão
    if (item.onComplete) {
      try {
        item.onComplete();
      } catch (e) {
        console.error('[AudioQueue] Error in onComplete callback:', e);
      }
    }

    console.log(`[AudioQueue] ✅ Finished: ${item.label}`);

    this.isPlaying = false;
    this.currentId = null;
    this.currentAudio = null;
    this.notifyListeners();

    // Pequeno delay antes do próximo
    setTimeout(() => this.processNext(), 250);
  }

  /**
   * Toca um áudio e aguarda conclusão
   */
  private playAudio(url: string, label: string): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onended = () => {
        resolve();
      };

      audio.onerror = (e) => {
        console.error(`[AudioQueue] Audio error for ${label}:`, e);
        resolve(); // Continua mesmo com erro
      };

      audio.play().catch((err) => {
        console.error(`[AudioQueue] Play error for ${label}:`, err);
        // Fallback: aguarda 3s e continua
        setTimeout(resolve, 3000);
      });

      // Timeout de segurança (30s máx por áudio)
      setTimeout(() => {
        if (!audio.ended) {
          console.warn(`[AudioQueue] Timeout for ${label}, forcing next`);
          audio.pause();
          resolve();
        }
      }, 30000);
    });
  }

  /**
   * Limpa toda a fila e para o áudio atual
   */
  clearQueue(): void {
    console.log('[AudioQueue] 🗑️ Clearing queue');
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    this.queue = [];
    this.isPlaying = false;
    this.currentId = null;
    this.notifyListeners();
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
   * Adiciona listener para mudanças de estado
   */
  subscribe(callback: (isPlaying: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.isPlaying));
  }

  /**
   * Debug: retorna estado atual
   */
  getDebugState() {
    return {
      isPlaying: this.isPlaying,
      currentId: this.currentId,
      queueLength: this.queue.length,
      queueLabels: this.queue.map(q => q.label),
    };
  }
}

// Singleton global
export const audioQueue = new AudioQueueManager();

// Hook helper para React
export function useAudioQueueState() {
  // Este hook pode ser importado e usado para observar o estado
  return {
    addToQueue: audioQueue.addToQueue.bind(audioQueue),
    clearQueue: audioQueue.clearQueue.bind(audioQueue),
    getIsPlaying: audioQueue.getIsPlaying.bind(audioQueue),
    subscribe: audioQueue.subscribe.bind(audioQueue),
  };
}
