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

// Pacto/Acordo offer phrases - Hórus offers after voting when player is bluffing
const BRIBE_OFFER: HorusPhrase[] = [
  { 
    id: 'br1', 
    moment: 'bribe_offer', 
    text: 'Seu destino já foi selado pelo júri. Você confia na sua mentira ou prefere aceitar meu acordo e sair com o que já conquistou?', 
    emotion: 'dramatic' 
  },
  { 
    id: 'br2', 
    moment: 'bribe_offer', 
    text: 'Eu tenho um Pacto de Cavalheiros para você. O júri é implacável, mas eu sou generoso.', 
    emotion: 'menacing' 
  },
  { 
    id: 'br3', 
    moment: 'bribe_offer', 
    text: 'Esta é a sua Saída de Emergência. Pegue o prêmio acumulado e saia com dignidade. O que vai ser?', 
    emotion: 'sarcastic' 
  },
  { 
    id: 'br4', 
    moment: 'bribe_offer', 
    text: 'Não jogue sua sorte ao vento. Aceite a Desistência Honrosa antes que o veredicto seja revelado.', 
    emotion: 'menacing' 
  },
  { 
    id: 'br5', 
    moment: 'bribe_offer', 
    text: 'O júri é implacável, mas eu sou generoso. Considere este Acordo de Ouro antes que seja tarde demais.', 
    emotion: 'dramatic' 
  },
];

// Elimination phrases (10)
const ELIMINATION: HorusPhrase[] = [
  { id: 'el1', moment: 'elimination', text: 'Você caiu! O trono agora pertence a outro!', emotion: 'menacing' },
  { id: 'el2', moment: 'elimination', text: 'Eliminado! Seus dias de glória acabaram!', emotion: 'dramatic' },
  { id: 'el3', moment: 'elimination', text: 'Game over! Foi bom enquanto durou... ou não.', emotion: 'sarcastic' },
  { id: 'el4', moment: 'elimination', text: 'Sua jornada termina aqui! Adeus, mentiroso fracassado!', emotion: 'menacing' },
  { id: 'el5', moment: 'elimination', text: 'O tribunal proferiu sua sentença. Culpado e eliminado!', emotion: 'dramatic' },
  { id: 'el6', moment: 'elimination', text: 'Que queda espetacular! Guarde esse momento na memória.', emotion: 'sarcastic' },
  { id: 'el7', moment: 'elimination', text: 'Você apostou alto e perdeu tudo. Típico.', emotion: 'menacing' },
  { id: 'el8', moment: 'elimination', text: 'A máscara caiu e você junto com ela. Próximo!', emotion: 'sarcastic' },
  { id: 'el9', moment: 'elimination', text: 'Suas mentiras não foram suficientes. O abismo te espera!', emotion: 'dramatic' },
  { id: 'el10', moment: 'elimination', text: 'Derrotado, humilhado, eliminado. O trio perfeito!', emotion: 'menacing' },
];

// Victory phrases (10)
const VICTORY: HorusPhrase[] = [
  { id: 'vi1', moment: 'victory', text: 'Vitória absoluta! Você é o mestre supremo do blefe!', emotion: 'excited' },
  { id: 'vi2', moment: 'victory', text: 'Parabéns, campeão! Você conquistou todas as rodadas!', emotion: 'dramatic' },
  { id: 'vi3', moment: 'victory', text: 'Lendário! Você venceu o jogo completo!', emotion: 'excited' },
  { id: 'vi4', moment: 'victory', text: 'Glória eterna! O trono é seu por direito!', emotion: 'dramatic' },
  { id: 'vi5', moment: 'victory', text: 'Incrível! Você provou que é o maior mentiroso de todos!', emotion: 'excited' },
  { id: 'vi6', moment: 'victory', text: 'Contra todas as probabilidades, você venceu! Impressionante!', emotion: 'dramatic' },
  { id: 'vi7', moment: 'victory', text: 'O tribunal se curva diante do novo campeão! Você é uma lenda!', emotion: 'excited' },
  { id: 'vi8', moment: 'victory', text: 'Vitória épica! Sua lábia conquistou o mundo!', emotion: 'dramatic' },
  { id: 'vi9', moment: 'victory', text: 'Você enganou a todos e levou o prêmio! Bravo, mestre do engano!', emotion: 'excited' },
  { id: 'vi10', moment: 'victory', text: 'O impossível aconteceu! Você dominou o Blefador! Parabéns, campeão!', emotion: 'dramatic' },
];

