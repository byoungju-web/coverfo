// functions/api/trail.js — coverfo 👣 내 발자취 (v325) · 무료 (크레딧을 쓰지 않음)
// © 2026 coverfo All Rights Reserved
//
// POST /api/trail   (Authorization: Bearer coverfo 로그인키)
//   { op:"get" }                      → { on, items:[최근 30개] }
//   { op:"set", on }                  → 켜기·끄기 (끄면 새로 기록하지 않음 · 이미 있는 기록은 그대로 — 지우기는 del)
//   { op:"add", kind, title, label, url } → 켜져 있을 때만 1줄 기록 (같은 말을 10분 안에 또 하면 한 번만)
//   { op:"find", q, days }            → 최근 days일(기본 7, 최대 90) 안에서 q 낱말이 들어간 기록 5개 (소리 "어제 찾던 ○○")
//   { op:"del", id } | { op:"del", range:"today"|"all" }  → 지우기
//
// · 저장소: Supabase cf_trail · cf_trail_set (sql/cf_trail.sql 1번 실행). 서버(service_role)만 읽고 쓴다.
// · 기록하지 않는 것: 전화·문자·송금, 숫자가 9자리 넘게 이어진 글(전화·카드·계좌번호처럼 보이는 것), 위치(GPS).
// · 90일 지난 기록은 기록할 때 가끔(20번에 1번) 지운다. 탈퇴하면 함께 지워진다.

const KINDS = ['shop', 'stay', 'navi', 'place', 'attr', 'dlv', 'taxi', 'music', 'train', 'flight', 'weather', 'used', 'rental', 'plan', 'yt', 'lens', 'app', 'image', 'video', '3d', 'other'];
const KEEP_DAYS = 90;

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
    if (op === 'get') return json({ ok: true, on: await isOn(c, uid), items: await list(c, uid, 30) });
    if (op === 'set') {
      await req(c, 'POST', 'cf_trail_set', { user_id: uid, is_on: !!b.on, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
      return json({ ok: true, on: !!b.on });
    }
    if (op === 'add') return json(await add(c, uid, b));
    if (op === 'find') return json({ ok: true, on: await isOn(c, uid), items: await find(c, uid, String(b.q || ''), Number(b.days) || 7) });
    if (op === 'del') {
      if (b.id != null && /^\d{1,18}$/.test(String(b.id))) await req(c, 'DELETE', 'cf_trail?user_id=eq.' + uid + '&id=eq.' + String(b.id));
      else if (b.range === 'all') await req(c, 'DELETE', 'cf_trail?user_id=eq.' + uid);
      else if (b.range === 'today') await req(c, 'DELETE', 'cf_trail?user_id=eq.' + uid + '&created_at=gte.' + encodeURIComponent(kstMidnight()));
      else return json({ error: '무엇을 지울지 알려 주세요' }, 400);
      return json({ ok: true });
    }
    return json({ error: '잘못된 요청입니다' }, 400);
  } catch (e) {
    const m = String((e && e.message) || e);
    if (/cf_trail/.test(m) && /404|42P01|does not exist|schema cache/.test(m)) return json({ error: '내 발자취 표가 아직 없어요. Supabase 에서 sql/cf_trail.sql 을 한 번 실행해 주세요.', setup: true }, 500);
    return json({ error: m.slice(0, 300) }, 500);
  }
}

