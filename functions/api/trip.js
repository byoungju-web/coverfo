// functions/api/trip.js — coverfo 📸 누리트립 (여행 사진·쇼츠 커뮤니티) 1단계 · v427 · v428 쇼츠 크레딧 · v429 2단계(팔로우 · 내 여행 지도 · 테마 지도) · v430 3단계(🤖 AI 일정 · 🙋 질문방 · 예약 버튼 눌림 기록) · v431 AI 일정에 주변 명소·맛집 + 코스 · v432 해외는 구글 지도 · v433 만든 일정 저장 · v434 좌표 없는 국내 글 판별 · v435 질문방 국내/해외
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
//   v431 🤖 AI 일정: 고른 글 + 그 지역 관광명소·맛집(카카오 로컬 공식 API · KAKAO_REST_KEY · 장소 검색 결과 상위)을 섞어 날짜별 코스로
//        · AI 는 받은 장소 id 만 씀(없는 곳·가격·영업시간 안 만듦) · 결과 stops 에 이름·좌표·종류·카카오 장소 주소를 붙여 지도에 번호로 그림
//        · 국내 좌표가 없거나 해외면 주변 장소 없이 고른 글로만 · 카카오 검색 결과는 하루 Cloudflare 캐시
//   v432 🌍 해외: 구글 Places API (New) Text Search (공식 · 서버 키 GOOGLE_PLACES_KEY · Pro 필드만 요청 = Text Search Pro 요금 등급)
//        · 구글 장소는 구글 지도 위에만 그림(구글 정책) → 화면은 Maps Embed API 지도(브라우저용 키 GOOGLE_MAPS_EMBED_KEY · 무료) 로 코스 표시
//        · 두 키가 다 있어야 해외 명소·맛집을 넣음 (하나라도 없으면 고른 글로만) · 구글 결과는 캐시·저장하지 않음 (place id 만 화면에 넘김)
//   v433 📋 만든 일정 저장 (sql/cf_trip_v4.sql) — 만들면 자동 저장 · 1인 50개까지(넘으면 오래된 것부터 지움)
//        GET ?op=plans → 내 일정 목록 · GET ?op=plan&id= → 일정 1개 · POST {op:'plan_del', id}
//        · 해외(구글) 장소는 place id · 시간 · 설명만 저장 (이름·주소·좌표·종류 = 구글 내용은 저장 안 함 · 구글 정책)
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
const MAX_MAPS = 30, MAP_POSTS = 50, MAX_PLANS = 50;
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
    const scope = kind === 'ask' && !region && ['kr', 'abroad'].includes(url.searchParams.get('scope')) ? url.searchParams.get('scope') : '';   /* v435 국내 17곳 · 해외 나머지 */
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
    if (scope) q += `&place_name=in.(${(scope === 'kr' ? REGIONS.slice(0, 17) : REGIONS.slice(17)).map((r) => encodeURIComponent('"' + r + '"')).join(',')})`;
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
  /* v433 📋 내가 만든 일정 */
  if (op === 'plans') {
    if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
    const rows = (await get(c, `cf_trip_plans?user_id=eq.${uid}&select=id,title,plan,created_at&order=created_at.desc&limit=${MAX_PLANS}`)) || [];
    return json({ ok: true, plans: rows.map((r) => { const p = r.plan || {}; return { id: r.id, title: r.title, at: r.created_at, nights: p.nights || 0, start: p.start || '', ppl: p.ppl || 0, google: !!p.google, mine: !!p.mine, n: (p.days || []).reduce((t, d) => t + ((d && d.stops) || []).length, 0) }; }) });
  }
  if (op === 'plan') {
    if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
    const id = num(url.searchParams.get('id')); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    const r = ((await get(c, `cf_trip_plans?id=eq.${id}&user_id=eq.${uid}&select=id,title,plan,created_at`)) || [])[0];
    if (!r) return json({ error: '없는 일정이에요' }, 404);
    const plan = r.plan || {};
    if (plan.google) plan.gkey = embedKey(env);   /* 지도 키는 저장하지 않고 열 때 붙임 */
    return json({ ok: true, plan_id: r.id, plan, at: r.created_at });
  }
  /* v460 🅿️ 이 장소 근처 주차장 — 카카오 로컬 카테고리 검색(PK6 · 공식 API) · 가까운 순 15곳 · 좌표가 없으면 이름으로 위치부터 찾음 */
  if (op === 'parking') {
    const kk = String(env.KAKAO_REST_KEY || '').trim();
    if (!kk) return json({ error: '장소 검색 설정이 없어요' }, 500);
    let y = Number(url.searchParams.get('lat')), x = Number(url.searchParams.get('lng'));
    const q = cleanText(url.searchParams.get('q'), 40);
    if (!(isFinite(y) && isFinite(x) && y > 32.5 && y < 39.5 && x > 124 && x < 132)) {
      if (q.length < 2) return json({ error: '장소가 없어요' }, 400);
      const r0 = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent(q), { headers: { Authorization: 'KakaoAK ' + kk } }).catch(() => null);
      const d0 = r0 && r0.ok ? ((await r0.json().catch(() => ({}))).documents || [])[0] : null;
      if (!d0) return json({ ok: true, items: [], note: '장소 위치를 찾지 못했어요' });
      y = Number(d0.y); x = Number(d0.x);
    }
    const qs = new URLSearchParams({ category_group_code: 'PK6', x: x.toFixed(6), y: y.toFixed(6), radius: '3000', sort: 'distance', size: '15' });
    const r = await fetch('https://dapi.kakao.com/v2/local/search/category.json?' + qs.toString(), { headers: { Authorization: 'KakaoAK ' + kk } }).catch(() => null);
    const docs = r && r.ok ? ((await r.json().catch(() => ({}))).documents || []) : [];
    return json({ ok: true, at: { lat: y, lng: x }, items: docs.map((d) => ({ name: clean(d.place_name, 40), addr: clean(d.road_address_name || d.address_name, 80), dist: Number(d.distance) || 0, lat: Number(d.y), lng: Number(d.x),
      url: /^https?:\/\/place\.map\.kakao\.com\//.test(String(d.place_url || '')) ? String(d.place_url).replace(/^http:/, 'https:') : '' })).filter((o) => o.name && isFinite(o.lat) && isFinite(o.lng)) });
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
  if (op === 'plan_del') {
    const id = num(b.id); if (!id) return json({ error: 'id 가 없습니다' }, 400);
    await fetch(`${c.url}/rest/v1/cf_trip_plans?id=eq.${id}&user_id=eq.${uid}`, { method: 'DELETE', headers: hdr(c) });
    return json({ ok: true });
  }
  /* v460 ✍️ 내가 직접 만든(또는 고친) 코스 저장 — 국내(카카오) 장소만 · 크레딧 없음 · 📋 내가 만든 일정에 함께 보임 */
  if (op === 'plan_mine') {
    const P = b.plan && typeof b.plan === 'object' ? b.plan : {};
    const okU = (u) => (/^https:\/\/place\.map\.kakao\.com\//.test(String(u || '')) ? String(u).slice(0, 200) : '');
    const nn = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
    const days = (Array.isArray(P.days) ? P.days : []).slice(0, 7).map((d) => ({
      theme: clean(d && d.theme, 40),
      stops: (Array.isArray(d && d.stops) ? d.stops : []).slice(0, 15).map((s) => ({
        id: clean(s && s.id, 12), time: clean(s && s.time, 12), note: clean(s && s.note, 80),
        src: ['post', 'typed', 'spot', 'food'].indexOf(s && s.src) >= 0 ? s.src : 'spot', post_id: num(s && s.post_id) || 0,
        name: clean(s && s.name, 40), cat: clean(s && s.cat, 20), addr: clean(s && s.addr, 80), lat: nn(s && s.lat), lng: nn(s && s.lng), url: okU(s && s.url), pid: '',
      })).filter((s) => s.name),
    })).filter((d) => d.stops.length);
    if (!days.length) return json({ error: '코스에 장소를 하나 이상 넣어 주세요' }, 400);
    const plan = { title: clean(P.title, 40) || '내가 만든 코스', area: clean(P.area, 30), days, tips: [], left: [], near: true, src: '명소·맛집: 카카오맵 장소 검색',
      google: false, gkey: '', mine: true, nights: Math.min(6, Math.max(0, days.length - 1)), start: /^\d{4}-\d{2}-\d{2}$/.test(String(P.start || '')) ? P.start : '', ppl: Math.min(9, Math.max(1, parseInt(P.ppl, 10) || 2)) };
    if (P.entry && isFinite(Number(P.entry.lat)) && isFinite(Number(P.entry.lng))) plan.entry = { name: clean(P.entry.name, 30), lat: Number(P.entry.lat), lng: Number(P.entry.lng), kind: P.entry.kind === 'me' ? 'me' : 'ic' };
    const plan_id = await savePlan(c, uid, plan, []).catch(() => 0);
    if (!plan_id) return json({ error: '저장하지 못했어요' }, 500);
    return json({ ok: true, plan_id });
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
    /* v460 장소 직접 입력 (글이 없어도) — 쉼표로 여러 곳 · 지역 이름("단양")만 넣으면 그 지역 명소·맛집으로 */
    const typed = [...new Set((Array.isArray(b.places) ? b.places : []).map((x) => cleanText(x, 40)).filter((x) => x.length >= 2))].slice(0, 10);
    if (!want.length && !typed.length) return json({ error: '넣을 장소를 고르거나 직접 적어 주세요' }, 400);
    const rows = want.length ? (await get(c, `cf_trip_posts?id=in.(${want.join(',')})&kind=in.(photo,shorts)&or=(status.eq.live,user_id.eq.${uid})&status=neq.removed&select=id,user_id,place_name,place_addr,lat,lng,tags,body,kind`)) || [] : [];
    const tp = typed.length ? await typedPlaces(env, typed) : { stops: [], areas: [] };
    if (!rows.length && !tp.stops.length && !tp.areas.length) return json({ error: want.length ? '일정에 넣을 수 있는 글이 없어요' : '적은 장소를 찾지 못했어요. 이름을 조금 바꿔 다시 적어 주세요' }, 400);
    const stopRows = rows.concat(tp.stops);
    const nights = Math.min(6, Math.max(0, parseInt(b.nights, 10) || 0));
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(b.start || '')) && b.start >= today ? b.start : '';
    const ppl = Math.min(9, Math.max(1, parseInt(b.ppl, 10) || 2));
    const note = cleanText(b.note, 200);
    if (!env.ANTHROPIC_API_KEY && !(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) return json({ error: 'AI 설정이 없어요' }, 500);
    let job = null;
    try { job = await spend(c, uid, AI_PLAN_COST, '[누리트립 AI 일정] ' + stopRows.concat(tp.areas).map((r) => r.place_name).join(', ').slice(0, 80)); } catch { return json({ error: '크레딧을 확인하지 못했어요. 잠시 뒤 다시 해 주세요.' }, 500); }
    if (job === false) return json({ error: '크레딧이 부족합니다', need: AI_PLAN_COST }, 402);
    try {
      const near = await nearbyPicks(env, stopRows.concat(tp.areas), typed.length && !rows.length ? 'kr' : (b.where === 'abroad' ? 'abroad' : 'kr')).catch(() => ({ spots: [], foods: [], area: '' }));
      if (!stopRows.length && !near.spots.length && !near.foods.length) throw new Error('그 지역 명소·맛집을 찾지 못했어요');
      const raw = await askTrip(env, stopRows, near, nights, start, ppl, note);
      const plan = cleanTrip(raw, stopRows, near, nights);
      /* v460 진입점: 출발 쪽(내 위치 · 없으면 서울)에서 들어오는 고속도로 나들목에서 가까운 곳부터 */
      if (!plan.google) await orderFromEntry(env, plan, b.from).catch(() => {});
      /* v460 코스·식당 추가와 지도 '주변 명소·맛집'에 쓰는 후보 (카카오 장소 검색 결과만 · 구글은 넣지 않음) */
      if (!plan.google) plan.cands = { spots: near.spots, foods: near.foods };
      await doneJob(c, job);
      Object.assign(plan, { nights, start, ppl });
      const plan_id = await savePlan(c, uid, plan, rows).catch(() => 0);   /* v433 저장 실패해도 일정은 보여 줌 */
      return json({ ok: true, plan, plan_id, cost: AI_PLAN_COST });
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
  description: 'Return the day-by-day travel course.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short Korean title, e.g. "단양 1박2일 풍경·맛집 코스"' },
      area: { type: 'string', description: 'Best area/city to stay overnight (Korean short name). "" for a day trip.' },
      days: { type: 'array', items: { type: 'object', properties: {
        theme: { type: 'string', description: 'Short Korean theme of the day' },
        stops: { type: 'array', items: { type: 'object', properties: {
          id: { type: 'string', description: 'id of one of the given places (p…, t…, s… or f…)' },
          time: { type: 'string', description: 'Clock time like 09:30, 12:00' },
          note: { type: 'string', description: 'One short Korean line: what to do there' },
        }, required: ['id', 'time', 'note'] } },
      }, required: ['theme', 'stops'] } },
      tips: { type: 'array', items: { type: 'string' }, description: '0-4 short practical Korean tips about the course order. No prices, hours or availability.' },
    },
    required: ['title', 'area', 'days', 'tips'],
  },
};
/* 고른 글들이 있는 시·군 이름 (주소 둘째 칸: 충청북도 단양군 … → 단양) */
function areaOf(rows) {
  const cnt = {};
  rows.forEach((r) => { const t = String(r.place_addr || '').split(/\s+/); let a = t[1] || ''; if (/(시|군|구)$/.test(a) && a.length > 2) a = a.slice(0, -1); if (a) cnt[a] = (cnt[a] || 0) + 1; });
  return Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0] || '';
}
/* v431 그 지역 관광명소·맛집 — 카카오 로컬 키워드 검색(공식 API) · 정확도순 · 반경 20km */
async function nearbyPicks(env, rows, where) {
  const kk = String(env.KAKAO_REST_KEY || '').trim();
  const inKr = (a, o) => a > 32.5 && a < 39.5 && o > 124 && o < 132;
  /* v434 좌표가 없는 글("이름 그대로 쓰기")은 카카오 장소 검색으로 위치를 먼저 찾아 봄 — 이름이 서로 겹치는 한국 장소가 나오면 국내로.
     찾은 좌표·주소는 이번 일정 지도에만 쓰고 글에는 저장하지 않음 */
  if (kk && where !== 'abroad') {
    const norm = (t) => String(t || '').replace(/\s/g, '').toLowerCase();
    const miss = rows.filter((r) => typeof r.lat !== 'number' || typeof r.lng !== 'number').slice(0, 5);
    await Promise.all(miss.map(async (r) => {
      try {
        const q = String(r.place_name || '').trim(); if (q.length < 2) return;
        const res = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent((q + ' ' + String(r.place_addr || '')).trim()), { headers: { Authorization: 'KakaoAK ' + kk } });
        if (!res.ok) return;
        const d = ((await res.json().catch(() => ({}))).documents || [])[0];
        if (!d) return;
        const a = norm(d.place_name), b = norm(q);
        if (!(a.includes(b) || b.includes(a))) return;   /* 이름이 안 겹치면 다른 곳으로 봄 */
        const la = Number(d.y), lo = Number(d.x);
        if (!inKr(la, lo)) return;
        r.lat = la; r.lng = lo;
        if (!r.place_addr) r.place_addr = String(d.road_address_name || d.address_name || '');
      } catch {}
    }));
  }
  const area = areaOf(rows);
  const ll = rows.filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');
  let y = null, x = null;
  if (ll.length) { y = ll.reduce((t, r) => t + r.lat, 0) / ll.length; x = ll.reduce((t, r) => t + r.lng, 0) / ll.length; }
  /* v434 국내·해외: 좌표가 있으면 좌표로, 좌표가 하나도 없으면 이용자가 고른 것(where: kr 기본 · abroad)으로 */
  if ((y != null && !inKr(y, x)) || (y == null && where === 'abroad')) return googlePicks(env, rows, y, x);
  if (!kk) return { spots: [], foods: [], area };
  const name0 = area || clean(rows[0] && rows[0].place_name, 30);
  if (y == null && !name0) return { spots: [], foods: [], area };
  const search = async (query, cat) => {
    const q = new URLSearchParams({ query, category_group_code: cat, size: '15', sort: 'accuracy' });
    if (y != null) { q.set('x', x.toFixed(6)); q.set('y', y.toFixed(6)); q.set('radius', '20000'); }
    const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
    const ck = new Request('https://cache.coverfo.com/trip-near/' + encodeURIComponent(q.toString()));
    if (cache) { const h = await cache.match(ck).catch(() => null); if (h) { const j = await h.json().catch(() => null); if (j) return j; } }
    const r = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?' + q.toString(), { headers: { Authorization: 'KakaoAK ' + kk } });
    if (!r.ok) return [];
    const d = await r.json().catch(() => ({}));
    const docs = Array.isArray(d.documents) ? d.documents : [];
    if (cache) { try { await cache.put(ck, new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } })); } catch {} }
    return docs;
  };
  const name = name0 || '';
  const [sd, fd] = await Promise.all([search((name + ' 관광명소').trim(), 'AT4'), search((name + ' 맛집').trim(), 'FD6')]);
  const have = new Set(rows.map((r) => String(r.place_name || '').replace(/\s/g, '')));
  const conv = (d, i, pre) => ({ id: pre + (i + 1), name: clean(d.place_name, 40), cat: clean(String(d.category_name || '').split('>').pop(), 20), addr: clean(d.road_address_name || d.address_name, 80),
    lat: Number(d.y), lng: Number(d.x), url: /^https?:\/\/place\.map\.kakao\.com\//.test(String(d.place_url || '')) ? String(d.place_url).replace(/^http:/, 'https:') : '' });
  const ok = (o) => o.name && isFinite(o.lat) && isFinite(o.lng) && !have.has(o.name.replace(/\s/g, ''));
  return { spots: sd.map((d, i) => conv(d, i, 's')).filter(ok).slice(0, 12), foods: fd.map((d, i) => conv(d, i, 'f')).filter(ok).slice(0, 12), area };
}
/* v432 🌍 해외 명소·맛집 — Google Places API (New) Text Search · Pro 필드만 (id·이름·주소·좌표·구글지도 주소·종류 이름) · 캐시 안 함 */
function embedKey(env) { const k = String(env.GOOGLE_MAPS_EMBED_KEY || '').trim(); return /^[A-Za-z0-9_-]{30,60}$/.test(k) ? k : ''; }
async function googlePicks(env, rows, y, x) {
  const gk = String(env.GOOGLE_PLACES_KEY || '').trim();
  const where = clean(rows[0] && (rows[0].place_addr || rows[0].place_name), 60);
  const base = { spots: [], foods: [], area: '', google: true, gkey: embedKey(env) };
  if (!gk || !base.gkey) return base;   /* 구글 장소는 구글 지도에만 그릴 수 있어 지도 키도 있어야 함 */
  const search = async (text) => {
    const body = { textQuery: y != null ? text : text + ' in ' + where, languageCode: 'ko', maxResultCount: 12 };
    if (y != null) body.locationBias = { circle: { center: { latitude: y, longitude: x }, radius: 20000 } };
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gk,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryTypeDisplayName' }, body: JSON.stringify(body) });
    if (!r.ok) return [];
    const d = await r.json().catch(() => ({}));
    return Array.isArray(d.places) ? d.places : [];
  };
  const [sd, fd] = await Promise.all([search('top tourist attractions'), search('best restaurants')]);
  const have = new Set(rows.map((r) => String(r.place_name || '').replace(/\s/g, '')));
  const conv = (p, i, pre) => ({ id: pre + (i + 1), pid: /^[\w-]{10,300}$/.test(String(p.id || '')) ? String(p.id) : '', name: clean(p.displayName && p.displayName.text, 50), cat: clean(p.primaryTypeDisplayName && p.primaryTypeDisplayName.text, 20),
    addr: clean(p.formattedAddress, 100), lat: Number(p.location && p.location.latitude), lng: Number(p.location && p.location.longitude), url: /^https:\/\/(maps\.google\.com|www\.google\.com\/maps)/.test(String(p.googleMapsUri || '')) ? String(p.googleMapsUri) : '' });
  const ok = (o) => o.name && isFinite(o.lat) && isFinite(o.lng) && !have.has(o.name.replace(/\s/g, ''));
  return Object.assign(base, { spots: sd.map((p, i) => conv(p, i, 's')).filter(ok).slice(0, 12), foods: fd.map((p, i) => conv(p, i, 'f')).filter(ok).slice(0, 12) });
}
/* v460 이용자가 적은 장소 → 카카오 장소 검색(공식 API) 1건. 지역 이름만 적었으면(카카오가 지역으로 알아들은 경우) 코스에 넣지 않고 지역으로만 */
async function typedPlaces(env, list) {
  const kk = String(env.KAKAO_REST_KEY || '').trim();
  const out = { stops: [], areas: [] };
  await Promise.all(list.map(async (q, i) => {
    let d = null, sn = null;
    if (kk) {
      try {
        const r = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent(q), { headers: { Authorization: 'KakaoAK ' + kk } });
        if (r.ok) { const j = await r.json().catch(() => ({})); d = (j.documents || [])[0] || null; sn = j.meta && j.meta.same_name; }
      } catch {}
    }
    const regionOnly = sn && Array.isArray(sn.region) && sn.region.length && !String(sn.keyword || '').trim();
    if (regionOnly || /^[가-힣]{1,6}(특별시|광역시|시|군|구|도)$/.test(q)) {
      const reg = String((sn && sn.region && sn.region[0]) || (d && (d.address_name || '')) || q);
      out.areas.push({ area_only: true, place_name: q, place_addr: reg.split(/\s+/).length > 1 ? reg : '- ' + q, lat: d ? Number(d.y) : null, lng: d ? Number(d.x) : null });
      return;
    }
    const url = d && /^https?:\/\/place\.map\.kakao\.com\//.test(String(d.place_url || '')) ? String(d.place_url).replace(/^http:/, 'https:') : '';
    out.stops.push(d ? { tid: 't' + (i + 1), id: 0, typed: true, place_name: clean(d.place_name, 40), place_addr: clean(d.road_address_name || d.address_name, 80), lat: Number(d.y), lng: Number(d.x), url, tags: [], body: '' }
      : { tid: 't' + (i + 1), id: 0, typed: true, place_name: q, place_addr: '', lat: null, lng: null, url: '', tags: [], body: '' });
  }));
  return out;
}
const rowKey = (r) => r.tid || 'p' + r.id;
/* v460 🚗 진입점: 출발 쪽에서 가장 가까운 고속도로 나들목(IC) → 그 날 코스를 그쪽에서 시작하게 (거꾸로가 더 가까우면 뒤집음)
   · 출발 위치: 이용자가 허용한 내 위치(from) · 없으면 서울시청 · 그 지역 안(15km 이내)에 있으면 내 위치에서 시작
   · 2일째부터는 전날 마지막 장소에서 가까운 쪽부터 · 시각 칸은 그대로 두고 장소만 순서대로 다시 배치 */
