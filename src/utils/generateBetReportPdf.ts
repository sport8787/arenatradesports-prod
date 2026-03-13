import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BetRow {
  match_name: string;
  market: string;
  odd: number;
  stake: number;
  status: string;
  result?: string;
  profit_loss: number | null;
  placed_at: string;
  league?: string;
}

interface ReportStats {
  totalBets: number;
  greens: number;
  reds: number;
  pending: number;
  winRate: number;
  totalProfit: number;
  totalStaked: number;
  roi: number;
  balance: number;
}

export function generateBetReportPdf(
  bets: BetRow[],
  stats: ReportStats,
  title: string,
  fileName: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 15, 20);
  doc.rect(0, 0, w, 28, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ARENA TRADE SPORTS', 14, 14);
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text(title, 14, 22);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, w - 14, 14, { align: 'right' });

  // Stats cards
  const y0 = 34;
  const cards = [
    { label: 'Saldo', value: `R$ ${stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    { label: 'Total Apostas', value: `${stats.totalBets}` },
    { label: 'Greens', value: `${stats.greens}` },
    { label: 'Reds', value: `${stats.reds}` },
    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%` },
    { label: 'Lucro', value: `R$ ${stats.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    { label: 'ROI', value: `${stats.roi.toFixed(1)}%` },
  ];
  const cw = (w - 28) / cards.length;
  cards.forEach((c, i) => {
    const cx = 14 + i * cw;
    doc.setFillColor(25, 25, 35);
    doc.roundedRect(cx, y0, cw - 3, 16, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(c.label.toUpperCase(), cx + (cw - 3) / 2, y0 + 5, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(c.value, cx + (cw - 3) / 2, y0 + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  // Table
  const rows = bets.map(b => {
    const st = b.result === 'green' || b.status === 'green' ? '🟢 GREEN'
      : b.result === 'red' || b.status === 'red' ? '🔴 RED'
      : b.status === 'cancelled' ? '⚫ CANCEL'
      : '🟡 PENDING';
    return [
      new Date(b.placed_at).toLocaleDateString('pt-BR'),
      b.match_name.length > 35 ? b.match_name.substring(0, 35) + '…' : b.match_name,
      b.league || '-',
      b.market,
      b.odd.toFixed(2),
      `R$ ${b.stake.toFixed(2)}`,
      st,
      b.profit_loss != null ? `R$ ${b.profit_loss.toFixed(2)}` : '-',
    ];
  });

  autoTable(doc, {
    startY: y0 + 22,
    head: [['Data', 'Jogo', 'Liga', 'Mercado', 'Odd', 'Stake', 'Status', 'P/L']],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [220, 220, 220],
      fillColor: [20, 20, 28],
      lineColor: [50, 50, 60],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 30, 45],
      textColor: [212, 175, 55],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [25, 25, 38],
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 60 },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'center' },
      7: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = data.cell.text.join('');
        if (val.includes('-')) data.cell.styles.textColor = [239, 68, 68];
        else if (val !== '-') data.cell.styles.textColor = [34, 197, 94];
      }
      if (data.section === 'body' && data.column.index === 6) {
        const val = data.cell.text.join('');
        if (val.includes('GREEN')) data.cell.styles.textColor = [34, 197, 94];
        else if (val.includes('RED')) data.cell.styles.textColor = [239, 68, 68];
        else if (val.includes('PENDING')) data.cell.styles.textColor = [234, 179, 8];
      }
    },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Arena Trade Sports — Relatório confidencial — Página ${i}/${pageCount}`, w / 2, h - 6, { align: 'center' });
  }

  doc.save(fileName);
}
