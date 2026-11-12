// functions/api/food.js — coverfo 🍲 한국 음식 이야기 (v378) · 한국관광공사_관광음식 정보 서비스 (FoodService) · 무료
// © 2026 coverfo All Rights Reserved
//
// POST /api/food   (Authorization: Bearer coverfo 로그인키)
//   { op:"list", q?, lang?, page? }  → 음식 목록 (q: 음식 이름 낱말 · lang: ko|en|ja|zh|tw)
//   { op:"detail", id, lang? }       → 음식 하나 자세히
//   → { ok, items:[{ id, name, nameKo, en, roman, img, desc, cat }], total, more, source, diag? }
//   ※ v378: 목록에 한국어(kor)가 없어 한국어 화면은 영어 자료(eng)를 받아, 이름 괄호 속 한글 "(전복돌솥밥 / Jeonbokdolsotbap)"을 한국어 이름으로 쓴다.
//     한글이 아닌 값(예: 코드)은 한국어 이름으로 쓰지 않는다. 설명은 상세(/foodDetailInfo)에서 누를 때 받는다.
//
// · 키: Cloudflare 비밀값 TOUR_API_KEY (축제·관광지와 같은 공공데이터포털 인증키) · 공공데이터포털에서 '한국관광공사_관광음식 정보 서비스' [활용신청] 필요
// · 공공데이터포털 안내: 주소 https://apis.data.go.kr/B551011/FoodService · 음식 정보 목록/상세/동기화/카테고리 4가지 · langDivCd(eng·jpn·chs·cht…)
//   ※ v377: 경로는 활용신청 상세기능정보로 확인(/foodList · /foodDetailInfo). 응답 칸 이름은 아직 안내에 없어
//     이름 모양(…Nm · …Img · …Dc 등)으로 골라 쓰고, 못 고르면 diag 로 받은 칸 이름을 돌려준다.
// · 같은 검색은 6시간 캐시 · 이용자 정보는 보내지 않음 · 출처: 한국관광공사 표시

const BASE = 'https://apis.data.go.kr/B551011/FoodService/';
const LANG = { ko: 'eng', en: 'eng', ja: 'jpn', zh: 'chs', tw: 'cht' };   /* v378: 목록에 kor 가 없어 한국어 화면도 eng (괄호 속 한글 이름 사용) */
/* v377: 공공데이터포털 활용신청 상세기능정보로 확인한 경로 — 목록 /foodList · 상세 /foodDetailInfo (동기화 /foodSyncList · 카테고리 /foodCtgryCode) */
const LIST_OPS = ['foodList'];
const DETAIL_OPS = ['foodDetailInfo'];
const PER = 10, TTL = 6 * 3600, OP_TTL = 7 * 86400;

export async function onRequestPost(context) {
  const env = context.env || {};
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  if (!(await userId(context.request, env))) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const key = String(env.TOUR_API_KEY || '').trim();
  if (!key) return json({ error: '관광정보 설정이 아직 없어요 (TOUR_API_KEY)', setup: true }, 500);
  const lang = Object.prototype.hasOwnProperty.call(LANG, b.lang) ? b.lang : 'ko';
  try {
    if (b.op === 'list') {
      const q = clean(b.q, 30), page = Math.max(1, Math.min(20, parseInt(b.page, 10) || 1));
      const p = { numOfRows: String(PER), pageNo: String(page), arrange: 'A' };
      if (q) p.keyword = q;
      if (LANG[lang]) p.langDivCd = LANG[lang];
      const r = await tryOps(key, 'list', LIST_OPS, p);
      if (!r.ok) return json({ ok: false, error: r.error, diag: r.diag });
      let items = r.items.map(norm).filter((x) => x.name);
      return json({ ok: true, lang, q, page, total: r.total, more: r.total > page * PER, items, source: '한국관광공사', diag: { op: r.op, keys: r.items[0] ? Object.keys(r.items[0]).slice(0, 40) : [] } });
    }
    if (b.op === 'detail') {
      const id = String(b.id || '');
      if (!/^[\w-]{1,30}$/.test(id)) return json({ error: '잘못된 요청입니다' }, 400);
      const p = { contentId: id };
      if (LANG[lang]) p.langDivCd = LANG[lang];
      const r = await tryOps(key, 'detail', DETAIL_OPS, p);
      if (!r.ok) return json({ ok: false, error: r.error, diag: r.diag });
      const it = r.items[0] ? norm(r.items[0]) : null;
      return json({ ok: !!it, item: it, source: '한국관광공사', diag: (it && it.desc) ? undefined : { op: r.op, keys: r.items[0] ? Object.keys(r.items[0]).slice(0, 40) : [] } });
    }
    return json({ error: '잘못된 요청입니다' }, 400);
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    return json({ error: String((e && e.message) || e).slice(0, 200) }, 502);
  }
}

