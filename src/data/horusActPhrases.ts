// Frases do Hórus organizadas por Ato Narrativo
// Sistema de 5 Atos para progressão dramática do jogo

import { NarrativeAct } from '@/services/narrativeEngine';

export interface ActPhrase {
  id: string;
  text: string;
  emotion: 'neutral' | 'curious' | 'impressed' | 'tense' | 'dramatic';
  trigger: 'correct' | 'wrong' | 'bluff_success' | 'transition' | 'taunt' | 'opening';
}

// ============================================================
// ATO I - A INICIAÇÃO (Rodadas 1-3)
// Tom: Neutro e professoral
// Hórus apresenta o jogo como um mestre apresenta um pupilo
// ============================================================
export const ACT_I_PHRASES: ActPhrase[] = [
  // Abertura
  { id: 'i_opening_1', text: 'Bem-vindo ao tribunal das ilusões. Aqui, a verdade é apenas uma perspectiva.', emotion: 'neutral', trigger: 'opening' },
  { id: 'i_opening_2', text: 'As cartas estão postas. Vamos ver se você sabe jogar.', emotion: 'neutral', trigger: 'opening' },
  { id: 'i_opening_3', text: 'Cada pergunta é um teste. Cada resposta, um passo no caminho.', emotion: 'neutral', trigger: 'opening' },
  
  // Acertos
  { id: 'i_correct_1', text: 'Interessante. Você conhece o básico.', emotion: 'neutral', trigger: 'correct' },
  { id: 'i_correct_2', text: 'Correto. Mas isso foi apenas aquecimento.', emotion: 'neutral', trigger: 'correct' },
  { id: 'i_correct_3', text: 'Hmm, anotado. Prossigamos.', emotion: 'neutral', trigger: 'correct' },
  { id: 'i_correct_4', text: 'O caminho do vendedor é longo. Continue.', emotion: 'neutral', trigger: 'correct' },
  
  // Erros
  { id: 'i_wrong_1', text: 'Um tropeço. Normal para quem está começando.', emotion: 'neutral', trigger: 'wrong' },
  { id: 'i_wrong_2', text: 'Erro de principiante. Aprenda com ele.', emotion: 'neutral', trigger: 'wrong' },
  { id: 'i_wrong_3', text: 'O conhecimento vem com a prática. Ou com a dor.', emotion: 'neutral', trigger: 'wrong' },
  
  // Blefe bem-sucedido
  { id: 'i_bluff_1', text: 'Você conseguiu enganá-los. Talvez haja potencial.', emotion: 'neutral', trigger: 'bluff_success' },
  { id: 'i_bluff_2', text: 'Primeira ilusão bem executada. Veremos se mantém.', emotion: 'neutral', trigger: 'bluff_success' },
  
  // Transição
  { id: 'i_trans_1', text: 'Próxima questão. O teste continua.', emotion: 'neutral', trigger: 'transition' },
  { id: 'i_trans_2', text: 'Avancemos. O caminho ainda é longo.', emotion: 'neutral', trigger: 'transition' },
  
  // Provocações
  { id: 'i_taunt_1', text: 'Está pensando ou dormindo?', emotion: 'neutral', trigger: 'taunt' },
  { id: 'i_taunt_2', text: 'O tempo não espera por ninguém.', emotion: 'neutral', trigger: 'taunt' },
];

