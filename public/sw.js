// Service Worker - Web Push Notifications (GREEN/RED + APROVADO)
self.addEventListener('install', (event) => {
  // Evita takeover imediato da página aberta, que pode parecer um refresh visual.
  // A nova versão do SW assume no próximo ciclo natural.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.resolve());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Oráculo Mycroft', body: event.data ? event.data.text() : 'Nova notificação' };
  }

  const title = data.title || '🎯 Oráculo Mycroft';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'mycroft-push',
    requireInteraction: data.requireInteraction !== false,
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
