// functions/api/near.js — coverfo ⛽ 근처 주유소(가격) · 🅿️ 근처 주차장 (v384 · v386 위치 꼭 보여 주기)
// © 2026 coverfo All Rights Reserved
//
// POST /api/near   (Authorization: Bearer coverfo 로그인키)
//   { op:"gas",  x?, y? | region?, fuel?: B027 휘발유 | D047 경유 | B034 고급휘발유 | K015 LPG, sort?: price | dist, label? }
//   { op:"park", x?, y? | region?, label? }
//   x·y = 경도·위도 (휴대폰 위치 또는 축제·캠핑장 카드 좌표) · 없으면 region(지역·장소 이름)을 카카오로 찾음
//   → { ok, op, label, items:[{ id, name, brand, price, dist, x, y, addr, tel, kind, url }], src, fuel, sort, priceless? }
//
// · ⛽ 가격: 한국석유공사 오피넷 무료 API (반경 내 주유소 aroundAll.do · 반경 최대 5km · KATEC 좌표)
//   Cloudflare 비밀값 OPINET_KEY (opinet.co.kr → 유가정보 API → 무료 API 이용신청으로 받은 인증키)
//   키가 없거나 오피넷이 안 되면: 카카오 장소(주유소·충전소 OL7)로 위치만 보여 주고 priceless:true
// · 🅿️ 주차장: 카카오 로컬 카테고리 검색 PK6 (KAKAO_REST_KEY, 장소 목록과 같은 키) · 반경 1km(지역 이름이면 2km)
// · v386: 오피넷이 0곳·오류면 카카오 위치로 대신 보여 주고 diag(응답 앞부분, 키는 가림)를 돌려줌 · 빈 결과는 캐시하지 않음
// · 같은 검색은 10분(주유소)·6시간(주차장) 캐시 · 이용자 정보는 보내지 않음 · 결제와 무관

const FUEL = { B027: '휘발유', D047: '경유', B034: '고급휘발유', K015: 'LPG' };
const BRAND = { SKE: 'SK에너지', GSC: 'GS칼텍스', HDO: 'HD현대오일뱅크', SOL: 'S-OIL', RTE: '자영알뜰', RTO: '알뜰', RTX: '고속도로알뜰', NHO: '농협알뜰', ETC: '자가상표', E1G: 'E1', SKG: 'SK가스' };

export async function onRequestPost(context) {
  const env = context.env || {};
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  if (!(await userId(context.request, env))) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const op = String(b.op || '');
  if (op !== 'gas' && op !== 'park') return json({ error: '잘못된 요청입니다' }, 400);
  try {
    let at = null, label = clean(b.label, 40);
    const x = +b.x, y = +b.y;
    if (isFinite(x) && isFinite(y) && x > 124 && x < 132 && y > 33 && y < 39.5) at = { x, y };
    else {
      const region = clean(b.region, 40);
      if (!region) return json({ ok: false, need: 'where', note: '어디 근처인지 알려 주세요 (예: 강남역, 가평) · 또는 📍 내 위치' });
      at = await find(env, region);
      if (!at) return json({ ok: false, notFound: true, note: '"' + region + '"을(를) 찾지 못했어요' });
      if (!label) label = region;
    }
    if (op === 'park') {
      const items = await kakaoCat(env, 'PK6', at, at.wide ? 2000 : 1000, 'park');
      return json({ ok: true, op, label: label || '내 위치', items, src: '카카오 장소' });
    }
    const fuel = FUEL[b.fuel] ? b.fuel : 'B027', sort = b.sort === 'dist' ? 'dist' : 'price';
    const key = String(env.OPINET_KEY || '').trim();
    let items = null, why = '';
    let diag;
    if (key) {
      const r = await opinet(key, at, fuel, sort);
      if (r.ok && r.items.length) items = r.items; else { why = r.ok ? 'empty' : r.why; diag = r.diag; }
    } else why = 'nokey';
    /* v386: 오피넷이 0곳이거나 안 되면 카카오 장소(주유소·충전소)로 위치는 꼭 보여 준다 */
    if (!items) {
      const k = await kakaoCat(env, 'OL7', at, 3000, 'gas');
      return json({ ok: true, op, label: label || '내 위치', items: k, src: '카카오 장소', fuel, sort: 'dist', priceless: true, why, diag });
    }
    return json({ ok: true, op, label: label || '내 위치', items, src: '한국석유공사 오피넷', fuel, sort });
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    return json({ error: String((e && e.message) || e).slice(0, 200) }, 502);
  }
}

