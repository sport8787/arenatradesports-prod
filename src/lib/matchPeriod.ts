// Helper compartilhado para formatar o período do jogo de forma legível em pt-BR.
// Usado para exibir o momento exato em que um sinal foi APROVADO (e demais
// contextos de leitura de período/etapa).

export function formatMatchPeriod(period?: string | null): string {
  if (!period) return '';
  const raw = String(period).trim();
  if (!raw) return '';

  // Já está no formato desejado
  if (raw === '1º Tempo' || raw === '2º Tempo') return raw;

  const p = raw.toUpperCase();

  // 1º tempo
  if (
    p.includes('FIRST') ||
    p === '1H' || p === 'HT1' || p === '1T' ||
    p === 'P1' || p === '1ST' || p === '1ST_HALF'
  ) return '1º Tempo';

  // 2º tempo
  if (
    p.includes('SECOND') ||
    p === '2H' || p === 'HT2' || p === '2T' ||
    p === 'P2' || p === '2ND' || p === '2ND_HALF'
  ) return '2º Tempo';

  // Intervalo
  if (p === 'HT' || p.includes('HALF_TIME') || p.includes('HALFTIME') || p.includes('INTERVALO'))
    return 'Intervalo';

  // Prorrogação
  if (p.includes('EXTRA') || p === 'ET' || p.includes('OVERTIME') || p.includes('PRORROG'))
    return 'Prorrogação';

  // Pênaltis
  if (p.includes('PEN') || p === 'PK' || p.includes('SHOOTOUT')) return 'Pênaltis';

  // Encerrado
  if (p === 'FT' || p.includes('FULL_TIME') || p.includes('FULLTIME') || p === 'AET' || p === 'PEN')
    return 'Encerrado';

  // Fallback legível
  return raw;
}
