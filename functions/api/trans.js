// functions/api/trans.js — coverfo 🌐 통역톡 (v295) · 포도톡을 거치지 않고 coverfo 안에서 도는 통역
// © 2026 coverfo All Rights Reserved
//
// POST /api/trans  (Authorization: Bearer coverfo 로그인키)
//   { op:'rooms', kind }                         → 내 통역방 목록 (kind: one | multi)
//   { op:'create', kind, name, lang, nick }      → 방 만들기 { room }  (초대: coverfo.com/#t=코드)
//   { op:'join', code, lang, nick }              → 코드로 참여 { room }
//   { op:'lang', room, lang }                    → 이 방에서 내 언어 바꾸기
//   { op:'msgs', room, after }                   → 새 메시지 (내 언어로 번역된 글) + 참여자
//   { op:'send', room, text }                    → 보내기: 방 안의 다른 언어 수 × 0.1 크레딧 (혼자면 무료)
//   { op:'leave', room } · { op:'delete', room } → 나가기 · (만든 사람) 방 지우기
//   { op:'translate', text, from, to }           → 🔄 마주보기 한 마디 번역: 0.1 크레딧
//   { op:'call_ticket' }                         → 📞 전화통역(포도랑)용 표 (12시간) — 포도랑 서버가 이 표로 coverfo 지갑을 쓴다
// 서버끼리 (헤더 X-Link-Key = PODO_LINK_KEY · 포도랑 전화통역 서버 podolang-realtime 이 부른다):
//   { op:'link_balance', t }  → { ok, balance }      { op:'link_spend', t, amount, kind } → { ok, took }
//
// · 크레딧: 지금 쓰는 차감 함수(cf_spend)만 쓴다 (결제·충전 코드는 건드리지 않음). 크레딧은 정수로 빠지므로
//   0.1 단위는 '묶음'(sql/cf_trans.sql 의 cf_tr_pack)으로: 1크레딧을 빼서 0.1 × 10 을 담아 두고 한 번씩 꺼낸다. 번역이 실패하면 묶음으로 되돌린다.
// · 번역: OpenAI(OPENAI_API_KEY, 기본 gpt-4o-mini · TRANS_MODEL 로 바꿈). 키가 없으면 Anthropic(HUB_MODEL) 경유.
// · 대화는 30일 뒤 자동 삭제 (요청 중 가끔 지움). 말하기·읽어주기는 폰(브라우저)이 직접 해서 음성은 서버로 오지 않는다.
// · 필요한 것: sql/cf_trans.sql 1회 실행. 전화통역은 Secret PODO_LINK_KEY (포도랑 워커의 LINK_KEY 와 같은 값).

const STEP = 1;                 // 번역 1개 = 0.1 크레딧 (= 묶음 1칸)
const MAX_TEXT = 500;
const KEEP_DAYS = 30;
const LIMIT = { one: 2, multi: 10 };
const LANGS = {
  KO: '한국어 Korean', EN: 'English', VI: 'Vietnamese', ZH: 'Chinese (Simplified)', TH: 'Thai', JA: 'Japanese', ID: 'Indonesian',
  UZ: 'Uzbek', NE: 'Nepali', MY: 'Burmese', KM: 'Khmer', MN: 'Mongolian', TL: 'Filipino (Tagalog)', RU: 'Russian', ES: 'Spanish',
  FR: 'French', DE: 'German', PT: 'Portuguese (Brazil)', IT: 'Italian', AR: 'Arabic', HI: 'Hindi', NL: 'Dutch', TR: 'Turkish', UK: 'Ukrainian',
};
const langOk = (l) => Object.prototype.hasOwnProperty.call(LANGS, String(l || ''));

