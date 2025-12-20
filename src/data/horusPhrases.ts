// Hórus - O Apresentador
// 50 frases pré-gravadas para situações comuns do jogo

import { GameMoment } from '@/types/personas';

export interface HorusPhrase {
  id: string;
  moment: GameMoment;
  text: string;
  emotion: 'neutral' | 'sarcastic' | 'dramatic' | 'excited' | 'menacing';
}

// Round start phrases (10)
const ROUND_START: HorusPhrase[] = [
  { id: 'rs1', moment: 'round_start', text: 'A caçada começou. Jogadores, posicionem suas máscaras. O tribunal está aberto.', emotion: 'dramatic' },
  { id: 'rs2', moment: 'round_start', text: 'Uma nova rodada se inicia. Quem será o mestre do engano desta vez?', emotion: 'dramatic' },
  { id: 'rs3', moment: 'round_start', text: 'Olhos bem abertos, mentes afiadas. É hora de blefar!', emotion: 'excited' },
  { id: 'rs4', moment: 'round_start', text: 'Bem-vindos de volta ao palco das mentiras. Surpreendam-me.', emotion: 'sarcastic' },
  { id: 'rs5', moment: 'round_start', text: 'A arena está pronta. Os mentirosos também?', emotion: 'menacing' },
  { id: 'rs6', moment: 'round_start', text: 'Mais uma chance de provar seu valor. Não me decepcione.', emotion: 'neutral' },
  { id: 'rs7', moment: 'round_start', text: 'O show continua! E vocês, estão prontos para atuar?', emotion: 'excited' },
  { id: 'rs8', moment: 'round_start', text: 'Rodada nova, mentiras novas. Quero ver criatividade!', emotion: 'sarcastic' },
  { id: 'rs9', moment: 'round_start', text: 'Silêncio! O Hórus vai falar. E vocês vão obedecer.', emotion: 'dramatic' },
  { id: 'rs10', moment: 'round_start', text: 'A pergunta está chegando. Tremam, mortais.', emotion: 'menacing' },
];

// Correct answer phrases (8)
const CORRECT_ANSWER: HorusPhrase[] = [
  { id: 'ca1', moment: 'correct_answer', text: 'Impressionante! Você realmente sabia essa.', emotion: 'neutral' },
  { id: 'ca2', moment: 'correct_answer', text: 'Olha só, alguém estudou! Parabéns, gênio.', emotion: 'sarcastic' },
  { id: 'ca3', moment: 'correct_answer', text: 'Resposta correta! Mas não se anime, isso foi fácil.', emotion: 'sarcastic' },
  { id: 'ca4', moment: 'correct_answer', text: 'Acertou em cheio! O conhecimento venceu... por enquanto.', emotion: 'neutral' },
  { id: 'ca5', moment: 'correct_answer', text: 'Muito bem! Talvez você não seja tão inútil assim.', emotion: 'sarcastic' },
  { id: 'ca6', moment: 'correct_answer', text: 'Correto! A verdade também tem seu valor.', emotion: 'dramatic' },
  { id: 'ca7', moment: 'correct_answer', text: 'Acertou! Mas será que o júri vai acreditar?', emotion: 'menacing' },
  { id: 'ca8', moment: 'correct_answer', text: 'Resposta certa! Vamos ver se convence os outros.', emotion: 'neutral' },
];

// Wrong answer / Bluff needed phrases (8)
const WRONG_ANSWER: HorusPhrase[] = [
  { id: 'wa1', moment: 'wrong_answer', text: 'Errou! Agora só o blefe pode te salvar.', emotion: 'dramatic' },
  { id: 'wa2', moment: 'wrong_answer', text: 'Resposta errada! Hora de colocar sua cara de pau em ação.', emotion: 'sarcastic' },
  { id: 'wa3', moment: 'wrong_answer', text: 'Não era essa, mas quem liga? Minta com convicção!', emotion: 'excited' },
  { id: 'wa4', moment: 'wrong_answer', text: 'Errou feio! Mas se você for bom de lábia, ninguém precisa saber.', emotion: 'sarcastic' },
  { id: 'wa5', moment: 'wrong_answer', text: 'Que pena, estava errado. Agora é blefar ou morrer!', emotion: 'menacing' },
  { id: 'wa6', moment: 'wrong_answer', text: 'A resposta estava errada. Seu destino agora está nas suas palavras.', emotion: 'dramatic' },
  { id: 'wa7', moment: 'wrong_answer', text: 'Não acertou! Vamos ver se sua atuação é melhor que seu conhecimento.', emotion: 'sarcastic' },
  { id: 'wa8', moment: 'wrong_answer', text: 'Errado! Mas um bom mentiroso nunca admite a derrota.', emotion: 'neutral' },
];

