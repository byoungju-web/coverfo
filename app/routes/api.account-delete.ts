/*
 * coverfo — 크레딧 자동 환불 + 계정 탈퇴
 *   POST /api/account-delete   (Authorization: Bearer <로그인 토큰>)
 *     {op:'plan'}                                  → 환불 계획 미리보기 (돈 안 움직임)
 *     {op:'refund',  account?}                     → 충전 크레딧 잔액을 토스 결제 취소로 환불 (계정은 유지)
 *     {op:'delete',  confirm:'탈퇴', refund:true|false, account?}
 *                                                   → refund:true 면 먼저 환불, 전부 성공해야 계정 삭제
 *                                                     refund:false 면 잔액을 포기하고 바로 삭제
 *
 *   환불 규칙 (아래 상수로 조정)
 *     · 무료 크레딧은 제외, 충전 크레딧(cf_credits.balance)만
 *     · 잔액을 최근 결제(cf_orders, status=paid)부터 거꾸로 주문에 대응(LIFO) → 주문별 단가로 금액 계산
 *     · 결제 7일 이내 + 그 주문을 전혀 안 썼으면 전액, 그 외 10% 공제
 *     · 결제 1년 지난 주문은 제외(카드사 취소 가능 기간), 합계 1,000원 미만이면 환불 없음
 *     · 토스 취소 API 부분취소 + 멱등키(주문번호:rf:회차) → 두 번 눌러도 이중 환불 없음
 *     · 가상계좌·계좌이체 결제는 환불받을 계좌(refundReceiveAccount)가 필요 → 브라우저가 입력받아 보냄
 *     · 성공한 건마다 cf_refunds 에 기록 + cf_topup(-크레딧). 한 건이라도 실패하면 거기서 멈추고 계정은 지우지 않음
 *   필요한 것: Cloudflare 변수 TOSS_SECRET_KEY (결제에 이미 씀), sql/cf_refunds.sql 1회 실행
 */
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, getUserId, ok, readJson } from '~/lib/engine/server';

const FEE_PCT = 10; /* 7일 지난 뒤 환불 수수료 % */
const FULL_DAYS = 7; /* 이 안에 미사용이면 전액 */
const MAX_DAYS = 365; /* 이보다 오래된 결제는 환불 불가 */
const MIN_WON = 1000; /* 합계가 이보다 작으면 환불 없음 */

type Env = Record<string, any>;
type SB = { url: string; service: string };
type Order = { order_id: string; credits: number; amount: number; payment_key: string | null; method: string | null; paid_at: string | null; status: string };
type Item = { order_id: string; paid_at: string; method: string; order_credits: number; credits: number; gross: number; fee: number; net: number; full: boolean; needsAccount: boolean; seq: number };
type Account = { bank?: string; accountNumber?: string; holderName?: string };

function sb(env: Env): SB | null {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && service ? { url, service } : null;
}

function hdr(c: SB, extra?: Record<string, string>) {
  return { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json', ...(extra || {}) };
}

async function rpc(c: SB, name: string, args: any) {
  const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: hdr(c), body: JSON.stringify(args || {}) });
  const t = await r.text();

  if (!r.ok) {
    throw new Error(`supabase rpc ${name} ${r.status}: ${t.slice(0, 200)}`);
  }

  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

async function rows<T = any>(c: SB, path: string): Promise<T[]> {
  const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: hdr(c) });

  if (!r.ok) {
    return [];
  }

  const j: any = await r.json().catch(() => []);

  return Array.isArray(j) ? j : [];
}

async function getCredits(c: SB, userId: string) {
  const r = await rows(c, `cf_credits?select=balance,free_balance&user_id=eq.${encodeURIComponent(userId)}`);
  const row = r[0];

  return { free: row ? Number(row.free_balance || 0) : 0, paid: row ? Number(row.balance || 0) : 0 };
}

function needsAccount(method: string) {
  return /가상계좌|계좌이체/.test(method || '');
}

