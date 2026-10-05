/* coverfo 길안내 — 도착지 이름 → 좌표 (GET /api/geo?q=강남역)
   · 카카오 공식 "키워드로 장소 검색" API(dapi.kakao.com/v2/local/search/keyword.json)를 쓴다. 크롤링 아님.
   · Cloudflare Secret KAKAO_REST_KEY 를 넣었을 때만 동작. 없으면 {ok:false} → 브라우저는 지금처럼 장소 검색으로 연다.
   · 받는 것은 도착지 이름 하나(100자까지). 저장·기록(로그)하지 않는다. 개인정보가 섞인 문장은 브라우저(cf-quick.js)에서 먼저 막혀 여기까지 오지 않는다.
   · 돌려주는 것: 장소 이름·위도·경도 하나. 길안내는 카카오맵·네이버지도 앱이 한다(coverfo 는 위치를 받지 않음). */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequestGet({ request, env }) {
  const key = String(env.KAKAO_REST_KEY || '').trim();
  if (!key) return json({ ok: false, reason: 'no-key' });

  /* coverfo 화면에서 온 요청만 (다른 사이트가 이 주소로 우리 키를 빌려 쓰지 못하게). 주소창에서 직접 열면 Origin 이 없어 시험용으로 열린다 */
  const origin = request.headers.get('Origin') || '';
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).hostname; } catch (e) {}
    if (!(oh === 'coverfo.com' || oh.endsWith('.coverfo.com') || oh.endsWith('.pages.dev'))) return json({ ok: false }, 403);
  }

  const q = String(new URL(request.url).searchParams.get('q') || '').trim().slice(0, 100);
  if (!q) return json({ ok: false }, 400);

  try {
    const r = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent(q), {
      headers: { Authorization: 'KakaoAK ' + key },
    });
    if (!r.ok) return json({ ok: false, status: r.status });
    const j = await r.json().catch(() => null);
    const d = j && Array.isArray(j.documents) ? j.documents[0] : null;
    if (!d || !d.y || !d.x) return json({ ok: false, reason: 'not-found' });
    return json({ ok: true, name: String(d.place_name || q), lat: Number(d.y), lng: Number(d.x) });
  } catch (e) {
    return json({ ok: false });
  }
}
