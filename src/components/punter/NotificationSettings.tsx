import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageCircle, Send, Loader2, Bell, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface NotificationSettingsProps {
  userId: string;
}

export default function NotificationSettings({ userId }: NotificationSettingsProps) {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { enabled: browserPushEnabled, isSupported: browserPushSupported, disablePush, requestPush } = usePushNotifications();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('email_notifications, telegram_notifications, notification_email')
        .eq('user_id', userId)
        .single();

      if (data) {
        setEmailEnabled(data.email_notifications ?? true);
        setTelegramEnabled(data.telegram_notifications ?? true);
        setNotificationEmail((data as any).notification_email ?? '');
      }

      // Try to get user email as default
      if (!data?.notification_email) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setNotificationEmail(user.email);
      }

      setLoaded(true);
    };
    load();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        email_notifications: emailEnabled,
        telegram_notifications: telegramEnabled,
        notification_email: notificationEmail || null,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id' });

    if (error) {
      toast.error('Erro ao salvar preferências');
    } else {
      toast.success('Preferências de notificação salvas!');
    }
    setSaving(false);
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: {},
      });

      if (error) throw error;

      const result = data as any;
      if (result.bets_sent === 0) {
        toast.info('Nenhuma entrada aprovada pendente para enviar');
      } else {
        toast.success(
          `Enviado! ${result.telegram_sent ? '✅ Telegram' : ''} ${result.emails_sent > 0 ? `✅ ${result.emails_sent} emails` : ''}`
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar notificação');
    }
    setTesting(false);
  };

  const handleBrowserPushToggle = async (checked: boolean) => {
    if (checked) {
      const ok = await requestPush();
      if (!ok) {
        toast.error('Não foi possível ativar as notificações do navegador');
        return;
      }
      toast.success('Notificações do navegador ativadas');
      return;
    }

    const ok = await disablePush();
    if (ok) {
      toast.success('Notificações de entradas aprovados desativadas');
    } else {
      toast.error('Não foi possível desativar as notificações do navegador');
    }
  };

  if (!loaded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg bg-card overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Bell className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          NOTIFICAÇÕES
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Telegram */}
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <MessageCircle className="w-4 h-4 text-[#0088cc]" />
              <div>
                <p className="text-xs font-mono font-semibold text-foreground">Telegram VIP</p>
                <p className="text-[10px] font-mono text-muted-foreground">Entradas enviadas ao grupo</p>
              </div>
            </div>
            <Switch
              checked={telegramEnabled}
              onCheckedChange={setTelegramEnabled}
            />
          </div>

          {telegramEnabled && (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] font-mono text-muted-foreground">
                ✅ Entradas aprovadas são enviadas automaticamente ao grupo Telegram
              </p>
              <a
                href="https://t.me/oraculo_mycroft"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] text-[10px] font-mono rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Entrar no Grupo VIP
              </a>
            </div>
          )}
        </div>

        {/* Browser Push */}
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2 gap-3">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs font-mono font-semibold text-foreground">Entradas Aprovadas no Navegador</p>
                <p className="text-[10px] font-mono text-muted-foreground">Alerta popup quando um entrada aprovado chegar</p>
              </div>
            </div>
            <Switch
              checked={browserPushEnabled}
              disabled={!browserPushSupported}
              onCheckedChange={handleBrowserPushToggle}
            />
          </div>

          <p className="text-[10px] font-mono text-muted-foreground">
            {browserPushSupported
              ? 'Desative aqui para parar os avisos repetidos de entrada aprovado neste navegador.'
              : 'Seu navegador atual não suporta notificações push.'}
          </p>
        </div>

        {/* Email */}
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs font-mono font-semibold text-foreground">Email Diário</p>
                <p className="text-[10px] font-mono text-muted-foreground">Resumo das entradas aprovadas</p>
              </div>
            </div>
            <Switch
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
          </div>

          {emailEnabled && (
            <div className="mt-2">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                className="h-8 text-xs font-mono bg-muted/30 border-border"
              />
              <p className="text-[9px] font-mono text-muted-foreground mt-1">
                Entradas aprovadas serão enviadas para este email
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="flex-1 font-mono text-xs"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Salvar
          </Button>
          <Button
            onClick={handleTestNotification}
            disabled={testing}
            variant="outline"
            size="sm"
            className="font-mono text-xs"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5" />
            )}
            Testar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
