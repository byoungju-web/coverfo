/* coverfo 쇼핑 — 모델번호로 상품 페이지 바로 찾기 (GET /api/shop-find?m=모델번호&c=색상)
   · "필립스 TAT1109 화이트 결제 화면 보여줘" 처럼 모델번호가 있는 명령에서만 불린다.
     찾으면 그 상품 페이지 주소를 돌려준다 → 이용자가 옵션 확인 후 '구매하기' 를 누르면 그 쇼핑몰의 결제 화면.
   · 공식 API 만 쓴다 (크롤링 없음). 키는 Cloudflare Pages → Settings → Variables and Secrets 에 "Secret" 으로:
       NAVER_CLIENT_ID + NAVER_CLIENT_SECRET : 네이버 개발자센터 '검색' API (쇼핑 검색)
       COUPANG_ACCESS_KEY + COUPANG_SECRET_KEY : 쿠팡 파트너스 Open API (상품 검색) — 쿠팡 링크 바꾸기(/api/shop-link)와 같은 키
     키가 하나도 없으면 {ok:false, why:"nokey"} → 브라우저는 지금처럼 쇼핑 검색 화면을 연다.
   · 상품 이름에 모델번호가 '그대로' 들어 있는 것만 고른다 (비슷한 다른 상품을 열지 않게). 없으면 {ok:false}.
   · 받은 모델번호·색상은 찾는 데만 쓰고 저장·기록(로그)하지 않는다. 개인정보 형식 검사는 브라우저(cf-quick.js)에서 먼저 한다.
   · coverfo 는 판매·결제를 하지 않는다. 결제는 그 쇼핑몰에서 이용자가 직접. */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const norm = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/[\s\-_/.()[\]]/g, '').toLowerCase();
const plain = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
/* 색상 낱말 (영어 표기도 같은 색으로 본다) */
const COLORS = { 화이트: ['화이트', '흰색', 'white'], 블랙: ['블랙', '검정', 'black'], 실버: ['실버', '은색', 'silver'], 그레이: ['그레이', '회색', 'gray', 'grey'],
  네이비: ['네이비', 'navy'], 블루: ['블루', '파랑', 'blue'], 핑크: ['핑크', '분홍', 'pink'], 레드: ['레드', '빨강', 'red'], 그린: ['그린', '초록', 'green'],
  베이지: ['베이지', 'beige'], 퍼플: ['퍼플', '보라', 'purple'], 골드: ['골드', '금색', 'gold'], 옐로우: ['옐로우', '노랑', 'yellow'] };
function colorWords(c) {
  const n = norm(c);
  for (const k in COLORS) if (COLORS[k].some((w) => n.indexOf(norm(w)) >= 0)) return COLORS[k];
  return null;
}
const hasColor = (title, cw) => !!(cw && cw.some((w) => norm(title).indexOf(norm(w)) >= 0));

/* ── 네이버 쇼핑 검색 API (openapi.naver.com/v1/search/shop.json) ──
   productType 2·3 = 쇼핑몰의 실제 상품 페이지(구매하기 → 결제). 1 = 가격비교 묶음, 4~12 = 중고·단종·판매예정 → 쓰지 않음.
   search.shopping.naver.com 주소는 로그인하지 않으면 로그인·보안확인 화면으로 돌려보냄이 실측으로 확인돼(2026-10-05) 맨 뒤로 미룬다. */
async function naver(env, m, cw) {
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) return null;
  const r = await fetch('https://openapi.naver.com/v1/search/shop.json?display=40&sort=sim&query=' + encodeURIComponent(m), {
    headers: { 'X-Naver-Client-Id': env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET },
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !Array.isArray(j.items)) return null;
  const nm = norm(m);
  const list = j.items.filter((it) => {
    const t = String(it.productType || '');
    return (t === '2' || t === '3') && norm(it.title).indexOf(nm) >= 0 && /^https:\/\//i.test(String(it.link || ''));
  }).map((it) => {
    let host = '';
    try { host = new URL(it.link).hostname; } catch (e) {}
    return { url: it.link, title: plain(it.title), price: parseInt(it.lprice, 10) || 0, mall: plain(it.mallName), color: hasColor(it.title, cw), gate: /(^|\.)search\.shopping\.naver\.com$/i.test(host) };
  });
  if (!list.length) return null;
  /* 색상 맞는 것 → 로그인 화면으로 갈 수 있는 주소는 뒤로 → 가격 낮은 순 */
  list.sort((a, b) => (b.color - a.color) || (a.gate - b.gate) || ((a.price || 9e15) - (b.price || 9e15)));
  return Object.assign({ src: 'naver', aff: false }, list[0]);
}

