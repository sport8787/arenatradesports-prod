// Valida se um registro de punter_sinais possui todos os campos esperados pela UI.
// Retorna a lista de campos faltantes (vazia = válido).

// Campos OBRIGATÓRIOS (sem eles a UI quebra ao renderizar o card)
export const REQUIRED_PUNTER_SINAIS_FIELDS = [
  'id',
  'match_id',
  'home_team',
  'away_team',
  'commence_time',
  'market',
  'verdict',
] as const;

// Campos ESPERADOS (usados pela UI mas tolerados como null/undefined)
export const EXPECTED_PUNTER_SINAIS_FIELDS = [
  'league',
  'bookmaker',
  'odd',
  'fair_odd',
  'value_percentage',
  'confidence',
  'estimated_probability',
  'implied_probability',
  'stake_percentage',
  'thesis',
  'analysis',
  'risk_factors',
  'status',
  'resultado',
  'profit_loss',
  'settled_at',
  'dismissed',
] as const;

export interface PunterSinaisValidation {
  valid: boolean;
  missingRequired: string[];
  missingExpected: string[];
  sampleId?: string;
}

/**
 * Valida o shape de um array de registros de punter_sinais.
 * - missingRequired: campos ausentes da chave do objeto (schema quebrado)
 * - missingExpected: campos opcionais que nem aparecem como chave (schema desatualizado)
 */
export function validatePunterSinaisRows(rows: any[] | null | undefined): PunterSinaisValidation {
  if (!rows || rows.length === 0) {
    // Lista vazia é válida (apenas não há sinais)
    return { valid: true, missingRequired: [], missingExpected: [] };
  }

  const sample = rows[0];
  const keys = new Set(Object.keys(sample || {}));

  const missingRequired = REQUIRED_PUNTER_SINAIS_FIELDS.filter((f) => !keys.has(f));
  const missingExpected = EXPECTED_PUNTER_SINAIS_FIELDS.filter((f) => !keys.has(f));

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingExpected,
    sampleId: sample?.id,
  };
}

export function buildPunterSinaisErrorMessage(v: PunterSinaisValidation): string {
  if (v.valid) return '';
  return (
    `Não foi possível carregar os sinais do Punter: a tabela "punter_sinais" está sem os campos ` +
    `obrigatórios [${v.missingRequired.join(', ')}]. ` +
    `Atualize o schema do banco ou contate o suporte.`
  );
}
