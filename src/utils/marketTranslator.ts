/**
 * Traduz termos técnicos de mercados para PT-BR amigável.
 * Mantém o termo técnico original entre parênteses para referência cruzada
 * com a casa de apostas.
 *
 * Ex: "AH +0.5 Away"     → "AH +0.5 Visitante (Handicap Asiático +0.5 Visitante)"
 *     "AH +0.5"          → "AH +0.5 (Handicap Asiático +0.5)"
 *     "O/U 2.5"          → "Mais/Menos de 2.5 gols (O/U 2.5)"
 *     "Corner Over 8.5"  → "Mais de 8.5 escanteios (Corner Over 8.5)"
 *     "Dupla Chance 1X"  → "Dupla Chance Casa ou Empate (1X)"
 *     "Over 2.5"         → "Mais de 2.5 gols (Over 2.5)"
 */

type Replacer = { pattern: RegExp; build: (m: RegExpMatchArray) => string };

const normalizeSign = (raw: string): string => {
  const trimmed = raw.replace(/\s+/g, '');
  if (trimmed.startsWith('-')) return trimmed;
  if (trimmed.startsWith('+')) return trimmed;
  return `+${trimmed}`;
};

const sideLabel = (side: string): 'Mandante' | 'Visitante' =>
  /home|casa|mandante/i.test(side) ? 'Mandante' : 'Visitante';