/** 환불 계획: 잔액을 최근 결제부터 거꾸로 주문에 대응 */
async function plan(c: SB, userId: string) {
  const credits = await getCredits(c, userId);
  const orders = await rows<Order>(c, `cf_orders?select=order_id,credits,amount,payment_key,method,paid_at,status&user_id=eq.${encodeURIComponent(userId)}&status=eq.paid&order=paid_at.desc&limit=100`);
  const prior = await rows<{ order_id: string; credits: number; status: string }>(c, `cf_refunds?select=order_id,credits,status&user_id=eq.${encodeURIComponent(userId)}&status=eq.done`);
  const refunded: Record<string, { credits: number; n: number }> = {};

  for (const p of prior) {
    const k = p.order_id;
    refunded[k] = refunded[k] || { credits: 0, n: 0 };
    refunded[k].credits += Number(p.credits || 0);
    refunded[k].n += 1;
  }

  const now = Date.now();
  const items: Item[] = [];
  const skipped: { order_id: string; why: string }[] = [];
  let remaining = credits.paid;

  for (const o of orders) {
    if (remaining <= 0) {
      break;
    }

    const paidAt = o.paid_at ? new Date(o.paid_at).getTime() : 0;
    const days = paidAt ? (now - paidAt) / 86400000 : 9999;
    const used = refunded[o.order_id] || { credits: 0, n: 0 };
    const left = Number(o.credits || 0) - used.credits;

    if (!o.payment_key) {
      skipped.push({ order_id: o.order_id, why: '결제 정보 없음(수동 충전)' });
      continue;
    }

    if (days > MAX_DAYS) {
      skipped.push({ order_id: o.order_id, why: `결제 ${MAX_DAYS}일 경과` });
      continue;
    }

    if (left <= 0) {
      continue;
    }

    const take = Math.min(remaining, left);
    const gross = Math.floor((take * Number(o.amount || 0)) / Number(o.credits || 1));
    const full = days <= FULL_DAYS && take === Number(o.credits || 0);
    const fee = full ? 0 : Math.floor((gross * FEE_PCT) / 100);
    const method = String(o.method || '');

    items.push({ order_id: o.order_id, paid_at: o.paid_at || '', method, order_credits: Number(o.credits || 0), credits: take, gross, fee, net: gross - fee, full, needsAccount: needsAccount(method), seq: used.n + 1 });
    remaining -= take;
  }

  const total = items.reduce((s, i) => s + i.net, 0);
  const tooSmall = total > 0 && total < MIN_WON;

  return {
    free: credits.free,
    paid: credits.paid,
    items: tooSmall ? [] : items,
    skipped: tooSmall ? skipped.concat(items.map((i) => ({ order_id: i.order_id, why: `합계 ${MIN_WON.toLocaleString()}원 미만` }))) : skipped,
    unmatched: remaining, // 주문에 못 맞춘 잔액(수동 충전분 등)
    total: tooSmall ? 0 : total,
    needsAccount: !tooSmall && items.some((i) => i.needsAccount),
    rule: { feePct: FEE_PCT, fullDays: FULL_DAYS, maxDays: MAX_DAYS, minWon: MIN_WON },
  };
}

/** 토스 결제 취소 (부분) — 멱등키로 같은 회차는 한 번만 */
async function tossCancel(secret: string, paymentKey: string, orderId: string, seq: number, amount: number, account?: Account) {
  const body: any = { cancelReason: 'coverfo 크레딧 환불', cancelAmount: amount };

  if (account && account.bank && account.accountNumber && account.holderName) {
    body.refundReceiveAccount = { bank: account.bank, accountNumber: String(account.accountNumber).replace(/[^0-9]/g, ''), holderName: account.holderName };
  }

  const r = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(secret + ':'), 'Content-Type': 'application/json', 'Idempotency-Key': `${orderId}:rf:${seq}`.slice(0, 300) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const d: any = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(d?.message || d?.code || `toss ${r.status}`);
  }

  const cancels: any[] = d?.cancels || [];
  const last = cancels[cancels.length - 1] || {};

  return String(last.transactionKey || '');
}

