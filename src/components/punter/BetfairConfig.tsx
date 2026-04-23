import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Lock, Save, Loader2, CheckCircle, XCircle, RefreshCw, Plus, AlertTriangle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface BetfairConfigProps {
  userId: string;
}

interface ConnectionData {
  id?: string;
  app_key: string;
  session_token: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  token_expires_at: string | null;
}

const normalizeSessionToken = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.replace(/^ssoid\s*=\s*/i, '');
  const firstCookiePart = withoutPrefix.split(';')[0]?.trim() ?? '';
  return firstCookiePart.replace(/^"|"$/g, '');
};

const extractFunctionErrorMessage = async (error: any) => {
  const fallback = error?.message || 'Erro desconhecido';
  const response = error?.context;
  if (!response || typeof response.json !== 'function') return fallback;
  try {
    const payload = await response.json();
    const baseError = payload?.error || fallback;
    return payload?.hint ? `${baseError}: ${payload.hint}` : baseError;
  } catch {
    return fallback;
  }
};

export default function BetfairConfig({ userId }: BetfairConfigProps) {
  const [connection, setConnection] = useState<ConnectionData | null>(null);
  const [appKey, setAppKey] = useState('');
  const [ssoid, setSsoid] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Create App Key dialog state
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [createKeySessionToken, setCreateKeySessionToken] = useState('');
  const [createKeyName, setCreateKeyName] = useState('ArenaTradeSports');
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    loadConnection();
  }, [userId]);

  const loadConnection = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookmaker_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('bookmaker', 'betfair')
      .maybeSingle();

    if (data) {
      setConnection(data as ConnectionData);
      setAppKey(data.app_key || '');
      setSsoid(data.session_token || '');
    }
    setLoading(false);
  };

  const isTokenExpired = () => {
    if (!connection?.token_expires_at) return true;
    return new Date(connection.token_expires_at) < new Date();
  };

  const handleSave = async () => {
    if (!appKey.trim() || !ssoid.trim()) {
      toast.error('Preencha App Key e SSOID');
      return;
    }

    setSaving(true);
    try {
      const normalizedToken = normalizeSessionToken(ssoid);
      const payload = {
        user_id: userId,
        bookmaker: 'betfair' as const,
        app_key: appKey.trim(),
        session_token: normalizedToken,
        token_expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (connection?.id) {
        const { error } = await supabase
          .from('bookmaker_connections')
          .update(payload)
          .eq('id', connection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bookmaker_connections')
          .insert(payload);
        if (error) throw error;
      }

      toast.success('Conexão Betfair salva com sucesso!');
      await loadConnection();
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-betfair');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sincronizadas ${data?.synced || 0} apostas!`);
      await loadConnection();
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection?.id) return;
    const { error } = await supabase
      .from('bookmaker_connections')
      .update({ is_active: false })
      .eq('id', connection.id);

    if (error) {
      toast.error('Erro ao desconectar');
    } else {
      toast.success('Betfair desconectada');
      setConnection(null);
      setAppKey('');
      setSsoid('');
      await loadConnection();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = connection?.is_active;
  const tokenExpired = isTokenExpired();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected && !tokenExpired ? "bg-success" : isConnected ? "bg-warning" : "bg-muted-foreground"
            )} />
            <h3 className="font-mono text-sm font-semibold text-foreground">
              BETFAIR EXCHANGE
            </h3>
          </div>
          <div className="text-right">
            {isConnected && tokenExpired && (
              <span className="text-xs text-warning font-mono block">SSOID expirado — atualize</span>
            )}
            {isConnected && (
              <span className="text-xs text-muted-foreground font-mono">
                {connection?.last_sync_at
                  ? `Último sync: ${new Date(connection.last_sync_at).toLocaleString('pt-BR')}`
                  : 'Nunca sincronizado'}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bf-appkey" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Key className="w-3 h-3" /> App Key
            </Label>
            <Input
              id="bf-appkey"
              type="password"
              placeholder="Sua App Key da Betfair (delayed)"
              value={appKey}
              onChange={e => setAppKey(e.target.value)}
              className="font-mono text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bf-ssoid" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> SSOID (Session Token)
            </Label>
            <Input
              id="bf-ssoid"
              type="password"
              placeholder="Cole o valor do cookie ssoid da sua sessão Betfair"
              value={ssoid}
              onChange={e => setSsoid(e.target.value)}
              className="font-mono text-xs h-9"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
               Abra <strong>betfair.com.br</strong> logado → clique com botão direito na página → <strong>Inspecionar</strong> → aba <strong>Aplicação</strong> (Application) → no menu lateral, clique em <strong>Cookies</strong> → selecione o domínio da Betfair → no filtro, pesquise <code className="bg-muted px-1 rounded">ssoid</code> → copie o <strong>Valor</strong>
             </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="flex-1"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            {connection?.id ? 'Atualizar' : 'Conectar'}
          </Button>

          {isConnected && (
            <>
              <Button
                onClick={handleSync}
                disabled={syncing}
                variant="outline"
                size="sm"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
              <Button
                onClick={handleDisconnect}
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-muted-foreground leading-relaxed flex-1">
            O SSOID expira periodicamente. Atualize-o quando necessário para manter a sincronização.
          </p>
          <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
            <DialogTrigger asChild>
              <Button variant="link" size="sm" className="text-[10px] text-primary px-0 h-auto shrink-0">
                <Plus className="w-3 h-3 mr-1" /> Criar App Key
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-mono text-sm">CRIAR APP KEY BETFAIR</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Cole o <span className="font-mono">ssoid</span> (sessionToken) ativo da sua sessão Betfair BR.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Session Token (ssoid)</Label>
                  <Input
                    type="text"
                    placeholder="Cole aqui o valor do cookie ssoid"
                    value={createKeySessionToken}
                    onChange={e => setCreateKeySessionToken(e.target.value)}
                    className="font-mono text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do App</Label>
                  <Input
                    type="text"
                    value={createKeyName}
                    onChange={e => setCreateKeyName(e.target.value)}
                    className="font-mono text-xs h-9"
                  />
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={creatingKey || !createKeySessionToken.trim() || !createKeyName.trim()}
                  onClick={async () => {
                    setCreatingKey(true);
                    try {
                      const normalized = normalizeSessionToken(createKeySessionToken);
                      if (!normalized || normalized.length < 20) {
                        throw new Error('SSOID inválido. Cole apenas o VALOR do cookie ssoid (sem "ssoid=" e sem ponto e vírgula).');
                      }
                      // Garante que existe sessão antes de invocar
                      const { data: session } = await supabase.auth.getSession();
                      if (!session?.session?.access_token) {
                        throw new Error('Sessão expirada. Faça login novamente e tente outra vez.');
                      }
                      console.log('[CreateBetfairKey] Invocando edge function…', {
                        ssoidLen: normalized.length,
                        appName: createKeyName.trim(),
                      });
                      const { data, error } = await supabase.functions.invoke('create-betfair-appkey', {
                        body: { sessionToken: normalized, appName: createKeyName.trim() },
                      });
                      console.log('[CreateBetfairKey] Resposta:', { data, error });

                      if (error) throw new Error(await extractFunctionErrorMessage(error));
                      if (data?.error) {
                        const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? '');
                        throw new Error(`${data.error}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
                      }

                      const key = data?.delayedKey || data?.liveKey || '';
                      if (key) {
                        setAppKey(key);
                        // Also pre-fill SSOID since user already provided it
                        setSsoid(normalized);
                        setCreateKeySessionToken('');
                        toast.success(`App Key criada: ${key.slice(0, 8)}...`);
                      } else {
                        toast.warning('A Betfair respondeu mas não retornou nenhuma chave. Verifique no portal Developer.');
                      }
                      setShowCreateKey(false);
                    } catch (e: any) {
                      console.error('[CreateBetfairKey] Falha:', e);
                      toast.error(e?.message || 'Falha ao criar App Key', { duration: 8000 });
                    } finally {
                      setCreatingKey(false);
                    }
                  }}
                >
                  {creatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Key className="w-3.5 h-3.5 mr-1.5" />}
                  Criar App Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </motion.div>
  );
}
