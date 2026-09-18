// coverfo Service Worker — 캐시 버전을 올려야 변경사항이 반영됩니다
const CACHE_VERSION = 'coverfo-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// 설치: 캐시에 기본 파일 저장
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // 새 SW를 바로 활성화
      return self.skipWaiting();
    })
  );
});

// 활성화: 이전 버전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // 열린 탭에 즉시 적용
      return self.clients.claim();
    })
  );
});

// 요청 가로채기: 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  // POST 등 캐시 불가 요청은 그냥 통과
  if (event.request.method !== 'GET') return;

  // API·외부 요청은 캐시하지 않음
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공하면 캐시에 복사 후 반환
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 꺼내줌
        return caches.match(event.request);
      })
  );
});
