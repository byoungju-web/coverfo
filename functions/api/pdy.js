// functions/api/pdy.js — coverfo 🍇 포도야 알림 친구 (v468) · 무료 (크레딧을 쓰지 않음)
// © 2026 coverfo All Rights Reserved
//
// POST /api/pdy   (Authorization: Bearer coverfo 로그인키)
//   { op:"get" }                          → { set, days, book, today:{ reminds, shares }, brief, weather }  화면 한 번에
//   { op:"day_add", title, rel, kind, md|day|dom, memo }  → 기념일·알림 추가 (50개까지)
//   { op:"day_edit", id, is_on?, gift?, memo? }           → 켜기·끄기 · 정한 선물 · 메모
//   { op:"day_del", id }                                   → 지우기
//   { op:"set_save", on_day, d7, d3, d0, hh, tone }        → 알림 설정
//
// · 저장소: Supabase cf_pdy_day · cf_pdy_set (sql/cf_pdy.sql 1번 실행). 서버(service_role)만 읽고 쓴다.
// · 알림 보내기는 hub.js(coverfo-cron 5분마다)의 pdyCron — 이용자가 고른 시각(한국 시각)에 하루 1번, D-7·D-3·당일.
// · 읽기만 하는 표: cf_memory(📒 내 연락처에서 올린 생일·기념일) · cf_remind(⏰ 오늘 알림) · cf_share(👥 같이 정하기) · hub_briefs(☀️ 아침 브리핑 설정·도시)
// · 전화·카드·계좌처럼 긴 숫자, 건강·약 이야기는 저장하지 않는다.

const MAX_DAYS = 50;
const RELS = ['가족', '친구', '연인', '동료', '아이', '나', ''];
const KINDS = ['yearly', 'once', 'monthly'];
const TONES = ['kind', 'fun', 'cool'];

export async function onRequestPost(context) {
  const env = context.env || {};
  const c = sb(env);
  if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const uid = await userId(context.request, c);
  if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const op = String(b.op || '');
  try {
    if (op === 'get') return json(await getAll(c, uid));
    if (op === 'day_add') return json(await dayAdd(c, uid, b));
    if (op === 'day_edit') return json(await dayEdit(c, uid, b));
    if (op === 'day_del') return json(await dayDel(c, uid, b));
    if (op === 'set_save') return json(await setSave(c, uid, b));
    return json({ error: '잘못된 요청입니다' }, 400);
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    const m = String((e && e.message) || e);
    if (/cf_pdy/.test(m) && /404|42P01|does not exist|schema cache/.test(m)) return json({ error: '포도야 알림 표가 아직 없어요. Supabase 에서 sql/cf_pdy.sql 을 한 번 실행해 주세요.', setup: true }, 500);
    return json({ error: m.slice(0, 300) }, 500);
  }
}

function setDefaults() { return { on_day: true, d7: true, d3: true, d0: true, hh: 9, tone: 'kind' }; }
function setOut(r) { const d = setDefaults(); if (!r) return d; return { on_day: r.on_day !== false, d7: r.d7 !== false, d3: r.d3 !== false, d0: r.d0 !== false, hh: Number(r.hh) || 9, tone: TONES.includes(r.tone) ? r.tone : 'kind' }; }
function dayOut(r) { return { id: r.id, title: r.title, rel: r.rel || '', kind: r.kind, md: r.md || '', day: r.day || '', dom: r.dom || 0, memo: r.memo || '', gift: r.gift || '', is_on: r.is_on !== false }; }

