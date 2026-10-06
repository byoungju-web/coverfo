/* coverfo 음악 — "▶ 바로 재생" (YouTube 공식 Data API v3 search.list)
   GET  /api/yt-top            → { on, cost }   (화면이 버튼을 보일지·차감량 표시용. 키 값은 절대 내보내지 않음)
   POST /api/yt-top  {q, region} + Authorization: Bearer <Supabase 로그인 토큰>
        → { ok:true, id, title, channel, free, paid }  또는  { ok:false, reason }
   · 크롤링 아님: Google 이 공개한 공식 API(https://www.googleapis.com/youtube/v3/search)만 부른다.
   · 무료 없음: 로그인한 사용자의 coverfo 크레딧에서 차감(cf_spend). 영상을 못 찾거나 API 오류·한도 초과면 자동 환불(cf_refund).
   · 받는 것은 곡 이름(검색어 100자까지)과 나라 코드뿐. 검색어·결과를 저장하거나 기록(로그)하지 않는다.
   · 영상은 YouTube 앱·사이트에서 재생된다(coverfo 는 영상을 내려받거나 보관하지 않음).
   · 필요한 Secret: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (뒤의 둘은 스튜디오·렌즈와 같은 것)
   · 차감량: 변수 COST_MUSIC (없으면 1 크레딧 = 99원) */
const SANCTIONED = { RU: 1, IR: 1, KP: 1, SY: 1, CU: 1, VE: 1, BY: 1 };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function costOf(env) {
  const n = Number(env.COST_MUSIC);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  return url && key ? { url, key } : null;
}

function hdr(c) {
  return { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' };
}

async function rpc(c, name, args) {
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: hdr(c), body: JSON.stringify(args || {}) });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status);
  try { return JSON.parse(t); } catch (e) { return t; }
}

/* 로그인 확인 — 스튜디오·채팅과 같은 방식(토큰으로 Supabase 에 사용자 조회) */
async function userId(c, request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return '';
  const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.key, Authorization: 'Bearer ' + token } });
  if (!r.ok) return '';
  const u = await r.json().catch(() => null);
  return u && u.id ? String(u.id) : '';
}

/* 크레딧 차감 — 렌즈·빠른 판단과 같은 규칙: kind 허용 목록에 'music' 이 없으면 'chat' 으로 한 번 더 */
async function spend(c, uid, cost, q) {
  try {
    return await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'music', p_prompt: q });
  } catch (e) {
    return await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'chat', p_prompt: q });
  }
}

async function refund(c, job) {
  if (job != null) await rpc(c, 'cf_refund', { p_job: job }).catch(() => undefined);
}

async function jobDone(c, job) {
  if (job == null) return;
  await fetch(c.url + '/rest/v1/cf_jobs?id=eq.' + encodeURIComponent(job), {
    method: 'PATCH', headers: hdr(c), body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
  }).catch(() => undefined);
}

function originOk(request) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true;
  let h = '';
  try { h = new URL(origin).hostname; } catch (e) {}
  return h === 'coverfo.com' || h.endsWith('.coverfo.com') || h.endsWith('.pages.dev');
}

export async function onRequestGet({ env }) {
  const on = !!(String(env.YOUTUBE_API_KEY || '').trim() && sb(env));
  return json({ on, cost: costOf(env) });
}

export async function onRequestPost({ request, env }) {
  const key = String(env.YOUTUBE_API_KEY || '').trim();
  const c = sb(env);
  if (!key || !c) return json({ ok: false, reason: 'off' }, 503);
  if (!originOk(request)) return json({ ok: false }, 403);

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const q = String(body.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const region = /^[A-Z]{2}$/.test(String(body.region || '')) ? String(body.region) : '';
  if (!q) return json({ ok: false, reason: 'empty' }, 400);
  if (region && SANCTIONED[region]) return json({ ok: false, reason: 'sanctioned' }, 403);

  const uid = await userId(c, request).catch(() => '');
  if (!uid) return json({ ok: false, reason: 'login' }, 401);

  /* 1) 크레딧 먼저 차감 (부족하면 여기서 끝) */
  const cost = costOf(env);
  let s;
  try {
    s = await spend(c, uid, cost, q);
  } catch (e) {
    return json({ ok: false, reason: 'credit_error' }, 500);
  }
  if (!s || !s.ok) return json({ ok: false, reason: 'insufficient', need: cost, free: s && s.free, paid: s && s.paid }, 402);
  const job = s.job_id;

  /* 2) YouTube 공식 API — 검색 결과 첫 영상 1개 */
  try {
    const u = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&safeSearch=moderate'
      + '&q=' + encodeURIComponent(q) + (region ? '&regionCode=' + region : '') + '&key=' + encodeURIComponent(key);
    const r = await fetch(u);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      await refund(c, job);
      const why = j && j.error && Array.isArray(j.error.errors) && j.error.errors[0] ? String(j.error.errors[0].reason || '') : '';
      return json({ ok: false, reason: /quota/i.test(why) ? 'quota' : 'api', refunded: true }, 502);
    }
    const it = j && Array.isArray(j.items) ? j.items[0] : null;
    const id = it && it.id && it.id.videoId ? String(it.id.videoId) : '';
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) {
      await refund(c, job);
      return json({ ok: false, reason: 'not_found', refunded: true });
    }
    await jobDone(c, job);
    const sn = it.snippet || {};
    /* API 가 주는 제목은 &amp; &#39; 같은 HTML 글자로 와서 보통 글자로 되돌린다 */
    const un = (t) => String(t || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return json({ ok: true, id, title: un(sn.title), channel: un(sn.channelTitle), cost, free: s.free, paid: s.paid });
  } catch (e) {
    await refund(c, job);
    return json({ ok: false, reason: 'api', refunded: true }, 502);
  }
}
