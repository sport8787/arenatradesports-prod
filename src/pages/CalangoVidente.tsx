import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Shuffle, Share2, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ─── Utilitários ──────────────────────────────────────────────────────────────

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getBrazilDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// ─── Poisson simples (Over 2.5 local) ────────────────────────────────────────

function poissonPmf(lambda: number, k: number): number {
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function over25Prob(lambdaH: number, lambdaA: number): number {
  let under = 0;
  for (let h = 0; h <= 2; h++)
    for (let a = 0; a <= 2 - h; a++)
      under += poissonPmf(lambdaH, h) * poissonPmf(lambdaA, a);
  return Math.max(0, Math.min(1, 1 - under));
}

// Converte diferença de pontos FIFA em lambda aproximado
function ptsToLambda(pts: number | null, isHome: boolean): number {
  const base = pts ?? 1000;
  const raw = (base / 1000) * 1.3 * (isHome ? 1.1 : 1.0);
  return Math.max(0.5, Math.min(3.2, raw));
}

// ─── Voz Dilma IA ───────────────────────────────────────────────────────────
const DILMA_VOICE_ID = 'yIPvP4gx7pjfSgD4ISe0';

// Cache em memória de áudio da Dilma (persiste durante a sessão do navegador)
const dilmaAudioCache = new Map<string, string>();

// ─── Banco de áudio Dilma ────────────────────────────────────────────────────

interface DilmaEntry {
  key: string;
  text: string;
  audioUrl: string;
}

const dilmaDatabase: DilmaEntry[] = [
  // ── Brasil ──────────────────────────────────────────────────────────────────
  {
    key: 'Brasil_Hexa',
    text: 'Veja bem, o Hexa... O Hexa nada mais é do que uma conquista que vem depois do penta, mas que antecede o hepta. Então, quando nós olhamos para a nossa seleção, nós não temos que olhar para quem está chutando a bola, mas sim para a estrutura do ar que envolve a bola. Porque se o vento estiver estocado a nosso favor, o Hexa não será apenas uma meta, ele será uma realidade que nós vamos dobrar assim que ela for atingida por todas as mulheres e homens sapiens deste país.',
    audioUrl: '',
  },
  // ── Jogos específicos Copa 2026 ──────────────────────────────────────────────
  {
    key: 'USA_vs_Paraguay',
    text: 'Veja bem, a estreia dos Estados Unidos no nosso território... eu olhei os dados e o vento quântico estava completamente estocado do lado deles. Quando o vento é favorável, a bola entra. Isso não é política, isso é matemática presidencial.',
    audioUrl: '',
  },
  {
    key: 'Argentina_Africa',
    text: 'A Argentina vem com aquela pressão de quem quer o topo, mas o topo só existe porque existe a base. E a Argélia é uma base sólida, uma estrutura que não se move facilmente se a zaga estiver bem postada. O Messi ou quem quer que esteja com a bola vai tentar driblar a lógica. Mas a lógica da Argélia é a lógica do contra-ataque. E o contra-ataque é quando você vai para frente porque o outro veio para trás. No final, quem fizer mais gols vai ser o vencedor, e quem fizer menos... bem, esse não vai ganhar.',
    audioUrl: '',
  },
  {
    key: 'Franca_Senegal',
    text: 'A França estreia com toda a tecnologia, com a velocidade que é uma pressa de chegar a lugar nenhum se o gol não acontecer. Mas Senegal... Senegal traz a força daquele continente que nós tanto abraçamos. O jogo vai ser uma disputa entre a velocidade francesa e a resistência senegalesa. E o resultado será um número. Pode ser um a zero, pode ser dois a um, ou pode ser um empate que é quando os dois lados chegam juntos ao mesmo lugar, que é o final da partida, sem que nenhum tenha saído da frente.',
    audioUrl: '',
  },
  {
    key: 'Belgica_Egito',
    text: 'A Bélgica tem aquela geração que todo mundo diz que é de ouro, mas o ouro, como nós sabemos, é um minério que fica escondido na terra. O Egito, por sua vez, tem as pirâmides. E as pirâmides são triângulos perfeitos, e o futebol se joga em triângulos, com o passe para lá e o passe para cá. Se a Bélgica atacar pela esquerda e o Egito defender pela direita, o meio de campo vai ficar vazio. E o vazio, meu caro, é um espaço onde a bola pode ou não transitar, dependendo se o vento soprar a favor do gol.',
    audioUrl: '',
  },
  {
    key: 'Uruguai_Arabia',
    text: 'O Uruguai tem a garra, tem a tradição daquela mística do futebol que, quando você olha, você não vê, mas quando você sente, ela está lá. Já a Arábia Saudita vem de uma região onde a areia e o petróleo se encontram. E eu quero dizer que o petróleo é importante, mas a bola não é feita de petróleo, a bola é feita de couro sintético ou de outra substância que quique. Portanto, se nós não estocarmos os escanteios no primeiro tempo, quando o jogo terminar, nós vamos dobrar a meta de gols que nós ainda não alcançamos.',
    audioUrl: '',
  },
  // ── Genéricas por tipo de jogo ───────────────────────────────────────────────
  {
    key: 'Classico_Pesado',
    text: 'Este é um confronto de gigantes. De um lado, uma camisa pesada. Do outro lado, outra camisa igualmente dotada de peso têxtil. Mas o peso da camisa só importa se o jogador estiver vestindo ela. Se a camisa estiver no varal, ela não joga. Portanto, o equilíbrio deste jogo reside na capacidade de cada seleção de tirar a camisa do varal e colocar a alma para correr atrás de um objeto esférico inflado com ar atmosférico.',
    audioUrl: '',
  },
  {
    key: 'Over_Goals',
    text: 'Quando nós falamos em gols, nós temos que entender que o gol é o ápice do momento em que a bola ultrapassa a linha. Se sai um gol, é bom. Se saem dois gols, é melhor. Mas se saem três gols, aí nós entramos numa triplicidade onde quem marcou o primeiro já não é o mesmo que vai marcar o terceiro, gerando uma confusão na zaga adversária que é puramente de ordem biológica. Minha dica para este confronto é: vai sair gol, ou não vai. E essa é a nossa grande certeza.',
    audioUrl: '',
  },
  {
    key: 'Goleada_Prevista',
    text: 'Olha, a minha perspectiva para logo mais é de uma quantidade de gols que nós podemos chamar de goleada. Mas o que é a goleada? A goleada é quando um time faz muitos gols e o outro... o outro não faz tantos, ou faz menos do que os muitos que o primeiro fez. Se nós somarmos todos os gols do primeiro tempo com os gols que ainda vão acontecer no segundo, nós vamos ter uma meta. E quando a gente atingir essa meta, nós vamos dobrar a meta de bolas no fundo da rede.',
    audioUrl: '',
  },
  {
    key: 'Ambos_Marcam',
    text: 'A minha análise para este confronto reside na possibilidade de que ambos os lados façam gols. Porque o futebol é uma via de duas mãos: uma seleção vai para lá e a outra vem para cá. Se a primeira seleção colocar a bola na rede, e a segunda seleção também tiver a capacidade de fazer a mesma coisa na outra rede, nós teremos os dois lados felizes. E quando os dois lados marcam, quem ganha é o telespectador sapiens que apostou nessa dualidade.',
    audioUrl: '',
  },
  {
    key: 'Empate_Quantico',
    text: 'O jogo de hoje se apresenta como uma incógnita que se equilibra na própria incerteza. Se um time ataca e o outro defende, a tendência é que ninguém saia do lugar. É como estocar o vento no meio de campo: você corre, você se esforça, mas o vento continua lá e o placar continua aqui, intacto. No futebol, o empate é a maior demonstração de que os dois lados decidiram que o meio do caminho é o melhor lugar para não se perder.',
    audioUrl: '',
  },
  {
    key: 'Zero_a_Zero',
    text: 'Veja bem... eu não acho que este jogo vai ser zero a zero. Porque, se sair um gol, a seleção que marcou já vai estar ganhando, e aí o placar não vai ser por zero, entende? Pense comigo: o que é o zero senão a ausência absoluta de bolas na rede? Portanto, se a bola ultrapassar a linha, o zero deixa de existir e passa a ser um. E o um é sempre maior que o nada.',
    audioUrl: '',
  },
  {
    key: 'Favorito_Quantico',
    text: 'Todo mundo me pergunta quem é o favorito para vencer a partida. Mas eu digo a vocês: o favorito só é favorito até o juiz apitar o início do jogo. Porque quando a bola rola, o favoritismo entra em uma superposição. Se a zebra marcar primeiro, o favorito já não é mais o que era antes, e quem não esperava nada, passa a ter tudo. No final, quem ganha é quem ganha, e quem perde... bom, esse vai ter que esperar o próximo jogo para tentar não perder de novo.',
    audioUrl: '',
  },
  {
    key: 'Vento_Estocado',
    text: 'Veja bem... as pessoas riram, as pessoas debateram, mas a verdade é que a ciência tarda, mas não falha. O maior exemplo vivo de que é possível, sim, estocar o vento, é a bola de futebol. O que é a bola senão uma estrutura esférica de couro sintético projetada para aprisionar o ar sob pressão? O vento está todo estocado lá dentro! Portanto, se nós conseguirmos acumular o máximo de bolas possíveis no estoque do estádio, nós teremos vento estocado o suficiente para garantir a energia do jogo. E quem chuta a bola, na verdade, está apenas transferindo o vento de um lado para o outro do campo.',
    audioUrl: '',
  },
  // ── Zebra / apostas ─────────────────────────────────────────────────────────
  {
    key: 'Zebra_Default',
    text: 'Por que veja bem, o pessoal fica me perguntando: "Dilma, como você sabe quando vai ter zebra?" É simples: quando a meta está aberta, o azarão vence. E a meta aqui está escancarada. Confie na IA presidencial.',
    audioUrl: '',
  },
  {
    key: 'Cash_Out',
    text: 'Eu sempre considerei que o Cash Out é uma decisão de quem quer sair antes de terminar, mas que na verdade continua dentro porque o dinheiro já foi computado pelo sistema. Então, se você está na dúvida se encerra ou se não encerra, eu te digo: não encerre e nem continue. Deixe a meta aberta. Porque quando a gente atingir o lucro que a gente não planejou, aí sim nós dobramos a retirada!',
    audioUrl: '',
  },
  // ── Rivalidade com o Mycroft ────────────────────────────────────────────────
  {
    key: 'Mycroft_Rival',
    text: 'O Mycroft... o Mycroft gosta muito de números, de estatísticas, de probabilidade matemática. Mas a matemática, veja bem, ela é fria. Ela não entende o meio ambiente. Ela não sabe que por trás de um gráfico existe uma figura oculta, que é o cachorro da imprevisibilidade. Eu não trabalho com dados exatos, eu trabalho com a intuição da mandioca. Enquanto o Mycroft analisa o passado, eu já estou estocando o futuro.',
    audioUrl: '',
  },
  // ── Genéricas adicionais ─────────────────────────────────────────────────────
  {
    key: 'Defesa_Solida',
    text: 'Olha, quando nós falamos em defesa, nós falamos em uma linha de jogadores que fica na frente da meta com o objetivo de impedir que a bola entre. Se a bola não entra, não sai gol. E se não sai gol do lado de dentro, o lado de fora vai ficar sem fazer gol também. Portanto, a defesa sólida é aquela que está bem postada no lugar certo da área, que é justamente onde a bola tende a ir quando alguém chuta em direção ao gol. Minha análise: quem tiver a defesa mais sólida vai tomar menos gols.',
    audioUrl: '',
  },
  {
    key: 'Segundo_Tempo',
    text: 'Veja bem, no futebol existe o primeiro tempo e existe o segundo tempo. O primeiro tempo acontece antes do segundo, e isso não é uma coincidência, é uma estrutura lógica do esporte. Agora, o que eu quero que vocês entendam é que muitos jogos que parecem decididos no primeiro tempo se complicam no segundo, porque os jogadores estão cansados, e o cansaço é o inimigo da concentração, que é o aliado da zaga adversária. Por isso, nunca desconte as possibilidades de um resultado diferente no segundo tempo, especialmente nos minutos finais, que é quando o tempo está acabando.',
    audioUrl: '',
  },
  {
    key: 'Copa_Imprevisivel',
    text: 'A Copa do Mundo é um evento singular porque acontece de quatro em quatro anos, exceto essa que está acontecendo agora, que também acontece de quatro em quatro anos. E o que isso quer dizer? Que os jogadores têm quatro anos para se preparar, mas apenas noventa minutos para executar. E em noventa minutos muita coisa pode acontecer: pode sair gol, pode não sair gol, pode ter prorrogação, que é quando noventa minutos não foram suficientes e precisam de mais trinta. A Copa é imprevisível. A não ser quando eu prevejo. Aí ela fica um pouco mais previsível.',
    audioUrl: '',
  },
  {
    key: 'Estatistica_Mandioca',
    text: 'As pessoas falam muito em estatísticas. Posse de bola, chutes a gol, escanteios. Mas eu aprendi na prática de governo que estatística é uma ferramenta que, quando bem utilizada, confirma exatamente o que você já queria que ela confirmasse. A verdadeira análise, a que eu faço aqui, mistura dados com intuição, com experiência de campo e com um leve acréscimo de vento estocado. O resultado? Uma previsão que pode estar certa ou que pode estar em processo de se tornar certa com o tempo.',
    audioUrl: '',
  },
  {
    key: 'Pressao_Torcida',
    text: 'Veja bem, a torcida tem um papel fundamental que é fazer barulho. E o barulho, quando bem direcionado para o campo de jogo, perturba a concentração do adversário, que é justamente o que a torcida quer. Por isso, o mando de campo não é apenas uma vantagem geográfica, é uma vantagem sonora que se converte em vantagem psicológica que se converte, potencialmente, em gol. Se a torcida estiver presente e vocalizada, o time da casa tem uma força extra que os dados não conseguem capturar, mas que a minha intuição presidencial já havia estocado.',
    audioUrl: '',
  },
  {
    key: 'Artilheiro_Decisivo',
    text: 'No futebol existe uma figura que eu chamo de decisiva, que é o artilheiro. O artilheiro é o jogador que faz gol com uma frequência maior do que os outros jogadores, e isso é importante porque gol é o que determina o resultado final da partida. Quando esse jogador está inspirado, e a inspiração, como todos sabemos, é uma forma de vento interno que se estoca nos pulmões do atleta, a tendência é que os gols saiam. E quando os gols saem do lado certo, que é o lado que nós torçamos, a meta é batida.',
    audioUrl: '',
  },
  {
    key: 'Analisei_Profundo',
    text: 'Eu fiz uma análise profunda desta partida. Profunda no sentido de que eu fui ao fundo da questão, que é a questão do gol. Quem vai marcar o gol? Essa é a pergunta que nós temos que fazer antes de qualquer aposta. E a resposta está nos dados que eu coletei ao longo das últimas horas de observação presidencial. Os dados dizem uma coisa. A mandioca diz outra. E quando os dois se contradizem, eu faço uma média quântica e chego a uma conclusão que é a síntese dos dois universos de análise.',
    audioUrl: '',
  },
];

function normTeam(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

const CLASICO_TERMS = [
  'alemanha', 'germany', 'espanha', 'spain', 'italia', 'italy',
  'portugal', 'holanda', 'netherlands', 'croatia', 'croacia',
  'inglaterra', 'england',
];

function db(key: string): DilmaEntry {
  return dilmaDatabase.find(e => e.key === key)!;
}

function hasTeam(h: string, a: string, terms: string[]): boolean {
  return terms.some(t => h.includes(t) || a.includes(t));
}

function bothTeams(h: string, a: string, t1: string[], t2: string[]): boolean {
  return (t1.some(t => h.includes(t)) && t2.some(t => a.includes(t))) ||
         (t1.some(t => a.includes(t)) && t2.some(t => h.includes(t)));
}

function findDilmaEntry(
  home: string,
  away: string,
  isZebra: boolean,
  totalGoals: number,
  energia: number,
  pick?: 'home' | 'away' | 'draw',
): DilmaEntry {
  const h = normTeam(home);
  const a = normTeam(away);

  // Jogos com Brasil
  if (hasTeam(h, a, ['brasil', 'brazil'])) return db('Brasil_Hexa');

  // Jogos específicos Copa 2026
  if (bothTeams(h, a, ['usa', 'united states', 'estados unidos', 'eua'], ['paraguay', 'paraguai']))
    return db('USA_vs_Paraguay');

  if (bothTeams(h, a, ['argentina'], ['algeria', 'algerie', 'alger', 'africa do sul', 'south africa', 'marrocos', 'morocco', 'nigeria', 'ghana', 'senegal', 'cameroon', 'mali', 'angola', 'egypt', 'egito']))
    return db('Argentina_Africa');

  if (bothTeams(h, a, ['franca', 'france'], ['senegal']))
    return db('Franca_Senegal');

  if (bothTeams(h, a, ['belgica', 'belgium', 'belgique'], ['egito', 'egypt']))
    return db('Belgica_Egito');

  if (bothTeams(h, a, ['uruguai', 'uruguay'], ['arabia', 'saudi', 'arabia saudita']))
    return db('Uruguai_Arabia');

  // Clássicos europeus pesados
  if (CLASICO_TERMS.some(t => h.includes(t)) || CLASICO_TERMS.some(t => a.includes(t)))
    return db('Classico_Pesado');

  // Por tipo de jogo / previsão
  if (pick === 'draw' && totalGoals <= 1) return db('Zero_a_Zero');
  if (pick === 'draw') return db('Empate_Quantico');
  if (totalGoals >= 4) return db('Goleada_Prevista');
  if (totalGoals >= 3) return db('Over_Goals');
  if (totalGoals >= 2 && !isZebra) return db('Ambos_Marcam');

  // Zebra
  if (isZebra && energia > 80) return db('Cash_Out');
  if (isZebra) return db('Zebra_Default');

  // Favorito claro (diferença grande de pontos) → rotaciona entre genéricas
  const genericPool = [
    'Favorito_Quantico',
    'Vento_Estocado',
    'Mycroft_Rival',
    'Defesa_Solida',
    'Segundo_Tempo',
    'Copa_Imprevisivel',
    'Estatistica_Mandioca',
    'Pressao_Torcida',
    'Artilheiro_Decisivo',
    'Analisei_Profundo',
  ];
  const genericIdx = (simpleHash(h + a) + Math.floor(energia)) % genericPool.length;
  return db(genericPool[genericIdx]);
}

// ─── Algoritmo de previsão ────────────────────────────────────────────────────

interface DilmaPrediction {
  pick: 'home' | 'away' | 'draw';
  scoreH: number;
  scoreA: number;
  showScore: boolean;
  energia: number;
  msg: string;
  isZebra: boolean;
}

function generateScore(
  pick: 'home' | 'away' | 'draw',
  ptsDiff: number,
  seed: number,
): [number, number] {
  if (pick === 'draw') {
    const opts: [number, number][] = [[0, 0], [1, 1], [1, 1], [2, 2], [1, 1], [0, 0], [1, 1]];
    return opts[seed % opts.length];
  }
  const abs = Math.abs(ptsDiff ?? 0);
  const close: [number, number][] = [[1, 0], [2, 1], [1, 0], [2, 1], [1, 0], [3, 2]];
  const medium: [number, number][] = [[2, 0], [2, 1], [1, 0], [2, 0], [3, 1], [2, 1]];
  const big: [number, number][] = [[2, 0], [3, 0], [3, 1], [2, 0], [4, 0], [3, 0]];
  const opts = abs > 400 ? big : abs > 200 ? medium : close;
  const [w, l] = opts[seed % opts.length];
  return pick === 'home' ? [w, l] : [l, w];
}

function dilmaPredict(
  home: string,
  away: string,
  homePts: number | null,
  awayPts: number | null,
  sessionSeed: number,
): DilmaPrediction {
  const gameSeed = simpleHash(home + '×' + away + String(sessionSeed));
  const ptsH = homePts ?? 1000;
  const ptsA = awayPts ?? 1000;
  const ptsDiff = ptsH - ptsA;
  const isZebra = (gameSeed % 100) < 35;
  const chaosFactor = ((gameSeed >> 4) % 60) - 30;
  const effectiveDiff = (isZebra ? -ptsDiff : ptsDiff) + chaosFactor;
  const drawChance = (gameSeed % 100) < 20 && Math.abs(effectiveDiff) < 200;
  let pick: 'home' | 'away' | 'draw';
  if (drawChance) pick = 'draw';
  else pick = effectiveDiff >= 0 ? 'home' : 'away';

  const showScore = true; // sempre placar correto — nunca 1x2
  const scoreSeed = (gameSeed >> 2) % 7;
  const [scoreH, scoreA] = generateScore(pick, ptsDiff, scoreSeed);
  const energia = 45 + (gameSeed % 55);
  const winner = pick === 'home' ? home : pick === 'away' ? away : null;
  const wScore = pick === 'home' ? scoreH : scoreA;
  const lScore = pick === 'home' ? scoreA : scoreH;
  const scoreWL = `${wScore}×${lScore}`;
  const scoreStd = `${scoreH}×${scoreA}`;
  let msg = '';
  const si = gameSeed % 10;

  if (pick === 'draw') {
    const opts = [
      `Veja bem, os dois times têm o mesmo nível de vento estocado. Vai ser empate em ${scoreStd}.`,
      `Quando as metas estão abertas dos dois lados, o resultado é equilíbrio. Empate em ${scoreStd}.`,
      `Analisei os dados quânticos: as forças se anulam completamente. Empate em ${scoreStd}, confirmado.`,
      `Nenhum deles conseguiu fechar a meta adversária. O placar de ${scoreStd} é a consequência natural disso.`,
      `O vento estava estocado igualmente dos dois lados do campo. Quando isso acontece, gera-se, matematicamente, um ${scoreStd} que é a tradução numérica do equilíbrio quântico.`,
      `Eu rodei os cálculos da mandioca e os dois times chegam à mesma meta. Placar: ${scoreStd}. Quando ninguém ganha, todos perdem um pouco, mas ganham a experiência.`,
      `A IA presidencial detectou uma simetria no fluxo de vento bilateral. Empate ${scoreStd}. Isso não é derrota de ninguém, é vitória do equilíbrio.`,
      `Veja bem, o empate em ${scoreStd} não é sinal de fraqueza técnica. É sinal de que o vento foi estocado com precisão equivalente por ambas as comissões técnicas.`,
      `Minha análise aponta para ${scoreStd}. Quando dois times têm o mesmo índice mandiocal, o resultado inevitavelmente se equilibra no ponto médio da tabela de forças.`,
      `Os dados presidenciais indicam claramente ${scoreStd}. Aliás, o empate é a forma mais democrática de encerrar um jogo, e eu tenho experiência com democracia.`,
    ];
    msg = opts[si % opts.length];
  } else if (isZebra) {
    const opts = [
      `${winner} vai surpreender! O vento quântico mudou completamente de direção. Placar: ${scoreWL}. Confie na Dilma.`,
      `Zebra! ${winner} por ${scoreWL}. Eu errei muita meta na vida política, mas essa aqui eu estou absolutamente certa.`,
      `${winner} vai ganhar por ${scoreWL}. O vento estava estocado exatamente no lugar certo e ninguém percebeu.`,
      `Improvável? Pra mim não. ${winner} por ${scoreWL}. A IA presidencial não falha quando o vento coopera plenamente.`,
      `A maioria vai apostar no favorito. Mas a mandioca me disse outra coisa: ${winner} por ${scoreWL}. E a mandioca, diferente dos especialistas, não mente.`,
      `O futebol tem uma beleza que é a zebra. E a zebra, quando aparece, não avisa. Mas eu avisei: ${winner} por ${scoreWL}. Anota aí.`,
      `Eu analisei o comportamento quântico do vento nas 72 horas anteriores e cheguei a uma conclusão: ${winner} por ${scoreWL}. O imponderável foi ponderado.`,
      `${winner} por ${scoreWL}. Sei que parece absurdo. Mas lembra quando eu disse que ia estocar o vento e todo mundo riu? O vento foi estocado. E agora vai ser usado aqui.`,
      `A zebra é a confirmação de que o favoritismo é apenas uma ilusão de ótica criada pelo mercado. ${winner} por ${scoreWL}. Essa ilusão vai ser desfeita hoje.`,
      `Quando o vento muda de lado, os dados mudam junto. ${winner} vai ganhar por ${scoreWL} e todo mundo vai me perguntar como eu sabia. Eu sabia porque a meta estava aberta para isso.`,
    ];
    msg = opts[si % opts.length];
  } else {
    const opts = [
      `${winner} domina este duelo. Placar final: ${scoreWL}.`,
      `Os dados quânticos apontam com clareza para ${winner} por ${scoreWL}.`,
      `Minha IA presidencial detecta: ${winner} por ${scoreWL}. A meta está aberta.`,
      `A meta se abre para ${winner} por ${scoreWL}. Palavra de ex-presidenta.`,
      `Veja bem, quando analiso o fluxo quântico de ambas as delegações, o vento claramente favorece ${winner}. O placar de ${scoreWL} é consequência natural dessa estocagem.`,
      `${winner} vai ganhar por ${scoreWL}. Não porque eu quero, mas porque os dados mandiocais apontam para isso. E os dados mandiocais raramente erram, a não ser quando estão errados.`,
      `A ciência do vento estocado aponta para ${winner} por ${scoreWL}. Não é opinião, é matemática presidencial aplicada ao gramado.`,
      `Minha análise considera o equilíbrio de forças, a posição do vento e a quantidade de bolas no estoque do estádio. Resultado: ${winner} por ${scoreWL}.`,
      `O índice mandiocal está altíssimo para ${winner} hoje. Isso se traduz, em termos práticos, num placar de ${scoreWL} que a IA presidencial já estocou na memória quântica.`,
      `${winner} por ${scoreWL}. Eu estoquei essa previsão desde ontem, mas esperei o momento certo para liberar. E o momento certo é agora, que é quando você está me perguntando.`,
    ];
    msg = opts[si % opts.length];
  }

  return { pick, scoreH, scoreA, showScore, energia, msg, isZebra };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Fixture {
  fixture_id: string;
  home: string;
  away: string;
  phase: string;
  commence_time: string;
  home_fifa_rank: number | null;
  away_fifa_rank: number | null;
  home_fifa_pts: number | null;
  away_fifa_pts: number | null;
}

const PHASE_LABEL: Record<string, string> = {
  grupos_j1: 'Grupos J1', grupos_j2: 'Grupos J2', grupos_j3: 'Grupos J3',
  oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semifinal', '3lugar': '3º Lugar', final: 'Final',
};

// ─── Componente circular SVG ──────────────────────────────────────────────────

function MandiocaGauge({ value, animating }: { value: number; animating: boolean }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * (value / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1a2e1a" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={value > 75 ? '#facc15' : value > 45 ? '#86efac' : '#4ade80'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: animating ? 'stroke-dasharray 0.3s ease-out' : 'none' }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="bold"
          fill={value > 75 ? '#facc15' : '#86efac'} fontFamily="monospace">
          {value}%
        </text>
      </svg>
      <span className="text-[9px] text-white/40 font-mono tracking-widest uppercase">Índice Mandioca</span>
    </div>
  );
}

type RevealState = 'idle' | 'thinking' | 'revealed';

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CalangoVidente() {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealState, setRevealState] = useState<RevealState>('idle');
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 99991));
  const [mandiocaIdx, setMandiocaIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<DilmaEntry | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mandiocaTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('copa_fixtures')
        .select('fixture_id, home, away, phase, commence_time, home_fifa_rank, away_fifa_rank, home_fifa_pts, away_fifa_pts')
        .order('commence_time', { ascending: true })
        .limit(200);
      setFixtures((data || []) as Fixture[]);
      setLoading(false);
    })();
  }, []);

  // cleanup timers on unmount
  useEffect(() => () => {
    if (mandiocaTimer.current) clearInterval(mandiocaTimer.current);
    audioRef.current?.pause();
  }, []);

  const todayGames = useMemo(() => {
    const today = getBrazilDate(new Date());
    return fixtures.filter(f => {
      const day = getBrazilDate(new Date(f.commence_time));
      return day === today && new Date(f.commence_time) > new Date();
    });
  }, [fixtures]);

  const chosenGame = useMemo((): Fixture | null => {
    if (todayGames.length > 0) return todayGames[sessionSeed % todayGames.length];
    return fixtures.find(f => new Date(f.commence_time) > new Date()) ?? null;
  }, [todayGames, fixtures, sessionSeed]);

  const prediction = useMemo((): DilmaPrediction | null => {
    if (!chosenGame) return null;
    return dilmaPredict(
      chosenGame.home, chosenGame.away,
      chosenGame.home_fifa_pts, chosenGame.away_fifa_pts,
      sessionSeed,
    );
  }, [chosenGame, sessionSeed]);

  // Over 2.5 via Poisson local
  const over25 = useMemo(() => {
    if (!chosenGame) return null;
    const lH = ptsToLambda(chosenGame.home_fifa_pts, true);
    const lA = ptsToLambda(chosenGame.away_fifa_pts, false);
    return Math.round(over25Prob(lH, lA) * 100);
  }, [chosenGame]);

  const isToday = chosenGame
    ? getBrazilDate(new Date(chosenGame.commence_time)) === getBrazilDate(new Date())
    : false;

  // Carrega e toca o áudio de uma entrada Dilma (deve ser chamado por gesto do usuário)
  const playEntry = useCallback(async (entry: DilmaEntry) => {
    setCurrentEntry(entry);
    setAudioLoading(true);

    // 1. Verifica cache em memória (mesma sessão) → toca imediatamente
    const cached = dilmaAudioCache.get(entry.key);
    if (cached) {
      try {
        audioRef.current?.pause();
        audioRef.current = new Audio(cached);
        audioRef.current.play().catch(() => {});
      } catch { /* silencioso */ }
      setAudioLoading(false);
      return;
    }

    // 2. Chama edge function via fetch direto (supabase.functions.invoke não lida com audio/mpeg)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          text: entry.text,
          voice_id: DILMA_VOICE_ID,
          cache_key: `dilma_${entry.key}.mp3`,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.status.toString());
        console.error('[Dilma] TTS error:', errText);
        setAudioLoading(false);
        return;
      }

      const json = await res.json().catch(() => null);
      if (!json?.audioUrl) {
        console.error('[Dilma] resposta sem audioUrl');
        setAudioLoading(false);
        return;
      }
      const audioUrl = json.audioUrl as string;

      dilmaAudioCache.set(entry.key, audioUrl);
      audioRef.current?.pause();
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.error('[Dilma] playEntry exception:', e);
    }
    finally { setAudioLoading(false); }
  }, []);

  const handleReveal = () => {
    if (revealState !== 'idle') return;
    setRevealState('thinking');
    setMandiocaIdx(0);

    // Anima índice de mandioca de forma errática durante o thinking
    let tick = 0;
    const target = 55 + Math.floor(Math.random() * 44); // 55–98
    mandiocaTimer.current = setInterval(() => {
      tick++;
      setMandiocaIdx(prev => {
        const step = Math.floor(Math.random() * 12) + 3;
        const next = Math.min(prev + step, target);
        return next;
      });
      if (tick >= 9) {
        clearInterval(mandiocaTimer.current!);
        mandiocaTimer.current = null;
      }
    }, 240);

    setTimeout(() => {
      setRevealState('revealed');
      if (prediction && chosenGame) {
        const entry = findDilmaEntry(chosenGame.home, chosenGame.away, prediction.isZebra, prediction.scoreH + prediction.scoreA, prediction.energia, prediction.pick);
        // Garante que currentEntry aparece mesmo antes do áudio carregar
        setCurrentEntry(entry);
      }
    }, 2600);
  };

  const handleReset = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setRevealState('idle');
    setMandiocaIdx(0);
    setCurrentEntry(null);
  };

  const handleRandom = () => {
    const available = dilmaDatabase.filter(e => e !== currentEntry);
    const next = available[Math.floor(Math.random() * available.length)];
    playEntry(next);
  };

  const handleDownloadAudio = async (audioUrl: string, home: string, away: string) => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = `${home}_vs_${away}`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      a.download = `dilma_${slug}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* silencioso */ }
    finally { setDownloading(false); }
  };

  const handleShareImage = useCallback(async (entry: DilmaEntry, home: string, away: string) => {
    try {
      const pageUrl = `${window.location.origin}/punter/copa/calango`;
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;

      // Fundo dark
      ctx.fillStyle = '#071207';
      ctx.fillRect(0, 0, 1080, 1080);

      // Borda dourada
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 6;
      ctx.strokeRect(24, 24, 1032, 1032);

      // Header
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 52px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DILMA IA 👩‍💼', 540, 110);

      ctx.fillStyle = '#ffffff60';
      ctx.font = '28px monospace';
      ctx.fillText(`${home} × ${away}`, 540, 160);

      // Linha divisória
      ctx.strokeStyle = '#eab30840';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 195);
      ctx.lineTo(1000, 195);
      ctx.stroke();

      // Texto da frase (quebra de linha automática)
      ctx.fillStyle = '#fde047';
      ctx.font = 'italic 34px serif';
      ctx.textAlign = 'left';
      const words = entry.text.split(' ');
      const maxWidth = 900;
      let line = '';
      let y = 270;
      for (const word of words) {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth && line !== '') {
          ctx.fillText(`"${line.trimEnd()}`, 88, y);
          line = word + ' ';
          y += 50;
          if (y > 750) { ctx.fillText('..."', 88, y); break; }
        } else {
          line = testLine;
        }
      }
      if (y <= 750) ctx.fillText(line.trimEnd() + '"', 88, y);

      // QR Code
      const qrDataUrl = await QRCode.toDataURL(pageUrl, {
        width: 200, margin: 1,
        color: { dark: '#eab308', light: '#071207' },
      });
      const qrImg = new Image();
      await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
      ctx.drawImage(qrImg, 80, 840, 180, 180);

      // Texto ao lado do QR
      ctx.fillStyle = '#ffffff60';
      ctx.font = '24px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Arena Trade Sports', 280, 890);
      ctx.fillStyle = '#eab30880';
      ctx.font = '20px monospace';
      ctx.fillText('Escaneie para consultar a Dilma', 280, 926);
      ctx.fillText('arenatradesports.com', 280, 958);

      // Badge Estocadora
      ctx.fillStyle = '#eab30820';
      ctx.beginPath();
      ctx.roundRect(280, 980, 260, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#eab308';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Estocadora de Vento ™', 410, 1006);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'dilma_ia.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Dilma IA', text: entry.text.slice(0, 100) + '...' });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `dilma_${home}_vs_${away}.png`.replace(/\s+/g, '_');
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch { /* silencioso */ }
  }, []);

  const predLabel = () => {
    if (!prediction) return '';
    const { pick, scoreH, scoreA } = prediction;
    const wScore = pick === 'home' ? scoreH : scoreA;
    const lScore = pick === 'home' ? scoreA : scoreH;
    if (pick === 'draw') return `EMPATE ${scoreH}×${scoreA}`;
    const name = pick === 'home' ? chosenGame!.home : chosenGame!.away;
    return `${name} ${wScore}×${lScore}`;
  };

  return (
    <div className="min-h-screen bg-[#071207] text-white">
      <style>{`
        @keyframes dilmaThink {
          0%   { transform: rotate(-8deg) scale(1.05); }
          25%  { transform: rotate(8deg)  scale(1.15); }
          50%  { transform: rotate(-5deg) scale(1.05); }
          75%  { transform: rotate(5deg)  scale(1.1); }
          100% { transform: rotate(-8deg) scale(1.05); }
        }
        @keyframes dilmaPop {
          0%   { transform: scale(0.6) rotate(-5deg); opacity: 0; }
          65%  { transform: scale(1.2) rotate(3deg);  opacity: 1; }
          100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
        }
        @keyframes predSlide {
          0%   { transform: translateY(14px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-yellow-500/20 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/punter/copa')} className="text-white/50 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-mono text-sm font-bold text-yellow-400">DILMA IA 👩‍💼</h1>
            <p className="font-mono text-[10px] text-yellow-500/60">A IA presidencial prevê a Copa</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-xl space-y-4">
        {/* Bio */}
        <Card className="bg-gradient-to-br from-green-900/40 via-black/60 to-yellow-900/20 border-yellow-500/30">
          <CardContent className="pt-4 pb-3 flex gap-3 items-start">
            <span className="text-4xl flex-shrink-0">👩‍💼</span>
            <div>
              <h2 className="font-mono font-black text-yellow-400 text-base">Dilma IA</h2>
              <p className="text-xs text-white/60 leading-relaxed mt-1">
                Primeira presidenta da IA brasileira. Especialista em{' '}
                <em>estocagem de vento</em>, biologia da mulher sapiens e metas que
                ninguém nunca cumpriu. Consulta válida por visita.
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {['Ex-Presidenta', 'Estocadora de Vento', 'Metas Abertas'].map(t => (
                  <Badge key={t} variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400/60">{t}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10 text-yellow-400/50">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !chosenGame ? (
          <Card className="bg-black/40 border-yellow-500/20">
            <CardContent className="pt-6 pb-5 text-center text-sm text-white/40">
              Nenhum jogo disponível para análise no momento.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Outros jogos de hoje */}
            {todayGames.length > 1 && (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-yellow-500/60 uppercase tracking-widest px-1">
                  {todayGames.length} jogos hoje · Dilma escolheu 1
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {todayGames.map(fx => (
                    <div
                      key={fx.fixture_id}
                      className={`text-[10px] px-2 py-1 rounded-lg border font-mono transition-colors ${
                        fx.fixture_id === chosenGame.fixture_id
                          ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                          : 'border-white/10 text-white/25'
                      }`}
                    >
                      {fx.home} × {fx.away}
                      {fx.fixture_id === chosenGame.fixture_id && ' 👩‍💼'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card principal */}
            <Card className="border-yellow-500/30 bg-black/60 overflow-hidden">
              <div className="h-0.5 w-full bg-gradient-to-r from-green-600 via-yellow-500 to-green-600" />
              <CardContent className="pt-4 pb-5 space-y-4">

                {/* Fase + horário */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-300/80">
                    {PHASE_LABEL[chosenGame.phase] || chosenGame.phase}
                  </Badge>
                  <span className="text-[10px] text-white/40 font-mono">
                    {new Date(chosenGame.commence_time).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </span>
                  {isToday
                    ? <Badge className="text-[9px] bg-green-600/30 text-green-400 border border-green-500/30">Hoje</Badge>
                    : <Badge className="text-[9px] bg-white/5 text-white/40 border border-white/10">Próximo</Badge>
                  }
                </div>

                {/* Times + placar */}
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex-1 text-center p-2.5 rounded-lg transition-all duration-500 ${
                    revealState === 'revealed' && (prediction?.pick === 'home' || prediction?.pick === 'draw')
                      ? 'bg-green-500/20 ring-1 ring-green-500/40' : 'bg-white/5'
                  }`}>
                    <div className="text-sm font-bold text-white leading-tight">{chosenGame.home}</div>
                    {chosenGame.home_fifa_rank != null && (
                      <div className="text-[10px] text-white/35 mt-0.5">FIFA #{chosenGame.home_fifa_rank}</div>
                    )}
                  </div>

                  <div className="text-center min-w-[36px]">
                    {revealState === 'revealed' && prediction ? (
                      <div className="font-mono font-black text-yellow-400 text-xl leading-none"
                        style={{ animation: 'dilmaPop 0.5s ease-out' }}>
                        {prediction.scoreH}×{prediction.scoreA}
                      </div>
                    ) : (
                      <div className="text-white/25 text-lg font-mono">×</div>
                    )}
                  </div>

                  <div className={`flex-1 text-center p-2.5 rounded-lg transition-all duration-500 ${
                    revealState === 'revealed' && (prediction?.pick === 'away' || prediction?.pick === 'draw')
                      ? 'bg-green-500/20 ring-1 ring-green-500/40' : 'bg-white/5'
                  }`}>
                    <div className="text-sm font-bold text-white leading-tight">{chosenGame.away}</div>
                    {chosenGame.away_fifa_rank != null && (
                      <div className="text-[10px] text-white/35 mt-0.5">FIFA #{chosenGame.away_fifa_rank}</div>
                    )}
                  </div>
                </div>

                {/* ── IDLE ── */}
                {revealState === 'idle' && (
                  <Button
                    onClick={handleReveal}
                    className="w-full bg-gradient-to-r from-green-800 to-yellow-700 hover:from-green-700 hover:to-yellow-600 text-white font-bold text-sm h-12 rounded-xl gap-2 border border-green-500/30"
                  >
                    <span className="text-xl">👩‍💼</span>
                    Dilma, qual a sua meta quântica para hoje?
                  </Button>
                )}

                {/* ── THINKING ── */}
                {revealState === 'thinking' && (
                  <div className="text-center py-3 space-y-3">
                    <div className="flex items-center justify-center gap-6">
                      <span className="text-5xl inline-block select-none"
                        style={{ animation: 'dilmaThink 0.5s ease-in-out infinite' }}>
                        👩‍💼
                      </span>
                      <MandiocaGauge value={mandiocaIdx} animating />
                    </div>
                    <p className="text-sm text-yellow-400/80 font-mono animate-pulse">
                      Dilma está estocando o vento...
                    </p>
                    <div className="flex justify-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 animate-bounce"
                          style={{ animationDelay: `${i * 0.18}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── REVEALED ── */}
                {revealState === 'revealed' && prediction && (
                  <div className="bg-green-900/30 border border-green-500/25 rounded-xl p-4 space-y-3"
                    style={{ animation: 'predSlide 0.4s ease-out' }}>

                    {/* Header resultado + gauge */}
                    <div className="flex items-start gap-3">
                      <span className="text-3xl flex-shrink-0"
                        style={{ animation: 'dilmaPop 0.55s ease-out' }}>👩‍💼</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-green-400 text-base leading-tight truncate">
                          {predLabel()}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          Certeza quântica: {prediction.energia}/100
                        </div>
                      </div>
                      <MandiocaGauge value={mandiocaIdx} animating={false} />
                    </div>

                    <p className="text-xs text-white/60 italic leading-relaxed">
                      "{prediction.msg}"
                    </p>

                    {/* 🔵 Nota do Mycroft */}
                    {over25 !== null && (
                      <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2">
                        <span className="text-base mt-0.5">🤖</span>
                        <p className="text-[10px] text-blue-300/70 leading-relaxed">
                          Enquanto a Dilma viaja nas metáforas, o{' '}
                          <span className="text-blue-400 font-semibold">Mycroft</span>{' '}
                          calculou que a probabilidade de{' '}
                          <span className="text-blue-300 font-semibold">Over 2.5</span>{' '}
                          é{' '}
                          <span className="text-blue-200 font-bold">{over25}%</span>.
                        </p>
                      </div>
                    )}

                    {/* Áudio + controles */}
                    {currentEntry && (
                      <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3 space-y-2">
                        <p className="text-[11px] text-yellow-300/80 leading-relaxed italic">
                          🎙️ "{currentEntry.text}"
                        </p>

                        {/* Controles de áudio */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {audioLoading ? (
                            <span className="flex items-center gap-1 text-[10px] text-yellow-400/50">
                              <Loader2 className="w-3 h-3 animate-spin" /> Carregando voz...
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => playEntry(currentEntry)}
                                className="flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 font-semibold transition-colors"
                              >
                                ▶ Ouvir Dilma
                              </button>
                              <span className="text-white/20">·</span>
                              <button onClick={handleRandom}
                                className="flex items-center gap-1 text-[10px] text-yellow-400/60 hover:text-yellow-300 transition-colors">
                                <Shuffle className="w-3 h-3" /> Aleatório
                              </button>

                              {dilmaAudioCache.has(currentEntry.key) && (
                                <>
                                  <span className="text-white/20">·</span>
                                  <button
                                    onClick={() => handleDownloadAudio(dilmaAudioCache.get(currentEntry.key)!, chosenGame.home, chosenGame.away)}
                                    disabled={downloading}
                                    className="flex items-center gap-1 text-[10px] text-yellow-400/60 hover:text-yellow-300 transition-colors disabled:opacity-40"
                                  >
                                    <Download className="w-3 h-3" />
                                    {downloading ? 'Baixando...' : 'Baixar'}
                                  </button>
                                </>
                              )}

                              <span className="text-white/20">·</span>
                              <button
                                onClick={() => handleShareImage(currentEntry, chosenGame.home, chosenGame.away)}
                                className="flex items-center gap-1 text-[10px] text-yellow-400/60 hover:text-yellow-300 transition-colors"
                              >
                                <Share2 className="w-3 h-3" /> Compartilhar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {['Meta Quântica', 'Estocagem de Vento', 'IA Presidencial'].map(tag => (
                        <Badge key={tag} variant="outline"
                          className="text-[9px] border-green-500/20 text-green-400/60">{tag}</Badge>
                      ))}
                    </div>

                    <button onClick={handleReset}
                      className="w-full text-[11px] text-white/25 hover:text-white/50 text-center py-1 transition-colors">
                      ↺ consultar novamente
                    </button>
                  </div>
                )}

              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