async function getAll(c, uid) {
  const u = encodeURIComponent(uid);
  const soft = (p) => p.catch(() => null);
  const now = Date.now();
  const kEnd = kstMidnight(now) + 86400e3;   /* 오늘 한국 날짜가 끝나는 때 */
  const [set, days, book, rm, sh, br] = await Promise.all([
    req(c, 'GET', 'cf_pdy_set?select=*&user_id=eq.' + u + '&limit=1'),
    req(c, 'GET', 'cf_pdy_day?select=*&user_id=eq.' + u + '&order=created_at.asc&limit=' + MAX_DAYS),
    soft(req(c, 'GET', 'cf_memory?select=id,meta&user_id=eq.' + u + '&src=eq.book&cat=eq.person&limit=60')),
    soft(req(c, 'GET', 'cf_remind?select=id,text,kind,next_at&user_id=eq.' + u + '&is_on=eq.true&next_at=lt.' + encodeURIComponent(new Date(kEnd).toISOString()) + '&order=next_at.asc&limit=10')),
    soft(req(c, 'GET', 'cf_share?select=id,kind,title,data,created_at&user_id=eq.' + u + '&kind=eq.pick&expires_at=gt.' + encodeURIComponent(new Date(now).toISOString()) + '&order=created_at.desc&limit=5')),
    soft(req(c, 'GET', 'hub_briefs?select=on1,hh,mm,days,city,lat,lng&user_id=eq.' + u + '&limit=1')),
  ]);
  const bk = (Array.isArray(book) ? book : []).map((x) => x.meta || {}).filter((m) => m.name && /^\d{2}-\d{2}$/.test(String(m.day || '')))
    .map((m) => ({ title: clean(m.name, 20) + ' ' + clean(m.kind || '기념일', 12), md: String(m.day) }));
  const b0 = Array.isArray(br) && br[0] ? br[0] : null;
  const brief = b0 ? { on: !!b0.on1, hh: b0.hh, mm: b0.mm, days: String(b0.days || ''), city: b0.city || '서울' } : { on: false, hh: 7, mm: 0, days: '0,1,2,3,4,5,6', city: '서울' };
  const weather = await soft(wx(b0 && b0.lat != null ? { lat: b0.lat, lng: b0.lng } : null, brief.city));
  return {
    ok: true,
    set: setOut(Array.isArray(set) && set[0]),
    days: (Array.isArray(days) ? days : []).map(dayOut),
    book: bk,
    today: {
      reminds: (Array.isArray(rm) ? rm : []).map((r) => ({ id: r.id, text: clean(r.text, 60), kind: r.kind, at: r.next_at })),
      shares: (Array.isArray(sh) ? sh : []).filter((s) => !(s.data && s.data.final)).map((s) => ({ id: s.id, title: clean(s.title, 40) })),
    },
    brief,
    weather: weather || null,
    max: MAX_DAYS,
  };
}

/* 날씨 (Open-Meteo · hub.js 아침 브리핑과 같은 출처) */
const WMO = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개', 51: '이슬비', 53: '이슬비', 55: '이슬비', 61: '비', 63: '비', 65: '강한 비',
  66: '어는 비', 67: '어는 비', 71: '눈', 73: '눈', 75: '많은 눈', 77: '싸락눈', 80: '소나기', 81: '소나기', 82: '강한 소나기', 85: '눈 소나기', 86: '눈 소나기', 95: '뇌우', 96: '뇌우', 99: '뇌우' };
async function wx(ll, city) {
  let lat = ll && ll.lat, lng = ll && ll.lng;
  if (lat == null || lng == null) {
    const g = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=ko&name=' + encodeURIComponent(city || '서울'), { signal: AbortSignal.timeout(6000) })).json();
    const r = g && g.results && g.results[0];
    if (!r) return null;
    lat = r.latitude; lng = r.longitude;
  }
  const d = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + Number(lat) + '&longitude=' + Number(lng) +
    '&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1', { signal: AbortSignal.timeout(6000) })).json();
  const cu = (d && d.current) || {}, dy = (d && d.daily) || {};
  if (cu.temperature_2m == null) return null;
  return { city: city || '서울', code: cu.weathercode, text: WMO[cu.weathercode] || '', t: Math.round(cu.temperature_2m),
    tmax: dy.temperature_2m_max ? Math.round(dy.temperature_2m_max[0]) : null, tmin: dy.temperature_2m_min ? Math.round(dy.temperature_2m_min[0]) : null,
    pop: dy.precipitation_probability_max ? dy.precipitation_probability_max[0] : null };
}

