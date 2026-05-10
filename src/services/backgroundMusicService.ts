// Background Music Service with Ducking and Tension Evolution
// Manages the game's theme music with automatic volume reduction when narration plays
// and dynamic tension scaling based on narrative acts

const THEME_AUDIO_PATH = '/audio/horus/tema.mp3';

// Volume levels
const BASE_VOLUME = 0.25; // Base volume for music
const DUCKED_VOLUME = 0.10; // Volume when someone is speaking
const FADE_DURATION = 500; // ms for volume transitions

// Tension levels per act (volume and playback rate adjustments)
interface TensionConfig {
  volumeMultiplier: number;
  playbackRate: number;
  description: string;
}

const ACT_TENSION_CONFIG: Record<string, TensionConfig> = {
  'initiation': { 
    volumeMultiplier: 0.7, 
    playbackRate: 0.95, 
    description: 'Ato I: Calmo, introdutório' 
  },
  'trial': { 
    volumeMultiplier: 0.85, 
    playbackRate: 1.0, 
    description: 'Ato II: Tensão crescente' 
  },
  'ascension': { 
    volumeMultiplier: 1.0, 
    playbackRate: 1.02, 
    description: 'Ato III: Intensidade plena' 
  },
  'fall': { 
    volumeMultiplier: 1.15, 
    playbackRate: 1.05, 
    description: 'Ato IV: Pressão máxima' 
  },
  'climax': { 
    volumeMultiplier: 1.3, 
    playbackRate: 1.08, 
    description: 'Ato V: Clímax final' 
  },
};

// Pressure level based volume boost (0-100 pressure level)
function getPressureVolumeBoost(pressureLevel: number): number {
  // Adds up to 20% more volume at maximum pressure
  return 1 + (pressureLevel / 100) * 0.2;
}

class BackgroundMusicService {
  private audio: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private isDucked: boolean = false;
  private currentAct: string = 'trial';
  private currentPressure: number = 0;
  private fadeInterval: number | null = null;
  private targetVolume: number = BASE_VOLUME;

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
    
    // Apply initial playback rate based on act
    const config = ACT_TENSION_CONFIG[this.currentAct] || ACT_TENSION_CONFIG['trial'];
    this.audio.playbackRate = config.playbackRate;
    
    // Start at zero and fade in
    this.audio.volume = 0;
    this.audio.play().catch(err => {
      console.warn('[BGMusic] Failed to start:', err);
      this.isPlaying = false;
    });
    
    // Fade in to target volume
    this.fadeToVolume(this.getTargetVolume());
    console.log(`[BGMusic] Started - ${config.description}`);
  }

  // Stop the music with fade out
  stop() {
    if (!this.audio || !this.isPlaying) return;
    
    this.fadeToVolume(0, () => {
      this.audio?.pause();
      if (this.audio) this.audio.currentTime = 0;
      this.isPlaying = false;
      console.log('[BGMusic] Stopped');
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
    this.fadeToVolume(this.getTargetVolume());
  }

  // Update the current act (for tension evolution)
  setAct(actId: string) {
    if (this.currentAct === actId) return;
    
    const oldAct = this.currentAct;
    this.currentAct = actId;
    
    const config = ACT_TENSION_CONFIG[actId] || ACT_TENSION_CONFIG['trial'];
    console.log(`[BGMusic] Act changed: ${oldAct} -> ${actId} (${config.description})`);
    
    if (this.audio) {
      // Smoothly adjust playback rate
      this.audio.playbackRate = config.playbackRate;
    }
    
    // If playing and not ducked, adjust volume to new act level
    if (this.isPlaying && !this.isDucked) {
      this.fadeToVolume(this.getTargetVolume());
    }
  }

  // Update pressure level (0-100) for dynamic volume
  setPressure(level: number) {
    const clampedLevel = Math.max(0, Math.min(100, level));
    if (this.currentPressure === clampedLevel) return;
    
    this.currentPressure = clampedLevel;
    
    // Only adjust volume if playing and not ducked
    if (this.isPlaying && !this.isDucked) {
      this.fadeToVolume(this.getTargetVolume());
    }
  }

  // Get the target volume based on act and pressure
  private getTargetVolume(): number {
    const actConfig = ACT_TENSION_CONFIG[this.currentAct] || ACT_TENSION_CONFIG['trial'];
    const actVolume = BASE_VOLUME * actConfig.volumeMultiplier;
    const pressureBoost = getPressureVolumeBoost(this.currentPressure);
    
    // Cap at 50% max volume
    return Math.min(actVolume * pressureBoost, 0.5);
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
    setPressure: (level: number) => backgroundMusic.setPressure(level),
    isPlaying: () => backgroundMusic.getIsPlaying(),
    isDucked: () => backgroundMusic.getIsDucked(),
  };
}