// ============================================================
// ATO II - A PROVAÇÃO (Rodadas 4-7)
// Tom: Questionador e provocativo
// Hórus começa a desafiar as escolhas do jogador
// ============================================================
export const ACT_II_PHRASES: ActPhrase[] = [
  // Acertos (com questionamento)
  { id: 'ii_correct_1', text: 'Acertou, mas será que foi sorte ou conhecimento?', emotion: 'curious', trigger: 'correct' },
  { id: 'ii_correct_2', text: 'Interessante escolha. Veremos se mantém esse padrão.', emotion: 'curious', trigger: 'correct' },
  { id: 'ii_correct_3', text: 'Curioso... você parece confiante demais.', emotion: 'curious', trigger: 'correct' },
  { id: 'ii_correct_4', text: 'Tem certeza que sabe o que está fazendo?', emotion: 'curious', trigger: 'correct' },
  { id: 'ii_correct_5', text: 'Correto. Mas quantos mais você aguenta?', emotion: 'curious', trigger: 'correct' },
  
  // Erros (pressão psicológica)
  { id: 'ii_wrong_1', text: 'E a máscara começa a cair...', emotion: 'curious', trigger: 'wrong' },
  { id: 'ii_wrong_2', text: 'Você pensou que seria fácil, não é?', emotion: 'curious', trigger: 'wrong' },
  { id: 'ii_wrong_3', text: 'A dúvida começa a se instalar. Eu posso ver.', emotion: 'curious', trigger: 'wrong' },
  { id: 'ii_wrong_4', text: 'Talvez você não seja tão bom quanto pensava.', emotion: 'curious', trigger: 'wrong' },
  
  // Blefe bem-sucedido
  { id: 'ii_bluff_1', text: 'Eles acreditaram. Mas eu vi a hesitação nos seus olhos.', emotion: 'curious', trigger: 'bluff_success' },
  { id: 'ii_bluff_2', text: 'Blefe convincente. Mas por quanto tempo mais?', emotion: 'curious', trigger: 'bluff_success' },
  { id: 'ii_bluff_3', text: 'Enganou os outros, mas não me engana.', emotion: 'curious', trigger: 'bluff_success' },
  
  // Transição
  { id: 'ii_trans_1', text: 'A cada rodada, o jogo fica mais sério.', emotion: 'curious', trigger: 'transition' },
  { id: 'ii_trans_2', text: 'Vamos ver até onde sua confiança aguenta.', emotion: 'curious', trigger: 'transition' },
  
  // Provocações
  { id: 'ii_taunt_1', text: 'Está hesitando? A dúvida é o primeiro passo para a queda.', emotion: 'curious', trigger: 'taunt' },
  { id: 'ii_taunt_2', text: 'Cada segundo de hesitação conta contra você.', emotion: 'curious', trigger: 'taunt' },
  { id: 'ii_taunt_3', text: 'Posso sentir seu coração acelerando daqui.', emotion: 'curious', trigger: 'taunt' },
];

// ============================================================
// ATO III - A ASCENSÃO (Rodadas 8-10)
// Tom: Respeitoso mas misterioso
// Hórus reconhece o progresso mas mantém mistério
// ============================================================
export const ACT_III_PHRASES: ActPhrase[] = [
  // Acertos
  { id: 'iii_correct_1', text: 'Impressionante. Você realmente conhece o caminho.', emotion: 'impressed', trigger: 'correct' },
  { id: 'iii_correct_2', text: 'Poucos chegam tão longe com tanta precisão.', emotion: 'impressed', trigger: 'correct' },
  { id: 'iii_correct_3', text: 'O Observador está notando sua performance.', emotion: 'impressed', trigger: 'correct' },
  { id: 'iii_correct_4', text: 'Você me surpreende. Continue assim.', emotion: 'impressed', trigger: 'correct' },
  { id: 'iii_correct_5', text: 'Há algo diferente em você. Algo... promissor.', emotion: 'impressed', trigger: 'correct' },
  
  // Erros
  { id: 'iii_wrong_1', text: 'Até os melhores tropeçam. A questão é: você se levanta?', emotion: 'impressed', trigger: 'wrong' },
  { id: 'iii_wrong_2', text: 'Um erro aqui pode custar caro. Você sabe disso.', emotion: 'impressed', trigger: 'wrong' },
  { id: 'iii_wrong_3', text: 'O topo está próximo, mas o abismo também.', emotion: 'impressed', trigger: 'wrong' },
  
  // Blefe bem-sucedido
  { id: 'iii_bluff_1', text: 'Magistral. Você dominou a arte da ilusão.', emotion: 'impressed', trigger: 'bluff_success' },
  { id: 'iii_bluff_2', text: 'Nem eu vi essa chegando. Bem jogado.', emotion: 'impressed', trigger: 'bluff_success' },
  { id: 'iii_bluff_3', text: 'O mestre do blefe se revela. Respeito.', emotion: 'impressed', trigger: 'bluff_success' },
  
  // Transição
  { id: 'iii_trans_1', text: 'Você está no caminho dos grandes. Não desperdice.', emotion: 'impressed', trigger: 'transition' },
  { id: 'iii_trans_2', text: 'As próximas rodadas definirão seu legado.', emotion: 'impressed', trigger: 'transition' },
  
  // Provocações (respeitosas)
  { id: 'iii_taunt_1', text: 'Até aqui, impressionante. Mas o verdadeiro teste vem agora.', emotion: 'impressed', trigger: 'taunt' },
  { id: 'iii_taunt_2', text: 'Eu começaria a me preocupar se fosse você.', emotion: 'impressed', trigger: 'taunt' },
];

