// functions/api/call-find.js — coverfo 📞 AI 전화 걸기 · 전화할 가게 찾기 (v488)
// © 2026 coverfo All Rights Reserved
//
// GET /api/call-find?q=홍대 삼겹살&x=&y=
//   q   : 가게·지역 이름 (60자까지)  · x,y : 경도·위도 (📍 내 위치를 눌렀을 때만, 있으면 가까운 순)
//   → { ok, items:[{ id, name, cat, phone, addr, dist, url, x, y }], total }
//
// · 카카오 공식 "키워드로 장소 검색" API(dapi.kakao.com/v2/local/search/keyword.json) — 크롤링 아님.
//   키: Cloudflare Secret KAKAO_REST_KEY (길안내 /api/geo 와 같은 키)
// · 카카오에 공개된 가게 전화번호만 돌려준다 (번호 없는 가게는 뒤로 · 최대 6곳)
// · 별점·대기시간은 카카오 API 에 없어 만들어 넣지 않는다
// · coverfo 화면에서 온 요청만 받는다 (geo.js 와 같은 방식) · 검색어·위치는 저장·기록하지 않는다 · 크레딧·결제와 무관

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequestGet({ request, env }) {
  const key = String(env.KAKAO_REST_KEY || '').trim();
  if (!key) return json({ ok: false, error: '가게 찾기 설정이 아직 없어요 (KAKAO_REST_KEY)' }, 500);

  const origin = request.headers.get('Origin') || '';
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).hostname; } catch (e) {}
    if (!(oh === 'coverfo.com' || oh.endsWith('.coverfo.com') || oh.endsWith('.pages.dev'))) return json({ ok: false }, 403);
  }

  const sp = new URL(request.url).searchParams;
  const q = String(sp.get('q') || '').replace(/[<>"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!q) return json({ ok: false, need: 'q', error: '어느 가게인지 알려 주세요 (예: 홍대 삼겹살)' }, 400);
  const x = +sp.get('x'), y = +sp.get('y');
  const near = isFinite(x) && isFinite(y) && x > 124 && x < 132 && y > 33 && y < 39.5;

  let u = 'https://dapi.kakao.com/v2/local/search/keyword.json?size=15&query=' + encodeURIComponent(q);
  if (near) u += '&x=' + x + '&y=' + y + '&radius=5000&sort=distance';

  try {
    const r = await fetch(u, { headers: { Authorization: 'KakaoAK ' + key } });
    if (!r.ok) return json({ ok: false, error: '가게를 찾지 못했어요 (카카오 ' + r.status + ')' }, 502);
    const d = await r.json().catch(() => ({}));
    const docs = Array.isArray(d && d.documents) ? d.documents : [];
    const all = docs.map((o) => ({
      id: String(o.id || ''),
      name: String(o.place_name || '').slice(0, 60),
      cat: String(o.category_name || '').split('>').map((s) => s.trim()).filter(Boolean).slice(-2).join(' · ').slice(0, 40),
      phone: String(o.phone || '').replace(/[^0-9\-]/g, '').slice(0, 20),
      addr: String(o.road_address_name || o.address_name || '').slice(0, 80),
      dist: o.distance ? +o.distance : null,
      url: /^https?:\/\/place\.map\.kakao\.com\//.test(String(o.place_url || '')) ? String(o.place_url).replace(/^http:/, 'https:') : '',
      x: +o.x || null, y: +o.y || null,
    })).filter((o) => o.name);
    const withPhone = all.filter((o) => o.phone), noPhone = all.filter((o) => !o.phone);
    const items = withPhone.concat(noPhone).slice(0, 6);
    return json({ ok: true, q, near, items, total: withPhone.length });
  } catch (e) {
    return json({ ok: false, error: '가게 찾기 중 오류가 났어요' }, 502);
  }
}
