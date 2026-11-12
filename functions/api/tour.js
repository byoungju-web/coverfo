// functions/api/tour.js — coverfo 🎪 축제·행사 + 🏞 가볼 만한 곳 (v371) · 한국관광공사 TourAPI 4.0 (국문 관광정보 서비스 KorService2) · 무료
// © 2026 coverfo All Rights Reserved
//
// POST /api/tour   (Authorization: Bearer coverfo 로그인키 — 하루 호출 한도(개발계정 1,000건)를 지키려고 로그인한 사람만)
//   { op:"festival", region?, when?, page? } → 그 지역(없으면 전국)에서 그 기간(기본: 오늘부터 30일)에 열리는 축제·공연·행사
//   { op:"spot", region, page? }             → 그 지역 가볼 만한 곳 (관광지) · 도시면 반경 20km 가까운 순, 시·도면 그 시·도 전체
//   → { ok, kind, region, from, to, page, more, total, items:[{ id, title, addr, tel, img, x, y, start, end, dist }], source }
//
// · 키: Cloudflare 비밀값 TOUR_API_KEY (공공데이터포털 '일반 인증키(Decoding)') · 지역 좌표 찾기는 카카오 키워드 검색(KAKAO_REST_KEY, 장소 목록과 같은 키)
// · 같은 검색은 6시간 동안 Cloudflare 캐시에 저장해 다시 부르지 않는다 (개발계정 하루 1,000건 아끼기)
// · 이용자 정보는 관광공사·카카오에 보내지 않는다 (지역 이름·날짜만). 결과는 저장하지 않는다(캐시 6시간 제외)
// · 출처: 한국관광공사 — 화면에 늘 표시. 내용·사진은 바꾸지 않고 그대로 보여 준다

const BASE = 'https://apis.data.go.kr/B551011/KorService2/';
const PER = 10;
const TTL = 6 * 3600;
/* 한국관광공사 지역코드 (areaCode) */
const AREA = [
  ['서울', 1], ['인천', 2], ['대전', 3], ['대구', 4], ['광주', 5], ['부산', 6], ['울산', 7], ['세종', 8],
  ['경기', 31], ['강원', 32], ['충북', 33], ['충청북', 33], ['충남', 34], ['충청남', 34], ['경북', 35], ['경상북', 35],
  ['경남', 36], ['경상남', 36], ['전북', 37], ['전라북', 37], ['전북특별', 37], ['전남', 38], ['전라남', 38], ['제주', 39],
];
const SIDO_ONLY = /^(서울|인천|대전|대구|광주|부산|울산|세종|경기|강원|충북|충남|경북|경남|전북|전남|제주|충청북|충청남|경상북|경상남|전라북|전라남)(특별시|광역시|특별자치시|특별자치도|도)?$/;

export async function onRequestPost(context) {
  const env = context.env || {};
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const key = String(env.TOUR_API_KEY || '').trim();
  if (!key) return json({ error: '관광정보 설정이 아직 없어요 (TOUR_API_KEY)', setup: true }, 500);
  const op = String(b.op || '');
  if (op !== 'festival' && op !== 'spot') return json({ error: '잘못된 요청입니다' }, 400);
  const region = clean(b.region, 30);
  const page = Math.max(1, Math.min(10, parseInt(b.page, 10) || 1));
  try {
    if (op === 'spot' && !region) return json({ ok: false, need: 'region', note: '어느 지역인지 알려 주세요 (예: 속초, 경주, 제주)' });
    const geo = region ? await where(env, region) : null;
    if (region && !geo) return json({ ok: false, notFound: true, note: '"' + region + '" 지역을 찾지 못했어요' });
    let all, from = '', to = '';
    if (op === 'festival') {
      const r = range(String(b.when || ''));
      from = r.from; to = r.to;
      all = await festivals(env, key, geo, from, to);
    } else {
      all = await spots(env, key, geo);
    }
    const items = all.slice((page - 1) * PER, page * PER);
    return json({ ok: true, kind: op, region: geo ? geo.label : '전국', from, to, page, total: all.length, more: all.length > page * PER, items, source: '한국관광공사 TourAPI' });
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    return json({ error: String((e && e.message) || e).slice(0, 200) }, 502);
  }
}

