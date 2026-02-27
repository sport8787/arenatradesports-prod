// ══════════════════════════════════════════════════════════
// HYBRID BETTING SYSTEM - Martingale + Kelly + True Count
// Sistema adaptativo que protege, recupera e ataca
// ══════════════════════════════════════════════════════════

export type BettingMode = 'martingale' | 'kelly_quarter' | 'kelly_half' | 'kelly_full' | 'hybrid' | 'flat';

export interface BettingConfig {
  mode: BettingMode;
  
  // Configurações gerais
  baseUnit: number;          // Aposta base (ex: R$ 5)
  bankroll: number;          // Banca atual
  initialBankroll: number;   // Banca inicial
  
  // Martingale settings
  increment: number;         // Incremento na derrota (ex: R$ 2)
  maxBet: number;            // Teto de segurança (ex: R$ 500)
  
  // Kelly settings
  kellyFraction: 0.25 | 0.5 | 1.0;  // Quarter, Half ou Full Kelly
  
  // Proteções
  stopLoss: number;
  stopWin: number;
  
  // BJ payout
  blackjackPayout?: number;
  
  // Híbrido settings
  hybridConfig?: {
    protectiveThreshold: number;   // TC abaixo disso = proteção (default: -1)
    recoveryThreshold: number;     // TC entre isso e attackThreshold = Martingale (default: 0)
    attackThreshold: number;       // TC acima disso = Kelly (default: 2)
  };
}

export interface BetRecommendation {
  amount: number;
  percentage: number;        // % da banca
  system: 'protective' | 'recovery' | 'attack' | 'standard';
  mode: BettingMode;
  reasoning: string;
  playerEdge: number;
  trueCount: number;
  expectedValue: number;
  risk: 'low' | 'medium' | 'high';
  warning?: string;
}

export interface BettingState {
  currentBet: number;
  lastWinBet: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  totalHands: number;
  totalProfit: number;
}

// ═══ CÁLCULO DE VANTAGEM BASEADA EM TRUE COUNT ═══

/**
 * Calcula vantagem do jogador baseado no True Count
 * Retorna em percentual (ex: -0.5 = -0.5%)
 */
export function calculatePlayerEdge(trueCount: number): number {
  const baseEdge = -0.5; // Casa tem 0.5% de vantagem base
  return baseEdge + (trueCount * 0.5);
}

/**
 * Converte edge percentual para decimal (para cálculos de EV)
 * Ex: -0.5 (%) → -0.005 (decimal)
 */
function edgeToDecimal(edgePercent: number): number {
  return edgePercent / 100;
}

/**
 * Calcula probabilidade de vitória ajustada pelo TC
 */
export function calculateWinProbability(trueCount: number): number {
  const baseWinRate = 0.46;
  const adjustment = trueCount * 0.005;
  return Math.max(0.40, Math.min(0.55, baseWinRate + adjustment));
}

// ═══ KELLY CRITERION ═══

export function calculateKellyBet(
  bankroll: number,
  trueCount: number,
  kellyFraction: 0.25 | 0.5 | 1.0,
  minBet: number = 5,
  maxBet: number = 500
): {
  amount: number;
  percentage: number;
  edge: number;
  winProb: number;
} {
  const edge = calculatePlayerEdge(trueCount);
  const winProb = calculateWinProbability(trueCount);
  const loseProb = 1 - winProb;
  const odds = 1;
  
  if (edge <= 0) {
    return {
      amount: minBet,
      percentage: (minBet / bankroll) * 100,
      edge,
      winProb
    };
  }
  
  // Fórmula de Kelly: f* = (bp - q) / b
  const kellyFull = (odds * winProb - loseProb) / odds;
  const kellyAdjusted = kellyFull * kellyFraction;
  
  let betAmount = bankroll * kellyAdjusted;
  betAmount = Math.max(minBet, Math.min(betAmount, maxBet));
  
  // Não aposta mais que 20% da banca
  const maxSafeBet = bankroll * 0.20;
  betAmount = Math.min(betAmount, maxSafeBet);
  
  return {
    amount: Math.floor(betAmount),
    percentage: (betAmount / bankroll) * 100,
    edge,
    winProb
  };
}

// ═══ MARTINGALE CONSERVADOR ═══

