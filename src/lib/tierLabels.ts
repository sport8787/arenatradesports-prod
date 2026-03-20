/**
 * Mapeamento de Tiers internos → linguagem do usuário
 * Backend usa tier numérico (1/2/3) e labels internos (Elite/Forte/Valor).
 * Frontend exibe apenas linguagem de ação.
 */

export interface TierDisplay {
  icon: string;
  label: string;
  sublabel: string;
  stakeLabel: string;
  color: string; // HSL CSS variable or fallback
  colorHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

const TIER_MAP: Record<string, TierDisplay> = {
  // Tier 1 — Elite
  'Elite': {
    icon: '⚡',
    label: 'SINAL FORTE',
    sublabel: 'Alta convicção do Mycroft',
    stakeLabel: '4-5% da banca',
    color: 'hsl(var(--warning))',
    colorHex: '#F59E0B',
    bgClass: 'bg-warning/15',
    textClass: 'text-warning',
    borderClass: 'border-warning/30',
    description: 'O Mycroft identificou vantagem matemática significativa sobre o mercado. Probabilidade estimada alta e edge acima de 7%. Entradas desse nível são raras — surgem em menos de 10% das análises.',
  },
  // Tier 2 — Forte
  'Forte': {
    icon: '✅',
    label: 'SINAL BOM',
    sublabel: 'Confiança elevada',
    stakeLabel: '3% da banca',
    color: 'hsl(var(--success))',
    colorHex: '#22C55E',
    bgClass: 'bg-success/15',
    textClass: 'text-success',
    borderClass: 'border-success/30',
    description: 'Análise com boa margem de vantagem sobre as odds do mercado. Probabilidade estimada confortável e edge sólido. Entrada recomendada com stake padrão.',
  },
  // Tier 3 — Valor
  'Valor': {
    icon: '🎯',
    label: 'SINAL MODERADO',
    sublabel: 'Apostar com cautela',
    stakeLabel: '2% da banca',
    color: 'hsl(var(--primary))',
    colorHex: '#3B82F6',
    bgClass: 'bg-primary/15',
    textClass: 'text-primary',
    borderClass: 'border-primary/30',
    description: 'O Mycroft identificou valor, mas com margem menor. A probabilidade está acima do mínimo aceitável e o edge é positivo. Entrada válida com stake reduzido — não apostar acima de 2%.',
  },
  // Vetado
  'Vetado': {
    icon: '⛔',
    label: 'SEM VALOR',
    sublabel: 'Mycroft não recomenda',
    stakeLabel: '—',
    color: 'hsl(var(--destructive))',
    colorHex: '#EF4444',
    bgClass: 'bg-destructive/15',
    textClass: 'text-destructive',
    borderClass: 'border-destructive/30',
    description: 'A análise não encontrou vantagem matemática suficiente sobre as odds do mercado. Apostar neste evento aumentaria o risco sem retorno esperado positivo.',
  },
};

// Aliases for numeric tiers and other formats
const ALIASES: Record<string, string> = {
  '1': 'Elite',
  '2': 'Forte',
  '3': 'Valor',
  'Tier 1': 'Elite',
  'Tier 2': 'Forte',
  'Tier 3': 'Valor',
  'ELITE': 'Elite',
  'FORTE': 'Forte',
  'VALOR': 'Valor',
  'VETADO': 'Vetado',
  'vetado': 'Vetado',
  'SINAL FORTE': 'Elite',
  'SINAL BOM': 'Forte',
  'SINAL MODERADO': 'Valor',
  'SEM VALOR': 'Vetado',
};

/**
 * Convert any tier identifier to user-friendly display config.
 * Accepts: 1/2/3, 'Elite'/'Forte'/'Valor', 'Tier 1'/etc, stake percentage
 */
export function getTierDisplay(tierOrStake: string | number | null | undefined): TierDisplay {
  if (tierOrStake == null) return TIER_MAP['Valor'];

  const key = String(tierOrStake);

  // Direct match
  if (TIER_MAP[key]) return TIER_MAP[key];

  // Alias match
  if (ALIASES[key]) return TIER_MAP[ALIASES[key]];

  // Infer from stake percentage
  const num = typeof tierOrStake === 'number' ? tierOrStake : parseFloat(key);
  if (!isNaN(num)) {
    if (num >= 4) return TIER_MAP['Elite'];
    if (num >= 3) return TIER_MAP['Forte'];
    if (num >= 1) return TIER_MAP['Valor'];
  }

  return TIER_MAP['Valor'];
}

/**
 * Get tier display from stake percentage (used when only stake % is available)
 */
export function getTierFromStake(stakePercent: number): TierDisplay {
  if (stakePercent >= 4) return TIER_MAP['Elite'];
  if (stakePercent >= 3) return TIER_MAP['Forte'];
  return TIER_MAP['Valor'];
}

/**
 * Convert internal tier name to user-facing label for charts/tables
 */
export function tierToUserLabel(tier: string): string {
  const display = getTierDisplay(tier);
  return `${display.icon} ${display.label}`;
}
