import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, RefreshCw, TrendingUp, TrendingDown, Wallet,
  BarChart3, Target, FileText, Scale, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBetImport } from '@/hooks/useBetImport';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import BetImportPanel from '@/components/punter/BetImportPanel';
import ImportedBetsAnalytics from '@/components/punter/ImportedBetsAnalytics';
import BankrollComparison from '@/components/punter/BankrollComparison';

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

// ─── Import Tab ───
function ImportTab({ userId, onOpenPanel }: { userId: string; onOpenPanel: () => void }) {
  const { syncBetfair, syncing } = useBetImport();
  const [importedCount, setImportedCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);

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

  const handleSync = async () => {
    const result = await syncBetfair();
    if (result.success) {
      toast.success(`${result.synced} apostas sincronizadas da Betfair!`);
      loadStats();
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

      {/* Betfair Sync */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-lg p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🟡</span>
          <h3 className="font-mono text-sm font-bold text-foreground">Betfair Exchange</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Sincronize automaticamente. Configure credenciais em{' '}
          <button onClick={() => window.location.href = '/punter/config'} className="text-primary underline">
            Configurações
          </button>.
        </p>
        <Button onClick={handleSync} disabled={syncing} variant="outline" className="w-full">
          <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Betfair'}
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
    </div>
  );
}
