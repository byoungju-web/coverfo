// functions/api/trip.js — coverfo 📸 누리트립 (여행 사진·쇼츠 커뮤니티) 1단계 · v427 · v428 쇼츠 크레딧 · v429 2단계(팔로우 · 내 여행 지도 · 테마 지도)
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
const MAX_MAPS = 30, MAP_POSTS = 50;    // v429 테마 지도: 1인 30개 · 지도 1개에 글 50개까지
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
    it.following = !!uid && p.user_id !== uid && !!((await get(c, `cf_trip_follows?user_id=eq.${uid}&target=eq.${p.user_id}&select=target`)) || []).length;   /* v429 */
    return json({ ok: true, post: it, comments: cm, admin });
  }

  if (op === 'feed') {
    const sort = ['new', 'top', 'near'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'new';
    const kind = ['photo', 'shorts'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
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
      get(c, `cf_trip_posts?select=${POST_COLS}&user_id=eq.${uid}&status=neq.removed&order=created_at.desc&limit=300`),
      sv.length ? get(c, `cf_trip_posts?select=${POST_COLS}&id=in.(${sv.map((x) => x.post_id).join(',')})&status=eq.live&limit=300`) : [],
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