// ============================================================
// ATO IV - A QUEDA (Rodadas 11-12)
// Tom: Tenso e psicologicamente desafiador
// Máxima pressão e dúvida psicológica
// ============================================================
export const ACT_IV_PHRASES: ActPhrase[] = [
  // Acertos
  { id: 'iv_correct_1', text: 'Sob pressão máxima... e você não tremeu. Notável.', emotion: 'tense', trigger: 'correct' },
  { id: 'iv_correct_2', text: 'Cada acerto agora vale ouro. Literalmente.', emotion: 'tense', trigger: 'correct' },
  { id: 'iv_correct_3', text: 'A linha entre glória e ruína é fina. Você ainda está do lado certo.', emotion: 'tense', trigger: 'correct' },
  
  // Erros
  { id: 'iv_wrong_1', text: 'ERRO CRÍTICO! Seu coração deve estar a mil agora.', emotion: 'tense', trigger: 'wrong' },
  { id: 'iv_wrong_2', text: 'A pressão chegou. E você sucumbiu.', emotion: 'tense', trigger: 'wrong' },
  { id: 'iv_wrong_3', text: 'Tão perto... e agora tão longe.', emotion: 'tense', trigger: 'wrong' },
  { id: 'iv_wrong_4', text: 'O abismo te chama. Você ouve?', emotion: 'tense', trigger: 'wrong' },
  
  // Blefe bem-sucedido
  { id: 'iv_bluff_1', text: 'Sob pressão extrema, você ainda consegue mentir. Impressionante... ou assustador.', emotion: 'tense', trigger: 'bluff_success' },
  { id: 'iv_bluff_2', text: 'Frieza de sangue. Nem todos têm isso.', emotion: 'tense', trigger: 'bluff_success' },
  
  // Transição
  { id: 'iv_trans_1', text: 'O próximo passo pode ser o último. Pense bem.', emotion: 'tense', trigger: 'transition' },
  { id: 'iv_trans_2', text: 'Estamos chegando ao fim. Você sente?', emotion: 'tense', trigger: 'transition' },
  
  // Provocações (intensas)
  { id: 'iv_taunt_1', text: 'A pressão aumenta... você sente?', emotion: 'tense', trigger: 'taunt' },
  { id: 'iv_taunt_2', text: 'Cada segundo conta agora. Escolha sabiamente.', emotion: 'tense', trigger: 'taunt' },
  { id: 'iv_taunt_3', text: 'O erro aqui custa caro. Muito caro.', emotion: 'tense', trigger: 'taunt' },
  { id: 'iv_taunt_4', text: 'Sua mente está clara? Ou a dúvida se instala?', emotion: 'tense', trigger: 'taunt' },
];

