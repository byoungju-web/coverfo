// functions/api/made.js — 릴레이 "📂 내가 만든 것" 목록을 계정에 저장 (폰 · PC 같은 목록)
// © 2026 coverfo All Rights Reserved
//
//   GET  /api/made                         → { ok, items:[{id, at, t, title, voice, music, img, video, top, bottom, narration, lyrics, post, blog, tags, trans}] }  최근 50개
//   POST /api/made  {op:'put', items:[…]}  → { ok, n }   추가·고침 (한 번에 30개까지)
//   POST /api/made  {op:'del', id}         → { ok }
//   (Authorization: Bearer 로그인토큰)   필요한 것: sql/cf_relay_made.sql 1회 실행

const KEEP = 50;
const KINDS = ['set', 'voice', 'music', 'meme', 'sns', 'avatar', 'flow'];

export async function onRequestGet(context) {
  const env = context.env || {};
  const c = sb(env); if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const uid = await userId(context.request, c); if (!uid) return json({ error: '로그인이 필요합니다' }, 401);
  const r = await fetch(`${c.url}/rest/v1/cf_relay_made?user_id=eq.${uid}&select=id,at,data&order=at.desc&limit=${KEEP}`, { headers: hdr(c) });
  if (!r.ok) return json({ error: '목록을 읽지 못했습니다 (' + r.status + ')' }, 500);
  const rows = await r.json();
  return json({ ok: true, items: rows.map((x) => Object.assign({}, x.data || {}, { id: x.id, at: Number(x.at) })) });
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const c = sb(env); if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const uid = await userId(context.request, c); if (!uid) return json({ error: '로그인이 필요합니다' }, 401);
  let b = {}; try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }

  if (b.op === 'del') {
    const id = clean(b.id, 40);
    if (!id) return json({ error: 'id 가 없습니다' }, 400);
    await fetch(`${c.url}/rest/v1/cf_relay_made?user_id=eq.${uid}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: hdr(c) });
    return json({ ok: true });
  }

  if (b.op === 'put') {
    const list = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map(tidy).filter(Boolean);
    if (!list.length) return json({ ok: true, n: 0 });
    const rows = list.map((x) => ({ user_id: uid, id: x.id, at: x.at, data: x.data }));
    const r = await fetch(`${c.url}/rest/v1/cf_relay_made?on_conflict=user_id,id`, {
      method: 'POST', headers: hdr(c, { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows),
    });
    if (!r.ok) return json({ error: '저장하지 못했습니다 (' + r.status + '): ' + (await r.text()).slice(0, 150) }, 500);
    /* 오래된 것 정리: 최근 KEEP 개만 */
    const old = await fetch(`${c.url}/rest/v1/cf_relay_made?user_id=eq.${uid}&select=id&order=at.desc&offset=${KEEP}&limit=200`, { headers: hdr(c) });
    if (old.ok) {
      const ids = (await old.json()).map((x) => x.id);
      if (ids.length) await fetch(`${c.url}/rest/v1/cf_relay_made?user_id=eq.${uid}&id=in.(${ids.map((i) => '"' + i + '"').join(',')})`, { method: 'DELETE', headers: hdr(c) });
    }
    return json({ ok: true, n: rows.length });
  }
  return json({ error: 'op 가 잘못되었습니다 (put | del)' }, 400);
}

/* 주소는 우리 저장소(/media/…) 나 https 만 — blob: · data: 는 다른 기기에서 못 여니 버림 */
function url(v) { const s = String(v || ''); return /^\/media\/[\w\-./]+$/.test(s) || /^https:\/\/[\w\-.]+\/[\w\-./%?=&]+$/.test(s) ? s.slice(0, 500) : ''; }
function tidy(x) {
  if (!x || typeof x !== 'object') return null;
  const id = clean(x.id, 40); const t = KINDS.includes(x.t) ? x.t : '';
  if (!/^m[\w]{4,39}$/.test(id) || !t) return null;
  const at = Math.max(0, Math.min(Number(x.at) || Date.now(), Date.now() + 60000));
  const data = {
    t, title: clean(x.title, 60), voice: url(x.voice), music: url(x.music), img: url(x.img), video: url(x.video),
    top: clean(x.top, 60), bottom: clean(x.bottom, 80), narration: clean(x.narration, 2000), lyrics: clean(x.lyrics, 2000),
    post: cleanText(x.post, 3000), blog: cleanText(x.blog, 6000), tags: clean(x.tags, 600), trans: cleanText(x.trans, 6000),
  };
  if (!data.voice && !data.music && !data.img && !data.video) return null;
  return { id, at, data };
}

function cleanText(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max); }
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max); }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function sb(env) { const u = String(env.SUPABASE_URL || '').replace(/\/+$/, ''); const k = env.SUPABASE_SERVICE_ROLE_KEY || ''; return u && k ? { url: u, svc: k } : null; }
function hdr(c, extra) { return Object.assign({ apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' }, extra || {}); }
async function userId(request, c) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return '';
  try {
    const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return '';
    const u = await r.json();
    return u && u.id && /^[0-9a-f-]{36}$/i.test(u.id) ? u.id : '';
  } catch { return ''; }
}
