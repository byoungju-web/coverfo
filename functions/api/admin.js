// functions/api/admin.js — coverfo 관리자 API (운영자 이메일만; Secret ADMIN_EMAILS, 기본 hasin7jk@gmail.com)
// © 2026 coverfo All Rights Reserved
//   GET  /api/admin?summary=1            → 오늘·이달 매출, 결제 건수
//   GET  /api/admin?orders=1&limit=100   → 최근 결제·충전 내역
//   GET  /api/admin?users=1&q=검색어      → 회원(이메일) + 크레딧 잔액
//   POST /api/admin {op:'topup', email, amount, note}  → 수동 충전(+) / 차감(-)

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function cfg(env) {
  return {
    sbUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    service: env.SUPABASE_SERVICE_ROLE_KEY || '',
    admins: String(env.ADMIN_EMAILS || 'hasin7jk@gmail.com').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean),
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
async function requireAdmin(c, request) {
  const u = await getUser(c, request);
  if (!u) return { err: json({ error: 'login' }, 401) };
  if (c.admins.indexOf(String(u.email || '').toLowerCase()) < 0) return { err: json({ error: '관리자만 볼 수 있습니다' }, 403) };
  return { user: u };
}
async function rpc(c, name, args) {
  const r = await fetch(c.sbUrl + '/rest/v1/rpc/' + name, { method: 'POST', headers: sbHeaders(c), body: JSON.stringify(args || {}) });
  const t = await r.text();
  if (!r.ok) throw new Error('supabase rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 300));
  try { return JSON.parse(t); } catch (e) { return t; }
}
/* 가입자 목록 (Supabase Auth 관리자 API). 최대 1000명씩 5쪽까지 */
async function listAuthUsers(c) {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(c.sbUrl + '/auth/v1/admin/users?page=' + page + '&per_page=1000', { headers: sbHeaders(c) });
    if (!r.ok) break;
    const d = await r.json();
    const users = Array.isArray(d) ? d : d.users || [];
    users.forEach((u) => out.push({ id: u.id, email: u.email || '', created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));
    if (users.length < 1000) break;
  }
  return out;
}
async function creditsMap(c) {
  const r = await fetch(c.sbUrl + '/rest/v1/cf_credits?select=user_id,balance,free_balance', { headers: sbHeaders(c) });
  const rows = r.ok ? await r.json() : [];
  const m = {};
  rows.forEach((x) => { m[x.user_id] = { paid: Number(x.balance || 0), free: Number(x.free_balance || 0) }; });
  return m;
}

async function handleGet(context) {
  const { request, env } = context;
  const c = cfg(env);
  if (!c.sbUrl || !c.service) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const a = await requireAdmin(c, request);
  if (a.err) return a.err;
  const url = new URL(request.url);

  if (url.searchParams.get('summary')) {
    const now = new Date();
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const mon0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const r = await fetch(c.sbUrl + '/rest/v1/cf_orders?select=amount,credits,status,paid_at,created_at&status=in.(paid,manual)&created_at=gte.' + encodeURIComponent(mon0), { headers: sbHeaders(c) });
    const rows = r.ok ? await r.json() : [];
    let today = 0, tcount = 0, month = 0, mcount = 0, mcredits = 0;
    rows.forEach((o) => {
      const t = o.paid_at || o.created_at;
      if (o.status === 'paid') { month += Number(o.amount || 0); mcount++; if (t >= day0) { today += Number(o.amount || 0); tcount++; } }
      mcredits += Number(o.credits || 0);
    });
    return json({ today, tcount, month, mcount, mcredits });
  }
  if (url.searchParams.get('orders')) {
    const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '100', 10) || 100);
    const r = await fetch(c.sbUrl + '/rest/v1/cf_orders?select=order_id,email,package,credits,amount,status,method,note,created_at,paid_at&order=created_at.desc&limit=' + limit, { headers: sbHeaders(c) });
    return json({ orders: r.ok ? await r.json() : [] });
  }
  if (url.searchParams.get('users')) {
    const q = String(url.searchParams.get('q') || '').toLowerCase().trim();
    const [users, cm] = await Promise.all([listAuthUsers(c), creditsMap(c)]);
    const rows = users
      .filter((u) => !q || u.email.toLowerCase().indexOf(q) >= 0)
      .map((u) => Object.assign({}, u, cm[u.id] || { paid: 0, free: 0 }))
      .sort((x, y) => (y.last_sign_in_at || '').localeCompare(x.last_sign_in_at || ''))
      .slice(0, 200);
    return json({ users: rows, total: users.length });
  }
  return json({ error: 'unknown' }, 400);
}

async function handlePost(context) {
  const { request, env } = context;
  const c = cfg(env);
  if (!c.sbUrl || !c.service) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const a = await requireAdmin(c, request);
  if (a.err) return a.err;
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }

  if (body.op === 'topup') {
    const email = String(body.email || '').toLowerCase().trim();
    const amount = parseInt(body.amount, 10);
    if (!email || !amount) return json({ error: '이메일과 크레딧 수를 적어 주세요' }, 400);
    const users = await listAuthUsers(c);
    const u = users.find((x) => x.email.toLowerCase() === email);
    if (!u) return json({ error: '그 이메일의 회원이 없습니다' }, 404);
    const res = await rpc(c, 'cf_topup', { p_user: u.id, p_amount: amount, p_note: '관리자 ' + (body.note || '') });
    await fetch(c.sbUrl + '/rest/v1/cf_orders', {
      method: 'POST', headers: sbHeaders(c),
      body: JSON.stringify({ order_id: 'manual_' + Date.now().toString(36), user_id: u.id, email: u.email, package: 'manual', credits: amount, amount: 0, status: 'manual', note: (body.note || '') + ' (by ' + a.user.email + ')', paid_at: new Date().toISOString() }),
    }).catch(() => undefined);
    return json({ ok: true, email: u.email, paid: res && res.paid });
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
