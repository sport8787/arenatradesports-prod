import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCw, Scale } from 'lucide-react';

interface Row {
  fonte: string;
  aprovados: number;
  green: number;
  red: number;
  pendentes: number;
  odd_media: number | null;
  pl_total: number | null;
  stake_total: number | null;
  hit_rate_pct: number | null;
  roi_pct: number | null;
}

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : Number(n).toFixed(d);

export default function ComparativoDetVsIaTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_comparativo_ao_vivo' as any)
      .select('*');
    if (!error && data) {
      setRows(data as unknown as Row[]);
      setUpdatedAt(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const det = rows.find(r => r.fonte?.toLowerCase().includes('deter'));
  const ia = rows.find(r => r.fonte?.toLowerCase().includes('ia'));

  return (
    <div className="space-y-4">
      <Card className="p-4 border-violet-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-violet-500" />
            <h3 className="font-semibold">Determinístico × IA — Trader Sports (ao vivo, 30d)</h3>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt && (
              <span className="text-[11px] text-muted-foreground">
                Atualizado {updatedAt.toLocaleTimeString('pt-BR')}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Fonte de dados: view <code className="text-[10px] bg-secondary px-1 rounded">v_comparativo_ao_vivo</code>.
          Determinístico = <code className="text-[10px]">live_sinais</code> · IA ={' '}
          <code className="text-[10px]">mycroft_analyses_shadow_ai</code>. Liquidação automática via triggers em{' '}
          <code className="text-[10px]">live_matches</code>.
        </p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Aprov.</TableHead>
                <TableHead className="text-right text-emerald-500">🟢</TableHead>
                <TableHead className="text-right text-rose-500">🔴</TableHead>
                <TableHead className="text-right">Pend.</TableHead>
                <TableHead className="text-right">Hit %</TableHead>
                <TableHead className="text-right">Odd média</TableHead>
                <TableHead className="text-right">P/L (u)</TableHead>
                <TableHead className="text-right">ROI %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[det, ia].filter(Boolean).map((r) => (
                <TableRow key={r!.fonte}>
                  <TableCell className="font-medium">
                    {r!.fonte === 'deterministico' || r!.fonte?.toLowerCase().includes('deter')
                      ? '🧮 Determinístico'
                      : '🤖 IA (Gemini)'}
                  </TableCell>
                  <TableCell className="text-right">{r!.aprovados}</TableCell>
                  <TableCell className="text-right text-emerald-500 font-semibold">{r!.green}</TableCell>
                  <TableCell className="text-right text-rose-500 font-semibold">{r!.red}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r!.pendentes}</TableCell>
                  <TableCell className="text-right">{fmt(r!.hit_rate_pct, 1)}%</TableCell>
                  <TableCell className="text-right">{fmt(r!.odd_media, 2)}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      (r!.pl_total ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {(r!.pl_total ?? 0) >= 0 ? '+' : ''}
                    {fmt(r!.pl_total, 2)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      (r!.roi_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {(r!.roi_pct ?? 0) >= 0 ? '+' : ''}
                    {fmt(r!.roi_pct, 1)}%
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Sem dados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          ⚠️ Amostra pequena (&lt;30 liquidados/lado) ainda não é estatisticamente conclusiva. Use como
          tendência, não como veredito final.
        </p>
      </Card>
    </div>
  );
}
