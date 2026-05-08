// Helper compartilhado: lê o limite mínimo de confiança calibrado por arena.
// Usado pelas edges de análise (Trader/Punter) para rebaixar verdicts cuja
// confidence < effective_min_confidence quando a calibração indicar.
// Cache em memória do worker por 60s para evitar SELECT por análise.

type Arena = 'trader_sports' | 'punter';
type Cached = { value: number; expiresAt: number };
const cache = new Map<Arena, Cached>();
const TTL_MS = 60_000;

export async function getCalibrationFloor(supabase: any, arena: Arena, fallback = 70): Promise<number> {
  const now = Date.now();
  const c = cache.get(arena);
  if (c && c.expiresAt > now) return c.value;
  try {
    const { data, error } = await supabase
      .from('arena_calibration_state')
      .select('effective_min_confidence, sample_size')
      .eq('arena', arena)
      .maybeSingle();
    if (error) throw error;
    // Só aplica floor se já temos amostra >= 20 (delta computado)
    const eff = (data?.sample_size ?? 0) >= 20
      ? Number(data?.effective_min_confidence ?? fallback)
      : fallback;
    cache.set(arena, { value: eff, expiresAt: now + TTL_MS });
    return eff;
  } catch (e) {
    console.warn('[calibrationFloor] fallback:', (e as Error)?.message);
    return fallback;
  }
}

/** Aplica o floor in-place: rebaixa verdicts APROVADO* se confidence < floor. */
export function applyCalibrationFloor<T extends { verdict?: string; confidence?: number; thesis?: string; plan_name?: string | null }>(
  analysis: T, floor: number,
): { demoted: boolean; floor: number } {
  if (!analysis || typeof analysis.verdict !== 'string') return { demoted: false, floor };
  if (!analysis.verdict.startsWith('APROVADO') && analysis.verdict !== 'LABAREDA') return { demoted: false, floor };
  const conf = Number(analysis.confidence ?? 0);
  if (!Number.isFinite(conf) || conf >= floor) return { demoted: false, floor };
  const original = analysis.verdict;
  analysis.verdict = 'AGUARDAR';
  analysis.plan_name = null;
  analysis.thesis = `[CALIBRAÇÃO] Verdict ${original} rebaixado: confidence ${conf}% < limite calibrado ${floor}% (acerto recente abaixo da meta). ` + (analysis.thesis || '');
  return { demoted: true, floor };
}
