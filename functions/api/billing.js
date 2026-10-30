// functions/api/billing.js — coverfo 📅 크레딧 월 구독 (토스페이먼츠 빌링 · 자동결제) v286
// © 2026 coverfo All Rights Reserved
//
// 필요한 Secret (Cloudflare Pages → Settings → Variables and Secrets) — 기존 TOSS_CLIENT_KEY·TOSS_SECRET_KEY(크레딧 충전)와 따로:
//   TOSS_BILLING_CLIENT_KEY   빌링 상점(bill_coverjany)의 'API 개별 연동 키' 클라이언트 키 (test_ck_… 면 테스트)
//   TOSS_BILLING_SECRET_KEY   같은 상점의 시크릿 키 (test_sk_… / live_sk_…)
//   (선택) TOSS_BILLING_MID   bill_coverjany — 넣으면 결제 응답의 상점아이디도 대조
//   (선택) SUB_PLANS          "sub100:100:9900,sub300:300:29000,sub550:550:49000" (이름:매달 크레딧:매달 원)
//   HUB_CRON_KEY · SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY  (이미 있음)
// 필요한 표: sql/cf_subs.sql 1회 실행. 매달 결제 기록은 기존 cf_orders 표(주문번호 cfsub_…)에 들어가 충전 내역·환불에 그대로 보인다.
//
//   GET  /api/billing?config=1                 → { url, anonKey, clientKey, plans, enabled, testMode }
//   POST /api/billing {op:'me'}                 → 내 구독 상태 (로그인)
//   POST /api/billing {op:'start', plan}        → 카드 등록 준비 { customerKey, email } → 화면이 토스 카드 등록창(requestBillingAuth)을 연다
//   GET  /api/billing?op=auth&customerKey&authKey → 토스가 돌려보내는 주소: 빌링키 발급 → 첫 달 결제 → 크레딧 충전 → /subscribe 로
//   POST /api/billing {op:'cancel'}             → 해지 (다음 결제일부터 결제 없음 · 이번 달 크레딧은 그대로)
//   POST /api/billing {op:'resume'}             → 해지 취소 (이번 달 이용 기간이 남아 있을 때만)
//   POST /api/billing {op:'cron'}  (헤더 X-Hub-Cron = HUB_CRON_KEY · coverfo-cron Worker 가 5분마다) → 결제일이 된 구독 결제
//
// 규칙
//   · 1개월 단위 자동 갱신. 결제할 때마다 그 달 크레딧을 충전 크레딧으로 넣는다 (1크레딧 99원 기준 · 기존 충전과 같은 지갑).
//   · 해지는 언제든. 해지하면 다음 결제일부터 결제하지 않는다. 환불은 기존 환불정책(coverfo.com/refund)과 같다.
//   · 결제가 실패하면 하루 뒤 다시, 3번 연달아 실패하면 멈춘다(stopped).
//   · 같은 달을 두 번 결제하지 않게: 주문번호 = 구독+회차(cfsub_<구독>_<회차>, 다시 시도는 …r1·r2) + 토스 멱등키(주문번호) + 결제 전 '다음 결제 시각'을 먼저 옮겨 잡음.
//     응답이 끊기면(시간 초과 등) 주문번호로 토스에 결제를 조회해, 실제로 결제됐으면 실패로 처리하지 않고 충전한다.
//   · 카드번호·빌링키는 화면·브라우저로 보내지 않는다 (빌링키는 서버 표에만, 해지 후 이용 기간이 끝나면 지움).