/** 계획대로 실행. 실패하면 거기서 멈추고 {done, failed} 반환 */
async function execute(c: SB, env: Env, user: { id: string; email: string }, account?: Account) {
  const secret = String(env.TOSS_SECRET_KEY || '');

  if (!secret) {
    throw new Error('TOSS_SECRET_KEY 가 없습니다');
  }

  const p = await plan(c, user.id);
  const done: Item[] = [];
  let failed: { order_id: string; error: string } | null = null;

  for (const it of p.items) {
    if (it.needsAccount && !(account && account.bank && account.accountNumber && account.holderName)) {
      failed = { order_id: it.order_id, error: '가상계좌·계좌이체 결제라 환불받을 계좌가 필요합니다' };
      break;
    }

    const o = (await rows<Order>(c, `cf_orders?select=order_id,payment_key&order_id=eq.${encodeURIComponent(it.order_id)}`))[0];

    try {
      const tx = await tossCancel(secret, String(o?.payment_key || ''), it.order_id, it.seq, it.net, it.needsAccount ? account : undefined);

      await fetch(`${c.url}/rest/v1/cf_refunds`, {
        method: 'POST',
        headers: hdr(c, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ order_id: it.order_id, user_id: user.id, email: user.email || null, credits: it.credits, gross: it.gross, fee: it.fee, amount: it.net, method: it.method, transaction_key: tx, status: 'done', reason: 'user' }),
      });
      await rpc(c, 'cf_topup', { p_user: user.id, p_amount: -it.credits, p_note: '환불 ' + it.order_id });
      done.push(it);
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 200);

      await fetch(`${c.url}/rest/v1/cf_refunds`, {
        method: 'POST',
        headers: hdr(c, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ order_id: it.order_id, user_id: user.id, email: user.email || null, credits: it.credits, gross: it.gross, fee: it.fee, amount: it.net, method: it.method, status: 'failed', reason: 'user', error: msg }),
      }).catch(() => undefined);
      failed = { order_id: it.order_id, error: msg };
      break;
    }
  }

  return { done, failed, total: done.reduce((s, i) => s + i.net, 0) };
}

async function deleteUser(c: SB, userId: string) {
  const r = await fetch(`${c.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { apikey: c.service, Authorization: `Bearer ${c.service}` },
  });

  if (!r.ok && r.status !== 404) {
    const t = await r.text().catch(() => '');
    throw new Error(`삭제하지 못했습니다 (${r.status}) ${t.slice(0, 200)}`);
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return fail('POST only', 405);
  }

  const env = envOf(context);
  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  const c = sb(env);

  if (!c) {
    return fail('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다', 500);
  }

  const body = await readJson<{ op?: string; confirm?: string; refund?: boolean; account?: Account }>(request);
  const op = String(body.op || 'delete');

  try {
    if (op === 'plan') {
      return ok(await plan(c, user.id));
    }

    if (op === 'refund') {
      const r = await execute(c, env, user, body.account);

      return ok({ ok: !r.failed, ...r, after: await getCredits(c, user.id) });
    }

    if (op === 'delete') {
      if (String(body.confirm || '') !== '탈퇴') {
        return fail('확인 문구가 다릅니다', 400);
      }

      let refund: any = null;

      if (body.refund) {
        refund = await execute(c, env, user, body.account);

        if (refund.failed) {
          // 돈 문제가 남은 채로 계정을 지우지 않는다
          return ok({ ok: false, refund, error: '환불이 일부 실패해 탈퇴를 멈췄습니다: ' + refund.failed.error });
        }
      }

      await deleteUser(c, user.id);

      return ok({ ok: true, refund });
    }

    return fail('알 수 없는 op', 400);
  } catch (e: any) {
    return fail(String(e?.message || e).slice(0, 300), 502);
  }
}