async function dayAdd(c, uid, b) {
  const title = clean(b.title, 30);
  if (!title) throw httpErr(400, '무슨 날인지 적어 주세요 (예: 엄마 생일)');
  const memo = clean(b.memo, 60);
  const why = blocked(title + ' ' + memo);
  if (why) throw httpErr(400, why);
  const kind = KINDS.includes(b.kind) ? b.kind : 'yearly';
  const rel = RELS.includes(b.rel) ? b.rel : '';
  const row = { user_id: uid, title, rel, kind, memo, md: '', day: null, dom: 0 };
  if (kind === 'yearly') {
    const m = String(b.md || '').match(/^(\d{2})-(\d{2})$/);
    if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > 31) throw httpErr(400, '날짜를 골라 주세요');
    row.md = m[1] + '-' + m[2];
  } else if (kind === 'once') {
    const d = String(b.day || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d + 'T00:00:00Z'))) throw httpErr(400, '날짜를 골라 주세요');
    if (Date.parse(d + 'T00:00:00Z') < kstMidnight(Date.now()) - 86400e3) throw httpErr(400, '지난 날짜예요');
    row.day = d;
  } else {
    const n = Math.round(Number(b.dom));
    if (!(n >= 1 && n <= 31)) throw httpErr(400, '매월 며칠인지 골라 주세요');
    row.dom = n;
  }
  const have = await req(c, 'GET', 'cf_pdy_day?select=id&user_id=eq.' + encodeURIComponent(uid) + '&limit=' + (MAX_DAYS + 1));
  if (Array.isArray(have) && have.length >= MAX_DAYS) throw httpErr(409, '기념일·알림은 ' + MAX_DAYS + '개까지예요. 안 쓰는 것을 지워 주세요');
  const r = await req(c, 'POST', 'cf_pdy_day', row, 'return=representation');
  /* 처음 쓰는 사람은 알림 설정(기본값)도 함께 만든다 — 이미 있으면 그대로 */
  await req(c, 'POST', 'cf_pdy_set', { user_id: uid }, 'resolution=ignore-duplicates,return=minimal').catch(() => {});
  return { ok: true, day: dayOut(Array.isArray(r) && r[0] ? r[0] : row) };
}
async function dayEdit(c, uid, b) {
  if (!/^\d{1,18}$/.test(String(b.id || ''))) throw httpErr(400, '어느 날인지 알려 주세요');
  const up = {};
  if (typeof b.is_on === 'boolean') up.is_on = b.is_on;
  if (b.gift != null) { up.gift = clean(b.gift, 60); const w = blocked(up.gift); if (w) throw httpErr(400, w); }
  if (b.memo != null) { up.memo = clean(b.memo, 60); const w = blocked(up.memo); if (w) throw httpErr(400, w); }
  if (!Object.keys(up).length) throw httpErr(400, '무엇을 바꿀지 알려 주세요');
  const r = await req(c, 'PATCH', 'cf_pdy_day?user_id=eq.' + encodeURIComponent(uid) + '&id=eq.' + String(b.id), up, 'return=representation');
  if (!Array.isArray(r) || !r.length) throw httpErr(404, '찾지 못했어요');
  return { ok: true, day: dayOut(r[0]) };
}
async function dayDel(c, uid, b) {
  if (!/^\d{1,18}$/.test(String(b.id || ''))) throw httpErr(400, '어느 날인지 알려 주세요');
  await req(c, 'DELETE', 'cf_pdy_day?user_id=eq.' + encodeURIComponent(uid) + '&id=eq.' + String(b.id));
  return { ok: true };
}
async function setSave(c, uid, b) {
  const row = { user_id: uid, updated_at: new Date().toISOString() };
  ['on_day', 'd7', 'd3', 'd0'].forEach((k) => { if (typeof b[k] === 'boolean') row[k] = b[k]; });
  if (b.hh != null) { const h = Math.round(Number(b.hh)); if (h >= 7 && h <= 21) row.hh = h; }
  if (TONES.includes(b.tone)) row.tone = b.tone;
  /* 알림 시각을 바꾸면 오늘 아직 안 보냈으면 오늘 새 시각에 다시 확인 */
  if (row.hh != null) row.last_day = '';
  await req(c, 'POST', 'cf_pdy_set', row, 'resolution=merge-duplicates,return=minimal');
  const r = await req(c, 'GET', 'cf_pdy_set?select=*&user_id=eq.' + encodeURIComponent(uid) + '&limit=1');
  return { ok: true, set: setOut(Array.isArray(r) && r[0]) };
}

/* ── 공용 ── */
function kstMidnight(t) { const k = new Date(t + 9 * 3600e3); return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600e3; }
function blocked(s) {
  s = String(s || '');
  if (/(?:\d[\s.\-]?){9,}/.test(s)) return '전화·카드·계좌번호처럼 긴 숫자는 넣을 수 없어요';
  if (/(비밀\s*번호|비번|패스워드|주민\s*(등록)?\s*번호|카드\s*번호|계좌\s*번호)/.test(s)) return '비밀번호·주민번호·카드·계좌 정보는 넣을 수 없어요';
  if (/(진단|질환|병명|투병|처방|복용|약\s*(먹|복용)|정신과|우울|공황)/.test(s)) return '건강·약 이야기는 저장하지 않아요';
  return '';
}
function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && svc ? { url, svc } : null;
}
async function userId(request, c) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.startsWith('sd1.')) return '';
  try {
    const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return '';
    const u = await r.json();
    return u && u.id && /^[0-9a-f-]{36}$/i.test(String(u.id)) ? String(u.id) : '';
  } catch { return ''; }
}
async function req(c, method, path, body, prefer) {
  const h = { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  const r = await fetch(c.url + '/rest/v1/' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error('cf_pdy DB ' + r.status + ': ' + t.slice(0, 200));
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