// Taunt phrases (10)
const TAUNT: HorusPhrase[] = [
  { id: 'ta1', moment: 'taunt', text: 'Vamos, me surpreenda! Ou será que não consegue?', emotion: 'sarcastic' },
  { id: 'ta2', moment: 'taunt', text: 'Isso é o melhor que você tem? Patético.', emotion: 'menacing' },
  { id: 'ta3', moment: 'taunt', text: 'O tempo está passando e você ainda hesita?', emotion: 'sarcastic' },
  { id: 'ta4', moment: 'taunt', text: 'Eu já vi mentiras melhores de crianças de cinco anos.', emotion: 'sarcastic' },
  { id: 'ta5', moment: 'taunt', text: 'Está nervoso? Bom, você deveria estar!', emotion: 'menacing' },
  { id: 'ta6', moment: 'taunt', text: 'O júri está esperando. Não os decepcione... como sempre.', emotion: 'sarcastic' },
  { id: 'ta7', moment: 'taunt', text: 'Vejo insegurança nos seus olhos. Delicioso!', emotion: 'menacing' },
  { id: 'ta8', moment: 'taunt', text: 'Você acha que pode me enganar? Eu sou o Hórus!', emotion: 'dramatic' },
  { id: 'ta9', moment: 'taunt', text: 'Cada segundo de hesitação é uma confissão de fraqueza.', emotion: 'sarcastic' },
  { id: 'ta10', moment: 'taunt', text: 'Respire fundo. Vai precisar de todo o ar para essa mentira.', emotion: 'menacing' },
];

// All-in challenge phrases (8)
const ALL_IN: HorusPhrase[] = [
  { id: 'ai1', moment: 'all_in', text: 'É tudo ou nada! A rodada final chegou! Você está preparado para apostar tudo?', emotion: 'dramatic' },
  { id: 'ai2', moment: 'all_in', text: 'O momento da verdade! All-in! Mostre do que você é feito!', emotion: 'excited' },
  { id: 'ai3', moment: 'all_in', text: 'Chegamos ao clímax! Sua fortuna inteira está em jogo! Trema!', emotion: 'menacing' },
  { id: 'ai4', moment: 'all_in', text: 'All-in! O destino bate à sua porta! Você vai atender ou fugir?', emotion: 'dramatic' },
  { id: 'ai5', moment: 'all_in', text: 'Este é o momento que separa os lendários dos medíocres! All-in!', emotion: 'excited' },
  { id: 'ai6', moment: 'all_in', text: 'A maior aposta da sua vida! Glória ou ruína, não há meio termo!', emotion: 'dramatic' },
  { id: 'ai7', moment: 'all_in', text: 'O palco está montado para o grand finale! Mostre sua verdadeira face!', emotion: 'excited' },
  { id: 'ai8', moment: 'all_in', text: 'All-in! As cartas estão na mesa! Que vença o melhor mentiroso!', emotion: 'dramatic' },
];

// All-in loss phrases - player lost on round 15
const ALL_IN_LOSS: HorusPhrase[] = [
  { id: 'ail1', moment: 'all_in_loss', text: 'Você deveria ter aceitado a Maleta Misteriosa... agora, você sai de mãos vazias.', emotion: 'menacing' },
  { id: 'ail2', moment: 'all_in_loss', text: 'A ganância te destruiu! A maleta estava ali, te chamando... e você recusou.', emotion: 'sarcastic' },
  { id: 'ail3', moment: 'all_in_loss', text: 'O All-in te consumiu. A maleta era sua salvação, mas você escolheu o abismo.', emotion: 'dramatic' },
  { id: 'ail4', moment: 'all_in_loss', text: 'Poxa, que pena! Tudo perdido. A maleta nunca decepciona... você deveria ter confiado nela.', emotion: 'sarcastic' },
  { id: 'ail5', moment: 'all_in_loss', text: 'Zero pontos. Nada. O vazio. A maleta teria sido tão gentil com você...', emotion: 'menacing' },
];

