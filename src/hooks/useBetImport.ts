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
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) || file.type.startsWith('image/');

      if (isImage) {
        // Convert image to base64 and send to AI for OCR
        const base64 = await fileToBase64(file);
        const mimeType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        
        const { data, error } = await supabase.functions.invoke('parse-bet-screenshot', {
          body: { imageBase64: base64, mimeType },
        });

        if (error) throw error;
        if (!data?.success || !data?.data) throw new Error(data?.error || 'Falha ao processar imagem');

        const slip = data.data;
        
        // Convert multi-selection bet slip into individual ParsedBet entries
        const bets: ParsedBet[] = slip.selections.map((sel: any) => {
          const isGreen = sel.result === 'green';
          const isRed = sel.result === 'red';
          const odd = sel.odd || 1;
          const stake = slip.stake || 0;
          
          return {
            event_name: sel.event_name || sel.selection,
            market: sel.market || 'Resultado Final',
            selection: sel.selection,
            odd,
            stake,
            profit_loss: isGreen ? Math.round(stake * (odd - 1) * 100) / 100 
                        : isRed ? -stake : 0,
            result: sel.result as ParsedBet['result'],
            bet_date: slip.bet_date || new Date().toISOString(),
            bookmaker: slip.bookmaker || 'Betano',
            raw_line: `[IMG] ${sel.selection} @ ${odd} | ${sel.event_name} | ${sel.score || ''}`,
          };
        });

        setPreview(bets);
        setFormat(`screenshot-${slip.bookmaker?.toLowerCase() || 'betano'}`);
      } else if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        const result = parseCSV(text);
        setPreview(result.bets);
        setFormat(result.format);
      } else if (ext === 'pdf') {
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
      } else {
        throw new Error(`Formato não suportado: .${ext}`);
      }
    } catch (e: any) {
      console.error('Parse error:', e);
      const { toast } = await import('sonner');
      toast.error(e.message || 'Erro ao processar arquivo');
    } finally {
      setParsing(false);
    }
  }, []);

  // Helper: convert File to base64 string (without data URI prefix)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URI prefix: "data:image/png;base64,..."
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const confirmImport = useCallback(async (bets: ParsedBet[]) => {
    if (!user || bets.length === 0) return { success: false, error: 'Sem apostas para importar' };
    setImporting(true);

    try {
      const isScreenshot = format.startsWith('screenshot-');
      const source = isScreenshot ? 'screenshot' : format === 'pdf' ? 'pdf' : 'csv';
      const bookmakerFromFormat = isScreenshot ? format.replace('screenshot-', '') : undefined;
      const batchId = crypto.randomUUID();
      const rows = bets.map(b => ({
        user_id: user.id,
        source,
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
      if (error) {
        // Try to extract the error message from the response body
        let msg = error.message || 'Erro desconhecido';
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch {}
        return { success: false, error: msg };
      }
      if (data?.error) return { success: false, error: data.error };
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
