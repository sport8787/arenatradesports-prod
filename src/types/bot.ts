// Shadow Players - desafiantes humanizados para o modo "Desafie o Hórus"
export interface ShadowPlayer {
  id: string;
  nickname: string;
  avatar: string; // Emoji or URL
  bluffVoteChance: number; // Chance to vote BLEFE when player is lying
  claroVoteChance: number; // Chance to vote CLARO when player is telling truth
}

// Pool of human names for Shadow Players
export const SHADOW_PLAYER_NAMES = [
  'Ricardo', 'Beatriz', 'Marcos', 'Carolina', 'Felipe',
  'Juliana', 'André', 'Larissa', 'Thiago', 'Mariana',
  'Lucas', 'Fernanda', 'Gabriel', 'Amanda', 'Pedro',
  'Isabela', 'Bruno', 'Camila', 'Rodrigo', 'Letícia',
  'Gustavo', 'Patrícia', 'Henrique', 'Bianca', 'Vinícius',
  'Renata', 'Diego', 'Natália', 'Rafael', 'Aline',
];

// Avatar emojis for Shadow Players
export const SHADOW_PLAYER_AVATARS = [
  '👤', '👨', '👩', '🧑', '👱', '👱‍♀️', '🧔', '👩‍🦱', '👨‍🦱', '👩‍🦰',
  '👨‍🦰', '👩‍🦳', '👨‍🦳', '🧑‍🦱', '🧑‍🦰', '🙂', '😊', '🙃', '😌', '🤔',
];

// Generate random Shadow Players
export function generateShadowPlayers(count: number = 3): ShadowPlayer[] {
  const shuffledNames = [...SHADOW_PLAYER_NAMES].sort(() => Math.random() - 0.5);
  const shuffledAvatars = [...SHADOW_PLAYER_AVATARS].sort(() => Math.random() - 0.5);
  
  return shuffledNames.slice(0, count).map((name, i) => ({
    id: `shadow-${i}`,
    nickname: name,
    avatar: shuffledAvatars[i] || '👤',
    // Varied voting behavior for realism
    bluffVoteChance: 0.45 + Math.random() * 0.25, // 45-70% chance to detect lies
    claroVoteChance: 0.65 + Math.random() * 0.25, // 65-90% chance to believe truths
  }));
}

// Legacy Bot interface for backwards compatibility
export interface Bot {
  id: string;
  nickname: string;
  personality: 'skeptic' | 'naive' | 'balanced';
  description: string;
  avatar: string;
  bluffVoteChance: number;
  claroVoteChance: number;
}

// Legacy BOTS array - now uses humanized names
export const BOTS: Bot[] = [
  {
    id: 'bot-1',
    nickname: 'Ricardo',
    personality: 'skeptic',
    description: 'Jogador experiente',
    avatar: '👨',
    bluffVoteChance: 0.70,
    claroVoteChance: 0.65,
  },
  {
    id: 'bot-2',
    nickname: 'Beatriz',
    personality: 'naive',
    description: 'Jogadora casual',
    avatar: '👩',
    bluffVoteChance: 0.45,
    claroVoteChance: 0.85,
  },
  {
    id: 'bot-3',
    nickname: 'Marcos',
    personality: 'balanced',
    description: 'Jogador estratégico',
    avatar: '🧔',
    bluffVoteChance: 0.55,
    claroVoteChance: 0.75,
  },
];

export interface BotVote {
  botId: string;
  botName: string;
  vote: 'believe' | 'doubt';
}

// Voice analysis results from Mycroft
export interface VoiceAnalysisResult {
  conviction: 'high' | 'medium' | 'low';
  nervousness: 'high' | 'medium' | 'low';
  skippedAudio: boolean;
}