// Special challenge phrases (8)
const SPECIAL_CHALLENGE: HorusPhrase[] = [
  { id: 'sc1', moment: 'special_challenge', text: 'Desafio especial! Esta pergunta vale o dobro! Você aceita o risco?', emotion: 'excited' },
  { id: 'sc2', moment: 'special_challenge', text: 'Atenção! Uma pergunta de alto risco apareceu! Preparado para o desafio?', emotion: 'dramatic' },
  { id: 'sc3', moment: 'special_challenge', text: 'Desafio bônus ativado! As recompensas são maiores, mas os riscos também!', emotion: 'excited' },
  { id: 'sc4', moment: 'special_challenge', text: 'Uma oportunidade única surge! Arrisque grande, ganhe grande!', emotion: 'dramatic' },
  { id: 'sc5', moment: 'special_challenge', text: 'Modo especial desbloqueado! Mostre que você merece estar aqui!', emotion: 'excited' },
  { id: 'sc6', moment: 'special_challenge', text: 'O destino te presenteia com um desafio épico! Não desperdice!', emotion: 'dramatic' },
  { id: 'sc7', moment: 'special_challenge', text: 'Desafio relâmpago! Pense rápido e aja mais rápido ainda!', emotion: 'menacing' },
  { id: 'sc8', moment: 'special_challenge', text: 'Uma prova de fogo te aguarda! Só os fortes sobrevivem!', emotion: 'dramatic' },
];

// Jury deliberation phrases (6)
const JURY_DELIBERATION: HorusPhrase[] = [
  { id: 'jd1', moment: 'jury_deliberation', text: 'O júri está deliberando... Seu destino está nas mãos deles agora.', emotion: 'dramatic' },
  { id: 'jd2', moment: 'jury_deliberation', text: 'Os votos estão sendo contados. Respire fundo, o veredicto vem aí.', emotion: 'menacing' },
  { id: 'jd3', moment: 'jury_deliberation', text: 'Silêncio no tribunal! O júri analisa cada palavra que você disse.', emotion: 'dramatic' },
  { id: 'jd4', moment: 'jury_deliberation', text: 'Eles estão decidindo se você é gênio ou fracasso. Que suspense!', emotion: 'sarcastic' },
  { id: 'jd5', moment: 'jury_deliberation', text: 'O momento mais tenso do jogo! O que o júri vai decidir?', emotion: 'dramatic' },
  { id: 'jd6', moment: 'jury_deliberation', text: 'Cada segundo de espera é uma eternidade. O veredicto se aproxima!', emotion: 'menacing' },
];

// Post-vote offer phrases (8) - Hórus offers after voting when player is bluffing
const POST_VOTE_BRIBE: HorusPhrase[] = [
  { id: 'pvb1', moment: 'post_vote_bribe', text: 'Seu destino já foi selado pelo júri. Você confia na sua mentira ou prefere aceitar meu acordo?', emotion: 'dramatic' },
  { id: 'pvb2', moment: 'post_vote_bribe', text: 'Os votos foram contados. O veredicto está pronto. Eu tenho um Pacto de Cavalheiros para você.', emotion: 'menacing' },
  { id: 'pvb3', moment: 'post_vote_bribe', text: 'O tribunal já decidiu seu destino. Esta é a sua Saída de Emergência. O que vai ser?', emotion: 'dramatic' },
  { id: 'pvb4', moment: 'post_vote_bribe', text: 'Antes de revelar seu destino... aceite a Desistência Honrosa e saia com dignidade.', emotion: 'neutral' },
  { id: 'pvb5', moment: 'post_vote_bribe', text: 'Eu vi seu desempenho. Considere este Acordo de Ouro antes que seja tarde demais.', emotion: 'sarcastic' },
  { id: 'pvb6', moment: 'post_vote_bribe', text: 'O veredicto está lacrado. Pegue o prêmio acumulado e saia agora, ou enfrente o julgamento.', emotion: 'menacing' },
  { id: 'pvb7', moment: 'post_vote_bribe', text: 'Não jogue sua sorte ao vento. O prêmio na mão vale mais que a glória incerta.', emotion: 'dramatic' },
  { id: 'pvb8', moment: 'post_vote_bribe', text: 'O júri é implacável, mas eu sou generoso. Aceite e saia vitorioso.', emotion: 'neutral' },
];

