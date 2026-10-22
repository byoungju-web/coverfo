// functions/api/pay.js — coverfo 크레딧 충전 결제 (토스페이먼츠)
// © 2026 coverfo All Rights Reserved
//
// 필요한 Secret (Cloudflare Pages → Settings → Variables and Secrets):
//   TOSS_CLIENT_KEY   토스 클라이언트 키 (test_ck_… 로 시작하면 테스트 결제)
//   TOSS_SECRET_KEY   토스 시크릿 키   (test_sk_… / live_sk_…)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  (gen.js 와 동일)
// 선택: PACKAGES  예) "starter:100:9900,basic:300:29000,plus:550:49000,pro:1200:99000"  (이름:크레딧:원) — Cloudflare 변수에 PACKAGES 가 있으면 그 값이 우선
//
//   GET  /api/pay?config=1                       → { url, anonKey, clientKey, packages, testMode }
//   GET  /api/pay?me=1                           → { email, free, paid, orders:[...] }   (로그인 필요)
//   POST /api/pay  {op:'create', package}        → { orderId, orderName, amount, credits, customerKey }  (로그인 필요)
//   GET  /api/pay?op=confirm&paymentKey&orderId&amount  → 토스에 결제 확인 → 충전 → /buy?done=1 로 이동
//   POST /api/pay?webhook=1                      → 토스 웹훅 (결제 상태 변경 시 토스가 호출; 확인 누락 대비)
//
// v2 (2026-10-22, 토스 보안 체크리스트):
//   · 웹훅 본문은 믿지 않고 토스 결제 조회 API(GET /v1/payments/{paymentKey})로 상태·주문번호·금액을 다시 확인한 뒤에만 충전·취소
//   · 웹훅 DONE 때 결제를 다시 승인하지 않음 (이미 승인된 결제라 오류가 나서 failed 로 바뀌던 문제)
//   · 승인 요청이 "이미 처리된 결제(ALREADY_PROCESSED_PAYMENT)"면 조회 API로 확인해 DONE 이면 충전
//   · 승인 응답도 상태(DONE)·주문번호·금액을 대조
//   · 웹훅은 바로 200 으로 답하고 처리는 뒤에서 (토스 10초 기준)
//   · tosspayments-webhook-transmission-id 로 같은 웹훅 두 번 처리 방지 (sql/cf_toss_security.sql 의 cf_webhook_seen 표; 표가 없어도 결제는 그대로 됨)
//   · 선택 Secret TOSS_MID 를 넣으면 결제의 mId 도 대조

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function redirect(url) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}
function cfg(env) {
  const raw = String(env.PACKAGES || 'starter:100:9900,basic:300:29000,plus:550:49000,pro:1200:99000');   /* 1크레딧 99원 · 300은 29,000원(v206 추가) · 550은 10% 더 · 1,200은 20% 더 */
  const packages = raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const p = s.split(':');
    return { id: p[0], credits: parseInt(p[1], 10), amount: parseInt(p[2], 10) };
  }).filter((p) => p.id && p.credits > 0 && p.amount > 0);
  return {
    sbUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anon: env.SUPABASE_ANON_KEY || '',
    service: env.SUPABASE_SERVICE_ROLE_KEY || '',
    clientKey: env.TOSS_CLIENT_KEY || '',
    secretKey: env.TOSS_SECRET_KEY || '',
    mid: String(env.TOSS_MID || ''),
    packages,
  };
}
function sbHeaders(c, extra) {
  return Object.assign({ apikey: c.service, Authorization: 'Bearer ' + c.service, 'Content-Type': 'application/json' }, extra || {});
}
async function getUser(c, request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(c.sbUrl + '/auth/v1/user', { headers: { apikey: c.service, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}
async function rpc(c, name, args) {
  const r = await fetch(c.sbUrl + '/rest/v1/rpc/' + name, { method: 'POST', headers: sbHeaders(c), body: JSON.stringify(args || {}) });
  const t = await r.text();
  if (!r.ok) throw new Error('supabase rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 300));
  try { return JSON.parse(t); } catch (e) { return t; }
}
async function getCredits(c, userId) {
  const r = await fetch(c.sbUrl + '/rest/v1/cf_credits?select=balance,free_balance&user_id=eq.' + encodeURIComponent(userId), { headers: sbHeaders(c) });
  const rows = r.ok ? await r.json() : [];
  const row = rows && rows[0];
  return { free: row ? Number(row.free_balance || 0) : 0, paid: row ? Number(row.balance || 0) : 0 };
}
async function getOrder(c, orderId) {
  const r = await fetch(c.sbUrl + '/rest/v1/cf_orders?select=*&order_id=eq.' + encodeURIComponent(orderId), { headers: sbHeaders(c) });
  const rows = r.ok ? await r.json() : [];
  return rows && rows[0] ? rows[0] : null;
}
async function patchOrder(c, orderId, patch, filter) {
  const r = await fetch(c.sbUrl + '/rest/v1/cf_orders?order_id=eq.' + encodeURIComponent(orderId) + (filter ? '&' + filter : ''), {
    method: 'PATCH', headers: sbHeaders(c, { Prefer: 'return=representation' }), body: JSON.stringify(patch),
  });
  const rows = r.ok ? await r.json() : [];
  return rows && rows[0] ? rows[0] : null;
}

function tossAuth(c) {
  return 'Basic ' + btoa(c.secretKey + ':');
}
/* 토스 결제 조회 API — paymentKey 로, 없으면 주문번호로 */
async function tossPayment(c, paymentKey, orderId) {
  const path = paymentKey ? '/v1/payments/' + encodeURIComponent(paymentKey) : '/v1/payments/orders/' + encodeURIComponent(orderId);
  const r = await fetch('https://api.tosspayments.com' + path, { headers: { Authorization: tossAuth(c) }, signal: AbortSignal.timeout(15000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || ('토스 조회 실패 ' + r.status));
  return d;
}
/* 토스가 알려준 결제가 이 주문과 같은 결제인지 대조 (상태 DONE · 주문번호 · 금액 · 선택: 상점아이디) */
function paidMatches(c, order, p) {
  if (!p || p.status !== 'DONE') return false;
  if (String(p.orderId || '') !== String(order.order_id)) return false;
  if (Number(p.totalAmount) !== Number(order.amount)) return false;
  if (c.mid && p.mId && String(p.mId) !== c.mid) return false;
  return true;
}
/* 확인된 결제를 충전: pending(또는 예전 버그로 failed 된 주문) → paid 를 먼저 잡아 두 번 충전되지 않게 */
async function finalize(c, order, paymentKey, p) {
  const locked = await patchOrder(c, order.order_id, { status: 'paid', payment_key: paymentKey || p.paymentKey || null, method: p.method || null, paid_at: new Date().toISOString() }, 'status=in.(pending,failed)');
  if (!locked) return { already: true, order };
  await rpc(c, 'cf_topup', { p_user: order.user_id, p_amount: order.credits, p_note: '토스 결제 ' + order.order_id });
  return { already: false, order: locked };
}

/* 토스에 결제 승인 요청 → 성공하면 크레딧 충전 (같은 주문은 한 번만) */
async function confirmAndTopup(c, paymentKey, orderId, amount) {
  const order = await getOrder(c, orderId);
  if (!order) throw new Error('주문을 찾을 수 없습니다');
  if (order.status === 'paid') return { already: true, order };
  if (Number(amount) !== Number(order.amount)) throw new Error('결제 금액이 주문과 다릅니다');

  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: tossAuth(c), 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount: Number(order.amount) }),
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    // 새로고침·웹훅과 겹쳐서 "이미 처리된 결제"면 실패로 만들지 않고 조회 API로 확인해 충전
    if (d.code === 'ALREADY_PROCESSED_PAYMENT') {
      const p = await tossPayment(c, paymentKey, orderId);
      if (paidMatches(c, order, p)) return finalize(c, order, paymentKey, p);
    }
    await patchOrder(c, orderId, { status: 'failed', note: String(d.message || d.code || r.status).slice(0, 300) }, 'status=eq.pending');
    throw new Error(d.message || ('토스 승인 실패 ' + r.status));
  }
  // 승인 응답도 대조 (상태 DONE · 주문번호 · 금액)
  if (!paidMatches(c, order, d)) {
    await patchOrder(c, orderId, { note: ('승인 응답 불일치: ' + (d.status || '') + ' ' + (d.orderId || '') + ' ' + (d.totalAmount || '')).slice(0, 300) }, 'status=eq.pending');
    throw new Error('결제 확인 결과가 주문과 맞지 않습니다. 문의해 주세요.');
  }
  return finalize(c, order, paymentKey, d);
}

/* 웹훅 처리 — 본문은 믿지 않고 조회 API 결과로만 판단 */
async function handleWebhook(c, body) {
  const data = (body && body.data) || body || {};
  const orderId = String(data.orderId || '');
  const paymentKey = String(data.paymentKey || '');
  if (!orderId || !c.secretKey) return;
  const order = await getOrder(c, orderId);
  if (!order) return;
  const p = await tossPayment(c, paymentKey, orderId);
  if (String(p.orderId || '') !== orderId) return;
  if (paidMatches(c, order, p)) {
    if (order.status !== 'paid') await finalize(c, order, p.paymentKey || paymentKey, p);
    return;
  }
  if (p.status === 'CANCELED' || p.status === 'ABORTED' || p.status === 'EXPIRED') {
    // 결제가 끝나지 않은 주문만 취소로 표시 (충전된 주문의 환불은 환불 기능이 따로 기록)
    await patchOrder(c, orderId, { status: 'canceled', note: p.status }, 'status=in.(pending,failed)');
  }
}
/* 같은 웹훅 두 번 처리 방지 — 처리에 성공한 웹훅만 기록. 표(cf_webhook_seen)가 없으면 그냥 처리
   (같은 결제가 두 번 충전되는 일은 주문 잠금(pending→paid)이 이미 막음) */
async function seenBefore(c, tid) {
  if (!tid) return false;
  try {
    const r = await fetch(c.sbUrl + '/rest/v1/cf_webhook_seen?select=transmission_id&transmission_id=eq.' + encodeURIComponent(String(tid).slice(0, 200)), { headers: sbHeaders(c) });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) { return false; }
}
async function markSeen(c, tid) {
  if (!tid) return;
  try {
    await fetch(c.sbUrl + '/rest/v1/cf_webhook_seen', { method: 'POST', headers: sbHeaders(c, { Prefer: 'return=minimal,resolution=ignore-duplicates' }), body: JSON.stringify({ transmission_id: String(tid).slice(0, 200) }) });
  } catch (e) { /* 표가 없으면 무시 */ }
}

async function handleGet(context) {
  const { request, env } = context;
  const c = cfg(env);
  const url = new URL(request.url);

  if (url.searchParams.get('config')) {
    return json({ url: c.sbUrl, anonKey: c.anon, clientKey: c.clientKey, packages: c.packages, enabled: !!(c.clientKey && c.secretKey), testMode: /^test_/.test(c.clientKey) });
  }

  if (url.searchParams.get('op') === 'confirm') {
    const paymentKey = url.searchParams.get('paymentKey') || '';
    const orderId = url.searchParams.get('orderId') || '';
    const amount = url.searchParams.get('amount') || '';
    if (!c.secretKey) return redirect('/buy?fail=' + encodeURIComponent('결제 키가 아직 등록되지 않았습니다'));
    try {
      const r = await confirmAndTopup(c, paymentKey, orderId, amount);
      return redirect('/buy?done=1&credits=' + r.order.credits + '&order=' + encodeURIComponent(orderId));
    } catch (e) {
      return redirect('/buy?fail=' + encodeURIComponent(String(e.message || e).slice(0, 200)));
    }
  }

  if (!c.sbUrl || !c.service) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const user = await getUser(c, request);
  if (!user) return json({ error: 'login' }, 401);

  if (url.searchParams.get('me')) {
    const cr = await getCredits(c, user.id);
    const r = await fetch(c.sbUrl + '/rest/v1/cf_orders?select=order_id,package,credits,amount,status,method,created_at,paid_at&user_id=eq.' + encodeURIComponent(user.id) + '&order=created_at.desc&limit=30', { headers: sbHeaders(c) });
    const orders = r.ok ? await r.json() : [];
    /* 2026-10-10: 환불 완료 기록(cf_refunds, status=done)도 충전 내역에 한 줄씩 같이 보여 줌
       → { credits:-550, amount:-49000, status:'refunded', created_at:환불 시각 }.  표가 없거나 실패하면 결제 줄만 */
    let refunds = [];
    try {
      const rr = await fetch(c.sbUrl + '/rest/v1/cf_refunds?select=order_id,credits,amount,fee,created_at&user_id=eq.' + encodeURIComponent(user.id) + '&status=eq.done&order=created_at.desc&limit=30', { headers: sbHeaders(c) });
      refunds = rr.ok ? await rr.json() : [];
    } catch (e) { refunds = []; }
    const rows = orders.concat((refunds || []).map((x) => ({
      order_id: x.order_id, package: 'refund', credits: -Math.abs(Number(x.credits) || 0), amount: -Math.abs(Number(x.amount) || 0),
      fee: Number(x.fee) || 0, status: 'refunded', method: null, created_at: x.created_at, paid_at: x.created_at,
    })));
    rows.sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime());
    return json({ email: user.email, free: cr.free, paid: cr.paid, orders: rows.slice(0, 40) });
  }
  return json({ error: 'unknown' }, 400);
}

async function handlePost(context) {
  const { request, env } = context;
  const c = cfg(env);
  const url = new URL(request.url);
  if (!c.sbUrl || !c.service) return json({ error: 'Supabase 설정이 없습니다' }, 500);

  // 토스 웹훅: 브라우저 확인이 끊겨도 결제가 DONE 이면 충전합니다 — 바로 200 으로 답하고 처리는 뒤에서
  if (url.searchParams.get('webhook')) {
    let body = {};
    try { body = await request.json(); } catch (e) { body = {}; }
    const tid = request.headers.get('tosspayments-webhook-transmission-id') || '';
    const work = (async () => {
      try {
        if (await seenBefore(c, tid)) return;
        await handleWebhook(c, body);
        await markSeen(c, tid);
      } catch (e) { /* 기록하지 않음 → 토스가 다시 보내면 다시 처리 */ }
    })();
    if (context.waitUntil) context.waitUntil(work); else await work;
    return json({ ok: true });
  }

  const user = await getUser(c, request);
  if (!user) return json({ error: 'login' }, 401);
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }

  if (body.op === 'create') {
    if (!c.clientKey || !c.secretKey) return json({ error: '결제 준비 중입니다. 잠시 후 다시 시도해 주세요. (결제 키 미등록)' }, 503);
    const pkg = c.packages.find((p) => p.id === body.package);
    if (!pkg) return json({ error: '패키지가 없습니다' }, 400);
    const orderId = 'cf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const r = await fetch(c.sbUrl + '/rest/v1/cf_orders', {
      method: 'POST', headers: sbHeaders(c, { Prefer: 'return=representation' }),
      body: JSON.stringify({ order_id: orderId, user_id: user.id, email: user.email || null, package: pkg.id, credits: pkg.credits, amount: pkg.amount, status: 'pending' }),
    });
    if (!r.ok) return json({ error: '주문 저장 실패: ' + (await r.text()).slice(0, 200) }, 500);
    return json({ orderId, orderName: 'coverfo 크레딧 ' + pkg.credits, amount: pkg.amount, credits: pkg.credits, customerKey: 'u_' + user.id.replace(/-/g, '').slice(0, 40), email: user.email || '' });
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
