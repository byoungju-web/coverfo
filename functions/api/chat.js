// functions/api/chat.js — coverfo 💬 채팅 · 👥 일반채팅 (v296) · 포도톡을 거치지 않고 coverfo 안에서 도는 채팅
// © 2026 coverfo All Rights Reserved
//
// POST /api/chat  (Authorization: Bearer coverfo 로그인키) · 무료 (크레딧을 쓰지 않음)
//   { op:'rooms', kind }                       → 내 방 목록 (kind: direct = 💬 1:1 | group = 👥 일반채팅·오픈채팅)
//   { op:'public', q }                         → 🌏 오픈채팅 목록 (누구나 들어오는 방 · q 로 이름 찾기)
//   { op:'create', kind, name, nick, pub }     → 방 만들기 { room }  (초대: coverfo.com/#c=코드)
//   { op:'join', code | room, nick }           → 코드로 참여 · 오픈채팅은 방 id 로 참여
//   { op:'msgs', room, after }                 → 새 메시지 + 참여자 (내가 차단한 사람의 말은 빠짐)
//   { op:'send', room, text }                  → 보내기
//   { op:'rename', room, name }                → (만든 사람) 방 이름 바꾸기
//   { op:'nick', room, nick }                  → 이 방에서 내 이름 바꾸기
//   { op:'leave', room } · { op:'delete', room } → 나가기 · (만든 사람) 방 지우기
//   { op:'block', msg } · { op:'unblock_all' } → 그 말을 한 사람 차단 · 차단 모두 풀기
//   { op:'report', msg, reason }               → 신고 (cf_chat_reports 에 쌓임)
// · 필요한 것: sql/cf_chat.sql 1회 실행. 대화는 30일 뒤 자동 삭제 (요청 중 가끔 지움).
// · 결제·크레딧 코드는 쓰지도 건드리지도 않는다.

const MAX_TEXT = 1000;
const KEEP_DAYS = 30;
const LIMIT = { direct: 2, group: 100 };

export async function onRequestPost(context) {
  const env = context.env || {};
  const c = sb(env);
  if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const op = String(b.op || '');
  const user = await getUser(c, context.request);
  if (!user) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const uid = user.id;
  try {
    if (Math.random() < 0.05) cleanup(c).catch(() => {});
    if (op === 'rooms') return json({ ok: true, rooms: await rooms(c, uid, b.kind === 'direct' ? 'direct' : 'group') });
    if (op === 'public') return json({ ok: true, rooms: await publicRooms(c, uid, b.q) });
    if (op === 'create') return json(await create(c, uid, user, b));
    if (op === 'join') return json(await join(c, uid, user, b));
    if (op === 'msgs') return json(await msgs(c, uid, b));
    if (op === 'send') return json(await send(c, uid, b));
    if (op === 'rename') return json(await rename(c, uid, b));
    if (op === 'nick') return json(await setNick(c, uid, user, b));
    if (op === 'leave') return json(await leave(c, uid, b, false));
    if (op === 'delete') return json(await leave(c, uid, b, true));
    if (op === 'block') return json(await block(c, uid, b));
    if (op === 'unblock_all') { await del(c, `cf_chat_blocks?user_id=eq.${uid}`); return json({ ok: true }); }
    if (op === 'report') return json(await report(c, uid, b));
  } catch (e) {
    return json({ error: String((e && e.message) || e).slice(0, 300) }, e && e.status ? e.status : 500);
  }
  return json({ error: '잘못된 요청입니다' }, 400);
}

/* ───────────── 방 ───────────── */

