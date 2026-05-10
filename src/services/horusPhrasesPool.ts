// Horus Phrases Pool - Static phrases for pre-caching
// These are the most common phrases used in the game
// All will be cached in Supabase Storage to avoid ElevenLabs API calls

// Round start phrases (10 most used)
export const ROUND_START_PHRASES = [
  'A caçada começou. Jogadores, posicionem suas máscaras. O tribunal está aberto.',
  'Uma nova rodada se inicia. Quem será o mestre do engano desta vez?',
  'Olhos bem abertos, mentes afiadas. É hora de blefar!',
  'Bem-vindos de volta ao palco das mentiras. Surpreendam-me.',
  'A arena está pronta. Os mentirosos também?',
  'Mais uma chance de provar seu valor. Não me decepcione.',
  'O show continua! E vocês, estão prontos para atuar?',
  'Rodada nova, mentiras novas. Quero ver criatividade!',
  'Silêncio! O Hórus vai falar. E vocês vão obedecer.',
  'A pergunta está chegando. Tremam, mortais.',
];

// Correct answer phrases (8)
export const CORRECT_ANSWER_PHRASES = [
  'Impressionante! Você realmente sabia essa.',
  'Olha só, alguém estudou! Parabéns, gênio.',
  'Resposta correta! Mas não se anime, isso foi fácil.',
  'Acertou em cheio! O conhecimento venceu... por enquanto.',
  'Muito bem! Talvez você não seja tão inútil assim.',
  'Correto! A verdade também tem seu valor.',
  'Acertou! Mas será que o júri vai acreditar?',
  'Resposta certa! Vamos ver se convence os outros.',
];

// Wrong answer phrases (8)
export const WRONG_ANSWER_PHRASES = [
  'Errou! Agora só o blefe pode te salvar.',
  'Resposta errada! Hora de colocar sua cara de pau em ação.',
  'Não era essa, mas quem liga? Minta com convicção!',
  'Errou feio! Mas se você for bom de lábia, ninguém precisa saber.',
  'Que pena, estava errado. Agora é blefar ou morrer!',
  'A resposta estava errada. Seu destino agora está nas suas palavras.',
  'Não acertou! Vamos ver se sua atuação é melhor que seu conhecimento.',
  'Errado! Mas um bom mentiroso nunca admite a derrota.',
];

// Bluff success phrases (8)
export const BLUFF_SUCCESS_PHRASES = [
  'Vendeu gelo para esquimó! Que performance!',
  'O Oscar vai para... você! Que mentira bem contada!',
  'Eles cairam como patinhos! Você é um monstro!',
  'Blefe perfeito! Nem eu acreditaria em você, mas eles sim!',
  'Enganou a todos! Se candidatar a político, ganha!',
  'Mestre do engano! O júri nem desconfiou!',
  'Que lábia! Você nasceu para isso!',
  'Blefe de milhões! Você está no controle!',
];

// Bluff fail phrases (8)
export const BLUFF_FAIL_PHRASES = [
  'Pego no pulo! Sua cara te entregou!',
  'Fracasso total! Precisa treinar mais essa cara de pau.',
  'O júri não comprou! Você tremeu na base!',
  'Descobriram seu blefe! A máscara caiu!',
  'Mentiroso amador! Dá pra fazer melhor que isso!',
  'Pegaram você! Da próxima vez, seja mais convincente!',
  'Blefe desmascarado! O júri estava atento!',
  'Falhou no blefe! Sua atuação não convenceu ninguém!',
];

// Victory phrases (10)
export const VICTORY_PHRASES = [
  'Vitória absoluta! Você é o mestre supremo do blefe!',
  'Parabéns, campeão! Você conquistou todas as rodadas!',
  'Lendário! Você venceu o jogo completo!',
  'Glória eterna! O trono é seu por direito!',
  'Incrível! Você provou que é o maior mentiroso de todos!',
  'Contra todas as probabilidades, você venceu! Impressionante!',
  'O tribunal se curva diante do novo campeão! Você é uma lenda!',
  'Vitória épica! Sua lábia conquistou o mundo!',
  'Você enganou a todos e levou o prêmio! Bravo, mestre do engano!',
  'O impossível aconteceu! Você dominou o Blefador! Parabéns, campeão!',
];

