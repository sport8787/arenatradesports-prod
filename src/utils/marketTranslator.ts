/**
 * Traduz termos técnicos de mercados para PT-BR amigável.
 * Mantém o termo técnico original entre parênteses para referência cruzada
 * com a casa de apostas.
 *
 * Ex: "AH +0.5 Away" → "AH +0.5 Visitante (Handicap Asiático +0.5 Visitante)"
 *     "Dupla Chance 1X" → "Dupla Chance Casa ou Empate (1X)"
 *     "Over 2.5" → "Mais de 2.5 gols (Over 2.5)"
 */

type Replacer = { pattern: RegExp; build: (m: RegExpMatchArray) => string };

const REPLACERS: Replacer[] = [
  // Handicap Asiático: AH +0.5 Home/Away, AH -1.0 Home/Away, etc.
  {
    pattern: /\bAH\s*([+-]?\d+(?:\.\d+)?)\s*(Home|Away|Casa|Visitante|Mandante|Fora)\b/i,
    build: (m) => {
      const sinal = m[1].startsWith('-') ? m[1] : `+${m[1].replace('+', '')}`;
      const lado = /home|casa|mandante/i.test(m[2]) ? 'Mandante' : 'Visitante';
      return `AH ${sinal} ${lado} (Handicap Asiático ${sinal} ${lado})`;
    },
  },
  // Handicap Europeu: EH +1 Home, EH -1 Away
  {
    pattern: /\bEH\s*([+-]?\d+(?:\.\d+)?)\s*(Home|Away|Casa|Visitante|Mandante|Fora)\b/i,
    build: (m) => {
      const sinal = m[1].startsWith('-') ? m[1] : `+${m[1].replace('+', '')}`;
      const lado = /home|casa|mandante/i.test(m[2]) ? 'Mandante' : 'Visitante';
      return `EH ${sinal} ${lado} (Handicap Europeu ${sinal} ${lado})`;
    },
  },
  // Dupla Chance
  {
    pattern: /\bDupla\s*Chance\s*(1X|X2|12)\b/i,
    build: (m) => {
      const code = m[1].toUpperCase();
      const label =
        code === '1X' ? 'Casa ou Empate' : code === 'X2' ? 'Empate ou Visitante' : 'Casa ou Visitante';
      return `Dupla Chance ${label} (${code})`;
    },
  },
  {
    pattern: /\bDouble\s*Chance\s*(1X|X2|12)\b/i,
    build: (m) => {
      const code = m[1].toUpperCase();
      const label =
        code === '1X' ? 'Casa ou Empate' : code === 'X2' ? 'Empate ou Visitante' : 'Casa ou Visitante';
      return `Dupla Chance ${label} (${code})`;
    },
  },
  // Over X.X (gols)
  {
    pattern: /\bOver\s*(\d+(?:\.\d+)?)\b(?!\s*(?:cards|cartões|corners|escanteios))/i,
    build: (m) => `Mais de ${m[1]} gols (Over ${m[1]})`,
  },
  // Under X.X (gols)
  {
    pattern: /\bUnder\s*(\d+(?:\.\d+)?)\b(?!\s*(?:cards|cartões|corners|escanteios))/i,
    build: (m) => `Menos de ${m[1]} gols (Under ${m[1]})`,
  },
  // BTTS / Ambas marcam
  { pattern: /\bBTTS\s*Yes\b/i, build: () => 'Ambas Marcam Sim (BTTS Yes)' },
  { pattern: /\bBTTS\s*No\b/i, build: () => 'Ambas Marcam Não (BTTS No)' },
  { pattern: /\bBTTS\b/i, build: () => 'Ambas Marcam (BTTS)' },
  // 1X2
  { pattern: /\b1X2\s*[-:]?\s*Home\b/i, build: () => 'Vitória Mandante (1)' },
  { pattern: /\b1X2\s*[-:]?\s*Away\b/i, build: () => 'Vitória Visitante (2)' },
  { pattern: /\b1X2\s*[-:]?\s*Draw\b/i, build: () => 'Empate (X)' },
  // Player markets
  { pattern: /\bAnytime\s*Goalscorer\b/i, build: () => 'Marca a Qualquer Momento (Anytime Goalscorer)' },
  { pattern: /\bPlayer\s*Shots\s*(Over|Under)?\s*(\d+(?:\.\d+)?)?/i,
    build: (m) => `Chutes do Jogador ${m[1] === 'Over' ? 'Mais de' : m[1] === 'Under' ? 'Menos de' : ''} ${m[2] || ''}`.trim() + ' (Player Shots)' },
  { pattern: /\bShots\s*on\s*Target\b/i, build: () => 'Chutes no Gol (Shots on Target)' },
  { pattern: /\bPlayer\s*Assists?\b/i, build: () => 'Assistência do Jogador (Player Assists)' },
  // Cards / Corners totals
  { pattern: /\bOver\s*(\d+(?:\.\d+)?)\s*(cards|cartões)\b/i, build: (m) => `Mais de ${m[1]} cartões (Over ${m[1]} Cards)` },
  { pattern: /\bUnder\s*(\d+(?:\.\d+)?)\s*(cards|cartões)\b/i, build: (m) => `Menos de ${m[1]} cartões (Under ${m[1]} Cards)` },
  { pattern: /\bOver\s*(\d+(?:\.\d+)?)\s*(corners|escanteios)\b/i, build: (m) => `Mais de ${m[1]} escanteios (Over ${m[1]} Corners)` },
  { pattern: /\bUnder\s*(\d+(?:\.\d+)?)\s*(corners|escanteios)\b/i, build: (m) => `Menos de ${m[1]} escanteios (Under ${m[1]} Corners)` },
];

export function translateMarket(raw?: string | null): string {
  if (!raw) return '—';
  const trimmed = raw.trim();
  for (const r of REPLACERS) {
    const match = trimmed.match(r.pattern);
    if (match) {
      // Substitui apenas o trecho casado, preservando prefixos como "Escanteios: ..."
      return trimmed.replace(r.pattern, r.build(match));
    }
  }
  return trimmed;
}