/* ── ⛽ 오피넷 반경 내 주유소 (가격순·거리순) ── */
async function opinet(key, at, fuel, sort) {
  const [kx, ky] = toKatec(at.x, at.y);
  const q = new URLSearchParams({ out: 'json', x: kx.toFixed(1), y: ky.toFixed(1), radius: '5000', prodcd: fuel, sort: sort === 'dist' ? '2' : '1' });
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const ck = new Request('https://cache.coverfo.com/opinet/' + q.toString().replace(/x=(\d+)\d\d\.\d/, 'x=$1').replace(/y=(\d+)\d\d\.\d/, 'y=$1'));
  if (cache) { const h = await cache.match(ck).catch(() => null); if (h) { const j = await h.json().catch(() => null); if (j) return { ok: true, items: j }; } }
  let t;
  /* 진단(가격이 안 나올 때 화면 아래 작은 글씨): 응답 앞부분만 · 인증키는 *** 로 가림 */
  const peek = (s) => String(s || '').replace(/\s+/g, ' ').split(key).join('***').slice(0, 160);
  try { const r = await fetch('https://www.opinet.co.kr/api/aroundAll.do?certkey=' + encodeURIComponent(key) + '&' + q.toString()); t = await r.text(); if (!r.ok) return { ok: false, why: 'http' + r.status, diag: peek(t) }; } catch (e) { return { ok: false, why: 'net', diag: String((e && e.message) || e).slice(0, 100) }; }
  let d; try { d = JSON.parse(t.replace(/^\uFEFF/, '')); } catch { return { ok: false, why: /인증|cert|key/i.test(t) ? 'key' : 'format', diag: peek(t) }; }
  /* 칸 이름 대·소문자가 달라도 찾기 (RESULT.OIL / result.oil) */
  const get = (o, k) => { if (!o || typeof o !== 'object') return undefined; const f = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase()); return f ? o[f] : undefined; };
  let list = get(get(d, 'RESULT'), 'OIL');
  if (list == null) return { ok: false, why: 'format', diag: peek(t) };
  if (!Array.isArray(list)) list = [list];
  const num = (v) => parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  const items = list.slice(0, 20).map((o) => {
    const gx = num(get(o, 'GIS_X_COOR')), gy = num(get(o, 'GIS_Y_COOR'));
    const g = isFinite(gx) && isFinite(gy) && gx > 0 ? fromKatec(gx, gy) : null, bc = String(get(o, 'POLL_DIV_CO') || get(o, 'POLL_DIV_CD') || '');
    return { id: String(get(o, 'UNI_ID') || ''), name: clean(get(o, 'OS_NM'), 40), brand: BRAND[bc] || '', price: Math.round(num(get(o, 'PRICE'))) || 0, dist: Math.round(num(get(o, 'DISTANCE'))) || 0, x: g ? +g.lon.toFixed(6) : 0, y: g ? +g.lat.toFixed(6) : 0, addr: '', tel: '', kind: '', url: '' };
  }).filter((x) => x.name && x.price > 0);
  if (!items.length) return { ok: true, items, diag: 'n=' + list.length + ' · ' + peek(t) };
  if (cache) { try { await cache.put(ck, new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' } })); } catch {} }
  return { ok: true, items };
}

/* ── 카카오 장소 카테고리 (PK6 주차장 · OL7 주유소·충전소) 가까운 순 ── */
async function kakaoCat(env, code, at, radius, tag) {
  const kk = String(env.KAKAO_REST_KEY || '').trim();
  if (!kk) throw httpErr(500, '장소 찾기 설정이 아직 없어요 (KAKAO_REST_KEY)');
  const q = new URLSearchParams({ category_group_code: code, x: String(at.x), y: String(at.y), radius: String(radius), sort: 'distance', size: '15' });
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const ck = new Request('https://cache.coverfo.com/kcat/' + code + '/' + (+at.x).toFixed(3) + ',' + (+at.y).toFixed(3) + '/' + radius);
  if (cache) { const h = await cache.match(ck).catch(() => null); if (h) { const j = await h.json().catch(() => null); if (j) return j; } }
  const r = await fetch('https://dapi.kakao.com/v2/local/search/category.json?' + q.toString(), { headers: { Authorization: 'KakaoAK ' + kk } });
  if (!r.ok) throw httpErr(502, '장소를 찾지 못했어요 (카카오 ' + r.status + ')');
  const d = await r.json().catch(() => ({}));
  const items = (Array.isArray(d.documents) ? d.documents : []).map((p) => {
    const cats = String(p.category_name || '').split('>').map((s) => s.trim()).filter(Boolean);
    let kind = cats[cats.length - 1] || '';
    if (tag === 'park' && kind === '주차장') kind = '';
    return { id: String(p.id || ''), name: clean(p.place_name, 40), brand: '', price: 0, dist: +p.distance || 0, x: +p.x || 0, y: +p.y || 0, addr: clean(p.road_address_name || p.address_name, 80), tel: clean(p.phone, 20), kind: clean(kind, 20), url: /^https?:\/\/place\.map\.kakao\.com\//.test(String(p.place_url || '')) ? String(p.place_url).replace(/^http:/, 'https:') : '' };
  }).filter((x) => x.name);
  if (cache) { try { await cache.put(ck, new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + (tag === 'park' ? 21600 : 600) } })); } catch {} }
  return items;
}