export async function onRequestPost(context) {
  const env = context.env || {};
  const c = sb(env);
  if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const op = String(b.op || '');

  /* 포도랑 전화통역 서버 → coverfo 지갑 */
  const lk = context.request.headers.get('X-Link-Key') || '';
  if (lk) {
    if (!env.PODO_LINK_KEY || !safeEq(lk, String(env.PODO_LINK_KEY))) return json({ ok: false, error: '권한이 없어요' }, 401);
    const uid = await ticketUser(env, String(b.t || ''));
    if (!uid) return json({ ok: false, error: '표가 맞지 않거나 시간이 지났어요. coverfo 에서 통역톡을 다시 열어 주세요.' }, 401);
    try {
      if (op === 'link_balance') return json({ ok: true, balance: await balanceOf(c, uid) });
      if (op === 'link_spend') {
        const amt = Math.max(0, Number(b.amount) || 0);
        if (!amt) return json({ ok: true, took: 0 });
        const r = Number.isInteger(amt)
          ? await spendWhole(env, uid, amt, '[전화통역] ' + String(b.kind || 'podolang').slice(0, 20))
          : await charge(env, uid, Math.round(amt * 10), '[전화통역]');
        return json(r.ok ? { ok: true, took: amt } : { ok: false, took: 0, error: '크레딧이 부족합니다' });
      }
    } catch (e) { return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500); }
    return json({ ok: false, error: 'unknown op' }, 400);
  }

  const user = await getUser(c, context.request);
  if (!user) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const uid = user.id;
  try {
    if (Math.random() < 0.05) cleanup(c).catch(() => {});
    if (op === 'rooms') return json({ ok: true, rooms: await rooms(c, uid, b.kind === 'multi' ? 'multi' : 'one') });
    if (op === 'create') return json(await create(c, uid, user, b));
    if (op === 'join') return json(await join(c, uid, user, b));
    if (op === 'lang') return json(await setLang(c, uid, b));
    if (op === 'msgs') return json(await msgs(c, uid, b));
    if (op === 'send') return json(await send(env, c, uid, b));
    if (op === 'leave') return json(await leave(c, uid, b, false));
    if (op === 'delete') return json(await leave(c, uid, b, true));
    if (op === 'translate') return json(await faceTranslate(env, uid, b));
    if (op === 'call_ticket') return json({ ok: true, ticket: await makeTicket(env, uid) });
  } catch (e) {
    return json({ error: String((e && e.message) || e).slice(0, 300) }, e && e.status ? e.status : 500);
  }
  return json({ error: '잘못된 요청입니다' }, 400);
}

/* ───────────── 방 ───────────── */

