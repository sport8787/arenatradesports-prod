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

interface ErrorDetails {
  title: string;
  hint?: string;
  detail?: string;
  status?: number;
}

const extractFunctionError = async (error: any): Promise<ErrorDetails> => {
  const fallbackTitle = error?.message || 'Erro desconhecido ao chamar a função';
  const response = error?.context;
  if (!response || typeof response.json !== 'function') {
    return { title: fallbackTitle, status: response?.status };
  }
  try {
    const payload = await response.json();
    return {
      title: payload?.error || fallbackTitle,
      hint: payload?.hint,
      detail: typeof payload?.detail === 'string'
        ? payload.detail
        : payload?.detail ? JSON.stringify(payload.detail).slice(0, 500) : undefined,
      status: response?.status,
    };
  } catch {
    try {
      const text = await response.text?.();
      return { title: fallbackTitle, detail: text?.slice(0, 500), status: response?.status };
    } catch {
      return { title: fallbackTitle, status: response?.status };
    }
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
  const [createKeyError, setCreateKeyError] = useState<ErrorDetails | null>(null);

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
      toast.success(`Sincronizadas ${data?.synced || 0} entradas!`);
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
                {createKeyError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-semibold text-destructive break-words">
                          {createKeyError.title}
                          {createKeyError.status ? ` (HTTP ${createKeyError.status})` : ''}
                        </p>
                        {createKeyError.hint && (
                          <p className="text-[11px] text-foreground/80 leading-snug break-words">
                            💡 {createKeyError.hint}
                          </p>
                        )}
                        {createKeyError.detail && (
                          <details className="text-[10px] text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">Detalhes técnicos</summary>
                            <pre className="mt-1 p-2 bg-background/50 rounded font-mono text-[10px] whitespace-pre-wrap break-all max-h-32 overflow-auto">
{createKeyError.detail}
                            </pre>
                          </details>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const txt = `${createKeyError.title}\n${createKeyError.hint || ''}\n${createKeyError.detail || ''}`;
                            navigator.clipboard?.writeText(txt);
                            toast.success('Erro copiado');
                          }}
                          className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar erro para suporte
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <Button
                  className="w-full"
                  size="sm"
                  disabled={creatingKey || !createKeySessionToken.trim() || !createKeyName.trim()}
                  onClick={async () => {
                    setCreateKeyError(null);
                    setCreatingKey(true);
                    try {
                      const rawLen = createKeySessionToken.trim().length;
                      const normalized = normalizeSessionToken(createKeySessionToken);
                      console.log('[CreateBetfairKey] Iniciando…', { rawLen, normalizedLen: normalized.length });

                      if (!normalized) {
                        throw Object.assign(new Error('SSOID vazio'), {
                          _details: { title: 'SSOID vazio', hint: 'Cole o valor do cookie ssoid antes de continuar.' } as ErrorDetails,
                        });
                      }
                      if (normalized.length < 20) {
                        throw Object.assign(new Error('SSOID inválido'), {
                          _details: {
                            title: 'SSOID inválido (muito curto)',
                            hint: 'Cole apenas o VALOR do cookie ssoid (sem "ssoid=" e sem ponto e vírgula). Esperado ~40+ caracteres.',
                            detail: `Comprimento recebido: ${normalized.length}`,
                          } as ErrorDetails,
                        });
                      }

                      const { data: session } = await supabase.auth.getSession();
                      if (!session?.session?.access_token) {
                        throw Object.assign(new Error('Sessão expirada'), {
                          _details: {
                            title: 'Sessão expirada',
                            hint: 'Sua sessão no app expirou. Faça login novamente e repita o processo.',
                          } as ErrorDetails,
                        });
                      }

                      console.log('[CreateBetfairKey] Invocando edge function…', {
                        ssoidLen: normalized.length,
                        appName: createKeyName.trim(),
                      });

                      const invokePromise = supabase.functions.invoke('create-betfair-appkey', {
                        body: { sessionToken: normalized, appName: createKeyName.trim() },
                      });
                      const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(Object.assign(new Error('Timeout'), {
                          _details: {
                            title: 'Tempo esgotado (30s)',
                            hint: 'A função demorou demais para responder. Verifique sua conexão e tente novamente.',
                          } as ErrorDetails,
                        })), 30000)
                      );

                      const result: any = await Promise.race([invokePromise, timeoutPromise]);
                      const { data, error } = result;
                      console.log('[CreateBetfairKey] Resposta:', { data, error });

                      if (error) {
                        const details = await extractFunctionError(error);
                        throw Object.assign(new Error(details.title), { _details: details });
                      }
                      if (!data) {
                        throw Object.assign(new Error('Resposta vazia'), {
                          _details: {
                            title: 'A função retornou resposta vazia',
                            hint: 'Tente novamente. Se persistir, contate o suporte.',
                          } as ErrorDetails,
                        });
                      }
                      if (data?.error) {
                        const detail = typeof data.detail === 'string'
                          ? data.detail
                          : data.detail ? JSON.stringify(data.detail).slice(0, 500) : undefined;
                        throw Object.assign(new Error(data.error), {
                          _details: { title: data.error, hint: data.hint, detail } as ErrorDetails,
                        });
                      }

                      const key = data?.delayedKey || data?.liveKey || '';
                      if (key) {
                        setAppKey(key);
                        setSsoid(normalized);
                        setCreateKeySessionToken('');
                        toast.success(`App Key criada: ${key.slice(0, 8)}...`);
                        setShowCreateKey(false);
                      } else {
                        setCreateKeyError({
                          title: 'A Betfair não retornou nenhuma chave',
                          hint: 'A requisição foi aceita, mas nenhuma App Key foi devolvida. Verifique o portal Developer da Betfair.',
                          detail: JSON.stringify(data).slice(0, 500),
                        });
                      }
                    } catch (e: any) {
                      console.error('[CreateBetfairKey] Falha:', e);
                      const details: ErrorDetails = e?._details || {
                        title: e?.message || 'Falha ao criar App Key',
                        hint: 'Erro inesperado. Abra o console do navegador (F12) para mais detalhes.',
                      };
                      setCreateKeyError(details);
                      toast.error(details.title, {
                        description: details.hint,
                        duration: 10000,
                      });
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
