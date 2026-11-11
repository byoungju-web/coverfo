// functions/api/parcel.js — coverfo 📦 주문·배송 조회 (v363)
// © 2026 coverfo All Rights Reserved
//
// POST /api/parcel   (Authorization: Bearer coverfo 로그인키)
//   { op:"carriers" }                         → { ok, items:[{code,name}], live }  택배사 목록 (스마트택배 목록 · 하루 캐시, 키가 없으면 주요 택배사만)
//   { op:"track", code, invoice }             → { ok, carrier, level, step, done, item, estimate, last:{time,where,kind}, steps:[…최근 8개] }
//                                               v364: 누를 때마다 PARCEL_TRACK_COST 크레딧(기본 1) · 조회가 안 되면 돌려줌
//   { op:"watch", code, invoice, label }      → 🔔 배송완료 알림 켜기 · PARCEL_ALERT_COST 크레딧(기본 3 · v364) · 같은 송장은 한 번만 차감
//   { op:"unwatch", id }                      → 알림 끄기 (아직 배송완료 전이면 크레딧을 돌려줌)
//   { op:"watches" }                          → 내가 알림을 켠 송장 목록 (최근 20개)
//
// · 배송 단계는 스마트택배(SweetTracker) 공식 조회 API 로 확인한다 — Cloudflare 비밀값 SWEETTRACKER_KEY (없으면 track 은 { nokey:true }).
// · 쿠팡 계정·주문 화면은 읽지 않는다 (공식 API 없음 · 로그인 대행 안 함). 주문목록은 화면이 쿠팡 공식 화면을 열어 줄 뿐.
// · 배송기사 이름·전화번호, 받는 사람 정보는 돌려주지 않는다. 알림을 켠 송장만 계정(cf_parcel)에 저장 (sql/cf_parcel.sql 1번 실행).
// · 배송완료 확인·알림은 hub.js 의 cron_due(coverfo-cron 이 5분마다 깨움)가 한다. 14일 안에 완료가 안 보이면 크레딧을 돌려준다.

const ST = 'https://info.sweettracker.co.kr/api/v1/';
const ALERT_COST = 3;      /* v364: 알림 1건 3크레딧 (서버가 송장당 보통 10~15번 확인) */
const TRACK_COST = 1;      /* v364: [🚚 배송 조회] 1번 = 1크레딧 */
const WATCH_MAX = 20;
const STEP = ['', '배송 준비', '집화 완료', '이동 중', '지점 도착', '배송 출발', '배송 완료'];
const BASIC = [['04', 'CJ대한통운'], ['08', '롯데택배'], ['05', '한진택배'], ['01', '우체국택배'], ['06', '로젠택배'], ['11', '일양로지스'], ['23', '경동택배'], ['22', '대신택배'], ['46', 'CU 편의점택배'], ['24', 'GS Postbox 편의점택배'], ['53', '농협택배']];

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
    if (op === 'carriers') return json(Object.assign(await carriers(env), { cost: costOf(env), trackCost: trackCostOf(env) }));
    if (op === 'track') {
      const code = cleanCode(b.code), inv = cleanInv(b.invoice);
      if (!code || !inv) return json({ error: '택배사와 송장번호를 확인해 주세요' }, 400);
      return json(await paidTrack(env, c, uid, code, inv));
    }
    if (op === 'watch') return json(await watch(env, c, uid, b));
    if (op === 'unwatch') return json(await unwatch(env, c, uid, b));
    if (op === 'watches') return json({ ok: true, cost: costOf(env), trackCost: trackCostOf(env), items: await req(c, 'GET', 'cf_parcel?select=id,code,carrier,invoice,label,level,status,last_where,last_time,done,notify,notified,notify_until,created_at&user_id=eq.' + uid + '&order=created_at.desc&limit=' + WATCH_MAX) });
    return json({ error: '잘못된 요청입니다' }, 400);
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    const m = String((e && e.message) || e);
    if (/cf_parcel/.test(m) && /404|42P01|does not exist|schema cache/.test(m)) return json({ error: '배송 알림 표가 아직 없어요. Supabase 에서 sql/cf_parcel.sql 을 한 번 실행해 주세요.', setup: true }, 500);
    return json({ error: m.slice(0, 300) }, 500);
  }
}

