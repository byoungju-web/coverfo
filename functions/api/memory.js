// functions/api/memory.js — coverfo 🧠 내 비서 기억 (v366) · 기억 저장·보기·지우기는 무료 (🔔 먼저 챙기기만 크레딧 — hub.js cron)
// © 2026 coverfo All Rights Reserved
//
// POST /api/memory   (Authorization: Bearer coverfo 로그인키)
//   { op:"get" }                         → { on, nudge, nudgeCost, items, me, now:{reminds,shares,parcels}, trail:{on} }  기억 센터 한 번에
//   { op:"add", text, cat, src }         → 기억 한 줄 (켜져 있을 때만 · 같은 말이면 한 번만 · 200개까지)
//   { op:"edit", id, text, cat }         → 고치기
//   { op:"forget", id } | { op:"forget", q } | { op:"forget", src:"book" } | { op:"forget", range:"all" } → 지우기 (q 는 가장 잘 맞는 1줄)
//   { op:"find", q }                     → 기억 · 🧠 포도야 내 기억 · ⏰ 알림 · 👥 같이 정하기 · 📦 택배 · 👣 발자취(켠 경우 30일)에서 함께 찾기 (소리 my_memory)
//   { op:"set", on?, nudge? }            → 기억하기 켜기·끄기 · 🔔 먼저 챙기기 켜기·끄기
//   { op:"book", days:[{name,day,kind}], foods:[{name,food}] } → 📒 이름·생일/기념일·늘 먹던 것만 올리기 (전화·계좌·주소는 받지 않음)
//   { op:"suggest" }                     → 👣 발자취(켠 경우)에서 자주 하는 일을 찾아 "이거 기억할까요?" 최대 3개 (저장은 이용자가 누를 때만)
//   { op:"dismiss", key }                → 그 제안은 다시 묻지 않기
//
// · 저장소: Supabase cf_memory · cf_memory_set (sql/cf_memory.sql 1번 실행). 서버(service_role)만 읽고 쓴다.
// · 저장하지 않는 것: 건강·병명·약, 긴 숫자(전화·카드·계좌처럼 보이는 것), 비밀번호·주민번호. 다른 표(cf_me·cf_remind·cf_share·cf_parcel·cf_trail)는 읽기만 한다.

const CATS = ['me', 'person', 'place', 'like', 'habit'];
const SRCS = ['talk', 'home', 'center', 'book', 'habit'];
const MAX_ITEMS = 200;
const NUDGE_COST = 1;

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
    if (op === 'get') return json(await getAll(env, c, uid));
    if (op === 'add') return json(await add(c, uid, b));
    if (op === 'edit') return json(await edit(c, uid, b));
    if (op === 'forget') return json(await forget(c, uid, b));
    if (op === 'find') return json(await find(c, uid, String(b.q || '')));
    if (op === 'set') return json(await setOpt(c, uid, b));
    if (op === 'book') return json(await book(c, uid, b));
    if (op === 'suggest') return json(await suggest(c, uid));
    if (op === 'dismiss') return json(await dismiss(c, uid, b));
    return json({ error: '잘못된 요청입니다' }, 400);
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    const m = String((e && e.message) || e);
    if (/cf_memory/.test(m) && /404|42P01|does not exist|schema cache/.test(m)) return json({ error: '기억 표가 아직 없어요. Supabase 에서 sql/cf_memory.sql 을 한 번 실행해 주세요.', setup: true }, 500);
    return json({ error: m.slice(0, 300) }, 500);
  }
}

