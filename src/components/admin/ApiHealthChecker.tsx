import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import LuxuryCard from '@/components/game/LuxuryCard';
import GoldButton from '@/components/game/GoldButton';
import { 
  Activity, CheckCircle, XCircle, AlertTriangle, 
  RefreshCw, Zap, Brain, TrendingUp, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface ApiStatus {
  name: string;
  status: 'checking' | 'ok' | 'error' | 'warning' | 'idle';
  message: string;
  icon: typeof Activity;
  lastChecked?: Date;
}

const initialApis: ApiStatus[] = [
  { name: 'Lovable AI Gateway (Gemini)', status: 'idle', message: 'Não verificado', icon: Brain },
  { name: 'Arena Trader Analyze', status: 'idle', message: 'Não verificado', icon: TrendingUp },
  { name: 'Smart Odds Scanner', status: 'idle', message: 'Não verificado', icon: Zap },
  { name: 'Mycroft Telegram', status: 'idle', message: 'Não verificado', icon: MessageSquare },
  { name: 'Send Notifications', status: 'idle', message: 'Não verificado', icon: MessageSquare },
];

export default function ApiHealthChecker() {
  const [apis, setApis] = useState<ApiStatus[]>(initialApis);
  const [isChecking, setIsChecking] = useState(false);

  const updateApiStatus = (name: string, status: ApiStatus['status'], message: string) => {
    setApis(prev => prev.map(api => 
      api.name === name 
        ? { ...api, status, message, lastChecked: new Date() }
        : api
    ));
  };

  const checkLovableAI = async () => {
    updateApiStatus('Lovable AI Gateway (Gemini)', 'checking', 'Verificando...');
    try {
      const { data, error } = await supabase.functions.invoke('arena-trader-analyze', {
        body: {
          asset: { symbol: 'TEST', name: 'Test Asset', category: 'crypto' },
          candles: [{ open: 100, high: 105, low: 95, close: 102, volume: 1000 }],
          currentPrice: 102,
          balance: 10000,
          position: null,
          technicalData: null,
          isLive: false,
          change24h: 2.5
        }
      });

      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        if (errorMsg.includes('credit') || errorMsg.includes('quota') || errorMsg.includes('limit')) {
          updateApiStatus('Lovable AI Gateway (Gemini)', 'error', '⚠️ CRÉDITOS ESGOTADOS!');
          return false;
        }
        updateApiStatus('Lovable AI Gateway (Gemini)', 'error', `Erro: ${errorMsg.slice(0, 50)}`);
        return false;
      }

      if (data?.mycroft?.verdict) {
        updateApiStatus('Lovable AI Gateway (Gemini)', 'ok', '✅ Funcionando normalmente');
        return true;
      } else {
        updateApiStatus('Lovable AI Gateway (Gemini)', 'warning', 'Resposta incompleta');
        return true;
      }
    } catch (err: any) {
      updateApiStatus('Lovable AI Gateway (Gemini)', 'error', `Erro: ${err.message?.slice(0, 50)}`);
      return false;
    }
  };

  const checkArenaTrader = async () => {
    updateApiStatus('Arena Trader Analyze', 'checking', 'Verificando...');
    try {
      const { data, error } = await supabase.functions.invoke('arena-trader-analyze', {
        body: {
          asset: { symbol: 'BTC', name: 'Bitcoin', category: 'crypto' },
          candles: Array(10).fill({ open: 50000, high: 51000, low: 49000, close: 50500, volume: 100 }),
          currentPrice: 50500,
          balance: 100000,
          position: null,
          technicalData: { sma9: 50200, sma21: 49800, rsi: 55 },
          isLive: false,
          change24h: 1.5
        }
      });

      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        if (errorMsg.includes('credit') || errorMsg.includes('quota') || errorMsg.includes('429')) {
          updateApiStatus('Arena Trader Analyze', 'error', '⚠️ API COM LIMITE ATINGIDO!');
          return false;
        }
        updateApiStatus('Arena Trader Analyze', 'error', `Erro: ${errorMsg.slice(0, 50)}`);
        return false;
      }

      if (data?.mycroft) {
        updateApiStatus('Arena Trader Analyze', 'ok', '✅ Funcionando normalmente');
        return true;
      } else {
        updateApiStatus('Arena Trader Analyze', 'warning', 'Resposta inesperada');
        return true;
      }
    } catch (err: any) {
      updateApiStatus('Arena Trader Analyze', 'error', `Erro: ${err.message?.slice(0, 50)}`);
      return false;
    }
  };

  const checkSmartOdds = async () => {
    updateApiStatus('Smart Odds Scanner', 'checking', 'Verificando...');
    try {
      const { data, error } = await supabase.functions.invoke('smart-odds-scanner', {
        body: { test: true }
      });

      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        if (errorMsg.includes('timeout')) {
          updateApiStatus('Smart Odds Scanner', 'warning', '⏱️ Timeout (normal para scans pesados)');
          return true;
        }
        if (errorMsg.includes('THE_ODDS_API') || errorMsg.includes('quota')) {
          updateApiStatus('Smart Odds Scanner', 'error', '⚠️ API de Odds sem créditos!');
          return false;
        }
        updateApiStatus('Smart Odds Scanner', 'error', `Erro: ${errorMsg.slice(0, 50)}`);
        return false;
      }

      updateApiStatus('Smart Odds Scanner', 'ok', '✅ Funcionando normalmente');
      return true;
    } catch (err: any) {
      if (err.message?.includes('timeout')) {
        updateApiStatus('Smart Odds Scanner', 'warning', '⏱️ Timeout (esperado)');
        return true;
      }
      updateApiStatus('Smart Odds Scanner', 'error', `Erro: ${err.message?.slice(0, 50)}`);
      return false;
    }
  };

  const checkTelegram = async () => {
    updateApiStatus('Mycroft Telegram', 'checking', 'Verificando...');
    updateApiStatus('Send Notifications', 'checking', 'Verificando...');
    
    try {
      // Check mycroft-telegram
      const { error: mycroftError } = await supabase.functions.invoke('mycroft-telegram', {
        body: { test: true }
      });

      if (mycroftError) {
        updateApiStatus('Mycroft Telegram', 'error', `Erro: ${mycroftError.message?.slice(0, 50)}`);
      } else {
        updateApiStatus('Mycroft Telegram', 'ok', '✅ Funcionando');
      }

      // Check send-notifications
      const { error: notifError } = await supabase.functions.invoke('send-notifications', {
        body: { test: true }
      });

      if (notifError) {
        updateApiStatus('Send Notifications', 'error', `Erro: ${notifError.message?.slice(0, 50)}`);
      } else {
        updateApiStatus('Send Notifications', 'ok', '✅ Funcionando');
      }

      return true;
    } catch (err: any) {
      updateApiStatus('Mycroft Telegram', 'error', `Erro: ${err.message?.slice(0, 50)}`);
      updateApiStatus('Send Notifications', 'error', `Erro: ${err.message?.slice(0, 50)}`);
      return false;
    }
  };

  const runAllChecks = async () => {
    setIsChecking(true);
    toast.info('Iniciando verificação de APIs...');

    await Promise.all([
      checkLovableAI(),
      checkArenaTrader(),
      checkSmartOdds(),
      checkTelegram()
    ]);

    const errors = apis.filter(a => a.status === 'error');
    if (errors.length > 0) {
      toast.error(`${errors.length} API(s) com problemas!`);
    } else {
      toast.success('Todas as APIs funcionando!');
    }

    setIsChecking(false);
  };

  const getStatusIcon = (status: ApiStatus['status']) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'checking': return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
      default: return <Activity className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBg = (status: ApiStatus['status']) => {
    switch (status) {
      case 'ok': return 'bg-green-500/10 border-green-500/30';
      case 'error': return 'bg-destructive/10 border-destructive/30';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
      case 'checking': return 'bg-primary/10 border-primary/30';
      default: return 'bg-muted/10 border-border';
    }
  };

  return (
    <LuxuryCard className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-lg text-primary flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Health Check de APIs
        </h2>
        <GoldButton 
          onClick={runAllChecks} 
          disabled={isChecking}
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Verificando...' : 'Verificar Todas'}
        </GoldButton>
      </div>

      <p className="text-sm text-muted-foreground">
        Clique para verificar se as APIs externas estão funcionando e com créditos disponíveis.
      </p>

      <div className="grid gap-3">
        {apis.map((api) => (
          <div 
            key={api.name}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${getStatusBg(api.status)}`}
          >
            <div className="flex items-center gap-3">
              <api.icon className="w-5 h-5 text-primary/70" />
              <div>
                <span className="font-medium">{api.name}</span>
                <p className="text-xs text-muted-foreground">{api.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {api.lastChecked && (
                <span className="text-xs text-muted-foreground">
                  {api.lastChecked.toLocaleTimeString('pt-BR')}
                </span>
              )}
              {getStatusIcon(api.status)}
            </div>
          </div>
        ))}
      </div>

      {apis.some(a => a.status === 'error') && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <p className="text-sm text-destructive font-medium">
            ⚠️ Atenção: Uma ou mais APIs estão com problemas. Verifique os créditos ou configurações.
          </p>
        </div>
      )}
    </LuxuryCard>
  );
}
