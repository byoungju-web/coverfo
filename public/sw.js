// coverfo Service Worker — 캐시 버전을 올려야 변경사항이 반영됩니다
const CACHE_VERSION = 'coverfo-v492';

const PRECACHE_URLS = [
  '/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    }).catch(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // v447: 영상·결과 파일(/media/…)과 구간(Range) 요청은 서비스워커를 거치지 않고 브라우저가 직접 받음
  //       (영상 재생은 조각(206)으로 받는데, 캐시는 조각 응답을 저장할 수 없음 · 큰 영상까지 캐시에 쌓이지 않게)
  if (url.pathname.indexOf('/media/') === 0 || event.request.headers.has('range')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