/* ── 저장하면 안 되는 내용 (서버가 막음) ── */
function blockedWhy(t) {
  const s = String(t || '');
  if (/(?:\d[\s.\-]?){9,}/.test(s)) return '전화·카드·계좌번호처럼 긴 숫자는 기억하지 않아요';
  if (/(비밀\s*번호|비번|패스워드|password|pw\s*[:：]|주민\s*(등록)?\s*번호|여권\s*번호|카드\s*번호|계좌\s*번호|cvc|otp)/i.test(s)) return '비밀번호·주민번호·카드·계좌 정보는 기억하지 않아요';
  if (/(병원|진단|질환|질병|병명|암\s*(이|환자|투병|진단)|당뇨|고혈압|혈압|우울|공황|불안\s*장애|정신과|상담\s*치료|치료\s*중|약\s*(먹|복용|처방)|복용|처방|수술|임신|알레르기|알러지|장애|투병|아토피|천식|갑상선|간염|심장\s*병|ADHD|adhd)/.test(s)) return '건강·병원·약 이야기는 기억하지 않아요';
  return '';
}
function guessCat(t) {
  const s = String(t || '');
  if (/(매일|매주|매달|항상|늘|자주|보통|평일|주말|마다|요일에|출근|퇴근|아침에|저녁에)/.test(s)) return 'habit';
  if (/(엄마|아빠|어머니|아버지|부모님|형|누나|오빠|언니|동생|아내|남편|와이프|신랑|아들|딸|여자\s*친구|남자\s*친구|여친|남친|친구|할머니|할아버지|장모|장인|시어머니|시아버지|삼촌|이모|고모|사장님|팀장|선배|후배|생일|기념일)/.test(s)) return 'person';
  if (/(좋아|싫어|못\s*먹|안\s*먹|선호|취향|입맛|매운|단\s*거|짠\s*거|자리|창가|조용한|비건|채식|할랄|금연|흡연)/.test(s)) return 'like';
  if (/(집|회사|사무실|단골|가게|식당|카페|역\b|동네|주차|헬스장|학원|학교)/.test(s)) return 'place';
  return 'me';
}
function cleanText(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(그리고|그럼|음|아|저기)\s+/, '')
    .replace(/\s*(이?라고|고)?\s*(꼭\s*)?(기억\s*(해|해\s*줘|해\s*둬|해\s*놔|해\s*주세요|해\s*줄래|하고\s*있어)|잊지\s*(마|말아\s*줘|마세요))\s*[.!~]*$/, '')
    .replace(/^(꼭\s*)?(기억\s*해\s*(줘|둬)?|기억해)\s*[:：,]?\s*/, '')
    .replace(/[.!~]+$/, '').trim().slice(0, 120);
}
function norm(s) { return String(s || '').toLowerCase().replace(/[\s·,.!?~'"()\-_]/g, ''); }
function words(q) {
  return String(q || '').toLowerCase().replace(/[^\w가-힣\s]/g, ' ').split(/\s+/)
    .map((w) => { const x = w.replace(/(이랑|랑|하고|에서|으로|이가|은|는|이|가|을|를|의|도|에|로|야|아|님|씨)$/, ''); return x.length >= 2 ? x : w; })
    .filter((w) => w.length >= 1 && !/^(거|것|건|좀|내|나|제|저|뭐|뭐야|뭐였지|알려|알려줘|줘|좀|그거|그|그때|기억|기억해|잊어|지워|했지|한다고|라고|있어|있지|좋아한다고|했던)$/.test(w));
}
function score(text, ws) {
  if (!ws.length) return 0;
  const n = norm(text);
  let s = 0;
  for (const w of ws) if (n.includes(norm(w))) s += norm(w).length >= 2 ? 2 : 1;
  return s;
}

async function settings(c, uid) {
  const r = await req(c, 'GET', 'cf_memory_set?select=*&user_id=eq.' + uid + '&limit=1');
  const row = Array.isArray(r) && r[0] ? r[0] : null;
  return { on: row ? row.is_on !== false : true, nudge: !!(row && row.nudge), dismissed: (row && Array.isArray(row.dismissed)) ? row.dismissed : [], row };
}
async function items(c, uid, limit) {
  const r = await req(c, 'GET', 'cf_memory?select=id,cat,text,src,key,meta,created_at,updated_at&user_id=eq.' + uid + '&order=updated_at.desc&limit=' + (limit || MAX_ITEMS));
  return Array.isArray(r) ? r : [];
}
function nudgeCost(env) { const v = env.MEMORY_NUDGE_COST; const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : NUDGE_COST; }

/* ── 기억 센터 한 번에: 기억 + 연결된 기능(읽기만) ── */
async function getAll(env, c, uid) {
  const st = await settings(c, uid);
  const list = await items(c, uid);
  const out = { ok: true, on: st.on, nudge: st.nudge, nudgeCost: nudgeCost(env), max: MAX_ITEMS, items: list.map(pub), me: null, now: { reminds: [], shares: [], parcels: [] }, trail: { on: false } };
  const soft = (p) => p.catch(() => null);
  const [me, rm, sh, pc, tr] = await Promise.all([
    soft(req(c, 'GET', 'cf_me?select=data&user_id=eq.' + uid + '&limit=1')),
    soft(req(c, 'GET', 'cf_remind?select=id,text,kind,next_at&user_id=eq.' + uid + '&is_on=eq.true&order=next_at.asc&limit=5')),
    soft(req(c, 'GET', 'cf_share?select=id,kind,title,data,created_at,expires_at&user_id=eq.' + uid + '&expires_at=gt.' + encodeURIComponent(new Date().toISOString()) + '&order=created_at.desc&limit=5')),
    soft(req(c, 'GET', 'cf_parcel?select=id,carrier,invoice,label,status,done,notify&user_id=eq.' + uid + '&order=created_at.desc&limit=5')),
    soft(req(c, 'GET', 'cf_trail_set?select=is_on&user_id=eq.' + uid + '&limit=1')),
  ]);
  const md = Array.isArray(me) && me[0] && me[0].data && typeof me[0].data === 'object' ? me[0].data : null;
  if (md) out.me = { name: clean(md.name, 30), aname: clean(md.aname, 12), facts: (Array.isArray(md.facts) ? md.facts : []).map((f) => clean(f, 120)).filter(Boolean).slice(0, 12) };
  if (Array.isArray(rm)) out.now.reminds = rm.map((r) => ({ id: r.id, text: clean(r.text, 60), kind: r.kind, next_at: r.next_at }));
  if (Array.isArray(sh) && sh.length) {
    const votes = await soft(req(c, 'GET', 'cf_share_vote?select=share_id,voter&share_id=in.(' + sh.map((s) => encodeURIComponent(s.id)).join(',') + ')&limit=2000'));
    out.now.shares = sh.map((s) => {
      const vs = new Set((Array.isArray(votes) ? votes : []).filter((v) => v.share_id === s.id).map((v) => v.voter));
      const fin = s.data && s.data.final && s.data.final.text ? clean(s.data.final.text, 80) : '';
      return { id: s.id, kind: s.kind, title: clean(s.title, 40), friends: vs.size, final: fin, expires_at: s.expires_at };
    });
  }
  if (Array.isArray(pc)) out.now.parcels = pc.filter((p) => p.notify || !p.done).map((p) => ({ id: p.id, name: clean(p.label, 30) || ((p.carrier || '택배') + ' ' + String(p.invoice || '').slice(-4)), status: clean(p.status, 20), done: !!p.done }));
  out.trail.on = !!(Array.isArray(tr) && tr[0] && tr[0].is_on);
  return out;
}
function pub(r) { return { id: r.id, cat: r.cat, text: r.text, src: r.src, meta: r.meta || {}, at: r.updated_at || r.created_at }; }

async function add(c, uid, b) {
  const text = cleanText(b.text);
  if (text.length < 2) throw httpErr(400, '무엇을 기억할지 알려 주세요');
  const why = blockedWhy(text);
  if (why) return { ok: false, blocked: true, note: why };
  const st = await settings(c, uid);
  if (!st.on) return { ok: false, off: true, note: '🧠 기억하기가 꺼져 있어요. 기억 센터에서 켤 수 있어요' };
  const cat = CATS.includes(b.cat) ? b.cat : guessCat(text);
  const src = SRCS.includes(b.src) ? b.src : 'home';
  const list = await items(c, uid);
  const same = list.find((x) => norm(x.text) === norm(text));
  if (same) return { ok: true, same: true, item: pub(same), saved: same.text };
  if (list.length >= MAX_ITEMS) throw httpErr(409, '기억은 ' + MAX_ITEMS + '개까지예요. 안 쓰는 것을 지워 주세요');
  const row = { user_id: uid, cat, text, src };
  if (typeof b.key === 'string' && /^h:[\w가-힣]{1,60}$/.test(b.key)) row.key = b.key;
  const r = await req(c, 'POST', 'cf_memory', row, 'return=representation');
  const it = Array.isArray(r) && r[0] ? r[0] : row;
  return { ok: true, item: pub(it), saved: text, cat };
}
async function edit(c, uid, b) {
  if (!/^\d{1,18}$/.test(String(b.id || ''))) throw httpErr(400, '어느 기억인지 알려 주세요');
  const text = cleanText(b.text);
  if (text.length < 2) throw httpErr(400, '내용을 적어 주세요');
  const why = blockedWhy(text);
  if (why) return { ok: false, blocked: true, note: why };
  const up = { text, updated_at: new Date().toISOString() };
  if (CATS.includes(b.cat)) up.cat = b.cat;
  const r = await req(c, 'PATCH', 'cf_memory?user_id=eq.' + uid + '&id=eq.' + String(b.id), up, 'return=representation');
  if (!Array.isArray(r) || !r.length) throw httpErr(404, '그 기억을 찾지 못했어요');
  return { ok: true, item: pub(r[0]) };
}
async function forget(c, uid, b) {
  if (b.id != null && /^\d{1,18}$/.test(String(b.id))) { await req(c, 'DELETE', 'cf_memory?user_id=eq.' + uid + '&id=eq.' + String(b.id)); return { ok: true }; }
  if (b.range === 'all') { await req(c, 'DELETE', 'cf_memory?user_id=eq.' + uid); return { ok: true, all: true }; }
  if (b.src === 'book') { await req(c, 'DELETE', 'cf_memory?user_id=eq.' + uid + '&src=eq.book'); return { ok: true }; }
  const ws = words(b.q);
  if (!ws.length) throw httpErr(400, '무엇을 지울지 알려 주세요');
  const list = await items(c, uid);
  let best = null, bs = 0;
  for (const x of list) { const s = score(x.text, ws); if (s > bs) { bs = s; best = x; } }
  if (!best) return { ok: false, none: true, note: '그런 기억이 없어요' };
  await req(c, 'DELETE', 'cf_memory?user_id=eq.' + uid + '&id=eq.' + best.id);
  return { ok: true, forgot: best.text };
}

/* ── 함께 찾기 (소리 my_memory · "내가 뭐 좋아한다고 했지?") ── */
async function find(c, uid, q) {
  const ws = words(q);
  const all = await getAll({}, c, uid);
  const hits = [];
  const push = (from, text, s, extra) => { if (s > 0) hits.push(Object.assign({ from, text, s }, extra || {})); };
  const wide = !ws.length || /(전부|다|모두|뭐\s*있|진행|요즘|지금)/.test(q);
  for (const x of all.items) push('memory', x.text, wide ? 1 : score(x.text, ws), { kind: x.cat });
  if (all.me) {
    if (all.me.name) push('profile', '부르는 이름: ' + all.me.name, wide ? 1 : score('호칭 이름 ' + all.me.name, ws));
    all.me.facts.forEach((f) => push('profile', f, wide ? 1 : score(f, ws)));
  }
  const nowAsk = /(진행|요즘|지금|할\s*일|일정|알림|택배|배송|링크|투표|같이\s*정|친구)/.test(q);
  const nw = nowAsk ? 3 : wide ? 1 : 0;
  all.now.reminds.forEach((r) => push('reminder', r.text + ' · ' + r.kind, nw || score(r.text + ' 알림', ws), { next_at: r.next_at }));
  all.now.shares.forEach((s) => push('decide_together', (s.title || '같이 정하기') + ' · 친구 ' + s.friends + '명' + (s.final ? ' · 확정: ' + s.final : ''), nw || score(s.title + ' 같이 정하기 링크 친구', ws)));
  all.now.parcels.forEach((p) => push('parcel', p.name + (p.status ? ' · ' + p.status : ''), nw || score(p.name + ' 택배 배송', ws)));
  if (all.trail.on && ws.length) {
    const tr = await req(c, 'GET', 'cf_trail?select=kind,title,label,created_at&user_id=eq.' + uid + '&created_at=gte.' + encodeURIComponent(new Date(Date.now() - 30 * 86400e3).toISOString()) + '&order=created_at.desc&limit=300').catch(() => []);
    (Array.isArray(tr) ? tr : []).forEach((t) => push('activity', clean(t.title, 60) + (t.label ? ' → ' + clean(t.label, 40) : ''), score(t.title + ' ' + t.label, ws), { when: t.created_at }));
  }
  hits.sort((a, b) => b.s - a.s);
  const seen = new Set(), res = [];
  for (const h of hits) { const k = h.from + norm(h.text); if (seen.has(k)) continue; seen.add(k); delete h.s; res.push(h); if (res.length >= 8) break; }
  return { ok: true, on: all.on, trail: all.trail.on, items: res };
}

async function setOpt(c, uid, b) {
  const row = { user_id: uid, updated_at: new Date().toISOString() };
  if (typeof b.on === 'boolean') row.is_on = b.on;
  if (typeof b.nudge === 'boolean') row.nudge = b.nudge;
  if (Object.keys(row).length < 3) throw httpErr(400, '무엇을 바꿀지 알려 주세요');
  await req(c, 'POST', 'cf_memory_set', row, 'resolution=merge-duplicates,return=minimal');
  const st = await settings(c, uid);
  return { ok: true, on: st.on, nudge: st.nudge };
}

/* ── 📒 올리기: 이름 · 생일/기념일(MM-DD) · 늘 먹던 것만. 다시 올리면 전에 올린 것을 바꿔 넣는다 ── */
async function book(c, uid, b) {
  const st = await settings(c, uid);
  if (!st.on) return { ok: false, off: true, note: '🧠 기억하기가 꺼져 있어요' };
  const rows = [], keys = new Set();
  const nm = (v) => clean(v, 20).replace(/(?:\d[\s.\-]?){4,}/g, '').trim();
  for (const d of (Array.isArray(b.days) ? b.days : []).slice(0, 60)) {
    const name = nm(d && d.name), day = String((d && d.day) || ''), kind = clean(d && d.kind, 12).replace(/\d/g, '') || '기념일';
    const m = day.match(/^(\d{2})-(\d{2})$/);
    if (!name || !m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > 31) continue;
    const text = name + ' · ' + kind + ' ' + (+m[1]) + '월 ' + (+m[2]) + '일';
    const key = 'book:day:' + norm(name) + ':' + norm(kind);
    if (blockedWhy(text) || keys.has(key)) continue;
    keys.add(key);
    rows.push({ user_id: uid, cat: 'person', text, src: 'book', key, meta: { name, day, kind } });
  }
  for (const f of (Array.isArray(b.foods) ? b.foods : []).slice(0, 40)) {
    const name = nm(f && f.name), food = clean(f && f.food, 60).replace(/(?:\d[\s.\-]?){7,}/g, '').trim();
    if (!name || !food) continue;
    const text = '늘 먹던 것 · ' + name + ': ' + food;
    const key = 'book:food:' + norm(name);
    if (blockedWhy(text) || keys.has(key)) continue;
    keys.add(key);
    rows.push({ user_id: uid, cat: 'like', text, src: 'book', key, meta: { name } });
  }
  const others = (await items(c, uid)).filter((x) => x.src !== 'book').length;
  if (others + rows.length > MAX_ITEMS) throw httpErr(409, '기억은 ' + MAX_ITEMS + '개까지예요');
  await req(c, 'DELETE', 'cf_memory?user_id=eq.' + uid + '&src=eq.book');
  if (rows.length) await req(c, 'POST', 'cf_memory', rows, 'return=minimal');
  return { ok: true, days: rows.filter((r) => r.cat === 'person').length, foods: rows.filter((r) => r.cat === 'like').length };
}

/* ── 습관 제안: 발자취 30일에서 같은 말을 3번 넘게 했거나, 같은 요일에 3번 ── */
const WD = '일월화수목금토';
async function suggest(c, uid) {
  const tr = await req(c, 'GET', 'cf_trail_set?select=is_on&user_id=eq.' + uid + '&limit=1').catch(() => []);
  if (!(Array.isArray(tr) && tr[0] && tr[0].is_on)) return { ok: true, trail: false, items: [] };
  const st = await settings(c, uid);
  if (!st.on) return { ok: true, trail: true, off: true, items: [] };
  const rows = await req(c, 'GET', 'cf_trail?select=kind,title,created_at&user_id=eq.' + uid + '&created_at=gte.' + encodeURIComponent(new Date(Date.now() - 30 * 86400e3).toISOString()) + '&order=created_at.desc&limit=500').catch(() => []);
  const mem = (await items(c, uid)).map((x) => norm(x.text));
  const cnt = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const t = clean(r.title, 30);
    if (t.length < 2 || blockedWhy(t)) continue;
    const n = norm(t);
    const wd = new Date(Date.parse(r.created_at) + 9 * 3600e3).getUTCDay();
    const e = cnt.get(n) || { t, all: 0, wd: [0, 0, 0, 0, 0, 0, 0] };
    e.all++; e.wd[wd]++;
    cnt.set(n, e);
  }
  const out = [];
  for (const [n, e] of [...cnt.entries()].sort((a, b) => b[1].all - a[1].all)) {
    if (e.all < 3) break;
    if (mem.some((m) => m.includes(n))) continue;
    const key = 'h:' + n.slice(0, 40);
    if (st.dismissed.includes(key)) continue;
    const top = e.wd.indexOf(Math.max(...e.wd));
    const text = e.wd[top] >= 3 ? WD.charAt(top) + '요일마다 "' + e.t + '"' : '자주 하는 것: "' + e.t + '"';
    out.push({ key, cat: 'habit', text, count: e.all });
    if (out.length >= 3) break;
  }
  return { ok: true, trail: true, items: out };
}
async function dismiss(c, uid, b) {
  const key = String(b.key || '');
  if (!/^h:[\w가-힣]{1,60}$/.test(key)) throw httpErr(400, '잘못된 요청입니다');
  const st = await settings(c, uid);
  const list = st.dismissed.filter((k) => k !== key).concat([key]).slice(-100);
  await req(c, 'POST', 'cf_memory_set', { user_id: uid, dismissed: list, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
  return { ok: true };
}

/* ── 공용 ── */
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
  if (!r.ok) throw new Error(path.split('?')[0] + ' DB ' + r.status + ': ' + t.slice(0, 200));
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
