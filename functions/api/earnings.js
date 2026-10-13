// functions/api/earnings.js — 💰 내 수익 (마켓 판매로 번 "수익 크레딧")
// © 2026 coverfo All Rights Reserved
//
//   GET  /api/earnings                    → { ok, earned, total, count, month, items:[{amount, kind, title, price, at}] }  최근 50줄
//   POST /api/earnings {op:'move', amount} → { ok, earned, paid }   수익 크레딧 → 사용 크레딧(충전 칸)으로 옮기기
//   (Authorization: Bearer 로그인토큰)   필요한 것: sql/cf_earned.sql 1회 실행

export async function onRequestGet(context) {
  const c = sb(context.env || {}); if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const uid = await userId(context.request, c); if (!uid) return json({ error: '로그인이 필요합니다' }, 401);

  const cr = await rows(c, `cf_credits?user_id=eq.${uid}&select=earned`);
  if (cr === null) return json({ error: '수익 정보를 읽지 못했습니다. sql/cf_earned.sql 을 실행했는지 확인해 주세요.' }, 500);
  const earned = Number((cr[0] && cr[0].earned) || 0);

  const items = (await rows(c, `cf_earnings?user_id=eq.${uid}&select=amount,kind,item_type,item_id,price,note,created_at&order=id.desc&limit=50`)) || [];
  const sales = (await rows(c, `cf_earnings?user_id=eq.${uid}&kind=in.(sale,adjust)&select=amount,kind,created_at&limit=5000`)) || [];
  const k = new Date(Date.now() + 9 * 3600000);   /* 한국 시간 */
  const m0 = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3600000);   /* 한국 시간 이번 달 1일 0시 */
  let total = 0, month = 0, count = 0;
  for (const s of sales) {
    const a = Number(s.amount || 0); total += a;
    if (s.kind === 'sale') count++;
    if (new Date(s.created_at).getTime() >= m0.getTime()) month += a;
  }

  /* 레시피 이름 붙이기 */
  const ids = [...new Set(items.filter((x) => x.item_type === 'recipe' && x.item_id).map((x) => Number(x.item_id)))];
  const names = {};
  if (ids.length) for (const r of (await rows(c, `cf_recipes?id=in.(${ids.join(',')})&select=id,title,icon`)) || []) names[r.id] = (r.icon || '🧩') + ' ' + r.title;

  return json({
    ok: true, earned, total: r1(total), month: r1(month), count,
    items: items.map((x) => ({
      amount: Number(x.amount || 0), kind: x.kind, price: x.price == null ? null : Number(x.price),
      title: x.item_type === 'recipe' ? (names[x.item_id] || '🧩 레시피 #' + x.item_id) : (x.kind === 'move' ? '' : (x.note || '')), at: x.created_at,
    })),
  });
}

export async function onRequestPost(context) {
  const c = sb(context.env || {}); if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  const uid = await userId(context.request, c); if (!uid) return json({ error: '로그인이 필요합니다' }, 401);
  let b = {}; try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  if (b.op !== 'move') return json({ error: 'op 가 잘못되었습니다 (move)' }, 400);
  const amount = Math.round(Number(b.amount) * 10) / 10;
  if (!(amount > 0) || amount > 1000000) return json({ error: '옮길 크레딧을 바르게 적어 주세요' }, 400);
  const r = await fetch(`${c.url}/rest/v1/rpc/cf_earned_move`, { method: 'POST', headers: hdr(c), body: JSON.stringify({ p_user: uid, p_amount: amount }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) return json({ error: '옮기지 못했습니다 (' + r.status + ')' }, 500);
  if (!j.ok) return json({ ok: false, error: j.reason === 'insufficient' ? '수익 크레딧이 모자랍니다' : '옮기지 못했습니다', earned: Number(j.earned || 0) });
  return json({ ok: true, earned: Number(j.earned || 0), paid: Number(j.paid || 0) });
}

function r1(n) { return Math.round(n * 10) / 10; }
async function rows(c, path) {
  try { const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: hdr(c) }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j : []; } catch { return null; }
}
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function sb(env) { const u = String(env.SUPABASE_URL || '').replace(/\/+$/, ''); const k = env.SUPABASE_SERVICE_ROLE_KEY || ''; return u && k ? { url: u, svc: k } : null; }
function hdr(c) { return { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' }; }
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
