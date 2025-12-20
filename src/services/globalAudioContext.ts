// Global AudioContext manager for consistent audio playback across screen transitions
// This prevents audio from being cut during navigation

let globalAudioContext: AudioContext | null = null;
let globalAudio: HTMLAudioElement | null = null;
let isInitialized = false;

export function getGlobalAudioContext(): AudioContext {
  if (!globalAudioContext || globalAudioContext.state === 'closed') {
    globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log('[GlobalAudio] Created new AudioContext');
  }
  return globalAudioContext;
}

export function initializeAudioContext(): void {
  if (isInitialized) return;
  
  // Initialize on first user interaction
  const handleInteraction = () => {
    const ctx = getGlobalAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('[GlobalAudio] AudioContext resumed after user interaction');
      });
    }
    isInitialized = true;
    document.removeEventListener('click', handleInteraction);
    document.removeEventListener('touchstart', handleInteraction);
  };

  document.addEventListener('click', handleInteraction);
  document.addEventListener('touchstart', handleInteraction);
}

export function playGlobalAudio(
  url: string, 
  onEnded?: () => void,
  onError?: (error: Error) => void
): HTMLAudioElement {
  // Stop any existing audio
  if (globalAudio) {
    globalAudio.pause();
    globalAudio.onended = null;
    globalAudio.onerror = null;
    globalAudio.src = '';
  }

  const audio = new Audio();
  globalAudio = audio;

  // Ensure AudioContext is running
  const ctx = getGlobalAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  audio.onended = () => {
    console.log('[GlobalAudio] Playback ended');
    if (onEnded) onEnded();
  };

  audio.onerror = (e) => {
    console.error('[GlobalAudio] Playback error:', e);
    if (onError) onError(new Error('Audio playback failed'));
  };

  audio.oncanplaythrough = async () => {
    try {
      await audio.play();
      console.log('[GlobalAudio] Playback started');
    } catch (err) {
      console.error('[GlobalAudio] Play failed:', err);
      if (onError) onError(err as Error);
    }
  };

  audio.src = url;
  audio.load();

  return audio;
}

export function stopGlobalAudio(): void {
  if (globalAudio) {
    globalAudio.pause();
    globalAudio.currentTime = 0;
    console.log('[GlobalAudio] Playback stopped');
  }
}

export function getGlobalAudioElement(): HTMLAudioElement | null {
  return globalAudio;
}

// Initialize on module load
if (typeof window !== 'undefined') {
  initializeAudioContext();
}