async function orderFromEntry(env, plan, from) {
  const inKr = (a, o) => a > 32.5 && a < 39.5 && o > 124 && o < 132;
  const km = (a, b) => { const r = Math.PI / 180, x = (b.lng - a.lng) * Math.cos((a.lat + b.lat) / 2 * r), y = b.lat - a.lat; return Math.sqrt(x * x + y * y) * 111.2; };
  const hasLL = (s) => typeof s.lat === 'number' && typeof s.lng === 'number' && isFinite(s.lat) && isFinite(s.lng);
  let origin = { lat: 37.5663, lng: 126.9779, mine: false };
  const fl = from && Number(from.lat), fo = from && Number(from.lng);
  if (from && isFinite(fl) && isFinite(fo) && inKr(fl, fo)) origin = { lat: fl, lng: fo, mine: true };
  const d0 = plan.days[0];
  const pts = d0.stops.filter(hasLL);
  if (pts.length < 2) return;
  const center = { lat: pts.reduce((t, s) => t + s.lat, 0) / pts.length, lng: pts.reduce((t, s) => t + s.lng, 0) / pts.length };
  let entry = null;
  if (km(origin, center) < 15) entry = { name: '내 위치', lat: origin.lat, lng: origin.lng, kind: 'me' };
  else {
    const kk = String(env.KAKAO_REST_KEY || '').trim();
    if (kk) {
      try {
        const q = new URLSearchParams({ query: 'IC', x: center.lng.toFixed(6), y: center.lat.toFixed(6), radius: '20000', size: '15', sort: 'distance' });
        const r = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?' + q.toString(), { headers: { Authorization: 'KakaoAK ' + kk } });
        const docs = r.ok ? ((await r.json().catch(() => ({}))).documents || []) : [];
        const ics = docs.map((d) => ({ name: clean(d.place_name, 30), lat: Number(d.y), lng: Number(d.x), cat: String(d.category_name || '') }))
          .filter((x) => x.name && isFinite(x.lat) && isFinite(x.lng) && (/(IC|나들목)$/.test(x.name) || /나들목|IC/.test(x.cat)) && !/(하이패스|휴게소|주유소|정류장)/.test(x.name));
        ics.sort((a, b) => km(origin, a) - km(origin, b));
        if (ics[0]) entry = { name: ics[0].name, lat: ics[0].lat, lng: ics[0].lng, kind: 'ic' };
      } catch {}
    }
  }
  const flip = (d, ref) => {
    const ll = d.stops.filter(hasLL);
    if (!ref || ll.length < 2) return;
    if (km(ref, ll[ll.length - 1]) + 0.3 < km(ref, ll[0])) {
      const times = d.stops.map((s) => s.time);
      d.stops.reverse();
      d.stops.forEach((s, i) => { s.time = times[i]; });
    }
  };
  flip(d0, entry || origin);
  for (let i = 1; i < plan.days.length; i++) {
    const prev = plan.days[i - 1].stops.filter(hasLL);
    flip(plan.days[i], prev[prev.length - 1]);
  }
  if (entry) plan.entry = entry;
}
async function askTrip(env, rows, near, nights, start, ppl, note) {
  const posts = rows.map((r) => ({ id: rowKey(r),name: r.place_name, addr: r.place_addr || '', lat: r.lat, lng: r.lng, tags: r.tags || [], note: String(r.body || '').slice(0, 150) }));
  const spots = near.spots.map((x) => ({ id: x.id, name: x.name, cat: x.cat, addr: x.addr, lat: x.lat, lng: x.lng }));
  const foods = near.foods.map((x) => ({ id: x.id, name: x.name, cat: x.cat, addr: x.addr, lat: x.lat, lng: x.lng }));
  const sys = [
    'You plan a realistic travel course for the coverfo 누리트립 app, in Korean.',
    'You get three lists: posts (places the user picked or typed, ids p… or t… — MUST all be included; it may be empty when the user only named an area), spots (top map search results for tourist attractions in the area) and foods (top map search results for restaurants in the area). Write all text in Korean.',
    'Rules:',
    '- Use ONLY the given ids (p…, t…, s…, f…). Never invent places, prices, opening hours, menus or transport times. Each id at most once.',
    '- Number of days = nights + 1 = ' + (nights + 1) + '.',
    '- Include every post. If spots/foods are given: add 2-4 spots per day and a lunch stop from foods every day; add a dinner stop from foods on days that continue into the evening (not needed on the last day if it ends in the afternoon).',
    '- Order each day as a sensible driving course: group places by lat/lng, start near the first place, avoid going back and forth, put the meal near the stops before/after it.',
    '- time: realistic clock times (e.g. 09:30, 11:00, 12:30 점심, 14:00, 16:00, 18:30 저녁).',
    '- note: one short line — for posts use the post note/tags; for spots/foods describe only by its category (e.g. "전망 명소", "한식 식사"); never claim facts you do not have.',
    '- area: where to stay overnight when nights > 0 (short Korean name), else "".',
    '- tips: 0-4 short tips about the order/moving. No prices or hours.',
    'Always answer by calling the make_trip tool exactly once (no other text). If you cannot call it, reply with only the same JSON object.',
  ].join('\n');
  const user = 'nights: ' + nights + (start ? ', start: ' + start : '') + ', people: ' + ppl + (note ? '\nrequest: ' + note : '') +
    '\nposts: ' + JSON.stringify(posts) + '\nspots: ' + JSON.stringify(spots) + '\nfoods: ' + JSON.stringify(foods);
  const r = await anthropicFetch(env, '/v1/messages', { method: 'POST', body: JSON.stringify({ model: env.HUB_MODEL || MODEL_DEFAULT, max_tokens: 3000, system: sys, tools: [TRIP_TOOL], messages: [{ role: 'user', content: user }] }) });
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
function cleanTrip(p, rows, near, nights) {
  const book = {};
  rows.forEach((r) => { book[rowKey(r)] = { src: r.typed ? 'typed' : 'post', post_id: r.typed ? 0 : r.id, name: clean(r.place_name, 40), addr: clean(r.place_addr, 80), cat: '', lat: typeof r.lat === 'number' ? r.lat : null, lng: typeof r.lng === 'number' ? r.lng : null, url: r.url || '' }; });
  near.spots.forEach((x) => { book[x.id] = Object.assign({ src: 'spot' }, x); });
  near.foods.forEach((x) => { book[x.id] = Object.assign({ src: 'food' }, x); });
  const used = new Set();
  const days = (Array.isArray(p.days) ? p.days : []).slice(0, nights + 1).map((d) => ({
    theme: clean(d && d.theme, 40),
    stops: (Array.isArray(d && d.stops) ? d.stops : []).map((x) => {
      let id = String(x && x.id != null ? x.id : '').trim(); if (/^\d+$/.test(id)) id = 'p' + id; if (/^pt\d+$/.test(id)) id = id.slice(1);
      const b = book[id]; if (!b || used.has(id)) return null; used.add(id);
      return { id, time: clean(x && x.time, 12), note: clean(x && x.note, 80), src: b.src, post_id: b.post_id || 0, name: b.name, cat: b.cat || '', addr: b.addr || '', lat: b.lat, lng: b.lng, url: b.url || '', pid: b.pid || '' };
    }).filter(Boolean).slice(0, 9),
  })).filter((d) => d.stops.length);
  if (!days.length) throw new Error('일정을 만들지 못했어요');
  return { title: clean(p.title, 40) || '여행 일정', area: nights > 0 ? clean(p.area, 30) || near.area : '', days, tips: (Array.isArray(p.tips) ? p.tips : []).map((x) => clean(x, 100)).filter(Boolean).slice(0, 4),
    left: rows.filter((r) => !r.typed && !used.has('p' + r.id)).map((r) => r.id), left_typed: rows.filter((r) => r.typed && !used.has(r.tid)).map((r) => r.place_name), near: near.spots.length + near.foods.length > 0,
    src: near.spots.length + near.foods.length > 0 ? (near.google ? '주변 명소·맛집: Google 지도' : '주변 명소·맛집: 카카오맵 장소 검색') : '',
    google: !!near.google, gkey: near.google ? near.gkey || '' : '' };
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
/* v433 만든 일정 저장 — 해외(구글) 장소는 place id 만 남기고 구글 내용(이름·주소·좌표·종류·주소 링크)은 지움 */
async function savePlan(c, uid, plan, rows) {
  const names = {}; rows.forEach((r) => { names[r.id] = clean(r.place_name, 40); });
  const days = (plan.days || []).map((d) => ({ theme: d.theme, stops: (d.stops || []).map((s) => (plan.google && s.src !== 'post')
    ? { id: s.id, time: s.time, note: s.note, src: s.src, post_id: 0, name: '', cat: '', addr: '', lat: null, lng: null, url: '', pid: s.pid || '' }
    : s) }));
  const keep = Object.assign({}, plan, { days, gkey: '', left_names: (plan.left || []).map((id) => names[id] || '') });
  const r = await fetch(`${c.url}/rest/v1/cf_trip_plans`, { method: 'POST', headers: hdr(c, { Prefer: 'return=representation' }), body: JSON.stringify({ user_id: uid, title: clean(plan.title, 40) || '여행 일정', plan: keep }) });
  if (!r.ok) return 0;
  const row = (await r.json())[0];
  /* 50개 넘으면 오래된 것부터 지움 */
  const all = (await get(c, `cf_trip_plans?user_id=eq.${uid}&select=id&order=created_at.desc&offset=${MAX_PLANS}&limit=100`)) || [];
  if (all.length) await fetch(`${c.url}/rest/v1/cf_trip_plans?id=in.(${all.map((x) => x.id).join(',')})`, { method: 'DELETE', headers: hdr(c) }).catch(() => {});
  return row && row.id || 0;
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