/* ── 택배사 목록 ── */
async function carriers(env) {
  const key = String(env.SWEETTRACKER_KEY || '').trim();
  const basic = BASIC.map(([code, name]) => ({ code, name }));
  if (!key) return { ok: true, live: false, items: basic };
  const cacheKey = new Request('https://coverfo.com/__cache/parcel-carriers-v1');
  try {
    const hit = await caches.default.match(cacheKey);
    if (hit) return { ok: true, live: true, items: await hit.json() };
  } catch {}
  try {
    const r = await fetch(ST + 'companylist?t_key=' + encodeURIComponent(key), { headers: { Accept: 'application/json' } });
    const j = await r.json();
    const list = (j && (j.Company || j.company || j)) || [];
    const items = (Array.isArray(list) ? list : []).map((x) => ({ code: cleanCode(x.Code || x.code), name: String(x.Name || x.name || '').slice(0, 40), intl: !!(x.International === true || x.International === 'true') }))
      .filter((x) => x.code && x.name && !x.intl).map((x) => ({ code: x.code, name: x.name }));
    if (!items.length) return { ok: true, live: false, items: basic };
    try { await caches.default.put(cacheKey, new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=86400' } })); } catch {}
    return { ok: true, live: true, items };
  } catch { return { ok: true, live: false, items: basic }; }
}

/* ── 배송 조회 (스마트택배) ── */
async function stTrack(key, code, inv) {
  const q = 't_key=' + encodeURIComponent(key) + '&t_code=' + encodeURIComponent(code) + '&t_invoice=' + encodeURIComponent(inv);
  let r = await fetch(ST + 'trackingInfo?' + q, { headers: { Accept: 'application/json' } });
  if (r.status === 405) r = await fetch(ST + 'trackingInfo?' + q, { method: 'POST', headers: { Accept: 'application/json' } });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!j) return { ok: false, error: '배송 정보를 읽지 못했어요 (' + r.status + ')' };
  if (j.status === false || j.result === 'N' || (j.code && j.msg && !j.trackingDetails)) return { ok: false, error: String(j.msg || '조회되지 않는 송장이에요. 택배사와 번호를 확인해 주세요').slice(0, 120) };
  const det = (Array.isArray(j.trackingDetails) ? j.trackingDetails : []).map((d) => ({ time: clean(d.timeString, 30), where: clean(d.where, 40), kind: clean(d.kind, 60), level: Number(d.level) || 0 }));
  const last = j.lastStateDetail || j.lastDetail || det[det.length - 1] || null;
  let level = Number(j.level) || (last && Number(last.level)) || 0;
  const done = j.complete === true || j.completeYN === 'Y' || level >= 6;
  if (done) level = 6;
  return {
    ok: true, level, step: STEP[level] || '확인 중', done,
    item: clean(j.itemName, 60), estimate: clean(j.estimate, 40),
    last: last ? { time: clean(last.timeString, 30), where: clean(last.where, 40), kind: clean(last.kind, 60) } : null,
    steps: det.slice(-8).reverse(),
  };
}
async function track(env, code, inv) {
  const key = String(env.SWEETTRACKER_KEY || '').trim();
  if (!key) return { ok: false, nokey: true, error: '배송 단계 조회가 아직 준비되지 않았어요. 택배사 공식 조회 화면으로 확인해 주세요.' };
  const r = await stTrack(key, code, inv);
  return Object.assign({ carrier: nameOf(code) }, r);
}

/* v364: [🚚 배송 조회] 누를 때마다 크레딧 · 키가 없거나 조회가 안 되면 차감하지 않음(돌려줌) */
async function paidTrack(env, c, uid, code, inv) {
  if (!String(env.SWEETTRACKER_KEY || '').trim()) return track(env, code, inv);
  const cost = trackCostOf(env);
  const job = await spend(c, uid, cost, '[배송 조회] ' + nameOf(code) + ' ' + inv.slice(-4));
  if (job === false) throw httpErr(402, '크레딧이 부족해요 (배송 조회 ' + cost + ' 필요)');
  let r = null;
  try { r = await track(env, code, inv); } catch (e) { await refund(c, job); throw e; }
  if (!r || !r.ok) { await refund(c, job); return Object.assign({}, r, { charged: 0 }); }
  if (job != null) await rpcDone(c, job);
  return Object.assign(r, { charged: cost });
}
async function rpcDone(c, job) {
  try { await req(c, 'PATCH', 'cf_jobs?id=eq.' + Number(job), { status: 'done', updated_at: new Date().toISOString() }, 'return=minimal'); } catch {}
}

/* ── 🔔 배송완료 알림 (크레딧) ── */
async function watch(env, c, uid, b) {
  const code = cleanCode(b.code), inv = cleanInv(b.invoice);
  if (!code || !inv) throw httpErr(400, '택배사와 송장번호를 확인해 주세요');
  if (!String(env.SWEETTRACKER_KEY || '').trim()) throw httpErr(503, '배송완료 알림이 아직 준비되지 않았어요');
  /* 이름만 저장 — 전화·계좌번호처럼 보이는 숫자와 받는 사람 표시는 버린다 */
  const label = clean(String(b.label || '').split(/\s*(받는\s*분|수령인|고객명|성함|연락처|주소|전화|휴대폰)/)[0].replace(/(?:\d[\s.\-]?){6,}/g, ''), 30);
  const old = await req(c, 'GET', 'cf_parcel?select=id,done,notify&user_id=eq.' + uid + '&code=eq.' + code + '&invoice=eq.' + encodeURIComponent(inv) + '&limit=1');
  if (Array.isArray(old) && old[0] && old[0].notify) return { ok: true, id: old[0].id, already: true, charged: 0 };
  const cnt = await req(c, 'GET', 'cf_parcel?select=id&user_id=eq.' + uid + '&notify=eq.true&done=eq.false&limit=' + (WATCH_MAX + 1));
  if (Array.isArray(cnt) && cnt.length >= WATCH_MAX) throw httpErr(429, '알림은 한 번에 ' + WATCH_MAX + '개까지 켤 수 있어요');
  /* 지금 단계를 먼저 확인 (이미 배송완료면 차감하지 않음) */
  const now = await stTrack(String(env.SWEETTRACKER_KEY).trim(), code, inv).catch(() => null);
  if (now && now.ok && now.done) return { ok: true, done: true, charged: 0, note: '이미 배송완료된 송장이라 알림을 켜지 않았어요' };
  const cost = costOf(env);
  const job = await spend(c, uid, cost, '[배송완료 알림] ' + (label || nameOf(code) + ' ' + inv.slice(-4)));
  if (job === false) throw Object.assign(httpErr(402, '크레딧이 부족해요 (배송완료 알림 ' + cost + ' 필요)'), { need: cost });
  const row = {
    user_id: uid, code, carrier: nameOf(code), invoice: inv, label,
    level: now && now.ok ? now.level : 0, status: now && now.ok ? now.step : '',
    last_where: now && now.ok && now.last ? now.last.where : '', last_time: now && now.ok && now.last ? now.last.time : '',
    done: false, notify: true, notified: false, job_id: job,
    notify_until: new Date(Date.now() + 14 * 86400e3).toISOString(),
    next_check: new Date(Date.now() + (now && now.ok && now.level >= 5 ? 60 : 360) * 60e3).toISOString(), updated_at: new Date().toISOString(),
  };
  try {
    const ins = await req(c, 'POST', 'cf_parcel?on_conflict=user_id,code,invoice', row, 'resolution=merge-duplicates,return=representation');
    return { ok: true, id: Array.isArray(ins) && ins[0] ? ins[0].id : null, charged: cost };
  } catch (e) {
    await refund(c, job);
    throw e;
  }
}
async function unwatch(env, c, uid, b) {
  const id = String(b.id || '');
  if (!/^\d{1,18}$/.test(id)) throw httpErr(400, '잘못된 요청입니다');
  const r = await req(c, 'GET', 'cf_parcel?select=id,done,notified,job_id&user_id=eq.' + uid + '&id=eq.' + id + '&limit=1');
  const p = Array.isArray(r) && r[0];
  if (!p) return { ok: true };
  await req(c, 'DELETE', 'cf_parcel?user_id=eq.' + uid + '&id=eq.' + id);
  let refunded = false;
  if (!p.done && !p.notified && p.job_id != null) { await refund(c, p.job_id); refunded = true; }
  return { ok: true, refunded };
}

/* ── 크레딧 (plan.js 와 같은 방식 · 결제·충전 코드는 건드리지 않음) ── */
function costOf(env) { const v = env.PARCEL_ALERT_COST; const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : ALERT_COST; }
function trackCostOf(env) { const v = env.PARCEL_TRACK_COST; const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : TRACK_COST; }
async function rpc(c, name, args) {
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 200));
  try { return JSON.parse(t); } catch { return t; }
}
async function spend(c, uid, cost, label) {
  if (!cost) return null;
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

/* ── 공용 ── */
function nameOf(code) { const f = BASIC.find((x) => x[0] === code); return f ? f[1] : ''; }
function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function cleanCode(v) { const s = String(v == null ? '' : v).trim(); return /^[0-9A-Za-z]{2,4}$/.test(s) ? s : ''; }
function cleanInv(v) { const s = String(v == null ? '' : v).replace(/[\s-]/g, ''); return /^[0-9A-Za-z]{8,25}$/.test(s) ? s : ''; }
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
  if (!r.ok) throw new Error('cf_parcel DB ' + r.status + ': ' + t.slice(0, 200));
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
