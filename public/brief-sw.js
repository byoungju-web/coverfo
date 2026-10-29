// coverfo ☀️ 아침 브리핑 알림 전용 Service Worker (v284)
// · coverfo.com/brief 페이지에서만 등록한다 (scope '/brief'). 캐시·네트워크는 건드리지 않고 알림만 맡는다.
// · 서버(/api/hub)가 보낸 웹 알림을 띄우고, 누르면 coverfo.com/brief?play=1 을 연다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = { title: '☀️ 오늘 아침 브리핑', body: '눌러서 2분 브리핑 듣기', url: '/brief?play=1' };
  try { d = Object.assign(d, event.data ? event.data.json() : {}); } catch (e) { if (event.data) d.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: '/coverfo-icon-192.png',
    badge: '/coverfo-icon-192.png',
    tag: 'coverfo-brief',
    renotify: true,
    data: { url: d.url || '/brief' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/brief', self.location.origin);
  if (target.origin !== self.location.origin) return;   /* coverfo 주소만 연다 */
  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && 'navigate' in w) {
        await w.focus();
        try { await w.navigate(target.href); } catch (e) {}
        return;
      }
    }
    await clients.openWindow(target.href);
  })());
});
