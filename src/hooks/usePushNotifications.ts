import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// CHAVE PÚBLICA VAPID - segura para expor no frontend
const VAPID_PUBLIC_KEY = 'BBi6mGGqtqQoFAI_oFflxUpvcxh3het0VJvr7PeyISlI4XXiSjAmIj-DRAuQMY176_ZelRuCIA2LvFTea4j-X9M';
const PUSH_ENABLED_STORAGE_KEY = 'mycroft.browserPush.enabled';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function isSupportedEnv(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  // Não registra em iframes de preview do Lovable
  try {
    if (window.self !== window.top) return false;
  } catch { return false; }
  return true;
}

function getStoredPushEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(PUSH_ENABLED_STORAGE_KEY);
  return raw === null ? true : raw === 'true';
}

function setStoredPushEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, String(enabled));
}

async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn('[Push] Falha ao registrar SW:', e);
    return null;
  }
}

async function subscribeAndPersist(): Promise<boolean> {
  const reg = await registerSW();
  if (!reg) return false;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    } catch (e) {
      console.warn('[Push] Falha ao subscrever:', e);
      return false;
    }
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh as string | undefined;
  const auth = json.keys?.auth as string | undefined;
  if (!p256dh || !auth) {
    console.warn('[Push] Subscription sem chaves p256dh/auth — abortando.');
    return false;
  }

  // Garante usuário autenticado (RLS exige auth.uid() = user_id)
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    console.warn('[Push] Usuário não autenticado — não persiste subscription.');
    return false;
  }

  // Remove endpoint órfão de OUTRO usuário (device compartilhado / troca de conta)
  // Sem este passo o upsert por endpoint dispara violação de RLS.
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint)
    .neq('user_id', user.id);

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) {
    console.warn('[Push] Falha ao salvar subscription:', error);
    return false;
  }
  console.log('[Push] ✅ Subscription registrada');
  return true;
}

async function unsubscribeAndRemove(): Promise<boolean> {
  if (!isSupportedEnv()) return false;

  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      ?? await navigator.serviceWorker.getRegistration()
      ?? await navigator.serviceWorker.ready;

    const subscription = await reg?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint;

    if (endpoint) {
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);

      if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
      if (error) {
        console.warn('[Push] Falha ao remover subscription do banco:', error);
      }
    }

    if (subscription) {
      await subscription.unsubscribe();
    }

    return true;
  } catch (e) {
    console.warn('[Push] Falha ao cancelar subscription:', e);
    return false;
  }
}

export function usePushNotifications() {
  const [isSupported] = useState(isSupportedEnv());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    isSupportedEnv() ? Notification.permission : 'unsupported'
  );
  const [enabled, setEnabled] = useState(getStoredPushEnabled());
  const subscribedRef = useRef(false);

  // Auto-subscribe se já tem permissão
  useEffect(() => {
    if (!isSupported) return;
    if (!enabled) return;
    if (Notification.permission === 'granted' && !subscribedRef.current) {
      subscribedRef.current = true;
      subscribeAndPersist();
    }
  }, [enabled, isSupported]);

  const requestPush = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    if (Notification.permission === 'denied') return false;

    let perm: NotificationPermission = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return false;

    setStoredPushEnabled(true);
    setEnabled(true);
    const ok = await subscribeAndPersist();
    subscribedRef.current = ok;
    return ok;
  }, [isSupported]);

  const disablePush = useCallback(async (): Promise<boolean> => {
    setStoredPushEnabled(false);
    setEnabled(false);
    subscribedRef.current = false;
    return unsubscribeAndRemove();
  }, []);

  return { requestPush, disablePush, isSupported, permission, enabled };
}
