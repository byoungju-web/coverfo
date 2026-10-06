/* coverfo 쇼핑 — 제휴 ID 알려 주기 (GET /api/shop-ids)
   · 검색어를 받지 않는다. 받는 것도 저장하는 것도 없음 — 브라우저가 링크에 붙일 "공개 ID" 만 돌려준다.
   · ID 는 Cloudflare Pages → Settings → Variables and Secrets 에 넣었을 때만 켜진다. 없으면 빈 값 → 딥링크만.
       AMAZON_TAGS  : 아마존 어소시에이트 태그. "나라:태그" 를 쉼표로 (예: US:coverfo-20,JP:coverfo-22)
       BOOKING_AID  : Booking.com 제휴 숫자 ID (예: 1234567)
       COUPANG_ACCESS_KEY + COUPANG_SECRET_KEY : 쿠팡 파트너스 API 키 (값은 절대 내보내지 않고 "켜짐" 여부만)
       KAKAO_REST_KEY : 카카오 REST API 키 — 길안내 좌표용(/api/geo). 값은 내보내지 않고 "켜짐" 여부만
       DOORDASH_AFF_LINK · UBEREATS_AFF_LINK · GRAB_AFF_LINK : 배달 제휴 가입 후 받은 제휴 링크(https 로 시작).
         링크 안에 {url} 을 넣으면 그 자리에 실제 검색 주소가 들어가고, 없으면 받은 링크를 그대로 연다.
   · 결제는 각 쇼핑몰에서 이용자가 직접 — coverfo 는 링크만 연결한다. */
const CC = /^[A-Z]{2}$/;

function affLink(v) {
  const s = String(v || '').trim();
  return /^https:\/\/[^\s"'<>]{4,500}$/.test(s) ? s : '';
}

function amazonTags(env) {
  const out = {};
  const raw = String(env.AMAZON_TAGS || '').trim();
  raw.split(',').forEach((pair) => {
    const m = pair.trim().match(/^([A-Za-z]{2})\s*:\s*([A-Za-z0-9\-_]{2,40})$/);
    if (m && CC.test(m[1].toUpperCase())) out[m[1].toUpperCase()] = m[2];
  });
  return out;
}

export async function onRequestGet({ env }) {
  const booking = String(env.BOOKING_AID || '').trim();
  const body = {
    amazon: amazonTags(env),
    booking: /^[0-9]{3,12}$/.test(booking) ? booking : '',
    coupang: !!(env.COUPANG_ACCESS_KEY && env.COUPANG_SECRET_KEY),
    geo: !!String(env.KAKAO_REST_KEY || '').trim(),
    dl: { doordash: affLink(env.DOORDASH_AFF_LINK), ubereats: affLink(env.UBEREATS_AFF_LINK), grab: affLink(env.GRAB_AFF_LINK) },
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
