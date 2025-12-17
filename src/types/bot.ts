export interface Bot {
  id: string;
  nickname: string;
  personality: 'skeptic' | 'naive' | 'balanced';
  description: string;
  avatar: string;
  bluffVoteChance: number; // Chance to vote BLEFE when player is lying
  claroVoteChance: number; // Chance to vote CLARO when player is telling truth
}

export const BOTS: Bot[] = [
  {
    id: 'bot-1',
    nickname: 'O Cético',
    personality: 'skeptic',
    description: 'Desconfia de tudo. Vota mais em BLEFE.',
    avatar: '🕵️',
    bluffVoteChance: 0.75, // 75% chance to vote BLEFE on lies
    claroVoteChance: 0.60, // 60% chance to vote CLARO on truths
  },
  {
    id: 'bot-2',
    nickname: 'O Ingênuo',
    personality: 'naive',
    description: 'Acredita em quase tudo. Vota mais em CLARO.',
    avatar: '😊',
    bluffVoteChance: 0.40, // 40% chance to vote BLEFE on lies
    claroVoteChance: 0.90, // 90% chance to vote CLARO on truths
  },
  {
    id: 'bot-3',
    nickname: 'Mycroft V2',
    personality: 'balanced',
    description: 'IA equilibrada. Analisa padrões.',
    avatar: '🤖',
    bluffVoteChance: 0.60, // 60% chance to vote BLEFE on lies (as per spec)
    claroVoteChance: 0.80, // 80% chance to vote CLARO on truths (as per spec)
  },
];

export interface BotVote {
  botId: string;
  botName: string;
  vote: 'believe' | 'doubt';
}

// Calculate bot votes based on whether the player answered correctly
export function calculateBotVotes(playerAnsweredCorrectly: boolean): BotVote[] {
  return BOTS.map(bot => {
    const random = Math.random();
    
    if (playerAnsweredCorrectly) {
      // Player told the truth
      // Higher claroVoteChance = more likely to vote CLARO
      const votesClaro = random < bot.claroVoteChance;
      return {
        botId: bot.id,
        botName: bot.nickname,
        vote: votesClaro ? 'believe' : 'doubt',
      };
    } else {
      // Player lied (wrong answer)
      // Higher bluffVoteChance = more likely to vote BLEFE
      const votesBlefe = random < bot.bluffVoteChance;
      return {
        botId: bot.id,
        botName: bot.nickname,
        vote: votesBlefe ? 'doubt' : 'believe',
      };
    }
  });
}

// AI taunts when catching a bluff
export const AI_TAUNT_MESSAGES = [
  'Meus algoritmos detectaram sua hesitação. Tente novamente, humano. 🤖',
  'Frequência cardíaca elevada. Padrão vocal inconsistente. BLEFE detectado. 📊',
  'Você hesitou por 0.3 segundos. Isso é tudo que eu precisava saber. ⏱️',
  'Análise de microexpressões: 94% de probabilidade de mentira. 🔬',
  'Sua pupila dilatou. Sinal clássico de fabricação narrativa. 👁️',
  'Processando... Mentira identificada. Previsível, humano. 💾',
  'Variação de pitch vocal detectada. Não tente enganar uma IA. 🎙️',
  'Meu treinamento inclui 10 bilhões de mentiras. A sua não foi original. 📚',
];

export function getRandomTaunt(): string {
  return AI_TAUNT_MESSAGES[Math.floor(Math.random() * AI_TAUNT_MESSAGES.length)];
}
