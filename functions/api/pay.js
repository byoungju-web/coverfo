// functions/api/pay.js — coverfo 크레딧 충전 결제 (토스페이먼츠)
// © 2026 coverfo All Rights Reserved
//
// 필요한 Secret (Cloudflare Pages → Settings → Variables and Secrets):
//   TOSS_CLIENT_KEY   토스 클라이언트 키 (test_ck_… 로 시작하면 테스트 결제)
//   TOSS_SECRET_KEY   토스 시크릿 키   (test_sk_… / live_sk_…)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  (gen.js 와 동일)
// 선택: PACKAGES  예) "starter:100:9900,plus:300:27000,pro:1000:79000"  (이름:크레딧:원)
//
//   GET  /api/pay?config=1                       → { url, anonKey, clientKey, packages, testMode }
//   GET  /api/pay?me=1                           → { email, free, paid, orders:[...] }   (로그인 필요)
//   POST /api/pay  {op:'create', package}        → { orderId, orderName, amount, credits, customerKey }  (로그인 필요)
//   GET  /api/pay?op=confirm&paymentKey&orderId&amount  → 토스에 결제 확인 → 충전 → /buy?done=1 로 이동
//   POST /api/pay?webhook=1                      → 토스 웹훅 (결제 상태 변경 시 토스가 호출; 확인 누락 대비)

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function redirect(url) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}
function cfg(env) {
  const raw = String(env.PACKAGES || 'starter:100:9900,plus:300:27000,pro:1000:79000');
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

/* 토스에 결제 승인 요청 → 성공하면 크레딧 충전 (같은 주문은 한 번만) */
async function confirmAndTopup(c, paymentKey, orderId, amount) {
  const order = await getOrder(c, orderId);
  if (!order) throw new Error('주문을 찾을 수 없습니다');
  if (order.status === 'paid') return { already: true, order };
  if (Number(amount) !== Number(order.amount)) throw new Error('결제 금액이 주문과 다릅니다');

  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(c.secretKey + ':'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    await patchOrder(c, orderId, { status: 'failed', note: String(d.message || d.code || r.status).slice(0, 300) }, 'status=eq.pending');
    throw new Error(d.message || ('토스 승인 실패 ' + r.status));
  }
  // pending → paid 를 먼저 잡아 두 번 충전되지 않게 합니다
  const locked = await patchOrder(c, orderId, { status: 'paid', payment_key: paymentKey, method: d.method || null, paid_at: new Date().toISOString() }, 'status=eq.pending');
  if (!locked) return { already: true, order };
  await rpc(c, 'cf_topup', { p_user: order.user_id, p_amount: order.credits, p_note: '토스 결제 ' + orderId });
  return { already: false, order: locked };
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
    return json({ email: user.email, free: cr.free, paid: cr.paid, orders });
  }
  return json({ error: 'unknown' }, 400);
}

async function handlePost(context) {
  const { request, env } = context;
  const c = cfg(env);
  const url = new URL(request.url);
  if (!c.sbUrl || !c.service) return json({ error: 'Supabase 설정이 없습니다' }, 500);

  // 토스 웹훅: 브라우저 확인이 끊겨도 결제가 DONE 이면 충전합니다
  if (url.searchParams.get('webhook')) {
    let body = {};
    try { body = await request.json(); } catch (e) { body = {}; }
    const data = body.data || body;
    const status = data.status || '';
    const orderId = data.orderId || '';
    const paymentKey = data.paymentKey || '';
    if (!orderId) return json({ ok: true, ignored: true });
    try {
      if (status === 'DONE' && c.secretKey) {
        const order = await getOrder(c, orderId);
        if (order && order.status === 'pending') await confirmAndTopup(c, paymentKey, orderId, order.amount);
      } else if (status === 'CANCELED' || status === 'PARTIAL_CANCELED' || status === 'ABORTED' || status === 'EXPIRED') {
        await patchOrder(c, orderId, { status: 'canceled', note: status }, 'status=neq.paid');
      }
    } catch (e) { /* 웹훅은 항상 200 으로 답해야 토스가 재전송을 멈춥니다 */ }
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
