// functions/api/trip.js — coverfo 📸 누리트립 (여행 사진·쇼츠 커뮤니티) 1단계 · v427 · v428 쇼츠 크레딧 · v429 2단계(팔로우 · 내 여행 지도 · 테마 지도) · v430 3단계(🤖 AI 일정 · 🙋 질문방 · 예약 버튼 눌림 기록)
// © 2026 coverfo All Rights Reserved
//
//   GET  /api/trip?op=feed&sort=new|top|near&kind=all|photo|shorts&lat=&lng=&before=&mine=1&saved=1
//   GET  /api/trip?op=post&id=        → 글 1개 + 댓글
//   GET  /api/trip?op=me              → { login, nick, age_ok, admin }
//   v429 GET  /api/trip?op=feed&follow=1         → 팔로우한 사람들의 새 글
//        GET  /api/trip?op=feed&nick=닉네임       → 그 사람의 글 + author { nick, followers, following, mine }
//        GET  /api/trip?op=pins                  → 내 여행 지도: { mine:[…], saved:[…] } (로그인)
//        GET  /api/trip?op=tmaps                 → 내 테마 지도 목록 (로그인)
//        GET  /api/trip?op=tmap&id=              → 테마 지도 1개 (누구나 · 링크 공유용)
//        POST {op:'follow', post_id | nick}      → 팔로우 켜기·끄기
//        POST {op:'tmap_save', id?, title, ids}  → 테마 지도 만들기·고치기 (글 50개까지)
//        POST {op:'tmap_del', id}                → 테마 지도 지우기
//   · 1:1 대화는 넣지 않음 (토스 규정상 채팅 서비스 노출 불가 — 홈 채팅 단추를 숨긴 것과 같은 이유)
//   · 필요한 것: sql/cf_trip_v2.sql 1회 실행
//   v430 GET  /api/trip?op=feed&kind=ask&region=제주   → 🙋 질문방 (질문 = kind 'ask' 글 · 답변 = 댓글)
//        POST {op:'create', kind:'ask', region, visited(여행 날짜, 선택), body}
//        POST {op:'ai_plan', ids, nights, start, ppl, note} → 🤖 고른 글로 여행 일정 (AI_PLAN_COST 크레딧 · 실패하면 돌려줌 · 저장 안 함)
//        POST {op:'click', id, kind:nav|stay|air|car}    → 글 아래 버튼이 눌린 수 (로그인 없어도 · 하루 1번 · 글쓴이 본인 제외)
//        POST {op:'admin_clicks'}                       → 🏆 최근 30일 많이 눌린 글 (관리자 · 보상은 기존 /admin 수동 충전으로)
//   · 동행·질문은 실시간 채팅이 아니라 게시판 방식 (토스 규정상 채팅 노출 불가)
//   · AI: plan.js(한 번에 준비)와 같은 Anthropic 경유 방식 · 같은 모델(HUB_MODEL) · 크레딧은 cf_spend · cf_refund 만 씀
//   · 필요한 것: sql/cf_trip_v3.sql 1회 실행
//   PUT  /api/trip?op=upload&type=image|video|thumb   (본문 = 파일)  → { ok, u:'/media/trip/…' }
//   POST /api/trip {op:'profile', nick, age14}
//   POST /api/trip {op:'create', kind, media, body, place:{name,addr,lat,lng}, visited, tags}
//   POST /api/trip {op:'like'|'save', id}           → 누를 때마다 켜기·끄기
//   POST /api/trip {op:'comment', id, body, parent} · {op:'comment_del', cid}
//   POST /api/trip {op:'report', type:'post'|'comment', id, reason}   → 신고 3번이면 자동으로 숨김
//   POST /api/trip {op:'delete', id}                 → 내 글(또는 관리자) 지우기 + 파일 지우기
//   POST /api/trip {op:'block', post_id | comment_id}
//   POST /api/trip {op:'admin_list'} · {op:'admin_set', id, status}   (관리자만)
//
//   · 보기는 누구나 · 쓰기·반응은 로그인 + 닉네임 + 만 14세 이상 확인.
//   · 관리자 확인은 기존 /api/admin 과 같은 규칙(그 API 가 열리면 관리자).
//   · 필요한 것: sql/cf_trip.sql 1회 실행 · R2 바인딩 MEDIA (이미 있음) · SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (이미 있음)
//   · v428: 쇼츠 1개 올릴 때 SHORTS_COST 크레딧 (영상 저장 비용). 사진·보기·댓글·반응은 무료.
//     기존 cf_spend · cf_refund 만 부름 (plan.js 와 같은 방식). 결제·충전 코드는 건드리지 않음.
//     글 저장이 실패하면 크레딧을 돌려줌.

const PAGE = 30;
const HIDE_AT = 3;                       // 신고 3번이면 숨김 → 관리자가 확인
const MAX_IMG = 6 * 1024 * 1024;         // 사진 1장 (폰에서 줄여서 올림)
const MAX_VIDEO = 50 * 1024 * 1024;      // 쇼츠 1개 (30초)
const MAX_POSTS_DAY = 20;
const SHORTS_COST = 1;                   // v428: 쇼츠 1개 = 1크레딧 (사진은 무료)
const TAGS = ['맛집', '카페', '숙소', '자연', '바다', '야경', '축제', '쇼핑', '명소', '액티비티'];
const MAX_MAPS = 30, MAP_POSTS = 50;
const AI_PLAN_COST = 1;                  // v430 🤖 AI 일정 1번 = 1크레딧 (🧳 한 번에 준비와 같은 값)
const MODEL_DEFAULT = 'claude-sonnet-5-5';
const CLICK_KINDS = ['nav', 'stay', 'air', 'car'];
/* v430 🙋 질문방 지역 */
const REGIONS = ['서울', '부산', '제주', '강원', '경기', '인천', '대구', '대전', '광주', '울산', '세종', '충북', '충남', '전북', '전남', '경북', '경남',
  '일본', '중국', '대만', '홍콩·마카오', '베트남', '태국', '필리핀', '싱가포르', '말레이시아', '인도네시아', '미국', '괌·사이판', '유럽', '호주', '기타 해외'];    // v429 테마 지도: 1인 30개 · 지도 1개에 글 50개까지
const POST_COLS = 'id,user_id,nick,kind,media,body,place_name,place_addr,lat,lng,visited,tags,status,likes,saves,comments,reports,created_at';

