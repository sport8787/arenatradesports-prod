// Mapeia mercado aprovado -> código de plano (fallback quando IA não preenche plan_name).
// Mantém ordem de prioridade: padrões mais específicos PRIMEIRO.
const mercadoParaPlano: Array<[string, string]> = [
  // VINI JR — over HT específico (mais específico que NEYMAR over HT)
  ['over 0.5 ht', 'VINI_JR'],
  ['over 1.5 ht', 'VINI_JR'],
  // NEYMAR — overs FT
  ['over 2.5', 'NEYMAR'],
  ['over 3.5', 'NEYMAR'],
  ['over 1.5', 'NEYMAR'],
  ['over 0.5 próximo gol', 'NEYMAR'],
  ['próximo gol', 'HEXA'],
  // CASEMIRO — unders e BTTS não
  ['under 1.5', 'CASEMIRO'],
  ['under 2.5', 'CASEMIRO'],
  ['btts não', 'CASEMIRO'],
  ['btts nao', 'CASEMIRO'],
  ['ambas marcam não', 'CASEMIRO'],
  ['ambas marcam nao', 'CASEMIRO'],
  // ANCELOTTI — BTTS Sim
  ['btts sim', 'ANCELOTTI'],
  ['ambas marcam', 'ANCELOTTI'],
  // ENDRICK — zebra
  ['back zebra', 'ENDRICK'],
  ['lay favorito', 'ENDRICK'],
  // HEXA — back favorito
  ['back favorito', 'HEXA'],
];

export const planNameByCode: Record<string, string> = {
  NEYMAR: 'Plano NEYMAR',
  VINI_JR: 'Plano VINI JR',
  ENDRICK: 'Plano ENDRICK',
  CASEMIRO: 'Plano CASEMIRO',
  MARQUINHOS: 'Plano MARQUINHOS',
  ANCELOTTI: 'Plano ANCELOTTI',
  HEXA: 'Plano HEXA',
};

export function getPlanCodeByMarket(market: string | null | undefined): string | null {
  if (!market) return null;
  const key = market.toLowerCase().trim();
  for (const [pattern, code] of mercadoParaPlano) {
    if (key.includes(pattern)) return code;
  }
  return null;
}

export function getPlanNameByMarket(market: string | null | undefined): string | null {
  const code = getPlanCodeByMarket(market);
  return code ? planNameByCode[code] : null;
}