/* ── 경로 찾기: 기억해 둔 경로 → 후보를 차례로 (없는 경로면 다음 후보) ── */
const memo = {};
async function tryOps(key, kind, ops, params) {
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const opKey = new Request('https://cache.coverfo.com/food-op/' + kind);
  let known = memo[kind];
  if (!known && cache) { const h = await cache.match(opKey).catch(() => null); if (h) known = (await h.text().catch(() => '')) || ''; }
  const order = known ? [known].concat(ops.filter((o) => o !== known)) : ops;
  const tried = [];
  for (const op of order) {
    const r = await call(key, op, params);
    tried.push(op + ':' + r.kind);
    if (r.kind === 'ok') {
      if (op !== known) { memo[kind] = op; if (cache) { try { await cache.put(opKey, new Response(op, { headers: { 'Cache-Control': 'public, max-age=' + OP_TTL } })); } catch {} } }
      return { ok: true, op, items: r.items, total: r.total };
    }
    /* 인증키 오류는 경로가 틀려도 날 수 있어 다음 후보도 시험해 본다 */
    if (r.kind === 'limit') return { ok: false, error: '오늘 관광음식 조회 한도를 다 썼어요. 내일 다시 해 주세요', diag: { tried } };
    if (r.kind === 'nodata') return { ok: true, op, items: [], total: 0 };
  }
  if (tried.every((t) => /:key$/.test(t))) return { ok: false, error: '한국관광공사_관광음식 정보 서비스 활용신청이 아직 안 됐어요 (공공데이터포털 [활용신청] · 승인 직후면 잠시 뒤 다시)', diag: { tried } };
  return { ok: false, error: '관광음식 정보 경로를 찾지 못했어요 (아래 진단 내용을 캡처해 보내 주세요)', diag: { tried } };
}
async function call(key, op, params) {
  const q = new URLSearchParams(Object.assign({ MobileOS: 'ETC', MobileApp: 'coverfo', _type: 'json' }, params));
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const ck = new Request('https://cache.coverfo.com/food/' + op + '?' + q.toString());
  if (cache) { const h = await cache.match(ck).catch(() => null); if (h) { const j = await h.json().catch(() => null); if (j && Array.isArray(j.items)) return { kind: 'ok', items: j.items, total: j.total }; } }
  let r, t;
  try { r = await fetch(BASE + op + '?serviceKey=' + encodeURIComponent(key) + '&' + q.toString(), { headers: { Accept: 'application/json' } }); t = await r.text(); }
  catch { return { kind: 'net' }; }
  if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE KEY IS NOT/i.test(t)) return { kind: 'key' };
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(t)) return { kind: 'limit' };
  if (r.status === 404 || /API not found|Unexpected errors|NO_OPENAPI_SERVICE|INVALID_REQUEST_PARAMETER_ERROR.*operation/i.test(t)) return { kind: 'missing' };
  let d; try { d = JSON.parse(t); } catch { return { kind: 'missing' }; }
  const head = (d && d.response && d.response.header) || d || {};
  const code = String(head.resultCode || '');
  if (code && code !== '0000' && code !== '00') return /NODATA|03/.test(code + String(head.resultMsg || '')) ? { kind: 'nodata' } : { kind: 'missing' };
  const body = (d && d.response && d.response.body) || {};
  let it = body.items ? (body.items.item || body.items) : [];
  if (!it || typeof it === 'string') it = [];
  if (!Array.isArray(it)) it = [it];
  const total = parseInt(body.totalCount, 10) || it.length;
  if (cache) { try { await cache.put(ck, new Response(JSON.stringify({ items: it, total }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + TTL } })); } catch {} }
  return { kind: 'ok', items: it, total };
}