// Analyze voice metrics to determine conviction/nervousness
export function analyzeVoiceForVoting(voiceMetrics: {
  responseLatencyMs?: number;
  pitchStability?: 'stable' | 'unstable' | 'micro-tremors';
  speechRateBPM?: number;
  peakAmplitude?: number;
} | null, hasAudio: boolean): VoiceAnalysisResult {
  // If no audio was recorded
  if (!hasAudio || !voiceMetrics) {
    return { conviction: 'low', nervousness: 'medium', skippedAudio: true };
  }
  
  const { responseLatencyMs = 0, pitchStability = 'stable', speechRateBPM = 120, peakAmplitude = 0 } = voiceMetrics;
  
  // Analyze conviction based on response time and speech rate
  let conviction: 'high' | 'medium' | 'low' = 'medium';
  if (responseLatencyMs < 1000 && speechRateBPM >= 100 && peakAmplitude > 0.3) {
    conviction = 'high';
  } else if (responseLatencyMs > 3000 || speechRateBPM < 80 || peakAmplitude < 0.1) {
    conviction = 'low';
  }
  
  // Analyze nervousness based on pitch stability
  let nervousness: 'high' | 'medium' | 'low' = 'medium';
  if (pitchStability === 'unstable' || (responseLatencyMs > 2000 && speechRateBPM > 180)) {
    nervousness = 'high';
  } else if (pitchStability === 'stable' && speechRateBPM >= 80 && speechRateBPM <= 150) {
    nervousness = 'low';
  }
  
  return { conviction, nervousness, skippedAudio: false };
}

// Calculate bot votes based on whether the player answered correctly
// Now influenced by voice analysis when available
export function calculateBotVotes(
  playerAnsweredCorrectly: boolean, 
  customBots?: ShadowPlayer[],
  voiceAnalysis?: VoiceAnalysisResult
): BotVote[] {
  const players = customBots || BOTS;
  
  // Calculate vote probability modifiers based on voice analysis
  let believeModifier = 0; // Positive = more likely to believe, Negative = more likely to doubt
  
  if (voiceAnalysis) {
    // Skipped audio = suspicious
    if (voiceAnalysis.skippedAudio) {
      believeModifier -= 0.15;
    }
    
    // High conviction = more believable
    if (voiceAnalysis.conviction === 'high') {
      believeModifier += 0.20;
    } else if (voiceAnalysis.conviction === 'low') {
      believeModifier -= 0.15;
    }
    
    // High nervousness = suspicious (unless telling truth)
    if (voiceAnalysis.nervousness === 'high') {
      believeModifier -= 0.20;
    } else if (voiceAnalysis.nervousness === 'low') {
      believeModifier += 0.10;
    }
  }
  
  return players.map(player => {
    const random = Math.random();
    
    if (playerAnsweredCorrectly) {
      // Player told the truth - voice analysis makes them more/less convincing
      const adjustedChance = Math.min(0.95, Math.max(0.1, player.claroVoteChance + believeModifier));
      const votesClaro = random < adjustedChance;
      return {
        botId: player.id,
        botName: player.nickname,
        vote: votesClaro ? 'believe' : 'doubt',
      };
    } else {
      // Player lied (wrong answer) - voice analysis affects detection
      const adjustedChance = Math.min(0.95, Math.max(0.1, player.bluffVoteChance - believeModifier));
      const votesBlefe = random < adjustedChance;
      return {
        botId: player.id,
        botName: player.nickname,
        vote: votesBlefe ? 'doubt' : 'believe',
      };
    }
  });
}

// AI taunts when catching a bluff - now more human-like
export const AI_TAUNT_MESSAGES = [
  'Achei que você estava forçando a barra. Blefe na cara! 🎭',
  'Desculpa, mas não colou essa não. 😏',
  'Você hesitou demais. Isso me denunciou. 🤔',
  'Conheço esse tipo de conversa. Blefe! 🕵️',
  'A voz tremeu um pouquinho ali. Peguei! 👀',
  'Tentou, mas não convenceu. Blefe! 💭',
  'Resposta muito ensaiada. Não caí. 🙅',
  'Minha intuição disse que era mentira. ✨',
];

export function getRandomTaunt(): string {
  return AI_TAUNT_MESSAGES[Math.floor(Math.random() * AI_TAUNT_MESSAGES.length)];
}