export function calculateMartingaleBet(
  config: BettingConfig,
  state: BettingState,
  lastResult: 'win' | 'loss' | 'push'
): number {
  if (lastResult === 'push') {
    return state.currentBet;
  }
  
  if (lastResult === 'win') {
    if (state.currentBet === config.baseUnit) {
      return config.baseUnit;
    }
    const previousBet = Math.max(
      config.baseUnit,
      state.currentBet - config.increment
    );
    return previousBet;
  }
  
  // Loss = aumenta +increment
  const newBet = Math.min(
    state.currentBet + config.increment,
    config.maxBet
  );
  return newBet;
}

// ═══ SISTEMA HÍBRIDO (O CÉREBRO) ═══

export function calculateHybridBet(
  config: BettingConfig,
  state: BettingState,
  trueCount: number,
  lastResult: 'win' | 'loss' | 'push' | null
): BetRecommendation {
  const hybridConfig = config.hybridConfig || {
    protectiveThreshold: -1,
    recoveryThreshold: 0,
    attackThreshold: 2
  };
  
  const edge = calculatePlayerEdge(trueCount);
  const edgeDec = edgeToDecimal(edge);
  
  // ═══ MODO 1: PROTEÇÃO (TC negativo) ═══
  if (trueCount <= hybridConfig.protectiveThreshold) {
    const protectiveBet = config.baseUnit;
    
    return {
      amount: protectiveBet,
      percentage: (protectiveBet / config.bankroll) * 100,
      system: 'protective',
      mode: 'hybrid',
      reasoning: generateProtectiveReasoning(trueCount, edge),
      playerEdge: edge,
      trueCount,
      expectedValue: protectiveBet * edgeDec,
      risk: 'low',
      warning: trueCount <= -2 ? '🚨 Considere sair da mesa ou aguardar shuffle' : undefined
    };
  }
  
  // ═══ MODO 2: ATAQUE (TC positivo alto) ═══
  if (trueCount >= hybridConfig.attackThreshold) {
    const kelly = calculateKellyBet(
      config.bankroll,
      trueCount,
      config.kellyFraction,
      config.baseUnit,
      config.maxBet
    );
    
    const expectedValue = kelly.amount * edgeDec;
    
    return {
      amount: kelly.amount,
      percentage: kelly.percentage,
      system: 'attack',
      mode: 'hybrid',
      reasoning: generateAttackReasoning(trueCount, edge, kelly.percentage, config.kellyFraction),
      playerEdge: edge,
      trueCount,
      expectedValue,
      risk: kelly.percentage > 10 ? 'high' : kelly.percentage > 5 ? 'medium' : 'low',
      warning: kelly.percentage > 15 ? '⚠️ Aposta alta - variância significativa' : undefined
    };
  }
  
  // ═══ MODO 3: RECUPERAÇÃO (TC neutro) ═══
  const martingaleBet = lastResult 
    ? calculateMartingaleBet(config, state, lastResult)
    : config.baseUnit;
  
  const cappedBet = Math.min(martingaleBet, config.maxBet);
  const expectedValue = cappedBet * edgeDec;
  
  return {
    amount: cappedBet,
    percentage: (cappedBet / config.bankroll) * 100,
    system: 'recovery',
    mode: 'hybrid',
    reasoning: generateRecoveryReasoning(trueCount, edge, state.consecutiveLosses),
    playerEdge: edge,
    trueCount,
    expectedValue,
    risk: state.consecutiveLosses > 5 ? 'high' : state.consecutiveLosses > 3 ? 'medium' : 'low',
    warning: state.consecutiveLosses >= 5 ? '⚠️ 5+ perdas consecutivas - considere pausa' : undefined
  };
}

// ═══ GERAÇÃO DE EXPLICAÇÕES ═══

function generateProtectiveReasoning(tc: number, edge: number): string {
  return `🛡️ MODO PROTEÇÃO ATIVADO

True Count: ${tc}
Vantagem: ${edge.toFixed(1)}% (casa favorecida)

Estratégia: Aposta mínima até baralho melhorar
Aguardando: TC ≥ 0 para modo recuperação
          TC ≥ +2 para modo ataque`;
}

function generateAttackReasoning(
  tc: number, 
  edge: number, 
  percentage: number,
  kellyFraction: number
): string {
  const fractionName = {
    0.25: 'Quarter',
    0.5: 'Half',
    1.0: 'Full'
  }[kellyFraction];
  
  return `🚀 MODO ATAQUE ATIVADO

True Count: +${tc}
Vantagem: +${edge.toFixed(1)}% (você favorecido!)

Momento IDEAL para apostar forte:
• ${fractionName} Kelly recomenda ${percentage.toFixed(1)}% da banca
• Baralho rico em cartas altas
• Probabilidade aumentada de blackjack natural
• Dealer tem mais chance de estourar

CAPITALIZE esta oportunidade rara!`;
}