/* ── 쿠팡 파트너스 Open API 상품 검색 ──
   서명 규격은 /api/shop-link 와 같다: yyMMdd'T'HHmmss'Z' + 메서드 + 경로 + 쿼리 를 HMAC-SHA256.
   돌려받는 productUrl 은 파트너스 링크(수수료) → 브라우저가 제휴 표시를 먼저 보여 준 뒤 연다. */
function signedDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return String(d.getUTCFullYear()).slice(2) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
}
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function coupang(env, m, cw) {
  if (!env.COUPANG_ACCESS_KEY || !env.COUPANG_SECRET_KEY) return null;
  const path = '/v2/providers/affiliate_open_api/apis/openapi/products/search';
  const query = 'keyword=' + encodeURIComponent(m) + '&limit=20';
  const date = signedDate();
  const signature = await hmacHex(env.COUPANG_SECRET_KEY, date + 'GET' + path + query);
  const auth = `CEA algorithm=HmacSHA256, access-key=${env.COUPANG_ACCESS_KEY}, signed-date=${date}, signature=${signature}`;
  const r = await fetch('https://api-gateway.coupang.com' + path + '?' + query, { headers: { Authorization: auth, 'Content-Type': 'application/json;charset=UTF-8' } });
  const j = await r.json().catch(() => null);
  const arr = j && j.data && Array.isArray(j.data.productData) ? j.data.productData : null;
  if (!r.ok || !arr) return null;
  const nm = norm(m);
  const list = arr.filter((p) => norm(p.productName).indexOf(nm) >= 0 && /^https:\/\/([a-z0-9-]+\.)*coupang\.com\//i.test(String(p.productUrl || '')))
    .map((p) => ({ url: p.productUrl, title: plain(p.productName), price: parseInt(p.productPrice, 10) || 0, mall: p.isRocket ? '쿠팡 로켓배송' : '쿠팡', color: hasColor(p.productName, cw) }));
  if (!list.length) return null;
  list.sort((a, b) => (b.color - a.color) || ((a.price || 9e15) - (b.price || 9e15)));
  return Object.assign({ src: 'coupang', aff: true }, list[0]);
}

export async function onRequestGet({ request, env }) {
  /* coverfo 화면에서 온 요청만 (다른 사이트가 이 주소를 빌려 쓰지 못하게) — /api/shop-link 와 같은 규칙 */
  const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).hostname; } catch (e) {}
    if (!(oh === 'coverfo.com' || oh.endsWith('.coverfo.com') || oh.endsWith('.pages.dev') || oh === 'localhost' || oh === '127.0.0.1')) return json({ ok: false, why: 'origin' }, 403);
  }
  const sp = new URL(request.url).searchParams;
  const m = String(sp.get('m') || '').trim();
  const cw = colorWords(String(sp.get('c') || ''));
  /* 모델번호: 영문+숫자가 섞인 4~20자 (예: TAT1109, WH-1000XM5) */
  if (!/^(?=.*\d)(?=.*[a-z])[a-z0-9-]{4,20}$/i.test(m)) return json({ ok: false, why: 'model' }, 400);
  const hasN = !!(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET), hasC = !!(env.COUPANG_ACCESS_KEY && env.COUPANG_SECRET_KEY);
  if (!hasN && !hasC) return json({ ok: false, why: 'nokey' });

  const safe = (p) => p.catch(() => null);
  const [nv, cp] = await Promise.all([safe(naver(env, m, cw)), safe(coupang(env, m, cw))]);
  /* 고르는 순서: 네이버 실제 상품(로그인 화면 아님) → 쿠팡 → 네이버(search.shopping 주소). 색상 맞는 쪽을 먼저 */
  const cand = [nv && !nv.gate ? nv : null, cp, nv && nv.gate ? nv : null].filter(Boolean);
  cand.sort((a, b) => (b.color - a.color));
  const best = cand[0];
  if (!best) return json({ ok: false, why: 'nomatch', keys: { naver: hasN, coupang: hasC } });
  return json({ ok: true, url: best.url, src: best.src, aff: best.aff, title: best.title.slice(0, 120), price: best.price, mall: best.mall, color: !!best.color });
}
