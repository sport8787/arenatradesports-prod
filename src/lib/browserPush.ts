// Helpers para notificações push do navegador (Web Notifications API)

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getPushPermission(): PushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PushPermission;
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission as PushPermission;
  }
  const result = await Notification.requestPermission();
  return result as PushPermission;
}

export function showBrowserPush(title: string, body: string, opts?: { tag?: string; url?: string }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      tag: opts?.tag,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
    if (opts?.url) {
      n.onclick = () => {
        window.focus();
        window.location.href = opts.url!;
        n.close();
      };
    }
  } catch (e) {
    console.warn('Browser push falhou:', e);
  }
}
