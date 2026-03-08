// CSV/PDF bet parser for Bet365, Betano and generic formats
// Runs client-side for CSV; PDF uses pdfjs-dist already in the project

export interface ParsedBet {
  event_name: string;
  market: string;
  selection?: string;
  odd: number;
  stake: number;
  profit_loss: number;
  result: 'green' | 'red' | 'void' | 'pending';
  bet_date: string;
  settle_date?: string;
  bookmaker: string;
  raw_line?: string;
}

// ─── Generic CSV Parser ───
function parseGenericCSV(lines: string[][], headers: string[]): ParsedBet[] {
  const h = headers.map(h => h.toLowerCase().trim());
  const iEvent = h.findIndex(c => ['evento', 'event', 'jogo', 'match', 'partida'].includes(c));
  const iMarket = h.findIndex(c => ['mercado', 'market', 'tipo', 'type', 'bet type'].includes(c));
  const iOdd = h.findIndex(c => ['odd', 'odds', 'cotação', 'cotacao', 'price'].includes(c));
  const iStake = h.findIndex(c => ['stake', 'valor', 'aposta', 'amount', 'quantia'].includes(c));
  const iPL = h.findIndex(c => ['lucro', 'profit', 'p&l', 'profit/loss', 'ganho', 'resultado_valor'].includes(c));
  const iResult = h.findIndex(c => ['resultado', 'result', 'status', 'outcome'].includes(c));
  const iDate = h.findIndex(c => ['data', 'date', 'placed', 'data_aposta'].includes(c));
  const iSelection = h.findIndex(c => ['seleção', 'selection', 'escolha', 'pick'].includes(c));

  return lines.map(cols => {
    const resultRaw = iResult >= 0 ? cols[iResult]?.toLowerCase().trim() : '';
    let result: ParsedBet['result'] = 'pending';
    if (['won', 'win', 'green', 'ganhou', 'acertou', 'w'].includes(resultRaw)) result = 'green';
    else if (['lost', 'lose', 'red', 'perdeu', 'errou', 'l'].includes(resultRaw)) result = 'red';
    else if (['void', 'cancelled', 'cancelada', 'anulada', 'push'].includes(resultRaw)) result = 'void';

    const odd = parseFloat(cols[iOdd]?.replace(',', '.') || '0') || 0;
    const stake = parseFloat(cols[iStake]?.replace(',', '.').replace('R$', '').trim() || '0') || 0;
    let profitLoss = iPL >= 0 ? parseFloat(cols[iPL]?.replace(',', '.').replace('R$', '').trim() || '0') || 0 : 0;

    if (iPL < 0 && result === 'green') profitLoss = stake * (odd - 1);
    if (iPL < 0 && result === 'red') profitLoss = -stake;

    return {
      event_name: cols[iEvent] || 'Unknown',
      market: cols[iMarket] || 'Unknown',
      selection: iSelection >= 0 ? cols[iSelection] : undefined,
      odd,
      stake,
      profit_loss: Math.round(profitLoss * 100) / 100,
      result,
      bet_date: cols[iDate] || new Date().toISOString(),
      bookmaker: 'CSV Import',
      raw_line: cols.join(','),
    };
  }).filter(b => b.odd > 0 && b.stake > 0);
}

// ─── Bet365 CSV Parser ───
function parseBet365CSV(lines: string[][], headers: string[]): ParsedBet[] {
  // Bet365 typical format: Date Placed, Event, Selection, Odds, Stake, Returns, P/L
  const h = headers.map(h => h.toLowerCase().trim());
  const iDate = h.findIndex(c => c.includes('date'));
  const iEvent = h.findIndex(c => c.includes('event') || c.includes('match'));
  const iSelection = h.findIndex(c => c.includes('selection') || c.includes('pick'));
  const iOdds = h.findIndex(c => c.includes('odds') || c.includes('price'));
  const iStake = h.findIndex(c => c.includes('stake') || c.includes('wager'));
  const iReturns = h.findIndex(c => c.includes('return') || c.includes('payout'));
  const iPL = h.findIndex(c => c.includes('p/l') || c.includes('profit') || c.includes('p&l'));

  return lines.map(cols => {
    const odd = parseFloat(cols[iOdds]?.replace(',', '.') || '0') || 0;
    const stake = parseFloat(cols[iStake]?.replace(',', '.').replace(/[^\d.-]/g, '') || '0') || 0;
    const returns = iReturns >= 0 ? parseFloat(cols[iReturns]?.replace(',', '.').replace(/[^\d.-]/g, '') || '0') || 0 : 0;
    const pl = iPL >= 0 ? parseFloat(cols[iPL]?.replace(',', '.').replace(/[^\d.-]/g, '') || '0') || 0 : returns - stake;

    let result: ParsedBet['result'] = 'pending';
    if (pl > 0) result = 'green';
    else if (pl < 0) result = 'red';
    else if (returns === stake) result = 'void';

    return {
      event_name: cols[iEvent] || 'Unknown',
      market: 'Bet365',
      selection: iSelection >= 0 ? cols[iSelection] : undefined,
      odd,
      stake,
      profit_loss: Math.round(pl * 100) / 100,
      result,
      bet_date: cols[iDate] || new Date().toISOString(),
      bookmaker: 'Bet365',
      raw_line: cols.join(','),
    };
  }).filter(b => b.odd > 0 && b.stake > 0);
}