function generateRecoveryReasoning(tc: number, edge: number, losses: number): string {
  if (losses === 0) {
    return `⚪ MODO RECUPERAÇÃO (Progressão Limpa)

True Count: ${tc >= 0 ? '+' : ''}${tc}
Vantagem: ${edge.toFixed(1)}%

Baralho neutro - usando Martingale conservador
Sem perdas consecutivas - aposta base`;
  }
  
  return `📈 MODO RECUPERAÇÃO (Progressão Ativa)

True Count: ${tc >= 0 ? '+' : ''}${tc}
Vantagem: ${edge.toFixed(1)}%
Perdas consecutivas: ${losses}

Usando Martingale conservador para recuperação gradual
Incremento: +R$ por derrota
Retorna ao valor anterior quando ganhar`;
}

// ═══ FUNÇÃO PRINCIPAL: GET OPTIMAL BET ═══

export function getOptimalBet(
  config: BettingConfig,
  state: BettingState,
  trueCount: number,
  lastResult: 'win' | 'loss' | 'push' | null = null
): BetRecommendation {
  
  // Valida stop loss/win
  const profit = config.bankroll - config.initialBankroll;
  
  if (Math.abs(profit) >= config.stopLoss && profit < 0) {
    throw new Error('STOP_LOSS_REACHED');
  }
  
  if (profit >= config.stopWin) {
    throw new Error('STOP_WIN_REACHED');
  }
  
  // Roteamento por modo
  switch (config.mode) {
    case 'hybrid':
      return calculateHybridBet(config, state, trueCount, lastResult);
    
    case 'kelly_quarter':
    case 'kelly_half':
    case 'kelly_full': {
      const fraction = {
        'kelly_quarter': 0.25,
        'kelly_half': 0.5,
        'kelly_full': 1.0
      }[config.mode] as 0.25 | 0.5 | 1.0;
      
      const kelly = calculateKellyBet(
        config.bankroll,
        trueCount,
        fraction,
        config.baseUnit,
        config.maxBet
      );
      
      const edgeDec = edgeToDecimal(kelly.edge);
      
      // When edge <= 0, use Martingale progression instead of flat min bet
      let finalAmount = kelly.amount;
      let system: 'protective' | 'recovery' | 'attack' | 'standard' = 'standard';
      
      if (kelly.edge <= 0 && lastResult) {
        // Fallback to Martingale progression when Kelly can't help
        const martingaleBet = calculateMartingaleBet(config, state, lastResult);
        finalAmount = Math.min(martingaleBet, config.maxBet);
        system = 'recovery';
      } else if (kelly.edge > 0) {
        system = 'attack';
      }
      
      return {
        amount: finalAmount,
        percentage: (finalAmount / config.bankroll) * 100,
        system,
        mode: config.mode,
        reasoning: kelly.edge > 0 
          ? `Kelly ${fraction === 0.25 ? 'Quarter' : fraction === 0.5 ? 'Half' : 'Full'}
TC: ${trueCount >= 0 ? '+' : ''}${trueCount}
Vantagem: +${kelly.edge.toFixed(1)}%
Aposta: ${(finalAmount / config.bankroll * 100).toFixed(1)}% da banca`
          : `Kelly ${fraction === 0.25 ? 'Quarter' : fraction === 0.5 ? 'Half' : 'Full'} + Martingale
TC: ${trueCount >= 0 ? '+' : ''}${trueCount}
Vantagem: ${kelly.edge.toFixed(1)}% (sem edge → progressão Martingale)
${state.consecutiveLosses > 0 ? `Perdas consecutivas: ${state.consecutiveLosses}` : 'Progressão limpa'}`,
        playerEdge: kelly.edge,
        trueCount,
        expectedValue: finalAmount * edgeDec,
        risk: kelly.percentage > 10 ? 'high' : system === 'recovery' && state.consecutiveLosses > 5 ? 'high' : 'medium'
      };
    }
    
    case 'martingale': {
      const bet = lastResult 
        ? calculateMartingaleBet(config, state, lastResult)
        : config.baseUnit;
      
      const edge = calculatePlayerEdge(trueCount);
      const edgeDec = edgeToDecimal(edge);
      
      return {
        amount: bet,
        percentage: (bet / config.bankroll) * 100,
        system: 'recovery',
        mode: 'martingale',
        reasoning: `Martingale Conservador
Incremento: +R$ ${config.increment} na derrota
Retorna ao último win na vitória
${state.consecutiveLosses > 0 ? `Perdas consecutivas: ${state.consecutiveLosses}` : 'Progressão limpa'}`,
        playerEdge: edge,
        trueCount,
        expectedValue: bet * edgeDec,
        risk: state.consecutiveLosses > 5 ? 'high' : 'medium'
      };
    }
    
    case 'flat': {
      const edge = calculatePlayerEdge(trueCount);
      const edgeDec = edgeToDecimal(edge);
      
      return {
        amount: config.baseUnit,
        percentage: (config.baseUnit / config.bankroll) * 100,
        system: 'standard',
        mode: 'flat',
        reasoning: `Flat Betting - Aposta fixa
Sempre ${config.baseUnit} independente do resultado
Risco mínimo, crescimento lento`,
        playerEdge: edge,
        trueCount,
        expectedValue: config.baseUnit * edgeDec,
        risk: 'low'
      };
    }
    
    default:
      throw new Error(`Modo de aposta inválido: ${config.mode}`);
  }
}