const TOSS = 'https://api.tosspayments.com';
const MAX_FAILS = 3;

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function redirect(url) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}
function cfg(env) {
  const raw = String(env.SUB_PLANS || 'sub100:100:9900,sub300:300:29000,sub550:550:49000');
  const plans = raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const p = s.split(':');
    return { id: p[0], credits: parseInt(p[1], 10), amount: parseInt(p[2], 10) };
  }).filter((p) => /^[a-z0-9_]{2,20}$/.test(p.id) && p.credits > 0 && p.amount > 0);
  return {
    sbUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anon: env.SUPABASE_ANON_KEY || '',
    service: env.SUPABASE_SERVICE_ROLE_KEY || '',
    clientKey: env.TOSS_BILLING_CLIENT_KEY || '',
    secretKey: env.TOSS_BILLING_SECRET_KEY || '',
    mid: String(env.TOSS_BILLING_MID || ''),
    cronKey: String(env.HUB_CRON_KEY || ''),
    plans,
  };
}
function sbHeaders(c, extra) {
  return Object.assign({ apikey: c.service, Authorization: 'Bearer ' + c.service, 'Content-Type': 'application/json' }, extra || {});
}
async function sbGet(c, path) {
  const r = await fetch(c.sbUrl + '/rest/v1/' + path, { headers: sbHeaders(c) });
  if (!r.ok) throw new Error('DB 읽기 실패 ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbPatch(c, path, patch) {
  const r = await fetch(c.sbUrl + '/rest/v1/' + path, { method: 'PATCH', headers: sbHeaders(c, { Prefer: 'return=representation' }), body: JSON.stringify(patch) });
  if (!r.ok) throw new Error('DB 저장 실패 ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}
async function sbPost(c, table, row, prefer) {
  const r = await fetch(c.sbUrl + '/rest/v1/' + table, { method: 'POST', headers: sbHeaders(c, { Prefer: prefer || 'return=representation' }), body: JSON.stringify(row) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { ok: r.ok, status: r.status, rows: Array.isArray(j) ? j : [], text: t };
}
async function rpc(c, name, args) {
  const r = await fetch(c.sbUrl + '/rest/v1/rpc/' + name, { method: 'POST', headers: sbHeaders(c), body: JSON.stringify(args || {}) });
  const t = await r.text();
  if (!r.ok) throw new Error('supabase rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 300));
  try { return JSON.parse(t); } catch (e) { return t; }
}
async function getUser(c, request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(c.sbUrl + '/auth/v1/user', { headers: { apikey: c.service, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}
function safeEq(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
function randHex(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
/* 한 달 뒤 같은 날 (31일 → 다음 달 말일) */
function addMonth(iso) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString();
}
function tossAuth(c) { return 'Basic ' + btoa(c.secretKey + ':'); }
function subOut(s) {
  if (!s) return null;
  return { plan: s.plan, credits: s.credits, amount: s.amount, status: s.status, card: s.card || '', period: s.period, started_at: s.started_at, paid_until: s.paid_until, next_at: s.next_at, canceled_at: s.canceled_at, last_error: s.status === 'stopped' ? (s.last_error || '') : '' };
}
async function latestSub(c, userId) {
  const rows = await sbGet(c, 'cf_subs?select=*&user_id=eq.' + encodeURIComponent(userId) + '&status=in.(active,canceled,stopped)&order=created_at.desc&limit=1');
  return rows[0] || null;
}

/* ───────────── 결제 1회 (첫 달 · 매달 공통) ───────────── */
async function charge(c, sub, n, attempt) {
  /* 다시 시도할 때는 주문번호를 바꾼다 — 토스는 같은 멱등키(15일)·같은 주문번호에 처음 응답(실패)을 그대로 돌려주기 때문 */
  const orderId = 'cfsub_' + String(sub.id).replace(/-/g, '').slice(0, 16) + '_' + n + (attempt ? 'r' + attempt : '');
  const orderName = 'coverfo 크레딧 월 구독 ' + sub.credits;
  /* 주문을 먼저 저장 (같은 회차가 이미 있으면 그 주문을 이어서 씀) */
  const ins = await sbPost(c, 'cf_orders', { order_id: orderId, user_id: sub.user_id, email: sub.email || null, package: sub.plan, credits: sub.credits, amount: sub.amount, status: 'pending' });
  if (!ins.ok) {
    const ex = (await sbGet(c, 'cf_orders?select=*&order_id=eq.' + encodeURIComponent(orderId)))[0];
    if (!ex) throw new Error('주문 저장 실패: ' + ins.text.slice(0, 150));
    if (ex.status === 'paid') return { ok: true, already: true, orderId };
  }
  let r = null, d = {};
  try {
    r = await fetch(TOSS + '/v1/billing/' + encodeURIComponent(sub.billing_key), {
      method: 'POST',
      headers: { Authorization: tossAuth(c), 'Content-Type': 'application/json', 'Idempotency-Key': orderId },
      body: JSON.stringify({ customerKey: sub.customer_key, amount: sub.amount, orderId, orderName, customerEmail: sub.email || undefined }),
      signal: AbortSignal.timeout(25000),
    });
    d = await r.json().catch(() => ({}));
  } catch (e) { r = null; }
  /* 응답이 끊겼거나 서버 오류면: 주문번호로 실제 결제 여부를 조회 */
  if (!r || r.status >= 500) {
    try {
      const q = await fetch(TOSS + '/v1/payments/orders/' + encodeURIComponent(orderId), { headers: { Authorization: tossAuth(c) }, signal: AbortSignal.timeout(15000) });
      const qd = await q.json().catch(() => ({}));
      if (q.ok && qd && qd.status) { r = { ok: true, status: 200 }; d = qd; }
    } catch (e) {}
    if (!r) { r = { ok: false, status: 0 }; d = { message: '토스 응답 없음 (잠시 뒤 다시 시도)' }; }
  }
  const okPay = r.ok && d && d.status === 'DONE' && String(d.orderId || '') === orderId && Number(d.totalAmount) === Number(sub.amount) && (!c.mid || !d.mId || String(d.mId) === c.mid);
  if (!okPay) {
    const why = String((d && (d.message || d.code)) || (r.ok ? '결제 응답이 주문과 맞지 않음 (' + (d.status || '') + ')' : '토스 결제 실패 ' + r.status)).slice(0, 200);
    await sbPatch(c, 'cf_orders?order_id=eq.' + encodeURIComponent(orderId) + '&status=eq.pending', { status: 'failed', note: why }).catch(() => null);
    return { ok: false, error: why, orderId };
  }
  /* pending → paid 를 먼저 잡아 두 번 충전되지 않게 */
  const locked = await sbPatch(c, 'cf_orders?order_id=eq.' + encodeURIComponent(orderId) + '&status=in.(pending,failed)', { status: 'paid', payment_key: d.paymentKey || null, method: d.method || '카드', paid_at: new Date().toISOString() });
  if (locked) await rpc(c, 'cf_topup', { p_user: sub.user_id, p_amount: sub.credits, p_note: '토스 월 구독 ' + orderId });
  return { ok: true, orderId };
}

/* ───────────── 카드 등록 뒤 (토스가 돌려보내는 주소) ───────────── */
async function authReturn(c, customerKey, authKey) {
  if (!customerKey || !authKey) throw new Error('카드 등록 정보가 없습니다');
  const sub = (await sbGet(c, 'cf_subs?select=*&customer_key=eq.' + encodeURIComponent(customerKey)))[0];
  if (!sub) throw new Error('구독 신청을 찾을 수 없습니다. 다시 시도해 주세요');
  if (sub.status === 'active') return sub;   /* 새로고침 */
  /* 한 번만 처리: pending → charging */
  const lock = await sbPatch(c, 'cf_subs?id=eq.' + sub.id + '&status=eq.pending', { status: 'charging', updated_at: new Date().toISOString() });
  if (!lock) throw new Error('이미 처리 중이거나 끝난 신청입니다. 구독 화면을 새로고침해 주세요');
  const fail = async (msg) => {
    await sbPatch(c, 'cf_subs?id=eq.' + sub.id, { status: 'stopped', billing_key: null, last_error: String(msg).slice(0, 200), updated_at: new Date().toISOString() }).catch(() => null);
    throw new Error(msg);
  };
  const r = await fetch(TOSS + '/v1/billing/authorizations/issue', {
    method: 'POST',
    headers: { Authorization: tossAuth(c), 'Content-Type': 'application/json' },
    body: JSON.stringify({ authKey, customerKey }),
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.billingKey) return fail('카드 등록 실패: ' + String(d.message || d.code || r.status));
  if (d.customerKey && d.customerKey !== customerKey) return fail('카드 등록 정보가 맞지 않습니다');
  const card = ((d.cardCompany || (d.card && d.card.issuerCode) || '') + ' ' + String(d.cardNumber || (d.card && d.card.number) || '').replace(/[^0-9*]/g, '').slice(-4)).trim();
  const s2 = Object.assign({}, sub, { billing_key: d.billingKey });
  await sbPatch(c, 'cf_subs?id=eq.' + sub.id, { billing_key: d.billingKey, card: card || null, updated_at: new Date().toISOString() });
  const res = await charge(c, s2, 1, 0);
  if (!res.ok) return fail('첫 달 결제 실패: ' + res.error);
  const now = new Date().toISOString(), until = addMonth(now);
  return sbPatch(c, 'cf_subs?id=eq.' + sub.id, { status: 'active', period: 1, started_at: now, paid_until: until, next_at: until, fails: 0, last_error: null, updated_at: now });
}

/* ───────────── 매달 결제 (coverfo-cron) ───────────── */
async function cron(c) {
  const now = new Date();
  const due = await sbGet(c, 'cf_subs?select=*&status=eq.active&next_at=lte.' + encodeURIComponent(now.toISOString()) + '&order=next_at.asc&limit=20');
  const out = { ok: true, due: due.length, charged: 0, failed: 0, stopped: 0 };
  for (const s of due) {
    /* 먼저 다음 시도 시각을 1시간 뒤로 옮겨 잡음 → 다른 깨우기와 겹쳐도 한 번만 */
    const claim = await sbPatch(c, 'cf_subs?id=eq.' + s.id + '&status=eq.active&next_at=eq.' + encodeURIComponent(s.next_at), { next_at: new Date(now.getTime() + 3600e3).toISOString(), updated_at: now.toISOString() }).catch(() => null);
    if (!claim) continue;
    let res;
    try { res = s.billing_key ? await charge(c, s, (s.period || 0) + 1, s.fails || 0) : { ok: false, error: '빌링키 없음' }; }
    catch (e) { res = { ok: false, error: String((e && e.message) || e).slice(0, 200) }; }
    if (res.ok) {
      const until = addMonth(s.paid_until || now.toISOString());
      await sbPatch(c, 'cf_subs?id=eq.' + s.id, { period: (s.period || 0) + 1, paid_until: until, next_at: until, fails: 0, last_error: null, updated_at: new Date().toISOString() });
      out.charged++;
    } else {
      const fails = (s.fails || 0) + 1;
      const stop = fails >= MAX_FAILS;
      await sbPatch(c, 'cf_subs?id=eq.' + s.id, { fails, last_error: res.error, status: stop ? 'stopped' : 'active', next_at: stop ? null : new Date(now.getTime() + 24 * 3600e3).toISOString(), billing_key: stop ? null : s.billing_key, updated_at: new Date().toISOString() });
      if (stop) out.stopped++; else out.failed++;
    }
  }
  /* 해지 후 이용 기간이 끝난 구독은 빌링키를 지움 */
  await sbPatch(c, 'cf_subs?status=eq.canceled&billing_key=not.is.null&paid_until=lt.' + encodeURIComponent(now.toISOString()), { billing_key: null, updated_at: now.toISOString() }).catch(() => null);
  return out;
}

/* ───────────── 요청 처리 ───────────── */
async function handleGet(context) {
  const { request, env } = context;
  const c = cfg(env);
  const url = new URL(request.url);
  if (url.searchParams.get('config')) {
    return json({ url: c.sbUrl, anonKey: c.anon, clientKey: c.clientKey, plans: c.plans, enabled: !!(c.clientKey && c.secretKey && c.sbUrl && c.service), testMode: /^test_/.test(c.clientKey) });
  }
  if (url.searchParams.get('op') === 'auth') {
    if (!c.secretKey || !c.sbUrl || !c.service) return redirect('/subscribe?fail=' + encodeURIComponent('구독 결제 준비 중입니다 (결제 키 미등록)'));
    try {
      const s = await authReturn(c, url.searchParams.get('customerKey') || '', url.searchParams.get('authKey') || '');
      return redirect('/subscribe?done=1&credits=' + (s && s.credits || ''));
    } catch (e) {
      return redirect('/subscribe?fail=' + encodeURIComponent(String((e && e.message) || e).slice(0, 200)));
    }
  }
  return json({ error: 'unknown' }, 400);
}

async function handlePost(context) {
  const { request, env } = context;
  const c = cfg(env);
  if (!c.sbUrl || !c.service) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }

  const cronKey = request.headers.get('X-Hub-Cron') || '';
  if (cronKey) {
    if (!safeEq(cronKey, c.cronKey)) return json({ error: '권한이 없어요' }, 401);
    if (body.op !== 'cron') return json({ error: 'unknown op' }, 400);
    if (!c.secretKey) return json({ ok: true, skipped: 'TOSS_BILLING_SECRET_KEY 없음' });
    return json(await cron(c));
  }

  const user = await getUser(c, request);
  if (!user) return json({ error: 'login' }, 401);

  if (body.op === 'me') {
    return json({ email: user.email || '', sub: subOut(await latestSub(c, user.id)), plans: c.plans, enabled: !!(c.clientKey && c.secretKey) });
  }

  if (body.op === 'start') {
    if (!c.clientKey || !c.secretKey) return json({ error: '구독 결제 준비 중입니다. 잠시 후 다시 시도해 주세요. (결제 키 미등록)' }, 503);
    const plan = c.plans.find((p) => p.id === body.plan);
    if (!plan) return json({ error: '요금제가 없습니다' }, 400);
    const cur = await latestSub(c, user.id);
    if (cur && cur.status === 'active') return json({ error: '이미 구독 중입니다. 요금제를 바꾸려면 해지한 뒤 이용 기간이 끝나면 새로 구독해 주세요.' }, 409);
    if (cur && cur.status === 'canceled' && cur.paid_until && new Date(cur.paid_until) > new Date()) return json({ error: '해지한 구독의 이용 기간이 ' + String(cur.paid_until).slice(0, 10) + '까지 남아 있어요. 계속 쓰려면 \'해지 취소\'를 눌러 주세요.' }, 409);
    /* 카드 등록 전 신청은 하나만 */
    await fetch(c.sbUrl + '/rest/v1/cf_subs?user_id=eq.' + encodeURIComponent(user.id) + '&status=eq.pending', { method: 'DELETE', headers: sbHeaders(c) }).catch(() => null);
    const customerKey = 'cs_' + randHex(16);
    const ins = await sbPost(c, 'cf_subs', { user_id: user.id, email: user.email || null, plan: plan.id, credits: plan.credits, amount: plan.amount, customer_key: customerKey, status: 'pending' });
    if (!ins.ok) return json({ error: '구독 신청 저장 실패: ' + ins.text.slice(0, 200) }, 500);
    return json({ customerKey, email: user.email || '', plan });
  }

  if (body.op === 'cancel') {
    const cur = await latestSub(c, user.id);
    if (!cur || cur.status !== 'active') return json({ error: '해지할 구독이 없습니다' }, 400);
    const s = await sbPatch(c, 'cf_subs?id=eq.' + cur.id + '&status=eq.active', { status: 'canceled', next_at: null, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return json({ ok: true, sub: subOut(s || cur) });
  }

  if (body.op === 'resume') {
    const cur = await latestSub(c, user.id);
    if (!cur || cur.status !== 'canceled' || !cur.billing_key || !cur.paid_until || new Date(cur.paid_until) <= new Date()) return json({ error: '해지를 취소할 수 있는 구독이 없습니다. 새로 구독해 주세요.' }, 400);
    const s = await sbPatch(c, 'cf_subs?id=eq.' + cur.id + '&status=eq.canceled', { status: 'active', next_at: cur.paid_until, canceled_at: null, updated_at: new Date().toISOString() });
    return json({ ok: true, sub: subOut(s || cur) });
  }

  return json({ error: 'unknown op' }, 400);
}

function safe(fn) {
  return async function (context) {
    try { return await fn(context); } catch (e) { return json({ error: 'server: ' + String((e && e.message) || e).slice(0, 400) }, 500); }
  };
}
export const onRequestGet = safe(handleGet);
export const onRequestPost = safe(handlePost);