const REPLACERS: Replacer[] = [
  // ── Handicap Asiático com lado: AH +0.5 Home/Away/Casa/Visitante ──
  {
    pattern: /\bAH\s*([+-]?\d+(?:\.\d+)?)\s+(Home|Away|Casa|Visitante|Mandante|Fora)\b/i,
    build: (m) => {
      const sinal = normalizeSign(m[1]);
      const lado = sideLabel(m[2]);
      return `AH ${sinal} ${lado} (Handicap Asiático ${sinal} ${lado})`;
    },
  },
  // ── Handicap Asiático SEM lado: AH +0.5, AH -1.5 ──
  {
    pattern: /\bAH\s*([+-]?\d+(?:\.\d+)?)\b(?!\s*(?:Home|Away|Casa|Visitante|Mandante|Fora))/i,
    build: (m) => {
      const sinal = normalizeSign(m[1]);
      return `AH ${sinal} (Handicap Asiático ${sinal})`;
    },
  },
  // ── Handicap Europeu com lado ──
  {
    pattern: /\bEH\s*([+-]?\d+(?:\.\d+)?)\s+(Home|Away|Casa|Visitante|Mandante|Fora)\b/i,
    build: (m) => {
      const sinal = normalizeSign(m[1]);
      const lado = sideLabel(m[2]);
      return `EH ${sinal} ${lado} (Handicap Europeu ${sinal} ${lado})`;
    },
  },
  // ── Handicap Europeu sem lado ──
  {
    pattern: /\bEH\s*([+-]?\d+(?:\.\d+)?)\b(?!\s*(?:Home|Away|Casa|Visitante|Mandante|Fora))/i,
    build: (m) => {
      const sinal = normalizeSign(m[1]);
      return `EH ${sinal} (Handicap Europeu ${sinal})`;
    },
  },
  // ── Dupla Chance ──
  {
    pattern: /\b(?:Dupla\s*Chance|Double\s*Chance|DC)\s*(1X|X2|12)\b/i,
    build: (m) => {
      const code = m[1].toUpperCase();
      const label =
        code === '1X' ? 'Casa ou Empate' : code === 'X2' ? 'Empate ou Visitante' : 'Casa ou Visitante';
      return `Dupla Chance ${label} (${code})`;
    },
  },
  // ── O/U combinado (gols): "O/U 2.5", "OU 2.5" ──
  {
    pattern: /\bO\/?U\s*(\d+(?:\.\d+)?)\b(?!\s*(?:cards|cartões|cartoes|corners|escanteios))/i,
    build: (m) => `Mais/Menos de ${m[1]} gols (O/U ${m[1]})`,
  },
  // ── Escanteios: Corner Over/Under, Corners Over/Under, Over X corners ──
  {
    pattern: /\bCorners?\s*Over\s*(\d+(?:\.\d+)?)\b/i,
    build: (m) => `Mais de ${m[1]} escanteios (Corner Over ${m[1]})`,
  },
  {
    pattern: /\bCorners?\s*Under\s*(\d+(?:\.\d+)?)\b/i,
    build: (m) => `Menos de ${m[1]} escanteios (Corner Under ${m[1]})`,
  },
  {
    pattern: /\bOver\s*(\d+(?:\.\d+)?)\s*(?:corners|escanteios)\b/i,
    build: (m) => `Mais de ${m[1]} escanteios (Over ${m[1]} Corners)`,
  },
  {
    pattern: /\bUnder\s*(\d+(?:\.\d+)?)\s*(?:corners|escanteios)\b/i,
    build: (m) => `Menos de ${m[1]} escanteios (Under ${m[1]} Corners)`,
  },
  // ── Cartões ──
  {
    pattern: /\bCards?\s*Over\s*(\d+(?:\.\d+)?)\b/i,
    build: (m) => `Mais de ${m[1]} cartões (Card Over ${m[1]})`,
  },
  {
    pattern: /\bCards?\s*Under\s*(\d+(?:\.\d+)?)\b/i,
    build: (m) => `Menos de ${m[1]} cartões (Card Under ${m[1]})`,
  },
  {
    pattern: /\bOver\s*(\d+(?:\.\d+)?)\s*(?:cards|cartões|cartoes)\b/i,
    build: (m) => `Mais de ${m[1]} cartões (Over ${m[1]} Cards)`,
  },
  {
    pattern: /\bUnder\s*(\d+(?:\.\d+)?)\s*(?:cards|cartões|cartoes)\b/i,
    build: (m) => `Menos de ${m[1]} cartões (Under ${m[1]} Cards)`,
  },
  // ── HT/FT (antes do Over/Under genérico) ──
  { pattern: /\bHT\s*Over\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Mais de ${m[1]} gols no 1º tempo (HT Over ${m[1]})` },
  { pattern: /\bHT\s*Under\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Menos de ${m[1]} gols no 1º tempo (HT Under ${m[1]})` },
  { pattern: /\bFT\s*Over\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Mais de ${m[1]} gols no jogo (FT Over ${m[1]})` },
  { pattern: /\bFT\s*Under\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Menos de ${m[1]} gols no jogo (FT Under ${m[1]})` },
  // ── Over/Under genérico (gols) ──
  {
    pattern: /\bOver\s*(\d+(?:\.\d+)?)\b(?!\s*(?:cards|cartões|cartoes|corners|escanteios))/i,
    build: (m) => `Mais de ${m[1]} gols (Over ${m[1]})`,
  },
  {
    pattern: /\bUnder\s*(\d+(?:\.\d+)?)\b(?!\s*(?:cards|cartões|cartoes|corners|escanteios))/i,
    build: (m) => `Menos de ${m[1]} gols (Under ${m[1]})`,
  },
  // ── BTTS ──
  { pattern: /\bBTTS\s*Yes\b/i, build: () => 'Ambas Marcam Sim (BTTS Yes)' },
  { pattern: /\bBTTS\s*No\b/i, build: () => 'Ambas Marcam Não (BTTS No)' },
  { pattern: /\bGG\b/i, build: () => 'Ambas Marcam Sim (GG)' },
  { pattern: /\bNG\b/i, build: () => 'Ambas Marcam Não (NG)' },
  { pattern: /\bBTTS\b/i, build: () => 'Ambas Marcam (BTTS)' },
  // ── 1X2 ──
  { pattern: /\b1X2\s*[-:]?\s*Home\b/i, build: () => 'Vitória Mandante (1)' },
  { pattern: /\b1X2\s*[-:]?\s*Away\b/i, build: () => 'Vitória Visitante (2)' },
  { pattern: /\b1X2\s*[-:]?\s*Draw\b/i, build: () => 'Empate (X)' },
  // ── HT/FT ──
  { pattern: /\bHT\s*Over\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Mais de ${m[1]} gols no 1º tempo (HT Over ${m[1]})` },
  { pattern: /\bHT\s*Under\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Menos de ${m[1]} gols no 1º tempo (HT Under ${m[1]})` },
  { pattern: /\bFT\s*Over\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Mais de ${m[1]} gols no jogo (FT Over ${m[1]})` },
  { pattern: /\bFT\s*Under\s*(\d+(?:\.\d+)?)\b/i, build: (m) => `Menos de ${m[1]} gols no jogo (FT Under ${m[1]})` },
  // ── Player markets ──
  { pattern: /\bAnytime\s*Goalscorer\b/i, build: () => 'Marca a Qualquer Momento (Anytime Goalscorer)' },
  {
    pattern: /\bPlayer\s*Shots\s*(Over|Under)?\s*(\d+(?:\.\d+)?)?/i,
    build: (m) =>
      `Chutes do Jogador ${m[1] === 'Over' ? 'Mais de' : m[1] === 'Under' ? 'Menos de' : ''} ${m[2] || ''}`.trim() +
      ' (Player Shots)',
  },
  { pattern: /\bShots\s*on\s*Target\b/i, build: () => 'Chutes no Gol (Shots on Target)' },
  { pattern: /\bPlayer\s*Assists?\b/i, build: () => 'Assistência do Jogador (Player Assists)' },
];

export function translateMarket(raw?: string | null): string {
  if (!raw) return '—';
  const trimmed = raw.trim();
  for (const r of REPLACERS) {
    const match = trimmed.match(r.pattern);
    if (match) {
      return trimmed.replace(r.pattern, r.build(match));
    }
  }
  return trimmed;
}
