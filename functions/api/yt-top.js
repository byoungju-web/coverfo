/* coverfo 음악 — "▶ 바로 재생" (YouTube 공식 Data API v3 search.list)
   GET  /api/yt-top            → { on, cost }   (화면이 버튼을 보일지·차감량 표시용. 키 값은 절대 내보내지 않음)
   POST /api/yt-top  {q, region} + Authorization: Bearer <Supabase 로그인 토큰>
        → { ok:true, id, title, channel, free, paid }  또는  { ok:false, reason }
   · 크롤링 아님: Google 이 공개한 공식 API(https://www.googleapis.com/youtube/v3/search)만 부른다.
   · 무료 없음: 로그인한 사용자의 coverfo 크레딧에서 차감(cf_spend). 영상을 못 찾거나 API 오류·한도 초과면 자동 환불(cf_refund).
   · 받는 것은 곡 이름(검색어 100자까지)과 나라 코드뿐. 검색어·결과를 저장하거나 기록(로그)하지 않는다.
   · 영상은 YouTube 앱·사이트에서 재생된다(coverfo 는 영상을 내려받거나 보관하지 않음).
   · 필요한 Secret: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (뒤의 둘은 스튜디오·렌즈와 같은 것)
   · 차감량: 변수 COST_MUSIC (없으면 1 크레딧 = 99원)
   · 고르는 순서(v3): 노래방·가라오케(TJ·금영 등)는 제외 → 커버·리액션 등은 뒤로 → 말한 가수·곡명이 다 들어간 영상 중 조회수 1위 → 없으면 관련 결과 중 조회수 1위(대표곡).
     '노래·음악' 같은 일반어는 검색어에서 뺀다.
     YouTube API 사용량: 검색 1번 100 + 조회수 확인 1 = 101 포인트(하루 무료 10,000) */
const SANCTIONED = { RU: 1, IR: 1, KP: 1, SY: 1, CU: 1, VE: 1, BY: 1 };
/* 노래방·가라오케(반주) 영상 — 원곡이 아니고 가사·원곡 음성이 없는 경우가 많아 바로 재생 후보에서 뺀다 (TJ·금영·KY 등) */
const KARAOKE = /(노래방|가라오케|karaoke|\bTJ\b|TJ\s*media|티제이|금영|\bKY\b|반주\s*(곡|음악)?|\bMR\b|inst(rumental)?\b|sing\s*along|노래\s*연습)/i;

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

  /* 2) YouTube 공식 API — 아무 영상이나 틀지 않도록 고른다 (v2, 2026-10-07)
        ① search.list(음악 분류 10, 관련도 순 상위 15개) → ② videos.list 로 조회수(statistics) 확인(1 포인트)
        ③ 순서: 말한 단어(가수·곡명)가 제목·채널에 다 들어간 영상 중 조회수 1위 → 없으면 관련 결과 중 조회수 1위(대표곡)
           커버·노래방·MR·리액션·쇼츠 같은 영상은 뒤로 미룬다(검색어에 그 말이 있으면 미루지 않음). */
  const un = (t) => String(t || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const norm = (t) => un(t).toLowerCase().replace(/[\s\-_|:·,.!?'"()\[\]{}/]+/g, '');
  const quotaOf = (j) => { const e = j && j.error && Array.isArray(j.error.errors) && j.error.errors[0] ? String(j.error.errors[0].reason || '') : ''; return /quota/i.test(e); };
  try {
    /* v3: '노래·음악·곡' 같은 일반어는 검색·비교에서 뺀다(노래방의 '노래'에 걸리던 문제). 노래방·가라오케는 검색 단계에서부터 제외
       (YouTube search.list 의 q 는 NOT(-) 연산자를 지원 — 공식 문서) */
    const GENERIC = /^(노래|음악|뮤직|곡|가요|song|songs|music|mv|뮤비|뮤직비디오|official|공식)$/i;
    const core = q.split(/\s+/).filter((w) => w && !GENERIC.test(w));
    const sq = (core.length ? core.join(' ') : q) + (KARAOKE.test(q) ? '' : ' -노래방 -karaoke -가라오케 -MR');
    const base = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&safeSearch=moderate'
      + '&q=' + encodeURIComponent(sq) + (region ? '&regionCode=' + region : '') + '&key=' + encodeURIComponent(key);
    let r = await fetch(base + '&videoCategoryId=10');
    let j = await r.json().catch(() => null);
    if (r.ok && (!j || !Array.isArray(j.items) || !j.items.length)) {   /* 음악 분류로 하나도 없으면 분류 없이 한 번 더 */
      r = await fetch(base); j = await r.json().catch(() => null);
    }
    if (!r.ok) { await refund(c, job); return json({ ok: false, reason: quotaOf(j) ? 'quota' : 'api', refunded: true }, 502); }
    const items = (j && Array.isArray(j.items) ? j.items : []).filter((it) => it && it.id && /^[A-Za-z0-9_-]{6,20}$/.test(String(it.id.videoId || '')));
    if (!items.length) { await refund(c, job); return json({ ok: false, reason: 'not_found', refunded: true }); }

    /* 조회수 — videos.list(part=statistics) */
    const ids = items.map((it) => it.id.videoId);
    const views = {};
    try {
      const vr = await fetch('https://www.googleapis.com/youtube/v3/videos?part=statistics&id=' + ids.join(',') + '&key=' + encodeURIComponent(key));
      const vj = await vr.json().catch(() => null);
      (vj && Array.isArray(vj.items) ? vj.items : []).forEach((v) => { views[v.id] = Number(v.statistics && v.statistics.viewCount) || 0; });
    } catch (e) { /* 조회수를 못 받으면 관련도 순서를 그대로 쓴다 */ }

    const words = (core.length ? core : q.split(/\s+/)).map(norm).filter((w) => w.length >= 1);
    const BAD = /(cover|커버|노래방|karaoke|inst(rumental)?|mr\b|리액션|reaction|shorts|#shorts|가사\s*없|반주|연주|lesson|강좌|tutorial|remix|리믹스|8d|1시간|1hour|연속\s*듣기|모음|playlist|플레이리스트)/i;
    const qBad = BAD.test(q), qKar = KARAOKE.test(q);
    const scored = items.map((it, rank) => {
      const sn = it.snippet || {}, hay = norm(sn.title) + '|' + norm(sn.channelTitle);
      const all = words.length ? words.every((w) => hay.indexOf(w) >= 0) : false;
      const bad = !qBad && BAD.test(un(sn.title));
      const kara = !qKar && (KARAOKE.test(un(sn.title)) || KARAOKE.test(un(sn.channelTitle)));
      return { it, all, bad, kara, v: views[it.id.videoId] || 0, rank };
    });
    const pool = scored.filter((x) => !x.kara);   /* 노래방·가라오케 영상은 후보에서 뺀다 — 그것밖에 없으면 틀지 않고 환불 */
    if (!pool.length) { await refund(c, job); return json({ ok: false, reason: 'not_found', refunded: true }); }
    pool.sort((a, b) => (a.bad - b.bad) || (b.all - a.all) || (b.v - a.v) || (a.rank - b.rank));   /* 커버 등 → 뒤로, 그다음 단어 일치, 그다음 조회수 */
    const best = pool[0].it, sn = best.snippet || {};

    await jobDone(c, job);
    return json({ ok: true, id: String(best.id.videoId), title: un(sn.title), channel: un(sn.channelTitle), views: views[best.id.videoId] || null, cost, free: s.free, paid: s.paid });
  } catch (e) {
    await refund(c, job);
    return json({ ok: false, reason: 'api', refunded: true }, 502);
  }
}