/* ── 기록 ── */
function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
/* 전화·카드·계좌번호처럼 보이는 것: 숫자(사이에 공백·-·. 허용)가 9자리 넘게 */
function looksPrivate(s) { return /(?:\d[\s.\-]?){9,}/.test(String(s || '')); }
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (s.length > 600) return '';
  if (/^(tel|sms|mailto|intent|javascript|data):/i.test(s)) return '';
  if (/[?&](token|access_token|key|password|pw|code)=/i.test(s)) return '';
  if (/^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s)) return s;
  return '';
}
async function add(c, uid, b) {
  if (!(await isOn(c, uid))) return { ok: true, saved: false, off: true };
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : 'other';
  const title = clean(b.title, 120), label = clean(b.label, 120), url = safeUrl(b.url);
  if (!title) return { ok: true, saved: false };
  if (looksPrivate(title) || looksPrivate(label) || looksPrivate(decodeSafe(url))) return { ok: true, saved: false, private: true };
  /* 같은 말을 10분 안에 또 하면 한 번만 */
  const since = new Date(Date.now() - 10 * 60e3).toISOString();
  const dup = await req(c, 'GET', 'cf_trail?select=id&user_id=eq.' + uid + '&kind=eq.' + kind + '&title=eq.' + encodeURIComponent(title) + '&created_at=gte.' + encodeURIComponent(since) + '&limit=1');
  if (Array.isArray(dup) && dup.length) return { ok: true, saved: false, dup: true };
  await req(c, 'POST', 'cf_trail', { user_id: uid, kind, title, label, url }, 'return=minimal');
  if (Math.random() < 0.05) await req(c, 'DELETE', 'cf_trail?user_id=eq.' + uid + '&created_at=lt.' + encodeURIComponent(new Date(Date.now() - KEEP_DAYS * 86400e3).toISOString())).catch(() => {});
  return { ok: true, saved: true };
}
function decodeSafe(u) { try { return decodeURIComponent(u); } catch { return u; } }

/* ── 읽기 ── */
async function isOn(c, uid) {
  const r = await req(c, 'GET', 'cf_trail_set?select=is_on&user_id=eq.' + uid + '&limit=1');
  return !!(Array.isArray(r) && r[0] && r[0].is_on);
}
async function list(c, uid, n) {
  const r = await req(c, 'GET', 'cf_trail?select=id,kind,title,label,url,created_at&user_id=eq.' + uid + '&order=created_at.desc&limit=' + n);
  return Array.isArray(r) ? r : [];
}
async function find(c, uid, q, days) {
  const d = Math.max(1, Math.min(KEEP_DAYS, Math.round(days)));
  const since = new Date(Date.now() - d * 86400e3).toISOString();
  /* 조사·명령 말은 빼고 2글자 이상 낱말로 찾는다 (예: "어제 찾던 홍삼 쇼핑몰" → 홍삼 · 쇼핑몰) */
  const STOP = /^(어제|오늘|그제|아까|저번|지난|찾던|찾은|봤던|본|그|그거|그때|다시|열어|열어줘|띄워|띄워줘|보여줘|줘|좀|해줘|링크|거|것|the|a|an|that|again|open|show|find|yesterday|today)$/i;
  const words = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).map((w) => w.replace(/(을|를|이|가|은|는|에서|으로|로|에|도|만|하고|이랑|랑)$/, '')).filter((w) => w.length >= 2 && !STOP.test(w)).slice(0, 4);
  let filter = '';
  if (words.length) {
    const ors = [];
    for (const w of words) { const e = w.replace(/[,()*]/g, ''); if (e) { ors.push('title.ilike.*' + e + '*'); ors.push('label.ilike.*' + e + '*'); } }
    if (ors.length) filter = '&or=(' + encodeURIComponent(ors.join(',')) + ')';
  }
  const r = await req(c, 'GET', 'cf_trail?select=id,kind,title,label,url,created_at&user_id=eq.' + uid + '&created_at=gte.' + encodeURIComponent(since) + filter + '&order=created_at.desc&limit=5');
  return Array.isArray(r) ? r : [];
}
function kstMidnight() {
  const k = new Date(Date.now() + 9 * 3600e3);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600e3).toISOString();
}

/* ── 공용 (talk-live.js 와 같은 방식) ── */
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
  if (!r.ok) throw new Error('cf_trail DB ' + r.status + ': ' + t.slice(0, 200));
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
