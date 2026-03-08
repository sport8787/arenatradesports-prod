import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseCSV, parsePDFText, type ParsedBet } from '@/services/betImportParser';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export function useBetImport() {
  const { user } = useAuth();
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedBet[]>([]);
  const [format, setFormat] = useState('');
  const [syncing, setSyncing] = useState(false);

  const parseFile = useCallback(async (file: File) => {
    if (!file) return;
    setParsing(true);
    setPreview([]);

    try {
      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const text = await file.text();
        const result = parseCSV(text);
        setPreview(result.bets);
        setFormat(result.format);
      } else if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        const bets = parsePDFText(fullText);
        setPreview(bets);
        setFormat('pdf');
      }
    } catch (e) {
      console.error('Parse error:', e);
    } finally {
      setParsing(false);
    }
  }, []);

  const confirmImport = useCallback(async (bets: ParsedBet[]) => {
    if (!user || bets.length === 0) return { success: false, error: 'Sem apostas para importar' };
    setImporting(true);

    try {
      const batchId = crypto.randomUUID();
      const rows = bets.map(b => ({
        user_id: user.id,
        source: format === 'pdf' ? 'pdf' : 'csv',
        bookmaker: b.bookmaker,
        event_name: b.event_name,
        market: b.market,
        selection: b.selection || null,
        odd: b.odd,
        stake: b.stake,
        profit_loss: b.profit_loss,
        result: b.result,
        bet_date: b.bet_date,
        settle_date: b.settle_date || null,
        raw_data: { raw_line: b.raw_line },
        import_batch_id: batchId,
      }));

      const { error } = await supabase
        .from('imported_bets' as any)
        .insert(rows);

      if (error) return { success: false, error: error.message };

      setPreview([]);
      return { success: true, count: rows.length, batchId };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      setImporting(false);
    }
  }, [user, format]);

  const syncBetfair = useCallback(async () => {
    if (!user) return { success: false, error: 'Não autenticado' };
    setSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-betfair');
      if (error) throw error;
      return { success: true, ...data };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const clearPreview = useCallback(() => {
    setPreview([]);
    setFormat('');
  }, []);

  return {
    parseFile,
    confirmImport,
    syncBetfair,
    clearPreview,
    preview,
    format,
    parsing,
    importing,
    syncing,
  };
}