function nickOf(user, n) {
  const v = String(n || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 20);
  return v || String(user.email || '').split('@')[0].slice(0, 20) || '나';
}
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = new Uint8Array(6); crypto.getRandomValues(r);
  return Array.from(r, (x) => A[x % A.length]).join('');
}
async function member(c, uid, room) {
  if (!/^[0-9a-f-]{36}$/.test(String(room || ''))) throw httpErr(400, '방 정보가 없습니다');
  const m = (await get(c, `cf_tr_members?select=*&room_id=eq.${room}&user_id=eq.${uid}`))[0];
  if (!m) throw httpErr(403, '이 방에 들어가 있지 않아요');
  return m;
}
async function rooms(c, uid, kind) {
  const mine = await get(c, `cf_tr_members?select=room_id,lang&user_id=eq.${uid}`);
  if (!mine.length) return [];
  const ids = mine.map((m) => m.room_id).join(',');
  const rs = await get(c, `cf_tr_rooms?select=*&id=in.(${ids})&kind=eq.${kind}&order=last_at.desc&limit=50`);
  const mem = await get(c, `cf_tr_members?select=room_id,nick,lang&room_id=in.(${rs.map((r) => r.id).join(',') || '00000000-0000-0000-0000-000000000000'})`);
  return rs.map((r) => {
    const ms = mem.filter((m) => m.room_id === r.id);
    return { id: r.id, code: r.code, kind: r.kind, name: r.name, mine: r.owner === uid, members: ms.length, langs: [...new Set(ms.map((m) => m.lang))], last_body: r.last_body || '', last_nick: r.last_nick || '', last_at: r.last_at };
  });
}
async function create(c, uid, user, b) {
  const kind = b.kind === 'multi' ? 'multi' : 'one';
  const lang = langOk(b.lang) ? b.lang : 'KO';
  const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 30) || (kind === 'multi' ? '다중 통역방' : '1:1 통역방');
  let room = null;
  for (let i = 0; i < 4 && !room; i++) {
    const r = await post(c, 'cf_tr_rooms', { code: newCode(), kind, name, owner: uid });
    if (r.ok) room = r.rows[0];
  }
  if (!room) throw httpErr(500, '방을 만들지 못했어요. sql/cf_trans.sql 을 실행했는지 확인해 주세요.');
  await post(c, 'cf_tr_members', { room_id: room.id, user_id: uid, nick: nickOf(user, b.nick), lang });
  return { ok: true, room: { id: room.id, code: room.code, kind, name } };
}
async function join(c, uid, user, b) {
  const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (code.length !== 6) throw httpErr(400, '초대 코드 6자리를 넣어 주세요');
  const room = (await get(c, `cf_tr_rooms?select=*&code=eq.${code}`))[0];
  if (!room) throw httpErr(404, '그 코드의 통역방이 없어요');
  const lang = langOk(b.lang) ? b.lang : 'KO';
  const ms = await get(c, `cf_tr_members?select=user_id&room_id=eq.${room.id}`);
  if (!ms.some((m) => m.user_id === uid)) {
    if (ms.length >= (LIMIT[room.kind] || 2)) throw httpErr(409, room.kind === 'one' ? '1:1 통역방은 2명까지예요' : '이 방은 꽉 찼어요 (' + LIMIT.multi + '명)');
    await post(c, 'cf_tr_members', { room_id: room.id, user_id: uid, nick: nickOf(user, b.nick), lang });
  }
  return { ok: true, room: { id: room.id, code: room.code, kind: room.kind, name: room.name } };
}
async function setLang(c, uid, b) {
  await member(c, uid, b.room);
  if (!langOk(b.lang)) throw httpErr(400, '언어를 골라 주세요');
  await patch(c, `cf_tr_members?room_id=eq.${b.room}&user_id=eq.${uid}`, { lang: b.lang });
  return { ok: true };
}
async function msgs(c, uid, b) {
  const me = await member(c, uid, b.room);
  const after = Math.max(0, parseInt(b.after, 10) || 0);
  const room = (await get(c, `cf_tr_rooms?select=id,code,kind,name,owner&id=eq.${b.room}`))[0];
  const ms = await get(c, `cf_tr_members?select=user_id,nick,lang&room_id=eq.${b.room}`);
  const since = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  const rows = await get(c, `cf_tr_msgs?select=id,user_id,nick,lang,body,tr,created_at&room_id=eq.${b.room}&id=gt.${after}&created_at=gt.${since}&order=id.asc&limit=100`);
  return {
    ok: true,
    room: room ? { id: room.id, code: room.code, kind: room.kind, name: room.name, mine: room.owner === uid } : null,
    me: { lang: me.lang, nick: me.nick },
    members: ms.map((m) => ({ nick: m.nick, lang: m.lang, me: m.user_id === uid })),
    msgs: rows.map((m) => ({
      id: m.id, mine: m.user_id === uid, nick: m.nick, lang: m.lang, at: m.created_at,
      orig: m.body, text: m.lang === me.lang ? m.body : ((m.tr && m.tr[me.lang]) || m.body), translated: m.lang !== me.lang && !!(m.tr && m.tr[me.lang]),
    })),
  };
}
async function send(env, c, uid, b) {
  const me = await member(c, uid, b.room);
  const text = String(b.text || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, MAX_TEXT);
  if (!text) throw httpErr(400, '보낼 말을 적어 주세요');
  const ms = await get(c, `cf_tr_members?select=lang&room_id=eq.${b.room}`);
  const targets = [...new Set(ms.map((m) => m.lang).filter((l) => l !== me.lang && langOk(l)))];
  let tr = {};
  if (targets.length) {
    const need = targets.length * STEP;
    const paid = await charge(env, uid, need, '[통역톡] ' + text.slice(0, 40));
    if (!paid.ok) throw httpErr(402, '크레딧이 부족합니다 (이번 한 마디 ' + (need / 10) + '크레딧)');
    try { tr = await translate(env, text, me.lang, targets); }
    catch (e) { await rpc(c, 'cf_tr_add', { p_user: uid, p_add: need }).catch(() => {}); throw httpErr(500, '번역하지 못했어요 · 크레딧은 돌려드렸어요 (' + String((e && e.message) || e).slice(0, 120) + ')'); }
  }
  const r = await post(c, 'cf_tr_msgs', { room_id: b.room, user_id: uid, nick: me.nick, lang: me.lang, body: text, tr });
  if (!r.ok) throw httpErr(500, '메시지를 저장하지 못했어요');
  await patch(c, `cf_tr_rooms?id=eq.${b.room}`, { last_body: text.slice(0, 80), last_nick: me.nick, last_at: new Date().toISOString() }).catch(() => {});
  return { ok: true, id: r.rows[0] && r.rows[0].id, cost: targets.length * STEP / 10 };
}
async function leave(c, uid, b, wipe) {
  await member(c, uid, b.room);
  const room = (await get(c, `cf_tr_rooms?select=owner&id=eq.${b.room}`))[0];
  if (wipe) {
    if (!room || room.owner !== uid) throw httpErr(403, '방을 만든 사람만 지울 수 있어요');
    await del(c, `cf_tr_rooms?id=eq.${b.room}`);   // 참여자·메시지도 함께 지워짐 (on delete cascade)
    return { ok: true };
  }
  await del(c, `cf_tr_members?room_id=eq.${b.room}&user_id=eq.${uid}`);
  const left = await get(c, `cf_tr_members?select=user_id&room_id=eq.${b.room}`);
  if (!left.length) await del(c, `cf_tr_rooms?id=eq.${b.room}`);
  return { ok: true };
}
async function faceTranslate(env, uid, b) {
  const from = langOk(b.from) ? b.from : 'KO', to = langOk(b.to) ? b.to : 'EN';
  const text = String(b.text || '').trim().slice(0, MAX_TEXT);
  if (!text) throw httpErr(400, '번역할 말이 없어요');
  if (from === to) return { ok: true, text, cost: 0 };
  const c = sb(env);
  const paid = await charge(env, uid, STEP, '[마주보기 통역] ' + text.slice(0, 40));
  if (!paid.ok) throw httpErr(402, '크레딧이 부족합니다 (한 마디 0.1크레딧)');
  try {
    const tr = await translate(env, text, from, [to]);
    return { ok: true, text: tr[to] || '', cost: STEP / 10 };
  } catch (e) {
    await rpc(c, 'cf_tr_add', { p_user: uid, p_add: STEP }).catch(() => {});
    throw httpErr(500, '번역하지 못했어요 · 크레딧은 돌려드렸어요');
  }
}
async function cleanup(c) {
  const since = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  await del(c, `cf_tr_msgs?created_at=lt.${since}`);
  await del(c, `cf_tr_rooms?last_at=lt.${since}`);   // 30일 동안 아무 말이 없던 방
}

