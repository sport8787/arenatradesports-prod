import { useEffect, useState } from 'react';
import { ExternalLink, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';

interface SettledBet {
  id: string;
  source: 'punter' | 'manual';
  status: string | null;
  result: string | null;
  profit_loss: number | null;
  stake: number | null;
  market: string | null;
  created_at: string;
}

const SUPABASE_PROJECT_REF = 'affquongjlhmusxzohjl';

function tableUrl(source: 'punter' | 'manual', id: string) {
  const table = source === 'punter' ? 'virtual_bets_punter' : 'virtual_bets_manual';
  // Filter by id in the Supabase table editor
  const filter = encodeURIComponent(`id=eq.${id}`);
  return `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/editor?schema=public&table=${table}&filter=${filter}`;
}

export default function SettledBetsDebugPanel({ userId }: { userId?: string }) {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [open, setOpen] = useState(false);
  const [bets, setBets] = useState<SettledBet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin || !userId || !open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [punterRes, manualRes] = await Promise.all([
        supabase
          .from('virtual_bets_punter')
          .select('id, status, result, profit_loss, stake, market, created_at')
          .eq('user_id', userId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('virtual_bets_manual')
          .select('id, status, result, profit_loss, stake, market, created_at')
          .eq('user_id', userId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      const merged: SettledBet[] = [
        ...(punterRes.data || []).map((b: any) => ({ ...b, source: 'punter' as const })),
        ...(manualRes.data || []).map((b: any) => ({ ...b, source: 'manual' as const })),
      ]
        .filter((b) => b.status === 'green' || b.status === 'red' || b.result === 'green' || b.result === 'red')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);
      setBets(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, userId, open]);

  if (adminLoading || !isAdmin) return null;

  return (
    <div className="border border-warning/40 bg-warning/5 rounded-md mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-warning font-mono text-[11px] uppercase tracking-widest">
          <Bug className="w-3.5 h-3.5" /> Debug · Entradas liquidadas (admin)
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-warning" /> : <ChevronDown className="w-4 h-4 text-warning" />}
      </button>
      {open && (
        <div className="border-t border-warning/30 p-3">
          {loading ? (
            <p className="font-mono text-[11px] text-muted-foreground">Carregando...</p>
          ) : bets.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">Nenhuma entrada liquidada nos últimos 30 dias.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-2">Data</th>
                    <th className="text-left py-1.5 pr-2">Fonte</th>
                    <th className="text-left py-1.5 pr-2">Mercado</th>
                    <th className="text-right py-1.5 pr-2">Stake</th>
                    <th className="text-right py-1.5 pr-2">P/L</th>
                    <th className="text-left py-1.5 pr-2">Status</th>
                    <th className="text-left py-1.5">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((b) => {
                    const settled = (b.status || b.result || '').toLowerCase();
                    const isGreen = settled === 'green';
                    return (
                      <tr key={`${b.source}-${b.id}`} className="border-b border-border/50">
                        <td className="py-1.5 pr-2 text-muted-foreground">
                          {new Date(b.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className="px-1.5 py-0.5 border border-border rounded text-[10px] uppercase">
                            {b.source}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-foreground truncate max-w-[180px]">{b.market || '—'}</td>
                        <td className="py-1.5 pr-2 text-right text-foreground">{Number(b.stake || 0).toFixed(2)}</td>
                        <td className={`py-1.5 pr-2 text-right font-bold ${isGreen ? 'text-success' : 'text-destructive'}`}>
                          {Number(b.profit_loss || 0) >= 0 ? '+' : ''}{Number(b.profit_loss || 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={`uppercase text-[10px] font-bold ${isGreen ? 'text-success' : 'text-destructive'}`}>
                            {settled}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <a
                            href={tableUrl(b.source, b.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> abrir
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="font-mono text-[10px] text-muted-foreground/70 mt-2">
                Mostrando {bets.length} entradas liquidadas (últimos 30 dias). Mesma fonte usada pelos cards do hero banner.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