/* ── 응답 칸 고르기: 칸 이름 모양으로 (이름 · 사진 · 설명 · 분류 · 한국어 이름) ── */
function norm(x) {
  if (!x || typeof x !== 'object') return { name: '' };
  const ks = Object.keys(x), str = (k) => (typeof x[k] === 'string' || typeof x[k] === 'number') ? String(x[k]).trim() : '';
  const pick = (re, not) => { for (const k of ks) { if (re.test(k) && !(not && not.test(k)) && str(k)) return str(k); } return ''; };
  const id = pick(/^(contentid|contentId|foodId|foodid|id|foodCd|foodcd|fdId|cntntsId)$/i) || pick(/(id|cd|sn)$/i, /(lang|ctgry|category|area|sigungu|img|image)/i);
  const name = pick(/(food(nm|name)|^nm$|name$|^title$|fdnm|foodnmeng|foodNm)/i, /(ctgry|category|kor|ko$|area|addr|lang)/i) || pick(/(nm|name|title)$/i, /(ctgry|category|area|addr|lang)/i);
  /* v378: 한글이 들어 있는 값만 한국어 이름 (코드 같은 값은 버림) */
  const hasKo = (v) => /[가-힣]/.test(v);
  let nameKo = ''; for (const k of ks) { if (/(kor|nmko|krnm)/i.test(k) && hasKo(str(k))) { nameKo = str(k); break; } }
  /* 이름 "Abalone Hot Stone Pot Rice (전복돌솥밥 / Jeonbokdolsotbap)" → 영어 · 한글 · 로마자 */
  let en = name, roman = '';
  const m = String(name).match(/^(.*?)\s*[(（]([^()（）]*)[)）]\s*$/);
  if (m) {
    const parts = m[2].split(/\s*[\/／,]\s*/).filter(Boolean);
    const ko = parts.find(hasKo);
    if (ko) { if (!nameKo) nameKo = ko; en = m[1] || name; roman = parts.filter((x) => x !== ko && !hasKo(x)).join(' ') ; }
  }
  if (!nameKo && hasKo(name)) nameKo = name;
  let img = '';
  for (const k of ks) { const v = str(k); if (/(img|image|photo|thumb)/i.test(k) && /^https?:\/\//.test(v)) { img = v; break; } }
  if (!img) for (const k of ks) { const v = str(k); if (/^https?:\/\/\S+\.(jpe?g|png|gif|webp)(\?|$)/i.test(v)) { img = v; break; } }
  let desc = '';
  /* v378: 코드 칸(contentId 등)은 설명이 아님 — 칸 이름이 id·cd·sn·yn·url 로 끝나거나 띄어쓰기 없는 짧은 값은 버림 */
  for (const k of ks) { if (/(dc$|desc|expln|intro|overview|story|cn$|cont|explain|info$)/i.test(k) && !/(id|cd|sn|yn|no|url|img|dt|date|time)$/i.test(k)) { const v = str(k); if ((/\s/.test(v) || v.length > 30) && v.length > desc.length) desc = v; } }
  const cat = pick(/(ctgry\d?nm|ctgrynm|categorynm|category|ctgry\d?Nm)/i);
  const strip = (v, n) => String(v || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, n);
  return { id: clean(id, 30), name: strip(name, 80), nameKo: strip(nameKo, 40), en: strip(en, 60), roman: strip(roman, 40), img: img.replace(/^http:\/\//, 'https://').slice(0, 300), desc: strip(desc, 1200), cat: strip(cat, 40) };
}
function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
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