export async function onRequestGet(context) {
  const { request, env } = context;
  const c = sb(env); if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const url = new URL(request.url);
  const op = url.searchParams.get('op') || 'feed';
  const uid = await userId(request, c);

  if (op === 'me') {
    if (!uid) return json({ ok: true, login: false });
    const p = await profile(c, uid);
    return json({ ok: true, login: true, nick: p ? p.nick : '', age_ok: p ? !!p.age_ok : null, has_profile: !!p, admin: await isAdmin(request), credits: await balance(c, uid), shorts_cost: SHORTS_COST });
  }

  if (op === 'post') {
    const id = num(url.searchParams.get('id')); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    const admin = await isAdmin(request);
    const rows = await get(c, `cf_trip_posts?id=eq.${id}&select=${POST_COLS}`);
    const p = rows && rows[0];
    if (!p || (p.status !== 'live' && !admin && p.user_id !== uid)) return json({ error: '없거나 숨겨진 글이에요' }, 404);
    const blocked = uid ? await blockedSet(c, uid) : new Set();
    let cm = (await get(c, `cf_trip_comments?post_id=eq.${id}&status=eq.live&select=id,user_id,nick,body,parent_id,created_at&order=created_at.asc&limit=300`)) || [];
    cm = cm.filter((x) => !blocked.has(x.user_id)).map((x) => ({ id: x.id, nick: x.nick, body: x.body, parent_id: x.parent_id, at: x.created_at, mine: !!uid && x.user_id === uid }));
    const [it] = await decorate(c, [p], uid);
    if ((uid && p.user_id === uid) || admin) it.clicks = await clickStats(c, [id]).then((m) => m[id] || null);   /* v430 */
    it.following = !!uid && p.user_id !== uid && !!((await get(c, `cf_trip_follows?user_id=eq.${uid}&target=eq.${p.user_id}&select=target`)) || []).length;   /* v429 */
    return json({ ok: true, post: it, comments: cm, admin });
  }

  if (op === 'feed') {
    const sort = ['new', 'top', 'near'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'new';
    const kind = ['photo', 'shorts', 'ask'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
    const region = kind === 'ask' && REGIONS.includes(url.searchParams.get('region') || '') ? url.searchParams.get('region') : '';
    const before = url.searchParams.get('before') || '';
    let q = `cf_trip_posts?select=${POST_COLS}`;
    let author = null;
    const byNick = clean(url.searchParams.get('nick'), 12);
    if (url.searchParams.get('follow') === '1') {   /* v429 팔로잉 */
      if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
      const f = (await get(c, `cf_trip_follows?user_id=eq.${uid}&select=target&limit=1000`)) || [];
      if (!f.length) return json({ ok: true, items: [], follows: 0 });
      q += `&user_id=in.(${f.map((x) => x.target).join(',')})&status=eq.live`;
    } else if (byNick) {                            /* v429 그 사람의 글 */
      if (!/^[0-9A-Za-z가-힣_]{2,12}$/.test(byNick)) return json({ error: '닉네임이 잘못되었어요' }, 400);
      const pr = ((await get(c, `cf_trip_profile?nick=ilike.${encodeURIComponent(byNick.replace(/[%_]/g, '\\$&'))}&select=user_id,nick&limit=1`)) || [])[0];
      if (!pr) return json({ error: '없는 닉네임이에요' }, 404);
      if (uid && (await blockedSet(c, uid)).has(pr.user_id)) return json({ error: '볼 수 없는 사람이에요' }, 403);
      q += `&user_id=eq.${pr.user_id}&status=eq.live`;
      author = { nick: pr.nick, followers: await count(c, `cf_trip_follows?target=eq.${pr.user_id}`), mine: !!uid && pr.user_id === uid,
        following: !!uid && pr.user_id !== uid && !!((await get(c, `cf_trip_follows?user_id=eq.${uid}&target=eq.${pr.user_id}&select=target`)) || []).length };
    } else if (url.searchParams.get('mine') === '1') {
      if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
      q += `&user_id=eq.${uid}&status=neq.removed`;
    } else if (url.searchParams.get('saved') === '1') {
      if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
      const sv = (await get(c, `cf_trip_saves?user_id=eq.${uid}&select=post_id&order=created_at.desc&limit=200`)) || [];
      if (!sv.length) return json({ ok: true, items: [] });
      q += `&id=in.(${sv.map((x) => x.post_id).join(',')})&status=eq.live`;
    } else q += '&status=eq.live';
    if (kind) q += `&kind=eq.${kind}`;
    if (region) q += `&place_name=eq.${encodeURIComponent(region)}`;
    let rows;
    if (sort === 'near') {
      const lat = Number(url.searchParams.get('lat')), lng = Number(url.searchParams.get('lng'));
      rows = (await get(c, q + '&lat=not.is.null&order=created_at.desc&limit=300')) || [];
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        rows.forEach((r) => { r._d = km(lat, lng, r.lat, r.lng); });
        rows.sort((a, b) => a._d - b._d);
      }
      rows = rows.slice(0, 60);
    } else if (sort === 'top') {
      rows = (await get(c, q + '&order=saves.desc,likes.desc,created_at.desc&limit=60')) || [];
    } else {
      if (before && /^[\d\-T:.+Z ]{10,40}$/.test(before)) q += `&created_at=lt.${encodeURIComponent(before)}`;
      rows = (await get(c, q + `&order=created_at.desc&limit=${PAGE}`)) || [];
    }
    if (uid) { const bl = await blockedSet(c, uid); rows = rows.filter((r) => !bl.has(r.user_id)); }
    const items = await decorate(c, rows, uid);
    const last = rows.length ? rows[rows.length - 1].created_at : '';
    return json({ ok: true, items, next: sort === 'new' && rows.length >= PAGE ? last : '', author });
  }

  /* v429 🗺 내 여행 지도 — 내 글 + 저장한 글 */
  if (op === 'pins') {
    if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
    const sv = (await get(c, `cf_trip_saves?user_id=eq.${uid}&select=post_id&order=created_at.desc&limit=300`)) || [];
    const [mine, saved] = await Promise.all([
      get(c, `cf_trip_posts?select=${POST_COLS}&user_id=eq.${uid}&kind=in.(photo,shorts)&status=neq.removed&order=created_at.desc&limit=300`),
      sv.length ? get(c, `cf_trip_posts?select=${POST_COLS}&id=in.(${sv.map((x) => x.post_id).join(',')})&kind=in.(photo,shorts)&status=eq.live&limit=300`) : [],
    ]);
    const bl = await blockedSet(c, uid);
    return json({ ok: true, mine: await decorate(c, mine || [], uid), saved: await decorate(c, (saved || []).filter((r) => !bl.has(r.user_id)), uid) });
  }
  if (op === 'tmaps') {
    if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
    const rows = (await get(c, `cf_trip_maps?user_id=eq.${uid}&select=id,title,post_ids,updated_at&order=updated_at.desc&limit=${MAX_MAPS}`)) || [];
    return json({ ok: true, maps: rows.map((m) => ({ id: m.id, title: m.title, ids: m.post_ids || [], at: m.updated_at })) });
  }
  if (op === 'tmap') {
    const id = num(url.searchParams.get('id')); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    const m = ((await get(c, `cf_trip_maps?id=eq.${id}&select=id,user_id,nick,title,post_ids,updated_at`)) || [])[0];
    if (!m) return json({ error: '없는 지도예요' }, 404);
    const bl = uid ? await blockedSet(c, uid) : new Set();
    if (bl.has(m.user_id)) return json({ error: '볼 수 없는 지도예요' }, 403);
    const ids = (m.post_ids || []).map(num).filter(Boolean).slice(0, MAP_POSTS);
    let rows = ids.length ? (await get(c, `cf_trip_posts?select=${POST_COLS}&id=in.(${ids.join(',')})&status=eq.live`)) || [] : [];
    rows = rows.filter((r) => !bl.has(r.user_id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return json({ ok: true, map: { id: m.id, title: m.title, nick: m.nick, at: m.updated_at, mine: !!uid && m.user_id === uid, ids }, items: await decorate(c, rows, uid) });
  }
  return json({ error: 'op 가 잘못되었습니다' }, 400);
}

/* 파일 올리기 — 본문이 파일 그대로 (사진은 폰에서 줄이고 위치정보를 지운 뒤 올림) */
export async function onRequestPut(context) {
  const { request, env } = context;
  const c = sb(env); if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  if (!env.MEDIA) return json({ error: '파일 저장소(R2)가 연결돼 있지 않습니다' }, 500);
  const uid = await userId(request, c); if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const p = await profile(c, uid);
  if (!p || !p.age_ok) return json({ error: '글쓰기를 할 수 없는 계정이에요', profile: true }, 403);
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const ct = String(request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  let ext = '', max = 0;
  if (type === 'image' || type === 'thumb') {
    if (ct === 'image/jpeg') ext = 'jpg'; else if (ct === 'image/webp') ext = 'webp';
    max = MAX_IMG;
  } else if (type === 'video') {
    if (ct === 'video/mp4') ext = 'mp4'; else if (ct === 'video/quicktime') ext = 'mov'; else if (ct === 'video/webm') ext = 'webm';
    max = MAX_VIDEO;
  }
  if (!ext) return json({ error: '올릴 수 없는 파일 형식이에요 (사진 jpg · 영상 mp4/mov)' }, 415);
  /* v428: 쇼츠 영상은 크레딧이 있어야 올림 (실제 차감은 글을 저장할 때 1번) */
  if (type === 'video') { const bal = await balance(c, uid); if (bal != null && bal < SHORTS_COST) return json({ error: '크레딧이 부족합니다', need: SHORTS_COST, credits: bal }, 402); }
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len && len > max) return json({ error: '파일이 너무 커요' }, 413);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: '빈 파일이에요' }, 400);
  if (buf.byteLength > max) return json({ error: '파일이 너무 커요' }, 413);
  const key = `trip/${uid}/${Date.now().toString(36)}-${rand(8)}.${ext}`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: ct } });
  return json({ ok: true, u: '/media/' + key });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const c = sb(env); if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  let b = {}; try { b = await request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  /* v430 버튼 눌림 기록 — 로그인 없어도 (누가 눌렀는지는 해시로만) */
  if (b.op === 'click') {
    const id = num(b.id), kind = CLICK_KINDS.includes(b.kind) ? b.kind : '';
    if (!id || !kind) return json({ ok: false }, 400);
    const p = ((await get(c, `cf_trip_posts?id=eq.${id}&status=eq.live&select=user_id`)) || [])[0];
    if (!p) return json({ ok: false });
    const u = await userId(request, c);
    if (u && u === p.user_id) return json({ ok: true, self: true });
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const who = await sha(u ? 'u:' + u : 'ip:' + (request.headers.get('CF-Connecting-IP') || '') + ':' + day + ':' + (env.SUPABASE_SERVICE_ROLE_KEY || '').slice(-12));
    await fetch(`${c.url}/rest/v1/cf_trip_clicks`, { method: 'POST', headers: hdr(c, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ post_id: id, kind, who, day }) }).catch(() => {});
    return json({ ok: true });
  }
  const uid = await userId(request, c); if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const op = String(b.op || '');

  if (op === 'profile') {
    const nick = clean(b.nick, 12);
    if (!/^[0-9A-Za-z가-힣_]{2,12}$/.test(nick)) return json({ error: '닉네임은 한글·영문·숫자 2~12글자로 적어 주세요' }, 400);
    const cur = await profile(c, uid);
    const ageOk = b.age14 === true;
    /* 한 번 만 14세 미만으로 고르면 스스로 바꿀 수 없음 (관리자만) */
    const keepAge = cur && cur.age_ok === false && !(await isAdmin(request)) ? false : ageOk;
    const taken = await get(c, `cf_trip_profile?nick=ilike.${encodeURIComponent(nick.replace(/[%_]/g, '\\$&'))}&user_id=neq.${uid}&select=user_id&limit=1`);
    if (taken && taken.length) return json({ error: '이미 쓰는 닉네임이에요' }, 409);
    const r = await fetch(`${c.url}/rest/v1/cf_trip_profile?on_conflict=user_id`, {
      method: 'POST', headers: hdr(c, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ user_id: uid, nick, age_ok: keepAge }),
    });
    if (!r.ok) return json({ error: '저장하지 못했어요 (' + r.status + ')' }, 500);
    if (cur && cur.nick !== nick) {   /* 닉네임을 바꾸면 내 글·댓글에도 */
      await patch(c, `cf_trip_posts?user_id=eq.${uid}`, { nick });
      await patch(c, `cf_trip_comments?user_id=eq.${uid}`, { nick });
      await patch(c, `cf_trip_maps?user_id=eq.${uid}`, { nick });   /* v429 */
    }
    return json({ ok: true, nick, age_ok: keepAge });
  }

  /* 여기부터는 글쓰기·반응 — 닉네임 + 만 14세 이상 */
  const prof = await profile(c, uid);
  const admin = op.startsWith('admin_') || op === 'delete' ? await isAdmin(request) : false;
  const needProfile = ['create', 'comment', 'like', 'save', 'report', 'follow', 'tmap_save'].includes(op);
  if (needProfile && !prof) return json({ error: '닉네임을 먼저 정해 주세요', profile: true }, 403);
  if (needProfile && op !== 'report' && !prof.age_ok) return json({ error: '만 14세 미만은 글쓰기·댓글·반응을 할 수 없어요', age: true }, 403);

  /* v430 🙋 질문 올리기 — 사진 없이 지역 + 여행 날짜(선택) + 질문 */
  if (op === 'create' && b.kind === 'ask') {
    const region = REGIONS.includes(b.region) ? b.region : '';
    if (!region) return json({ error: '어느 지역인지 골라 주세요' }, 400);
    const body = cleanText(b.body, 500);
    if (body.length < 5) return json({ error: '질문을 5글자 이상 적어 주세요' }, 400);
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const lim = new Date(Date.now() + 9 * 3600e3 + 366 * 864e5).toISOString().slice(0, 10);
    const vis = /^\d{4}-\d{2}-\d{2}$/.test(String(b.visited || '')) && b.visited >= today && b.visited <= lim ? b.visited : null;
    const d0 = new Date(); d0.setUTCHours(0, 0, 0, 0);
    if ((await count(c, `cf_trip_posts?user_id=eq.${uid}&created_at=gte.${d0.toISOString()}`)) >= MAX_POSTS_DAY) return json({ error: `하루에 ${MAX_POSTS_DAY}개까지 올릴 수 있어요` }, 429);
    const r = await fetch(`${c.url}/rest/v1/cf_trip_posts`, { method: 'POST', headers: hdr(c, { Prefer: 'return=representation' }), body: JSON.stringify({ user_id: uid, nick: prof.nick, kind: 'ask', media: [], body, place_name: region, place_addr: '', visited: vis, tags: [] }) });
    if (!r.ok) return json({ error: '올리지 못했어요 (' + r.status + ')' }, 500);
    const row = (await r.json())[0];
    return json({ ok: true, id: row && row.id });
  }

  if (op === 'create') {
    const kind = b.kind === 'shorts' ? 'shorts' : b.kind === 'photo' ? 'photo' : '';
    if (!kind) return json({ error: '사진 또는 쇼츠를 골라 주세요' }, 400);
    const own = (u) => typeof u === 'string' && u.startsWith(`/media/trip/${uid}/`) && /^\/media\/trip\/[0-9a-f-]{36}\/[\w-]+\.(jpg|webp|mp4|mov|webm)$/.test(u);
    let media = Array.isArray(b.media) ? b.media : [];
    if (kind === 'photo') {
      media = media.slice(0, 10).filter((m) => m && own(m.u) && /\.(jpg|webp)$/.test(m.u)).map((m) => ({ u: m.u, w: num(m.w) || 0, h: num(m.h) || 0 }));
    } else {
      media = media.slice(0, 1).filter((m) => m && own(m.u) && /\.(mp4|mov|webm)$/.test(m.u)).map((m) => ({ u: m.u, thumb: own(m.thumb) ? m.thumb : '', dur: Math.min(60, Math.max(0, Number(m.dur) || 0)) }));
    }
    if (!media.length) return json({ error: '올린 파일이 없어요' }, 400);
    const pl = b.place || {};
    const place_name = clean(pl.name, 60);
    if (!place_name) return json({ error: '장소를 골라 주세요' }, 400);
    const lat = Number(pl.lat), lng = Number(pl.lng);
    const okLL = isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
    const vis = /^\d{4}-\d{2}-\d{2}$/.test(String(b.visited || '')) && String(b.visited) <= new Date(Date.now() + 864e5).toISOString().slice(0, 10) ? b.visited : null;
    const tags = (Array.isArray(b.tags) ? b.tags : []).filter((t) => TAGS.includes(t)).slice(0, 5);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const n = await count(c, `cf_trip_posts?user_id=eq.${uid}&created_at=gte.${today.toISOString()}`);
    if (n >= MAX_POSTS_DAY) return json({ error: `하루에 ${MAX_POSTS_DAY}개까지 올릴 수 있어요` }, 429);
    /* v428: 쇼츠는 SHORTS_COST 크레딧 — 저장이 실패하면 돌려줌 */
    let job = null;
    if (kind === 'shorts') {
      try { job = await spend(c, uid, SHORTS_COST, 'trip-shorts'); } catch { return json({ error: '크레딧을 확인하지 못했어요. 잠시 뒤 다시 해 주세요.' }, 500); }
      if (job === false) return json({ error: '크레딧이 부족합니다', need: SHORTS_COST }, 402);
    }
    let r;
    try {
      r = await fetch(`${c.url}/rest/v1/cf_trip_posts`, {
        method: 'POST', headers: hdr(c, { Prefer: 'return=representation' }),
        body: JSON.stringify({ user_id: uid, nick: prof.nick, kind, media, body: cleanText(b.body, 500), place_name, place_addr: clean(pl.addr, 120), lat: okLL ? lat : null, lng: okLL ? lng : null, visited: vis, tags }),
      });
    } catch (e) { r = { ok: false, status: 0 }; }
    if (!r.ok) { await refund(c, job); return json({ error: '올리지 못했어요 (' + r.status + ')' + (job != null ? ' — 크레딧은 돌려드렸어요' : '') }, 500); }
    await doneJob(c, job);
    const row = (await r.json())[0];
    return json({ ok: true, id: row && row.id, spent: kind === 'shorts' ? SHORTS_COST : 0 });
  }

  if (op === 'like' || op === 'save') {
    const id = num(b.id); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    const t = op === 'like' ? 'cf_trip_likes' : 'cf_trip_saves', col = op === 'like' ? 'likes' : 'saves';
    const had = await get(c, `${t}?post_id=eq.${id}&user_id=eq.${uid}&select=post_id`);
    if (had && had.length) await fetch(`${c.url}/rest/v1/${t}?post_id=eq.${id}&user_id=eq.${uid}`, { method: 'DELETE', headers: hdr(c) });
    else {
      const r = await fetch(`${c.url}/rest/v1/${t}`, { method: 'POST', headers: hdr(c, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ post_id: id, user_id: uid }) });
      if (!r.ok) return json({ error: '없는 글이에요' }, 404);
    }
    const n = await count(c, `${t}?post_id=eq.${id}`);
    await patch(c, `cf_trip_posts?id=eq.${id}`, { [col]: n });
    return json({ ok: true, on: !(had && had.length), n });
  }

  if (op === 'comment') {
    const id = num(b.id); const body = cleanText(b.body, 300);
    if (!id || !body) return json({ error: '댓글을 적어 주세요' }, 400);
    const post = (await get(c, `cf_trip_posts?id=eq.${id}&status=eq.live&select=id,user_id`) || [])[0];
    if (!post) return json({ error: '없는 글이에요' }, 404);
    if ((await blockedSet(c, post.user_id)).has(uid)) return json({ error: '이 글에는 댓글을 달 수 없어요' }, 403);
    const parent = num(b.parent) || null;
    const r = await fetch(`${c.url}/rest/v1/cf_trip_comments`, { method: 'POST', headers: hdr(c, { Prefer: 'return=representation' }), body: JSON.stringify({ post_id: id, user_id: uid, nick: prof.nick, body, parent_id: parent }) });
    if (!r.ok) return json({ error: '댓글을 올리지 못했어요' }, 500);
    const row = (await r.json())[0];
    await patch(c, `cf_trip_posts?id=eq.${id}`, { comments: await count(c, `cf_trip_comments?post_id=eq.${id}&status=eq.live`) });
    return json({ ok: true, comment: { id: row.id, nick: prof.nick, body, parent_id: parent, at: row.created_at, mine: true } });
  }

  if (op === 'comment_del') {
    const cid = num(b.cid); if (!cid) return json({ error: 'id 가 없습니다' }, 400);
    const cm = (await get(c, `cf_trip_comments?id=eq.${cid}&select=id,user_id,post_id`) || [])[0];
    if (!cm) return json({ ok: true });
    if (cm.user_id !== uid && !(await isAdmin(request))) return json({ error: '내 댓글만 지울 수 있어요' }, 403);
    await patch(c, `cf_trip_comments?id=eq.${cid}`, { status: 'removed' });
    await patch(c, `cf_trip_posts?id=eq.${cm.post_id}`, { comments: await count(c, `cf_trip_comments?post_id=eq.${cm.post_id}&status=eq.live`) });
    return json({ ok: true });
  }

  if (op === 'report') {
    const type = b.type === 'comment' ? 'comment' : 'post';
    const id = num(b.id); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    const t = type === 'post' ? 'cf_trip_posts' : 'cf_trip_comments';
    const row = (await get(c, `${t}?id=eq.${id}&select=id,user_id${type === 'comment' ? ',post_id' : ''}`) || [])[0];
    if (!row) return json({ error: '없는 글이에요' }, 404);
    if (row.user_id === uid) return json({ error: '내 글은 신고할 수 없어요' }, 400);
    await fetch(`${c.url}/rest/v1/cf_trip_reports`, {
      method: 'POST', headers: hdr(c, { Prefer: 'resolution=ignore-duplicates,return=minimal' }),
      body: JSON.stringify({ target_type: type, target_id: id, post_id: type === 'post' ? id : row.post_id, user_id: uid, reason: clean(b.reason, 40) }),
    });
    const n = await count(c, `cf_trip_reports?target_type=eq.${type}&target_id=eq.${id}`);
    const upd = { reports: n }; if (n >= HIDE_AT) upd.status = 'hidden';
    await patch(c, `${t}?id=eq.${id}&status=neq.removed`, upd);
    return json({ ok: true, hidden: n >= HIDE_AT });
  }

  if (op === 'delete') {
    const id = num(b.id); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    const p = (await get(c, `cf_trip_posts?id=eq.${id}&select=id,user_id,media`) || [])[0];
    if (!p) return json({ ok: true });
    if (p.user_id !== uid && !admin) return json({ error: '내 글만 지울 수 있어요' }, 403);
    await patch(c, `cf_trip_posts?id=eq.${id}`, { status: 'removed' });
    if (env.MEDIA) {
      const keys = [];
      (p.media || []).forEach((m) => { [m && m.u, m && m.thumb].forEach((u) => { if (typeof u === 'string' && u.startsWith('/media/trip/')) keys.push(u.slice(7)); }); });
      try { if (keys.length) await env.MEDIA.delete(keys); } catch {}
    }
    return json({ ok: true });
  }

  if (op === 'block') {
    let target = '';
    if (num(b.post_id)) target = ((await get(c, `cf_trip_posts?id=eq.${num(b.post_id)}&select=user_id`)) || [])[0]?.user_id || '';
    else if (num(b.comment_id)) target = ((await get(c, `cf_trip_comments?id=eq.${num(b.comment_id)}&select=user_id`)) || [])[0]?.user_id || '';
    if (!target) return json({ error: '찾지 못했어요' }, 404);
    if (target === uid) return json({ error: '나를 차단할 수는 없어요' }, 400);
    await fetch(`${c.url}/rest/v1/cf_trip_blocks`, { method: 'POST', headers: hdr(c, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ user_id: uid, blocked: target }) });
    /* v429: 차단하면 서로 팔로우도 끊김 */
    await fetch(`${c.url}/rest/v1/cf_trip_follows?user_id=eq.${uid}&target=eq.${target}`, { method: 'DELETE', headers: hdr(c) }).catch(() => {});
    await fetch(`${c.url}/rest/v1/cf_trip_follows?user_id=eq.${target}&target=eq.${uid}`, { method: 'DELETE', headers: hdr(c) }).catch(() => {});
    return json({ ok: true });
  }

  /* v429 👥 팔로우 — 누를 때마다 켜기·끄기 */
  if (op === 'follow') {
    let target = '';
    if (num(b.post_id)) target = ((await get(c, `cf_trip_posts?id=eq.${num(b.post_id)}&select=user_id`)) || [])[0]?.user_id || '';
    else if (/^[0-9A-Za-z가-힣_]{2,12}$/.test(clean(b.nick, 12))) target = ((await get(c, `cf_trip_profile?nick=ilike.${encodeURIComponent(clean(b.nick, 12).replace(/[%_]/g, '\\$&'))}&select=user_id&limit=1`)) || [])[0]?.user_id || '';
    if (!target) return json({ error: '찾지 못했어요' }, 404);
    if (target === uid) return json({ error: '나를 팔로우할 수는 없어요' }, 400);
    if ((await blockedSet(c, uid)).has(target)) return json({ error: '팔로우할 수 없는 사람이에요' }, 403);
    const had = ((await get(c, `cf_trip_follows?user_id=eq.${uid}&target=eq.${target}&select=target`)) || []).length > 0;
    if (had) await fetch(`${c.url}/rest/v1/cf_trip_follows?user_id=eq.${uid}&target=eq.${target}`, { method: 'DELETE', headers: hdr(c) });
    else {
      const n = await count(c, `cf_trip_follows?user_id=eq.${uid}`);
      if (n >= 1000) return json({ error: '1,000명까지 팔로우할 수 있어요' }, 429);
      await fetch(`${c.url}/rest/v1/cf_trip_follows`, { method: 'POST', headers: hdr(c, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ user_id: uid, target }) });
    }
    return json({ ok: true, on: !had, followers: await count(c, `cf_trip_follows?target=eq.${target}`) });
  }

  /* v429 🗺 테마 지도 만들기·고치기 — 공개된 글만 담김 */
  if (op === 'tmap_save') {
    const title = clean(b.title, 30);
    if (!title) return json({ error: '지도 이름을 적어 주세요' }, 400);
    const want = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(num).filter(Boolean))].slice(0, MAP_POSTS);
    const okRows = want.length ? (await get(c, `cf_trip_posts?id=in.(${want.join(',')})&status=eq.live&select=id`)) || [] : [];
    const okSet = new Set(okRows.map((r) => r.id));
    const ids = want.filter((x) => okSet.has(x));
    if (!ids.length) return json({ error: '지도에 담을 글을 골라 주세요' }, 400);
    const now = new Date().toISOString();
    const id = num(b.id);
    if (id) {
      const m = ((await get(c, `cf_trip_maps?id=eq.${id}&select=user_id`)) || [])[0];
      if (!m || m.user_id !== uid) return json({ error: '내 지도만 고칠 수 있어요' }, 403);
      await patch(c, `cf_trip_maps?id=eq.${id}`, { title, post_ids: ids, nick: prof.nick, updated_at: now });
      return json({ ok: true, id, n: ids.length });
    }
    if ((await count(c, `cf_trip_maps?user_id=eq.${uid}`)) >= MAX_MAPS) return json({ error: `테마 지도는 ${MAX_MAPS}개까지 만들 수 있어요` }, 429);
    const r = await fetch(`${c.url}/rest/v1/cf_trip_maps`, { method: 'POST', headers: hdr(c, { Prefer: 'return=representation' }), body: JSON.stringify({ user_id: uid, nick: prof.nick, title, post_ids: ids, updated_at: now }) });
    if (!r.ok) return json({ error: '저장하지 못했어요 (' + r.status + ')' }, 500);
    const row = (await r.json())[0];
    return json({ ok: true, id: row && row.id, n: ids.length });
  }
  if (op === 'tmap_del') {
    const id = num(b.id); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    const m = ((await get(c, `cf_trip_maps?id=eq.${id}&select=user_id`)) || [])[0];
    if (!m) return json({ ok: true });
    if (m.user_id !== uid && !(await isAdmin(request))) return json({ error: '내 지도만 지울 수 있어요' }, 403);
    await fetch(`${c.url}/rest/v1/cf_trip_maps?id=eq.${id}`, { method: 'DELETE', headers: hdr(c) });
    return json({ ok: true });
  }

  /* v430 🤖 AI 여행 일정 — 고른 글(장소)로만 짬 · 결과는 저장하지 않음 */
  if (op === 'ai_plan') {
    const want = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(num).filter(Boolean))].slice(0, 20);
    if (!want.length) return json({ error: '일정에 넣을 글을 골라 주세요' }, 400);
    const rows = (await get(c, `cf_trip_posts?id=in.(${want.join(',')})&kind=in.(photo,shorts)&or=(status.eq.live,user_id.eq.${uid})&status=neq.removed&select=id,user_id,place_name,place_addr,lat,lng,tags,body,kind`)) || [];
    if (!rows.length) return json({ error: '일정에 넣을 수 있는 글이 없어요' }, 400);
    const nights = Math.min(6, Math.max(0, parseInt(b.nights, 10) || 0));
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(b.start || '')) && b.start >= today ? b.start : '';
    const ppl = Math.min(9, Math.max(1, parseInt(b.ppl, 10) || 2));
    const note = cleanText(b.note, 200);
    if (!env.ANTHROPIC_API_KEY && !(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) return json({ error: 'AI 설정이 없어요' }, 500);
    let job = null;
    try { job = await spend(c, uid, AI_PLAN_COST, '[누리트립 AI 일정] ' + rows.map((r) => r.place_name).join(', ').slice(0, 80)); } catch { return json({ error: '크레딧을 확인하지 못했어요. 잠시 뒤 다시 해 주세요.' }, 500); }
    if (job === false) return json({ error: '크레딧이 부족합니다', need: AI_PLAN_COST }, 402);
    try {
      const raw = await askTrip(env, rows, nights, start, ppl, note);
      const plan = cleanTrip(raw, rows, nights);
      await doneJob(c, job);
      return json({ ok: true, plan: Object.assign(plan, { nights, start, ppl }), cost: AI_PLAN_COST });
    } catch (e) {
      await refund(c, job);
      return json({ error: '일정을 만들지 못했어요 · 크레딧은 돌려드렸어요 (' + String((e && e.message) || e).slice(0, 120) + ')', refunded: true }, 500);
    }
  }

  /* v430 🏆 최근 30일 예약 버튼이 많이 눌린 글 (관리자) — 보상은 기존 /admin 수동 충전으로 */
  if (op === 'admin_clicks') {
    if (!admin) return json({ error: '관리자만 볼 수 있어요' }, 403);
    const since = new Date(Date.now() + 9 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
    const cl = (await get(c, `cf_trip_clicks?day=gte.${since}&select=post_id,kind&limit=20000`)) || [];
    const agg = {};
    cl.forEach((x) => { const a = agg[x.post_id] || (agg[x.post_id] = { nav: 0, stay: 0, air: 0, car: 0 }); a[x.kind] = (a[x.kind] || 0) + 1; });
    const top = Object.keys(agg).map(Number).sort((x, y) => (agg[y].stay + agg[y].air + agg[y].car) - (agg[x].stay + agg[x].air + agg[x].car)).slice(0, 30);
    const posts = top.length ? (await get(c, `cf_trip_posts?id=in.(${top.join(',')})&select=id,user_id,nick,place_name,status`)) || [] : [];
    const emails = {};
    await Promise.all([...new Set(posts.map((p) => p.user_id))].map(async (u) => {
      try { const r = await fetch(`${c.url}/auth/v1/admin/users/${u}`, { headers: hdr(c) }); if (r.ok) { const j = await r.json(); emails[u] = (j && (j.email || (j.user && j.user.email))) || ''; } } catch {}
    }));
    const items = top.map((id) => { const p = posts.find((x) => x.id === id); return p ? { id, nick: p.nick, place: p.place_name, status: p.status, email: emails[p.user_id] || '', clicks: agg[id] } : null; }).filter(Boolean);
    return json({ ok: true, since, items });
  }

  if (op === 'admin_list') {
    if (!admin) return json({ error: '관리자만 볼 수 있어요' }, 403);
    const posts = (await get(c, `cf_trip_posts?or=(reports.gt.0,status.eq.hidden)&status=neq.removed&select=${POST_COLS}&order=reports.desc,created_at.desc&limit=100`)) || [];
    const ids = posts.map((p) => p.id);
    const reps = ids.length ? (await get(c, `cf_trip_reports?post_id=in.(${ids.join(',')})&select=post_id,target_type,target_id,reason,created_at&order=created_at.desc&limit=500`)) || [] : [];
    const comments = (await get(c, `cf_trip_comments?or=(reports.gt.0,status.eq.hidden)&status=neq.removed&select=id,post_id,nick,body,status,reports,created_at&order=reports.desc&limit=100`)) || [];
    const items = await decorate(c, posts, uid);
    items.forEach((it) => { it.reasons = reps.filter((r) => r.post_id === it.id && r.target_type === 'post').map((r) => r.reason).filter(Boolean); });
    return json({ ok: true, items, comments });
  }

  if (op === 'admin_set') {
    if (!admin) return json({ error: '관리자만 할 수 있어요' }, 403);
    const id = num(b.id); const st = ['live', 'hidden', 'removed'].includes(b.status) ? b.status : '';
    if (!id || !st) return json({ error: '잘못된 요청입니다' }, 400);
    const t = b.type === 'comment' ? 'cf_trip_comments' : 'cf_trip_posts';
    const upd = { status: st }; if (st === 'live') upd.reports = 0;
    await patch(c, `${t}?id=eq.${id}`, upd);
    if (st === 'live') await fetch(`${c.url}/rest/v1/cf_trip_reports?target_type=eq.${b.type === 'comment' ? 'comment' : 'post'}&target_id=eq.${id}`, { method: 'PATCH', headers: hdr(c, { Prefer: 'return=minimal' }), body: JSON.stringify({ done: true }) });
    return json({ ok: true });
  }

  return json({ error: 'op 가 잘못되었습니다' }, 400);
}

