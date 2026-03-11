import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, User, Lock, Save, Loader2, CheckCircle, XCircle, RefreshCw, Plus } from 'lucide-react';
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
  username: string;
  encrypted_password: string;
  is_active: boolean;
  last_sync_at: string | null;
}

export default function BetfairConfig({ userId }: BetfairConfigProps) {
  const [connection, setConnection] = useState<ConnectionData | null>(null);
  const [appKey, setAppKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Create App Key dialog state
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [createKeyUser, setCreateKeyUser] = useState('');
  const [createKeyPass, setCreateKeyPass] = useState('');
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
      setUsername(data.username || '');
      setPassword(data.encrypted_password || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!appKey.trim() || !username.trim() || !password.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        bookmaker: 'betfair' as const,
        app_key: appKey.trim(),
        username: username.trim(),
        encrypted_password: password,
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
      setUsername('');
      setPassword('');
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
              isConnected ? "bg-success" : "bg-muted-foreground"
            )} />
            <h3 className="font-mono text-sm font-semibold text-foreground">
              BETFAIR EXCHANGE
            </h3>
          </div>
          {isConnected && (
            <span className="text-xs text-muted-foreground font-mono">
              {connection?.last_sync_at
                ? `Último sync: ${new Date(connection.last_sync_at).toLocaleString('pt-BR')}`
                : 'Nunca sincronizado'}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bf-appkey" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Key className="w-3 h-3" /> App Key
            </Label>
            <Input
              id="bf-appkey"
              type="text"
              placeholder="Sua App Key da Betfair"
              value={appKey}
              onChange={e => setAppKey(e.target.value)}
              className="font-mono text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bf-user" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="w-3 h-3" /> Usuário
            </Label>
            <Input
              id="bf-user"
              type="text"
              placeholder="Username da Betfair"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="font-mono text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bf-pass" className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Senha
            </Label>
            <Input
              id="bf-pass"
              type="password"
              placeholder="Senha da Betfair"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="font-mono text-xs h-9"
            />
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
            Suas credenciais são armazenadas de forma segura e utilizadas apenas para sincronizar apostas.
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
                Como o site da Betfair é bloqueado no Brasil, criamos sua App Key diretamente via API.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Usuário Betfair</Label>
                  <Input
                    type="text"
                    placeholder="Seu username"
                    value={createKeyUser}
                    onChange={e => setCreateKeyUser(e.target.value)}
                    className="font-mono text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Senha Betfair</Label>
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    value={createKeyPass}
                    onChange={e => setCreateKeyPass(e.target.value)}
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
                  disabled={creatingKey || !createKeyUser || !createKeyPass}
                  onClick={async () => {
                    setCreatingKey(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('create-betfair-appkey', {
                        body: { username: createKeyUser, password: createKeyPass, appName: createKeyName },
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);

                      const key = data?.delayedKey || data?.liveKey || '';
                      if (key) {
                        setAppKey(key);
                        setUsername(createKeyUser);
                        setPassword(createKeyPass);
                        toast.success(`App Key criada: ${key.slice(0, 8)}...`);
                      } else {
                        toast.success('App Key criada! Verifique os detalhes.');
                      }
                      setShowCreateKey(false);
                    } catch (e: any) {
                      toast.error(`Erro: ${e.message}`);
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
