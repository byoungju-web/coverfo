/* coverfo 쇼핑 — 제휴 ID 알려 주기 (GET /api/shop-ids)
   · 검색어를 받지 않는다. 받는 것도 저장하는 것도 없음 — 브라우저가 링크에 붙일 "공개 ID" 만 돌려준다.
   · ID 는 Cloudflare Pages → Settings → Variables and Secrets 에 넣었을 때만 켜진다. 없으면 빈 값 → 딥링크만.
       AMAZON_TAGS  : 아마존 어소시에이트 태그. "나라:태그" 를 쉼표로 (예: US:coverfo-20,JP:coverfo-22)
       BOOKING_AID  : Booking.com 제휴 숫자 ID (예: 1234567)
       COUPANG_ACCESS_KEY + COUPANG_SECRET_KEY : 쿠팡 파트너스 API 키 (값은 절대 내보내지 않고 "켜짐" 여부만)
       KAKAO_REST_KEY : 카카오 REST API 키 — 길안내 좌표용(/api/geo). 값은 내보내지 않고 "켜짐" 여부만
       DOORDASH_AFF_LINK · UBEREATS_AFF_LINK · GRAB_AFF_LINK : 배달 제휴 가입 후 받은 제휴 링크(https 로 시작).
         링크 안에 {url} 을 넣으면 그 자리에 실제 검색 주소가 들어가고, 없으면 받은 링크를 그대로 연다.
       TRAINLINE_AFF_LINK · TWELVEGO_AFF_LINK : Trainline·12Go 제휴 가입 후 받은 제휴 링크(https) — 기차 화면 버튼에 쓰인다({url} 규칙 같음)
       SKYSCANNER_AFF_LINK · EXPEDIA_AFF_LINK : Skyscanner·Expedia 제휴 가입 후 받은 제휴 링크(https) — 항공권 화면 버튼에 쓰인다({url} 규칙 같음)
       EBAY_AFF_LINK : eBay Partner Network 가입 후 만든 제휴 링크(https) — 중고거래 화면 eBay 버튼에 쓰인다({url} 규칙 같음)
       COUPANG_AFF_LINK : 쿠팡 파트너스 사이트에서 만든 링크(https://link.coupang.com/a/… ) — 기능종류 쇼핑 카드의 쿠팡 배너가 이 링크로 열린다(v207)
       UBER_AFF_LINK : Uber 제휴 가입 후 받은 제휴 링크(https) — 택시 화면 Uber 버튼에 쓰인다({url} 규칙 같음). GRAB_AFF_LINK 는 배달·택시 화면 Grab 버튼에 함께 쓰인다
       KLOOK_AID : Klook 제휴(Affiliate) 가입 후 받은 aid 값 — 가볼만한곳 화면의 Klook 링크에 aid= 로 붙는다
       KKDAY_CID : KKday 제휴(KKpartners) 가입 후 받은 cid 값 — 가볼만한곳 화면의 KKday 링크에 cid= 로 붙는다
   · 결제는 각 쇼핑몰에서 이용자가 직접 — coverfo 는 링크만 연결한다. */
const CC = /^[A-Z]{2}$/;

function affLink(v) {
  const s = String(v || '').trim();
  return /^https:\/\/[^\s"'<>]{4,500}$/.test(s) ? s : '';
}

function pubId(v) {
  const s = String(v || '').trim();
  return /^[A-Za-z0-9_-]{2,40}$/.test(s) ? s : '';
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
    klook: pubId(env.KLOOK_AID),
    kkday: pubId(env.KKDAY_CID),
    dl: { coupang: affLink(env.COUPANG_AFF_LINK), doordash: affLink(env.DOORDASH_AFF_LINK), ubereats: affLink(env.UBEREATS_AFF_LINK), grab: affLink(env.GRAB_AFF_LINK), uber: affLink(env.UBER_AFF_LINK), trainline: affLink(env.TRAINLINE_AFF_LINK), twelvego: affLink(env.TWELVEGO_AFF_LINK), skyscanner: affLink(env.SKYSCANNER_AFF_LINK), expedia: affLink(env.EXPEDIA_AFF_LINK), ebay: affLink(env.EBAY_AFF_LINK) },
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
