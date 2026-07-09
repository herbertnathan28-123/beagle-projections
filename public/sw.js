// Beagle Fuel Calculator — service worker.
// Receives server web-push and shows a system notification on this device even
// when the calculator (and Discord) are closed. iOS/iPadOS only delivers web
// push to pages installed to the Home Screen.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Beagle Fuel Alert', {
    body: d.body || '',
    tag: d.tag || undefined,
  }));
});

// Tapping the notification focuses an open calculator tab, or opens one.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if (w.url.includes('/fuel-calculator') && 'focus' in w) return w.focus(); }
    return clients.openWindow('/fuel-calculator');
  }));
});
