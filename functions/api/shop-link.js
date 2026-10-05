/* coverfo 쇼핑 — 쿠팡 파트너스 링크로 바꾸기 (POST /api/shop-link  {url})
   · 쿠팡 파트너스 키(COUPANG_ACCESS_KEY·COUPANG_SECRET_KEY)를 Secret 에 넣었을 때만 쓰인다. 키가 없으면 브라우저가 이 주소를 부르지 않는다.
   · 쿠팡 공식 "딥링크 API" 로 쿠팡 주소 → 파트너스 링크(link.coupang.com) 로 바꿔 돌려준다. 크롤링 아님.
   · 받은 주소는 바꾸는 데만 쓰고 저장·기록(로그)하지 않는다. 쿠팡 주소(coupang.com) 말고는 받지 않는다.
   · 실패하면 {url:""} → 브라우저가 원래 쿠팡 검색 주소(딥링크)를 그대로 연다. */
const HOST = /^(www\.|m\.)?coupang\.com$/i;
const API_HOST = 'https://api-gateway.coupang.com';
const API_PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function signedDate() {
  /* 쿠팡 규격: yyMMdd'T'HHmmss'Z' (UTC) */
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return String(d.getUTCFullYear()).slice(2) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  if (!env.COUPANG_ACCESS_KEY || !env.COUPANG_SECRET_KEY) return json({ url: '' });

  /* coverfo 화면에서 온 요청만 (다른 사이트가 이 주소를 빌려 쓰지 못하게) */
  const origin = request.headers.get('Origin') || '';
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).hostname; } catch (e) {}
    if (!(oh === 'coverfo.com' || oh.endsWith('.coverfo.com') || oh.endsWith('.pages.dev'))) return json({ url: '' }, 403);
  }

  let url = '';
  try { url = String((await request.json()).url || ''); } catch (e) {}
  if (!url || url.length > 600) return json({ url: '' }, 400);
  let u;
  try { u = new URL(url); } catch (e) { return json({ url: '' }, 400); }
  if (u.protocol !== 'https:' || !HOST.test(u.hostname)) return json({ url: '' }, 400);

  try {
    const date = signedDate();
    const signature = await hmacHex(env.COUPANG_SECRET_KEY, date + 'POST' + API_PATH);
    const auth = `CEA algorithm=HmacSHA256, access-key=${env.COUPANG_ACCESS_KEY}, signed-date=${date}, signature=${signature}`;
    const r = await fetch(API_HOST + API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8', Authorization: auth },
      body: JSON.stringify({ coupangUrls: [u.toString()] }),
    });
    const j = await r.json().catch(() => null);
    const d = j && Array.isArray(j.data) ? j.data[0] : null;
    const link = d && (d.shortenUrl || d.landingUrl);
    if (!r.ok || !link || !/^https:\/\/([a-z0-9-]+\.)*coupang\.com\//i.test(link)) return json({ url: '' });
    return json({ url: link });
  } catch (e) {
    return json({ url: '' });
  }
}