/* ── 지역·장소 이름 → 좌표 (카카오 키워드 · 시·도/시·군 이름이면 넓게) ── */
async function find(env, region) {
  const kk = String(env.KAKAO_REST_KEY || '').trim();
  if (!kk) throw httpErr(500, '지역 찾기 설정이 아직 없어요 (KAKAO_REST_KEY)');
  const res = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent(region), { headers: { Authorization: 'KakaoAK ' + kk } });
  if (!res.ok) throw httpErr(502, '지역을 찾지 못했어요 (카카오 ' + res.status + ')');
  const d = await res.json().catch(() => ({}));
  const doc = d && Array.isArray(d.documents) ? d.documents[0] : null;
  if (!doc || !+doc.x || !+doc.y) return null;
  return { x: +doc.x, y: +doc.y, wide: /^[가-힣]{1,6}(시|군|구|도)$|^[가-힣]{1,2}$/.test(region.trim()) };   /* "가평"·"속초시"처럼 도시 이름이면 넓게 · "강남역" 같은 장소는 1km */
}

/* ── KATEC (오피넷 좌표) ↔ WGS84 (카카오·휴대폰 위경도)
   +proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel
   +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 (위치 벡터 방식) ── */
const D2R = Math.PI / 180, AS = Math.PI / 180 / 3600;
const WGS = { a: 6378137, f: 1 / 298.257223563 }, BES = { a: 6377397.155, f: 1 / 299.1528128 };
const H = { dx: -115.80, dy: 474.99, dz: 674.11, rx: 1.16 * AS, ry: -2.31 * AS, rz: -1.63 * AS, s: 6.43e-6 };
function toEcef(lat, lon, e) { const e2 = e.f * (2 - e.f), s = Math.sin(lat), N = e.a / Math.sqrt(1 - e2 * s * s); return [N * Math.cos(lat) * Math.cos(lon), N * Math.cos(lat) * Math.sin(lon), N * (1 - e2) * s]; }
function fromEcef(X, Y, Z, e) {
  const e2 = e.f * (2 - e.f), p = Math.hypot(X, Y), lon = Math.atan2(Y, X);
  let lat = Math.atan2(Z, p * (1 - e2));
  for (let i = 0; i < 8; i++) { const s = Math.sin(lat), N = e.a / Math.sqrt(1 - e2 * s * s); lat = Math.atan2(Z + e2 * N * s, p); }
  return [lat, lon];
}
function besToWgs([X, Y, Z]) { const k = 1 + H.s; return [H.dx + k * (X - H.rz * Y + H.ry * Z), H.dy + k * (H.rz * X + Y - H.rx * Z), H.dz + k * (-H.ry * X + H.rx * Y + Z)]; }
function wgsToBes([X, Y, Z]) { const k = 1 + H.s, x = (X - H.dx) / k, y = (Y - H.dy) / k, z = (Z - H.dz) / k; return [x + H.rz * y - H.ry * z, -H.rz * x + y + H.rx * z, H.ry * x - H.rx * y + z]; }
const TM = { lat0: 38 * D2R, lon0: 128 * D2R, k0: 0.9999, x0: 400000, y0: 600000 };
function mArc(lat, e) { const e2 = e.f * (2 - e.f), e4 = e2 * e2, e6 = e4 * e2; return e.a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * lat) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * lat) - (35 * e6 / 3072) * Math.sin(6 * lat)); }
function tmFwd(lat, lon, e) {
  const e2 = e.f * (2 - e.f), ep2 = e2 / (1 - e2), s = Math.sin(lat), c = Math.cos(lat), t = Math.tan(lat);
  const N = e.a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = (lon - TM.lon0) * c, M = mArc(lat, e), M0 = mArc(TM.lat0, e);
  const x = TM.k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = TM.k0 * (M - M0 + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [x + TM.x0, y + TM.y0];
}
function tmInv(x, y, e) {
  const e2 = e.f * (2 - e.f), ep2 = e2 / (1 - e2), M = mArc(TM.lat0, e) + (y - TM.y0) / TM.k0;
  const mu = M / (e.a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256)), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1), C1 = ep2 * c * c, T1 = t * t, N1 = e.a / Math.sqrt(1 - e2 * s * s), R1 = e.a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5), D = (x - TM.x0) / (N1 * TM.k0);
  const lat = p1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = TM.lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
  return [lat, lon];
}
function toKatec(lon, lat) { const [X, Y, Z] = wgsToBes(toEcef(lat * D2R, lon * D2R, WGS)); const [la, lo] = fromEcef(X, Y, Z, BES); return tmFwd(la, lo, BES); }
function fromKatec(x, y) { const [la, lo] = tmInv(x, y, BES); const [X, Y, Z] = besToWgs(toEcef(la, lo, BES)); const [a, b] = fromEcef(X, Y, Z, WGS); return { lon: b / D2R, lat: a / D2R }; }

function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function userId(request, env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, ''), svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!url || !svc || !token || token.startsWith('sd1.')) return '';
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return '';
    const u = await r.json();
    return u && u.id ? String(u.id) : '';
  } catch { return ''; }
}