/* ── 지역: 시·도 이름이면 지역코드만 · 도시·동네면 카카오로 좌표 + 시·도 ── */
async function where(env, region) {
  const r = region.replace(/\s+/g, ' ').trim();
  const head = r.split(' ')[0];
  if (SIDO_ONLY.test(head) && r.split(' ').length === 1) {
    const code = areaOf(head);
    if (code) return { label: head, area: code, city: '', x: 0, y: 0 };
  }
  const kk = String(env.KAKAO_REST_KEY || '').trim();
  if (!kk) throw httpErr(500, '지역 찾기 설정이 아직 없어요 (KAKAO_REST_KEY)');
  const res = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent(r), { headers: { Authorization: 'KakaoAK ' + kk } });
  if (!res.ok) throw httpErr(502, '지역을 찾지 못했어요 (카카오 ' + res.status + ')');
  const d = await res.json().catch(() => ({}));
  const doc = d && Array.isArray(d.documents) ? d.documents[0] : null;
  if (!doc) return null;
  const addr = String(doc.address_name || doc.road_address_name || '');
  const area = areaOf(addr.split(' ')[0] || '');
  /* 도시 낱말: "속초" → 주소의 "속초시" (축제 주소 거르기) */
  const parts = addr.split(' ');
  const cityTok = parts.find((p, i) => i > 0 && /[시군]$/.test(p)) || parts.find((p, i) => i > 0 && /구$/.test(p)) || '';
  return { label: r, area, city: cityTok, x: +doc.x || 0, y: +doc.y || 0 };
}
function areaOf(s) {
  const t = String(s || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '');
  for (const [k, v] of AREA) if (t === k || t.startsWith(k)) return v;
  return 0;
}

/* ── 기간: "이번 주말", "내일", "다음 달", "12월" … 기본은 오늘부터 30일 (한국 날짜) ── */
function range(w) {
  const now = new Date(Date.now() + 9 * 3600e3);
  const day = (d) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d));
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const dow = now.getUTCDay();
  let a = day(0), b = day(30), m;
  if (/오늘/.test(w)) { b = a; }
  else if (/내일/.test(w)) { a = day(1); b = a; }
  else if (/모레/.test(w)) { a = day(2); b = a; }
  else if (/다음\s*주\s*말|담주\s*말/.test(w)) { const s = (6 - dow + 7) % 7 + 7; a = day(s); b = day(s + 1); }
  else if (/주말/.test(w)) { if (dow === 0) { a = day(0); b = a; } else { const s = (6 - dow + 7) % 7; a = day(s); b = day(s + 1); } }
  else if (/다음\s*주|담주/.test(w)) { const s = ((8 - dow) % 7) || 7; a = day(s); b = day(s + 6); }
  else if (/이번\s*주/.test(w)) { b = day((7 - dow) % 7); }
  else if (/다음\s*달/.test(w)) { a = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); b = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0)); }
  else if (/이번\s*달/.test(w)) { b = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)); }
  else if ((m = w.match(/(\d{1,2})\s*월/))) { let y = now.getUTCFullYear(); const mo = +m[1] - 1; if (mo < now.getUTCMonth()) y++; a = new Date(Date.UTC(y, mo, 1)); b = new Date(Date.UTC(y, mo + 1, 0)); if (a < day(0)) a = day(0); }
  return { from: ymd(a), to: ymd(b) };
}