// ─── Betano CSV Parser ───
function parseBetanoCSV(lines: string[][], headers: string[]): ParsedBet[] {
  // Betano typical: Data, Evento, Mercado, Seleção, Odd, Stake, Resultado, Lucro
  const h = headers.map(h => h.toLowerCase().trim());
  const iDate = h.findIndex(c => c.includes('data') || c.includes('date'));
  const iEvent = h.findIndex(c => c.includes('evento') || c.includes('event'));
  const iMarket = h.findIndex(c => c.includes('mercado') || c.includes('market'));
  const iSelection = h.findIndex(c => c.includes('seleção') || c.includes('selection'));
  const iOdds = h.findIndex(c => c.includes('odd') || c.includes('cota'));
  const iStake = h.findIndex(c => c.includes('stake') || c.includes('valor') || c.includes('aposta'));
  const iResult = h.findIndex(c => c.includes('resultado') || c.includes('result'));
  const iPL = h.findIndex(c => c.includes('lucro') || c.includes('profit') || c.includes('ganho'));

  return lines.map(cols => {
    const odd = parseFloat(cols[iOdds]?.replace(',', '.') || '0') || 0;
    const stake = parseFloat(cols[iStake]?.replace(',', '.').replace(/[^\d.-]/g, '') || '0') || 0;
    const pl = iPL >= 0 ? parseFloat(cols[iPL]?.replace(',', '.').replace(/[^\d.-]/g, '') || '0') || 0 : 0;
    const resultRaw = iResult >= 0 ? cols[iResult]?.toLowerCase().trim() : '';

    let result: ParsedBet['result'] = 'pending';
    if (['ganhou', 'won', 'win', 'green'].includes(resultRaw) || pl > 0) result = 'green';
    else if (['perdeu', 'lost', 'red'].includes(resultRaw) || pl < 0) result = 'red';
    else if (['anulada', 'void', 'cancelada'].includes(resultRaw)) result = 'void';

    return {
      event_name: cols[iEvent] || 'Unknown',
      market: cols[iMarket] || 'Betano',
      selection: iSelection >= 0 ? cols[iSelection] : undefined,
      odd,
      stake,
      profit_loss: Math.round((pl || (result === 'green' ? stake * (odd - 1) : result === 'red' ? -stake : 0)) * 100) / 100,
      result,
      bet_date: cols[iDate] || new Date().toISOString(),
      bookmaker: 'Betano',
      raw_line: cols.join(','),
    };
  }).filter(b => b.odd > 0 && b.stake > 0);
}

// ─── Auto-detect format ───
function detectFormat(headers: string[]): 'bet365' | 'betano' | 'generic' {
  const joined = headers.join(' ').toLowerCase();
  if (joined.includes('bet365') || (joined.includes('returns') && joined.includes('selection'))) return 'bet365';
  if (joined.includes('betano') || (joined.includes('seleção') && joined.includes('mercado'))) return 'betano';
  return 'generic';
}

// ─── Main CSV parse function ───
export function parseCSV(text: string): { bets: ParsedBet[]; format: string; totalRows: number } {
  const rows = text.split('\n').map(line => {
    // Handle quoted CSV fields
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }).filter(row => row.some(cell => cell.length > 0));

  if (rows.length < 2) return { bets: [], format: 'empty', totalRows: 0 };

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const format = detectFormat(headers);

  let bets: ParsedBet[];
  switch (format) {
    case 'bet365':
      bets = parseBet365CSV(dataRows, headers);
      break;
    case 'betano':
      bets = parseBetanoCSV(dataRows, headers);
      break;
    default:
      bets = parseGenericCSV(dataRows, headers);
  }

  return { bets, format, totalRows: dataRows.length };
}

// ─── PDF text parser (for extracted text from pdfjs) ───
export function parsePDFText(text: string): ParsedBet[] {
  const bets: ParsedBet[] = [];

  // Try to find bet patterns in PDF text
  // Common patterns: "Event Name | Market | Odd | Stake | Result | P&L"
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  // Pattern 1: Lines with odds format (e.g., "1.85", "2.40")
  const oddPattern = /(\d+[.,]\d{2})/;

  for (const line of lines) {
    const matches = line.match(oddPattern);
    if (!matches) continue;

    // Try to extract numbers that look like odds and stakes
    const numbers = [...line.matchAll(/(\d+[.,]\d{2})/g)].map(m => parseFloat(m[1].replace(',', '.')));

    if (numbers.length >= 2) {
      const odd = numbers.find(n => n >= 1.01 && n <= 100) || 0;
      const stake = numbers.find(n => n !== odd && n > 0) || 0;

      if (odd > 1 && stake > 0) {
        // Try to find result indicators
        const lower = line.toLowerCase();
        let result: ParsedBet['result'] = 'pending';
        let pl = 0;

        if (lower.includes('ganhou') || lower.includes('won') || lower.includes('green') || lower.includes('✓') || lower.includes('win')) {
          result = 'green';
          pl = stake * (odd - 1);
        } else if (lower.includes('perdeu') || lower.includes('lost') || lower.includes('red') || lower.includes('✗') || lower.includes('lose')) {
          result = 'red';
          pl = -stake;
        }

        // If there's a third number, it might be P&L
        if (numbers.length >= 3) {
          const potentialPL = numbers[2];
          if (potentialPL !== odd && potentialPL !== stake) {
            pl = potentialPL;
            if (pl > 0) result = 'green';
            else if (pl < 0) result = 'red';
          }
        }

        bets.push({
          event_name: line.substring(0, 60).trim(),
          market: 'PDF Import',
          odd,
          stake,
          profit_loss: Math.round(pl * 100) / 100,
          result,
          bet_date: new Date().toISOString(),
          bookmaker: 'PDF Import',
          raw_line: line,
        });
      }
    }
  }

  return bets;
}
