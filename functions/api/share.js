// functions/api/share.js — coverfo 👥 같이 정하기 링크 (v356) · 무료 (크레딧을 쓰지 않음)
// © 2026 coverfo All Rights Reserved
//
// POST /api/share
//   { op:"create", kind, title, sender, data }   (로그인)  → { ok, id, url, expires_at }
//        kind "places"  data { q, items:[{ name, cat, addr, url(카카오맵 장소), phone }] ≤10 }
//        kind "trip"    data { sub, steps:[{ icon, name, desc, u(https) }] ≤8, checklist:[글] ≤20 }
//        kind "routine" data { name(≤12), cmds:[글 ≤80] ≤5 }
//   { op:"get", id, voter? }                      (누구나)  → { ok, share, tally, people, mine, owner }
//   { op:"vote", id, voter, nick, pick, on }      (누구나)  → places: pick "1"~"10" 켜기·끄기(여러 곳 가능) · trip: "go"|"no" 하나만 · routine: "take"
//   { op:"mine" }                                 (로그인)  → 내가 만든 링크 최근 20개 + 누른 사람 수
//   { op:"del", id }                              (로그인 · 만든 사람만) → 지우기
//   { op:"final", id, text }                      (로그인 · 만든 사람만 · v361) → "🎉 영금물회 저녁 7시 4명 예약했어요" 를 링크 맨 위에 (빈 글이면 지움)
//
// · 저장소: Supabase cf_share · cf_share_vote (sql/cf_share.sql 1번 실행). 서버(service_role)만 읽고 쓴다.
// · 친구는 가입하지 않는다. 브라우저가 만든 무작위 표시(voter)와 친구가 적은 별명만 저장한다 (이름·번호·이메일·IP·위치 저장 안 함).
// · 링크는 30일 뒤 열리지 않고 지워진다. 한 사람이 하루에 만들 수 있는 링크는 30개, 한 링크에 누를 수 있는 기록은 300개까지.
// · 루틴의 할 일과 여행 준비물에 전화·카드·계좌번호처럼 보이는 숫자(9자리 이상)가 있으면 만들지 않는다.

const KEEP_DAYS = 30;
const DAY_MAX = 30;
const VOTE_MAX = 300;
const KINDS = ['places', 'trip', 'routine'];

export async function onRequestPost(context) {
  const env = context.env || {};
  const c = sb(env);
  if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const op = String(b.op || '');
  try {
    if (op === 'get') return json(await get(c, context.request, b));
    if (op === 'vote') return json(await vote(c, b));
    const uid = await userId(context.request, c);
    if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
    if (op === 'create') return json(await create(c, uid, b, context.request));
    if (op === 'mine') return json(await mine(c, uid));
    if (op === 'final') return json(await setFinal(c, uid, b));
    if (op === 'del') {
      const id = cleanId(b.id);
      if (!id) return json({ error: '링크 번호가 없어요' }, 400);
      await req(c, 'DELETE', 'cf_share?id=eq.' + id + '&user_id=eq.' + uid);
      return json({ ok: true });
    }
    return json({ error: '잘못된 요청입니다' }, 400);
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    const m = String((e && e.message) || e);
    if (/cf_share/.test(m) && /404|42P01|does not exist|schema cache/.test(m)) return json({ error: '같이 정하기 표가 아직 없어요. Supabase 에서 sql/cf_share.sql 을 한 번 실행해 주세요.', setup: true }, 500);
    return json({ error: m.slice(0, 300) }, 500);
  }
}