/* ── 축제·공연·행사: 시작일이 기간 끝 이전이고 끝난 날이 기간 시작 이후인 것 (진행 중인 축제 포함) ── */
async function festivals(env, key, geo, from, to) {
  /* 시작일 기준 검색이라 이미 시작해 진행 중인 축제도 잡으려고 90일 앞부터 찾는다 */
  const s = new Date(Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6, 8) - 90)).toISOString().slice(0, 10).replace(/-/g, '');
  const p = { eventStartDate: s, arrange: 'A', numOfRows: '300', pageNo: '1' };
  if (geo && geo.area) p.areaCode = String(geo.area);
  /* 전국이면 300건이 넘을 수 있어 3쪽(900건)까지 */
  let rows = [];
  for (let pg = 1; pg <= 3; pg++) {
    p.pageNo = String(pg);
    const got = await call(env, key, 'searchFestival2', p);
    rows = rows.concat(got);
    if (got.length < 300) break;
  }
  let list = rows.map(norm).filter((x) => x.start && x.start <= to && (x.end || x.start) >= from);
  if (geo && geo.city) {
    const c = geo.city.replace(/[시군구]$/, '');
    const near = list.filter((x) => x.addr.includes(c));
    list = near.length ? near : list;   /* 그 도시에 없으면 같은 시·도 전체 */
  }
  list.sort((a, b) => (a.start === b.start ? a.title.localeCompare(b.title) : a.start < b.start ? -1 : 1));
  return list;
}
/* ── 가볼 만한 곳 (관광지 contentTypeId 12) ── */
async function spots(env, key, geo) {
  let rows;
  if (geo.x && geo.y) rows = await call(env, key, 'locationBasedList2', { mapX: String(geo.x), mapY: String(geo.y), radius: '20000', contentTypeId: '12', arrange: 'E', numOfRows: '100', pageNo: '1' });
  else rows = await call(env, key, 'areaBasedList2', { areaCode: String(geo.area), contentTypeId: '12', arrange: 'Q', numOfRows: '100', pageNo: '1' });
  /* 사진 있는 곳을 조금 앞으로 (거리 순서는 유지) */
  const list = rows.map(norm);
  return list.filter((x) => x.img).concat(list.filter((x) => !x.img));
}

async function call(env, key, op, params) {
  const q = new URLSearchParams(Object.assign({ MobileOS: 'ETC', MobileApp: 'coverfo', _type: 'json' }, params));
  const cacheKey = new Request('https://cache.coverfo.com/tour/' + op + '?' + q.toString());
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey).catch(() => null); if (hit) { const j = await hit.json().catch(() => null); if (Array.isArray(j)) return j; } }
  const url = BASE + op + '?serviceKey=' + encodeURIComponent(key) + '&' + q.toString();
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  const t = await r.text();
  if (!r.ok) throw httpErr(502, '관광정보를 불러오지 못했어요 (' + r.status + ')');
  let d;
  try { d = JSON.parse(t); } catch {
    if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE KEY/i.test(t)) throw httpErr(502, '관광정보 인증키가 아직 등록 전이에요. 승인 직후면 잠시 뒤 다시 해 보세요');
    if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(t)) throw httpErr(429, '오늘 관광정보 조회 한도를 다 썼어요. 내일 다시 해 주세요');
    throw httpErr(502, '관광정보 응답을 읽지 못했어요');
  }
  const code = String((d && d.response && d.response.header && d.response.header.resultCode) || (d && d.resultCode) || '');
  if (code && code !== '0000') {
    const msg = String((d.response && d.response.header && d.response.header.resultMsg) || d.resultMsg || '');
    if (code === '03' || /NODATA/i.test(msg)) return [];
    throw httpErr(502, '관광정보 오류 (' + code + ' ' + msg.slice(0, 60) + ')');
  }
  let it = d && d.response && d.response.body && d.response.body.items ? d.response.body.items.item : [];
  if (!it) it = [];
  if (!Array.isArray(it)) it = [it];
  if (cache) { try { await cache.put(cacheKey, new Response(JSON.stringify(it), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + TTL } })); } catch {} }
  return it;
}
function norm(x) {
  const img = String(x.firstimage || x.firstimage2 || '').replace(/^http:\/\//, 'https://');
  return {
    id: String(x.contentid || ''),
    title: clean(x.title, 60),
    addr: clean(String(x.addr1 || '') + (x.addr2 ? ' ' + x.addr2 : ''), 80),
    tel: clean(String(x.tel || '').replace(/<[^>]*>/g, ' '), 40),
    img: /^https:\/\/[\w.-]+\//.test(img) ? img : '',
    x: +x.mapx || 0, y: +x.mapy || 0,
    start: String(x.eventstartdate || ''), end: String(x.eventenddate || ''),
    dist: x.dist ? Math.round(+x.dist) : 0,
  };
}

/* ── 공용 ── */
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