const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
function nickOf(user, n) { return clean(n, 20) || String(user.email || '').split('@')[0].slice(0, 20) || '나'; }
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = new Uint8Array(6); crypto.getRandomValues(r);
  return Array.from(r, (x) => A[x % A.length]).join('');
}
function idOk(v) { return /^[0-9a-f-]{36}$/.test(String(v || '')); }
async function member(c, uid, room) {
  if (!idOk(room)) throw httpErr(400, '방 정보가 없습니다');
  const m = (await get(c, `cf_chat_members?select=*&room_id=eq.${room}&user_id=eq.${uid}`))[0];
  if (!m) throw httpErr(403, '이 방에 들어가 있지 않아요');
  return m;
}
function roomOut(r, uid, count) {
  return { id: r.id, code: r.code, kind: r.kind, pub: !!r.is_public, name: r.name, mine: r.owner === uid, members: count, last_body: r.last_body || '', last_nick: r.last_nick || '', last_at: r.last_at };
}
async function counts(c, ids) {
  if (!ids.length) return {};
  const mem = await get(c, `cf_chat_members?select=room_id&room_id=in.(${ids.join(',')})`);
  const n = {}; mem.forEach((m) => { n[m.room_id] = (n[m.room_id] || 0) + 1; });
  return n;
}
async function rooms(c, uid, kind) {
  const mine = await get(c, `cf_chat_members?select=room_id&user_id=eq.${uid}`);
  if (!mine.length) return [];
  const rs = await get(c, `cf_chat_rooms?select=*&id=in.(${mine.map((m) => m.room_id).join(',')})&kind=eq.${kind}&order=last_at.desc&limit=100`);
  const n = await counts(c, rs.map((r) => r.id));
  return rs.map((r) => roomOut(r, uid, n[r.id] || 0));
}
async function publicRooms(c, uid, q) {
  const s = clean(q, 30).replace(/[%*,()."'\\]/g, '');
  const rs = await get(c, `cf_chat_rooms?select=*&is_public=eq.true&kind=eq.group${s ? '&name=ilike.*' + encodeURIComponent(s) + '*' : ''}&order=last_at.desc&limit=50`);
  const n = await counts(c, rs.map((r) => r.id));
  const mine = rs.length ? await get(c, `cf_chat_members?select=room_id&user_id=eq.${uid}&room_id=in.(${rs.map((r) => r.id).join(',')})`) : [];
  const inn = new Set(mine.map((m) => m.room_id));
  return rs.map((r) => Object.assign(roomOut(r, uid, n[r.id] || 0), { joined: inn.has(r.id) }));
}
async function create(c, uid, user, b) {
  const kind = b.kind === 'direct' ? 'direct' : 'group';
  const pub = kind === 'group' && !!b.pub;
  const name = clean(b.name, 30) || (kind === 'direct' ? '1:1 채팅' : pub ? '오픈채팅' : '일반채팅');
  if (pub && name.length < 2) throw httpErr(400, '오픈채팅은 방 이름을 2글자 이상 적어 주세요');
  let room = null;
  for (let i = 0; i < 4 && !room; i++) {
    const r = await post(c, 'cf_chat_rooms', { code: newCode(), kind, is_public: pub, name, owner: uid });
    if (r.ok) room = r.rows[0];
  }
  if (!room) throw httpErr(500, '방을 만들지 못했어요. sql/cf_chat.sql 을 실행했는지 확인해 주세요.');
  await post(c, 'cf_chat_members', { room_id: room.id, user_id: uid, nick: nickOf(user, b.nick) });
  return { ok: true, room: roomOut(room, uid, 1) };
}
async function join(c, uid, user, b) {
  let room = null;
  if (b.room) {
    if (!idOk(b.room)) throw httpErr(400, '방 정보가 없습니다');
    room = (await get(c, `cf_chat_rooms?select=*&id=eq.${b.room}`))[0];
    if (!room) throw httpErr(404, '없어진 방이에요');
    if (!room.is_public) { const me = (await get(c, `cf_chat_members?select=user_id&room_id=eq.${room.id}&user_id=eq.${uid}`))[0]; if (!me) throw httpErr(403, '초대 코드로만 들어갈 수 있는 방이에요'); }
  } else {
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (code.length !== 6) throw httpErr(400, '초대 코드 6자리를 넣어 주세요');
    room = (await get(c, `cf_chat_rooms?select=*&code=eq.${code}`))[0];
    if (!room) throw httpErr(404, '그 코드의 채팅방이 없어요');
  }
  const ms = await get(c, `cf_chat_members?select=user_id&room_id=eq.${room.id}`);
  if (!ms.some((m) => m.user_id === uid)) {
    if (ms.length >= (LIMIT[room.kind] || 2)) throw httpErr(409, room.kind === 'direct' ? '1:1 채팅방은 2명까지예요' : '이 방은 꽉 찼어요 (' + LIMIT.group + '명)');
    await post(c, 'cf_chat_members', { room_id: room.id, user_id: uid, nick: nickOf(user, b.nick) });
    ms.push({ user_id: uid });
  }
  return { ok: true, room: roomOut(room, uid, ms.length) };
}
async function msgs(c, uid, b) {
  const me = await member(c, uid, b.room);
  const after = Math.max(0, parseInt(b.after, 10) || 0);
  const room = (await get(c, `cf_chat_rooms?select=*&id=eq.${b.room}`))[0];
  const ms = await get(c, `cf_chat_members?select=user_id,nick&room_id=eq.${b.room}&order=joined_at.asc`);
  const bl = new Set((await get(c, `cf_chat_blocks?select=blocked&user_id=eq.${uid}`)).map((x) => x.blocked));
  const since = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  const rows = await get(c, `cf_chat_msgs?select=id,user_id,nick,body,created_at&room_id=eq.${b.room}&id=gt.${after}&created_at=gt.${since}&order=id.${after ? 'asc' : 'desc'}&limit=${after ? 100 : 60}`);
  if (!after) rows.reverse();
  return {
    ok: true,
    room: room ? roomOut(room, uid, ms.length) : null,
    me: { nick: me.nick },
    members: ms.map((m) => ({ nick: m.nick, me: m.user_id === uid, owner: room && m.user_id === room.owner })),
    blocked: bl.size,
    msgs: rows.map((m) => (bl.has(m.user_id) ? { id: m.id, hidden: true } : { id: m.id, mine: m.user_id === uid, nick: m.nick, text: m.body, at: m.created_at })),
  };
}
async function send(c, uid, b) {
  const me = await member(c, uid, b.room);
  const text = String(b.text || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, MAX_TEXT);
  if (!text) throw httpErr(400, '보낼 말을 적어 주세요');
  const r = await post(c, 'cf_chat_msgs', { room_id: b.room, user_id: uid, nick: me.nick, body: text });
  if (!r.ok) throw httpErr(500, '메시지를 저장하지 못했어요');
  await patch(c, `cf_chat_rooms?id=eq.${b.room}`, { last_body: text.slice(0, 80), last_nick: me.nick, last_at: new Date().toISOString() }).catch(() => {});
  return { ok: true, id: r.rows[0] && r.rows[0].id };
}
async function rename(c, uid, b) {
  await member(c, uid, b.room);
  const room = (await get(c, `cf_chat_rooms?select=owner&id=eq.${b.room}`))[0];
  if (!room || room.owner !== uid) throw httpErr(403, '방을 만든 사람만 이름을 바꿀 수 있어요');
  const name = clean(b.name, 30);
  if (!name) throw httpErr(400, '방 이름을 적어 주세요');
  await patch(c, `cf_chat_rooms?id=eq.${b.room}`, { name });
  return { ok: true, name };
}
async function setNick(c, uid, user, b) {
  await member(c, uid, b.room);
  const nick = nickOf(user, b.nick);
  await patch(c, `cf_chat_members?room_id=eq.${b.room}&user_id=eq.${uid}`, { nick });
  return { ok: true, nick };
}
async function leave(c, uid, b, wipe) {
  await member(c, uid, b.room);
  const room = (await get(c, `cf_chat_rooms?select=owner&id=eq.${b.room}`))[0];
  if (wipe) {
    if (!room || room.owner !== uid) throw httpErr(403, '방을 만든 사람만 지울 수 있어요');
    await del(c, `cf_chat_rooms?id=eq.${b.room}`);   // 참여자·메시지도 함께 지워짐 (on delete cascade)
    return { ok: true };
  }
  await del(c, `cf_chat_members?room_id=eq.${b.room}&user_id=eq.${uid}`);
  const left = await get(c, `cf_chat_members?select=user_id&room_id=eq.${b.room}`);
  if (!left.length) await del(c, `cf_chat_rooms?id=eq.${b.room}`);
  return { ok: true };
}
async function msgOf(c, uid, id) {
  const n = parseInt(id, 10);
  if (!n) throw httpErr(400, '메시지를 골라 주세요');
  const m = (await get(c, `cf_chat_msgs?select=id,room_id,user_id,nick,body&id=eq.${n}`))[0];
  if (!m) throw httpErr(404, '없어진 메시지예요');
  await member(c, uid, m.room_id);
  return m;
}
async function block(c, uid, b) {
  const m = await msgOf(c, uid, b.msg);
  if (m.user_id === uid) throw httpErr(400, '나는 차단할 수 없어요');
  await fetch(c.url + '/rest/v1/cf_chat_blocks', { method: 'POST', headers: hdr(c, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ user_id: uid, blocked: m.user_id, nick: m.nick }) });
  return { ok: true };
}
async function report(c, uid, b) {
  const m = await msgOf(c, uid, b.msg);
  const r = await post(c, 'cf_chat_reports', { room_id: m.room_id, msg_id: m.id, reporter: uid, target: m.user_id, body: String(m.body || '').slice(0, 1000), reason: clean(b.reason, 200) });
  if (!r.ok) throw httpErr(500, '신고를 저장하지 못했어요');
  return { ok: true };
}
async function cleanup(c) {
  const since = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  await del(c, `cf_chat_msgs?created_at=lt.${since}`);
  await del(c, `cf_chat_rooms?last_at=lt.${since}`);   // 30일 동안 아무 말이 없던 방
}

/* ───────────── 공통 ───────────── */

function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && svc ? { url, svc } : null;
}
function hdr(c, extra) { return Object.assign({ apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' }, extra || {}); }
async function get(c, path) {
  const r = await fetch(c.url + '/rest/v1/' + path, { headers: hdr(c) });
  if (!r.ok) throw new Error('DB 읽기 실패 ' + r.status + (r.status === 404 ? ' (sql/cf_chat.sql 을 실행해 주세요)' : '') + ': ' + (await r.text()).slice(0, 120));
  return r.json();
}
async function post(c, table, row) {
  const r = await fetch(c.url + '/rest/v1/' + table, { method: 'POST', headers: hdr(c, { Prefer: 'return=representation' }), body: JSON.stringify(row) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { ok: r.ok, rows: Array.isArray(j) ? j : [], text: t };
}
async function patch(c, path, body) {
  const r = await fetch(c.url + '/rest/v1/' + path, { method: 'PATCH', headers: hdr(c, { Prefer: 'return=minimal' }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error('DB 저장 실패 ' + r.status);
}
async function del(c, path) {
  const r = await fetch(c.url + '/rest/v1/' + path, { method: 'DELETE', headers: hdr(c, { Prefer: 'return=minimal' }) });
  if (!r.ok) throw new Error('DB 삭제 실패 ' + r.status);
}
async function getUser(c, request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}