/* ── 만들기 ── */
async function create(c, uid, b, request) {
  const kind = String(b.kind || '');
  if (!KINDS.includes(kind)) throw httpErr(400, '보낼 수 없는 종류예요');
  const title = clean(b.title, 60);
  if (!title) throw httpErr(400, '제목이 없어요');
  const sender = clean(b.sender, 12);
  const data = kind === 'places' ? placesData(b.data) : kind === 'trip' ? tripData(b.data) : routineData(b.data);
  if (looksPrivate(title) || looksPrivate(sender)) throw httpErr(400, '제목·별명에 전화·카드·계좌번호처럼 보이는 숫자는 넣을 수 없어요');

  const since = new Date(Date.now() - 86400e3).toISOString();
  const cnt = await req(c, 'GET', 'cf_share?select=id&user_id=eq.' + uid + '&created_at=gte.' + encodeURIComponent(since) + '&limit=' + (DAY_MAX + 1));
  if (Array.isArray(cnt) && cnt.length >= DAY_MAX) throw httpErr(429, '오늘은 링크를 ' + DAY_MAX + '개까지 만들 수 있어요. 내일 다시 만들어 주세요.');

  const expires_at = new Date(Date.now() + KEEP_DAYS * 86400e3).toISOString();
  let id = '';
  for (let i = 0; i < 4 && !id; i++) {
    const tryId = newId();
    try {
      await req(c, 'POST', 'cf_share', { id: tryId, user_id: uid, kind, title, sender, data, expires_at }, 'return=minimal');
      id = tryId;
    } catch (e) {
      if (!/409|23505|duplicate/.test(String(e && e.message))) throw e;
    }
  }
  if (!id) throw httpErr(500, '링크를 만들지 못했어요. 다시 시도해 주세요.');
  if (Math.random() < 0.05) await req(c, 'DELETE', 'cf_share?expires_at=lt.' + encodeURIComponent(new Date().toISOString())).catch(() => {});
  const origin = new URL(request.url).origin;
  return { ok: true, id, url: origin + '/s/' + id, expires_at };
}
function placesData(d) {
  d = d || {};
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 10).map((x) => {
    x = x || {};
    const url = String(x.url || '');
    const phone = String(x.phone || '').replace(/[^0-9+\-]/g, '').slice(0, 16);
    return {
      name: clean(x.name, 60),
      cat: clean(x.cat, 40),
      addr: clean(x.addr, 100),
      url: /^https:\/\/place\.map\.kakao\.com\/\d{1,15}$/.test(url) ? url : '',
      phone: phone.replace(/\D/g, '').length >= 7 ? phone : '',   /* 가게 번호(카카오 장소 정보에 공개된 번호)만 */
    };
  }).filter((x) => x.name);
  if (!items.length) throw httpErr(400, '보낼 장소가 없어요');
  return { q: clean(d.q, 100), items };
}
function tripData(d) {
  d = d || {};
  const steps = (Array.isArray(d.steps) ? d.steps : []).slice(0, 8).map((x) => {
    x = x || {};
    const u = String(x.u || '');
    return { icon: clean(x.icon, 4), name: clean(x.name, 20), desc: clean(x.desc, 120), u: /^https:\/\//i.test(u) && u.length <= 1200 && !/[?&](token|access_token|key|password|pw)=/i.test(u) ? u : '' };
  }).filter((x) => x.name);
  const checklist = (Array.isArray(d.checklist) ? d.checklist : []).slice(0, 20).map((t) => clean(t, 60)).filter(Boolean);
  if (!steps.length) throw httpErr(400, '보낼 계획이 없어요');
  if (steps.some((x) => looksPrivate(x.desc)) || checklist.some(looksPrivate)) throw httpErr(400, '전화·카드·계좌번호처럼 보이는 숫자는 보낼 수 없어요');
  return { sub: clean(d.sub, 160), steps, checklist };
}
function routineData(d) {
  d = d || {};
  const name = clean(d.name, 12).replace(/\s+/g, '');
  const cmds = (Array.isArray(d.cmds) ? d.cmds : []).slice(0, 5).map((t) => clean(t, 80)).filter(Boolean);
  if (!name || !cmds.length) throw httpErr(400, '보낼 루틴이 없어요');
  if (cmds.some(looksPrivate)) throw httpErr(400, '할 일에 전화·카드·계좌번호처럼 보이는 숫자가 있으면 보낼 수 없어요');
  return { name, cmds };
}

/* ── 보기 (누구나) ── */
async function get(c, request, b) {
  const id = cleanId(b.id);
  if (!id) throw httpErr(400, '링크 번호가 없어요');
  const s = await readShare(c, id);
  if (!s) return { ok: false, gone: true, error: '없는 링크이거나 30일이 지나 지워졌어요' };
  const votes = await req(c, 'GET', 'cf_share_vote?select=voter,pick,nick&share_id=eq.' + id + '&order=created_at.asc&limit=' + VOTE_MAX);
  const voter = cleanVoter(b.voter);
  let owner = false;
  if ((request.headers.get('Authorization') || '').length > 20) {
    const uid = await userId(request, c);
    owner = !!uid && uid === s.user_id;
  }
  return { ok: true, share: pub(s), owner, ...tally(votes, voter) };
}
async function readShare(c, id) {
  const r = await req(c, 'GET', 'cf_share?select=id,user_id,kind,title,sender,data,created_at,expires_at&id=eq.' + id + '&limit=1');
  const s = Array.isArray(r) && r[0];
  if (!s || new Date(s.expires_at).getTime() < Date.now()) return null;
  return s;
}
function pub(s) { return { id: s.id, kind: s.kind, title: s.title, sender: s.sender, data: s.data, created_at: s.created_at, expires_at: s.expires_at }; }
function tally(votes, voter) {
  const t = {}, people = new Set(), mine = [];
  (Array.isArray(votes) ? votes : []).forEach((v) => {
    people.add(v.voter);
    const k = String(v.pick);
    if (!t[k]) t[k] = { n: 0, nicks: [] };
    t[k].n++;
    if (t[k].nicks.length < 12) t[k].nicks.push(v.nick || '친구');
    if (voter && v.voter === voter) mine.push(k);
  });
  return { tally: t, people: people.size, mine };
}

/* ── 누르기 (누구나) ── */
async function vote(c, b) {
  const id = cleanId(b.id), voter = cleanVoter(b.voter);
  if (!id || !voter) throw httpErr(400, '잘못된 요청입니다');
  const s = await readShare(c, id);
  if (!s) return { ok: false, gone: true, error: '없는 링크이거나 30일이 지나 지워졌어요' };
  const pick = String(b.pick || '');
  const on = b.on !== false;
  const nick = clean(b.nick, 12).replace(/(?:\d[\s.\-]?){9,}/g, '') || '친구';
  if (s.kind === 'places') {
    const n = parseInt(pick, 10);
    const len = (s.data && Array.isArray(s.data.items) ? s.data.items.length : 0);
    if (!(n >= 1 && n <= len && String(n) === pick)) throw httpErr(400, '없는 번호예요');
  } else if (s.kind === 'trip') {
    if (pick !== 'go' && pick !== 'no') throw httpErr(400, '잘못된 선택이에요');
  } else if (pick !== 'take') throw httpErr(400, '잘못된 선택이에요');

  const base = 'cf_share_vote?share_id=eq.' + id + '&voter=eq.' + voter;
  if (!on) {
    await req(c, 'DELETE', base + '&pick=eq.' + encodeURIComponent(pick));
  } else {
    const all = await req(c, 'GET', 'cf_share_vote?select=voter&share_id=eq.' + id + '&limit=' + (VOTE_MAX + 1));
    const mineNow = (Array.isArray(all) ? all : []).some((v) => v.voter === voter);
    if (Array.isArray(all) && all.length >= VOTE_MAX && !mineNow) throw httpErr(429, '이 링크는 누른 사람이 너무 많아 더 받을 수 없어요');
    if (s.kind === 'trip') await req(c, 'DELETE', base + '&pick=in.(go,no)');
    await req(c, 'POST', 'cf_share_vote', { share_id: id, voter, pick, nick }, 'resolution=merge-duplicates,return=minimal');
    /* 별명을 바꿨으면 이 사람의 다른 표에도 같이 */
    await req(c, 'PATCH', base, { nick }, 'return=minimal').catch(() => {});
  }
  const votes = await req(c, 'GET', 'cf_share_vote?select=voter,pick,nick&share_id=eq.' + id + '&order=created_at.asc&limit=' + VOTE_MAX);
  return { ok: true, ...tally(votes, voter) };
}

/* ── v361 확정 알림: 만든 사람이 예약을 확정하면 친구 화면 맨 위에 한 줄 ── */
async function setFinal(c, uid, b) {
  const id = cleanId(b.id);
  if (!id) throw httpErr(400, '링크 번호가 없어요');
  const r = await req(c, 'GET', 'cf_share?select=id,user_id,data,expires_at&id=eq.' + id + '&user_id=eq.' + uid + '&limit=1');
  const s = Array.isArray(r) && r[0];
  if (!s || new Date(s.expires_at).getTime() < Date.now()) throw httpErr(404, '없는 링크이거나 30일이 지나 지워졌어요');
  const text = clean(b.text, 80);
  if (looksPrivate(text)) throw httpErr(400, '전화·카드·계좌번호처럼 보이는 숫자는 넣을 수 없어요');
  const data = Object.assign({}, s.data || {});
  if (text) data.final = { text, at: new Date().toISOString() }; else delete data.final;
  await req(c, 'PATCH', 'cf_share?id=eq.' + id + '&user_id=eq.' + uid, { data }, 'return=minimal');
  return { ok: true, final: data.final || null };
}

/* ── 내가 만든 링크 ── */
async function mine(c, uid) {
  const now = encodeURIComponent(new Date().toISOString());
  const r = await req(c, 'GET', 'cf_share?select=id,kind,title,created_at,expires_at&user_id=eq.' + uid + '&expires_at=gt.' + now + '&order=created_at.desc&limit=20');
  const items = Array.isArray(r) ? r : [];
  if (items.length) {
    const ids = items.map((x) => x.id).join(',');
    const v = await req(c, 'GET', 'cf_share_vote?select=share_id,voter&share_id=in.(' + ids + ')&limit=2000');
    const m = {};
    (Array.isArray(v) ? v : []).forEach((x) => { (m[x.share_id] = m[x.share_id] || new Set()).add(x.voter); });
    items.forEach((x) => { x.people = m[x.id] ? m[x.id].size : 0; });
  }
  return { ok: true, items };
}

/* ── 공용 (trail.js 와 같은 방식) ── */
function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function looksPrivate(s) { return /(?:\d[\s.\-]?){9,}/.test(String(s || '')); }
function cleanId(v) { const s = String(v || ''); return /^[A-Za-z0-9]{8}$/.test(s) ? s : ''; }
function cleanVoter(v) { const s = String(v || ''); return /^[a-z0-9]{12,32}$/.test(s) ? s : ''; }
function newId() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const r = new Uint8Array(8); crypto.getRandomValues(r);
  let s = ''; for (const x of r) s += A[x % A.length];
  return s;
}
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
  if (!r.ok) throw new Error('cf_share DB ' + r.status + ': ' + t.slice(0, 200));
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