/* ── 도움 함수 ── */
async function decorate(c, rows, uid) {
  if (!rows.length) return [];
  let liked = new Set(), saved = new Set();
  if (uid) {
    const ids = rows.map((r) => r.id).join(',');
    const [l, s] = await Promise.all([get(c, `cf_trip_likes?user_id=eq.${uid}&post_id=in.(${ids})&select=post_id`), get(c, `cf_trip_saves?user_id=eq.${uid}&post_id=in.(${ids})&select=post_id`)]);
    liked = new Set((l || []).map((x) => x.post_id)); saved = new Set((s || []).map((x) => x.post_id));
  }
  return rows.map((r) => ({
    id: r.id, nick: r.nick, kind: r.kind, media: r.media || [], body: r.body, place: { name: r.place_name, addr: r.place_addr, lat: r.lat, lng: r.lng },
    visited: r.visited, tags: r.tags || [], likes: r.likes, saves: r.saves, comments: r.comments, at: r.created_at, status: r.status, reports: r.reports,
    mine: !!uid && r.user_id === uid, liked: liked.has(r.id), saved: saved.has(r.id), dist: typeof r._d === 'number' ? Math.round(r._d * 10) / 10 : undefined,
  }));
}
async function blockedSet(c, uid) {
  const rows = (await get(c, `cf_trip_blocks?or=(user_id.eq.${uid},blocked.eq.${uid})&select=user_id,blocked&limit=1000`)) || [];
  const s = new Set(); rows.forEach((r) => { s.add(r.user_id === uid ? r.blocked : r.user_id); }); return s;   /* 내가 막은 사람 + 나를 막은 사람 서로 안 보임 */
}
/* v428 크레딧 — plan.js 와 같은 방식: cf_spend(kind 'relay' 가 안 되면 'chat') → job_id · false(부족) */
async function balance(c, uid) {
  const r = await get(c, `cf_credits?user_id=eq.${uid}&select=balance,free_balance`);
  if (!r) return null;
  return r[0] ? Number(r[0].balance || 0) + Number(r[0].free_balance || 0) : 0;
}
async function rpc(c, name, args) {
  const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: hdr(c), body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 200));
  try { return JSON.parse(t); } catch { return t; }
}
async function spend(c, uid, cost, label) {
  for (const kind of ['relay', 'chat']) {
    try {
      const res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: kind, p_prompt: label });
      if (res && res.ok) return res.job_id != null ? res.job_id : null;
      return false;
    } catch {}
  }
  throw new Error('크레딧 처리 실패');
}
async function refund(c, job) { if (job != null && job !== false) await rpc(c, 'cf_refund', { p_job: job }).catch(() => {}); }
async function doneJob(c, job) {
  if (job == null || job === false) return;
  await fetch(`${c.url}/rest/v1/cf_jobs?id=eq.${encodeURIComponent(job)}`, { method: 'PATCH', headers: hdr(c), body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }) }).catch(() => {});
}
/* v430 버튼 눌림 수 (최근 30일) */
async function clickStats(c, ids) {
  const since = new Date(Date.now() + 9 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
  const rows = (await get(c, `cf_trip_clicks?post_id=in.(${ids.join(',')})&day=gte.${since}&select=post_id,kind&limit=20000`)) || [];
  const m = {}; rows.forEach((x) => { const a = m[x.post_id] || (m[x.post_id] = { nav: 0, stay: 0, air: 0, car: 0 }); a[x.kind] = (a[x.kind] || 0) + 1; }); return m;
}
async function sha(t) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }

