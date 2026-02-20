// Enhanced Hand History Parser - local parsing, no AI needed

export interface ParsedCard {
  rank: string;
  suit: 's' | 'h' | 'd' | 'c';
}

export interface ParsedHand {
  id: string;
  raw: string;
  heroName: string;
  heroPosition: string;
  heroCards: ParsedCard[];
  boardCards: ParsedCard[];
  potSizeBB: number;
  blinds: { sb: number; bb: number };
  heroWon: boolean;
  isAllIn: boolean;
  isCritical: boolean; // pot > 20BB or all-in
  summary: string;
  streets: string[];
}

function parseCard(s: string): ParsedCard {
  const rank = s.slice(0, -1).toUpperCase();
  const suitMap: Record<string, 's' | 'h' | 'd' | 'c'> = { s: 's', h: 'h', d: 'd', c: 'c' };
  return { rank, suit: suitMap[s.slice(-1).toLowerCase()] || 's' };
}

function formatCards(cards: ParsedCard[]): string {
  const suitSymbol: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  return cards.map(c => `${c.rank}${suitSymbol[c.suit]}`).join('');
}

const POSITION_MAP: Record<string, string> = {
  'button': 'BTN',
  'btn': 'BTN',
  'small blind': 'SB',
  'big blind': 'BB',
  'under the gun': 'UTG',
  'utg': 'UTG',
  'utg+1': 'UTG+1',
  'middle position': 'MP',
  'mp': 'MP',
  'hijack': 'HJ',
  'hj': 'HJ',
  'cutoff': 'CO',
  'co': 'CO',
};

export function parseHandHistory(raw: string): ParsedHand | null {
  if (!raw || raw.trim().length < 20) return null;

  const id = crypto.randomUUID();

  // Extract hero name
  const heroNameMatch = raw.match(/Dealt to ([\w\s]+?)\s*\[/i);
  const heroName = heroNameMatch?.[1]?.trim() || 'Hero';

  // Extract hero cards
  const heroCardsMatch = raw.match(/Dealt to [\w\s]+\[(\w{2})\s(\w{2})\]/i);
  const heroCards: ParsedCard[] = heroCardsMatch
    ? [parseCard(heroCardsMatch[1]), parseCard(heroCardsMatch[2])]
    : [];

  // Extract board cards
  const boardCards: ParsedCard[] = [];
  const boardMatches = raw.match(/\*\*\* (?:FLOP|TURN|RIVER) \*\*\*.*?\[([\w\s]+)\]/gi);
  if (boardMatches) {
    boardMatches.forEach(m => {
      const inner = m.match(/\[([\w\s]+)\]/)?.[1];
      if (inner) inner.trim().split(/\s+/).forEach(c => {
        if (c.length >= 2) boardCards.push(parseCard(c));
      });
    });
  }

  // Extract blinds
  const blindsMatch = raw.match(/\$?([\d.]+)\/\$?([\d.]+)/);
  const sb = blindsMatch ? parseFloat(blindsMatch[1]) : 0;
  const bb = blindsMatch ? parseFloat(blindsMatch[2]) : 1;

  // Extract pot size
  const potMatch = raw.match(/Total pot[:\s]+\$?([\d,.]+)/i);
  const potSize = potMatch ? parseFloat(potMatch[1].replace(',', '')) : 0;
  const potSizeBB = bb > 0 ? Math.round(potSize / bb * 10) / 10 : 0;

  // Determine if hero won
  const heroWon = new RegExp(`${heroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*(?:collected|won)`, 'i').test(raw)
    || raw.toLowerCase().includes(`${heroName.toLowerCase()} collected`)
    || raw.toLowerCase().includes(`${heroName.toLowerCase()} won`);

  // Detect all-in
  const isAllIn = /all-in/i.test(raw);

  // Detect hero position
  let heroPosition = '?';
  const seatLines = raw.match(/Seat \d+:.*$/gm) || [];
  const buttonMatch = raw.match(/Seat #?(\d+) is the button/i);
  const buttonSeat = buttonMatch ? parseInt(buttonMatch[1]) : -1;

  // Try to find hero seat
  const heroSeatMatch = seatLines.find(l => l.includes(heroName));
  if (heroSeatMatch) {
    const seatNum = parseInt(heroSeatMatch.match(/Seat (\d+)/)?.[1] || '0');
    if (raw.toLowerCase().includes(`${heroName.toLowerCase()}: posts small blind`)) {
      heroPosition = 'SB';
    } else if (raw.toLowerCase().includes(`${heroName.toLowerCase()}: posts big blind`)) {
      heroPosition = 'BB';
    } else if (seatNum === buttonSeat) {
      heroPosition = 'BTN';
    } else {
      // Approximate based on action order
      const preflopActions = raw.split(/\*\*\* HOLE CARDS \*\*\*/i)[1]?.split(/\*\*\*/)[0] || '';
      const actionLines = preflopActions.match(/^[\w\s]+:/gm) || [];
      const heroIdx = actionLines.findIndex(l => l.includes(heroName));
      if (heroIdx <= 1) heroPosition = 'EP';
      else if (heroIdx <= 3) heroPosition = 'MP';
      else heroPosition = 'LP';
    }
  }

  // Detect which streets were played
  const streets: string[] = ['Preflop'];
  if (/\*\*\* FLOP \*\*\*/i.test(raw)) streets.push('Flop');
  if (/\*\*\* TURN \*\*\*/i.test(raw)) streets.push('Turn');
  if (/\*\*\* RIVER \*\*\*/i.test(raw)) streets.push('River');
  if (/\*\*\* SHOW DOWN \*\*\*/i.test(raw)) streets.push('Showdown');

  const isCritical = potSizeBB > 20 || isAllIn;

  const summary = `${formatCards(heroCards)} | ${heroPosition} | ${potSizeBB}BB | ${heroWon ? 'Won' : 'Lost'}`;

  return {
    id,
    raw,
    heroName,
    heroPosition,
    heroCards,
    boardCards,
    potSizeBB,
    blinds: { sb, bb },
    heroWon,
    isAllIn,
    isCritical,
    summary,
    streets,
  };
}

export function parseSessionFile(content: string): ParsedHand[] {
  const splitHands = content
    .split(/(?=PokerStars Hand #|Poker Hand #|Full Tilt Hand #|\*\*\*\*\* Hand History)/i)
    .map(h => h.trim())
    .filter(h => h.length > 20);

  return splitHands
    .map(raw => parseHandHistory(raw))
    .filter((h): h is ParsedHand => h !== null);
}