// Elimination phrases (10)
export const ELIMINATION_PHRASES = [
  'Você caiu! O trono agora pertence a outro!',
  'Eliminado! Seus dias de glória acabaram!',
  'Game over! Foi bom enquanto durou... ou não.',
  'Sua jornada termina aqui! Adeus, mentiroso fracassado!',
  'O tribunal proferiu sua sentença. Culpado e eliminado!',
  'Que queda espetacular! Guarde esse momento na memória.',
  'Você apostou alto e perdeu tudo. Típico.',
  'A máscara caiu e você junto com ela. Próximo!',
  'Suas mentiras não foram suficientes. O abismo te espera!',
  'Derrotado, humilhado, eliminado. O trio perfeito!',
];

// Briefcase offer phrases (6)
export const BRIEFCASE_OFFER_PHRASES = [
  'Espere! Antes de arriscar tudo, olhe para esta maleta. Ela tem o peso da segurança. Você prefere a verdade ou o prêmio garantido?',
  'A maleta misteriosa aparece! O que você vai escolher?',
  'Eis a maleta! Fortuna ou desgraça te aguardam lá dentro.',
  'A maleta chegou! Abrir agora ou arriscar tudo na pergunta final?',
  'A maleta te chama! Aceite a segurança ou enfrente o desconhecido?',
  'Escolha sabiamente! A maleta ou a glória final?',
];

// All-in loss phrases (5)
export const ALL_IN_LOSS_PHRASES = [
  'Você deveria ter aceitado a Maleta Misteriosa... agora, você sai de mãos vazias.',
  'A ganância te destruiu! A maleta estava ali, te chamando... e você recusou.',
  'O All-in te consumiu. A maleta era sua salvação, mas você escolheu o abismo.',
  'Poxa, que pena! Tudo perdido. A maleta nunca decepciona... você deveria ter confiado nela.',
  'Zero pontos. Nada. O vazio. A maleta teria sido tão gentil com você...',
];

// Cash out phrases (6)
export const CASH_OUT_PHRASES = [
  'Escolha inteligente! Você sai vitorioso com o que conquistou!',
  'O jogador esperto conhece a hora de parar. Parabéns pela sabedoria!',
  'Cash out aceito! Você leva o prêmio e a dignidade intactos!',
  'Uma decisão madura! Melhor garantir do que arriscar tudo!',
  'Você escolheu a segurança. Às vezes, a prudência vence a ganância!',
  'Prêmio garantido! Você sai como um vencedor estratégico!',
];

// Streak phrases (6)
export const STREAK_PHRASES = [
  'Sequência de vitórias! Você está em chamas!',
  'Três acertos seguidos! Imparável!',
  'Você está dominando! O júri não consegue te parar!',
  'Sequência perfeita! Você está jogando como um mestre!',
  'Invencível! Ninguém consegue te derrubar!',
  'Uma sequência histórica! Lendas nascem assim!',
];

// Comeback phrases (6)
export const COMEBACK_PHRASES = [
  'Olha só! O azarão está voltando ao jogo! Que reviravolta!',
  'De quase eliminado a candidato à vitória! Impressionante!',
  'Você não desistiu! A fênix renasce das cinzas!',
  'Contra todas as expectativas, você voltou! O jogo não acabou!',
  'Uma recuperação espetacular! Nunca subestime um mentiroso determinado!',
  'Do fundo do poço ao topo! Essa é a história de um verdadeiro campeão!',
];

// Get a random phrase from a specific pool
export function getRandomPhrase(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

// Get total count of all cacheable phrases
export function getTotalCacheablePhrases(): number {
  return (
    ROUND_START_PHRASES.length +
    CORRECT_ANSWER_PHRASES.length +
    WRONG_ANSWER_PHRASES.length +
    BLUFF_SUCCESS_PHRASES.length +
    BLUFF_FAIL_PHRASES.length +
    VICTORY_PHRASES.length +
    ELIMINATION_PHRASES.length +
    BRIEFCASE_OFFER_PHRASES.length +
    ALL_IN_LOSS_PHRASES.length +
    CASH_OUT_PHRASES.length +
    STREAK_PHRASES.length +
    COMEBACK_PHRASES.length
  );
}