// ═══ SIMULAÇÃO & BACKTESTING ═══

export interface SimulationResult {
  finalBankroll: number;
  profit: number;
  roi: number;
  totalHands: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  largestBet: number;
  averageBet: number;
  kellySuggestions: number;
  martingaleSuggestions: number;
  protectiveSuggestions: number;
}

export function simulateBetting(
  config: BettingConfig,
  hands: number,
  trueCountDistribution: number[]
): SimulationResult {
  let bankroll = config.initialBankroll;
  let state: BettingState = {
    currentBet: config.baseUnit,
    lastWinBet: config.baseUnit,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    totalHands: 0,
    totalProfit: 0
  };
  
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let maxDrawdown = 0;
  let peakBankroll = config.initialBankroll;
  let largestBet = 0;
  let totalBetAmount = 0;
  
  let kellySuggestions = 0;
  let martingaleSuggestions = 0;
  let protectiveSuggestions = 0;
  
  for (let i = 0; i < hands; i++) {
    const tc = trueCountDistribution[i % trueCountDistribution.length];
    
    try {
      const recommendation = getOptimalBet(
        { ...config, bankroll },
        state,
        tc,
        i === 0 ? null : (state.consecutiveLosses > 0 ? 'loss' : 'win')
      );
      
      const bet = recommendation.amount;
      totalBetAmount += bet;
      largestBet = Math.max(largestBet, bet);
      
      if (recommendation.system === 'attack') kellySuggestions++;
      if (recommendation.system === 'recovery') martingaleSuggestions++;
      if (recommendation.system === 'protective') protectiveSuggestions++;
      
      const winProb = calculateWinProbability(tc);
      const random = Math.random();
      
      let result: 'win' | 'loss' | 'push';
      if (random < winProb) {
        result = 'win';
        wins++;
        bankroll += bet;
        state.consecutiveLosses = 0;
        state.consecutiveWins++;
        state.lastWinBet = bet;
      } else if (random < winProb + 0.08) {
        result = 'push';
        pushes++;
      } else {
        result = 'loss';
        losses++;
        bankroll -= bet;
        state.consecutiveLosses++;
        state.consecutiveWins = 0;
      }
      
      state.currentBet = bet;
      state.totalHands++;
      state.totalProfit = bankroll - config.initialBankroll;
      
      if (bankroll > peakBankroll) {
        peakBankroll = bankroll;
      }
      const drawdown = peakBankroll - bankroll;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      
      if (bankroll <= 0) {
        break;
      }
      
    } catch {
      break; // Stop loss/win atingido
    }
  }
  
  const totalHands = wins + losses + pushes;
  
  return {
    finalBankroll: bankroll,
    profit: bankroll - config.initialBankroll,
    roi: ((bankroll - config.initialBankroll) / config.initialBankroll) * 100,
    totalHands,
    wins,
    losses,
    pushes,
    winRate: totalHands > 0 ? (wins / totalHands) * 100 : 0,
    maxDrawdown,
    maxDrawdownPercent: (maxDrawdown / config.initialBankroll) * 100,
    largestBet,
    averageBet: totalHands > 0 ? totalBetAmount / totalHands : 0,
    kellySuggestions,
    martingaleSuggestions,
    protectiveSuggestions
  };
}
