// Audio Preloader Service
// Pre-caches common TTS phrases when player enters the lobby to reduce latency during gameplay

import { getCachedAudio } from './audioCacheService';
import { GameMoment } from '@/types/personas';

// Most frequently used phrases to pre-cache
// These are the phrases that appear most often in every game session
const PRIORITY_PHRASES: { text: string; personaId: 'horus' | 'mycroft'; moment: GameMoment }[] = [
  // Round start - every round
  { text: 'A caçada começou. Jogadores, posicionem suas máscaras. O tribunal está aberto.', personaId: 'horus', moment: 'round_start' },
  { text: 'Uma nova rodada se inicia. Quem será o mestre do engano desta vez?', personaId: 'horus', moment: 'round_start' },
  { text: 'Olhos bem abertos, mentes afiadas. É hora de blefar!', personaId: 'horus', moment: 'round_start' },
  
  // Correct answer - common outcome
  { text: 'Impressionante! Você realmente sabia essa.', personaId: 'horus', moment: 'correct_answer' },
  { text: 'Olha só, alguém estudou! Parabéns, gênio.', personaId: 'horus', moment: 'correct_answer' },
  { text: 'Resposta correta! Mas não se anime, isso foi fácil.', personaId: 'horus', moment: 'correct_answer' },
  
  // Wrong answer - common outcome  
  { text: 'Errou! Agora só o blefe pode te salvar.', personaId: 'horus', moment: 'wrong_answer' },
  { text: 'Resposta errada! Hora de colocar sua cara de pau em ação.', personaId: 'horus', moment: 'wrong_answer' },
  { text: 'Não era essa, mas quem liga? Minta com convicção!', personaId: 'horus', moment: 'wrong_answer' },
  
  // Bluff success
  { text: 'Vendeu gelo para esquimó! Que performance!', personaId: 'horus', moment: 'bluff_success' },
  { text: 'O Oscar vai para... você! Que mentira bem contada!', personaId: 'horus', moment: 'bluff_success' },
  { text: 'Eles cairam como patinhos! Você é um monstro!', personaId: 'horus', moment: 'bluff_success' },
  
  // Bluff fail
  { text: 'Pego no pulo! Sua cara te entregou!', personaId: 'horus', moment: 'bluff_fail' },
  { text: 'Fracasso total! Precisa treinar mais essa cara de pau.', personaId: 'horus', moment: 'bluff_fail' },
  { text: 'O júri não comprou! Você tremeu na base!', personaId: 'horus', moment: 'bluff_fail' },
  
  // Jury deliberation - every round
  { text: 'O júri está deliberando... Seu destino está nas mãos deles agora.', personaId: 'horus', moment: 'jury_deliberation' },
  { text: 'Os votos estão sendo contados. Respire fundo, o veredicto vem aí.', personaId: 'horus', moment: 'jury_deliberation' },
  
  // Mycroft fixed introductions
  { text: 'Protocolo de análise concluído.', personaId: 'mycroft', moment: 'verdict' },
  { text: 'Análise em processamento...', personaId: 'mycroft', moment: 'verdict' },
];

// Secondary phrases - loaded after priority ones
const SECONDARY_PHRASES: { text: string; personaId: 'horus' | 'mycroft'; moment: GameMoment }[] = [
  // Post-vote bribe offers
  { text: 'Seu destino já foi selado pelo júri. Você confia na sua mentira ou prefere aceitar meu acordo?', personaId: 'horus', moment: 'post_vote_bribe' },
  { text: 'Os votos foram contados. O veredicto está pronto. Eu tenho um Pacto de Cavalheiros para você.', personaId: 'horus', moment: 'post_vote_bribe' },
  
  // Elimination
  { text: 'Você caiu! O trono agora pertence a outro!', personaId: 'horus', moment: 'elimination' },
  { text: 'Eliminado! Seus dias de glória acabaram!', personaId: 'horus', moment: 'elimination' },
  
  // Victory
  { text: 'Vitória absoluta! Você é o mestre supremo do blefe!', personaId: 'horus', moment: 'victory' },
  { text: 'Parabéns, campeão! Você conquistou todas as rodadas!', personaId: 'horus', moment: 'victory' },
  
  // Briefcase
  { text: 'Espere! Antes de arriscar tudo, olhe para esta maleta. Ela tem o peso da segurança. Você prefere a verdade ou o prêmio garantido?', personaId: 'horus', moment: 'briefcase_offer' },
  
  // All-in
  { text: 'É tudo ou nada! A rodada final chegou! Você está preparado para apostar tudo?', personaId: 'horus', moment: 'all_in' },
  
  // All-in loss
  { text: 'Você deveria ter aceitado a Maleta Misteriosa... agora, você sai de mãos vazias.', personaId: 'horus', moment: 'all_in_loss' },
];

interface PreloadProgress {
  loaded: number;
  total: number;
  isComplete: boolean;
  currentPhrase?: string;
}

type ProgressCallback = (progress: PreloadProgress) => void;

let isPreloading = false;
let preloadComplete = false;

export async function preloadCommonPhrases(onProgress?: ProgressCallback): Promise<void> {
  if (isPreloading || preloadComplete) {
    console.log('[AudioPreloader] Already preloading or complete, skipping');
    return;
  }

  isPreloading = true;
  const allPhrases = [...PRIORITY_PHRASES, ...SECONDARY_PHRASES];
  const total = allPhrases.length;
  let loaded = 0;

  console.log('[AudioPreloader] Starting preload of', total, 'phrases');

  // Process priority phrases first (in parallel batches of 3)
  const priorityBatches = chunkArray(PRIORITY_PHRASES, 3);
  
  for (const batch of priorityBatches) {
    await Promise.all(
      batch.map(async (phrase) => {
        try {
          await getCachedAudio({
            text: phrase.text,
            personaId: phrase.personaId,
            moment: phrase.moment,
            cacheOnly: true,
          });
          loaded++;
          onProgress?.({
            loaded,
            total,
            isComplete: false,
            currentPhrase: phrase.text.substring(0, 40) + '...',
          });
        } catch (error) {
          console.warn('[AudioPreloader] Failed to preload:', phrase.text.substring(0, 30), error);
          loaded++;
        }
      })
    );
  }

  console.log('[AudioPreloader] Priority phrases complete, loading secondary...');

  // Process secondary phrases (in parallel batches of 2, slower to not overwhelm)
  const secondaryBatches = chunkArray(SECONDARY_PHRASES, 2);
  
  for (const batch of secondaryBatches) {
    await Promise.all(
      batch.map(async (phrase) => {
        try {
          await getCachedAudio({
            text: phrase.text,
            personaId: phrase.personaId,
            moment: phrase.moment,
            cacheOnly: true,
          });
          loaded++;
          onProgress?.({
            loaded,
            total,
            isComplete: false,
            currentPhrase: phrase.text.substring(0, 40) + '...',
          });
        } catch (error) {
          console.warn('[AudioPreloader] Failed to preload:', phrase.text.substring(0, 30), error);
          loaded++;
        }
      })
    );
    
    // Small delay between batches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  isPreloading = false;
  preloadComplete = true;

  console.log('[AudioPreloader] Preload complete!', loaded, '/', total, 'phrases cached');
  
  onProgress?.({
    loaded,
    total,
    isComplete: true,
  });
}

export function isPreloadComplete(): boolean {
  return preloadComplete;
}

export function resetPreloadState(): void {
  preloadComplete = false;
  isPreloading = false;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