/* ───────────── 번역 ───────────── */

async function translate(env, text, from, targets) {
  const sys = 'You are a professional interpreter for live chat. Translate the user message from ' + (LANGS[from] || from) +
    ' into each requested language. Keep the meaning, tone and politeness; keep names, numbers, prices and emojis. Do not add explanations. ' +
    'Return ONLY a JSON object whose keys are exactly these codes: ' + targets.map((t) => t + ' (' + LANGS[t] + ')').join(', ') + '.';
  let out = '';
  if (env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.TRANS_MODEL || 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: text }] }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('번역 오류 ' + r.status + ': ' + String((j.error && j.error.message) || '').slice(0, 100));
    out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  } else {
    const r = await anthropicFetch(env, '/v1/messages', { method: 'POST', body: JSON.stringify({ model: env.HUB_MODEL || 'claude-sonnet-5-5', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: text }] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('번역 오류 ' + r.status);
    out = (j.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
  }
  const m = String(out).match(/\{[\s\S]*\}/);
  let o = null; try { o = m ? JSON.parse(m[0]) : null; } catch {}
  if (!o) throw new Error('번역 결과를 읽지 못했어요');
  const res = {};
  for (const t of targets) if (typeof o[t] === 'string' && o[t].trim()) res[t] = o[t].trim().slice(0, 2000);
  if (!Object.keys(res).length) throw new Error('번역 결과가 비었어요');
  return res;
}

/* ───────────── 크레딧 (cf_spend 만 씀 · 0.1 단위는 묶음) ───────────── */

async function charge(env, uid, tenths, label) {
  const c = sb(env);
  let t = await rpc(c, 'cf_tr_take', { p_user: uid, p_need: tenths });
  if (t && t.ok) return { ok: true };
  const lack = tenths - ((t && t.left) || 0);
  const whole = Math.max(1, Math.ceil(lack / 10));
  const s = await spendWhole(env, uid, whole, label);
  if (!s.ok) return { ok: false };
  await rpc(c, 'cf_tr_add', { p_user: uid, p_add: whole * 10 });
  t = await rpc(c, 'cf_tr_take', { p_user: uid, p_need: tenths });
  return { ok: !!(t && t.ok) };
}
async function spendWhole(env, uid, cost, label) {
  const c = sb(env);
  for (const kind of ['relay', 'chat']) {
    try {
      const res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: kind, p_prompt: String(label || '').slice(0, 100) });
      if (res && res.ok) {
        if (res.job_id != null) await patch(c, 'cf_jobs?id=eq.' + encodeURIComponent(res.job_id), { status: 'done', updated_at: new Date().toISOString() }).catch(() => {});
        return { ok: true };
      }
      return { ok: false };
    } catch {}
  }
  throw new Error('크레딧 처리 실패');
}
async function balanceOf(c, uid) {
  const cr = (await get(c, `cf_credits?select=balance,free_balance&user_id=eq.${uid}`))[0] || {};
  const pk = (await get(c, `cf_tr_pack?select=tenths&user_id=eq.${uid}`).catch(() => []))[0] || {};
  return (Number(cr.balance) || 0) + (Number(cr.free_balance) || 0) + (Number(pk.tenths) || 0) / 10;
}