/* v430 🤖 AI 일정 — plan.js 와 같은 경유(ENGINE_PROXY → Supabase anthropic-relay) · 같은 모델 */
const TRIP_TOOL = {
  name: 'make_trip',
  description: 'Return the day-by-day itinerary.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short Korean title, e.g. "제주 동쪽 2박3일"' },
      area: { type: 'string', description: 'Best area/city to stay overnight (Korean short name, e.g. 서귀포, 제주시, 강릉). "" for a day trip.' },
      days: { type: 'array', items: { type: 'object', properties: {
        theme: { type: 'string', description: 'Short Korean theme of the day' },
        stops: { type: 'array', items: { type: 'object', properties: {
          id: { type: 'integer', description: 'id of one of the given places' },
          time: { type: 'string', description: 'Rough time like 09:00 or 오전/점심/오후/저녁' },
          note: { type: 'string', description: 'One short Korean line: what to do there, based only on the given notes' },
        }, required: ['id', 'time', 'note'] } },
      }, required: ['theme', 'stops'] } },
      tips: { type: 'array', items: { type: 'string' }, description: '0-4 short practical Korean tips (moving order, which day for which area). No prices, hours or availability.' },
    },
    required: ['title', 'area', 'days', 'tips'],
  },
};
async function askTrip(env, rows, nights, start, ppl, note) {
  const places = rows.map((r) => ({ id: r.id, name: r.place_name, addr: r.place_addr || '', lat: r.lat, lng: r.lng, tags: r.tags || [], note: String(r.body || '').slice(0, 150) }));
  const sys = [
    'You plan a travel itinerary for the coverfo 누리트립 app, in Korean. You only arrange the places the user gives (their own or saved travel posts).',
    'Rules:',
    '- Use ONLY the given place ids. Never invent places, restaurants, prices, opening hours or transport times.',
    '- Each id at most once. You may leave out places that are too far to fit; mention that in tips.',
    '- Number of days = nights + 1 = ' + (nights + 1) + '. Group nearby places (use lat/lng when present) on the same day and order them to reduce moving.',
    '- 1 to 5 stops per day. time: rough clock time or 오전/점심/오후/저녁.',
    '- note: one short line from the post note/tags; if nothing, a neutral line like "사진 찍기 좋은 곳".',
    '- area: where to stay overnight (short Korean city/area name) when nights > 0, else "".',
    'Always answer by calling the make_trip tool exactly once (no other text). If you cannot call it, reply with only the same JSON object.',
  ].join('\n');
  const user = 'nights: ' + nights + (start ? ', start: ' + start : '') + ', people: ' + ppl + (note ? '\nrequest: ' + note : '') + '\nplaces: ' + JSON.stringify(places);
  const r = await anthropicFetch(env, '/v1/messages', { method: 'POST', body: JSON.stringify({ model: env.HUB_MODEL || MODEL_DEFAULT, max_tokens: 2000, system: sys, tools: [TRIP_TOOL], messages: [{ role: 'user', content: user }] }) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok || !j || !Array.isArray(j.content)) throw new Error('AI 오류 ' + r.status);
  const tu = j.content.find((x) => x && x.type === 'tool_use' && x.name === 'make_trip');
  if (tu && tu.input && typeof tu.input === 'object') return tu.input;
  const txt = j.content.filter((x) => x && x.type === 'text').map((x) => x.text || '').join('\n');
  const m = txt.match(/\{[\s\S]*\}/);
  if (m) { try { const o = JSON.parse(m[0]); if (o && typeof o === 'object') return o; } catch {} }
  throw new Error('AI 가 일정을 돌려주지 않았어요');
}
function cleanTrip(p, rows, nights) {
  const okIds = new Set(rows.map((r) => r.id)); const used = new Set();
  const days = (Array.isArray(p.days) ? p.days : []).slice(0, nights + 1).map((d) => ({
    theme: clean(d && d.theme, 40),
    stops: (Array.isArray(d && d.stops) ? d.stops : []).map((x) => ({ id: num(x && x.id), time: clean(x && x.time, 12), note: clean(x && x.note, 80) }))
      .filter((x) => okIds.has(x.id) && !used.has(x.id) && used.add(x.id)).slice(0, 6),
  })).filter((d) => d.stops.length);
  if (!days.length) throw new Error('일정을 만들지 못했어요');
  return { title: clean(p.title, 40) || '여행 일정', area: nights > 0 ? clean(p.area, 30) : '', days, tips: (Array.isArray(p.tips) ? p.tips : []).map((x) => clean(x, 100)).filter(Boolean).slice(0, 4),
    left: rows.filter((r) => !used.has(r.id)).map((r) => r.id) };
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
async function profile(c, uid) { const r = await get(c, `cf_trip_profile?user_id=eq.${uid}&select=nick,age_ok`); return r && r[0] ? r[0] : null; }
async function get(c, path) { try { const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: hdr(c) }); return r.ok ? await r.json() : null; } catch { return null; } }
async function patch(c, path, body) { try { await fetch(`${c.url}/rest/v1/${path}`, { method: 'PATCH', headers: hdr(c, { Prefer: 'return=minimal' }), body: JSON.stringify(body) }); } catch {} }
async function count(c, path) {
  try {
    const r = await fetch(`${c.url}/rest/v1/${path}${path.includes('?') ? '&' : '?'}select=*`, { method: 'HEAD', headers: hdr(c, { Prefer: 'count=exact', Range: '0-0' }) });
    const m = /\/(\d+)$/.exec(r.headers.get('Content-Range') || ''); return m ? Number(m[1]) : 0;
  } catch { return 0; }
}
/* 관리자: 기존 /api/admin 이 열리면 관리자 (같은 운영자 규칙을 그대로 씀) */
async function isAdmin(request) {
  const a = request.headers.get('Authorization') || ''; if (!a) return false;
  try { const r = await fetch(new URL('/api/admin?summary=1', request.url).toString(), { headers: { Authorization: a } }); return r.ok; } catch { return false; }
}
function km(a1, o1, a2, o2) { const R = 6371, t = Math.PI / 180, dA = (a2 - a1) * t, dO = (o2 - o1) * t; const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * t) * Math.cos(a2 * t) * Math.sin(dO / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function rand(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => (x % 36).toString(36)).join(''); }
function num(v) { const n = parseInt(v, 10); return n > 0 && n < 9e15 ? n : 0; }
function cleanText(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max); }
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
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
