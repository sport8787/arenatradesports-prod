// CSV/PDF bet parser for Bet365, Betano, Betfair Statement and generic formats
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

// ─── Helper: parse BR money string like "-1,000.00" or "33.00" or "--" ───
function parseBRL(val: string): number {
  if (!val || val.trim() === '--' || val.trim() === '') return 0;
  // Remove quotes, R$, spaces
  let clean = val.replace(/"/g, '').replace(/R\$/g, '').trim();
  // Handle Brazilian format: "1.000,50" → 1000.50 vs "1,000.50" → 1000.50
  // The Betfair CSV uses: "1,000.00" (English with comma thousands)
  if (/^\-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(clean)) {
    // English format with comma thousands: -1,000.00
    clean = clean.replace(/,/g, '');
  } else if (/^\-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(clean)) {
    // Brazilian format: 1.000,50
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(clean) || 0;
}

// ─── Parse date like "17-mar-26 19:37:13" ───
function parseBetfairDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const months: Record<string, string> = {
    jan: '01', fev: '02', feb: '02', mar: '03', abr: '04', apr: '04',
    mai: '05', may: '05', jun: '06', jul: '07', ago: '08', aug: '08',
    set: '09', sep: '09', out: '10', oct: '10', nov: '11', dez: '12', dec: '12',
  };
  // Format: DD-MMM-YY HH:MM:SS
  const match = dateStr.match(/(\d{1,2})-(\w{3})-(\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (match) {
    const [, day, mon, year, time] = match;
    const m = months[mon.toLowerCase()] || '01';
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${m}-${day.padStart(2, '0')}T${time}.000Z`;
  }
  return new Date().toISOString();
}

// ─── Betfair Account Statement CSV Parser ───
function parseBetfairStatementCSV(lines: string[][], headers: string[]): ParsedBet[] {
  const bets: ParsedBet[] = [];
  
  // Column indices (standard Betfair statement)
  // Data | Descrição | Entrada de Dinheiro (R$) | Entrada de bônus (R$) | Saída de Dinheiro (R$) | Saída de bônus (R$) | Saldos em Dinheiro (R$)
  const iDate = 0;
  const iDesc = 1;
  const iMoneyIn = 2;  // Entrada de Dinheiro
  const iMoneyOut = 4; // Saída de Dinheiro

  // First pass: collect all Sportsbook Bet Placed entries indexed by Bet Ref sequence
  // and all Sportsbook Bet Settled / Cash Out entries
  interface PlacedBet { date: string; stake: number; rawLine: string; betRef?: string; }
  interface SettledBet { date: string; returns: number; rawLine: string; betRef: string; type: 'settled' | 'cashout'; }
  
  const placedBets: PlacedBet[] = [];
  const settledBets: SettledBet[] = [];
  const exchangeEntries: { date: string; desc: string; amount: number; rawLine: string }[] = [];

  for (const cols of lines) {
    const date = cols[iDate]?.trim() || '';
    const desc = cols[iDesc]?.trim() || '';
    const moneyIn = parseBRL(cols[iMoneyIn] || '');
    const moneyOut = parseBRL(cols[iMoneyOut] || '');
    const rawLine = cols.join(',');

    if (!desc) continue;

    // Skip non-bet transactions
    if (desc.startsWith('Deposit') || desc.startsWith('Withdrawal') || 
        desc.startsWith('Gaming Bonus') || desc.startsWith('PT/Gaming') ||
        desc.startsWith('GAMING')) continue;

    // Sportsbook: Bet Placed
    if (desc.includes('Sportsbook: Bet Placed')) {
      placedBets.push({
        date,
        stake: Math.abs(moneyOut),
        rawLine,
      });
      continue;
    }

    // Sportsbook: Bet Settled
    const settledMatch = desc.match(/Sportsbook: Bet Settled \(Bet Ref: ([^)]+)\)/);
    if (settledMatch) {
      settledBets.push({
        date,
        returns: moneyIn,
        rawLine,
        betRef: settledMatch[1],
        type: 'settled',
      });
      continue;
    }

    // Sportsbook: Cash Out
    const cashoutMatch = desc.match(/Sportsbook: Cash Out \(Bet Ref: ([^)]+)\)/);
    if (cashoutMatch) {
      settledBets.push({
        date,
        returns: moneyIn,
        rawLine,
        betRef: cashoutMatch[1],
        type: 'cashout',
      });
      continue;
    }

    // Exchange entries: "Team A x Team B / Market Ref: ..."
    // These have event name and market directly in the description
    if (desc.includes(' x ') && desc.includes(' / ')) {
      exchangeEntries.push({
        date,
        desc,
        amount: moneyIn > 0 ? moneyIn : moneyOut,
        rawLine,
      });
      continue;
    }
  }

  // Process settled/cashout Sportsbook bets
  // We can't perfectly match placed→settled, so we create entries for each settled bet
  // with estimated stake based on nearby placed bets
  for (const settled of settledBets) {
    const isCashout = settled.type === 'cashout';
    
    bets.push({
      event_name: `Sportsbook ${settled.betRef}`,
      market: isCashout ? 'Cash Out' : 'Sportsbook',
      selection: isCashout ? 'Cash Out' : 'Aposta Liquidada',
      odd: 0, // Unknown from statement
      stake: 0, // Unknown - will be estimated below
      profit_loss: settled.returns, // Returns (total payout)
      result: 'green',
      bet_date: parseBetfairDate(settled.date),
      settle_date: parseBetfairDate(settled.date),
      bookmaker: 'Betfair Sportsbook',
      raw_line: settled.rawLine,
    });
  }

  // Process placed bets that have no corresponding settlement (= lost bets)
  // All placed bets become losses. Settled bets override the outcome.
  // Since we can't match 1:1, we create loss entries for all placed bets
  // The user can review and adjust in the preview
  for (const placed of placedBets) {
    bets.push({
      event_name: 'Sportsbook Bet',
      market: 'Sportsbook',
      selection: 'Aposta Colocada',
      odd: 0,
      stake: placed.stake,
      profit_loss: -placed.stake,
      result: 'red',
      bet_date: parseBetfairDate(placed.date),
      bookmaker: 'Betfair Sportsbook',
      raw_line: placed.rawLine,
    });
  }

  // Process Exchange entries
  for (const entry of exchangeEntries) {
    // Parse "Team A x Team B / Market Ref: 123"
    const parts = entry.desc.split(' / ');
    const eventName = parts[0]?.trim() || 'Exchange Bet';
    const marketPart = parts[1]?.replace(/\s*Ref:.*$/, '').trim() || 'Exchange';
    const isWin = entry.amount > 0;

    bets.push({
      event_name: eventName,
      market: marketPart,
      selection: marketPart,
      odd: 0,
      stake: Math.abs(entry.amount),
      profit_loss: entry.amount,
      result: isWin ? 'green' : 'red',
      bet_date: parseBetfairDate(entry.date),
      settle_date: parseBetfairDate(entry.date),
      bookmaker: 'Betfair Exchange',
      raw_line: entry.rawLine,
    });
  }

  return bets;
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
function detectFormat(headers: string[]): 'bet365' | 'betano' | 'betfair-statement' | 'generic' {
  const joined = headers.join(' ').toLowerCase();
  // Betfair Account Statement: "Data,Descrição,Entrada de Dinheiro..."
  if (joined.includes('descrição') && joined.includes('entrada de dinheiro')) return 'betfair-statement';
  if (joined.includes('descri') && joined.includes('entrada') && joined.includes('sa\u00edda')) return 'betfair-statement';
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
    case 'betfair-statement':
      bets = parseBetfairStatementCSV(dataRows, headers);
      break;
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

// ─── Betfair "My Account" PDF parser ───
function parseBetfairMyAccountPDF(text: string): ParsedBet[] {
  const bets: ParsedBet[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('[BetfairPDF] Total lines:', lines.length);
  console.log('[BetfairPDF] First 40 lines:', lines.slice(0, 40));

  // Find all "ID da aposta:" occurrences
  const betIdIndices: { idx: number; betId: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const idMatch = lines[i].match(/ID da aposta[:\s]*(O\/[\d\/]+)/);
    if (idMatch) {
      betIdIndices.push({ idx: i, betId: idMatch[1] });
    }
  }

  console.log('[BetfairPDF] Found bet IDs:', betIdIndices.length);

  for (let b = 0; b < betIdIndices.length; b++) {
    const { idx, betId } = betIdIndices[b];

    // Collect block: from previous bet ID end to a few lines after this one
    const blockStart = b > 0 ? betIdIndices[b - 1].idx + 1 : Math.max(0, idx - 30);
    const blockEnd = Math.min(lines.length, idx + 15);
    const block = lines.slice(blockStart, blockEnd);
    const blockText = block.join('\n');

    // Extract stake
    let stake = 0;
    const stakeMatch = blockText.match(/Valor Apostado[:\s]*R\$\s*([\d.,]+)/i);
    if (stakeMatch) stake = parseBRL(stakeMatch[1]);

    // Extract winnings
    let ganhos = 0;
    const ganhoMatch = blockText.match(/Ganhos[:\s]*R\$\s*([\d.,]+)/i);
    if (ganhoMatch) ganhos = parseBRL(ganhoMatch[1]);
    const vocGanhouMatch = blockText.match(/Voc[êe] ganhou R\$\s*([\d.,]+)/i);
    if (vocGanhouMatch && ganhos === 0) ganhos = parseBRL(vocGanhouMatch[1]);

    // Cash out
    const cashoutMatch = blockText.match(/Total de Cash Out[:\s]*R\$\s*([\d.,]+)/i);
    const cashout = cashoutMatch ? parseBRL(cashoutMatch[1]) : 0;
    const isCashout = cashout > 0;

    // Multiple bet?
    const multiMatch = blockText.match(/(\d+)\s*Sele[çc][õo]es?\s*\(x\d+\)/i);
    const isMultiple = !!multiMatch;

    // Extract selections
    const selections: { result: 'V' | 'P'; selection: string; odd: number; event: string; market: string }[] = [];
    let currentEvent = '';
    let currentMarket = '';

    for (const line of block) {
      // Skip non-content lines
      if (line.match(/ID da aposta/) || line.match(/^https?:\/\//) || line.match(/^\d+\/\d+$/)) continue;

      // Event line: "Team A x Team B - Market"
      const eventMarketMatch = line.match(/^(.+?\s+x\s+.+?)\s*-\s*(.+)$/);
      if (eventMarketMatch && !line.match(/^[VP]\s/) && !line.match(/^Simples/)) {
        currentEvent = eventMarketMatch[1].trim();
        currentMarket = eventMarketMatch[2].trim();
        continue;
      }
      // Standalone event
      if (line.match(/\s+x\s+/) && !line.match(/^[VP]\s/) && !line.match(/^Simples/) && !line.match(/ID da aposta/)) {
        currentEvent = line.trim();
        continue;
      }
      // Standalone market
      if (/^(Mais\/Menos|Resultado|Intervalo|Ambas|Handicap)/i.test(line)) {
        currentMarket = line.trim();
        continue;
      }

      // Selection: "V/P SelectionName ODD"
      const selMatch = line.match(/^([VP])\s+(.+?)\s+(\d+[.,]\d{2})\s*$/);
      if (selMatch) {
        selections.push({
          result: selMatch[1] as 'V' | 'P',
          selection: selMatch[2].trim(),
          odd: parseFloat(selMatch[3].replace(',', '.')),
          event: currentEvent,
          market: currentMarket,
        });
        continue;
      }

      // Inline result: "P - Mais de 1,5 gols"
      const inlineResultMatch = line.match(/^([VP])\s*-\s*(.+?)$/);
      if (inlineResultMatch) {
        selections.push({
          result: inlineResultMatch[1] as 'V' | 'P',
          selection: inlineResultMatch[2].trim(),
          odd: 0,
          event: currentEvent,
          market: currentMarket,
        });
        continue;
      }

      // Table row: "Simples Event - Market P/V - Selection R$XX R$XX ID"
      const tableRowMatch = line.match(/Simples\s+(.+?\s+x\s+.+?)\s*-\s*(.+?)\s+([VP])\s*-\s*(.+?)\s+R\$([\d.,]+)\s+R\$([\d.,]+)/);
      if (tableRowMatch) {
        const [, ev, mkt, res, sel, stk, win] = tableRowMatch;
        if (stake === 0) stake = parseBRL(stk);
        if (ganhos === 0) ganhos = parseBRL(win);
        selections.push({
          result: res as 'V' | 'P',
          selection: sel.trim(),
          odd: 0,
          event: ev.trim(),
          market: mkt.trim(),
        });
      }
    }

    // Calculate odd from ganhos/stake if missing
    for (const sel of selections) {
      if (sel.odd === 0 && ganhos > 0 && stake > 0 && !isMultiple) {
        sel.odd = Math.round((ganhos / stake) * 100) / 100;
      }
    }

    console.log(`[BetfairPDF] Bet ${betId}: stake=${stake}, ganhos=${ganhos}, sels=${selections.length}, cashout=${cashout}`);

    if (stake > 0 && selections.length > 0) {
      if (isMultiple) {
        const combinedOdd = selections.reduce((acc, s) => acc * (s.odd || 1), 1);
        const eventNames = selections.map(s => s.event || s.selection).join(' + ');
        const profitLoss = isCashout ? (cashout - stake) : (ganhos > 0 ? ganhos - stake : -stake);
        bets.push({
          event_name: eventNames.substring(0, 120),
          market: `Múltipla ${selections.length} seleções`,
          selection: selections.map(s => s.selection).join(', '),
          odd: Math.round(combinedOdd * 100) / 100,
          stake,
          profit_loss: Math.round(profitLoss * 100) / 100,
          result: isCashout ? 'void' : (ganhos > 0 ? 'green' : 'red'),
          bet_date: new Date().toISOString(),
          bookmaker: 'Betfair Sportsbook',
          raw_line: `[PDF] ${betId} | ${eventNames}`,
        });
      } else {
        const sel = selections[0];
        const profitLoss = isCashout ? (cashout - stake) : (ganhos > 0 ? ganhos - stake : -stake);
        bets.push({
          event_name: sel.event || 'Betfair Sportsbook',
          market: sel.market || 'Sportsbook',
          selection: sel.selection,
          odd: sel.odd || (ganhos > 0 && stake > 0 ? Math.round((ganhos / stake) * 100) / 100 : 0),
          stake,
          profit_loss: Math.round(profitLoss * 100) / 100,
          result: isCashout ? 'void' : (ganhos > 0 ? 'green' : 'red'),
          bet_date: new Date().toISOString(),
          bookmaker: 'Betfair Sportsbook',
          raw_line: `[PDF] ${betId} | ${sel.event} - ${sel.market}`,
        });
      }
    } else if (stake > 0) {
      // No selections but have stake
      const profitLoss = isCashout ? (cashout - stake) : (ganhos > 0 ? ganhos - stake : -stake);
      bets.push({
        event_name: `Betfair ${betId}`,
        market: 'Sportsbook',
        selection: 'Aposta',
        odd: ganhos > 0 && stake > 0 ? Math.round((ganhos / stake) * 100) / 100 : 0,
        stake,
        profit_loss: Math.round(profitLoss * 100) / 100,
        result: isCashout ? 'void' : (ganhos > 0 ? 'green' : 'red'),
        bet_date: new Date().toISOString(),
        bookmaker: 'Betfair Sportsbook',
        raw_line: `[PDF] ${betId}`,
      });
    }
  }

  return bets;
}

// ─── PDF text parser (for extracted text from pdfjs) ───
export function parsePDFText(text: string): ParsedBet[] {
  // Detect Betfair "My Account" / "Minhas apostas" PDF
  if (text.includes('ID da aposta:') && text.includes('Valor Apostado') && text.includes('betfair')) {
    return parseBetfairMyAccountPDF(text);
  }

  // Generic fallback
  const bets: ParsedBet[] = [];
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const oddPattern = /(\d+[.,]\d{2})/;

  for (const line of lines) {
    const matches = line.match(oddPattern);
    if (!matches) continue;

    const numbers = [...line.matchAll(/(\d+[.,]\d{2})/g)].map(m => parseFloat(m[1].replace(',', '.')));

    if (numbers.length >= 2) {
      const odd = numbers.find(n => n >= 1.01 && n <= 100) || 0;
      const stake = numbers.find(n => n !== odd && n > 0) || 0;

      if (odd > 1 && stake > 0) {
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
