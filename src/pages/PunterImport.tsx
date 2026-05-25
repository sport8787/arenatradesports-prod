import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, BarChart3,
  CheckCircle, XCircle, Clock, Brain,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import BetImportPanel from '@/components/punter/BetImportPanel';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import ImportedBetsAnalytics from '@/components/punter/ImportedBetsAnalytics';

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
            <button onClick={() => navigate('/punter/funcoes')} className="text-muted-foreground hover:text-foreground transition-colors">
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
        <PunterBreadcrumb items={[{ label: 'Funções', to: '/punter/funcoes' }, { label: 'Importar Entradas' }]} />

        {/* Aviso: para Betfair real, usar página dedicada */}
        <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 flex items-start gap-2">
          <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Procurando análise das suas entradas reais Betfair?
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Esta página é para imports manuais (CSV/PDF/screenshot) e analytics da banca
              virtual Hórus.
            </p>
            <Button
              size="sm"
              variant="link"
              className="text-primary px-0 h-auto text-xs mt-1"
              onClick={() => navigate('/punter/betfair-real')}
            >
              Abrir Entradas Reais Betfair →
            </Button>
          </div>
        </div>

        {!user ? (
          <p className="text-muted-foreground text-sm text-center py-8">Faça login para acessar.</p>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-secondary/50 w-full">
              <TabsTrigger value="import" className="flex-1 gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Importar
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex-1 gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Análise
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4 mt-4">
              <ImportTab userId={user.id} onOpenPanel={() => setImportOpen(true)} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 mt-4">
              <ImportedBetsAnalytics userId={user.id} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BetImportPanel isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

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
        .neq('source', 'betfair')
        .order('bet_date', { ascending: false })
        .limit(50);
      setBets((data as ImportedBet[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <p className="text-xs text-muted-foreground text-center py-4">Carregando…</p>;
  if (!bets.length) return <p className="text-xs text-muted-foreground text-center py-4">Nenhuma entrada importada manualmente ainda.</p>;

  const resultIcon = (r: string | null) => {
    if (r === 'green') return <CheckCircle className="w-3.5 h-3.5 text-success" />;
    if (r === 'red') return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const totalPL = bets.reduce((sum, b) => sum + (b.profit_loss || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold text-foreground uppercase">Entradas Importadas (Manual)</h3>
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
                  {new Date(bet.bet_date).toLocaleDateString('pt-BR')}
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

function ImportTab({ userId, onOpenPanel }: { userId: string; onOpenPanel: () => void }) {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
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

      <ImportedBetsList userId={userId} />
    </div>
  );
}
