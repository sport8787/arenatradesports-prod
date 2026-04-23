import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, RefreshCw, TrendingUp, TrendingDown, Wallet,
  BarChart3, Target, FileText, Scale, ChevronDown, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBetImport } from '@/hooks/useBetImport';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import BetImportPanel from '@/components/punter/BetImportPanel';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import ImportedBetsAnalytics from '@/components/punter/ImportedBetsAnalytics';
import BankrollComparison from '@/components/punter/BankrollComparison';
import BetfairConfig from '@/components/punter/BetfairConfig';

export default function PunterImport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('import');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/punter')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
                IMPORTAR & ANÁLISE
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 max-w-4xl space-y-4">
        <PunterBreadcrumb items={[{ label: 'Funções', to: '/punter/funcoes' }, { label: 'Importar Apostas' }]} />
        {!user ? (
          <p className="text-muted-foreground text-sm text-center py-8">Faça login para acessar.</p>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-secondary/50 w-full">
                <TabsTrigger value="import" className="flex-1 gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Importar
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1 gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Análise
                </TabsTrigger>
                <TabsTrigger value="compare" className="flex-1 gap-1.5">
                  <Scale className="w-3.5 h-3.5" /> Comparativo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="import" className="space-y-4 mt-4">
                <ImportTab userId={user.id} onOpenPanel={() => setImportOpen(true)} />
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4 mt-4">
                <ImportedBetsAnalytics userId={user.id} />
              </TabsContent>

              <TabsContent value="compare" className="space-y-4 mt-4">
                <BankrollComparison userId={user.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <BetImportPanel isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

// ─── Imported Bets List ───
interface ImportedBet {
  id: string;
  event_name: string | null;
  selection: string | null;
  market: string;
  odd: number;
  stake: number;
  profit_loss: number | null;
  result: string | null;
  bet_date: string | null;
  bookmaker: string | null;
  source: string;
}

function ImportedBetsList({ userId }: { userId: string }) {
  const [bets, setBets] = useState<ImportedBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('imported_bets')
        .select('id, event_name, selection, market, odd, stake, profit_loss, result, bet_date, bookmaker, source')
        .eq('user_id', userId)
        .order('bet_date', { ascending: false })
        .limit(50);
      setBets((data as ImportedBet[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <p className="text-xs text-muted-foreground text-center py-4">Carregando apostas...</p>;
  if (!bets.length) return <p className="text-xs text-muted-foreground text-center py-4">Nenhuma aposta importada ainda.</p>;

  const resultIcon = (r: string | null) => {
    if (r === 'green') return <CheckCircle className="w-3.5 h-3.5 text-success" />;
    if (r === 'red') return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const totalPL = bets.reduce((sum, b) => sum + (b.profit_loss || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold text-foreground uppercase">Apostas Importadas</h3>
        <span className={cn("font-mono text-xs font-bold", totalPL >= 0 ? "text-success" : "text-destructive")}>
          P/L: {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
        </span>
      </div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {bets.map(bet => (
          <div key={bet.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
            <div className="shrink-0">{resultIcon(bet.result)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{bet.event_name || 'Evento desconhecido'}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {bet.selection || bet.market} • {bet.bookmaker || bet.source}
              </p>
              {bet.bet_date && (
                <p className="text-[10px] text-muted-foreground">
                  {new Date(bet.bet_date).toLocaleDateString('pt-BR')} {new Date(bet.bet_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono font-bold text-foreground">@{bet.odd.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground font-mono">R${bet.stake.toFixed(2)}</p>
              {bet.profit_loss != null && bet.result !== 'pending' && (
                <p className={cn("text-[10px] font-mono font-bold", (bet.profit_loss || 0) >= 0 ? "text-success" : "text-destructive")}>
                  {(bet.profit_loss || 0) >= 0 ? '+' : ''}{bet.profit_loss.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Import Tab ───
function ImportTab({ userId, onOpenPanel }: { userId: string; onOpenPanel: () => void }) {
  const { syncBetfair, syncing } = useBetImport();
  const [importedCount, setImportedCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadStats();
  }, [userId]);

  const loadStats = async () => {
    const [betsRes, connRes] = await Promise.all([
      supabase.from('imported_bets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('bookmaker_connections').select('last_sync_at').eq('user_id', userId).eq('bookmaker', 'betfair').eq('is_active', true).maybeSingle(),
    ]);
    setImportedCount(betsRes.count || 0);
    setLastSync(connRes.data?.last_sync_at || null);
  };

  const handleSync = async (force = false) => {
    const result = await syncBetfair(force);
    if (result.success) {
      toast.success(`${result.synced} apostas sincronizadas da Betfair!`);
      loadStats();
      setRefreshKey(k => k + 1);
    } else {
      toast.error(result.error || 'Erro ao sincronizar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <p className="text-[10px] text-muted-foreground font-mono uppercase">Apostas Importadas</p>
          <p className="text-2xl font-mono font-bold text-foreground">{importedCount}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <p className="text-[10px] text-muted-foreground font-mono uppercase">Último Sync Betfair</p>
          <p className="text-sm font-mono font-bold text-foreground">
            {lastSync ? new Date(lastSync).toLocaleString('pt-BR') : 'Nunca'}
          </p>
        </motion.div>
      </div>

      {/* Betfair Config + Sync */}
      <BetfairConfig userId={userId} />

      {/* Sync buttons */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2"
      >
        <Button onClick={() => handleSync(false)} disabled={syncing} variant="outline" className="flex-1">
          <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
        <Button onClick={() => handleSync(true)} disabled={syncing} variant="secondary" className="flex-1">
          <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
          {syncing ? '...' : 'Re-sync Completo'}
        </Button>
      </motion.div>

      {/* CSV/PDF/Image Import */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card border border-border rounded-lg p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          <h3 className="font-mono text-sm font-bold text-foreground">CSV / PDF / Screenshot</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Importe extratos da Bet365, Betano ou <span className="text-primary font-semibold">screenshots de comprovantes</span> (PNG/JPG).
        </p>
        <Button onClick={onOpenPanel} className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          Importar Arquivo
        </Button>
      </motion.div>

      {/* Imported Bets List */}
      <ImportedBetsList key={refreshKey} userId={userId} />
    </div>
  );
}
