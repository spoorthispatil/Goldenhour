/* GoldenHour push service worker: shows campaign notifications from the server. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'GoldenHour';
  const options = {
    body: payload.body || 'A hospital published a donation campaign.',
    tag: payload.tag || undefined,
    data: { url: payload.url || '/patient/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/patient/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.focus();
          return client.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