// Bluff success phrases (8)
const BLUFF_SUCCESS: HorusPhrase[] = [
  { id: 'bs1', moment: 'bluff_success', text: 'Vendeu gelo para esquimó! Que performance!', emotion: 'excited' },
  { id: 'bs2', moment: 'bluff_success', text: 'O Oscar vai para... você! Que mentira bem contada!', emotion: 'dramatic' },
  { id: 'bs3', moment: 'bluff_success', text: 'Eles cairam como patinhos! Você é um monstro!', emotion: 'excited' },
  { id: 'bs4', moment: 'bluff_success', text: 'Blefe perfeito! Nem eu acreditaria em você, mas eles sim!', emotion: 'sarcastic' },
  { id: 'bs5', moment: 'bluff_success', text: 'Enganou a todos! Se candidatar a político, ganha!', emotion: 'sarcastic' },
  { id: 'bs6', moment: 'bluff_success', text: 'Mestre do engano! O júri nem desconfiou!', emotion: 'excited' },
  { id: 'bs7', moment: 'bluff_success', text: 'Que lábia! Você nasceu para isso!', emotion: 'dramatic' },
  { id: 'bs8', moment: 'bluff_success', text: 'Blefe de milhões! Você está no controle!', emotion: 'excited' },
];

// Bluff fail phrases (8)
const BLUFF_FAIL: HorusPhrase[] = [
  { id: 'bf1', moment: 'bluff_fail', text: 'Pego no pulo! Sua cara te entregou!', emotion: 'menacing' },
  { id: 'bf2', moment: 'bluff_fail', text: 'Fracasso total! Precisa treinar mais essa cara de pau.', emotion: 'sarcastic' },
  { id: 'bf3', moment: 'bluff_fail', text: 'O júri não comprou! Você tremeu na base!', emotion: 'sarcastic' },
  { id: 'bf4', moment: 'bluff_fail', text: 'Descobriram seu blefe! A máscara caiu!', emotion: 'dramatic' },
  { id: 'bf5', moment: 'bluff_fail', text: 'Mentiroso amador! Dá pra fazer melhor que isso!', emotion: 'sarcastic' },
  { id: 'bf6', moment: 'bluff_fail', text: 'Pegaram você! Da próxima vez, seja mais convincente!', emotion: 'menacing' },
  { id: 'bf7', moment: 'bluff_fail', text: 'Blefe desmascarado! O júri estava atento!', emotion: 'neutral' },
  { id: 'bf8', moment: 'bluff_fail', text: 'Falhou no blefe! Sua atuação não convenceu ninguém!', emotion: 'sarcastic' },
];

// Briefcase offer phrases (6)
const BRIEFCASE_OFFER: HorusPhrase[] = [
  { id: 'bo1', moment: 'briefcase_offer', text: 'Espere! Antes de arriscar tudo, olhe para esta maleta. Ela tem o peso da segurança. Você prefere a verdade ou o prêmio garantido?', emotion: 'dramatic' },
  { id: 'bo2', moment: 'briefcase_offer', text: 'A maleta misteriosa aparece! O que você vai escolher?', emotion: 'dramatic' },
  { id: 'bo3', moment: 'briefcase_offer', text: 'Eis a maleta! Fortuna ou desgraça te aguardam lá dentro.', emotion: 'menacing' },
  { id: 'bo4', moment: 'briefcase_offer', text: 'A maleta chegou! Abrir agora ou arriscar tudo na pergunta final?', emotion: 'dramatic' },
  { id: 'bo5', moment: 'briefcase_offer', text: 'A maleta te chama! Aceite a segurança ou enfrente o desconhecido?', emotion: 'menacing' },
  { id: 'bo6', moment: 'briefcase_offer', text: 'Escolha sabiamente! A maleta ou a glória final?', emotion: 'dramatic' },
];