// Comeback phrases (6)
const COMEBACK: HorusPhrase[] = [
  { id: 'cb1', moment: 'comeback', text: 'Olha só! O azarão está voltando ao jogo! Que reviravolta!', emotion: 'excited' },
  { id: 'cb2', moment: 'comeback', text: 'De quase eliminado a candidato à vitória! Impressionante!', emotion: 'dramatic' },
  { id: 'cb3', moment: 'comeback', text: 'Você não desistiu! A fênix renasce das cinzas!', emotion: 'excited' },
  { id: 'cb4', moment: 'comeback', text: 'Contra todas as expectativas, você voltou! O jogo não acabou!', emotion: 'dramatic' },
  { id: 'cb5', moment: 'comeback', text: 'Uma recuperação espetacular! Nunca subestime um mentiroso determinado!', emotion: 'excited' },
  { id: 'cb6', moment: 'comeback', text: 'Do fundo do poço ao topo! Essa é a história de um verdadeiro campeão!', emotion: 'dramatic' },
];

// Streak phrases (6)
const STREAK: HorusPhrase[] = [
  { id: 'st1', moment: 'streak', text: 'Sequência de vitórias! Você está em chamas!', emotion: 'excited' },
  { id: 'st2', moment: 'streak', text: 'Três acertos seguidos! Imparável!', emotion: 'dramatic' },
  { id: 'st3', moment: 'streak', text: 'Você está dominando! O júri não consegue te parar!', emotion: 'excited' },
  { id: 'st4', moment: 'streak', text: 'Sequência perfeita! Você está jogando como um mestre!', emotion: 'dramatic' },
  { id: 'st5', moment: 'streak', text: 'Invencível! Ninguém consegue te derrubar!', emotion: 'excited' },
  { id: 'st6', moment: 'streak', text: 'Uma sequência histórica! Lendas nascem assim!', emotion: 'dramatic' },
];

// Cash out phrases (6)
const CASH_OUT: HorusPhrase[] = [
  { id: 'co1', moment: 'cash_out', text: 'Decisão sábia! Você leva para casa o que conquistou! Até a próxima!', emotion: 'neutral' },
  { id: 'co2', moment: 'cash_out', text: 'Você escolheu a segurança! Um jogador inteligente sabe quando parar.', emotion: 'sarcastic' },
  { id: 'co3', moment: 'cash_out', text: 'Saindo por cima! Nem todos têm essa coragem... ou seria covardia?', emotion: 'sarcastic' },
  { id: 'co4', moment: 'cash_out', text: 'O prêmio é seu! Você jogou bem e soube a hora de sair!', emotion: 'neutral' },
  { id: 'co5', moment: 'cash_out', text: 'Parabéns pela vitória! Você sai como vencedor, não como ganancioso!', emotion: 'dramatic' },
  { id: 'co6', moment: 'cash_out', text: 'Decisão final tomada! O dinheiro na mão vale mais que a glória incerta!', emotion: 'neutral' },
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
  ...ALL_IN,
  ...ALL_IN_LOSS,
  ...SPECIAL_CHALLENGE,
  ...JURY_DELIBERATION,
  ...POST_VOTE_BRIBE,
  ...COMEBACK,
  ...STREAK,
  ...CASH_OUT,
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