/* ───────────── 전화통역 표 (cf.<내용>.<서명>, 12시간) ───────────── */

async function ticketKey(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode('coverfo-trans-ticket:' + (env.SUPABASE_SERVICE_ROLE_KEY || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function makeTicket(env, uid) {
  const p = b64u(new TextEncoder().encode(JSON.stringify({ u: uid, e: Date.now() + 12 * 3600e3 })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await ticketKey(env), new TextEncoder().encode('cf.' + p)));
  return 'cf.' + p + '.' + b64u(sig);
}
async function ticketUser(env, t) {
  try {
    const parts = String(t).split('.');
    if (parts.length !== 3 || parts[0] !== 'cf') return '';
    const ok = await crypto.subtle.verify('HMAC', await ticketKey(env), fromB64u(parts[2]), new TextEncoder().encode('cf.' + parts[1]));
    if (!ok) return '';
    const o = JSON.parse(new TextDecoder().decode(fromB64u(parts[1])));
    return o && o.u && o.e > Date.now() ? String(o.u) : '';
  } catch { return ''; }
}

/* ───────────── 공통 ───────────── */

function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function safeEq(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
function b64u(bytes) {
  let s = ''; const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64u(v) {
  v = String(v).replace(/-/g, '+').replace(/_/g, '/'); while (v.length % 4) v += '=';
  return Uint8Array.from(atob(v), (ch) => ch.charCodeAt(0));
}
function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && svc ? { url, svc } : null;
}
function hdr(c, extra) { return Object.assign({ apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' }, extra || {}); }
async function get(c, path) {
  const r = await fetch(c.url + '/rest/v1/' + path, { headers: hdr(c) });
  if (!r.ok) throw new Error('DB 읽기 실패 ' + r.status + (r.status === 404 ? ' (sql/cf_trans.sql 을 실행해 주세요)' : '') + ': ' + (await r.text()).slice(0, 120));
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
async function rpc(c, name, args) {
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: hdr(c), body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status + (r.status === 404 ? ' (sql/cf_trans.sql 을 실행해 주세요)' : '') + ': ' + t.slice(0, 120));
  try { return JSON.parse(t); } catch { return t; }
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
function anthropicFetch(env, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', env.ANTHROPIC_API_KEY || '');
  headers.set('anthropic-version', '2023-06-01');
  headers.set('content-type', 'application/json');
  let target = 'https://api.anthropic.com' + path;
  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (sbUrl && svc && (env.ENGINE_PROXY || 'on') !== 'off') {
    target = sbUrl + '/functions/v1/anthropic-relay' + path;
    headers.set('Authorization', 'Bearer ' + svc);
    headers.set('apikey', svc);
    headers.set('x-region', env.GOOGLE_PROXY_REGION || 'ap-northeast-2');
  }
  return fetch(target, { ...init, headers });
}