// Bribe offer phrases (4 variations with different personalities)
const BRIBE_OFFER: HorusPhrase[] = [
  { 
    id: 'br1', 
    moment: 'bribe_offer', 
    text: 'O Mycroft já te entregou para os leões. Mas eu sou generoso. Esqueça o All-in. Aceite o conteúdo desta maleta e saia agora com dignidade. Você prefere a glória incerta ou o prêmio na mão?', 
    emotion: 'dramatic' 
  },
  { 
    id: 'br2', 
    moment: 'bribe_offer', 
    text: 'Eu sinto o cheiro do seu medo daqui. Essa maleta tem exatamente o que você precisa para não passar vergonha. Pega ou larga?', 
    emotion: 'sarcastic' 
  },
  { 
    id: 'br3', 
    moment: 'bribe_offer', 
    text: 'O Mycroft é apenas uma máquina. Eu sou o poder. Eu te dou um caminho de saída agora. Aceite o suborno e encerramos este tribunal.', 
    emotion: 'neutral' 
  },
  { 
    id: 'br4', 
    moment: 'bribe_offer', 
    text: 'Seus adversários já decidiram seu destino. A maleta é sua última tábua de salvação. Escolha rápido!', 
    emotion: 'menacing' 
  },
];

// Elimination phrases (4)
const ELIMINATION: HorusPhrase[] = [
  { id: 'el1', moment: 'elimination', text: 'Você caiu! O trono agora pertence a outro!', emotion: 'menacing' },
  { id: 'el2', moment: 'elimination', text: 'Eliminado! Seus dias de glória acabaram!', emotion: 'dramatic' },
  { id: 'el3', moment: 'elimination', text: 'Game over! Foi bom enquanto durou... ou não.', emotion: 'sarcastic' },
  { id: 'el4', moment: 'elimination', text: 'Sua jornada termina aqui! Adeus, mentiroso fracassado!', emotion: 'menacing' },
];

// Victory phrases (4)
const VICTORY: HorusPhrase[] = [
  { id: 'vi1', moment: 'victory', text: 'Vitória absoluta! Você é o mestre supremo do blefe!', emotion: 'excited' },
  { id: 'vi2', moment: 'victory', text: 'Parabéns, campeão! Você conquistou todas as rodadas!', emotion: 'dramatic' },
  { id: 'vi3', moment: 'victory', text: 'Lendário! Você venceu o jogo completo!', emotion: 'excited' },
  { id: 'vi4', moment: 'victory', text: 'Glória eterna! O trono é seu por direito!', emotion: 'dramatic' },
];

// Taunt phrases (6)
const TAUNT: HorusPhrase[] = [
  { id: 'ta1', moment: 'taunt', text: 'Vamos, me surpreenda! Ou será que não consegue?', emotion: 'sarcastic' },
  { id: 'ta2', moment: 'taunt', text: 'Isso é o melhor que você tem? Patético.', emotion: 'menacing' },
  { id: 'ta3', moment: 'taunt', text: 'O tempo está passando e você ainda hesita?', emotion: 'sarcastic' },
  { id: 'ta4', moment: 'taunt', text: 'Eu já vi mentiras melhores de crianças de cinco anos.', emotion: 'sarcastic' },
  { id: 'ta5', moment: 'taunt', text: 'Está nervoso? Bom, você deveria estar!', emotion: 'menacing' },
  { id: 'ta6', moment: 'taunt', text: 'O júri está esperando. Não os decepcione... como sempre.', emotion: 'sarcastic' },
];

// All phrases combined
export const HORUS_PHRASES: HorusPhrase[] = [
  ...ROUND_START,
  ...CORRECT_ANSWER,
  ...WRONG_ANSWER,
  ...BLUFF_SUCCESS,
  ...BLUFF_FAIL,
  ...BRIEFCASE_OFFER,
  ...BRIBE_OFFER,
  ...ELIMINATION,
  ...VICTORY,
  ...TAUNT,
];

// Get random phrase for a specific moment
export function getRandomHorusPhrase(moment: GameMoment): HorusPhrase | null {
  const phrases = HORUS_PHRASES.filter(p => p.moment === moment);
  if (phrases.length === 0) return null;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// Get all phrases for a specific moment
export function getHorusPhrasesByMoment(moment: GameMoment): HorusPhrase[] {
  return HORUS_PHRASES.filter(p => p.moment === moment);
}