// ============================================================
// ATO V - O CLÍMAX (Rodadas 13-15)
// Tom: Dramático e definitivo
// O momento da verdade - All-In ou Maleta
// ============================================================
export const ACT_V_PHRASES: ActPhrase[] = [
  // Acertos
  { id: 'v_correct_1', text: 'INCRÍVEL! Você está fazendo história!', emotion: 'dramatic', trigger: 'correct' },
  { id: 'v_correct_2', text: 'O lendário... você está se tornando lenda!', emotion: 'dramatic', trigger: 'correct' },
  { id: 'v_correct_3', text: 'A plateia está de pé! Que performance!', emotion: 'dramatic', trigger: 'correct' },
  
  // Erros
  { id: 'v_wrong_1', text: 'NÃO! Tão perto da glória... e agora cinzas.', emotion: 'dramatic', trigger: 'wrong' },
  { id: 'v_wrong_2', text: 'A história será cruel com você. Tão, tão perto...', emotion: 'dramatic', trigger: 'wrong' },
  { id: 'v_wrong_3', text: 'O milhão escapou por entre seus dedos!', emotion: 'dramatic', trigger: 'wrong' },
  
  // Blefe bem-sucedido
  { id: 'v_bluff_1', text: 'LENDÁRIO! Você enganou a todos no momento decisivo!', emotion: 'dramatic', trigger: 'bluff_success' },
  { id: 'v_bluff_2', text: 'O maior blefe da história deste show!', emotion: 'dramatic', trigger: 'bluff_success' },
  
  // Transição
  { id: 'v_trans_1', text: 'Este é o momento da verdade!', emotion: 'dramatic', trigger: 'transition' },
  { id: 'v_trans_2', text: 'Tudo se resume a esta escolha.', emotion: 'dramatic', trigger: 'transition' },
  { id: 'v_trans_3', text: 'O destino do vendedor se decide AGORA.', emotion: 'dramatic', trigger: 'transition' },
  
  // Provocações (dramáticas)
  { id: 'v_taunt_1', text: 'ALL-IN ou MALETA? Sua escolha definirá tudo!', emotion: 'dramatic', trigger: 'taunt' },
  { id: 'v_taunt_2', text: 'Um milhão ou uma maleta misteriosa. O que você escolhe?', emotion: 'dramatic', trigger: 'taunt' },
  { id: 'v_taunt_3', text: 'O tempo está acabando. DECIDA!', emotion: 'dramatic', trigger: 'taunt' },
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

// Mapa de atos para frases
const ACT_PHRASES_MAP: Record<NarrativeAct, ActPhrase[]> = {
  initiation: ACT_I_PHRASES,
  trial: ACT_II_PHRASES,
  ascension: ACT_III_PHRASES,
  fall: ACT_IV_PHRASES,
  climax: ACT_V_PHRASES,
};

// Obtém uma frase aleatória por ato e trigger
export function getActPhrase(
  act: NarrativeAct, 
  trigger: ActPhrase['trigger']
): ActPhrase | null {
  const phrases = ACT_PHRASES_MAP[act];
  const filtered = phrases.filter(p => p.trigger === trigger);
  
  if (filtered.length === 0) return null;
  
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Obtém texto da frase por ato e trigger
export function getActPhraseText(
  act: NarrativeAct,
  trigger: ActPhrase['trigger']
): string {
  const phrase = getActPhrase(act, trigger);
  return phrase?.text || '';
}

// Obtém todas as frases de um ato
export function getActPhrases(act: NarrativeAct): ActPhrase[] {
  return ACT_PHRASES_MAP[act] || [];
}

// Evento especial: Observador Silencioso
export const SILENT_OBSERVER_PHRASES = [
  'Alguém está observando você... há 5 rodadas consecutivas. Impressionante.',
  'O Observador Silencioso notou sua sequência. Ele raramente aparece.',
  'Você atraiu a atenção de algo... maior. Continue assim.',
  'Cinco acertos seguidos. O Observador está intrigado.',
];

export function getSilentObserverPhrase(): string {
  return SILENT_OBSERVER_PHRASES[Math.floor(Math.random() * SILENT_OBSERVER_PHRASES.length)];
}
