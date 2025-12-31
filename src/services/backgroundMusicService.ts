// Background Music Service with Ducking
// Manages the game's theme music with automatic volume reduction when narration plays

const THEME_AUDIO_PATH = '/audio/horus/tema.mp3';

// Volume levels
const NORMAL_VOLUME = 0.35; // Base volume for music
const DUCKED_VOLUME = 0.15; // Volume when someone is speaking (40% reduction)
const FADE_DURATION = 500; // ms for volume transitions

// Volume multipliers per act (tension evolution)
const ACT_VOLUME_MULTIPLIERS: Record<string, number> = {
  'initiation': 0.8,  // Ato I: Subtle
  'trial': 0.9,       // Ato II: Building
  'ascension': 1.0,   // Ato III: Full
  'fall': 1.1,        // Ato IV: Intense
  'climax': 1.2,      // Ato V: Maximum
};

class BackgroundMusicService {
  private audio: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private isDucked: boolean = false;
  private currentAct: string = 'trial';
  private fadeInterval: number | null = null;
  private targetVolume: number = NORMAL_VOLUME;

  constructor() {
    this.initAudio();
  }

  private initAudio() {
    if (typeof window === 'undefined') return;
    
    this.audio = new Audio(THEME_AUDIO_PATH);
    this.audio.loop = true;
    this.audio.volume = 0;
    this.audio.preload = 'auto';
  }

  // Start playing the theme music (called after Round 2)
  start(currentAct: string = 'trial') {
    if (!this.audio || this.isPlaying) return;
    
    this.currentAct = currentAct;
    this.isPlaying = true;
    
    // Start at zero and fade in
    this.audio.volume = 0;
    this.audio.play().catch(err => {
      console.warn('[BGMusic] Failed to start:', err);
      this.isPlaying = false;
    });
    
    // Fade in to target volume
    this.fadeToVolume(this.getActVolume());
  }

  // Stop the music with fade out
  stop() {
    if (!this.audio || !this.isPlaying) return;
    
    this.fadeToVolume(0, () => {
      this.audio?.pause();
      if (this.audio) this.audio.currentTime = 0;
      this.isPlaying = false;
    });
  }

  // Pause without stopping
  pause() {
    if (!this.audio || !this.isPlaying) return;
    this.audio.pause();
  }

  // Resume if was playing
  resume() {
    if (!this.audio || !this.isPlaying) return;
    this.audio.play().catch(console.warn);
  }

  // Duck the volume when narration starts
  duck() {
    if (!this.audio || !this.isPlaying || this.isDucked) return;
    
    this.isDucked = true;
    this.fadeToVolume(DUCKED_VOLUME);
  }

  // Restore volume when narration ends
  unduck() {
    if (!this.audio || !this.isPlaying || !this.isDucked) return;
    
    this.isDucked = false;
    this.fadeToVolume(this.getActVolume());
  }

  // Update the current act (for tension evolution)
  setAct(actId: string) {
    if (this.currentAct === actId) return;
    
    this.currentAct = actId;
    
    // If playing and not ducked, adjust volume to new act level
    if (this.isPlaying && !this.isDucked) {
      this.fadeToVolume(this.getActVolume());
    }
  }

  // Get the target volume for current act
  private getActVolume(): number {
    const multiplier = ACT_VOLUME_MULTIPLIERS[this.currentAct] || 1.0;
    return Math.min(NORMAL_VOLUME * multiplier, 0.5); // Cap at 50%
  }

  // Smooth volume transition
  private fadeToVolume(targetVolume: number, onComplete?: () => void) {
    if (!this.audio) return;
    
    // Clear any existing fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }
    
    this.targetVolume = targetVolume;
    const startVolume = this.audio.volume;
    const volumeDiff = targetVolume - startVolume;
    const steps = 20;
    const stepDuration = FADE_DURATION / steps;
    let currentStep = 0;
    
    this.fadeInterval = window.setInterval(() => {
      currentStep++;
      
      if (!this.audio) {
        clearInterval(this.fadeInterval!);
        return;
      }
      
      if (currentStep >= steps) {
        this.audio.volume = targetVolume;
        clearInterval(this.fadeInterval!);
        this.fadeInterval = null;
        onComplete?.();
        return;
      }
      
      // Ease-out curve for smooth transition
      const progress = currentStep / steps;
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      this.audio.volume = startVolume + (volumeDiff * easedProgress);
    }, stepDuration);
  }

  // Check if music is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Check if music is currently ducked
  getIsDucked(): boolean {
    return this.isDucked;
  }

  // Cleanup
  destroy() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }
    this.stop();
    this.audio = null;
  }
}

// Singleton instance
export const backgroundMusic = new BackgroundMusicService();

// Hook for React components
export function useBackgroundMusic() {
  return {
    start: (act?: string) => backgroundMusic.start(act),
    stop: () => backgroundMusic.stop(),
    pause: () => backgroundMusic.pause(),
    resume: () => backgroundMusic.resume(),
    duck: () => backgroundMusic.duck(),
    unduck: () => backgroundMusic.unduck(),
    setAct: (actId: string) => backgroundMusic.setAct(actId),
    isPlaying: () => backgroundMusic.getIsPlaying(),
    isDucked: () => backgroundMusic.getIsDucked(),
  };
}
